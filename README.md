# barcode-order

スマホカメラでバーコードを読み取り、発注リストを作成して Gmail でメール送信する個人向け Web アプリ。

## 機能

- スマホカメラでバーコード（JAN/EAN-13）読み取り
- 商品マスタ（JAN → 品名・発注先）の自動引き当て
- 発注先マスタの追加・編集・並び替え・削除（使用中は削除不可）
- 同じ商品を連続スキャンで数量 +1
- GAS Web App 経由で固定アドレスにメール送信（発注先ごとの CSV を添付、本文に発注サイトへのリンク）
- スタッフ側は Google ログイン不要（管理者がデプロイした GAS のアカウントから送信される）
- データはブラウザの localStorage に保存（サーバー不要）

## 開発サーバーの起動

```
cd barcode-order
python3 -m http.server 8000
```

`http://localhost:8000/` にアクセス。

## セットアップ手順（GAS Web App）

メール送信は Google Apps Script (GAS) の Web App 経由で行います。スタッフ側は Google ログイン不要、管理者だけが一度 GAS をデプロイすれば全員が使えます。所要時間 5〜10 分。

### 1. Apps Script プロジェクトを作成

1. https://script.google.com/ にアクセス
2. 「新しいプロジェクト」→ 既存の `Code.gs` の内容を全削除
3. リポジトリの `gas/Code.gs` の中身を貼り付け
4. `SHARED_SECRET` を任意の長いランダム文字列に変更（後でフロント側にも同じ値を入れる）
5. プロジェクト名を分かりやすく変更（例: `barcode-order-mailer`）して保存

### 2. Web App としてデプロイ

1. 右上「デプロイ」→「新しいデプロイ」
2. 種類: **ウェブアプリ**
3. 設定:
   - 説明: `barcode-order v1`（任意）
   - 次のユーザーとして実行: **自分**
   - アクセスできるユーザー: **全員**
4. 「デプロイ」→ 初回はGoogleアカウントの認可確認が出るので承認
5. 表示された Web App URL（`https://script.google.com/macros/s/.../exec`）をコピー

### 3. `config.js` を設定

```bash
cp config.sample.js config.js
# config.js をエディタで開いて以下を設定
#   GAS_WEB_APP_URL    = 上でコピーした URL
#   GAS_SHARED_SECRET  = Code.gs と同じ文字列
#   RECIPIENT_EMAIL    = 発注メールの送信先
```

### 4. 動作確認

1. 開発サーバーを再起動
2. 発注リストに行を追加 → 「メール送信」
3. 設定した送信先に CSV 添付メールが届けばOK（送信元はあなたのGoogleアカウント）

### コードを更新したとき

GAS のコードを直したら「デプロイを管理」→ 該当デプロイの鉛筆アイコン → バージョン: 「新しいバージョン」→「デプロイ」。**URLは変わりません。**「新しいデプロイ」を選ぶとURLが変わってフロントが動かなくなるので注意。

## 本番デプロイ（GitHub Pages）

1. リポジトリの Settings → Pages → Branch `main` / `/ (root)` を選択
2. 発行された URL（例 `https://<user>.github.io/barcode-order/`）
3. スマホから `https://` URL にアクセスしてカメラが起動することを確認

GAS Web App は全員アクセス可なので、フロントの URL を OAuth 側で許可する設定は不要。

## データ削除

ブラウザの開発者ツール → Application → Local Storage → 該当 origin の `barcode-order:*` キーを削除すると、商品マスタ・発注先マスタ・発注リストがリセットされます。

## テスト

純粋ロジック（storage, csv）のテストは `test.html` をブラウザで開くと自動実行されます。DevTools Console または画面上の出力でパス/失敗を確認できます。

## ファイル構成

| ファイル | 責務 |
| --- | --- |
| `index.html` | メイン画面のマークアップ |
| `styles.css` | スタイル |
| `storage.js` | localStorage 操作（商品・発注先・発注リスト・店舗・履歴） |
| `csv.js` | 発注先ごとの CSV 生成 |
| `mailer.js` | GAS Web App への送信リクエスト |
| `app.js` | DOM 操作・イベントハンドラ・モジュール連携 |
| `test.html` | storage/csv の簡易テスト |
| `config.js` | GAS Web App URL / 共有シークレット / 送信先 |
| `config.sample.js` | config のひな形 |
| `gas/Code.gs` | Apps Script に貼り付ける Web App 本体 |
| `manifest.json` | PWA 設定 |
| `supplier-sites.json` | Claude 連携用：発注先名 → サイト URL マッピング |

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
