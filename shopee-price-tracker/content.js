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

    let base = null;
    let m = url.pathname.match(/-i\.(\d+)\.(\d+)(?:$|\/)/);
    if (m) base = { shopid: m[1], itemid: m[2] };
    if (!base) {
      m = url.pathname.match(/\/product\/(\d+)\/(\d+)/);
      if (m) base = { shopid: m[1], itemid: m[2] };
    }
    if (!base) return null;

    // If the link names a specific variant (e.g. from search results),
    // that lets this exact variant be tracked separately from the base
    // product. Clicking a variant option in-page doesn't change the URL,
    // so this alone can't catch that — see readVisiblePrice() below.
    let modelid = null;
    const extraParamsRaw = url.searchParams.get('extraParams');
    if (extraParamsRaw) {
      try {
        const parsed = JSON.parse(extraParamsRaw);
        if (parsed?.display_model_id) modelid = String(parsed.display_model_id);
      } catch {}
    }
    return { ...base, modelid };
  }

  const ids = extractShopeeIds(location.href);
  if (!ids) return;

  // If the extension was reloaded/updated after this content script
  // injected, chrome.runtime becomes disconnected from this page and any
  // call throws "Extension context invalidated" — reloading the page (not
  // this script) is the only fix, so surface that instead of an uncaught
  // error or a button that just silently does nothing.
  function safeSendMessage(message) {
    return new Promise(resolve => {
      if (!chrome.runtime?.id) { resolve(null); return; }
      try {
        chrome.runtime.sendMessage(message, res => {
          if (chrome.runtime.lastError) { resolve(null); return; }
          resolve(res ?? null);
        });
      } catch {
        resolve(null);
      }
    });
  }

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

  // JSON-LD/microdata are typically SEO snapshots from the initial render
  // and don't update when you pick a different variant, so they can only
  // be trusted for name/image, not price — the live, on-screen price is
  // the only thing that reflects the variant you've actually selected.
  function readVisiblePrice() {
    const priceRegex = /(?:₫\s?[\d.,]+|[\d.,]+\s?₫)/;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent.trim();
      if (!text || text.length > 40 || !priceRegex.test(text)) continue;
      const raw = text.replace(/[₫\s]/g, '').replace(/\./g, '').replace(/,/g, '');
      const price = Number(raw);
      if (price > 0) return price;
    }
    return null;
  }

  function extractProductInfo() {
    const structured = readJsonLd() || readMicrodata();
    const livePrice = readVisiblePrice();
    if (livePrice) {
      return {
        name: structured?.name || document.querySelector('meta[property="og:title"]')?.content || document.title,
        image: structured?.image || document.querySelector('meta[property="og:image"]')?.content || null,
        price: livePrice,
        currency: structured?.currency || 'VND'
      };
    }
    return structured;
  }

  function formatVnd(n) {
    return `${n.toLocaleString('vi-VN')} ₫`;
  }

  function buildPayload(info) {
    return {
      shopid: ids.shopid,
      itemid: ids.itemid,
      modelid: ids.modelid,
      link: location.href.split('?')[0],
      name: info.name,
      image: info.image,
      price: info.price,
      currency: info.currency
    };
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
      btn.textContent = `★ Tracked — ${formatVnd(payload.price)}`;
      btn.title = 'Open price history';
      btn.addEventListener('click', async () => {
        const res = await safeSendMessage({ type: 'OPEN_PRODUCT_TAB', shopid: ids.shopid, itemid: ids.itemid, modelid: ids.modelid });
        if (!res) { btn.textContent = 'Reload page to continue'; btn.disabled = true; }
      });
    } else {
      btn.textContent = `☆ Track this price — ${formatVnd(payload.price)}`;
      btn.title = "Start tracking this product's price";
      btn.addEventListener('click', async () => {
        // Re-read live, in case a different variant is selected now than
        // when the badge first rendered.
        const fresh = extractProductInfo();
        const info = fresh ? buildPayload(fresh) : payload;

        btn.disabled = true;
        btn.textContent = 'Adding…';
        const res = await safeSendMessage({ type: 'ADD_FROM_PAGE', info });
        if (res?.ok) {
          renderBadge(true, info);
        } else if (!res) {
          btn.textContent = 'Reload page to continue';
        } else {
          btn.disabled = false;
          btn.textContent = `☆ Track this price — ${formatVnd(payload.price)}`;
        }
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

    const payload = buildPayload(info);
    const res = await safeSendMessage({ type: 'PAGE_PRODUCT_SEEN', info: payload });
    if (res) renderBadge(!!res.tracked, payload);
    // else: extension context is stale (reloaded/updated) — stay silent
    // rather than show a button whose click would also fail; a page
    // refresh brings a fresh content script that works normally.
  }

  run();
})();
