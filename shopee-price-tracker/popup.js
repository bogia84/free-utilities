import { formatPrice, timeAgo } from './common.js';

const addForm = document.getElementById('addForm');
const linkInput = document.getElementById('linkInput');
const addBtn = document.getElementById('addBtn');
const addMsg = document.getElementById('addMsg');
const checkBtn = document.getElementById('checkBtn');
const statusLine = document.getElementById('statusLine');
const countLabel = document.getElementById('countLabel');
const listEl = document.getElementById('productList');
const itemTemplate = document.getElementById('itemTemplate');

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function priceChange(product) {
  const history = product.history || [];
  if (history.length < 2) return null;
  const prev = history[history.length - 2].price;
  const curr = history[history.length - 1].price;
  if (typeof prev !== 'number' || typeof curr !== 'number') return null;
  return curr - prev;
}

function renderList(products) {
  countLabel.textContent = `${products.length} product${products.length === 1 ? '' : 's'}`;
  listEl.innerHTML = '';

  if (products.length === 0) {
    listEl.innerHTML = '<li class="empty">No products saved yet. Paste a Shopee link above to start tracking.</li>';
    return;
  }

  const sorted = [...products].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
  for (const product of sorted) {
    const node = itemTemplate.content.cloneNode(true);
    const li = node.querySelector('.item');

    const thumbLink = node.querySelector('.thumb-link');
    thumbLink.href = product.link;
    node.querySelector('.thumb').src = product.image || 'icons/icon128.png';

    const nameEl = node.querySelector('.name');
    nameEl.href = product.link;
    nameEl.textContent = product.name || 'Untitled product';

    node.querySelector('.price').textContent = formatPrice(product.currentPrice, product.currency);

    const change = priceChange(product);
    const changeEl = node.querySelector('.change');
    if (change) {
      changeEl.classList.add(change > 0 ? 'up' : 'down');
      changeEl.textContent = `${change > 0 ? '▲' : '▼'} ${formatPrice(Math.abs(change), product.currency)}`;
    }

    const metaEl = node.querySelector('.meta');
    if (product.lastError) {
      metaEl.classList.add('error');
      metaEl.textContent = `Error: ${product.lastError}`;
    } else {
      metaEl.textContent = `Checked ${timeAgo(product.lastCheckedAt)}`;
    }

    node.querySelector('.remove').addEventListener('click', async e => {
      e.stopPropagation();
      await chrome.runtime.sendMessage({ type: 'REMOVE_PRODUCT', id: product.id });
      load();
    });

    li.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL(`product.html?id=${encodeURIComponent(product.id)}`) });
    });

    listEl.appendChild(node);
  }
}

async function load() {
  const res = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
  if (!res?.ok) return;
  renderList(res.products || []);
  if (res.lastCheck?.at) {
    statusLine.textContent = `Last checked ${timeAgo(res.lastCheck.at)} — ${res.lastCheck.dropCount || 0} price drop(s)`;
  } else {
    statusLine.textContent = 'Prices are checked once a day.';
  }
}

addForm.addEventListener('submit', async e => {
  e.preventDefault();
  const link = linkInput.value.trim();
  if (!link) return;

  addBtn.disabled = true;
  addMsg.textContent = '';
  addMsg.className = 'msg';
  try {
    const res = await chrome.runtime.sendMessage({ type: 'ADD_PRODUCT', link });
    if (!res.ok) throw new Error(res.error);
    linkInput.value = '';
    addMsg.textContent = `Added "${escapeHtml(res.product.name || 'product')}".`;
    addMsg.className = 'msg ok';
    load();
  } catch (err) {
    addMsg.textContent = err.message || String(err);
    addMsg.className = 'msg error';
  } finally {
    addBtn.disabled = false;
  }
});

checkBtn.addEventListener('click', async () => {
  checkBtn.disabled = true;
  checkBtn.textContent = 'Checking…';
  try {
    await chrome.runtime.sendMessage({ type: 'CHECK_NOW' });
  } finally {
    checkBtn.disabled = false;
    checkBtn.textContent = 'Check now';
    load();
  }
});

load();
