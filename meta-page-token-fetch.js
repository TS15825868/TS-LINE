"use strict";

const GRAPH_VERSION = String(process.env.META_GRAPH_VERSION || "v25.0").replace(/^\/?/, "");
const PAGE_ID = String(process.env.META_PAGE_ID || "").trim();
const CONFIGURED_TOKEN = String(process.env.META_PAGE_ACCESS_TOKEN || "").trim();
const originalFetch = global.fetch;

let cachedToken = "";
let cachedAt = 0;
const CACHE_MS = 10 * 60 * 1000;

function isFacebookPublishUrl(value) {
  try {
    const url = new URL(typeof value === "string" ? value : value?.url || "");
    return url.hostname === "graph.facebook.com"
      && PAGE_ID
      && new RegExp(`/${PAGE_ID}/(?:photos|feed)$`).test(url.pathname);
  } catch {
    return false;
  }
}

async function readJson(response) {
  const text = await response.text();
  try { return JSON.parse(text); }
  catch { return { raw: text }; }
}

async function resolvePageToken() {
  if (!PAGE_ID || !CONFIGURED_TOKEN) {
    throw new Error("請先設定 META_PAGE_ID 與 META_PAGE_ACCESS_TOKEN");
  }
  if (cachedToken && Date.now() - cachedAt < CACHE_MS) return cachedToken;

  const meUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/me`);
  meUrl.searchParams.set("fields", "id,name");
  meUrl.searchParams.set("access_token", CONFIGURED_TOKEN);
  const meResponse = await originalFetch(meUrl, { cache: "no-store" });
  const me = await readJson(meResponse.clone());

  if (meResponse.ok && String(me.id || "") === PAGE_ID) {
    cachedToken = CONFIGURED_TOKEN;
    cachedAt = Date.now();
    return cachedToken;
  }

  const accountsUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/me/accounts`);
  accountsUrl.searchParams.set("fields", "id,name,access_token,tasks");
  accountsUrl.searchParams.set("limit", "100");
  accountsUrl.searchParams.set("access_token", CONFIGURED_TOKEN);
  const accountsResponse = await originalFetch(accountsUrl, { cache: "no-store" });
  const accounts = await readJson(accountsResponse.clone());

  if (!accountsResponse.ok) {
    const message = String(accounts?.error?.message || "");
    if (/publish_actions/i.test(message)) {
      throw new Error("目前 Token 是舊式或錯誤的個人 Token。請重新產生具有 pages_show_list、pages_read_engagement、pages_manage_posts 的 User Token，再貼到 Render。系統會自動換成粉絲專頁 Token。");
    }
    throw new Error(`無法讀取粉絲專頁清單：${message || `HTTP ${accountsResponse.status}`}。請確認 Token 含有 pages_show_list。`);
  }

  const page = (Array.isArray(accounts.data) ? accounts.data : []).find((item) => String(item.id || "") === PAGE_ID);
  if (!page) {
    const available = (Array.isArray(accounts.data) ? accounts.data : []).map((item) => `${item.name || "未命名"}（${item.id}）`).join("、");
    throw new Error(`目前帳號找不到 META_PAGE_ID=${PAGE_ID} 的粉絲專頁。可管理的粉絲專頁：${available || "無"}。請確認登入帳號具有仙加味粉絲專頁的完整控制權。`);
  }

  const tasks = Array.isArray(page.tasks) ? page.tasks : [];
  if (tasks.length && !tasks.some((task) => ["CREATE_CONTENT", "MANAGE"].includes(String(task)))) {
    throw new Error("目前帳號沒有仙加味粉絲專頁的建立內容權限，請在粉絲專頁存取權中給予完整控制權或內容管理權限。");
  }
  if (!page.access_token) {
    throw new Error("Meta 沒有回傳粉絲專頁 Token，請重新授權 pages_read_engagement 與 pages_manage_posts。");
  }

  cachedToken = String(page.access_token);
  cachedAt = Date.now();
  return cachedToken;
}

function replaceToken(body, token) {
  if (body instanceof URLSearchParams) {
    const next = new URLSearchParams(body);
    next.set("access_token", token);
    return next;
  }
  if (typeof body === "string") {
    const next = new URLSearchParams(body);
    next.set("access_token", token);
    return next;
  }
  return body;
}

function friendlyFacebookResponse(response, data) {
  const originalMessage = String(data?.error?.message || data?.raw || "Facebook 發布失敗");
  let message = originalMessage;
  if (/publish_actions/i.test(originalMessage)) {
    message = "目前 Token 不是可管理粉絲專頁的 Page Token，或缺少 pages_manage_posts。請在 Meta Graph API Explorer 重新授權 pages_show_list、pages_read_engagement、pages_manage_posts。";
  } else if (/permissions error|permission/i.test(originalMessage)) {
    message = `Facebook 權限不足：${originalMessage}。請確認 pages_manage_posts 已授權，且帳號具有粉絲專頁建立內容權限。`;
  }
  return new Response(JSON.stringify({ error: { message, originalMessage } }), {
    status: response.status,
    statusText: response.statusText,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

if (typeof originalFetch === "function") {
  global.fetch = async function metaPageAwareFetch(input, init = {}) {
    if (!isFacebookPublishUrl(input)) return originalFetch(input, init);

    try {
      const token = await resolvePageToken();
      const response = await originalFetch(input, { ...init, body: replaceToken(init.body, token) });
      if (response.ok) return response;
      const data = await readJson(response.clone());
      return friendlyFacebookResponse(response, data);
    } catch (error) {
      return new Response(JSON.stringify({ error: { message: error.message || "Facebook Token 驗證失敗" } }), {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }
  };
}

module.exports = { resolvePageToken, isFacebookPublishUrl, replaceToken };
