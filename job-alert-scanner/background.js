import {
  ALARM_NAME, parseRelativeAgeDays, ageDaysFromIsoDate, withinRange,
  formatAge, jobKey
} from './common.js';
import { getSettings, saveSettings, getJobs, saveJobs, getSeenLinks, saveSeenLinks, getLastScan, saveLastScan } from './storage.js';
import { buildItviecUrl } from './sites/itviec.js';
import { buildLinkedinUrl } from './sites/linkedin.js';
import { buildVietnamworksUrl, extractVietnamworksJobsInPage } from './sites/vietnamworks.js';

const MAX_STORED_JOBS = 300;
const MAX_SEEN_LINKS = 2500;
const WINDOW_LOAD_TIMEOUT_MS = 15000;
const RENDER_SETTLE_MS = 2500;

let scanning = false;

// --- lifecycle -------------------------------------------------------------

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await getSettings();
  await saveSettings(settings);
  await scheduleAlarm(settings.intervalMinutes);
});

chrome.runtime.onStartup.addListener(async () => {
  const settings = await getSettings();
  await scheduleAlarm(settings.intervalMinutes);
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === ALARM_NAME) runScan('alarm');
});

chrome.notifications.onClicked.addListener(notificationId => {
  chrome.tabs.create({ url: chrome.runtime.getURL('results.html') });
  chrome.notifications.clear(notificationId);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.target === 'offscreen') return false;

  (async () => {
    switch (message.type) {
      case 'GET_STATE': {
        const [settings, jobs, lastScan] = await Promise.all([getSettings(), getJobs(), getLastScan()]);
        sendResponse({ ok: true, settings, jobs, lastScan });
        break;
      }
      case 'SAVE_SETTINGS': {
        await saveSettings(message.settings);
        await scheduleAlarm(message.settings.intervalMinutes);
        sendResponse({ ok: true });
        break;
      }
      case 'SCAN_NOW': {
        const result = await runScan('manual');
        sendResponse({ ok: true, result });
        break;
      }
      case 'MARK_ALL_READ': {
        const jobs = await getJobs();
        jobs.forEach(j => { j.isNew = false; });
        await saveJobs(jobs);
        await updateBadge(jobs);
        sendResponse({ ok: true });
        break;
      }
      default:
        sendResponse({ ok: false, error: 'unknown message type' });
    }
  })();

  return true; // keep the message channel open for the async response
});

// --- scheduling --------------------------------------------------------

async function scheduleAlarm(intervalMinutes) {
  await chrome.alarms.clear(ALARM_NAME);
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: intervalMinutes, delayInMinutes: 1 });
}

// --- offscreen document parsing (ITviec, LinkedIn) ----------------------

async function ensureOffscreenDocument() {
  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['DOM_PARSER'],
      justification: 'Parse fetched job-listing HTML from ITviec and LinkedIn.'
    });
  } catch (err) {
    // Already exists — fine, reuse it.
    if (!String(err).includes('single offscreen')) throw err;
  }
}

async function parseHtmlViaOffscreen(site, html, role) {
  await ensureOffscreenDocument();
  const response = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'PARSE_HTML', site, html, role });
  if (!response?.ok) throw new Error(response?.error || `Failed to parse ${site} HTML`);
  return response.jobs;
}

async function fetchText(url) {
  const res = await fetch(url, { credentials: 'omit' });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
}

// --- VietnamWorks: needs real JS rendering, done in a background window ----

function waitForTabComplete(tabId) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Timed out waiting for VietnamWorks page to load'));
    }, WINDOW_LOAD_TIMEOUT_MS);

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function scrapeVietnamworks(role) {
  const url = buildVietnamworksUrl(role);
  const win = await chrome.windows.create({ url, focused: false, state: 'minimized', type: 'popup', populate: true });
  const tabId = win.tabs[0].id;
  try {
    await waitForTabComplete(tabId);
    await new Promise(r => setTimeout(r, RENDER_SETTLE_MS));
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, func: extractVietnamworksJobsInPage });
    return (result || []).map(j => ({ ...j, source: 'vietnamworks', role }));
  } finally {
    await chrome.windows.remove(win.id).catch(() => {});
  }
}

// --- per-site scan wrappers ----------------------------------------------

async function scanItviec(role) {
  const html = await fetchText(buildItviecUrl(role));
  const jobs = await parseHtmlViaOffscreen('itviec', html, role);
  return jobs.map(j => ({ ...j, ageDays: parseRelativeAgeDays(j.postedText) }));
}

async function scanLinkedin(role, datePosted) {
  const html = await fetchText(buildLinkedinUrl(role, datePosted));
  const jobs = await parseHtmlViaOffscreen('linkedin', html, role);
  return jobs.map(j => ({
    ...j,
    ageDays: j.postedIso ? ageDaysFromIsoDate(j.postedIso) : parseRelativeAgeDays(j.postedText)
  }));
}

async function scanVietnamworks(role) {
  const jobs = await scrapeVietnamworks(role);
  return jobs.map(j => ({ ...j, ageDays: parseRelativeAgeDays(j.postedText) }));
}

// --- main scan orchestration ------------------------------------------

export async function runScan(trigger) {
  if (scanning) return { skipped: true, reason: 'A scan is already running' };
  scanning = true;

  const errors = [];
  try {
    const settings = await getSettings();
    const roles = (settings.roles || []).map(r => r.trim()).filter(Boolean);

    if (roles.length === 0) {
      await saveLastScan({ at: Date.now(), trigger, foundCount: 0, newCount: 0, errors: ['No role configured'] });
      return { foundCount: 0, newCount: 0, errors: ['No role configured'] };
    }

    const perRoleSitePromises = [];
    for (const role of roles) {
      perRoleSitePromises.push(runSafely('ITviec', role, () => scanItviec(role), errors));
      perRoleSitePromises.push(runSafely('LinkedIn', role, () => scanLinkedin(role, settings.datePosted), errors));
      perRoleSitePromises.push(runSafely('VietnamWorks', role, () => scanVietnamworks(role), errors));
    }

    const nested = await Promise.all(perRoleSitePromises);
    const found = nested.flat().filter(Boolean);

    // De-dupe within this scan pass and apply the date-posted filter.
    const byId = new Map();
    for (const job of found) {
      if (!withinRange(job.ageDays, settings.datePosted)) continue;
      const id = jobKey(job.link);
      if (!byId.has(id)) byId.set(id, { ...job, id, ageLabel: formatAge(job.ageDays) });
    }

    const seen = await getSeenLinks();
    const existingJobs = await getJobs();
    const existingById = new Map(existingJobs.map(j => [j.id, j]));

    let newCount = 0;
    const now = Date.now();
    for (const [id, job] of byId) {
      if (existingById.has(id)) {
        // Refresh details but keep read/unread + first-seen state.
        const prev = existingById.get(id);
        existingById.set(id, { ...prev, ...job, isNew: prev.isNew, firstSeenAt: prev.firstSeenAt });
      } else {
        const isNew = !seen[id];
        if (isNew) newCount++;
        existingById.set(id, { ...job, isNew, firstSeenAt: now });
      }
      seen[id] = now;
    }

    let mergedJobs = Array.from(existingById.values());
    mergedJobs.sort((a, b) => sortTime(b) - sortTime(a));
    mergedJobs = mergedJobs.slice(0, MAX_STORED_JOBS);

    await saveJobs(mergedJobs);
    await pruneAndSaveSeen(seen);
    await updateBadge(mergedJobs);

    const lastScan = { at: now, trigger, foundCount: byId.size, newCount, errors };
    await saveLastScan(lastScan);

    if (newCount > 0) notifyNewJobs(mergedJobs.filter(j => j.isNew), newCount);

    return lastScan;
  } finally {
    scanning = false;
  }
}

async function runSafely(label, role, fn, errors) {
  try {
    return await fn();
  } catch (err) {
    errors.push(`${label} (${role}): ${err.message || err}`);
    return [];
  }
}

function sortTime(job) {
  if (job.postedIso) {
    const t = new Date(job.postedIso).getTime();
    if (!Number.isNaN(t)) return t;
  }
  if (typeof job.ageDays === 'number') return Date.now() - job.ageDays * 86400000;
  return job.firstSeenAt || 0;
}

async function pruneAndSaveSeen(seen) {
  const entries = Object.entries(seen);
  if (entries.length <= MAX_SEEN_LINKS) {
    await saveSeenLinks(seen);
    return;
  }
  entries.sort((a, b) => a[1] - b[1]); // oldest first
  const trimmed = entries.slice(entries.length - MAX_SEEN_LINKS);
  await saveSeenLinks(Object.fromEntries(trimmed));
}

async function updateBadge(jobs) {
  const unread = jobs.filter(j => j.isNew).length;
  await chrome.action.setBadgeText({ text: unread > 0 ? (unread > 99 ? '99+' : String(unread)) : '' });
  await chrome.action.setBadgeBackgroundColor({ color: '#e0483d' });
}

function notifyNewJobs(newJobs, newCount) {
  const topTitles = newJobs.slice(0, 3).map(j => `• ${j.title} (${j.source})`).join('\n');
  chrome.notifications.create(`job-alert-${Date.now()}`, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: `Job Alert Scanner — ${newCount} new job${newCount > 1 ? 's' : ''} found`,
    message: topTitles || 'Open the extension to see details.',
    priority: 1
  });
}
