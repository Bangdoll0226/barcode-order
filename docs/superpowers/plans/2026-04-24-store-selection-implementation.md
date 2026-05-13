# 店舗選択機能 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既存のバーコード発注アプリに「店舗選択」機能を追加する。初回起動時に店舗を選び、選んだ店舗名がメール件名・本文・CSVファイル名に反映され、複数店舗を1台のスマホで使い分けられるようにする。

**Architecture:** 既存パターンに沿って `storage.js` に store master + current_store 操作を追加、`csv.js` の `generateFilename` シグネチャを `(store, supplier, date)` に変更、`app.js` に強制店舗選択モーダル・店舗切替モーダル・店舗マスタ管理UIを追加し、`handleSendEmail` を店舗名込みの件名・本文・ファイル名に更新する。

**Tech Stack:** 既存と同じ（HTML5 + ES Modules + Vanilla JavaScript + localStorage）

**Spec:** `docs/superpowers/specs/2026-04-24-store-selection-design.md`

---

## ファイル変更マップ

| ファイル | 変更内容 |
| --- | --- |
| `storage.js` | 店舗マスタ CRUD（getStores/addStore/updateStore/removeStore/moveStore）、current_store getter/setter を追加 |
| `csv.js` | `generateFilename(store, supplier, date)` にシグネチャ変更 |
| `test.html` | 店舗マスタ・current_store・新 generateFilename のテストを追加 |
| `index.html` | ヘッダーに店舗表示要素、操作エリアに「店舗マスタを管理」ボタン、店舗マスタセクション、店舗選択モーダルを開く JS 不要（app.js が動的生成） |
| `styles.css` | ヘッダー店舗表示用のスタイル、追加なくとも既存 modal スタイルでOK |
| `app.js` | renderStoreHeader / openStoreSelectionModal / openStoreSwitchModal / renderStoreMaster / toggleStoreMaster を追加。init を「current_store 未設定なら強制モーダル」分岐に変更。handleSendEmail を更新（件名・本文・ファイル名に store 名を反映） |

## タスク一覧

- Task 1: `storage.js` に店舗マスタ CRUD + current_store を追加（TDD）
- Task 2: `csv.js` の `generateFilename` シグネチャ変更（TDD）
- Task 3: `index.html` / `styles.css` に店舗表示要素と店舗マスタセクションを追加
- Task 4: `app.js` ヘッダー店舗名表示
- Task 5: `app.js` 強制店舗選択モーダル（初回起動）
- Task 6: `app.js` 店舗切替モーダル（ヘッダータップ）
- Task 7: `app.js` 店舗マスタ管理UI
- Task 8: `app.js` handleSendEmail を店舗名対応に更新
- Task 9: 動作確認（実機 + デプロイ）

---

### Task 1: `storage.js` に店舗マスタ CRUD + current_store を追加

**Files:**
- Modify: `barcode-order/storage.js`（追記のみ）
- Modify: `barcode-order/test.html`（テスト追記のみ）

- [ ] **Step 1: `test.html` に店舗マスタ・current_store のテストを追加**

`/Users/yo-chan/claude/barcode-order/test.html` の `// --- csv ---` セクションの**直前**に、以下のブロックを挿入する（直前の `assertEq(storage.isSupplierInUse("Amazon"), true, "supplier in use: by order line");` の後）：

```javascript
    // --- stores ---
    clearStorage();
    assertEq(storage.getStores(), [], "stores: empty by default");
    assertEq(storage.getCurrentStore(), null, "stores: currentStore null by default");

    storage.addStore({ name: "A店" });
    storage.addStore({ name: "B店" });
    assertEq(storage.getStores().map(s => s.name), ["A店", "B店"], "stores: addStore appends");

    let storeThrew = false;
    try { storage.addStore({ name: "A店" }); } catch { storeThrew = true; }
    assertEq(storeThrew, true, "stores: addStore throws on duplicate name");

    storage.updateStore("B店", { name: "C店" });
    assertEq(storage.getStores().map(s => s.name), ["A店", "C店"], "stores: updateStore renames");

    storage.moveStore("C店", -1);
    assertEq(storage.getStores().map(s => s.name), ["C店", "A店"], "stores: moveStore up");

    storage.removeStore("C店");
    assertEq(storage.getStores().map(s => s.name), ["A店"], "stores: removeStore");

    storage.setCurrentStore("A店");
    assertEq(storage.getCurrentStore(), "A店", "stores: setCurrentStore + getCurrentStore");

    storage.setCurrentStore(null);
    assertEq(storage.getCurrentStore(), null, "stores: setCurrentStore null clears");
```

- [ ] **Step 2: テストを開いて FAIL を確認**

```bash
cd /Users/yo-chan/claude/barcode-order
python3 -m http.server 8000 > /tmp/http.log 2>&1 &
echo $! > /tmp/http.pid
```

ブラウザで `http://localhost:8000/test.html` を開く（または、ヘッドレス確認なら syntax check のみ）。
Expected: ブラウザコンソールで `storage.getStores is not a function` 等のエラー。

- [ ] **Step 3: `storage.js` に店舗マスタ + current_store 関数を追加**

`/Users/yo-chan/claude/barcode-order/storage.js` の `KEYS` 定数を以下のように更新（`token` の後に `stores` と `current_store` を追加）：

```javascript
const KEYS = {
  products: "barcode-order:products",
  suppliers: "barcode-order:suppliers",
  order: "barcode-order:order",
  token: "barcode-order:gmail_token",
  stores: "barcode-order:stores",
  current_store: "barcode-order:current_store",
};
```

そして、ファイルの**末尾**に以下を追記：

```javascript

// --- 店舗マスタ（[{name}]） ---
export function getStores() {
  return readJson(KEYS.stores, []);
}

export function addStore({ name }) {
  const stores = getStores();
  if (stores.some(s => s.name === name)) {
    throw new Error(`店舗「${name}」は既に存在します`);
  }
  stores.push({ name });
  writeJson(KEYS.stores, stores);
}

export function updateStore(oldName, { name }) {
  const stores = getStores();
  const idx = stores.findIndex(s => s.name === oldName);
  if (idx === -1) throw new Error(`店舗「${oldName}」が見つかりません`);
  if (name !== oldName && stores.some(s => s.name === name)) {
    throw new Error(`店舗「${name}」は既に存在します`);
  }
  stores[idx] = { name };
  writeJson(KEYS.stores, stores);
}

export function removeStore(name) {
  const stores = getStores().filter(s => s.name !== name);
  writeJson(KEYS.stores, stores);
}

export function moveStore(name, delta) {
  const stores = getStores();
  const idx = stores.findIndex(s => s.name === name);
  if (idx === -1) return;
  const newIdx = Math.max(0, Math.min(stores.length - 1, idx + delta));
  if (newIdx === idx) return;
  const [item] = stores.splice(idx, 1);
  stores.splice(newIdx, 0, item);
  writeJson(KEYS.stores, stores);
}

// --- 現在選択中の店舗 ---
export function getCurrentStore() {
  return readJson(KEYS.current_store, null);
}

export function setCurrentStore(name) {
  if (name === null || name === undefined) {
    localStorage.removeItem(KEYS.current_store);
    return;
  }
  writeJson(KEYS.current_store, name);
}
```

- [ ] **Step 4: 構文チェック**

```bash
node --check /Users/yo-chan/claude/barcode-order/storage.js && echo "storage.js syntax OK"
```

Expected: `storage.js syntax OK`

- [ ] **Step 5: ブラウザで test.html をリロードして全パスを確認**

開発サーバー稼働中なら、ブラウザで `http://localhost:8000/test.html` をリロード。出力末尾に `XX passed, 0 failed`（既存33件 + 新規9件 = 42件）が出ることを確認。

ヘッドレス検証する場合は、リポジトリルートで以下を実行可能：
```bash
node -e "
const _store = {};
globalThis.localStorage = {
  getItem: k => k in _store ? _store[k] : null,
  setItem: (k, v) => { _store[k] = String(v); },
  removeItem: k => { delete _store[k]; },
};
Object.keys = (orig => obj => obj === globalThis.localStorage ? Object.keys(_store) : orig(obj))(Object.keys);
import('/Users/yo-chan/claude/barcode-order/storage.js').then(s => {
  console.log('getStores empty:', JSON.stringify(s.getStores()));
  s.addStore({ name: 'A店' });
  console.log('after addStore:', JSON.stringify(s.getStores()));
  s.setCurrentStore('A店');
  console.log('current:', s.getCurrentStore());
});
"
```

Expected: `getStores empty: []`, `after addStore: [{"name":"A店"}]`, `current: A店`

- [ ] **Step 6: 開発サーバー停止 + コミット**

```bash
if [ -f /tmp/http.pid ]; then kill $(cat /tmp/http.pid) 2>/dev/null; rm /tmp/http.pid; fi

cd /Users/yo-chan/claude/barcode-order
git add storage.js test.html
git commit -m "feat(storage): store master CRUD and current_store getter/setter"
```

---

### Task 2: `csv.js` の `generateFilename` シグネチャ変更（TDD）

**Files:**
- Modify: `barcode-order/csv.js`
- Modify: `barcode-order/test.html`

注意: シグネチャ変更で `app.js` の `handleSendEmail` 呼び出しも壊れるが、その更新は Task 8 で行う。それまではメール送信機能が一時的に壊れる（dev フェーズなので許容）。

- [ ] **Step 1: `test.html` の generateFilename テストを更新**

`/Users/yo-chan/claude/barcode-order/test.html` 内の以下の行を見つける：

```javascript
    // ファイル名
    const d = new Date("2026-04-24T10:05:00+09:00");
    assertEq(
      csv.generateFilename("アスクル", d),
      "order-アスクル-20260424-1005.csv",
      "csv: generateFilename format"
    );
```

これを以下に置き換える：

```javascript
    // ファイル名（store, supplier, date の順）
    const d = new Date("2026-04-24T10:05:00+09:00");
    assertEq(
      csv.generateFilename("A店", "アスクル", d),
      "order-A店-アスクル-20260424-1005.csv",
      "csv: generateFilename format with store"
    );
```

- [ ] **Step 2: 構文チェック（変更前なのでまだ FAIL になるはず）**

ブラウザで `test.html` をリロード。Expected: `csv: generateFilename format with store` が FAIL。

- [ ] **Step 3: `csv.js` の `generateFilename` を更新**

`/Users/yo-chan/claude/barcode-order/csv.js` の以下の関数を：

```javascript
export function generateFilename(supplier, date = new Date()) {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const h = pad2(date.getHours());
  const mi = pad2(date.getMinutes());
  return `order-${supplier}-${y}${m}${d}-${h}${mi}.csv`;
}
```

以下に置き換える：

```javascript
export function generateFilename(store, supplier, date = new Date()) {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const h = pad2(date.getHours());
  const mi = pad2(date.getMinutes());
  return `order-${store}-${supplier}-${y}${m}${d}-${h}${mi}.csv`;
}
```

- [ ] **Step 4: 構文チェック + テストパス確認**

```bash
node --check /Users/yo-chan/claude/barcode-order/csv.js && echo "csv.js syntax OK"
```

ブラウザで `test.html` をリロード。Expected: 全テストパス。

- [ ] **Step 5: コミット**

```bash
cd /Users/yo-chan/claude/barcode-order
git add csv.js test.html
git commit -m "feat(csv): include store name in generated CSV filename"
```

---

### Task 3: `index.html` / `styles.css` に店舗表示要素を追加

**Files:**
- Modify: `barcode-order/index.html`
- Modify: `barcode-order/styles.css`

- [ ] **Step 1: `index.html` のヘッダーに店舗表示を追加**

`/Users/yo-chan/claude/barcode-order/index.html` の以下の `<header>` ブロックを：

```html
  <header class="app-header">
    <h1>バーコード発注</h1>
    <div id="auth-status" class="auth-status">
      <span id="auth-email">未ログイン</span>
      <button id="signin-btn" type="button">ログイン</button>
      <button id="signout-btn" type="button" hidden>ログアウト</button>
    </div>
  </header>
```

以下に置き換える：

```html
  <header class="app-header">
    <div class="header-titles">
      <h1>バーコード発注</h1>
      <button id="store-display" class="store-display" type="button">🏪 店舗未設定</button>
    </div>
    <div id="auth-status" class="auth-status">
      <span id="auth-email">未ログイン</span>
      <button id="signin-btn" type="button">ログイン</button>
      <button id="signout-btn" type="button" hidden>ログアウト</button>
    </div>
  </header>
```

- [ ] **Step 2: 操作エリアに「店舗マスタを管理」ボタンを追加**

`index.html` の以下の `<section class="actions-section">` ブロックを：

```html
    <section class="actions-section">
      <button id="send-email-btn" type="button" disabled>メール送信</button>
      <button id="clear-order-btn" type="button">リストをクリア</button>
      <button id="manage-products-btn" type="button">商品マスタを管理</button>
      <button id="manage-suppliers-btn" type="button">発注先マスタを管理</button>
    </section>
```

以下に置き換える：

```html
    <section class="actions-section">
      <button id="send-email-btn" type="button" disabled>メール送信</button>
      <button id="clear-order-btn" type="button">リストをクリア</button>
      <button id="manage-products-btn" type="button">商品マスタを管理</button>
      <button id="manage-suppliers-btn" type="button">発注先マスタを管理</button>
      <button id="manage-stores-btn" type="button">店舗マスタを管理</button>
    </section>
```

- [ ] **Step 3: 店舗マスタセクションを追加**

`index.html` の `<section id="supplier-master" class="master-section" hidden>` ブロックの**直後**に、以下を追加：

```html
    <section id="store-master" class="master-section" hidden>
      <h2>店舗マスタ</h2>
      <div id="store-master-list"></div>
      <div class="supplier-add-form">
        <input id="new-store-name" type="text" placeholder="店舗名" />
        <button id="add-store-btn" type="button">追加</button>
      </div>
    </section>
```

（`supplier-add-form` クラスを再利用する。URLフィールドが無いだけ）

- [ ] **Step 4: `styles.css` に店舗表示用スタイルを追加**

`/Users/yo-chan/claude/barcode-order/styles.css` の以下のヘッダー定義を見つける：

```css
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #1f6feb;
  color: white;
  position: sticky;
  top: 0;
  z-index: 10;
}
.app-header h1 { font-size: 18px; margin: 0; }
.auth-status { display: flex; gap: 8px; align-items: center; font-size: 12px; }
```

これを以下に置き換える：

```css
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #1f6feb;
  color: white;
  position: sticky;
  top: 0;
  z-index: 10;
}
.header-titles { display: flex; flex-direction: column; gap: 2px; }
.app-header h1 { font-size: 18px; margin: 0; }
.store-display {
  appearance: none;
  background: rgba(255,255,255,0.18);
  color: white;
  border: none;
  border-radius: 12px;
  padding: 2px 8px;
  font-size: 12px;
  cursor: pointer;
  text-align: left;
  align-self: flex-start;
}
.store-display:hover { background: rgba(255,255,255,0.28); }
.auth-status { display: flex; gap: 8px; align-items: center; font-size: 12px; }
```

- [ ] **Step 5: ブラウザで目視確認**

```bash
cd /Users/yo-chan/claude/barcode-order
python3 -m http.server 8000 > /tmp/http.log 2>&1 &
echo $! > /tmp/http.pid
```

ブラウザで `http://localhost:8000/` を開き、以下を確認：
- ヘッダーにタイトルの下に「🏪 店舗未設定」と表示
- 操作エリアに「店舗マスタを管理」ボタンが見える（クリックしても何も起こらない、Task 7 で動作する）

```bash
# サーバー停止
if [ -f /tmp/http.pid ]; then kill $(cat /tmp/http.pid) 2>/dev/null; rm /tmp/http.pid; fi
```

- [ ] **Step 6: コミット**

```bash
cd /Users/yo-chan/claude/barcode-order
git add index.html styles.css
git commit -m "feat: add store display in header and store master section markup"
```

---

### Task 4: `app.js` ヘッダー店舗名表示

**Files:**
- Modify: `barcode-order/app.js`

- [ ] **Step 1: `renderStoreHeader` 関数を追加**

`/Users/yo-chan/claude/barcode-order/app.js` の `renderAuthStatus` 関数の**直前**（`// --- 認証 UI ---` セクションの前）に以下を挿入：

```javascript

// --- 店舗ヘッダー ---

function renderStoreHeader() {
  const btn = document.getElementById("store-display");
  const current = storage.getCurrentStore();
  btn.textContent = current ? `🏪 ${current}` : "🏪 店舗未設定";
}
```

- [ ] **Step 2: `init()` で `renderStoreHeader()` を呼ぶ**

`init()` 関数を以下のように更新：

```javascript
function init() {
  wireActions();
  renderStoreHeader();
  renderAuthStatus();
  renderOrderList();
}
```

- [ ] **Step 3: 構文チェック + 目視確認**

```bash
node --check /Users/yo-chan/claude/barcode-order/app.js && echo "app.js syntax OK"
```

開発サーバー起動して `http://localhost:8000/` を開き、ヘッダー表示を確認。
- localStorage が空なら `🏪 店舗未設定`
- DevTools Console で `localStorage.setItem("barcode-order:current_store", JSON.stringify("A店"))` 実行 → リロードして `🏪 A店` と表示

- [ ] **Step 4: コミット**

```bash
cd /Users/yo-chan/claude/barcode-order
git add app.js
git commit -m "feat(app): render current store name in header"
```

---

### Task 5: `app.js` 強制店舗選択モーダル（初回起動）

**Files:**
- Modify: `barcode-order/app.js`

- [ ] **Step 1: 既存の `openModal` を `closeOnBackdrop` オプション対応に変更**

`/Users/yo-chan/claude/barcode-order/app.js` の以下の関数を：

```javascript
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
```

以下に置き換える（第3引数で `closeOnBackdrop` を制御できるようにする）：

```javascript
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
```

既存の `openModal` 呼び出しはすべて第3引数を省略するため、デフォルトの `closeOnBackdrop: true` で従来通り動く。

- [ ] **Step 2: 強制店舗選択モーダル関数を追加**

`renderStoreHeader` 関数の**直後**に以下を追加：

```javascript

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
```

- [ ] **Step 3: `init()` を強制モーダル起動つきに更新**

`init()` 関数を以下のように更新：

```javascript
function init() {
  wireActions();
  renderStoreHeader();
  renderAuthStatus();
  renderOrderList();
  if (storage.getCurrentStore() === null) {
    openStoreSelectionModal({ required: true });
  }
}
```

- [ ] **Step 4: 構文チェック + 動作確認**

```bash
node --check /Users/yo-chan/claude/barcode-order/app.js && echo "app.js syntax OK"
```

ブラウザの DevTools で `localStorage.clear()` 実行後リロード →
- 「最初の店舗名を入力してください」モーダルが出る
- 入力欄が空のとき OK ボタンが disabled
- 入力 → 「登録して使う」 → モーダル閉じてヘッダーが「🏪 入力した名前」に
- 再度 `localStorage.removeItem("barcode-order:current_store")` してリロード（store master は残っている状態）→ ラジオボタン式モーダルが出る
- required モードのモーダル表示中は背景クリックで閉じない（× ボタンも無い）

- [ ] **Step 5: コミット**

```bash
cd /Users/yo-chan/claude/barcode-order
git add app.js
git commit -m "feat(app): force store selection modal at first launch"
```

---

### Task 6: `app.js` 店舗切替モーダル（ヘッダータップ）

**Files:**
- Modify: `barcode-order/app.js`

- [ ] **Step 1: 店舗切替モーダル関数を追加**

`openStoreSelectionModal` の**直後**に以下を追加：

```javascript

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
```

- [ ] **Step 2: `wireActions()` にヘッダータップを配線**

`wireActions()` 関数の末尾（`}` の直前）に以下を追加：

```javascript
  document.getElementById("store-display").addEventListener("click", openStoreSwitchModal);
```

- [ ] **Step 3: 構文チェック + 動作確認**

```bash
node --check /Users/yo-chan/claude/barcode-order/app.js && echo "app.js syntax OK"
```

ブラウザでアプリを開く（既に店舗が設定されている状態） →
- ヘッダーの店舗表示をタップ → 切替モーダルが開く
- 別の店舗を選んで「切り替える」 → ヘッダーが更新される
- 発注リストに行を追加してから店舗切替 → 確認ダイアログが出る

- [ ] **Step 4: コミット**

```bash
cd /Users/yo-chan/claude/barcode-order
git add app.js
git commit -m "feat(app): store switch modal triggered from header"
```

---

### Task 7: `app.js` 店舗マスタ管理 UI

**Files:**
- Modify: `barcode-order/app.js`

- [ ] **Step 1: 店舗マスタ管理関数を追加**

`openStoreSwitchModal` の**直後**に以下を追加：

```javascript

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
```

- [ ] **Step 2: `wireActions()` に店舗マスタボタンと追加フォームを配線**

`wireActions()` の末尾（`store-display` の listener の後、関数の `}` の前）に以下を追加：

```javascript
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
```

- [ ] **Step 3: 構文チェック + 動作確認**

```bash
node --check /Users/yo-chan/claude/barcode-order/app.js && echo "app.js syntax OK"
```

ブラウザでアプリを開いて：
- 「店舗マスタを管理」ボタン → セクション展開、現在の店舗一覧が見える
- 新規店舗を追加できる
- 名前変更で current_store が追従する（編集後ヘッダーも更新される）
- 上下ボタンで並び替え
- 現在の店舗を削除しようとするとブロックされる
- 他の店舗（current でない）は確認のうえ削除できる

- [ ] **Step 4: コミット**

```bash
cd /Users/yo-chan/claude/barcode-order
git add app.js
git commit -m "feat(app): store master management UI with current-store guard"
```

---

### Task 8: `app.js` `handleSendEmail` を店舗名対応に更新

**Files:**
- Modify: `barcode-order/app.js`

- [ ] **Step 1: `buildSubject` 関数を店舗名対応に更新**

既存の `buildSubject` 関数を以下に置き換える：

```javascript
function buildSubject(date, storeName) {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `[${storeName}] 発注リスト ${y}-${mo}-${d} ${h}:${mi}`;
}
```

- [ ] **Step 2: `buildEmailHtml` を店舗名対応に更新**

既存の `buildEmailHtml` 関数を以下に置き換える：

```javascript
function buildEmailHtml(groupedOrder, suppliers, storeName) {
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
    <p>${escapeHtml(storeName)} からの発注リストをお送りします。</p>
    ${sections}
  </body></html>`;
}
```

- [ ] **Step 3: `handleSendEmail` を更新**

既存の `handleSendEmail` 関数を以下に置き換える：

```javascript
async function handleSendEmail() {
  const order = storage.getOrder();
  if (order.length === 0) return;

  const storeName = storage.getCurrentStore();
  if (!storeName) {
    showToast("店舗が選択されていません");
    return;
  }

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
      filename: csv.generateFilename(storeName, supplierName, now),
      content: csv.generateCsv(lines),
    }));

    await gmail.sendMail({
      to: token.email,
      subject: buildSubject(now, storeName),
      htmlBody: buildEmailHtml(grouped, suppliers, storeName),
      attachments,
    });

    storage.clearOrder();
    renderOrderList();
    showToast("メールを送信しました。発注リストをクリアしました");
  } catch (e) {
    showToast(`送信失敗: ${e.message}`);
  }
}
```

- [ ] **Step 4: 構文チェック**

```bash
node --check /Users/yo-chan/claude/barcode-order/app.js && echo "app.js syntax OK"
```

- [ ] **Step 5: コミット**

```bash
cd /Users/yo-chan/claude/barcode-order
git add app.js
git commit -m "feat(app): include store name in email subject, body, and CSV filename"
```

---

### Task 9: 動作確認 + デプロイ

**Files:**
- なし（GitHub Pages で自動デプロイ）

- [ ] **Step 1: 全変更を push**

```bash
cd /Users/yo-chan/claude/barcode-order
git push
```

- [ ] **Step 2: GitHub Pages のビルド完了を確認**

```bash
gh api /repos/Bangdoll0226/barcode-order/pages/builds/latest --jq '{status, commit}'
```

`status: built` になるまで待つ（1〜2分）。`commit` が最新の Task 8 のコミットSHAであることを確認。

- [ ] **Step 3: 実機テストの受け入れ基準（ユーザーが実施）**

以下のシナリオをすべて通す：

1. スマホで https://bangdoll0226.github.io/barcode-order/ を開く（必要なら DevTools か Settings から localStorage を全削除して初回起動状態を再現）
2. 強制モーダル「最初の店舗名を入力してください」が出る
3. 「A店」と入力 → 登録して使う → ヘッダーに `🏪 A店` 表示
4. バーコードを 1〜2 個スキャンして発注リストに入れる
5. 「メール送信」 → 自分のGmailに以下が届くことを確認:
   - 件名: `[A店] 発注リスト YYYY-MM-DD HH:mm`
   - 本文冒頭: `A店 からの発注リストをお送りします。`
   - 添付ファイル名: `order-A店-{発注先}-YYYYMMDD-HHmm.csv`
6. 送信後、発注リストはクリアされる
7. 「店舗マスタを管理」 → 「B店」を追加
8. ヘッダーの `🏪 A店` をタップ → 切替モーダル → B店を選択 → ヘッダーが `🏪 B店` に
9. もう1件発注 → 送信 → 件名・添付名が `B店` 入りになっている
10. 店舗マスタで A店 を削除しようとする（current は B店なので削除可）→ 確認ダイアログののち削除
11. B店を削除しようとする → 「現在使用中のため削除できません」とブロック

- [ ] **Step 4: 何か壊れていたら issue として記録**

GitHub の issue は使わず、ユーザーへ口頭で問題を報告してもらう（個人運用のため）。問題があれば追加タスクで対応。

---

## 完了条件

- 9つのタスクすべてのコミット完了
- GitHub Pages 上で動作確認OK
- メール件名・本文・CSV ファイル名すべてに店舗名が反映される
- 既存の機能（商品マスタ・発注先マスタ・スキャン・送信）に regressions なし
