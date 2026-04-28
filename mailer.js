// mailer.js — GAS Web App 経由でメール送信
//
// gmail.js (OAuth + Gmail API 直接送信) を置き換える。
// スタッフ側は Google ログイン不要で、GAS デプロイ者のアカウントから送信される。

import { GAS_WEB_APP_URL, GAS_SHARED_SECRET } from "./config.js";

// UTF-8 文字列を base64 にエンコード（btoa は Latin-1 のみ受け付けるため変換）。
function utf8ToBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

/**
 * 発注メールを GAS Web App 経由で送信する。
 * 引数の構造は gmail.sendMail と同じにしてあるので app.js 側はほぼそのまま使える。
 *
 * @param {Object} params
 * @param {string} params.to        送信先メールアドレス
 * @param {string} params.subject   件名
 * @param {string} params.htmlBody  HTML 本文
 * @param {Array}  params.attachments  [{ filename, content (string) }]
 */
export async function sendMail({ to, subject, htmlBody, attachments }) {
  if (!GAS_WEB_APP_URL || GAS_WEB_APP_URL.startsWith("YOUR_")) {
    throw new Error("GAS_WEB_APP_URL が config.js に設定されていません");
  }

  const encodedAttachments = (attachments || []).map((a) => ({
    filename: a.filename,
    mimeType: "text/csv",
    contentBase64: utf8ToBase64(a.content),
  }));

  const payload = {
    token: GAS_SHARED_SECRET,
    to,
    subject,
    htmlBody,
    attachments: encodedAttachments,
  };

  // Content-Type を application/json にすると CORS プリフライトが発生し
  // GAS Web App は OPTIONS に対応していないため失敗する。
  // text/plain で送って GAS 側で JSON.parse する（標準的な回避策）。
  const res = await fetch(GAS_WEB_APP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    redirect: "follow",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GAS送信エラー (${res.status}): ${text.slice(0, 200)}`);
  }

  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error("GASからの応答がJSONではありません（デプロイ設定を確認してください）");
  }

  if (!json.ok) {
    throw new Error(`GAS側エラー: ${json.error || "unknown"}`);
  }

  return json;
}
