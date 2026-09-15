# Shopee Price Tracker

A Chrome extension that tracks the price of [Shopee](https://shopee.vn) products you're interested in, so you can see how a price has moved before you buy.

## Features

- Browse to a Shopee product page and a small "☆ Track this price" button appears in the corner — click it to start tracking, no copy/paste needed.
- Every time you're on a tracked product's page, its price is automatically refreshed from what's already on screen.
- Click any saved product (from the popup) to open its detail page: price, product image, a price-history line chart (drawn on `<canvas>`, no charting library), and a day-by-day log of price changes.
- Chrome notification when a tracked product's price drops, linking straight to that product's chart. Toolbar badge shows how many products have an unseen drop.
- Remove a product any time from the popup list.
- A "paste a link" fallback (Add, in the popup) and a best-effort daily background check also exist, but are less reliable — see "How it works".

## How it works

Shopee has an aggressive anti-bot check, and testing during development ruled out every automated way of fetching a price ourselves: a direct `fetch()` from the background service worker, opening the product page in a hidden tab, a minimized window, a visible-but-unfocused window, and even a fully-focused tab opened by the extension (indistinguishable, to the eye, from clicking a link) — every one of those got blocked (redirected to `shopee.vn/verify/traffic/error`), while manually pasting the exact same link into a tab yourself always worked. That pattern points to behavioral bot detection (Shopee's cookies include what looks like a behavioral-analytics SDK) noticing that an extension-opened tab has no human interaction history leading up to it — something a well-behaved extension shouldn't try to fake.

So the reliable mechanism here is passive, not automated:

- A content script (`content.js`) runs on Shopee product pages **you** navigate to yourself. It reads the price already rendered on the page — via `Product` JSON-LD structured data first, then `itemprop` microdata, then (as a last resort) the visible ₫-formatted price text — and does not make any network request of its own.
- If that product is already tracked, its price/history updates automatically and silently. If not, the "☆ Track this price" button lets you start tracking it using the price already on screen.
- Shopee product pages embed a `shopid` and `itemid` in their URL (either `.../product-name-i.{shopid}.{itemid}` or `.../product/{shopid}/{itemid}`), which is how a page is matched to a saved product.
- The popup's "Add" (paste a link) and the daily `chrome.alarms` background check still exist and use the automated tab-based approach (see `background.js`'s `fetchShopeeItem`), but per the above, Shopee may block them — they're best-effort, not the primary path.
- Only `https://shopee.vn/*` host permission is requested. No other network calls are made, and no library dependencies are used, so there's nothing that could leak your data.

## Known limitations

- Only `shopee.vn` (Vietnam) links are supported.
- A product's price only updates when you're actually on its page — there's no guaranteed daily refresh. The background alarm attempts one anyway, but may get blocked by Shopee's anti-bot check.
- The on-page price reading depends on Shopee including recognizable structured data (JSON-LD/microdata) or a plain ₫-formatted price in the visible text; if a future Shopee redesign removes all of those, the button won't appear for that page.
- If a product is removed or banned, its next page visit or automated check will show an error instead of a price.
- History is recorded once per calendar day; multiple visits/checks on the same day update that day's point rather than adding a new one.

## Install (unpacked)

1. Go to `chrome://extensions`.
2. Enable "Developer mode" (top right).
3. Click "Load unpacked" and select this `shopee-price-tracker` folder.
4. Browse to any Shopee product page and click "☆ Track this price" in the bottom-right corner.

## File map

- `manifest.json` — MV3 manifest (permissions: storage, alarms, notifications, scripting, tabs; host permission: shopee.vn; content script on shopee.vn).
- `content.js`/`content.css` — reads the price off a Shopee product page you're viewing and shows the track/tracked button.
- `background.js` — passive-observation storage updates, best-effort automated checks, alarm scheduling, notifications, message handling.
- `common.js` — URL parsing, price formatting, date helpers, history helpers.
- `storage.js` — `chrome.storage.local` read/write helpers.
- `popup.html/js/css` — saved-product list with current price and last change; the paste-a-link fallback.
- `add.html/js/css` — full-page "adding a product" flow for the paste-a-link fallback (needs to be a real page, not the popup, so the fetch attempt can use a focused tab — see "How it works").
- `product.html/js/css` — single-product detail page: price, canvas price-history chart, and a change log table.
- `icons/`, `store/banner-1200x800.png` — generated via `scripts/make-icons.ps1` and `scripts/make-banner.ps1`.
