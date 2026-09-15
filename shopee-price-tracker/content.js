// Runs on shopee.vn pages. Every automated way we tried of fetching a price
// ourselves (background fetch, hidden tab, minimized window, visible
// unfocused window, even a fully-focused extension-opened tab) got blocked
// by Shopee's anti-bot check — only a page the user genuinely navigated to
// themselves gets through. So instead of fetching anything, this reads the
// price that's already rendered on a product page you're actually looking
// at, and offers a small button to start tracking it. No network requests
// of our own — just reading the page, exactly like you would with your eyes.
(() => {
  function extractShopeeIds(href) {
    let url;
    try { url = new URL(href); } catch { return null; }
    if (!/(^|\.)shopee\.vn$/.test(url.hostname)) return null;
    let m = url.pathname.match(/-i\.(\d+)\.(\d+)(?:$|\/)/);
    if (m) return { shopid: m[1], itemid: m[2] };
    m = url.pathname.match(/\/product\/(\d+)\/(\d+)/);
    if (m) return { shopid: m[1], itemid: m[2] };
    return null;
  }

  const ids = extractShopeeIds(location.href);
  if (!ids) return;

  function readJsonLd() {
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      let data;
      try { data = JSON.parse(script.textContent); } catch { continue; }
      for (const item of Array.isArray(data) ? data : [data]) {
        if (!item || item['@type'] !== 'Product' || !item.offers) continue;
        const offers = Array.isArray(item.offers) ? item.offers[0] : item.offers;
        const price = Number(offers?.price ?? offers?.lowPrice);
        if (item.name && price > 0) {
          return {
            name: item.name,
            image: Array.isArray(item.image) ? item.image[0] : item.image,
            price,
            currency: offers?.priceCurrency || 'VND'
          };
        }
      }
    }
    return null;
  }

  function readMicrodata() {
    const scope = document.querySelector('[itemscope][itemtype*="schema.org/Product"]');
    if (!scope) return null;
    const nameEl = scope.querySelector('[itemprop="name"]');
    const priceEl = scope.querySelector('[itemprop="price"]');
    const imageEl = scope.querySelector('[itemprop="image"]');
    const currencyEl = scope.querySelector('[itemprop="priceCurrency"]');
    const price = priceEl ? Number(priceEl.getAttribute('content') || priceEl.textContent) : NaN;
    const name = (nameEl?.getAttribute('content') || nameEl?.textContent || '').trim();
    if (name && price > 0) {
      return {
        name,
        image: imageEl?.getAttribute('content') || imageEl?.src || null,
        price,
        currency: currencyEl?.getAttribute('content') || currencyEl?.textContent || 'VND'
      };
    }
    return null;
  }

  function readOgAndVisiblePrice() {
    const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
    const ogImage = document.querySelector('meta[property="og:image"]')?.content;
    if (!ogTitle) return null;

    const priceRegex = /(?:₫\s?[\d.,]+|[\d.,]+\s?₫)/;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent.trim();
      if (!text || text.length > 40 || !priceRegex.test(text)) continue;
      const raw = text.replace(/[₫\s]/g, '').replace(/\./g, '').replace(/,/g, '');
      const price = Number(raw);
      if (price > 0) return { name: ogTitle, image: ogImage || null, price, currency: 'VND' };
    }
    return null;
  }

  function extractProductInfo() {
    return readJsonLd() || readMicrodata() || readOgAndVisiblePrice();
  }

  let badgeHost = null;

  function ensureBadge() {
    if (badgeHost) return badgeHost;
    badgeHost = document.createElement('div');
    badgeHost.id = '__shopee_price_tracker_badge__';
    document.documentElement.appendChild(badgeHost);
    return badgeHost;
  }

  function renderBadge(tracked, payload) {
    const host = ensureBadge();
    host.innerHTML = '';
    const btn = document.createElement('button');
    btn.id = '__shopee_price_tracker_btn__';

    if (tracked) {
      btn.textContent = '★ Price tracked';
      btn.title = 'Open price history';
      btn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'OPEN_PRODUCT_TAB', shopid: ids.shopid, itemid: ids.itemid });
      });
    } else {
      btn.textContent = '☆ Track this price';
      btn.title = "Start tracking this product's price";
      btn.addEventListener('click', () => {
        btn.disabled = true;
        btn.textContent = 'Adding…';
        chrome.runtime.sendMessage({ type: 'ADD_FROM_PAGE', info: payload }, res => {
          if (res?.ok) renderBadge(true, payload);
          else {
            btn.disabled = false;
            btn.textContent = '☆ Track this price';
          }
        });
      });
    }
    host.appendChild(btn);
  }

  async function run() {
    let info = null;
    for (let i = 0; i < 10 && !info; i++) {
      info = extractProductInfo();
      if (!info) await new Promise(r => setTimeout(r, 500));
    }
    if (!info) return; // couldn't confidently read a price — stay silent, don't disrupt the page

    const payload = {
      shopid: ids.shopid,
      itemid: ids.itemid,
      link: location.href.split('?')[0],
      name: info.name,
      image: info.image,
      price: info.price,
      currency: info.currency
    };

    chrome.runtime.sendMessage({ type: 'PAGE_PRODUCT_SEEN', info: payload }, res => {
      renderBadge(!!res?.tracked, payload);
    });
  }

  run();
})();
