import {
  ALARM_NAME, CHECK_INTERVAL_MINUTES, extractShopeeIds, productKey,
  priceFromApi, pushHistoryPoint
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
// browsing. So instead we open the actual product page in a hidden
// background tab (letting Shopee's own page JS run, same as a real visit)
// and call the item API from *inside* that page's context, same-origin,
// exactly like the page itself does.

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

async function fetchShopeeItem(shopid, itemid, link) {
  const win = await chrome.windows.create({ url: link, focused: false, state: 'minimized', type: 'popup' });
  const tabId = win.tabs[0].id;
  let raw;
  try {
    await waitForTabComplete(tabId);
    await new Promise(r => setTimeout(r, RENDER_SETTLE_MS));
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, func: fetchItemInPage, args: [shopid, itemid] });
    raw = result;
  } finally {
    await chrome.windows.remove(win.id).catch(() => {});
  }

  if (!raw || raw.error) throw new Error(raw?.error || 'Could not reach the Shopee page');
  if (raw.status === 403 || raw.status === 429 || raw.json?.error) {
    throw new Error('Shopee blocked this request (anti-bot check). Try again in a bit, ideally while logged into Shopee in this browser.');
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

  const info = await fetchShopeeItem(ids.shopid, ids.itemid, link);
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

// --- checking -----------------------------------------------------------

async function checkOneProduct(product) {
  try {
    const info = await fetchShopeeItem(product.shopid, product.itemid, product.link);
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

export async function checkAllProducts(trigger) {
  if (checking) return { skipped: true, reason: 'A check is already running' };
  checking = true;
  try {
    const products = await getProducts();
    const updated = [];
    const drops = [];
    const errors = [];

    for (const product of products) {
      const result = await checkOneProduct(product);
      if (result._dropAmount > 0) drops.push(result);
      if (result.lastError) errors.push(`${result.name || result.id}: ${result.lastError}`);
      delete result._dropAmount;
      updated.push(result);
    }

    await saveProducts(updated);
    await updateBadge(updated);

    const info = { at: Date.now(), trigger, checkedCount: updated.length, dropCount: drops.length, errors };
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
        const result = await checkOneProduct(products[idx]);
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
      default:
        sendResponse({ ok: false, error: 'unknown message type' });
    }
  })();

  return true; // keep the message channel open for the async response
});
