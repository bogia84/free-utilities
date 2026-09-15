import { productKey, pushHistoryPoint } from './common.js';
import { getProducts, saveProducts } from './storage.js';

// Every automated way of fetching a price ourselves was tried and removed:
// a plain fetch() from this service worker, a hidden tab, a minimized
// window, a visible-but-unfocused window, and even a fully-focused,
// extension-opened tab — all reliably got blocked by Shopee's anti-bot
// check, while a page the user genuinely navigates to themselves never
// does. So this extension makes no requests of its own at all. The only
// way price data gets in is content.js passively reading whatever's
// already rendered on a Shopee product page you're actually looking at
// (see recordPageObservation below) and reporting it here to be stored.

chrome.notifications.onClicked.addListener(notificationId => {
  if (notificationId.startsWith('shopee-drop-single-')) {
    const id = notificationId.slice('shopee-drop-single-'.length);
    chrome.tabs.create({ url: chrome.runtime.getURL(`product.html?id=${encodeURIComponent(id)}`) });
  } else {
    chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
  }
  chrome.notifications.clear(notificationId);
});

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

async function recordPageObservation(info, createIfMissing) {
  const id = productKey(info.shopid, info.itemid, info.modelid);
  const products = await getProducts();
  const idx = products.findIndex(p => p.id === id);
  const now = Date.now();

  if (idx === -1) {
    if (!createIfMissing) return { tracked: false, product: null };
    const product = {
      id,
      shopid: info.shopid,
      itemid: info.itemid,
      modelid: info.modelid || null,
      link: info.link,
      name: info.name,
      image: info.image || null,
      currency: info.currency || 'VND',
      currentPrice: info.price,
      priceBeforeDiscount: null,
      addedAt: now,
      lastCheckedAt: now,
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
    hasNewDrop: previous.hasNewDrop || dropped,
    history: pushHistoryPoint(previous.history, info.price, now)
  };
  products[idx] = updated;
  await saveProducts(products);
  await updateBadge(products);
  if (dropped) notifyDrops([updated]);
  return { tracked: true, product: updated };
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
        const products = await getProducts();
        sendResponse({ ok: true, products });
        break;
      }
      case 'REMOVE_PRODUCT': {
        await removeProduct(message.id);
        sendResponse({ ok: true });
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
        const id = productKey(message.shopid, message.itemid, message.modelid);
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
