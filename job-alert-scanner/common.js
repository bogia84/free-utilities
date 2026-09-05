// Shared constants and helpers used by background, popup and results pages.

export const DEFAULT_SETTINGS = {
  roles: [],              // e.g. ["product manager", "product owner"]
  intervalMinutes: 30,    // refresh interval
  datePosted: 'week'      // 'day' | '3days' | 'week' | 'all'
};

export const INTERVAL_OPTIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 240, label: '4 hours' },
  { value: 360, label: '6 hours' }
];

export const DATE_OPTIONS = [
  { value: 'day', label: 'Last 24 hours', days: 1 },
  { value: '3days', label: 'Past 3 days', days: 3 },
  { value: 'week', label: 'Past week', days: 7 },
  { value: 'all', label: 'All time', days: null }
];

export const ALARM_NAME = 'job-alert-scan';

export function rangeDays(datePosted) {
  const found = DATE_OPTIONS.find(o => o.value === datePosted);
  return found ? found.days : null;
}

// Parses loose relative-date text ("3 days ago", "hôm nay", "2 tuần trước", "Just now")
// into an approximate age in days. Returns null when the text can't be interpreted,
// so callers can decide to include the item anyway rather than wrongly excluding it.
export function parseRelativeAgeDays(text) {
  if (!text) return null;
  const t = text.toLowerCase().trim();

  if (/(just now|vừa (xong|đăng)|moments? ago)/.test(t)) return 0;
  if (/(today|hôm nay)/.test(t)) return 0;
  if (/(yesterday|hôm qua)/.test(t)) return 1;

  let m = t.match(/(\d+)\s*\+?\s*(minute|min|phút)/);
  if (m) return 0;

  m = t.match(/(\d+)\s*\+?\s*(hour|hr|giờ)/);
  if (m) return 0;

  m = t.match(/(\d+)\s*\+?\s*(day|ngày)/);
  if (m) return parseInt(m[1], 10);

  m = t.match(/(\d+)\s*\+?\s*(week|tuần)/);
  if (m) return parseInt(m[1], 10) * 7;

  m = t.match(/(\d+)\s*\+?\s*(month|tháng)/);
  if (m) return parseInt(m[1], 10) * 30;

  return null;
}

export function ageDaysFromIsoDate(isoDate) {
  if (!isoDate) return null;
  const posted = new Date(isoDate).getTime();
  if (Number.isNaN(posted)) return null;
  const diffMs = Date.now() - posted;
  return Math.max(0, Math.floor(diffMs / 86400000));
}

export function withinRange(ageDays, datePosted) {
  const limit = rangeDays(datePosted);
  if (limit === null) return true;       // "all" — no filter
  if (ageDays === null) return true;     // unknown age — don't hide, just can't confirm
  return ageDays <= limit;
}

export function formatAge(ageDays) {
  if (ageDays === null || ageDays === undefined) return 'Unknown date';
  if (ageDays <= 0) return 'Today';
  if (ageDays === 1) return 'Yesterday';
  if (ageDays < 7) return `${ageDays} days ago`;
  if (ageDays < 30) return `${Math.round(ageDays / 7)} week(s) ago`;
  return `${Math.round(ageDays / 30)} month(s) ago`;
}

export function normalizeLink(link) {
  try {
    const u = new URL(link);
    u.search = '';
    u.hash = '';
    return u.toString();
  } catch {
    return link;
  }
}

export function jobKey(link) {
  return normalizeLink(link);
}
