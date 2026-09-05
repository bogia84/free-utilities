# Job Alert Scanner

A Chrome extension that watches [ITviec](https://itviec.com), [VietnamWorks](https://www.vietnamworks.com) and [LinkedIn](https://www.linkedin.com) for new job postings matching a role you choose, and notifies you in the browser when new ones show up.

## Features

- Enter one or more roles to watch (e.g. `product manager, product owner`) — each is searched on all three sites.
- Pick a refresh interval: 15m / 30m / 1h / 2h / 4h / 6h.
- Filter by how recently the job was posted: last 24 hours, past 3 days, past week, or all time.
- Runs in the background on a `chrome.alarms` schedule and shows a Chrome notification when new matching jobs are found.
- Full results dashboard (`results.html`, opened from the popup or the notification) with:
  - Summary stat tiles (total matches, unread, per-site counts).
  - Filter chips per source, a text search box, and a sort dropdown (newest posted / recently found / source).
  - A card grid, one card per job — source badge, NEW badge for unread items, title (links out to the posting), company, location, and how long ago it was posted.
  - "Mark all as read" and "Scan now" actions.
- Toolbar badge shows the current unread count.

## How scanning works

- **ITviec** and **LinkedIn** (via LinkedIn's public guest job-search endpoint) return server-rendered HTML, so the extension `fetch()`es the search results page directly and parses it with `DOMParser` inside a hidden `chrome.offscreen` document (service workers have no DOM access).
- **VietnamWorks** renders its results client-side with JavaScript, so a plain fetch returns an empty shell. To read the real results, the extension briefly opens the search page in a minimized, unfocused background window, waits for it to render, runs an in-page extraction script, then closes the window. This is intentionally short-lived and only happens during a scan.
- Job identity is the posting URL (query string stripped), so re-appearing listings aren't re-notified, and each job's read/unread state persists across scans.

## Known limitations

- These are third-party sites the extension does not control. If ITviec, VietnamWorks or LinkedIn change their page markup, the corresponding parser in `sites/*.js` may need updating — each file documents the selectors it relies on.
- VietnamWorks parsing uses a best-effort selector strategy (`.job-item`, then attribute-substring fallbacks, then a generic link heuristic) since its exact class names weren't directly inspectable while building this. If it stops finding jobs, open a VietnamWorks search results page, inspect a job card in DevTools, and update `sites/vietnamworks.js` accordingly.
- "Posted date" is exact (ISO date) for LinkedIn, but is parsed from relative text ("3 days ago", "hôm qua", …) for ITviec and VietnamWorks. When that text can't be parsed, the job is still shown (never silently dropped) but labeled "Unknown date".
- This is a personal productivity tool intended for light, personal-use polling (the default 30-minute interval). Please don't lower the interval aggressively or repurpose this for bulk/automated data collection — that can violate these sites' terms of service.

## Install (unpacked)

1. Go to `chrome://extensions`.
2. Enable "Developer mode" (top right).
3. Click "Load unpacked" and select this `job-alert-scanner` folder.
4. Click the extension icon, enter a role, and hit "Save settings" then "Scan now".

## File map

- `manifest.json` — MV3 manifest (permissions: storage, alarms, notifications, scripting, tabs, offscreen).
- `background.js` — alarm scheduling, scan orchestration, notifications, message handling.
- `offscreen.html` / `offscreen.js` — DOMParser-based HTML parsing for ITviec/LinkedIn.
- `sites/itviec.js`, `sites/linkedin.js`, `sites/vietnamworks.js` — per-site URL builders and parsers.
- `common.js` — shared constants and date/age helpers.
- `storage.js` — `chrome.storage.local` read/write helpers.
- `popup.html/js/css` — quick settings + preview of latest jobs.
- `results.html/js/css` — full results dashboard.
- `icons/`, `store/banner-1200x800.png` — generated via `scripts/make-icons.ps1` and `scripts/make-banner.ps1`.
