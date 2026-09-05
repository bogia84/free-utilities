// ITviec search results are fully server-rendered, so a plain fetch + DOMParser
// (done inside the offscreen document, see offscreen.js) is enough — no need to
// spin up a background tab for this site.

export function buildItviecUrl(role) {
  const q = encodeURIComponent(role);
  return `https://itviec.com/it-jobs?query=${q}`;
}

// Runs inside the offscreen document against a parsed Document.
export function parseItviecDocument(doc, role) {
  const jobs = [];
  const cards = doc.querySelectorAll('div.job-card');

  cards.forEach(card => {
    const titleLink = card.querySelector("h3[data-search--job-selection-target='jobTitle'] a");
    if (!titleLink) return;

    const title = titleLink.textContent.trim();
    const link = titleLink.href;

    let company = '';
    const companyLinks = card.querySelectorAll("a[href^='/companies/']");
    for (const a of companyLinks) {
      const text = a.textContent.trim();
      if (text) { company = text; break; }
    }

    const postedEl = card.querySelector('span.small-text.text-dark-grey');
    const postedText = postedEl ? postedEl.textContent.replace(/\s+/g, ' ').trim() : '';

    let location = '';
    const locationCandidates = card.querySelectorAll('.text-rich-grey.text-truncate');
    if (locationCandidates.length) {
      location = locationCandidates[locationCandidates.length - 1].textContent.trim();
    }

    jobs.push({
      source: 'itviec',
      role,
      title,
      company,
      location,
      link,
      postedText
    });
  });

  return jobs;
}
