// storage.js — localStorage wrapper for barcode-order app.

const KEYS = {
  products: "barcode-order:products",
  suppliers: "barcode-order:suppliers",
  order: "barcode-order:order",
  token: "barcode-order:gmail_token",
};

function readJson(key, fallback) {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// --- 商品マスタ（JAN → {name, defaultSupplier}） ---
export function getProducts() {
  return readJson(KEYS.products, {});
}
export function getProduct(jan) {
  const products = getProducts();
  return products[jan] ?? null;
}
export function saveProduct(jan, product) {
  const products = getProducts();
  products[jan] = product;
  writeJson(KEYS.products, products);
}
export function deleteProduct(jan) {
  const products = getProducts();
  delete products[jan];
  writeJson(KEYS.products, products);
}
