import { DEFAULT_SETTINGS } from './common.js';

const KEYS = {
  settings: 'settings',
  jobs: 'jobs',
  seen: 'seenLinks',
  lastScan: 'lastScan'
};

export async function getSettings() {
  const { [KEYS.settings]: settings } = await chrome.storage.local.get(KEYS.settings);
  return { ...DEFAULT_SETTINGS, ...(settings || {}) };
}

export async function saveSettings(settings) {
  await chrome.storage.local.set({ [KEYS.settings]: settings });
}

export async function getJobs() {
  const { [KEYS.jobs]: jobs } = await chrome.storage.local.get(KEYS.jobs);
  return jobs || [];
}

export async function saveJobs(jobs) {
  await chrome.storage.local.set({ [KEYS.jobs]: jobs });
}

export async function getSeenLinks() {
  const { [KEYS.seen]: seen } = await chrome.storage.local.get(KEYS.seen);
  return seen || {};
}

export async function saveSeenLinks(seen) {
  await chrome.storage.local.set({ [KEYS.seen]: seen });
}

export async function getLastScan() {
  const { [KEYS.lastScan]: lastScan } = await chrome.storage.local.get(KEYS.lastScan);
  return lastScan || null;
}

export async function saveLastScan(info) {
  await chrome.storage.local.set({ [KEYS.lastScan]: info });
}
