// LinkedIn's public "guest" jobs-search endpoint returns plain server-rendered
// HTML (no sign-in, no JS execution needed), so this is also parsed via the
// offscreen document's DOMParser, same as ITviec.

const TPR_BY_RANGE = {
  day: 'r86400',
  '3days': 'r259200',
  week: 'r604800',
  all: ''
};

export function buildLinkedinUrl(role, datePosted, start = 0) {
  const params = new URLSearchParams({
    keywords: role,
    location: 'Vietnam',
    start: String(start)
  });
  const tpr = TPR_BY_RANGE[datePosted];
  if (tpr) params.set('f_TPR', tpr);
  return `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?${params.toString()}`;
}

// Runs inside the offscreen document against a parsed Document.
export function parseLinkedinDocument(doc, role) {
  const jobs = [];
  const cards = doc.querySelectorAll('div.base-card');

  cards.forEach(card => {
    const linkEl = card.querySelector('a.base-card__full-link') || card.querySelector('a[href]');
    if (!linkEl) return;
    const link = linkEl.href.split('?')[0];

    const title = (card.querySelector('.base-search-card__title')?.textContent || '').trim();
    const company = (card.querySelector('.base-search-card__subtitle')?.textContent || '').trim();
    const location = (card.querySelector('.job-search-card__location')?.textContent || '').trim();
    const timeEl = card.querySelector('time[datetime]');
    const postedIso = timeEl ? timeEl.getAttribute('datetime') : null;
    const postedText = timeEl ? timeEl.textContent.trim() : '';

    if (!title) return;

    jobs.push({
      source: 'linkedin',
      role,
      title,
      company,
      location,
      link,
      postedIso,
      postedText
    });
  });

  return jobs;
}
