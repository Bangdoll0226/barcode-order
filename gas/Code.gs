/**
 * バーコード発注アプリ用 GAS Web App
 *
 * 役割: フロント (GitHub Pages) から発注メール送信のリクエストを受け取り、
 *       デプロイ実行者 (＝あなたのGoogleアカウント) として GmailApp で送信する。
 *       これによりスタッフ側はGoogleログインが不要になる。
 *
 * セットアップ:
 *   1. https://script.google.com/ で新規プロジェクトを作成
 *   2. このファイルの内容を Code.gs に貼り付け
 *   3. SHARED_SECRET を任意の長いランダム文字列に変更（フロントの config.js と一致させる）
 *   4. デプロイ → 「ウェブアプリ」を選択
 *        - 次のユーザーとして実行: 自分
 *        - アクセスできるユーザー: 全員
 *   5. 表示された Web App URL を config.js の GAS_WEB_APP_URL に設定
 *   6. コードを更新したら毎回「デプロイを管理」→「編集」→「新バージョン」で再デプロイ
 *      （URLは固定のまま反映されます）
 *
 * セキュリティ注意:
 *   - URLが漏れた場合に備えて SHARED_SECRET でリクエストを検証する。
 *   - 送信先は実行者のGmailなので、悪用されても外部に好き勝手送られることはない
 *     （ただしクォータは消費されるので秘密は外に出さないこと）。
 */

// ====== 設定 ======

// 共有シークレット。フロントの config.js の GAS_SHARED_SECRET と完全一致させる。
// ランダムな長い文字列にすること。例: 32文字以上の英数字。
const SHARED_SECRET = "CHANGE_ME_TO_A_LONG_RANDOM_STRING";

// ====== Web App エンドポイント ======

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ ok: false, error: "no_post_data" });
    }

    const data = JSON.parse(e.postData.contents);

    if (data.token !== SHARED_SECRET) {
      return jsonResponse({ ok: false, error: "unauthorized" });
    }

    const to = String(data.to || "").trim();
    const subject = String(data.subject || "");
    const htmlBody = String(data.htmlBody || "");
    if (!to) return jsonResponse({ ok: false, error: "missing_to" });
    if (!subject) return jsonResponse({ ok: false, error: "missing_subject" });

    const attachments = (data.attachments || []).map(function (a) {
      // a: { filename, mimeType, contentBase64 }
      const bytes = Utilities.base64Decode(a.contentBase64);
      return Utilities.newBlob(bytes, a.mimeType || "text/csv", a.filename || "attachment.csv");
    });

    GmailApp.sendEmail(to, subject, "本文はHTMLをご確認ください。", {
      htmlBody: htmlBody,
      attachments: attachments,
      name: "バーコード発注アプリ",
    });

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

// GET アクセスは生存確認用
function doGet() {
  return ContentService
    .createTextOutput("barcode-order GAS endpoint OK")
    .setMimeType(ContentService.MimeType.TEXT);
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
