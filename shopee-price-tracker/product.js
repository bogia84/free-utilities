import { formatPrice, formatDate, timeAgo } from './common.js';

const params = new URLSearchParams(location.search);
const productId = params.get('id');

const mainEl = document.getElementById('main');
const productTemplate = document.getElementById('productTemplate');

function css(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

function drawChart(canvas, points) {
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth || 900;
  const cssHeight = 320;
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  if (points.length < 2) return;

  const pad = { top: 20, right: 20, bottom: 32, left: 70 };
  const w = cssWidth - pad.left - pad.right;
  const h = cssHeight - pad.top - pad.bottom;

  const prices = points.map(p => p.price).filter(p => typeof p === 'number');
  let min = Math.min(...prices);
  let max = Math.max(...prices);
  if (min === max) { min -= 1; max += 1; }
  const range = max - min;

  const x = i => pad.left + (i / (points.length - 1)) * w;
  const y = price => pad.top + h - ((price - min) / range) * h;

  const gridColor = css('--border') || '#e5e7eb';
  const mutedColor = css('--muted') || '#6b7280';
  const accentColor = css('--accent') || '#ee4d2d';

  // gridlines + y labels
  ctx.strokeStyle = gridColor;
  ctx.fillStyle = mutedColor;
  ctx.font = '11px -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const value = min + (range * i) / steps;
    const yy = y(value);
    ctx.beginPath();
    ctx.moveTo(pad.left, yy);
    ctx.lineTo(pad.left + w, yy);
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillText(formatPrice(Math.round(value), points[0].currency), pad.left - 8, yy);
  }

  // x labels (first, middle, last)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const labelIdx = [0, Math.floor((points.length - 1) / 2), points.length - 1];
  for (const i of [...new Set(labelIdx)]) {
    ctx.fillText(formatDate(points[i].ts), x(i), pad.top + h + 10);
  }

  // line
  ctx.beginPath();
  points.forEach((p, i) => {
    const px = x(i);
    const py = y(p.price);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  });
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  // fill under line
  ctx.lineTo(x(points.length - 1), pad.top + h);
  ctx.lineTo(x(0), pad.top + h);
  ctx.closePath();
  ctx.fillStyle = accentColor;
  ctx.globalAlpha = 0.08;
  ctx.fill();
  ctx.globalAlpha = 1;

  // dots
  ctx.fillStyle = accentColor;
  points.forEach((p, i) => {
    ctx.beginPath();
    ctx.arc(x(i), y(p.price), 3, 0, Math.PI * 2);
    ctx.fill();
  });
}

function renderHistoryTable(tbody, points) {
  tbody.innerHTML = '';
  const rows = [...points].reverse();
  rows.forEach((p, i) => {
    const prev = rows[i + 1];
    const tr = document.createElement('tr');
    const change = prev ? p.price - prev.price : 0;
    const changeCell = change === 0 ? '—' :
      `${change > 0 ? '▲' : '▼'} ${formatPrice(Math.abs(change), p.currency)}`;
    tr.innerHTML = `
      <td>${formatDate(p.ts)}</td>
      <td>${formatPrice(p.price, p.currency)}</td>
      <td class="${change > 0 ? 'up' : change < 0 ? 'down' : ''}">${changeCell}</td>
    `;
    tbody.appendChild(tr);
  });
}

function render(product) {
  mainEl.innerHTML = '';
  const node = productTemplate.content.cloneNode(true);

  node.querySelector('.image').src = product.image || 'icons/icon128.png';
  node.querySelector('.name').textContent = product.name || 'Untitled product';
  const openLink = node.querySelector('.open-link');
  openLink.href = product.link;

  node.querySelector('.price').textContent = formatPrice(product.currentPrice, product.currency);
  const beforeEl = node.querySelector('.before-discount');
  if (product.priceBeforeDiscount) {
    beforeEl.textContent = formatPrice(product.priceBeforeDiscount, product.currency);
  }

  const metaEl = node.querySelector('.meta');
  metaEl.textContent = `Updated ${timeAgo(product.lastCheckedAt)} · Added ${new Date(product.addedAt).toLocaleDateString('en-GB')}`;

  const history = (product.history || []).map(p => ({ ...p, currency: product.currency }));
  mainEl.appendChild(node);

  const canvas = document.getElementById('chart');
  const noHistory = document.getElementById('noHistory');
  if (history.length < 2) {
    canvas.hidden = true;
    noHistory.hidden = false;
  } else {
    drawChart(canvas, history);
    window.addEventListener('resize', () => drawChart(canvas, history), { passive: true });
  }

  renderHistoryTable(document.getElementById('historyBody'), history);
}

async function load() {
  if (!productId) {
    mainEl.innerHTML = '<p class="muted">No product specified.</p>';
    return;
  }
  const res = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
  if (!res?.ok) {
    mainEl.innerHTML = '<p class="muted">Could not load data.</p>';
    return;
  }
  const product = (res.products || []).find(p => p.id === productId);
  if (!product) {
    mainEl.innerHTML = '<p class="muted">This product is no longer saved.</p>';
    return;
  }
  render(product);
  chrome.runtime.sendMessage({ type: 'CLEAR_DROP_FLAG', id: productId });
}

// If the price updates while this tab is in the background (e.g. you
// opened the "Open on Shopee to refresh" link, content.js observed a new
// price there, and you switched back here), reflect it without needing
// a manual reload.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.products) load();
});

load();
