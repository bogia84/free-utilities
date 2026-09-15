import { formatPrice } from './common.js';

const params = new URLSearchParams(location.search);
const link = params.get('link') || '';

const linkLine = document.getElementById('linkLine');
const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');
const retryBtn = document.getElementById('retryBtn');
const closeBtn = document.getElementById('closeBtn');

linkLine.textContent = link || '(no link provided)';

async function run() {
  if (!link) {
    statusEl.textContent = 'No product link was provided.';
    statusEl.className = 'status error';
    return;
  }

  statusEl.textContent = 'Opening the product page and reading its price — this can take a few seconds…';
  statusEl.className = 'status';
  resultEl.hidden = true;
  retryBtn.hidden = true;

  try {
    const res = await chrome.runtime.sendMessage({ type: 'ADD_PRODUCT', link });
    if (!res.ok) throw new Error(res.error);

    const product = res.product;
    statusEl.textContent = 'Added.';
    statusEl.className = 'status ok';
    document.getElementById('resultImage').src = product.image || 'icons/icon128.png';
    document.getElementById('resultName').textContent = product.name || 'Untitled product';
    document.getElementById('resultPrice').textContent = formatPrice(product.currentPrice, product.currency);
    document.getElementById('viewLink').href = `product.html?id=${encodeURIComponent(product.id)}`;
    resultEl.hidden = false;
  } catch (err) {
    statusEl.textContent = err.message || String(err);
    statusEl.className = 'status error';
    retryBtn.hidden = false;
  }
}

retryBtn.addEventListener('click', run);
closeBtn.addEventListener('click', () => window.close());

run();
