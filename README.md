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
