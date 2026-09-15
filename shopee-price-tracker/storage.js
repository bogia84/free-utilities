const KEYS = {
  products: 'products'
};

export async function getProducts() {
  const { [KEYS.products]: products } = await chrome.storage.local.get(KEYS.products);
  return products || [];
}

export async function saveProducts(products) {
  await chrome.storage.local.set({ [KEYS.products]: products });
}
