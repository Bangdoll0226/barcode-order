# バーコード発注リストアプリ 設計書

- 作成日: 2026-04-24
- 最終更新: 2026-04-24（発注先マスタ・Gmail送信を追加）
- 対象ディレクトリ: `/Users/yo-chan/claude/barcode-order/`

## 1. 概要

スマホのカメラでバーコード（JAN/EAN）を読み取り、品名・数量・発注先を管理できる Web アプリ。発注リストを発注先ごとに CSV として書き出し、Gmail 経由で自分宛にメール送信する。

- 想定ユーザー: 発注担当者（個人利用）
- デフォルト発注先: アスクル / カウネット / Amazon / シンリョウ（後から追加・編集可）
- データはすべて `localStorage` に保存（サーバー不要）
- 認証済み Gmail アカウント経由でメール送信（第三者サービスを経由しない）

## 2. 要件

### 機能要件

1. スマホカメラで JAN/EAN-13 バーコードを読み取れる
2. 商品マスタ（バーコード → 品名・発注先）をブラウザに保存し、次回以降は自動引き当て
3. 同じ商品を再度スキャンすると、発注リストの数量が +1
4. 発注リスト上で数量・発注先を変更できる
5. 発注先マスタを追加・編集・削除・並び替えできる（使用中は削除不可）
6. 発注先ごとに CSV を分割して生成
7. Google OAuth 認証のうえ、認証アカウント宛に Gmail API でメール送信（CSV 添付＋本文に発注サイトへのリンク）
8. メール送信成功後は発注リストを自動でクリア
9. 商品マスタを一覧・編集・削除できる管理画面がある
10. カメラが使えない環境向けに JAN コードの手動入力フォールバックがある

### 非機能要件

- データはすべて `localStorage` に保存（サーバー不要）
- スマホ（iPhone Safari / Android Chrome）で動作
- ビルド不要でそのまま動く構成
- `https` または `localhost` 配信（カメラ API・Google OAuth の要件）

## 3. アーキテクチャ

### 3.1 ファイル構成

```
barcode-order/
├── index.html            # メイン画面（スキャン + 発注リスト + 操作 + マスタ管理）
├── app.js                # アプリロジック全体
├── storage.js            # localStorage 操作（商品・発注先・発注リスト）
├── gmail.js              # Google OAuth + Gmail API 送信
├── csv.js                # CSV 生成ロジック
├── styles.css            # スタイル
├── manifest.json         # PWA 設定（ホーム画面追加用）
├── config.sample.js      # OAuth クライアントIDのひな形（git管理）
├── config.js             # 実際のクライアントIDを入れる（.gitignore 対象）
├── .gitignore            # config.js を除外
├── README.md             # 使い方・セットアップ手順（OAuth設定含む）
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-04-24-barcode-order-design.md
```

- `html5-qrcode` は CDN から読み込み（例: `https://unpkg.com/html5-qrcode`）
- `google-identity-services`（GIS）ライブラリを CDN から読み込み（`https://accounts.google.com/gsi/client`）
- Gmail API は `fetch` で直接呼び出し（SDK不要）
- OAuth クライアントID は `config.js` に記載し、`.gitignore` で公開リポジトリに漏れないよう保護（本リポジトリは private だが、将来公開する可能性も考慮）

### 3.2 画面構成

単一ページに 4 エリアを縦並びで配置。

1. **ヘッダー**: Google 認証状態（ログイン中のアカウントメール表示 / ログアウトボタン）
2. **スキャンエリア**
   - 「スキャン開始」ボタン → `html5-qrcode` でカメラ起動
   - バーコード検出で自動停止し、次の処理へ分岐
   - 「手動入力」ボタン（JAN コードを直接入力するフォールバック）
3. **発注リスト**
   - カード/テーブル形式で `品名 / 数量(± で増減) / 発注先(セレクト) / 削除` を表示
   - 上部に「合計 N 件」の件数表示
4. **操作エリア**
   - 「メール送信」ボタン（= 発注リストの最終アクション）
   - 「リストをクリア」ボタン（確認ダイアログあり）
   - 「商品マスタを管理」ボタン（展開セクション）
   - 「発注先マスタを管理」ボタン（展開セクション）

### 3.3 スキャン時の分岐

```
バーコード検出
├── 既知 JAN（商品マスタにある）
│   ├── 発注リストに同一 JAN の行あり → 数量 +1
│   └── 発注リストに行なし → マスタのデフォルト発注先で新規行を追加
└── 未知 JAN（商品マスタにない）
    └── モーダルを開く
        ├── 品名（必須）
        ├── 発注先（ラジオ: 発注先マスタの値から選択、必須）
        ├── 「登録して追加」→ 商品マスタに保存 + 発注リストに新規行追加
        └── 「キャンセル」→ 何もしない
```

### 3.4 メール送信フロー

```
「メール送信」ボタン押下
  ↓
Google OAuth 認証状態を確認
  ├── 未認証 → Google Sign-In ポップアップで認証（スコープ: gmail.send）
  └── 認証済み → 次へ
  ↓
発注リストを発注先ごとにグルーピング
  ↓
発注先ごとに CSV を生成（メモリ上）
  ↓
メール本文（HTML）を組み立て
  ├── 件名: 発注リスト YYYY-MM-DD HH:mm
  ├── 本文: 発注先ごとの商品・数量一覧 + 「◯◯で発注」リンク
  └── 添付: 発注先ごとの CSV ファイル
  ↓
Gmail API の users.messages.send で MIME メッセージを送信
  ├── 成功 → 発注リストを自動でクリア + 完了メッセージ表示
  └── 失敗 → エラーメッセージ表示（リストは残す）
```

## 4. データモデル

### 4.1 商品マスタ（localStorage キー: `barcode-order:products`）

```json
{
  "4901234567890": {
    "name": "アルコール綿 100包",
    "defaultSupplier": "アスクル"
  },
  "4909876543210": {
    "name": "ディスポ手袋 M 100枚",
    "defaultSupplier": "シンリョウ"
  }
}
```

- キー: JAN コード（文字列）
- 値: `{ name: string, defaultSupplier: string }`（発注先名は発注先マスタと照合）

### 4.2 発注先マスタ（localStorage キー: `barcode-order:suppliers`）

```json
[
  { "name": "アスクル",   "url": "https://www.askul.co.jp/" },
  { "name": "カウネット", "url": "https://www.kaunet.com/" },
  { "name": "Amazon",     "url": "https://www.amazon.co.jp/" },
  { "name": "シンリョウ", "url": "https://www.shinryo.jp/" }
]
```

- 配列。並び順が UI 表示・CSV出力の並び順になる
- 初回起動時にこの 4 件をデフォルト投入
- `name`: 必須・重複不可
- `url`: 任意（未設定の場合、メール本文のリンクは表示しない）
- 管理画面で 追加・名称変更・URL変更・削除・並び替え が可能
- **削除条件**: 商品マスタ・発注リストのいずれでも使われていないときに限り削除可能。使用中の場合は「◯件で使用中のため削除できません」と表示

### 4.3 発注リスト（localStorage キー: `barcode-order:order`）

```json
[
  {
    "id": "uuid-1",
    "barcode": "4901234567890",
    "name": "アルコール綿 100包",
    "quantity": 3,
    "supplier": "アスクル",
    "addedAt": "2026-04-24T10:15:00+09:00"
  }
]
```

- 配列。1 行 1 アイテム
- 同じ `barcode` を再スキャンすると該当行の `quantity` が +1
- `supplier` はマスタの `defaultSupplier` を初期値とし、リスト上で変更可能（商品マスタは変更しない）

### 4.4 OAuth トークン（localStorage キー: `barcode-order:gmail_token`）

```json
{
  "access_token": "ya29....",
  "expires_at": 1735689600000,
  "email": "sunrise_hayakawa@aqua.ocn.ne.jp"
}
```

- `access_token`: Gmail API 呼び出し用
- `expires_at`: トークン期限（unixタイムスタンプms）。期限切れなら再認証
- `email`: ヘッダー表示＋送信先（自分宛）に使用
- ※ トークンは `localStorage` に保存するため、端末を共有する場合は注意（本アプリは個人端末前提）

## 5. 主要ロジック

### 5.1 スキャン・マスタ操作

- `addScannedBarcode(jan)`:
  1. 商品マスタに存在しなければモーダル → 入力後 `registerProduct` + `addOrderLine`
  2. マスタに存在すれば、発注リストに同 JAN 行があるか確認 → あれば `quantity += 1`、なければ `addOrderLine`
- `registerProduct(jan, name, supplier)`: 商品マスタに保存
- `addOrderLine(jan)`: 商品マスタから品名・デフォルト発注先を引いて発注リストに追加
- `updateQuantity(id, delta)` / `updateSupplier(id, supplier)` / `removeLine(id)`: 発注リスト行の操作
- `clearOrder()`: 発注リストを空に
- `addSupplier(name, url)` / `updateSupplier(oldName, newName, url)` / `removeSupplierIfUnused(name)`: 発注先マスタ操作
- `isSupplierInUse(name)`: 商品マスタ・発注リストを走査して使用中かを判定

### 5.2 CSV 生成

- 発注先ごとに `{品名, 数量, JANコード}` の 3 列で生成
- 文字コード: UTF-8 with BOM / 改行: `\r\n`
- 値に `,` `"` `\r` `\n` が含まれる場合は `"` で囲み、内部の `"` は `""` にエスケープ
- ファイル名: `order-{発注先名}-YYYYMMDD-HHmm.csv`

### 5.3 Gmail 送信

- `signIn()`: Google Identity Services のポップアップで OAuth 認証（スコープ: `https://www.googleapis.com/auth/gmail.send`）
- `signOut()`: トークン破棄
- `sendOrderEmail()`:
  1. トークン有効性チェック（期限切れなら再認証）
  2. 発注リストを supplier でグルーピング
  3. 発注先ごとに CSV を生成
  4. MIME multipart メッセージを組み立て（本文HTML + 添付 CSV × 発注先数）
  5. base64url エンコードして Gmail API `users.messages.send` を呼び出し
  6. 成功時に発注リストをクリア

### 5.4 メール本文のフォーマット（HTML）

```
件名: 発注リスト YYYY-MM-DD HH:mm

本文（抜粋）:
  ■ アスクル（3件）
    ・アルコール綿 100包 × 3
    ・コピー用紙 A4 × 2
    ・ボールペン × 5
    [アスクルで発注](https://www.askul.co.jp/)

  ■ シンリョウ（1件）
    ・ディスポ手袋 M 100枚 × 4
    [シンリョウで発注](https://www.shinryo.jp/)
```

## 6. Google OAuth セットアップ手順（README に記載）

1. Google Cloud Console で新規プロジェクトを作成
2. 「APIとサービス」→「ライブラリ」で Gmail API を有効化
3. 「OAuth 同意画面」を「外部」→「テスト」モードで作成
   - テストユーザーに自身のメールアドレスを追加
4. 「認証情報」→「OAuthクライアントID」を作成
   - アプリの種類: ウェブアプリケーション
   - 承認済みのJavaScript生成元: デプロイ先URL（例: `https://<github-pages-url>`）
5. 発行されたクライアントIDを `config.js` にコピー
6. スコープは `https://www.googleapis.com/auth/gmail.send` のみ

※ 課金の有効化は不要。テストモードのまま個人運用。

## 7. エラーハンドリング

| ケース | 対応 |
| --- | --- |
| カメラ許可が拒否された | エラーメッセージを表示し「手動入力」に誘導 |
| `getUserMedia` 非対応ブラウザ | カメラ機能を隠し、手動入力のみで動作 |
| `localStorage` が無効/満杯 | エラーメッセージを表示 |
| 未登録商品モーダルで品名が空 | 「登録して追加」ボタンを無効化 |
| 手動入力の JAN コードが不正 | 8 桁または 13 桁の数字のみを許容 |
| 同一 JAN が連続スキャン | 1.5 秒程度のデバウンスで二重登録防止 |
| 発注先マスタの削除操作で使用中 | 「◯件で使用中のため削除できません」と表示してブロック |
| OAuth 未認証の状態で送信ボタン | 自動で認証フローを開始 |
| OAuth トークン期限切れ | 再認証フローを自動で開始 |
| Gmail API 呼び出し失敗 | エラー内容を表示、発注リストはクリアしない |
| 発注リストが空で送信ボタン | ボタン無効化 |

## 8. テスト方針

### 自動テスト（純粋ロジック）

- 対象: CSV 生成、マスタ操作、数量カウント、発注リスト操作、発注先使用中判定
- 簡易な `test.html` を用意し、ブラウザで開くとコンソールに結果が出る形式
- フレームワーク未使用（`console.assert` 程度で十分）

### 手動テスト（実機）

- iPhone Safari / Android Chrome でのカメラ動作確認
- 以下のシナリオを受け入れ基準とする:
  1. 未登録バーコードをスキャン → モーダル表示 → 登録 → リストに追加される
  2. 同じバーコードを再スキャン → リストの数量が +1 される
  3. リスト上で数量・発注先を変更できる
  4. 発注先マスタで追加・編集・削除ができ、使用中は削除不可になる
  5. ページをリロードしてもデータが保持される
  6. Google OAuth 認証フローが完了する
  7. メール送信ボタンで、発注先ごとにCSVが添付された HTML メールが自分宛に届く
  8. 送信成功後に発注リストが自動クリアされる
  9. 商品マスタ管理画面で編集・削除ができる
  10. カメラ拒否時に手動入力で同じ操作ができる

## 9. スコープ外（今回やらないこと）

- サーバー/クラウド上でのデータ同期（複数端末間）
- 発注先サイトで実際に発注を実行する自動化（ログイン・カート投入・注文確定）
- 外部 JAN コード DB 連携（商品情報の自動取得）
- バーコード以外（QR など）からの商品情報入力
- Google Drive への CSV アーカイブ（将来の拡張候補）
- 複数ユーザー対応・共有（個人利用のみ）

将来必要になれば別プロジェクトとして検討する。
