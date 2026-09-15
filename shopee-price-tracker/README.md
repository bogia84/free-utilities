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
- It then calls Shopee's own public item endpoint — `https://shopee.vn/api/v4/item/get?itemid=..&shopid=..` — the same JSON API the product page itself uses, directly from the background service worker (no page scraping, no third-party service).
- Only `https://shopee.vn/*` host permission is requested. No other network calls are made, and no library dependencies are used, so there's nothing that could leak your data.

## Known limitations

- Only `shopee.vn` (Vietnam) links are supported.
- Shortened/share links (`shp.ee/...`) aren't resolved — paste the full product page URL instead.
- If a product is removed, banned, or Shopee changes its API response shape, that product's check will show an error message instead of a price until it's fixed.
- History is recorded once per calendar day; running "Check now" multiple times in the same day updates that day's point rather than adding a new one.
- **Shopee's anti-bot check.** Shopee guards this endpoint against automated traffic. It worked fine in manual testing from a normal browsing session, but if a request looks automated (e.g. a brand-new profile with no prior shopee.vn browsing, or traffic from a datacenter/VPN IP) Shopee can return a 403 or a "Login Required" wall instead of product data — you'll see "Shopee blocked this request (anti-bot check)" in that case. Browsing shopee.vn normally in the same Chrome profile for a bit (so it picks up real cookies) before adding a link makes this far less likely.

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
