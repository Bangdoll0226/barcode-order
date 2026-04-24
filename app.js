// app.js — entry point

import * as storage from "./storage.js";
import * as csv from "./csv.js";

function renderOrderList() {
  const listEl = document.getElementById("order-list");
  const emptyEl = document.getElementById("order-empty");
  const countEl = document.getElementById("order-count");
  const sendBtn = document.getElementById("send-email-btn");

  const order = storage.getOrder();
  const suppliers = storage.getSuppliers();

  countEl.textContent = `${order.length}件`;
  sendBtn.disabled = order.length === 0;

  if (order.length === 0) {
    listEl.innerHTML = "";
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;

  listEl.innerHTML = "";
  for (const line of order) {
    const div = document.createElement("div");
    div.className = "order-line";
    div.innerHTML = `
      <div>
        <div class="name"></div>
        <div class="barcode" style="font-size: 11px; color: #777;"></div>
      </div>
      <div class="controls">
        <div class="qty-ctrl">
          <button type="button" data-act="dec">−</button>
          <input type="number" min="1" />
          <button type="button" data-act="inc">＋</button>
        </div>
        <select></select>
        <button type="button" data-act="del">削除</button>
      </div>
    `;
    div.querySelector(".name").textContent = line.name;
    div.querySelector(".barcode").textContent = line.barcode;
    const qtyInput = div.querySelector("input");
    qtyInput.value = line.quantity;

    const sel = div.querySelector("select");
    for (const s of suppliers) {
      const opt = document.createElement("option");
      opt.value = s.name;
      opt.textContent = s.name;
      if (s.name === line.supplier) opt.selected = true;
      sel.appendChild(opt);
    }
    if (!suppliers.some(s => s.name === line.supplier)) {
      const opt = document.createElement("option");
      opt.value = line.supplier;
      opt.textContent = `${line.supplier}(削除済)`;
      opt.selected = true;
      sel.appendChild(opt);
    }

    div.querySelector('[data-act="dec"]').addEventListener("click", () => {
      const q = Math.max(1, line.quantity - 1);
      storage.updateLine(line.id, { quantity: q });
      renderOrderList();
    });
    div.querySelector('[data-act="inc"]').addEventListener("click", () => {
      storage.updateLine(line.id, { quantity: line.quantity + 1 });
      renderOrderList();
    });
    qtyInput.addEventListener("change", e => {
      const v = Math.max(1, parseInt(e.target.value, 10) || 1);
      storage.updateLine(line.id, { quantity: v });
      renderOrderList();
    });
    sel.addEventListener("change", e => {
      storage.updateLine(line.id, { supplier: e.target.value });
      renderOrderList();
    });
    div.querySelector('[data-act="del"]').addEventListener("click", () => {
      storage.removeLine(line.id);
      renderOrderList();
    });
    listEl.appendChild(div);
  }
}

// --- modal 基盤 ---

function openModal(contentHTML, setup) {
  const root = document.getElementById("modal-root");
  root.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal">${contentHTML}</div>
    </div>
  `;
  const backdrop = root.querySelector(".modal-backdrop");
  const modal = root.querySelector(".modal");
  const close = () => { root.innerHTML = ""; };
  backdrop.addEventListener("click", e => { if (e.target === backdrop) close(); });
  if (setup) setup(modal, close);
  return close;
}

function showToast(msg, ms = 2500) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, ms);
}

// --- 手動 JAN 入力 ---

function openManualBarcodeModal() {
  openModal(`
    <h3>JANコードを入力</h3>
    <label>JANコード（8桁または13桁の数字）</label>
    <input id="manual-jan" type="text" inputmode="numeric" autofocus />
    <div class="buttons">
      <button type="button" data-act="cancel">キャンセル</button>
      <button type="button" class="primary" data-act="ok">確定</button>
    </div>
  `, (modal, close) => {
    const input = modal.querySelector("#manual-jan");
    modal.querySelector('[data-act="cancel"]').addEventListener("click", close);
    modal.querySelector('[data-act="ok"]').addEventListener("click", () => {
      const jan = input.value.trim();
      if (!/^\d{8}$|^\d{13}$/.test(jan)) {
        showToast("JANコードは 8 桁または 13 桁の数字で入力してください");
        return;
      }
      close();
      handleScannedBarcode(jan);
    });
  });
}

// --- 未登録商品の登録モーダル ---

function openUnknownProductModal(jan) {
  const suppliers = storage.getSuppliers();
  const radios = suppliers.map((s, i) =>
    `<label><input type="radio" name="mod-sup" value="${encodeURIComponent(s.name)}" ${i === 0 ? "checked" : ""}> ${s.name}</label>`
  ).join("");

  openModal(`
    <h3>新しい商品の登録</h3>
    <p style="font-size: 12px; color: #666;">JANコード: ${jan}</p>
    <label>品名</label>
    <input id="mod-name" type="text" autofocus />
    <label>発注先</label>
    <div class="radio-group">${radios}</div>
    <div class="buttons">
      <button type="button" data-act="cancel">キャンセル</button>
      <button type="button" class="primary" data-act="ok" disabled>登録して追加</button>
    </div>
  `, (modal, close) => {
    const nameInput = modal.querySelector("#mod-name");
    const okBtn = modal.querySelector('[data-act="ok"]');

    nameInput.addEventListener("input", () => {
      okBtn.disabled = nameInput.value.trim().length === 0;
    });

    modal.querySelector('[data-act="cancel"]').addEventListener("click", close);
    okBtn.addEventListener("click", () => {
      const name = nameInput.value.trim();
      const radio = modal.querySelector('input[name="mod-sup"]:checked');
      if (!name || !radio) return;
      const supplier = decodeURIComponent(radio.value);

      storage.saveProduct(jan, { name, defaultSupplier: supplier });
      storage.addOrderLine({ barcode: jan, name, supplier });
      close();
      showToast(`「${name}」を登録してリストに追加しました`);
      renderOrderList();
    });
  });
}

// --- バーコード受け取り ---

function handleScannedBarcode(jan) {
  const product = storage.getProduct(jan);
  if (product) {
    const existing = storage.findLineByBarcode(jan);
    if (existing) {
      storage.incrementQuantity(jan);
      showToast(`「${product.name}」を +1 しました`);
    } else {
      storage.addOrderLine({
        barcode: jan,
        name: product.name,
        supplier: product.defaultSupplier,
      });
      showToast(`「${product.name}」をリストに追加しました`);
    }
    renderOrderList();
  } else {
    openUnknownProductModal(jan);
  }
}

// --- カメラスキャナ制御 ---

let scanner = null;
let lastScanned = { barcode: null, at: 0 };

async function startScanner() {
  const containerId = "scanner";
  const container = document.getElementById(containerId);
  container.hidden = false;

  if (!window.Html5Qrcode) {
    showToast("スキャナライブラリの読み込みに失敗しました");
    return;
  }
  if (scanner) {
    await stopScanner();
  }
  scanner = new Html5Qrcode(containerId);
  try {
    await scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 260, height: 130 } },
      onScanSuccess,
      () => {} // onScanFailure: ignore
    );
  } catch (e) {
    showToast("カメラを起動できませんでした。ブラウザの権限を確認してください。");
    container.hidden = true;
  }
}

async function stopScanner() {
  if (!scanner) return;
  try { await scanner.stop(); } catch {}
  try { scanner.clear(); } catch {}
  scanner = null;
  document.getElementById("scanner").hidden = true;
}

function onScanSuccess(decoded) {
  // 1.5 秒デバウンスで同一コードの連続検出を抑制
  const now = Date.now();
  if (decoded === lastScanned.barcode && (now - lastScanned.at) < 1500) return;
  lastScanned = { barcode: decoded, at: now };

  // 検出したら自動停止（ユーザー操作で次のスキャンを開始）
  stopScanner();
  handleScannedBarcode(decoded);
}

// --- 商品マスタ管理 ---

function renderProductMaster() {
  const listEl = document.getElementById("product-master-list");
  const products = storage.getProducts();
  const suppliers = storage.getSuppliers();
  const entries = Object.entries(products);

  if (entries.length === 0) {
    listEl.innerHTML = '<div class="empty">登録された商品はありません。</div>';
    return;
  }

  listEl.innerHTML = "";
  for (const [jan, p] of entries) {
    const row = document.createElement("div");
    row.className = "master-line";
    row.innerHTML = `
      <div>
        <div style="font-weight: 600;"></div>
        <div style="font-size: 11px; color: #777;"></div>
      </div>
      <select></select>
      <button type="button" data-act="del">削除</button>
    `;
    row.children[0].children[0].textContent = p.name;
    row.children[0].children[1].textContent = jan;
    const sel = row.querySelector("select");
    for (const s of suppliers) {
      const opt = document.createElement("option");
      opt.value = s.name;
      opt.textContent = s.name;
      if (s.name === p.defaultSupplier) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener("change", e => {
      storage.saveProduct(jan, { ...p, defaultSupplier: e.target.value });
    });
    row.querySelector('[data-act="del"]').addEventListener("click", () => {
      if (confirm(`「${p.name}」を商品マスタから削除しますか？`)) {
        storage.deleteProduct(jan);
        renderProductMaster();
      }
    });
    listEl.appendChild(row);
  }
}

function toggleProductMaster() {
  const sec = document.getElementById("product-master");
  sec.hidden = !sec.hidden;
  if (!sec.hidden) renderProductMaster();
}

// --- 発注先マスタ管理 ---

function renderSupplierMaster() {
  const listEl = document.getElementById("supplier-master-list");
  const suppliers = storage.getSuppliers();

  listEl.innerHTML = "";
  suppliers.forEach((s, i) => {
    const row = document.createElement("div");
    row.className = "master-line";
    row.innerHTML = `
      <div>
        <input data-field="name" type="text" />
        <input data-field="url" type="url" placeholder="URL（任意）" />
      </div>
      <div style="display: flex; gap: 4px;">
        <button type="button" data-act="up">↑</button>
        <button type="button" data-act="down">↓</button>
      </div>
      <button type="button" data-act="del">削除</button>
    `;
    const nameInput = row.querySelector('[data-field="name"]');
    const urlInput = row.querySelector('[data-field="url"]');
    nameInput.value = s.name;
    urlInput.value = s.url || "";

    const commit = () => {
      const newName = nameInput.value.trim();
      const newUrl = urlInput.value.trim();
      if (!newName) {
        showToast("発注先名は必須です");
        nameInput.value = s.name;
        return;
      }
      try {
        storage.updateSupplier(s.name, { name: newName, url: newUrl });
        if (newName !== s.name) propagateSupplierRename(s.name, newName);
        renderSupplierMaster();
        renderOrderList();
      } catch (e) {
        showToast(e.message);
        nameInput.value = s.name;
        urlInput.value = s.url || "";
      }
    };
    nameInput.addEventListener("change", commit);
    urlInput.addEventListener("change", commit);

    row.querySelector('[data-act="up"]').addEventListener("click", () => {
      storage.moveSupplier(s.name, -1);
      renderSupplierMaster();
    });
    row.querySelector('[data-act="down"]').addEventListener("click", () => {
      storage.moveSupplier(s.name, +1);
      renderSupplierMaster();
    });
    row.querySelector('[data-act="del"]').addEventListener("click", () => {
      if (storage.isSupplierInUse(s.name)) {
        showToast(`「${s.name}」は商品マスタ or 発注リストで使用中のため削除できません`);
        return;
      }
      if (!confirm(`発注先「${s.name}」を削除しますか？`)) return;
      storage.removeSupplier(s.name);
      renderSupplierMaster();
    });
    listEl.appendChild(row);
  });
}

function propagateSupplierRename(oldName, newName) {
  const products = storage.getProducts();
  for (const [jan, p] of Object.entries(products)) {
    if (p.defaultSupplier === oldName) {
      storage.saveProduct(jan, { ...p, defaultSupplier: newName });
    }
  }
  const order = storage.getOrder();
  for (const line of order) {
    if (line.supplier === oldName) {
      storage.updateLine(line.id, { supplier: newName });
    }
  }
}

function toggleSupplierMaster() {
  const sec = document.getElementById("supplier-master");
  sec.hidden = !sec.hidden;
  if (!sec.hidden) renderSupplierMaster();
}

function wireActions() {
  document.getElementById("clear-order-btn").addEventListener("click", () => {
    if (storage.getOrder().length === 0) return;
    if (confirm("発注リストをすべてクリアしますか？")) {
      storage.clearOrder();
      renderOrderList();
    }
  });
  document.getElementById("scan-manual-btn").addEventListener("click", openManualBarcodeModal);
  document.getElementById("scan-start-btn").addEventListener("click", async () => {
    if (scanner) await stopScanner();
    else await startScanner();
  });
  document.getElementById("manage-products-btn").addEventListener("click", toggleProductMaster);
  document.getElementById("manage-suppliers-btn").addEventListener("click", toggleSupplierMaster);

  document.getElementById("add-supplier-btn").addEventListener("click", () => {
    const nameEl = document.getElementById("new-supplier-name");
    const urlEl = document.getElementById("new-supplier-url");
    const name = nameEl.value.trim();
    const url = urlEl.value.trim();
    if (!name) { showToast("発注先名を入力してください"); return; }
    try {
      storage.addSupplier({ name, url });
      nameEl.value = "";
      urlEl.value = "";
      renderSupplierMaster();
    } catch (e) {
      showToast(e.message);
    }
  });
}

function init() {
  wireActions();
  renderOrderList();
}

document.addEventListener("DOMContentLoaded", init);
