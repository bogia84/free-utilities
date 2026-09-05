import { INTERVAL_OPTIONS, DATE_OPTIONS } from './common.js';

const rolesInput = document.getElementById('roles');
const intervalSelect = document.getElementById('interval');
const dateSelect = document.getElementById('datePosted');
const saveBtn = document.getElementById('saveBtn');
const scanBtn = document.getElementById('scanBtn');
const saveMsg = document.getElementById('saveMsg');
const statusLine = document.getElementById('statusLine');
const unreadCountEl = document.getElementById('unreadCount');
const previewList = document.getElementById('previewList');
const openResults = document.getElementById('openResults');

function fillSelect(select, options, labelKey = 'label', valueKey = 'value') {
  select.innerHTML = '';
  for (const opt of options) {
    const el = document.createElement('option');
    el.value = opt[valueKey];
    el.textContent = opt[labelKey];
    select.appendChild(el);
  }
}

function timeAgo(ts) {
  if (!ts) return '';
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function renderPreview(jobs, lastScan) {
  const unread = jobs.filter(j => j.isNew);
  unreadCountEl.textContent = `${unread.length} new`;

  const top = [...jobs].sort((a, b) => (b.firstSeenAt || 0) - (a.firstSeenAt || 0)).slice(0, 6);
  previewList.innerHTML = '';
  if (top.length === 0) {
    previewList.innerHTML = '<li class="empty">No jobs found yet. Set a role and scan.</li>';
  } else {
    for (const job of top) {
      const li = document.createElement('li');
      li.innerHTML = `<a href="${escapeHtml(job.link)}" target="_blank" rel="noopener">${escapeHtml(job.title)}</a>
        <div class="meta">${escapeHtml(job.company || '')} · ${sourceLabel(job.source)} · ${escapeHtml(job.ageLabel || '')}</div>`;
      previewList.appendChild(li);
    }
  }

  if (lastScan?.at) {
    statusLine.textContent = `Last scan ${timeAgo(lastScan.at)} — ${lastScan.foundCount ?? 0} matching, ${lastScan.newCount ?? 0} new`;
  } else {
    statusLine.textContent = 'Never scanned yet';
  }
}

function sourceLabel(source) {
  return { itviec: 'ITviec', vietnamworks: 'VietnamWorks', linkedin: 'LinkedIn' }[source] || source;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function loadState() {
  const res = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
  if (!res?.ok) return;
  rolesInput.value = (res.settings.roles || []).join(', ');
  intervalSelect.value = String(res.settings.intervalMinutes);
  dateSelect.value = res.settings.datePosted;
  renderPreview(res.jobs || [], res.lastScan);
}

fillSelect(intervalSelect, INTERVAL_OPTIONS);
fillSelect(dateSelect, DATE_OPTIONS);
loadState();

saveBtn.addEventListener('click', async () => {
  const roles = rolesInput.value.split(',').map(s => s.trim()).filter(Boolean);
  const settings = {
    roles,
    intervalMinutes: Number(intervalSelect.value),
    datePosted: dateSelect.value
  };
  saveBtn.disabled = true;
  await chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', settings });
  saveBtn.disabled = false;
  saveMsg.textContent = roles.length ? 'Saved.' : 'Saved — add a role to start scanning.';
  setTimeout(() => { saveMsg.textContent = ''; }, 2500);
});

scanBtn.addEventListener('click', async () => {
  scanBtn.disabled = true;
  scanBtn.textContent = 'Scanning…';
  try {
    await chrome.runtime.sendMessage({ type: 'SCAN_NOW' });
  } finally {
    scanBtn.disabled = false;
    scanBtn.textContent = 'Scan now';
    loadState();
  }
});

openResults.addEventListener('click', e => {
  e.preventDefault();
  chrome.tabs.create({ url: chrome.runtime.getURL('results.html') });
});
