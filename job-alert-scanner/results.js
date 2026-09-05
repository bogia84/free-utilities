const SOURCES = [
  { value: 'all', label: 'All sources' },
  { value: 'itviec', label: 'ITviec' },
  { value: 'vietnamworks', label: 'VietnamWorks' },
  { value: 'linkedin', label: 'LinkedIn' }
];

let allJobs = [];
let activeSource = 'all';

const statsEl = document.getElementById('stats');
const chipsEl = document.getElementById('sourceChips');
const listEl = document.getElementById('list');
const searchEl = document.getElementById('search');
const sortEl = document.getElementById('sortBy');
const statusLine = document.getElementById('statusLine');
const cardTemplate = document.getElementById('cardTemplate');

function sourceLabel(source) {
  return { itviec: 'ITviec', vietnamworks: 'VietnamWorks', linkedin: 'LinkedIn' }[source] || source;
}

function renderChips() {
  chipsEl.innerHTML = '';
  for (const s of SOURCES) {
    const btn = document.createElement('button');
    btn.className = 'chip' + (s.value === activeSource ? ' active' : '');
    const count = s.value === 'all' ? allJobs.length : allJobs.filter(j => j.source === s.value).length;
    btn.textContent = `${s.label} (${count})`;
    btn.addEventListener('click', () => { activeSource = s.value; render(); });
    chipsEl.appendChild(btn);
  }
}

function renderStats() {
  const unread = allJobs.filter(j => j.isNew).length;
  const bySource = SOURCES.slice(1).map(s => ({
    label: s.label,
    count: allJobs.filter(j => j.source === s.value).length
  }));
  statsEl.innerHTML = '';
  const cards = [
    { num: allJobs.length, lbl: 'Total matches' },
    { num: unread, lbl: 'Unread' },
    ...bySource.map(s => ({ num: s.count, lbl: s.label }))
  ];
  for (const c of cards) {
    const div = document.createElement('div');
    div.className = 'stat';
    div.innerHTML = `<span class="num">${c.num}</span><span class="lbl">${c.lbl}</span>`;
    statsEl.appendChild(div);
  }
}

function timeAgo(ts) {
  if (!ts) return '';
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function renderList() {
  const query = searchEl.value.trim().toLowerCase();
  let jobs = allJobs.filter(j => activeSource === 'all' || j.source === activeSource);
  if (query) {
    jobs = jobs.filter(j =>
      (j.title || '').toLowerCase().includes(query) ||
      (j.company || '').toLowerCase().includes(query)
    );
  }

  const sortBy = sortEl.value;
  jobs = [...jobs].sort((a, b) => {
    if (sortBy === 'found') return (b.firstSeenAt || 0) - (a.firstSeenAt || 0);
    if (sortBy === 'source') return sourceLabel(a.source).localeCompare(sourceLabel(b.source));
    return sortTime(b) - sortTime(a);
  });

  listEl.innerHTML = '';
  if (jobs.length === 0) {
    listEl.innerHTML = '<p class="empty">No jobs match these filters yet.</p>';
    return;
  }

  for (const job of jobs) {
    const node = cardTemplate.content.cloneNode(true);
    const card = node.querySelector('.card');
    if (job.isNew) card.classList.add('is-new');

    const sourceBadge = node.querySelector('.badge.source');
    sourceBadge.textContent = sourceLabel(job.source);
    sourceBadge.classList.add(job.source);

    node.querySelector('.posted').textContent = job.ageLabel || '';
    const link = node.querySelector('h3 a');
    link.href = job.link;
    link.textContent = job.title;
    node.querySelector('.company').textContent = job.company || '';
    node.querySelector('.location').textContent = job.location || '';

    listEl.appendChild(node);
  }
}

function sortTime(job) {
  if (job.postedIso) {
    const t = new Date(job.postedIso).getTime();
    if (!Number.isNaN(t)) return t;
  }
  if (typeof job.ageDays === 'number') return Date.now() - job.ageDays * 86400000;
  return job.firstSeenAt || 0;
}

function render() {
  renderChips();
  renderStats();
  renderList();
}

async function loadState() {
  const res = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
  if (!res?.ok) return;
  allJobs = res.jobs || [];
  const roles = (res.settings.roles || []).join(', ') || '(no role set)';
  if (res.lastScan?.at) {
    statusLine.textContent = `Watching "${roles}" — last scan ${timeAgo(res.lastScan.at)}, ${res.lastScan.foundCount ?? 0} matching, ${res.lastScan.newCount ?? 0} new` +
      (res.lastScan.errors?.length ? ` — ${res.lastScan.errors.length} site error(s)` : '');
  } else {
    statusLine.textContent = `Watching "${roles}" — never scanned yet`;
  }
  render();
}

document.getElementById('scanBtn').addEventListener('click', async e => {
  e.target.disabled = true;
  e.target.textContent = 'Scanning…';
  try {
    await chrome.runtime.sendMessage({ type: 'SCAN_NOW' });
  } finally {
    e.target.disabled = false;
    e.target.textContent = 'Scan now';
    loadState();
  }
});

document.getElementById('markReadBtn').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'MARK_ALL_READ' });
  loadState();
});

searchEl.addEventListener('input', renderList);
sortEl.addEventListener('change', renderList);

loadState();
