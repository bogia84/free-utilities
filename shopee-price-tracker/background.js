import {
  ALARM_NAME, CHECK_INTERVAL_MINUTES, extractShopeeIds, productKey,
  priceFromApi, pushHistoryPoint, todayKey
} from './common.js';
import { getProducts, saveProducts, getLastCheck, saveLastCheck } from './storage.js';

const WINDOW_LOAD_TIMEOUT_MS = 15000;
const RENDER_SETTLE_MS = 2000;

let checking = false;

// --- lifecycle ---------------------------------------------------------

chrome.runtime.onInstalled.addListener(() => scheduleAlarm());
chrome.runtime.onStartup.addListener(() => scheduleAlarm());

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === ALARM_NAME) checkAllProducts('alarm');
});

chrome.notifications.onClicked.addListener(notificationId => {
  if (notificationId.startsWith('shopee-drop-single-')) {
    const id = notificationId.slice('shopee-drop-single-'.length);
    chrome.tabs.create({ url: chrome.runtime.getURL(`product.html?id=${encodeURIComponent(id)}`) });
  } else {
    chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
  }
  chrome.notifications.clear(notificationId);
});

async function scheduleAlarm() {
  await chrome.alarms.clear(ALARM_NAME);
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: CHECK_INTERVAL_MINUTES, delayInMinutes: 1 });
}

// --- Shopee item lookup ----------------------------------------------------
//
// A plain fetch() from the background service worker gets flagged by
// Shopee's anti-bot check (it redirects to shopee.vn/verify/traffic/error)
// even with real cookies attached — the request doesn't look like organic
// browsing. Confirmed by testing: opening the real product page in a
// hidden tab, a minimized window, and even a visible-but-unfocused window
// all get blocked the same way, while pasting the exact same link into a
// normal, focused tab works fine. So single-product checks (called from
// add.html / product.html — real persistent tabs, not the transient
// toolbar popup) open the Shopee tab with real focus, indistinguishable
// from the user clicking a link. Bulk/background checks (the daily
// alarm, "Check now" on the full list from the popup) can't safely steal
// focus like that, so they stay backgrounded and are best-effort only.

async function openShopeeTab(link, foreground) {
  if (foreground) {
    const tab = await chrome.tabs.create({ url: link, active: true });
    return { tabId: tab.id, close: () => chrome.tabs.remove(tab.id) };
  }
  const win = await chrome.windows.create({
    url: link,
    type: 'popup',
    focused: false,
    state: 'normal',
    width: 480,
    height: 360
  });
  return { tabId: win.tabs[0].id, close: () => chrome.windows.remove(win.id) };
}

function waitForTabComplete(tabId) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Timed out waiting for the Shopee page to load'));
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

// Runs inside the Shopee tab (chrome.scripting.executeScript), not the
// background worker — no access to outer-scope variables/imports here.
async function fetchItemInPage(shopid, itemid) {
  try {
    const res = await fetch(`/api/v4/item/get?itemid=${itemid}&shopid=${shopid}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' }
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
  } catch (err) {
    return { status: 0, error: String(err) };
  }
}

async function fetchShopeeItem(shopid, itemid, link, foreground) {
  const handle = await openShopeeTab(link, foreground);
  let raw;
  try {
    await waitForTabComplete(handle.tabId);
    await new Promise(r => setTimeout(r, RENDER_SETTLE_MS));
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: handle.tabId }, func: fetchItemInPage, args: [shopid, itemid] });
    raw = result;
  } finally {
    await handle.close().catch(() => {});
  }

  if (!raw || raw.error) throw new Error(raw?.error || 'Could not reach the Shopee page');
  if (raw.status === 403 || raw.status === 429 || raw.json?.error) {
    throw new Error('Shopee blocked this request (anti-bot check). Log into your Shopee account in this browser, then try again — Shopee blocks price checks from signed-out sessions much more aggressively.');
  }
  if (!raw.json?.data) throw new Error(raw.json?.error_msg || 'Product not found (it may be removed or banned)');

  const d = raw.json.data;
  return {
    name: d.name,
    image: d.image ? `https://cf.shopee.vn/file/${d.image}` : null,
    currentPrice: priceFromApi(d.price),
    priceBeforeDiscount: d.price_before_discount > d.price ? priceFromApi(d.price_before_discount) : null,
    currency: d.currency || 'VND',
    stock: d.stock,
    itemStatus: d.item_status
  };
}

// --- product CRUD -----------------------------------------------------

async function addProduct(link) {
  const ids = extractShopeeIds(link);
  if (!ids) throw new Error("That doesn't look like a Shopee product link.");
  const id = productKey(ids.shopid, ids.itemid);

  const products = await getProducts();
  if (products.some(p => p.id === id)) throw new Error('This product is already saved.');

  const info = await fetchShopeeItem(ids.shopid, ids.itemid, link, true);
  const now = Date.now();
  const product = {
    id,
    shopid: ids.shopid,
    itemid: ids.itemid,
    link,
    name: info.name,
    image: info.image,
    currency: info.currency,
    currentPrice: info.currentPrice,
    priceBeforeDiscount: info.priceBeforeDiscount,
    stock: info.stock,
    itemStatus: info.itemStatus,
    addedAt: now,
    lastCheckedAt: now,
    lastError: null,
    hasNewDrop: false,
    history: pushHistoryPoint([], info.currentPrice, now)
  };
  products.push(product);
  await saveProducts(products);
  return product;
}

async function removeProduct(id) {
  const products = await getProducts();
  await saveProducts(products.filter(p => p.id !== id));
}

async function clearDropFlag(id) {
  const products = await getProducts();
  const p = products.find(x => x.id === id);
  if (p && p.hasNewDrop) {
    p.hasNewDrop = false;
    await saveProducts(products);
    await updateBadge(products);
  }
}

// --- passive content-script capture --------------------------------------
//
// content.js reads whatever price is already rendered on a Shopee product
// page the user genuinely navigated to themselves — no fetch of our own,
// so nothing here for Shopee's anti-bot check to catch. This is the
// reliable path; fetchShopeeItem() above is the best-effort automated one.

async function recordPageObservation(info, createIfMissing) {
  const id = productKey(info.shopid, info.itemid);
  const products = await getProducts();
  const idx = products.findIndex(p => p.id === id);
  const now = Date.now();

  if (idx === -1) {
    if (!createIfMissing) return { tracked: false, product: null };
    const product = {
      id,
      shopid: info.shopid,
      itemid: info.itemid,
      link: info.link,
      name: info.name,
      image: info.image || null,
      currency: info.currency || 'VND',
      currentPrice: info.price,
      priceBeforeDiscount: null,
      stock: null,
      itemStatus: null,
      addedAt: now,
      lastCheckedAt: now,
      lastError: null,
      hasNewDrop: false,
      history: pushHistoryPoint([], info.price, now)
    };
    products.push(product);
    await saveProducts(products);
    return { tracked: true, product };
  }

  const previous = products[idx];
  const dropped = typeof previous.currentPrice === 'number' && typeof info.price === 'number' && info.price < previous.currentPrice;
  const updated = {
    ...previous,
    name: info.name || previous.name,
    image: info.image || previous.image,
    currentPrice: info.price,
    lastCheckedAt: now,
    lastError: null,
    hasNewDrop: previous.hasNewDrop || dropped,
    history: pushHistoryPoint(previous.history, info.price, now)
  };
  products[idx] = updated;
  await saveProducts(products);
  await updateBadge(products);
  if (dropped) notifyDrops([updated]);
  return { tracked: true, product: updated };
}

// --- checking -----------------------------------------------------------

async function checkOneProduct(product, foreground = false) {
  try {
    const info = await fetchShopeeItem(product.shopid, product.itemid, product.link, foreground);
    const previousPrice = product.currentPrice;
    const now = Date.now();
    const dropped = typeof previousPrice === 'number' && typeof info.currentPrice === 'number' && info.currentPrice < previousPrice;

    return {
      ...product,
      name: info.name || product.name,
      image: info.image || product.image,
      currency: info.currency,
      currentPrice: info.currentPrice,
      priceBeforeDiscount: info.priceBeforeDiscount,
      stock: info.stock,
      itemStatus: info.itemStatus,
      lastCheckedAt: now,
      lastError: null,
      hasNewDrop: product.hasNewDrop || dropped,
      history: pushHistoryPoint(product.history, info.currentPrice, now),
      _dropAmount: dropped ? previousPrice - info.currentPrice : 0
    };
  } catch (err) {
    return { ...product, lastCheckedAt: Date.now(), lastError: err.message || String(err), _dropAmount: 0 };
  }
}

// A product freshly updated by the reliable passive content-script capture
// (see recordPageObservation) shouldn't immediately get re-checked by this
// unreliable automated path and have that good, fresh data overwritten by
// a spurious anti-bot error. So bulk checks only touch products that
// haven't had a clean check yet today.
function needsBulkCheck(product, now) {
  if (!product.lastCheckedAt) return true;
  if (product.lastError) return true;
  return todayKey(product.lastCheckedAt) !== todayKey(now);
}

export async function checkAllProducts(trigger) {
  if (checking) return { skipped: true, reason: 'A check is already running' };
  checking = true;
  try {
    const now = Date.now();
    const products = await getProducts();
    const updated = [];
    const drops = [];
    const errors = [];
    let checkedCount = 0;

    for (const product of products) {
      if (!needsBulkCheck(product, now)) {
        updated.push(product);
        continue;
      }
      checkedCount++;
      const result = await checkOneProduct(product);
      if (result._dropAmount > 0) drops.push(result);
      if (result.lastError) errors.push(`${result.name || result.id}: ${result.lastError}`);
      delete result._dropAmount;
      updated.push(result);
    }

    await saveProducts(updated);
    await updateBadge(updated);

    const info = { at: now, trigger, checkedCount, dropCount: drops.length, errors };
    await saveLastCheck(info);

    if (drops.length > 0) notifyDrops(drops);
    return info;
  } finally {
    checking = false;
  }
}

async function updateBadge(products) {
  const count = products.filter(p => p.hasNewDrop).length;
  await chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  await chrome.action.setBadgeBackgroundColor({ color: '#ee4d2d' });
}

function notifyDrops(drops) {
  const top = drops.slice(0, 3).map(p => `• ${p.name}`).join('\n');
  const id = drops.length === 1 ? `shopee-drop-single-${drops[0].id}` : `shopee-drop-multi-${Date.now()}`;
  chrome.notifications.create(id, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: `Price drop — ${drops.length} product${drops.length > 1 ? 's' : ''}`,
    message: top,
    priority: 1
  });
}

// --- messaging -----------------------------------------------------------

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message) return false;

  (async () => {
    switch (message.type) {
      case 'GET_STATE': {
        const [products, lastCheck] = await Promise.all([getProducts(), getLastCheck()]);
        sendResponse({ ok: true, products, lastCheck });
        break;
      }
      case 'ADD_PRODUCT': {
        try {
          const product = await addProduct(message.link);
          sendResponse({ ok: true, product });
        } catch (err) {
          sendResponse({ ok: false, error: err.message || String(err) });
        }
        break;
      }
      case 'REMOVE_PRODUCT': {
        await removeProduct(message.id);
        sendResponse({ ok: true });
        break;
      }
      case 'CHECK_NOW': {
        const result = await checkAllProducts('manual');
        sendResponse({ ok: true, result });
        break;
      }
      case 'CHECK_ONE': {
        const products = await getProducts();
        const idx = products.findIndex(p => p.id === message.id);
        if (idx === -1) { sendResponse({ ok: false, error: 'Product not found' }); break; }
        const result = await checkOneProduct(products[idx], true);
        const dropped = result._dropAmount > 0;
        delete result._dropAmount;
        products[idx] = result;
        await saveProducts(products);
        await updateBadge(products);
        if (dropped) notifyDrops([result]);
        sendResponse({ ok: true, product: result });
        break;
      }
      case 'CLEAR_DROP_FLAG': {
        await clearDropFlag(message.id);
        sendResponse({ ok: true });
        break;
      }
      case 'PAGE_PRODUCT_SEEN': {
        const result = await recordPageObservation(message.info, false);
        sendResponse({ ok: true, tracked: result.tracked });
        break;
      }
      case 'ADD_FROM_PAGE': {
        const result = await recordPageObservation(message.info, true);
        sendResponse({ ok: true, product: result.product });
        break;
      }
      case 'OPEN_PRODUCT_TAB': {
        const id = productKey(message.shopid, message.itemid);
        chrome.tabs.create({ url: chrome.runtime.getURL(`product.html?id=${encodeURIComponent(id)}`) });
        sendResponse({ ok: true });
        break;
      }
      default:
        sendResponse({ ok: false, error: 'unknown message type' });
    }
  })();

  return true; // keep the message channel open for the async response
});
