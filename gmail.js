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
