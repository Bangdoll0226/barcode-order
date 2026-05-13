# バーコード発注アプリ 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** スマホカメラでバーコードを読み取り、商品・発注先マスタを管理しつつ発注リストを作成し、Gmail API 経由で自分宛に CSV 添付メールを送れる Web アプリを完成させる。

**Architecture:** 静的 HTML + ES Modules（ビルド不要）。`storage.js`/`csv.js`/`gmail.js`/`app.js` に責務分割。データは localStorage に保存。バーコード読み取りは html5-qrcode（CDN）、OAuth は Google Identity Services（CDN）。テストは `test.html` に簡易ハーネスを作り、ブラウザで開いて目視確認。

**Tech Stack:** HTML5 / ES Modules / Vanilla JavaScript / localStorage / html5-qrcode / Google Identity Services / Gmail API

---

## ファイル構成

作業ディレクトリ: `/Users/yo-chan/claude/barcode-order/`

| ファイル | 責務 |
| --- | --- |
| `index.html` | メイン画面のマークアップ。モジュールの import と DOM 構造のみ。ロジックは持たない |
| `styles.css` | 全画面のスタイル（スマホ縦向き中心のレイアウト） |
| `storage.js` | localStorage の読み書き。商品・発注先・発注リスト・OAuthトークンの CRUD |
| `csv.js` | 発注リスト → 発注先ごとの CSV テキスト生成。ファイル名生成 |
| `gmail.js` | Google OAuth（GIS）とGmail API `users.messages.send` の呼び出し |
| `app.js` | DOM 操作・イベントハンドラ・各モジュールの連携 |
| `test.html` | 純粋ロジック（storage, csv）の簡易テストランナー |
| `config.sample.js` | OAuth クライアントID のひな形（git 管理） |
| `config.js` | 実際のクライアントID を入れる（.gitignore 対象） |
| `.gitignore` | `config.js` と `.DS_Store` 等を除外 |
| `manifest.json` | PWA 設定（ホーム画面追加用） |
| `README.md` | セットアップ手順（Google OAuth 設定含む） |

## タスク一覧

- Task 1: プロジェクト初期化（.gitignore / config / README 骨子）
- Task 2: `storage.js` の商品マスタ操作（TDD）
- Task 3: `storage.js` の発注先マスタ操作（TDD）
- Task 4: `storage.js` の発注リスト操作（TDD）
- Task 5: `csv.js` のグルーピング + CSV 生成（TDD）
- Task 6: `index.html` / `styles.css` の画面骨格
- Task 7: `app.js` 発注リスト描画・行操作
- Task 8: `app.js` 手動入力フォールバック（モーダル + JAN入力）
- Task 9: `app.js` 未登録商品モーダル + スキャン結果のリスト取り込み
- Task 10: `app.js` バーコードスキャン統合（html5-qrcode）
- Task 11: `app.js` 商品マスタ管理 UI
- Task 12: `app.js` 発注先マスタ管理 UI
- Task 13: `gmail.js` Google OAuth + 送信処理
- Task 14: メール送信ボタンの統合（送信後に発注リストを自動クリア）
- Task 15: PWA（manifest.json + アイコン）
- Task 16: README にOAuthセットアップ手順を記載 + 実機テスト

---

### Task 1: プロジェクト初期化

**Files:**
- Create: `barcode-order/.gitignore`
- Create: `barcode-order/config.sample.js`
- Create: `barcode-order/config.js`
- Create: `barcode-order/README.md`

- [ ] **Step 1: `.gitignore` を作成**

```
config.js
.DS_Store
*.log
```

- [ ] **Step 2: `config.sample.js` を作成**

```javascript
// このファイルをコピーして config.js を作成し、Google OAuth のクライアントIDを記入してください。
// 詳細は README.md の「セットアップ手順」を参照。

export const GOOGLE_OAUTH_CLIENT_ID = "YOUR_CLIENT_ID.apps.googleusercontent.com";
```

- [ ] **Step 3: `config.js` を作成（ダミー値で OK、実運用時に書き換え）**

```javascript
export const GOOGLE_OAUTH_CLIENT_ID = "PUT_YOUR_CLIENT_ID_HERE.apps.googleusercontent.com";
```

- [ ] **Step 4: `README.md` の骨子を作成**

```markdown
# barcode-order

スマホカメラでバーコードを読み取り、発注リストを作成して Gmail でメール送信する個人向け Web アプリ。

## 開発サーバーの起動

```
cd barcode-order
python3 -m http.server 8000
```

`http://localhost:8000/` にアクセス。スマホから使う場合は、同一 LAN 上で Mac の IP アドレスを指定してください（ただし iOS Safari はカメラ API で https を要求するため、本番は GitHub Pages 等の https 配信を推奨）。

## セットアップ手順

（Task 16 で追記）
```

- [ ] **Step 5: コミット**

`config.js` は `.gitignore` で除外されているため `git add` には含めない（実クライアントIDの誤公開を防ぐため）。ローカルには残しておき、開発中に使う。

```bash
cd /Users/yo-chan/claude/barcode-order
git add .gitignore config.sample.js README.md
git commit -m "chore: project scaffolding (gitignore, config sample, README skeleton)"
```

---

### Task 2: `storage.js` の商品マスタ操作（TDD）

**Files:**
- Create: `barcode-order/storage.js`
- Create: `barcode-order/test.html`

- [ ] **Step 1: `test.html` のテストハーネス骨格を作成**

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>barcode-order tests</title>
</head>
<body>
  <h1>barcode-order tests</h1>
  <p>Open DevTools Console to see results.</p>
  <pre id="out"></pre>

  <script type="module">
    import * as storage from "./storage.js";

    const out = document.getElementById("out");
    let passed = 0, failed = 0;

    function log(msg, ok) {
      const line = `${ok ? "✓" : "✗"} ${msg}`;
      out.textContent += line + "\n";
      if (ok) console.log(line); else console.error(line);
    }
    function assertEq(actual, expected, name) {
      const a = JSON.stringify(actual), e = JSON.stringify(expected);
      if (a === e) { log(name, true); passed++; }
      else { log(`${name} — expected ${e}, got ${a}`, false); failed++; }
    }
    function clearStorage() {
      Object.keys(localStorage)
        .filter(k => k.startsWith("barcode-order:"))
        .forEach(k => localStorage.removeItem(k));
    }

    // --- products ---
    clearStorage();
    assertEq(storage.getProducts(), {}, "products: empty by default");

    storage.saveProduct("4901234567890", { name: "アルコール綿 100包", defaultSupplier: "アスクル" });
    assertEq(
      storage.getProducts(),
      { "4901234567890": { name: "アルコール綿 100包", defaultSupplier: "アスクル" } },
      "products: saveProduct then getProducts"
    );

    assertEq(
      storage.getProduct("4901234567890"),
      { name: "アルコール綿 100包", defaultSupplier: "アスクル" },
      "products: getProduct by jan"
    );
    assertEq(storage.getProduct("nosuch"), null, "products: getProduct returns null for unknown");

    storage.deleteProduct("4901234567890");
    assertEq(storage.getProducts(), {}, "products: deleteProduct");

    out.textContent += `\n${passed} passed, ${failed} failed\n`;
  </script>
</body>
</html>
```

- [ ] **Step 2: テストを実行してまず失敗することを確認**

Run: 開発サーバー起動後、ブラウザで `http://localhost:8000/test.html` を開く

```bash
cd /Users/yo-chan/claude/barcode-order
python3 -m http.server 8000
```

Expected: `storage.js` が存在しないため module import エラー

- [ ] **Step 3: `storage.js` の商品マスタ部分を実装**

```javascript
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
```

- [ ] **Step 4: テストを再実行してすべてパスすることを確認**

ブラウザで `test.html` をリロード。出力が `4 passed, 0 failed` になる。

- [ ] **Step 5: コミット**

```bash
git add storage.js test.html
git commit -m "feat(storage): product master CRUD with tests"
```

---

### Task 3: `storage.js` の発注先マスタ操作（TDD）

**Files:**
- Modify: `barcode-order/storage.js`
- Modify: `barcode-order/test.html`

- [ ] **Step 1: `test.html` に発注先マスタのテストを追加**

`test.html` の `// --- products ---` セクションの直後（`out.textContent += ...` の直前）に以下を挿入：

```javascript
    // --- suppliers ---
    clearStorage();
    // 初回取得時は 4 つのデフォルトが入っている
    const defaults = storage.getSuppliers();
    assertEq(
      defaults.map(s => s.name),
      ["アスクル", "カウネット", "Amazon", "シンリョウ"],
      "suppliers: default list on first load"
    );
    assertEq(
      defaults.find(s => s.name === "シンリョウ").url,
      "https://www.shinryo.jp/",
      "suppliers: default shinryo url"
    );

    // 追加
    storage.addSupplier({ name: "その他", url: "" });
    assertEq(
      storage.getSuppliers().map(s => s.name),
      ["アスクル", "カウネット", "Amazon", "シンリョウ", "その他"],
      "suppliers: addSupplier appends"
    );

    // 重複追加はエラー
    let threw = false;
    try { storage.addSupplier({ name: "アスクル", url: "" }); } catch { threw = true; }
    assertEq(threw, true, "suppliers: addSupplier throws on duplicate name");

    // 名前・URLの変更
    storage.updateSupplier("その他", { name: "自社", url: "" });
    assertEq(
      storage.getSuppliers().find(s => s.name === "自社").name,
      "自社",
      "suppliers: updateSupplier renames"
    );

    // 並び替え（上へ）
    storage.moveSupplier("Amazon", -1);
    assertEq(
      storage.getSuppliers().map(s => s.name),
      ["アスクル", "Amazon", "カウネット", "シンリョウ", "自社"],
      "suppliers: moveSupplier up"
    );

    // 削除
    storage.removeSupplier("自社");
    assertEq(
      storage.getSuppliers().map(s => s.name),
      ["アスクル", "Amazon", "カウネット", "シンリョウ"],
      "suppliers: removeSupplier"
    );
```

- [ ] **Step 2: テストが失敗することを確認**

Expected: `storage.getSuppliers is not a function` などのエラーで FAIL

- [ ] **Step 3: `storage.js` に発注先マスタ関数を追加**

`storage.js` の末尾に追記：

```javascript
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
```

- [ ] **Step 4: テストが全部パスすることを確認**

ブラウザで `test.html` をリロード。すべて pass。

- [ ] **Step 5: コミット**

```bash
git add storage.js test.html
git commit -m "feat(storage): supplier master CRUD with defaults and reorder"
```

---

### Task 4: `storage.js` の発注リスト操作（TDD）

**Files:**
- Modify: `barcode-order/storage.js`
- Modify: `barcode-order/test.html`

- [ ] **Step 1: `test.html` に発注リストのテストを追加**

`test.html` に以下を追加（`// --- suppliers ---` セクションの後）：

```javascript
    // --- order ---
    clearStorage();
    assertEq(storage.getOrder(), [], "order: empty by default");

    storage.addOrderLine({
      barcode: "4901234567890",
      name: "アルコール綿 100包",
      supplier: "アスクル",
    });
    const order1 = storage.getOrder();
    assertEq(order1.length, 1, "order: addOrderLine adds one");
    assertEq(order1[0].quantity, 1, "order: new line starts at quantity 1");
    assertEq(typeof order1[0].id, "string", "order: new line has id");

    // 同じ JAN を incrementQuantity
    storage.incrementQuantity("4901234567890");
    assertEq(storage.getOrder()[0].quantity, 2, "order: incrementQuantity by jan");

    // findLineByBarcode
    const line = storage.findLineByBarcode("4901234567890");
    assertEq(line.name, "アルコール綿 100包", "order: findLineByBarcode");
    assertEq(storage.findLineByBarcode("nosuch"), null, "order: findLineByBarcode null for unknown");

    // 数量を特定値に設定
    storage.updateLine(line.id, { quantity: 5 });
    assertEq(storage.getOrder()[0].quantity, 5, "order: updateLine quantity");

    // 発注先変更
    storage.updateLine(line.id, { supplier: "シンリョウ" });
    assertEq(storage.getOrder()[0].supplier, "シンリョウ", "order: updateLine supplier");

    // 削除
    storage.removeLine(line.id);
    assertEq(storage.getOrder(), [], "order: removeLine");

    // clearOrder
    storage.addOrderLine({ barcode: "1", name: "x", supplier: "アスクル" });
    storage.addOrderLine({ barcode: "2", name: "y", supplier: "アスクル" });
    storage.clearOrder();
    assertEq(storage.getOrder(), [], "order: clearOrder");

    // --- 発注先が使用中かどうか ---
    clearStorage();
    storage.saveProduct("4901234567890", { name: "x", defaultSupplier: "アスクル" });
    assertEq(storage.isSupplierInUse("アスクル"), true, "supplier in use: by product master");
    assertEq(storage.isSupplierInUse("カウネット"), false, "supplier not in use");

    clearStorage();
    storage.addOrderLine({ barcode: "1", name: "x", supplier: "Amazon" });
    assertEq(storage.isSupplierInUse("Amazon"), true, "supplier in use: by order line");
```

- [ ] **Step 2: テストが失敗することを確認**

Expected: 上記関数が未定義のため FAIL

- [ ] **Step 3: `storage.js` に発注リスト関数＋使用中判定を追加**

`storage.js` の末尾に追記：

```javascript
// --- 発注リスト（[{id, barcode, name, quantity, supplier, addedAt}]） ---
function newId() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return "id-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
}

export function getOrder() {
  return readJson(KEYS.order, []);
}

export function addOrderLine({ barcode, name, supplier }) {
  const order = getOrder();
  order.push({
    id: newId(),
    barcode,
    name,
    quantity: 1,
    supplier,
    addedAt: new Date().toISOString(),
  });
  writeJson(KEYS.order, order);
}

export function findLineByBarcode(barcode) {
  return getOrder().find(l => l.barcode === barcode) ?? null;
}

export function incrementQuantity(barcode) {
  const order = getOrder();
  const line = order.find(l => l.barcode === barcode);
  if (!line) return;
  line.quantity += 1;
  writeJson(KEYS.order, order);
}

export function updateLine(id, patch) {
  const order = getOrder();
  const line = order.find(l => l.id === id);
  if (!line) return;
  Object.assign(line, patch);
  writeJson(KEYS.order, order);
}

export function removeLine(id) {
  const order = getOrder().filter(l => l.id !== id);
  writeJson(KEYS.order, order);
}

export function clearOrder() {
  writeJson(KEYS.order, []);
}

// --- 発注先が商品マスタ or 発注リストで使われているか ---
export function isSupplierInUse(name) {
  const products = getProducts();
  if (Object.values(products).some(p => p.defaultSupplier === name)) return true;
  const order = getOrder();
  if (order.some(l => l.supplier === name)) return true;
  return false;
}
```

- [ ] **Step 4: テストが全部パスすることを確認**

- [ ] **Step 5: コミット**

```bash
git add storage.js test.html
git commit -m "feat(storage): order list CRUD and supplier usage check"
```

---

### Task 5: `csv.js` のグルーピング + CSV 生成（TDD）

**Files:**
- Create: `barcode-order/csv.js`
- Modify: `barcode-order/test.html`

- [ ] **Step 1: `test.html` に CSV テストを追加**

`test.html` の `<script type="module">` の先頭の import に `csv.js` を追加：

```javascript
    import * as storage from "./storage.js";
    import * as csv from "./csv.js";
```

テストセクションの末尾（`out.textContent += ...` の直前）に追加：

```javascript
    // --- csv ---
    const orderLines = [
      { id: "a", barcode: "1", name: "アルコール綿 100包", quantity: 3, supplier: "アスクル" },
      { id: "b", barcode: "2", name: "コピー用紙,A4", quantity: 2, supplier: "アスクル" },
      { id: "c", barcode: "3", name: "手袋 M", quantity: 4, supplier: "シンリョウ" },
    ];
    const grouped = csv.groupBySupplier(orderLines);
    assertEq(Object.keys(grouped).sort(), ["アスクル", "シンリョウ"], "csv: groupBySupplier keys");
    assertEq(grouped["アスクル"].length, 2, "csv: groupBySupplier askul has 2");
    assertEq(grouped["シンリョウ"].length, 1, "csv: groupBySupplier shinryo has 1");

    const text = csv.generateCsv(grouped["アスクル"]);
    // 先頭は BOM
    assertEq(text.charCodeAt(0), 0xFEFF, "csv: starts with UTF-8 BOM");
    // ヘッダ + 2行 = 3行（最終行末に CRLF）
    const body = text.slice(1);
    assertEq(
      body,
      "品名,数量,JANコード\r\n" +
      "アルコール綿 100包,3,1\r\n" +
      "\"コピー用紙,A4\",2,2\r\n",
      "csv: generateCsv content with comma-escaping"
    );

    // ダブルクオート含む品名
    const q = csv.generateCsv([{ name: "彼は\"A\"と言った", quantity: 1, barcode: "9" }]);
    assertEq(
      q.slice(1),
      "品名,数量,JANコード\r\n" +
      "\"彼は\"\"A\"\"と言った\",1,9\r\n",
      "csv: generateCsv escapes double quote"
    );

    // ファイル名
    const d = new Date("2026-04-24T10:05:00+09:00");
    assertEq(
      csv.generateFilename("アスクル", d),
      "order-アスクル-20260424-1005.csv",
      "csv: generateFilename format"
    );
```

- [ ] **Step 2: テストが失敗することを確認**

Expected: `csv.js` が無いので import エラー

- [ ] **Step 3: `csv.js` を実装**

```javascript
// csv.js — 発注リストを発注先ごとに CSV 化する

export function groupBySupplier(orderLines) {
  const map = {};
  for (const line of orderLines) {
    if (!map[line.supplier]) map[line.supplier] = [];
    map[line.supplier].push(line);
  }
  return map;
}

function escapeField(value) {
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export function generateCsv(orderLines) {
  const BOM = "\uFEFF";
  const header = ["品名", "数量", "JANコード"].join(",");
  const rows = orderLines.map(l =>
    [escapeField(l.name), escapeField(l.quantity), escapeField(l.barcode)].join(",")
  );
  return BOM + [header, ...rows].join("\r\n") + "\r\n";
}

function pad2(n) { return String(n).padStart(2, "0"); }

export function generateFilename(supplier, date = new Date()) {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const h = pad2(date.getHours());
  const mi = pad2(date.getMinutes());
  return `order-${supplier}-${y}${m}${d}-${h}${mi}.csv`;
}
```

- [ ] **Step 4: テストが全部パスすることを確認**

ブラウザで `test.html` をリロード、すべて pass。

- [ ] **Step 5: コミット**

```bash
git add csv.js test.html
git commit -m "feat(csv): grouping and CSV generation with UTF-8 BOM"
```

---

### Task 6: `index.html` / `styles.css` の画面骨格

**Files:**
- Create: `barcode-order/index.html`
- Create: `barcode-order/styles.css`
- Create: `barcode-order/app.js`

- [ ] **Step 1: `index.html` を作成**

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <title>バーコード発注</title>
  <link rel="stylesheet" href="styles.css">
  <link rel="manifest" href="manifest.json">
  <script src="https://unpkg.com/html5-qrcode" defer></script>
  <script src="https://accounts.google.com/gsi/client" defer></script>
</head>
<body>
  <header class="app-header">
    <h1>バーコード発注</h1>
    <div id="auth-status" class="auth-status">
      <span id="auth-email">未ログイン</span>
      <button id="signin-btn" type="button">ログイン</button>
      <button id="signout-btn" type="button" hidden>ログアウト</button>
    </div>
  </header>

  <main>
    <section class="scan-section">
      <button id="scan-start-btn" type="button">スキャン開始</button>
      <button id="scan-manual-btn" type="button">手動入力</button>
      <div id="scanner" class="scanner" hidden></div>
    </section>

    <section class="order-section">
      <h2>発注リスト <span id="order-count">0件</span></h2>
      <div id="order-list" class="order-list"></div>
      <div id="order-empty" class="empty">リストは空です。バーコードをスキャンしてください。</div>
    </section>

    <section class="actions-section">
      <button id="send-email-btn" type="button" disabled>メール送信</button>
      <button id="clear-order-btn" type="button">リストをクリア</button>
      <button id="manage-products-btn" type="button">商品マスタを管理</button>
      <button id="manage-suppliers-btn" type="button">発注先マスタを管理</button>
    </section>

    <section id="product-master" class="master-section" hidden>
      <h2>商品マスタ</h2>
      <div id="product-master-list"></div>
    </section>

    <section id="supplier-master" class="master-section" hidden>
      <h2>発注先マスタ</h2>
      <div id="supplier-master-list"></div>
      <div class="supplier-add-form">
        <input id="new-supplier-name" type="text" placeholder="発注先名" />
        <input id="new-supplier-url" type="url" placeholder="URL（任意）" />
        <button id="add-supplier-btn" type="button">追加</button>
      </div>
    </section>
  </main>

  <div id="modal-root"></div>
  <div id="toast" class="toast" hidden></div>

  <script type="module" src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: `styles.css` を作成（スマホ縦向き中心、読みやすさ優先）**

```css
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Hiragino Kaku Gothic ProN", sans-serif;
  background: #f4f5f7;
  color: #222;
}
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
main { padding: 12px 16px 80px; display: flex; flex-direction: column; gap: 16px; }

section { background: white; border-radius: 8px; padding: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
section h2 { margin: 0 0 8px; font-size: 16px; }

button {
  appearance: none;
  border: 1px solid #1f6feb;
  background: white;
  color: #1f6feb;
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}
button.primary { background: #1f6feb; color: white; }
button:disabled { opacity: 0.5; cursor: not-allowed; }

.scan-section { display: flex; flex-direction: column; gap: 8px; }
.scanner { width: 100%; min-height: 250px; background: #000; border-radius: 6px; }

.order-list { display: flex; flex-direction: column; gap: 8px; }
.order-line {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  padding: 8px;
  border: 1px solid #e2e4e8;
  border-radius: 6px;
}
.order-line .name { font-weight: 600; }
.order-line .controls { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.order-line .qty-ctrl { display: flex; align-items: center; gap: 4px; }
.order-line .qty-ctrl input { width: 48px; text-align: center; }

.empty { color: #999; font-size: 13px; text-align: center; padding: 16px; }

.actions-section { display: flex; flex-direction: column; gap: 8px; }

.master-section .master-line {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 8px;
  padding: 6px 4px;
  border-bottom: 1px solid #eee;
  align-items: center;
}
.supplier-add-form { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.supplier-add-form input { flex: 1; min-width: 100px; padding: 8px; border: 1px solid #ccc; border-radius: 4px; }

.modal-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal { background: white; padding: 16px; border-radius: 8px; width: 90%; max-width: 400px; }
.modal h3 { margin-top: 0; }
.modal label { display: block; margin: 8px 0 4px; font-size: 13px; }
.modal input, .modal select { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; }
.modal .buttons { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; }
.radio-group { display: flex; flex-direction: column; gap: 4px; }
.radio-group label { display: flex; align-items: center; gap: 6px; font-weight: normal; }

.toast {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  background: #333; color: white; padding: 10px 16px; border-radius: 6px;
  z-index: 200; font-size: 14px;
}
```

- [ ] **Step 3: `app.js` にスケルトン（空の init）を置く**

```javascript
// app.js — entry point

import * as storage from "./storage.js";
import * as csv from "./csv.js";

function init() {
  // タスク 7 以降で順次実装
}

document.addEventListener("DOMContentLoaded", init);
```

- [ ] **Step 4: ブラウザで `index.html` を開いて、レイアウトが崩れていないか目視確認**

```bash
# まだ開発サーバーが動いていなければ起動
cd /Users/yo-chan/claude/barcode-order
python3 -m http.server 8000
```

`http://localhost:8000/` にアクセス。ヘッダー、スキャンボタン、発注リスト（空メッセージ）、操作ボタンが見える状態を確認。機能はまだ動かなくて OK。

- [ ] **Step 5: コミット**

```bash
git add index.html styles.css app.js
git commit -m "feat: initial UI scaffolding with sections and styles"
```

---

### Task 7: `app.js` 発注リスト描画・行操作

**Files:**
- Modify: `barcode-order/app.js`

- [ ] **Step 1: `app.js` に発注リスト描画とイベント配線を追加**

```javascript
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
      // 削除された発注先が残っている場合のフォールバック
      const opt = document.createElement("option");
      opt.value = line.supplier;
      opt.textContent = `${line.supplier}（削除済）`;
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

function wireActions() {
  document.getElementById("clear-order-btn").addEventListener("click", () => {
    if (storage.getOrder().length === 0) return;
    if (confirm("発注リストをすべてクリアしますか？")) {
      storage.clearOrder();
      renderOrderList();
    }
  });
}

function init() {
  wireActions();
  renderOrderList();
}

document.addEventListener("DOMContentLoaded", init);
```

- [ ] **Step 2: 動作確認（手動）**

ブラウザで `test.html` を開き、test.html のテスト実行によって自動的にいくつかの発注リスト行が localStorage に入る。その後 `http://localhost:8000/` にアクセス → リストに行が表示されることを確認。もし行が表示されない場合、DevTools Console で以下を実行して手動投入：

```javascript
// DevTools Console
const s = await import("./storage.js");
s.addOrderLine({ barcode: "1234", name: "テスト商品", supplier: "アスクル" });
location.reload();
```

動作チェック:
- 数量の +/− ボタンで増減する
- 数量直接入力で更新される
- 発注先セレクトで変更できる
- 削除ボタンで消える
- 「リストをクリア」で全消去

- [ ] **Step 3: コミット**

```bash
git add app.js
git commit -m "feat(app): render order list with quantity and supplier editing"
```

---

### Task 8: `app.js` 手動入力フォールバック（モーダル + JAN入力）

**Files:**
- Modify: `barcode-order/app.js`

- [ ] **Step 1: `app.js` にモーダル基盤関数を追加**

`app.js` の末尾（`document.addEventListener("DOMContentLoaded", init);` の前）に追加：

```javascript
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
```

- [ ] **Step 2: 手動入力モーダルを実装（追加関数）**

```javascript
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
```

- [ ] **Step 3: `handleScannedBarcode(jan)` のスタブを追加（後続タスクで本実装）**

```javascript
// --- バーコード受け取り（後続タスクで拡張） ---

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
    // タスク 9 で未登録商品モーダルを開く
    showToast(`未登録の商品です（${jan}）。タスク 9 で登録モーダルを実装します`);
  }
}
```

- [ ] **Step 4: `wireActions()` に手動入力ボタンの配線を追加**

`wireActions()` 関数内に追加：

```javascript
  document.getElementById("scan-manual-btn").addEventListener("click", openManualBarcodeModal);
```

- [ ] **Step 5: 動作確認**

- DevTools Console で事前に商品マスタを投入：
  ```javascript
  const s = await import("./storage.js");
  s.saveProduct("4901234567890", { name: "アルコール綿 100包", defaultSupplier: "アスクル" });
  ```
- 「手動入力」ボタン → モーダル表示
- `4901234567890` を入力して確定 → リストに追加される（トースト表示）
- もう一度同じ JAN で確定 → 数量 +1
- 未登録 JAN（例 `1234567890123`）を入力 → 「未登録」トースト

- [ ] **Step 6: コミット**

```bash
git add app.js
git commit -m "feat(app): manual barcode input modal and scan handler"
```

---

### Task 9: `app.js` 未登録商品モーダル + スキャン結果のリスト取り込み

**Files:**
- Modify: `barcode-order/app.js`

- [ ] **Step 1: 未登録商品モーダルを実装**

`app.js` に追加：

```javascript
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
```

- [ ] **Step 2: `handleScannedBarcode` を本実装に差し替え**

Task 8 の `handleScannedBarcode` の `else` ブロックを更新：

```javascript
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
```

- [ ] **Step 3: 動作確認**

- `localStorage.clear()` で一度リセット
- 「手動入力」→ `1234567890123` などの未登録 JAN を入力
- 登録モーダルが開き、品名入力・発注先選択ができる
- 品名が空のとき「登録して追加」が無効
- 登録するとリストに追加される
- もう一度同じ JAN を手動入力 → 数量 +1（モーダル出ない）

- [ ] **Step 4: コミット**

```bash
git add app.js
git commit -m "feat(app): unknown product registration modal"
```

---

### Task 10: `app.js` バーコードスキャン統合（html5-qrcode）

**Files:**
- Modify: `barcode-order/app.js`

- [ ] **Step 1: `app.js` にスキャナ制御関数を追加**

```javascript
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
```

- [ ] **Step 2: `wireActions()` にスキャン開始ボタンを配線**

`wireActions()` 内に追加：

```javascript
  document.getElementById("scan-start-btn").addEventListener("click", async () => {
    if (scanner) await stopScanner();
    else await startScanner();
  });
```

- [ ] **Step 3: 動作確認（実機推奨）**

- Mac のブラウザで開発サーバーにアクセス → 「スキャン開始」でカメラが起動（Mac のウェブカメラでも可）
- 適当なバーコード（書籍ISBN, 食品JAN など）をかざす
- 検出されると自動停止してハンドラが呼ばれる
- スマホでは https 配信が必要（ローカルLANでは Mac 側で https が難しいため、この段階ではMacで確認 → Task 15-16 の実機テストで本確認）

- [ ] **Step 4: コミット**

```bash
git add app.js
git commit -m "feat(app): integrate html5-qrcode scanner with debounce"
```

---

### Task 11: `app.js` 商品マスタ管理 UI

**Files:**
- Modify: `barcode-order/app.js`

- [ ] **Step 1: 商品マスタ描画関数を追加**

```javascript
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
```

- [ ] **Step 2: `wireActions()` にボタン配線を追加**

```javascript
  document.getElementById("manage-products-btn").addEventListener("click", toggleProductMaster);
```

- [ ] **Step 3: 動作確認**

- 「商品マスタを管理」ボタン → セクション展開
- 登録済み商品が一覧される
- 発注先セレクトで変更 → localStorage 反映（ページリロードで確認）
- 削除ボタン → 確認ダイアログ → 削除

- [ ] **Step 4: コミット**

```bash
git add app.js
git commit -m "feat(app): product master management UI"
```

---

### Task 12: `app.js` 発注先マスタ管理 UI

**Files:**
- Modify: `barcode-order/app.js`

- [ ] **Step 1: 発注先マスタ描画関数を追加**

```javascript
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
        // 参照されている商品・発注行の supplier 名も更新が必要
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
  // 商品マスタ内の defaultSupplier を更新
  const products = storage.getProducts();
  for (const [jan, p] of Object.entries(products)) {
    if (p.defaultSupplier === oldName) {
      storage.saveProduct(jan, { ...p, defaultSupplier: newName });
    }
  }
  // 発注リスト内の supplier を更新
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
```

- [ ] **Step 2: 追加フォームの配線を `wireActions()` に追加**

```javascript
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
```

- [ ] **Step 3: 動作確認**

- 「発注先マスタを管理」→ セクション展開、デフォルト4つ表示
- 名前・URLを編集 → 反映（商品マスタ・発注リストの参照も追従）
- 上下ボタンで並び替え
- 追加フォームで新規発注先追加
- 使用中の発注先は削除不可
- 未使用の発注先は確認ダイアログののち削除可能

- [ ] **Step 4: コミット**

```bash
git add app.js
git commit -m "feat(app): supplier master management UI with usage-guard"
```

---

### Task 13: `gmail.js` Google OAuth + 送信処理

**Files:**
- Create: `barcode-order/gmail.js`

- [ ] **Step 1: `gmail.js` を実装**

```javascript
// gmail.js — Google OAuth (Google Identity Services) + Gmail API send

import * as storage from "./storage.js";
import { GOOGLE_OAUTH_CLIENT_ID } from "./config.js";

const SCOPE = "https://www.googleapis.com/auth/gmail.send";
const TOKEN_KEY_GMAIL = "barcode-order:gmail_token";

// --- token helpers ---

export function getToken() {
  const raw = localStorage.getItem(TOKEN_KEY_GMAIL);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function saveToken(token) {
  localStorage.setItem(TOKEN_KEY_GMAIL, JSON.stringify(token));
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY_GMAIL);
}

export function isSignedIn() {
  const t = getToken();
  return !!t && t.access_token && Date.now() < t.expires_at;
}

// --- OAuth flow (Google Identity Services token client) ---

let tokenClient = null;

function ensureTokenClient() {
  if (tokenClient) return tokenClient;
  if (!window.google?.accounts?.oauth2) {
    throw new Error("Google Identity Services が読み込めていません");
  }
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_OAUTH_CLIENT_ID,
    scope: SCOPE,
    callback: () => {}, // per-request callback で上書きする
  });
  return tokenClient;
}

export function signIn() {
  return new Promise((resolve, reject) => {
    const client = ensureTokenClient();
    client.callback = async (resp) => {
      if (resp.error) { reject(new Error(resp.error)); return; }
      const expires_at = Date.now() + (resp.expires_in - 60) * 1000; // 60秒余裕
      const access_token = resp.access_token;
      // 認証ユーザーのメール取得
      let email = "";
      try {
        const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${access_token}` },
        });
        if (r.ok) email = (await r.json()).email || "";
      } catch {}
      const token = { access_token, expires_at, email };
      saveToken(token);
      resolve(token);
    };
    client.requestAccessToken({ prompt: isSignedIn() ? "" : "consent" });
  });
}

export function signOut() {
  const t = getToken();
  if (t?.access_token && window.google?.accounts?.oauth2) {
    google.accounts.oauth2.revoke(t.access_token, () => {});
  }
  clearToken();
}

// --- Gmail API 送信 ---

function buildMimeMessage({ to, subject, htmlBody, attachments }) {
  // 複数添付を含む MIME multipart/mixed メッセージを組み立てる
  const boundary = "----=_Part_" + Math.random().toString(36).slice(2);
  const lines = [];
  lines.push(`To: ${to}`);
  lines.push(`Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`);
  lines.push("MIME-Version: 1.0");
  lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  lines.push("");
  // 本文（HTML）
  lines.push(`--${boundary}`);
  lines.push("Content-Type: text/html; charset=UTF-8");
  lines.push("Content-Transfer-Encoding: base64");
  lines.push("");
  lines.push(btoa(unescape(encodeURIComponent(htmlBody))));
  // 添付
  for (const att of attachments) {
    lines.push(`--${boundary}`);
    lines.push(`Content-Type: text/csv; charset=UTF-8; name="${att.filename}"`);
    lines.push("Content-Transfer-Encoding: base64");
    lines.push(`Content-Disposition: attachment; filename="${att.filename}"`);
    lines.push("");
    lines.push(btoa(unescape(encodeURIComponent(att.content))));
  }
  lines.push(`--${boundary}--`);
  return lines.join("\r\n");
}

function mimeToBase64Url(mime) {
  const utf8 = unescape(encodeURIComponent(mime));
  return btoa(utf8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sendMail({ to, subject, htmlBody, attachments }) {
  const token = getToken();
  if (!token || !token.access_token) throw new Error("未ログインです");
  const mime = buildMimeMessage({ to, subject, htmlBody, attachments });
  const raw = mimeToBase64Url(mime);

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail 送信エラー (${res.status}): ${text}`);
  }
  return res.json();
}
```

- [ ] **Step 2: 簡易動作確認（目視のみ、実送信はタスク14で行う）**

DevTools Console で以下を実行：
```javascript
const g = await import("./gmail.js");
console.log("isSignedIn:", g.isSignedIn());  // false のはず
```

OAuth クライアントID が未設定だと `signIn()` 実行時にエラーになるため、Task 16 の README 記載の手順でクライアントIDを `config.js` に設定してから本格テストする。このタスクではコードが構文エラーなくロードできることのみ確認。

- [ ] **Step 3: コミット**

```bash
git add gmail.js
git commit -m "feat(gmail): OAuth token client and MIME message send via Gmail API"
```

---

### Task 14: メール送信ボタンの統合（送信後に発注リストを自動クリア）

**Files:**
- Modify: `barcode-order/app.js`

- [ ] **Step 1: `app.js` の import に gmail.js を追加**

```javascript
import * as storage from "./storage.js";
import * as csv from "./csv.js";
import * as gmail from "./gmail.js";
```

- [ ] **Step 2: 認証UIの描画・配線関数を追加**

```javascript
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
```

- [ ] **Step 3: メール本文生成関数と送信処理を追加**

```javascript
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
```

- [ ] **Step 4: `wireActions()` に認証ボタンとメール送信の配線を追加**

```javascript
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
```

- [ ] **Step 5: `init()` に `renderAuthStatus()` を追加**

```javascript
function init() {
  wireActions();
  renderAuthStatus();
  renderOrderList();
}
```

- [ ] **Step 6: 動作確認（OAuth 設定が済んでいない場合はボタンの見た目だけ確認）**

- ヘッダーに「未ログイン」「ログイン」ボタンが表示
- メール送信ボタンは発注リストが空のとき disabled、行があれば enabled
- OAuth クライアント未設定ならログイン試行でエラー表示 → Task 16 のセットアップ後に再テスト

- [ ] **Step 7: コミット**

```bash
git add app.js
git commit -m "feat(app): Gmail send integration with auto-clear on success"
```

---

### Task 15: PWA（manifest.json + アイコン）

**Files:**
- Create: `barcode-order/manifest.json`
- Create: `barcode-order/icon-192.png`（後述）
- Create: `barcode-order/icon-512.png`（後述）

- [ ] **Step 1: `manifest.json` を作成**

```json
{
  "name": "バーコード発注",
  "short_name": "発注",
  "start_url": "./",
  "display": "standalone",
  "background_color": "#f4f5f7",
  "theme_color": "#1f6feb",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 2: 仮アイコンを配置**

スマホのホーム画面に追加したときの見た目用に、最小限のアイコンを用意する。以下のいずれかで対応：

**選択肢A: 既成の単色アイコンを作成**

`icon-gen.html` を一時作成し、キャンバスで出力 → 右クリック保存で `icon-192.png` `icon-512.png` を作る。もしくは、青背景に「発」の字を配置した PNG をペイントアプリで作成してもよい。

※ このタスクでは「仮でも動く PNG が 2 枚ある」ことが目的。アイコンは後から差し替え可能。

**選択肢B: 暫定で manifest から icons を外す**

アイコン準備は後回しにして、`manifest.json` の `icons` を `[]` にする。PWA インストールの見栄えは悪くなるが機能には影響しない。

どちらかを選択して反映する（推奨は A）。

- [ ] **Step 3: 動作確認**

- ブラウザで `http://localhost:8000/` を開き、DevTools の Application タブ → Manifest に警告がないか確認
- スマホで開いて「ホーム画面に追加」が機能するかは Task 16 の実機テストで確認

- [ ] **Step 4: コミット**

```bash
git add manifest.json icon-192.png icon-512.png
git commit -m "feat: add PWA manifest and icons"
```

（選択肢Bを取った場合は PNG を外す）

---

### Task 16: README に OAuth セットアップ手順を記載 + 実機テスト

**Files:**
- Modify: `barcode-order/README.md`

- [ ] **Step 1: `README.md` を拡充**

```markdown
# barcode-order

スマホカメラでバーコードを読み取り、発注リストを作成して Gmail でメール送信する個人向け Web アプリ。

## 機能

- スマホカメラでバーコード（JAN/EAN-13）読み取り
- 商品マスタ（JAN → 品名・発注先）の自動引き当て
- 発注先マスタの追加・編集・並び替え・削除（使用中は削除不可）
- 同じ商品を連続スキャンで数量 +1
- Gmail API で自分宛にメール送信（発注先ごとの CSV を添付、本文に発注サイトへのリンク）
- データはブラウザの localStorage に保存（サーバー不要）

## 開発サーバーの起動

```
cd barcode-order
python3 -m http.server 8000
```

`http://localhost:8000/` にアクセス。

## セットアップ手順（Google OAuth）

Gmail 送信機能を使うには、Google Cloud Console で OAuth クライアントID を取得して `config.js` に設定する必要があります。以下の手順は初回のみ行います（所要時間 10-15 分）。

### 1. Google Cloud プロジェクトを作成

1. https://console.cloud.google.com/ にアクセス
2. プロジェクトを作成（プロジェクト名は任意、例: `barcode-order`）

### 2. Gmail API を有効化

1. 左メニュー「APIとサービス」→「ライブラリ」
2. 「Gmail API」を検索して有効化

### 3. OAuth 同意画面を設定

1. 「APIとサービス」→「OAuth 同意画面」
2. ユーザータイプ: **外部** を選択
3. アプリ名、サポートメール等を入力（自分のメールでOK）
4. スコープは特に追加不要（次ステップで必要分を指定）
5. テストユーザーに自分のメールアドレスを追加
6. 公開ステータスは「テスト」のまま（本人だけが使えれば十分）

### 4. OAuth クライアントID を作成

1. 「APIとサービス」→「認証情報」→「＋ 認証情報を作成」→「OAuthクライアントID」
2. アプリの種類: **ウェブアプリケーション**
3. 承認済みの JavaScript 生成元:
   - 開発時: `http://localhost:8000`
   - 本番（例 GitHub Pages）: `https://<your-username>.github.io` も追加
4. 作成後に表示されるクライアントID（`XXXXXXX.apps.googleusercontent.com`）をコピー

### 5. `config.js` にクライアントID を設定

```bash
cp config.sample.js config.js
# エディタで config.js を開き、GOOGLE_OAUTH_CLIENT_ID に先ほどコピーした値を貼り付け
```

### 6. 動作確認

1. 開発サーバーを再起動
2. ブラウザでアクセス → 「ログイン」ボタン → Google アカウント選択 → 権限承認
3. 発注リストに行を追加 → 「メール送信」 → 自分の Gmail に CSV 添付メールが届く

## 本番デプロイ（GitHub Pages）

1. リポジトリの Settings → Pages → Branch `main` / `/ (root)` を選択
2. 発行された URL（例 `https://<user>.github.io/barcode-order/`）
3. Google OAuth クライアントID の「承認済み JavaScript 生成元」にこの URL を追加
4. スマホから `https://` URL にアクセスしてカメラが起動することを確認

## データ削除

ブラウザの開発者ツール → Application → Local Storage → 該当 origin の `barcode-order:*` キーを削除すると、商品マスタ・発注先マスタ・発注リストがリセットされます。
```

- [ ] **Step 2: 実機テスト**

以下の順で確認（問題があれば該当タスクに戻って修正）：

1. Mac 上のブラウザで全機能動作チェック（Task 2-14 の動作確認を一通り再実施）
2. OAuth クライアントID を設定してログイン → 自分宛メール送信 → Gmail 受信箱に届くことを確認
3. GitHub Pages 等で https デプロイ
4. スマホ（iPhone Safari / Android Chrome）からアクセス
5. カメラ許可 → バーコードスキャン
6. 実商品のバーコードで一連の動作（スキャン → 登録 → 送信）を通す

- [ ] **Step 3: コミット**

```bash
git add README.md
git commit -m "docs: add OAuth setup instructions and deployment guide"
git push
```

---

## 完了条件

- すべてのタスクの動作確認が通っている
- `test.html` のテストがすべて pass
- 実機でバーコードスキャン〜メール送信まで一連で動作する
- README の手順に沿って、未経験者でもセットアップできる状態になっている
