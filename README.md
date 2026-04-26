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

## テスト

純粋ロジック（storage, csv）のテストは `test.html` をブラウザで開くと自動実行されます。DevTools Console または画面上の出力でパス/失敗を確認できます。

## ファイル構成

| ファイル | 責務 |
| --- | --- |
| `index.html` | メイン画面のマークアップ |
| `styles.css` | スタイル |
| `storage.js` | localStorage 操作（商品・発注先・発注リスト・OAuthトークン） |
| `csv.js` | 発注先ごとの CSV 生成 |
| `gmail.js` | Google OAuth と Gmail API 送信 |
| `app.js` | DOM 操作・イベントハンドラ・モジュール連携 |
| `test.html` | storage/csv の簡易テスト |
| `config.js` | OAuth クライアントID（.gitignore 対象） |
| `config.sample.js` | OAuth 設定のひな形 |
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
