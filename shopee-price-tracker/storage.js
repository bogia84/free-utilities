const KEYS = {
  products: 'products',
  lastCheck: 'lastCheck'
};

export async function getProducts() {
  const { [KEYS.products]: products } = await chrome.storage.local.get(KEYS.products);
  return products || [];
}

export async function saveProducts(products) {
  await chrome.storage.local.set({ [KEYS.products]: products });
}

export async function getLastCheck() {
  const { [KEYS.lastCheck]: lastCheck } = await chrome.storage.local.get(KEYS.lastCheck);
  return lastCheck || null;
}

export async function saveLastCheck(info) {
  await chrome.storage.local.set({ [KEYS.lastCheck]: info });
}
