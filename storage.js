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

// --- 発注先マスタ（[{name, url}]） ---
const DEFAULT_SUPPLIERS = [
  { name: "アスクル",   url: "https://www.askul.co.jp/" },
  { name: "カウネット", url: "https://www.kaunet.com/" },
  { name: "Amazon",     url: "https://www.amazon.co.jp/" },
  { name: "シンリョウ", url: "https://www.shinryo.jp/" },
];

export function getSuppliers() {
  const stored = readJson(KEYS.suppliers, null);
  if (stored === null) {
    writeJson(KEYS.suppliers, DEFAULT_SUPPLIERS);
    return [...DEFAULT_SUPPLIERS];
  }
  return stored;
}

export function addSupplier({ name, url }) {
  const suppliers = getSuppliers();
  if (suppliers.some(s => s.name === name)) {
    throw new Error(`発注先「${name}」は既に存在します`);
  }
  suppliers.push({ name, url: url || "" });
  writeJson(KEYS.suppliers, suppliers);
}

export function updateSupplier(oldName, { name, url }) {
  const suppliers = getSuppliers();
  const idx = suppliers.findIndex(s => s.name === oldName);
  if (idx === -1) throw new Error(`発注先「${oldName}」が見つかりません`);
  if (name !== oldName && suppliers.some(s => s.name === name)) {
    throw new Error(`発注先「${name}」は既に存在します`);
  }
  suppliers[idx] = { name, url: url || "" };
  writeJson(KEYS.suppliers, suppliers);
}

export function removeSupplier(name) {
  const suppliers = getSuppliers().filter(s => s.name !== name);
  writeJson(KEYS.suppliers, suppliers);
}

export function moveSupplier(name, delta) {
  const suppliers = getSuppliers();
  const idx = suppliers.findIndex(s => s.name === name);
  if (idx === -1) return;
  const newIdx = Math.max(0, Math.min(suppliers.length - 1, idx + delta));
  if (newIdx === idx) return;
  const [item] = suppliers.splice(idx, 1);
  suppliers.splice(newIdx, 0, item);
  writeJson(KEYS.suppliers, suppliers);
}
