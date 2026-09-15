import { formatPrice, timeAgo, extractShopeeIds } from './common.js';

const addForm = document.getElementById('addForm');
const linkInput = document.getElementById('linkInput');
const addMsg = document.getElementById('addMsg');
const statusLine = document.getElementById('statusLine');
const countLabel = document.getElementById('countLabel');
const listEl = document.getElementById('productList');
const itemTemplate = document.getElementById('itemTemplate');

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
    listEl.innerHTML = '<li class="empty">No products tracked yet. Browse to one on Shopee to get started.</li>';
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

    node.querySelector('.meta').textContent = `Updated ${timeAgo(product.lastCheckedAt)}`;

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
  const products = res.products || [];
  renderList(products);
  statusLine.textContent = products.some(p => p.hasNewDrop)
    ? 'Some tracked products just got cheaper.'
    : 'Prices update automatically when you visit a tracked product.';
}

addForm.addEventListener('submit', e => {
  e.preventDefault();
  const link = linkInput.value.trim();
  if (!link) return;

  if (!extractShopeeIds(link)) {
    addMsg.textContent = "That doesn't look like a Shopee product link.";
    addMsg.className = 'msg error';
    return;
  }

  // Just open it — content.js will show a "Track this price" button on
  // the real page once it loads. No fetch happens here.
  window.open(link, '_blank', 'noopener');
  linkInput.value = '';
  addMsg.textContent = '';
});

load();
