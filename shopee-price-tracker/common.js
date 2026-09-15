// Shared constants and helpers used by background, popup and product pages.

export const ALARM_NAME = 'shopee-price-check';
export const CHECK_INTERVAL_MINUTES = 1440; // once a day
export const MAX_HISTORY_POINTS = 365;

// Shopee prices come back from the API scaled by 100000 (e.g. 250000 VND -> 25000000000).
const PRICE_SCALE = 100000;

// Recognizes the two link shapes Shopee product pages use:
//   https://shopee.vn/some-product-name-i.{shopid}.{itemid}
//   https://shopee.vn/product/{shopid}/{itemid}
export function extractShopeeIds(link) {
  if (!link) return null;
  let url;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }
  if (!/(^|\.)shopee\.vn$/.test(url.hostname)) return null;

  let m = url.pathname.match(/-i\.(\d+)\.(\d+)(?:$|\/)/);
  if (m) return { shopid: m[1], itemid: m[2] };

  m = url.pathname.match(/\/product\/(\d+)\/(\d+)/);
  if (m) return { shopid: m[1], itemid: m[2] };

  return null;
}

export function buildApiUrl(shopid, itemid) {
  return `https://shopee.vn/api/v4/item/get?itemid=${encodeURIComponent(itemid)}&shopid=${encodeURIComponent(shopid)}`;
}

export function productKey(shopid, itemid) {
  return `${shopid}_${itemid}`;
}

export function priceFromApi(raw) {
  if (typeof raw !== 'number') return null;
  return Math.round(raw / PRICE_SCALE);
}

export function formatPrice(value, currency = 'VND') {
  if (value === null || value === undefined) return '—';
  try {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency }).format(value);
  } catch {
    return `${value.toLocaleString('vi-VN')} ${currency}`;
  }
}

export function todayKey(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export function timeAgo(ts) {
  if (!ts) return 'never';
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

// Appends/updates today's price point in a history array (one point per calendar day).
export function pushHistoryPoint(history, price, ts = Date.now()) {
  const key = todayKey(ts);
  const next = [...(history || [])];
  const last = next[next.length - 1];
  if (last && last.dateKey === key) {
    last.price = price;
    last.ts = ts;
  } else {
    next.push({ dateKey: key, ts, price });
  }
  if (next.length > MAX_HISTORY_POINTS) next.splice(0, next.length - MAX_HISTORY_POINTS);
  return next;
}
