# 発注カート自動投入 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** barcode-order が Gmail 送信した発注メールを起点に、Claude が普段使いの Chrome を直接操作して各発注先サイトのカートに商品を投入する仕組みを作る（決済ボタンはユーザーが手動で押す）。

**Architecture:** スクリプトを書かず Claude 本体が Claude for Chrome MCP と Gmail MCP を駆動する方式。発注先名 → サイト URL のマッピングを `barcode-order/supplier-sites.json` に静的データとして持ち、起動トリガーと操作手順を `.claude/skills/order/SKILL.md` に skill として定義する。`/order` スラッシュコマンドおよび「発注やって」「カート投入して」等の自然言語で発火する。

**Tech Stack:** JSON データファイル + Claude Code skill (Markdown + frontmatter)。実行時は Claude for Chrome MCP (`mcp__Claude_in_Chrome__*`) と Gmail MCP (`mcp__63a04c78-72a3-4858-b7a3-e9e66ec9346b__*`) を使用。

**Spec:** `docs/superpowers/specs/2026-04-26-cart-automation-design.md`

---

## ファイル変更マップ

| ファイル | 変更内容 |
| --- | --- |
| `barcode-order/supplier-sites.json` | 新規作成。発注先名 → サイト URL のマッピング |
| `.claude/skills/order/SKILL.md` | 新規作成。`/order` 起動の skill 定義と操作手順 |
| `barcode-order/README.md` | 「発注カート自動投入」セクションを追記 |

## タスク一覧

- Task 1: `barcode-order/supplier-sites.json` を作成（初期マッピング）
- Task 2: `.claude/skills/order/` ディレクトリと `SKILL.md` を作成
- Task 3: `barcode-order/README.md` に発注カート自動投入セクションを追記
- Task 4: `/order` skill の発火確認（dry run 手前まで）
- Task 5: 小規模ドライラン（1 発注先・3〜5 件）

---

### Task 1: 発注先サイトマッピング JSON を作成

**Files:**
- Create: `/Users/yo-chan/アプリ/barcode-order/supplier-sites.json`

- [ ] **Step 1: JSON ファイルを作成**

`/Users/yo-chan/アプリ/barcode-order/supplier-sites.json` に以下の内容を書く。barcode-order の `storage.js` `DEFAULT_SUPPLIERS` と同じ 4 件を初期登録する。

```json
{
  "アスクル": "https://www.askul.co.jp/",
  "カウネット": "https://www.kaunet.com/",
  "Amazon": "https://www.amazon.co.jp/",
  "シンリョウ": "https://www.shinryo.jp/"
}
```

- [ ] **Step 2: JSON 構文チェック**

Run:
```bash
python3 -c "import json; json.load(open('/Users/yo-chan/アプリ/barcode-order/supplier-sites.json'))" && echo OK
```
Expected: `OK`

- [ ] **Step 3: コミット**

```bash
cd /Users/yo-chan/アプリ/barcode-order
git add supplier-sites.json
git commit -m "feat: add supplier-sites.json for cart automation site mapping"
```

---

### Task 2: `/order` skill を作成

**Files:**
- Create: `/Users/yo-chan/アプリ/.claude/skills/order/SKILL.md`

- [ ] **Step 1: skill ディレクトリを作成**

Run:
```bash
mkdir -p /Users/yo-chan/アプリ/.claude/skills/order
```

- [ ] **Step 2: `SKILL.md` を作成**

`/Users/yo-chan/アプリ/.claude/skills/order/SKILL.md` に以下を書く。frontmatter の `description` には自然言語トリガーフレーズを含める。

````markdown
---
name: order
description: barcode-order アプリの発注メール（Gmail）から CSV を取得し、Claude for Chrome 経由で各発注先サイトのカートに商品を自動投入する。「発注やって」「カート投入して」「カート入れて」「発注処理」などの依頼で発火。決済ボタンはユーザーが手動で押すため、すべてのタブはカート画面で停止させる。
---

# 発注カート自動投入手順

barcode-order が送信した発注メールを起点に、各発注先サイトのカートに商品を投入する。**決済操作は絶対に行わない** — カート画面で停止し、ユーザーが手動で決済する。

## 前提

- ユーザーの普段使いの Chrome に `Claude for Chrome` 拡張がインストールされており、`mcp__Claude_in_Chrome__*` ツールが使える。
- ユーザーの Gmail に `mcp__63a04c78-72a3-4858-b7a3-e9e66ec9346b__*` でアクセスできる。
- ユーザーは各発注先サイトに事前にログイン済み。

## 手順

### 1. 最新の発注メールを取得

Gmail を以下のクエリで検索:
```
from:me 発注リスト has:attachment
```
件名は `[{店舗名}] 発注リスト YYYY-MM-DD HH:MM` の形式。最新 1 件を取得する。

該当メールが見つからない場合、ユーザーに「最新の発注メールが見つからない。期間や件名を絞れる？」と確認して停止。

### 2. 添付 CSV を取得・パース

メールの全添付ファイル（複数の CSV）を取得。

各 CSV について:
- ファイル名 `order-{店舗}-{発注先}-YYYYMMDD-HHMM.csv` の **3 番目のセグメント** を発注先名として抽出。
- 中身は BOM 付き UTF-8 / CRLF 改行 / ヘッダ `品名,数量,JANコード`。
- データ行を `[{name, quantity, jan}]` の配列に変換。

### 3. 発注先 → サイト URL マッピング

`/Users/yo-chan/アプリ/barcode-order/supplier-sites.json` を読み、発注先名から URL を引く。

未知の発注先（JSON にない）に遭遇した場合:
1. ユーザーに「『◯◯』のサイト URL を教えて」と確認。
2. 受け取った URL を JSON に追記して保存。
3. 処理を続行。

### 4. 発注先ごとの処理

発注先のリストを順番に処理する。各発注先について:

#### 4.1 新規タブで対象サイトを開く

`mcp__Claude_in_Chrome__navigate` または `tabs_create_mcp` で URL を新規タブで開く。

#### 4.2 ログイン状態を確認

ヘッダ・マイアカウント表示などを `find` で読み、ログイン済みかチェック。未ログインの場合:
1. その発注先の処理を停止。
2. ユーザーに「{サイト} が未ログイン状態。Chrome 上でログインしてから『続けて』と言って」と通知。
3. ユーザーが「続けて」と発話したら、その発注先から再開。

#### 4.3 各 CSV 行を処理

CSV の各行（`{name, quantity, jan}`）について以下を実行:

**第 1 段階: JAN コード検索**
1. サイトの検索ボックスに 13 桁の JAN コードを入力 → 検索実行。
2. 検索結果を読む:
   - ヒット 1 件のみ → その商品を採用 (4.4 へ)。
   - ヒット複数件 → 第 3 段階。
   - ヒット 0 件 → 第 2 段階。

**第 2 段階: 品名検索（フォールバック）**
1. 検索ボックスに CSV の `name`（品名）を入力 → 検索実行。
2. 検索結果から:
   - JAN コードが完全一致する商品があれば採用 (4.4 へ)。
   - JAN 一致がなく、品名が CSV の `name` と完全一致する商品があれば採用 (4.4 へ)。
   - それ以外は第 3 段階。

**第 3 段階: 判別不能 → スキップ**
- カート投入は行わない。
- 「{発注先}: 「{品名}」 (JAN {jan}) — {ヒット無し / 複数候補で判別不能}」をレポートバッファに記録。
- 次の行へ。

**重要: 「複数候補のうち先頭を選ぶ」「価格や名称の近さで自動判定」など曖昧な自動選択は絶対にしない。** 誤発注のリスクが大きいため、判別不能は必ずスキップ。

#### 4.4 採用商品をカート投入

1. 商品ページに遷移、または検索結果から数量入力可能な箇所に移動。
2. 数量を CSV の `quantity` に設定。
3. 「カートに追加」相当のボタンをクリック。
4. カート追加成功を確認（成功メッセージ・カート件数更新等）。
5. 失敗した場合は第 3 段階と同じくスキップしてレポート記録、次行へ。

在庫切れ・販売終了商品はヒット 0 件と同じ扱いでスキップ。

#### 4.5 発注先処理の終了

CSV の全行を処理し終えたら、その発注先のタブをカート画面に遷移させて停止。次の発注先の処理（4.1 から）へ。

### 5. 進捗の逐次表示

処理中、ターミナルに以下の形式で逐次表示する。

```
[1/3] Amazon の処理開始 (5件)
  ✓ 「コクヨ ノート キャンパス A4」 (JAN 4901234567890) → カート投入 (数量1)
  ✓ 「ぺんてる ボールペン 0.7mm」 (JAN 4902345678901) → カート投入 (数量2)
  ✗ 「ぺんてる ボールペン 0.5mm」 (JAN 4903456789012) → ヒット無し、品名でも見つからずスキップ
  ...
  Amazon 完了: 4/5 件投入
```

### 6. 最終レポート

全発注先の処理が完了したら、以下の形式で総括を表示する。

```
=== 発注処理完了 ===

✅ カート投入完了:
  - {発注先}: {成功件数}件
  ...

⚠️ 手動対応が必要:
  - {発注先}: 「{品名}」 (JAN {jan}) — {理由}
  ...

各タブのカート画面が開いています。内容を確認して決済ボタンを押してください。
```

「手動対応が必要」リストには **必ず商品名・JAN コード・スキップ理由** を含める。何が頼まれて何がヒットしなかったのかが一目で分かるようにする。

## エラーハンドリング

| 状況 | 対応 |
|---|---|
| Gmail に該当メールが見つからない | 停止し、件名・期間絞り込みをユーザーに確認 |
| サイト未ログイン | その発注先のみ停止、ユーザーに通知、「続けて」で再開 |
| ページ構造が想定と違う | 行をスキップしてレポート記録、次行へ |
| サイト全体が重い・落ちている | 発注先 1 つを丸ごとスキップ、レポート記録 |
| Cookie 同意・通知許可ポップアップ | 明らかな同意系のみ閉じる。判断できないものは停止して確認 |
| 1 件あたり 1 分以上かかる | タイムアウトでスキップ、レポート記録 |
| Claude for Chrome が応答しない | 停止、拡張機能の状態確認をユーザーに依頼 |

「続けて」コマンド: 一時停止後にユーザーが「続けて」と言ったら、停止地点から再開する。

## 絶対にやってはいけないこと

- 決済ボタンを押す（カート投入までで停止）。
- 判別不能な検索結果から「適当に 1 件目」を選ぶ。
- ユーザーの確認なしに発注先サイトをログアウトする。
- カート以外の操作（住所変更、支払い情報変更など）を行う。
````

- [ ] **Step 3: frontmatter の構文チェック**

Run:
```bash
python3 -c "
import re, sys
with open('/Users/yo-chan/アプリ/.claude/skills/order/SKILL.md') as f:
    content = f.read()
m = re.match(r'^---\n(.*?)\n---\n', content, re.DOTALL)
assert m, 'frontmatter not found'
fm = m.group(1)
assert 'name: order' in fm, 'name field missing or wrong'
assert 'description:' in fm, 'description field missing'
print('OK')
"
```
Expected: `OK`

- [ ] **Step 4: コミット**

skill ディレクトリは `/Users/yo-chan/アプリ/` 直下の `.claude/` 配下なので、barcode-order リポジトリには含まれない。`/Users/yo-chan/アプリ/` が git リポジトリかどうかを確認:

Run:
```bash
cd /Users/yo-chan/アプリ && git rev-parse --is-inside-work-tree 2>&1
```

- リポジトリでない場合（`fatal: not a git repository`）: コミットせず、ファイルだけ残す。後でユーザーが必要に応じて初期化する。
- リポジトリの場合: `.claude/skills/order/SKILL.md` を `git add` して `git commit -m "feat(skill): add /order skill for cart automation"` する。

---

### Task 3: README に発注カート自動投入セクションを追記

**Files:**
- Modify: `/Users/yo-chan/アプリ/barcode-order/README.md`（末尾に追記）

- [ ] **Step 1: 既存 README の末尾を確認**

Read: `/Users/yo-chan/アプリ/barcode-order/README.md`

末尾のセクション（「ファイル構成」表）の直後に新セクションを追加する位置を確認する。

- [ ] **Step 2: README 末尾に追記**

`/Users/yo-chan/アプリ/barcode-order/README.md` の末尾に以下のセクションを追記する。

```markdown

## 発注カート自動投入（Claude 連携）

このアプリが Gmail に送った発注メールを起点に、Claude が Chrome を直接操作して各発注先サイトのカートに商品を投入する仕組みを用意している。決済ボタンはユーザーが手動で押す。

### 仕組み

- Claude Code から `/order` を実行（または「発注やって」等の自然言語で発火）
- Claude が Gmail から最新の発注メールを取得 → 添付 CSV をパース
- `supplier-sites.json` の発注先 → サイト URL マッピングをもとに、各発注先サイトを新規タブで開く
- JAN コード検索 → 品名フォールバックの順で商品を特定し、数量を設定してカートに追加
- 判別不能な商品はスキップしてレポート記録
- 全発注先処理後、各タブはカート画面で停止し、ユーザーが決済ボタンを押す

### 必要なもの

- Chrome に [Claude for Chrome](https://www.anthropic.com/claude-for-chrome) 拡張がインストール済み
- Gmail MCP が Claude Code から接続できる状態
- 各発注先サイトにあらかじめログイン済み

### マッピングファイル

`supplier-sites.json` に発注先名 → サイト URL を保持。barcode-order の発注先マスタとは別管理（手動で同期）。未知の発注先は実行時に Claude が確認して追記する。

### 設計・実装計画

- 設計: `docs/superpowers/specs/2026-04-26-cart-automation-design.md`
- 実装計画: `docs/superpowers/plans/2026-04-26-cart-automation.md`
```

- [ ] **Step 3: コミット**

```bash
cd /Users/yo-chan/アプリ/barcode-order
git add README.md
git commit -m "docs: README section for cart automation feature"
```

---

### Task 4: `/order` skill の発火確認

**Files:** なし（動作確認のみ）

- [ ] **Step 1: ユーザーに新セッションでの確認を依頼**

実装計画の中で skill を新規作成しているが、現在のセッションでは skill リストに反映されない可能性があるため、ユーザーに以下を依頼する:

「新しい Claude Code セッションを起動して、`/order` または『発注やって』と入力してみてください。skill が起動して『発注メールを Gmail から取得します...』のような応答が返れば成功です。」

- [ ] **Step 2: 起動できなかった場合のトラブルシューティング**

skill が認識されない場合、以下を確認:
- `/Users/yo-chan/アプリ/.claude/skills/order/SKILL.md` のパスが正しい
- frontmatter の `name:` と `description:` が両方ある
- Claude Code が `/Users/yo-chan/アプリ/` で起動されている（このプロジェクトの skill は `.claude/skills/` に置かれているため）

該当が解消されたら再度起動確認。

- [ ] **Step 3: 起動成功**

skill が呼び出され、Claude が発注メール取得の手順に入ろうとしたら成功。実際の Gmail / Chrome 操作はこの段階では走らせず、ユーザーに「ここで止めてOK」と伝えて中断する（次タスクでドライラン）。

---

### Task 5: 小規模ドライラン

**Files:** なし（実運用確認）

- [ ] **Step 1: ユーザーに小規模バッチの準備を依頼**

ユーザーに以下を依頼:
1. barcode-order アプリで **1 発注先・3〜5 件** の小さい発注リストを作る。
2. メール送信を実行（実際に Gmail に送信される）。
3. 各発注先サイト（特に対象になる 1 サイト）にあらかじめ Chrome でログインしておく。

- [ ] **Step 2: `/order` を実行**

ユーザーが Claude Code で `/order` を実行する。Claude が以下を行うことを確認:
- Gmail から最新の発注メールを取得できる。
- 添付 CSV をパースし、対象発注先の URL をマッピングから引ける。
- Chrome に新規タブで対象サイトを開ける。
- ログイン状態を確認できる。
- 各 CSV 行について JAN 検索 → カート投入を実行できる。
- 全行処理後、カート画面で停止する。
- 最終レポートを表示する。

- [ ] **Step 3: 結果のレビュー**

ユーザーと一緒に以下を確認:
- カートの中身が CSV の品名・数量と一致しているか。
- スキップされた行があれば、レポートに商品名・JAN・理由が正しく記録されているか。
- タブが意図せず決済画面に進んでいないか。

問題があれば原因を特定し、SKILL.md の手順を更新（ヒットしないサイト固有の挙動など）。

- [ ] **Step 4: 通常運用への移行**

ドライランで問題がなければ、以後は通常の発注フロー（複数発注先の発注メール → `/order` 実行）で運用する。
