// VietnamWorks' search results are rendered client-side (React/Next.js), so a
// plain fetch of the HTML doesn't contain the job list. Instead, background.js
// opens the search page in a short-lived, minimized background window and runs
// extractVietnamworksJobsInPage() inside that real, fully-rendered page via
// chrome.scripting.executeScript.
//
// Because that function is serialized and executed inside the page (not this
// module), it must be fully self-contained — no references to imports or
// outer-scope variables. Known container class is "job-item" (confirmed from
// the site's stylesheet); substring/attribute-based fallbacks are used in case
// VietnamWorks renames things, since exact class names on client-rendered
// sites tend to drift over time.

export function buildVietnamworksUrl(role) {
  const q = encodeURIComponent(role);
  return `https://www.vietnamworks.com/jobs?q=${q}`;
}

export function extractVietnamworksJobsInPage() {
  function pickText(el, selectors) {
    for (const sel of selectors) {
      const found = el.querySelector(sel);
      if (found && found.textContent.trim()) return found.textContent.trim();
    }
    return '';
  }

  function findContainers() {
    let nodes = Array.from(document.querySelectorAll('.job-item'));
    if (nodes.length) return nodes;

    nodes = Array.from(document.querySelectorAll('[class*="job-item" i], [class*="jobItem" i], [data-testid*="job-item" i], [data-testid*="jobItem" i]'));
    if (nodes.length) return nodes;

    // Last-resort heuristic: anchors that look like job postings rather than
    // navigation/footer links, deduped to their nearest "card-like" ancestor.
    const anchors = Array.from(document.querySelectorAll('a[href]')).filter(a => {
      const href = a.getAttribute('href') || '';
      const text = a.textContent.trim();
      if (!text || text.length < 8 || text.length > 140) return false;
      if (/^(sign in|log in|register|sign up|home|about|contact|help|blog)$/i.test(text)) return false;
      if (/^https?:\/\/(www\.)?vietnamworks\.com\/?(en|jobs)?$/i.test(href)) return false;
      return /vietnamworks\.com\/.+-\d{4,}/i.test(a.href) || /-jv[0-9]*($|[/?#])/i.test(a.href);
    });
    const seen = new Set();
    const containers = [];
    anchors.forEach(a => {
      const card = a.closest('li, article, div') || a;
      if (seen.has(card)) return;
      seen.add(card);
      containers.push(card);
    });
    return containers;
  }

  const containers = findContainers();
  const results = [];

  containers.forEach(item => {
    const linkEl = item.matches && item.matches('a[href]') ? item : item.querySelector('a[href]');
    if (!linkEl) return;
    const link = linkEl.href;

    const title = pickText(item, [
      '[class*="title" i]', '[data-testid*="title" i]', 'h1', 'h2', 'h3', 'h4'
    ]) || linkEl.textContent.trim();

    if (!title || title.length < 3) return;

    const company = pickText(item, ['[class*="company" i]', '[data-testid*="company" i]']);
    const location = pickText(item, ['[class*="location" i]', '[class*="address" i]', '[data-testid*="location" i]']);
    const postedText = pickText(item, ['[class*="date" i]', '[class*="time" i]', '[class*="posted" i]']);

    results.push({ title, company, location, link, postedText });
  });

  // De-duplicate by link and cap the payload sent back to the extension.
  const byLink = new Map();
  results.forEach(r => { if (!byLink.has(r.link)) byLink.set(r.link, r); });
  return Array.from(byLink.values()).slice(0, 40);
}
