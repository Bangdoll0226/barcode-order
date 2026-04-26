# 発注履歴機能 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** メール送信時に発注リストを履歴として自動保存し、アプリ上で過去10件分の履歴を閲覧・復元できるようにする。

**Architecture:** 既存パターンに沿って `storage.js` に履歴 CRUD（addHistoryEntry / getHistory）を追加。`app.js` の `handleSendEmail` で送信成功時に履歴保存を挟む。新たに「発注履歴を見る」ボタンを操作エリアに追加し、一覧モーダル + 詳細モーダル + 復元ロジック（上書き/追加）を実装する。

**Tech Stack:** 既存と同じ（HTML5 + ES Modules + Vanilla JavaScript + localStorage）

**Spec:** `docs/superpowers/specs/2026-04-24-order-history-design.md`

---

## ファイル変更マップ

| ファイル | 変更内容 |
| --- | --- |
| `storage.js` | `addHistoryEntry({store, lines})` と `getHistory(storeName)` を追加。KEYS に `history` 追加 |
| `test.html` | 履歴 CRUD のテストを追加 |
| `index.html` | 操作エリアに「発注履歴を見る」ボタン追加 |
| `app.js` | `handleSendEmail` に履歴保存を追加。新規関数: `openHistoryListModal` / `openHistoryDetailModal` / `restoreHistoryEntry` / `openRestoreModeDialog`。`wireActions` にボタン listener 追加 |

## タスク一覧

- Task 1: `storage.js` に履歴 CRUD を追加（TDD）
- Task 2: `handleSendEmail` に履歴保存を追加
- Task 3: `index.html` に「発注履歴を見る」ボタン追加 + `app.js` 履歴一覧モーダル
- Task 4: `app.js` 履歴詳細モーダル + 復元ロジック（上書き/追加）
- Task 5: デプロイ検証

---

### Task 1: `storage.js` に履歴 CRUD を追加（TDD）

**Files:**
- Modify: `barcode-order/storage.js` (KEYS 拡張 + 関数追記)
- Modify: `barcode-order/test.html` (テスト追記)

- [ ] **Step 1: `test.html` に履歴のテストを追加**

`/Users/yo-chan/アプリ/barcode-order/test.html` の以下の行を見つける（store の最後の assertion）：

```javascript
    storage.setCurrentStore(null);
    assertEq(storage.getCurrentStore(), null, "stores: setCurrentStore null clears");
```

その**直後**、`// --- csv ---` コメントの**前**に、以下を挿入：

```javascript
    // --- history ---
    clearStorage();
    assertEq(storage.getHistory("A店"), [], "history: empty by default");

    storage.addHistoryEntry({
      store: "A店",
      lines: [
        { barcode: "1", name: "x", quantity: 2, supplier: "アスクル" },
      ],
    });
    const h1 = storage.getHistory("A店");
    assertEq(h1.length, 1, "history: addHistoryEntry adds one");
    assertEq(h1[0].store, "A店", "history: entry has store");
    assertEq(h1[0].lines.length, 1, "history: entry has lines");
    assertEq(typeof h1[0].id, "string", "history: entry has id");
    assertEq(typeof h1[0].sentAt, "string", "history: entry has sentAt");

    // 別店舗のエントリは分離される
    storage.addHistoryEntry({ store: "B店", lines: [{ barcode: "2", name: "y", quantity: 1, supplier: "Amazon" }] });
    assertEq(storage.getHistory("A店").length, 1, "history: B店 add does not affect A店");
    assertEq(storage.getHistory("B店").length, 1, "history: B店 has its own entry");

    // 11件追加で最古が消える
    clearStorage();
    for (let i = 0; i < 12; i++) {
      storage.addHistoryEntry({
        store: "A店",
        lines: [{ barcode: String(i), name: `item${i}`, quantity: 1, supplier: "アスクル" }],
      });
    }
    const h2 = storage.getHistory("A店");
    assertEq(h2.length, 10, "history: cap at 10 per store");
    // 新しい順なので h2[0] は最新（item11）、h2[9] は item2（item0/item1 が消える）
    assertEq(h2[0].lines[0].name, "item11", "history: newest first (item11)");
    assertEq(h2[9].lines[0].name, "item2", "history: oldest kept is item2");

    // 別店舗の上限は独立
    clearStorage();
    for (let i = 0; i < 11; i++) {
      storage.addHistoryEntry({ store: "A店", lines: [{ barcode: String(i), name: `a${i}`, quantity: 1, supplier: "アスクル" }] });
    }
    storage.addHistoryEntry({ store: "B店", lines: [{ barcode: "x", name: "bx", quantity: 1, supplier: "Amazon" }] });
    storage.addHistoryEntry({ store: "B店", lines: [{ barcode: "y", name: "by", quantity: 1, supplier: "Amazon" }] });
    storage.addHistoryEntry({ store: "B店", lines: [{ barcode: "z", name: "bz", quantity: 1, supplier: "Amazon" }] });
    assertEq(storage.getHistory("A店").length, 10, "history: A店 still capped at 10");
    assertEq(storage.getHistory("B店").length, 3, "history: B店 has 3 (independent cap)");
```

- [ ] **Step 2: テストを実行して FAIL を確認**

開発サーバーを起動：
```bash
cd /Users/yo-chan/アプリ/barcode-order
python3 -m http.server 8000 > /tmp/http.log 2>&1 &
echo $! > /tmp/http.pid
```

ブラウザで `http://localhost:8000/test.html` を開く。
Expected: `storage.getHistory is not a function` 等のエラーで FAIL。

- [ ] **Step 3: `storage.js` の KEYS 定数を拡張**

`/Users/yo-chan/アプリ/barcode-order/storage.js` の KEYS を：

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

以下に置き換える（`history` を追加）：

```javascript
const KEYS = {
  products: "barcode-order:products",
  suppliers: "barcode-order:suppliers",
  order: "barcode-order:order",
  token: "barcode-order:gmail_token",
  stores: "barcode-order:stores",
  current_store: "barcode-order:current_store",
  history: "barcode-order:history",
};
```

- [ ] **Step 4: `storage.js` の末尾に履歴関数を追記**

`/Users/yo-chan/アプリ/barcode-order/storage.js` の末尾に追記：

```javascript

// --- 発注履歴（[{id, sentAt, store, lines}]） ---
const HISTORY_MAX_PER_STORE = 10;

function getAllHistory() {
  return readJson(KEYS.history, []);
}

export function addHistoryEntry({ store, lines }) {
  const all = getAllHistory();
  all.push({
    id: newId(),
    sentAt: new Date().toISOString(),
    store,
    lines,
  });
  // 該当店舗の件数が上限を超えたら、その店舗の最古エントリを削除
  const sameStoreEntries = all
    .filter(e => e.store === store)
    .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  while (sameStoreEntries.length > HISTORY_MAX_PER_STORE) {
    const oldest = sameStoreEntries.shift();
    const idx = all.findIndex(e => e.id === oldest.id);
    if (idx !== -1) all.splice(idx, 1);
  }
  writeJson(KEYS.history, all);
}

export function getHistory(storeName) {
  return getAllHistory()
    .filter(e => e.store === storeName)
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
}
```

注意: `newId()` は既存の関数（既に `storage.js` 内で定義済み、order line の id 生成に使われている）を再利用する。

- [ ] **Step 5: 構文チェック + テストパス確認**

```bash
node --check /Users/yo-chan/アプリ/barcode-order/storage.js && echo "storage.js syntax OK"
```

ブラウザで `test.html` をリロード。出力末尾に新しい件数が出て、すべて `0 failed`。

- [ ] **Step 6: 開発サーバー停止 + コミット**

```bash
if [ -f /tmp/http.pid ]; then kill $(cat /tmp/http.pid) 2>/dev/null; rm /tmp/http.pid; fi

cd /Users/yo-chan/アプリ/barcode-order
git add storage.js test.html
git commit -m "feat(storage): order history CRUD with per-store cap of 10"
```

---

### Task 2: `handleSendEmail` に履歴保存を追加

**Files:**
- Modify: `barcode-order/app.js`

- [ ] **Step 1: `handleSendEmail` を更新して送信成功時に履歴を保存**

`/Users/yo-chan/アプリ/barcode-order/app.js` の既存の `handleSendEmail` 関数を：

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

以下に置き換える（送信成功後・clearOrder の**直前**に履歴保存を try/catch で挟む）：

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

    // 履歴に保存（id/addedAt は省略）
    try {
      storage.addHistoryEntry({
        store: storeName,
        lines: order.map(l => ({
          barcode: l.barcode,
          name: l.name,
          quantity: l.quantity,
          supplier: l.supplier,
        })),
      });
    } catch (e) {
      showToast("履歴の保存に失敗しました");
    }

    storage.clearOrder();
    renderOrderList();
    showToast("メールを送信しました。発注リストをクリアしました");
  } catch (e) {
    showToast(`送信失敗: ${e.message}`);
  }
}
```

- [ ] **Step 2: 構文チェック**

```bash
node --check /Users/yo-chan/アプリ/barcode-order/app.js && echo "app.js syntax OK"
```

- [ ] **Step 3: コミット**

```bash
cd /Users/yo-chan/アプリ/barcode-order
git add app.js
git commit -m "feat(app): save order to history on successful email send"
```

---

### Task 3: 「発注履歴を見る」ボタン + 履歴一覧モーダル

**Files:**
- Modify: `barcode-order/index.html`
- Modify: `barcode-order/app.js`

- [ ] **Step 1: `index.html` の操作エリアにボタン追加**

`/Users/yo-chan/アプリ/barcode-order/index.html` の以下のセクションを：

```html
    <section class="actions-section">
      <button id="send-email-btn" type="button" disabled>メール送信</button>
      <button id="clear-order-btn" type="button">リストをクリア</button>
      <button id="manage-products-btn" type="button">商品マスタを管理</button>
      <button id="manage-suppliers-btn" type="button">発注先マスタを管理</button>
      <button id="manage-stores-btn" type="button">店舗マスタを管理</button>
    </section>
```

以下に置き換える（末尾に「発注履歴を見る」を追加）：

```html
    <section class="actions-section">
      <button id="send-email-btn" type="button" disabled>メール送信</button>
      <button id="clear-order-btn" type="button">リストをクリア</button>
      <button id="manage-products-btn" type="button">商品マスタを管理</button>
      <button id="manage-suppliers-btn" type="button">発注先マスタを管理</button>
      <button id="manage-stores-btn" type="button">店舗マスタを管理</button>
      <button id="show-history-btn" type="button">発注履歴を見る</button>
    </section>
```

- [ ] **Step 2: `app.js` に履歴一覧モーダル関数を追加**

`/Users/yo-chan/アプリ/barcode-order/app.js` の `// --- メール送信 ---` コメントの**直前**（`renderAuthStatus` ブロックの後あたり）に、新セクションとして以下を挿入：

```javascript

// --- 発注履歴 ---

function formatSentAt(iso) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${mo}-${dd} ${h}:${mi}`;
}

function openHistoryListModal() {
  const storeName = storage.getCurrentStore();
  if (!storeName) {
    showToast("店舗が選択されていません");
    return;
  }
  const entries = storage.getHistory(storeName);

  let bodyHtml;
  if (entries.length === 0) {
    bodyHtml = `
      <h3>発注履歴（${escapeHtml(storeName)}）</h3>
      <p class="empty">まだ履歴がありません</p>
      <div class="buttons">
        <button type="button" data-act="close">閉じる</button>
      </div>
    `;
  } else {
    const rows = entries.map((e, i) => `
      <div class="master-line">
        <div>
          <div style="font-weight: 600;">🕓 ${formatSentAt(e.sentAt)}</div>
          <div style="font-size: 12px; color: #777;">合計 ${e.lines.length}件</div>
        </div>
        <div></div>
        <button type="button" class="primary" data-act="detail" data-idx="${i}">詳細</button>
      </div>
    `).join("");
    bodyHtml = `
      <h3>発注履歴（${escapeHtml(storeName)}）</h3>
      <div>${rows}</div>
      <div class="buttons">
        <button type="button" data-act="close">閉じる</button>
      </div>
    `;
  }

  openModal(bodyHtml, (modal, close) => {
    modal.querySelector('[data-act="close"]').addEventListener("click", close);
    modal.querySelectorAll('[data-act="detail"]').forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-idx"), 10);
        const entry = entries[idx];
        close();
        openHistoryDetailModal(entry);
      });
    });
  });
}
```

- [ ] **Step 3: `wireActions()` にボタン listener を追加**

`wireActions()` 関数の末尾（`}` の直前）に以下を追加：

```javascript
  document.getElementById("show-history-btn").addEventListener("click", openHistoryListModal);
```

- [ ] **Step 4: スタブとして `openHistoryDetailModal` を仮置き**

Task 4 で正式実装するが、ここでは仮で「未実装トースト」を出すスタブを `openHistoryListModal` の**直前**に置く：

```javascript

function openHistoryDetailModal(entry) {
  showToast(`詳細表示は次のタスクで実装します（${entry.lines.length}件）`);
}
```

- [ ] **Step 5: 構文チェック**

```bash
node --check /Users/yo-chan/アプリ/barcode-order/app.js && echo "app.js syntax OK"
```

- [ ] **Step 6: コミット**

```bash
cd /Users/yo-chan/アプリ/barcode-order
git add index.html app.js
git commit -m "feat(app): order history list modal with empty/populated states"
```

---

### Task 4: 履歴詳細モーダル + 復元ロジック

**Files:**
- Modify: `barcode-order/app.js`

- [ ] **Step 1: スタブの `openHistoryDetailModal` を本実装に置き換え**

`/Users/yo-chan/アプリ/barcode-order/app.js` の Task 3 で作ったスタブ：

```javascript
function openHistoryDetailModal(entry) {
  showToast(`詳細表示は次のタスクで実装します（${entry.lines.length}件）`);
}
```

を以下に置き換える：

```javascript
function openHistoryDetailModal(entry) {
  const grouped = csv.groupBySupplier(entry.lines);
  const sections = Object.entries(grouped).map(([supplierName, lines]) => {
    const items = lines.map(l =>
      `<li>${escapeHtml(l.name)} × ${l.quantity}</li>`
    ).join("");
    return `
      <h4 style="margin: 8px 0 4px;">■ ${escapeHtml(supplierName)}（${lines.length}件）</h4>
      <ul style="margin: 0 0 8px 16px; padding: 0;">${items}</ul>
    `;
  }).join("");

  openModal(`
    <h3>発注詳細</h3>
    <p style="font-size: 12px; color: #555;">🕓 ${formatSentAt(entry.sentAt)}  🏪 ${escapeHtml(entry.store)}</p>
    <div>${sections}</div>
    <div class="buttons">
      <button type="button" data-act="close">閉じる</button>
      <button type="button" class="primary" data-act="restore">このリストを復元</button>
    </div>
  `, (modal, close) => {
    modal.querySelector('[data-act="close"]').addEventListener("click", close);
    modal.querySelector('[data-act="restore"]').addEventListener("click", () => {
      close();
      openRestoreModeDialog(entry);
    });
  });
}
```

- [ ] **Step 2: 復元方法選択ダイアログを追加**

`openHistoryDetailModal` の**直後**に以下を追加：

```javascript

function openRestoreModeDialog(entry) {
  openModal(`
    <h3>どう復元しますか？</h3>
    <ul style="font-size: 13px; padding-left: 20px; margin: 8px 0;">
      <li><strong>上書き</strong>: 現在のリストを破棄して履歴の内容に置き換え</li>
      <li><strong>追加</strong>: 現在のリストに履歴を追加（同じ商品は数量を合算）</li>
    </ul>
    <div class="buttons">
      <button type="button" data-act="cancel">キャンセル</button>
      <button type="button" data-act="append">追加</button>
      <button type="button" class="primary" data-act="overwrite">上書き</button>
    </div>
  `, (modal, close) => {
    modal.querySelector('[data-act="cancel"]').addEventListener("click", close);
    modal.querySelector('[data-act="append"]').addEventListener("click", () => {
      restoreHistoryEntry(entry, "append");
      close();
    });
    modal.querySelector('[data-act="overwrite"]').addEventListener("click", () => {
      restoreHistoryEntry(entry, "overwrite");
      close();
    });
  });
}
```

- [ ] **Step 3: 復元ロジック関数を追加**

`openRestoreModeDialog` の**直後**に以下を追加：

```javascript

function restoreHistoryEntry(entry, mode) {
  if (mode === "overwrite") {
    storage.clearOrder();
  }
  for (const line of entry.lines) {
    const existing = storage.findLineByBarcode(line.barcode);
    if (existing) {
      // 同じ JAN が現在のリストにある（追加モードでのみ起こる）→ 数量を加算
      for (let i = 0; i < line.quantity; i++) {
        storage.incrementQuantity(line.barcode);
      }
    } else {
      // 新規追加 → addOrderLine（quantity=1で初期化）→ 残りを incrementQuantity
      storage.addOrderLine({
        barcode: line.barcode,
        name: line.name,
        supplier: line.supplier,
      });
      for (let i = 0; i < line.quantity - 1; i++) {
        storage.incrementQuantity(line.barcode);
      }
    }
  }
  renderOrderList();
  const verb = mode === "overwrite" ? "復元" : "追加";
  showToast(`履歴を${verb}しました（${entry.lines.length}件）`);
}
```

- [ ] **Step 4: 構文チェック**

```bash
node --check /Users/yo-chan/アプリ/barcode-order/app.js && echo "app.js syntax OK"
```

- [ ] **Step 5: コミット**

```bash
cd /Users/yo-chan/アプリ/barcode-order
git add app.js
git commit -m "feat(app): history detail modal with overwrite/append restore"
```

---

### Task 5: デプロイ検証

**Files:**
- なし（push のみ）

- [ ] **Step 1: 全変更を push**

```bash
cd /Users/yo-chan/アプリ/barcode-order
git push
```

- [ ] **Step 2: GitHub Pages のビルド完了を確認**

```bash
gh api /repos/Bangdoll0226/barcode-order/pages/builds/latest --jq '{status, commit}'
```

`status: built` になるまで 1-2 分待つ。`commit` が最新の Task 4 コミット SHA であることを確認。

- [ ] **Step 3: 実機テストの受け入れ基準（ユーザーが実施）**

以下のシナリオをすべて通す：

1. スマホで https://bangdoll0226.github.io/barcode-order/ を開く
2. 数件発注 → メール送信 → 自動クリア
3. 「発注履歴を見る」 → 一覧モーダルが開き、たった今送信したエントリが1件見える
4. 「詳細」 → 発注先別グルーピングされた品目が表示される
5. 「このリストを復元」 → 「上書き / 追加 / キャンセル」ダイアログ
6. 一旦キャンセル
7. 別の商品を1件スキャンして発注リストに入れる
8. 履歴 → 詳細 →「追加」 → 既存の発注リストに過去の品目が合算される
9. 別の店舗（B店）に切り替える → 「発注履歴を見る」 → 「まだ履歴がありません」
10. 11回連続で送信（A店）→ 履歴一覧が10件のままで、最古が消えていることを確認

---

## 完了条件

- 5タスクすべてのコミット完了
- GitHub Pages 上で動作確認OK
- メール送信時に履歴に1件追加される
- 履歴一覧 → 詳細 → 復元のフローが動く
- 復元（上書き / 追加）が仕様通り動く
- 既存機能（マスタ管理・スキャン・送信）に regressions なし
