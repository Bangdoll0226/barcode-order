// app.js — entry point

import * as storage from "./storage.js";
import * as csv from "./csv.js";
import * as gmail from "./gmail.js";

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

function openModal(contentHTML, setup, { closeOnBackdrop = true } = {}) {
  const root = document.getElementById("modal-root");
  root.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal">${contentHTML}</div>
    </div>
  `;
  const backdrop = root.querySelector(".modal-backdrop");
  const modal = root.querySelector(".modal");
  const close = () => { root.innerHTML = ""; };
  if (closeOnBackdrop) {
    backdrop.addEventListener("click", e => { if (e.target === backdrop) close(); });
  }
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

// --- 店舗ヘッダー ---

function renderStoreHeader() {
  const btn = document.getElementById("store-display");
  const current = storage.getCurrentStore();
  btn.textContent = current ? `🏪 ${current}` : "🏪 店舗未設定";
}

function openStoreSelectionModal({ required = false } = {}) {
  const stores = storage.getStores();
  const hasStores = stores.length > 0;

  let bodyHtml;
  if (hasStores) {
    const radios = stores.map((s, i) =>
      `<label><input type="radio" name="store-pick" value="${encodeURIComponent(s.name)}" ${i === 0 ? "checked" : ""}> ${s.name}</label>`
    ).join("");
    bodyHtml = `
      <h3>店舗を選択してください</h3>
      <div class="radio-group">${radios}</div>
      <div class="buttons">
        ${required ? "" : '<button type="button" data-act="cancel">キャンセル</button>'}
        <button type="button" class="primary" data-act="ok">この店舗で使う</button>
      </div>
    `;
  } else {
    bodyHtml = `
      <h3>最初の店舗名を入力してください</h3>
      <p style="font-size: 12px; color: #666;">あとから店舗マスタで追加・変更できます。</p>
      <label>店舗名</label>
      <input id="first-store-name" type="text" autofocus />
      <div class="buttons">
        ${required ? "" : '<button type="button" data-act="cancel">キャンセル</button>'}
        <button type="button" class="primary" data-act="ok" disabled>登録して使う</button>
      </div>
    `;
  }

  openModal(bodyHtml, (modal, close) => {
    if (!required) {
      modal.querySelector('[data-act="cancel"]')?.addEventListener("click", close);
    }

    if (hasStores) {
      modal.querySelector('[data-act="ok"]').addEventListener("click", () => {
        const radio = modal.querySelector('input[name="store-pick"]:checked');
        if (!radio) return;
        const name = decodeURIComponent(radio.value);
        storage.setCurrentStore(name);
        close();
        renderStoreHeader();
        showToast(`店舗を「${name}」に切り替えました`);
      });
    } else {
      const nameInput = modal.querySelector("#first-store-name");
      const okBtn = modal.querySelector('[data-act="ok"]');
      nameInput.addEventListener("input", () => {
        okBtn.disabled = nameInput.value.trim().length === 0;
      });
      okBtn.addEventListener("click", () => {
        const name = nameInput.value.trim();
        if (!name) return;
        try {
          storage.addStore({ name });
          storage.setCurrentStore(name);
          close();
          renderStoreHeader();
          showToast(`店舗「${name}」を登録しました`);
        } catch (e) {
          showToast(e.message);
        }
      });
    }
  }, { closeOnBackdrop: !required });
}

function openStoreSwitchModal() {
  const stores = storage.getStores();
  const current = storage.getCurrentStore();

  if (stores.length === 0) {
    // store master が空（通常起きない）→ 強制モーダルへ
    openStoreSelectionModal({ required: true });
    return;
  }

  const radios = stores.map(s =>
    `<label><input type="radio" name="store-switch" value="${encodeURIComponent(s.name)}" ${s.name === current ? "checked" : ""}> ${s.name}</label>`
  ).join("");

  openModal(`
    <h3>店舗を切り替え</h3>
    <div class="radio-group">${radios}</div>
    <div class="buttons">
      <button type="button" data-act="cancel">キャンセル</button>
      <button type="button" class="primary" data-act="ok">切り替える</button>
    </div>
  `, (modal, close) => {
    modal.querySelector('[data-act="cancel"]').addEventListener("click", close);
    modal.querySelector('[data-act="ok"]').addEventListener("click", () => {
      const radio = modal.querySelector('input[name="store-switch"]:checked');
      if (!radio) return;
      const name = decodeURIComponent(radio.value);
      if (name === current) { close(); return; }
      const orderHasItems = storage.getOrder().length > 0;
      if (orderHasItems) {
        if (!confirm("店舗を変更すると現在の発注リストはそのまま残ります。よろしいですか？")) return;
      }
      storage.setCurrentStore(name);
      close();
      renderStoreHeader();
      showToast(`店舗を「${name}」に切り替えました`);
    });
  });
}

function renderStoreMaster() {
  const listEl = document.getElementById("store-master-list");
  const stores = storage.getStores();
  const current = storage.getCurrentStore();

  listEl.innerHTML = "";
  stores.forEach((s) => {
    const row = document.createElement("div");
    row.className = "master-line";
    row.innerHTML = `
      <div>
        <input data-field="name" type="text" />
      </div>
      <div style="display: flex; gap: 4px;">
        <button type="button" data-act="up">↑</button>
        <button type="button" data-act="down">↓</button>
      </div>
      <button type="button" data-act="del">削除</button>
    `;
    const nameInput = row.querySelector('[data-field="name"]');
    nameInput.value = s.name;

    nameInput.addEventListener("change", () => {
      const newName = nameInput.value.trim();
      if (!newName) {
        showToast("店舗名は必須です");
        nameInput.value = s.name;
        return;
      }
      try {
        storage.updateStore(s.name, { name: newName });
        // 現在選択中の店舗名が変わった場合は current_store も追従
        if (current === s.name) storage.setCurrentStore(newName);
        renderStoreMaster();
        renderStoreHeader();
      } catch (e) {
        showToast(e.message);
        nameInput.value = s.name;
      }
    });

    row.querySelector('[data-act="up"]').addEventListener("click", () => {
      storage.moveStore(s.name, -1);
      renderStoreMaster();
    });
    row.querySelector('[data-act="down"]').addEventListener("click", () => {
      storage.moveStore(s.name, +1);
      renderStoreMaster();
    });
    row.querySelector('[data-act="del"]').addEventListener("click", () => {
      if (s.name === current) {
        showToast("現在使用中の店舗のため削除できません。先に他の店舗に切り替えてください");
        return;
      }
      if (!confirm(`店舗「${s.name}」を削除しますか？`)) return;
      storage.removeStore(s.name);
      renderStoreMaster();
    });
    listEl.appendChild(row);
  });
}

function toggleStoreMaster() {
  const sec = document.getElementById("store-master");
  sec.hidden = !sec.hidden;
  if (!sec.hidden) renderStoreMaster();
}

// --- 認証 UI ---

function renderAuthStatus() {
  const emailEl = document.getElementById("auth-email");
  const signinBtn = document.getElementById("signin-btn");
  const signoutBtn = document.getElementById("signout-btn");
  const token = gmail.getToken();
  if (gmail.isSignedIn()) {
    emailEl.textContent = token.email || "ログイン中";
    signinBtn.hidden = true;
    signoutBtn.hidden = false;
  } else {
    emailEl.textContent = "未ログイン";
    signinBtn.hidden = false;
    signoutBtn.hidden = true;
  }
}

// --- メール送信 ---

function buildEmailHtml(groupedOrder, suppliers) {
  const supplierIndex = Object.fromEntries(suppliers.map(s => [s.name, s]));
  const sections = Object.entries(groupedOrder).map(([supplierName, lines]) => {
    const s = supplierIndex[supplierName] || { name: supplierName, url: "" };
    const items = lines.map(l =>
      `<li>${escapeHtml(l.name)} × ${l.quantity}</li>`
    ).join("");
    const link = s.url
      ? `<p><a href="${escapeHtml(s.url)}">${escapeHtml(s.name)}で発注</a></p>`
      : "";
    return `
      <h3>■ ${escapeHtml(supplierName)}（${lines.length}件）</h3>
      <ul>${items}</ul>
      ${link}
    `;
  }).join("");
  return `<html><body style="font-family: sans-serif;">
    <p>発注リストをお送りします。</p>
    ${sections}
  </body></html>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  }[c]));
}

function buildSubject(date = new Date()) {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `発注リスト ${y}-${mo}-${d} ${h}:${mi}`;
}

async function handleSendEmail() {
  const order = storage.getOrder();
  if (order.length === 0) return;

  try {
    if (!gmail.isSignedIn()) {
      await gmail.signIn();
      renderAuthStatus();
    }

    const token = gmail.getToken();
    if (!token?.email) throw new Error("送信元メールアドレスが取得できません");

    const grouped = csv.groupBySupplier(order);
    const suppliers = storage.getSuppliers();
    const now = new Date();

    const attachments = Object.entries(grouped).map(([supplierName, lines]) => ({
      filename: csv.generateFilename(supplierName, now),
      content: csv.generateCsv(lines),
    }));

    await gmail.sendMail({
      to: token.email,
      subject: buildSubject(now),
      htmlBody: buildEmailHtml(grouped, suppliers),
      attachments,
    });

    storage.clearOrder();
    renderOrderList();
    showToast("メールを送信しました。発注リストをクリアしました");
  } catch (e) {
    showToast(`送信失敗: ${e.message}`);
  }
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

  document.getElementById("signin-btn").addEventListener("click", async () => {
    try {
      await gmail.signIn();
      renderAuthStatus();
      showToast("ログインしました");
    } catch (e) {
      showToast(`ログイン失敗: ${e.message}`);
    }
  });
  document.getElementById("signout-btn").addEventListener("click", () => {
    gmail.signOut();
    renderAuthStatus();
    showToast("ログアウトしました");
  });
  document.getElementById("send-email-btn").addEventListener("click", handleSendEmail);
  document.getElementById("store-display").addEventListener("click", openStoreSwitchModal);

  document.getElementById("manage-stores-btn").addEventListener("click", toggleStoreMaster);

  document.getElementById("add-store-btn").addEventListener("click", () => {
    const nameEl = document.getElementById("new-store-name");
    const name = nameEl.value.trim();
    if (!name) { showToast("店舗名を入力してください"); return; }
    try {
      storage.addStore({ name });
      nameEl.value = "";
      renderStoreMaster();
    } catch (e) {
      showToast(e.message);
    }
  });
}

function init() {
  wireActions();
  renderStoreHeader();
  renderAuthStatus();
  renderOrderList();
  if (storage.getCurrentStore() === null) {
    openStoreSelectionModal({ required: true });
  }
}

document.addEventListener("DOMContentLoaded", init);
