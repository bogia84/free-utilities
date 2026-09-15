// Shared constants and helpers used by background, popup and product pages.

export const MAX_HISTORY_POINTS = 365;

// Recognizes the two link shapes Shopee product pages use:
//   https://shopee.vn/some-product-name-i.{shopid}.{itemid}
//   https://shopee.vn/product/{shopid}/{itemid}
// Some links (e.g. from search results) also carry a specific variant via
// ?extraParams={"display_model_id":...} — when present, that lets a
// particular variant be tracked as its own entry, separate from the base
// product. Clicking a variant option in-page doesn't change the URL, so
// this only catches variants that arrive via a link that already names one.
export function extractShopeeIds(link) {
  if (!link) return null;
  let url;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }
  if (!/(^|\.)shopee\.vn$/.test(url.hostname)) return null;

  let base = null;
  let m = url.pathname.match(/-i\.(\d+)\.(\d+)(?:$|\/)/);
  if (m) base = { shopid: m[1], itemid: m[2] };
  if (!base) {
    m = url.pathname.match(/\/product\/(\d+)\/(\d+)/);
    if (m) base = { shopid: m[1], itemid: m[2] };
  }
  if (!base) return null;

  let modelid = null;
  const extraParamsRaw = url.searchParams.get('extraParams');
  if (extraParamsRaw) {
    try {
      const parsed = JSON.parse(extraParamsRaw);
      if (parsed?.display_model_id) modelid = String(parsed.display_model_id);
    } catch {
      // malformed/unexpected extraParams — just skip the variant hint
    }
  }
  return { ...base, modelid };
}

export function productKey(shopid, itemid, modelid) {
  return modelid ? `${shopid}_${itemid}_${modelid}` : `${shopid}_${itemid}`;
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
