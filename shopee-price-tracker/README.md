# Shopee Price Tracker

A Chrome extension that saves [Shopee](https://shopee.vn) product links and checks their price once a day, so you can see how a price has moved before you buy.

## Features

- Paste a Shopee product link on the "Add product" page (opened from the popup) to start tracking it — the extension reads the current name, image and price right away.
- Runs a background check once a day (`chrome.alarms`) and records one price point per day, plus a "Check now" button for an on-demand refresh (all products from the popup, or a single one from its detail page).
- Click any saved product to open its detail page: price, product image, a price-history line chart (drawn on `<canvas>`, no charting library), and a day-by-day log of price changes.
- Chrome notification when a tracked product's price drops, linking straight to that product's chart. Toolbar badge shows how many products have an unseen drop.
- Remove a product any time from the popup list.

## How it works

- Shopee product pages embed a `shopid` and `itemid` in their URL (either `.../product-name-i.{shopid}.{itemid}` or `.../product/{shopid}/{itemid}`). The extension parses these out of the pasted link.
- To fetch a price, it opens the actual product page in a tab and calls Shopee's own item endpoint (`/api/v4/item/get?itemid=..&shopid=..`) from *inside* that page's own JavaScript context, then closes the tab — rather than fetching it directly, which Shopee's anti-bot check reliably blocks (redirects to `shopee.vn/verify/traffic/error`) even with cookies attached, since it doesn't look like organic browsing.
- Testing narrowed this down further: a hidden background tab, a minimized window, and even a visible-but-unfocused window all still got blocked the same way — only a genuinely focused tab (indistinguishable from clicking a link yourself) got through reliably. Because giving a tab real focus switches Chrome's active tab and that closes the small toolbar popup instantly, adding a product happens on its own full page (`add.html`, opened in a new tab from the popup) instead of inside the popup — a real page survives the focus switch, so the check can safely use a fully-focused tab. The same applies to "Check price now" on the product detail page. Bulk/background checks (the daily alarm, and "Check now" on the full list in the popup) can't safely steal focus like that without being disruptive, so they stay backgrounded and are best-effort only — they may get blocked more often than the two focused flows.
- Only `https://shopee.vn/*` host permission is requested. No other network calls are made, and no library dependencies are used, so there's nothing that could leak your data.

## Known limitations

- Only `shopee.vn` (Vietnam) links are supported.
- Shortened/share links (`shp.ee/...`) aren't resolved — paste the full product page URL instead.
- If a product is removed, banned, or Shopee changes its API response shape, that product's check will show an error message instead of a price until it's fixed.
- History is recorded once per calendar day; running "Check now" multiple times in the same day updates that day's point rather than adding a new one.
- **Shopee's anti-bot check.** Even the focused-tab approach isn't guaranteed — Shopee's anti-bot system is aggressive and can still block a check, showing "Shopee blocked this request (anti-bot check)". Being logged into Shopee in the same browser is worth doing but did not resolve it in testing on its own; the daily automatic background check in particular is best-effort and may fail more often than a manual Add/Check.

## Install (unpacked)

1. Go to `chrome://extensions`.
2. Enable "Developer mode" (top right).
3. Click "Load unpacked" and select this `shopee-price-tracker` folder.
4. Click the extension icon, paste a Shopee product link, and hit "Add" — a new tab opens and briefly shows the real Shopee page while it reads the price, then reports back.

## File map

- `manifest.json` — MV3 manifest (permissions: storage, alarms, notifications, scripting, tabs; host permission: shopee.vn).
- `background.js` — alarm scheduling, Shopee API calls, price-history updates, notifications, message handling.
- `common.js` — URL parsing, price formatting, date helpers, history helpers.
- `storage.js` — `chrome.storage.local` read/write helpers.
- `popup.html/js/css` — saved-product list with current price and last change; hands off to `add.html` to add a new one.
- `add.html/js/css` — full-page "adding a product" flow (needs to be a real page, not the popup, so it can use a focused tab — see "How it works").
- `product.html/js/css` — single-product detail page: price, canvas price-history chart, and a change log table.
- `icons/`, `store/banner-1200x800.png` — generated via `scripts/make-icons.ps1` and `scripts/make-banner.ps1`.
