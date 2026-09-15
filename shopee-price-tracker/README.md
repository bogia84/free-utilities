# Shopee Price Tracker

A Chrome extension that saves [Shopee](https://shopee.vn) product links and checks their price once a day, so you can see how a price has moved before you buy.

## Features

- Paste a Shopee product link in the popup to start tracking it — the extension reads the current name, image and price right away.
- Runs a background check once a day (`chrome.alarms`) and records one price point per day, plus a "Check now" button for an on-demand refresh (all products, or a single one from its detail page).
- Click any saved product to open its detail page: price, product image, a price-history line chart (drawn on `<canvas>`, no charting library), and a day-by-day log of price changes.
- Chrome notification when a tracked product's price drops, linking straight to that product's chart. Toolbar badge shows how many products have an unseen drop.
- Remove a product any time from the popup list.

## How it works

- Shopee product pages embed a `shopid` and `itemid` in their URL (either `.../product-name-i.{shopid}.{itemid}` or `.../product/{shopid}/{itemid}`). The extension parses these out of the pasted link.
- To fetch a price, it briefly opens the actual product page in a minimized, unfocused background tab — the same as `job-alert-scanner` does for VietnamWorks — and calls Shopee's own item endpoint (`/api/v4/item/get?itemid=..&shopid=..`) from *inside* that page's own JavaScript context, then closes the tab. A plain `fetch()` from the background service worker gets flagged by Shopee's anti-bot check (it redirects to `shopee.vn/verify/traffic/error`) even with cookies attached, because it doesn't look like organic browsing; running the request from within a real, freshly-loaded page avoids that.
- Only `https://shopee.vn/*` host permission is requested. No other network calls are made, and no library dependencies are used, so there's nothing that could leak your data.

## Known limitations

- Only `shopee.vn` (Vietnam) links are supported.
- Shortened/share links (`shp.ee/...`) aren't resolved — paste the full product page URL instead.
- If a product is removed, banned, or Shopee changes its API response shape, that product's check will show an error message instead of a price until it's fixed.
- History is recorded once per calendar day; running "Check now" multiple times in the same day updates that day's point rather than adding a new one.
- **Shopee's anti-bot check.** Shopee blocks price-check requests much more aggressively from a signed-out browser than a signed-in one — a never-logged-in Chrome profile reliably gets walled off with "Shopee blocked this request (anti-bot check)". **Log into your Shopee account in the same Chrome browser first**; that alone resolves most cases. It can still occasionally trigger under heavy/rapid checking even when logged in.

## Install (unpacked)

1. Go to `chrome://extensions`.
2. Enable "Developer mode" (top right).
3. Click "Load unpacked" and select this `shopee-price-tracker` folder.
4. Click the extension icon, paste a Shopee product link, and hit "Add".

## File map

- `manifest.json` — MV3 manifest (permissions: storage, alarms, notifications; host permission: shopee.vn).
- `background.js` — alarm scheduling, Shopee API calls, price-history updates, notifications, message handling.
- `common.js` — URL parsing, price formatting, date helpers, history helpers.
- `storage.js` — `chrome.storage.local` read/write helpers.
- `popup.html/js/css` — add a link, see the saved-product list with current price and last change.
- `product.html/js/css` — single-product detail page: price, canvas price-history chart, and a change log table.
- `icons/`, `store/banner-1200x800.png` — generated via `scripts/make-icons.ps1` and `scripts/make-banner.ps1`.
