"use strict";

const GRAPH_VERSION = String(process.env.META_GRAPH_VERSION || "v25.0").replace(/^\/?/, "");
const PAGE_ID = String(process.env.META_PAGE_ID || "").trim();
const CONFIGURED_TOKEN = String(process.env.META_PAGE_ACCESS_TOKEN || "").trim();
const originalFetch = global.fetch;
let cachedPageAuth = null;
let resolving = null;

function graphUrl(pathname, params = {}) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${pathname.replace(/^\//, "")}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  return url;
}

async function readJson(response) {
  const text = await response.text();
  try { return JSON.parse(text); }
  catch { return { error: { message: text || `HTTP ${response.status}` } }; }
}

async function graphGet(pathname, token, params = {}) {
  const response = await originalFetch(graphUrl(pathname, { ...params, access_token: token }), {
    method: "GET",
    cache: "no-store",
  });
  const data = await readJson(response);
  if (!response.ok || data.error) throw new Error(data.error?.message || `Facebook API HTTP ${response.status}`);
  return data;
}

async function resolveFromAccounts(userToken) {
  let next = graphUrl("me/accounts", {
    fields: "id,name,access_token,tasks",
    limit: "100",
    access_token: userToken,
  }).toString();

  for (let page = 0; page < 5 && next; page += 1) {
    const response = await originalFetch(next, { method: "GET", cache: "no-store" });
    const data = await readJson(response);
    if (!response.ok || data.error) throw new Error(data.error?.message || `Facebook API HTTP ${response.status}`);
    const match = (data.data || []).find((item) => String(item.id) === PAGE_ID);
    if (match?.access_token) {
      const tasks = Array.isArray(match.tasks) ? match.tasks : [];
      return { pageId: String(match.id), pageName: match.name || "Facebook 粉絲專頁", token: match.access_token, source: "user-token", tasks };
    }
    const candidate = String(data.paging?.next || "");
    next = candidate.startsWith("https://graph.facebook.com/") ? candidate : "";
  }
  return null;
}

async function resolveFacebookPageAuth() {
  if (cachedPageAuth) return cachedPageAuth;
  if (resolving) return resolving;
  if (!PAGE_ID || !CONFIGURED_TOKEN) throw new Error("請先在 Render 設定 META_PAGE_ID 與 META_PAGE_ACCESS_TOKEN");

  resolving = (async () => {
    let identity;
    try {
      identity = await graphGet("me", CONFIGURED_TOKEN, { fields: "id,name" });
    } catch (error) {
      throw new Error(`Facebook Token 無法使用：${error.message}`);
    }

    if (String(identity.id) === PAGE_ID) {
      cachedPageAuth = { pageId: PAGE_ID, pageName: identity.name || "Facebook 粉絲專頁", token: CONFIGURED_TOKEN, source: "page-token", tasks: [] };
      return cachedPageAuth;
    }

    let pageAuth;
    try {
      pageAuth = await resolveFromAccounts(CONFIGURED_TOKEN);
    } catch (error) {
      throw new Error(`目前是個人 Token，但無法取得粉絲專頁權限：${error.message}。請重新產生包含 pages_show_list、pages_read_engagement、pages_manage_posts 的 Token。`);
    }

    if (!pageAuth) {
      throw new Error(`目前 META_PAGE_ACCESS_TOKEN 不是仙加味粉絲專頁的 Page Token，且在此帳號管理的粉專中找不到 META_PAGE_ID=${PAGE_ID}。請確認粉專 ID，並使用具 pages_show_list、pages_read_engagement、pages_manage_posts 權限的帳號重新取得 Token。`);
    }

    if (pageAuth.tasks.length && !pageAuth.tasks.includes("CREATE_CONTENT") && !pageAuth.tasks.includes("MANAGE")) {
      throw new Error(`目前帳號對「${pageAuth.pageName}」沒有建立內容權限，請在粉絲專頁存取權限中授予可建立內容的完整控制權。`);
    }

    cachedPageAuth = pageAuth;
    return cachedPageAuth;
  })().finally(() => { resolving = null; });

  return resolving;
}

function isFacebookPublishRequest(input, init = {}) {
  if (String(init.method || "GET").toUpperCase() !== "POST") return false;
  try {
    const url = new URL(typeof input === "string" ? input : input?.url || "");
    if (url.hostname !== "graph.facebook.com") return false;
    return new RegExp(`/${PAGE_ID}/(?:photos|feed)$`).test(url.pathname);
  } catch {
    return false;
  }
}

function replaceAccessToken(body, token) {
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

function friendlyFacebookError(message) {
  const text = String(message || "");
  if (/publish_actions/i.test(text)) {
    return "Facebook 使用到個人 Token 或錯誤的粉絲專頁 ID。系統已嘗試轉換 Page Token，但目前帳號缺少 pages_show_list／pages_manage_posts，或 META_PAGE_ID 不是仙加味粉專 ID。";
  }
  if (/permissions?|OAuthException|access token/i.test(text)) {
    return `Facebook 權限或 Token 錯誤：${text}`;
  }
  return text;
}

if (typeof originalFetch === "function" && !global.__xjwFacebookPageTokenBridge) {
  global.__xjwFacebookPageTokenBridge = true;
  global.fetch = async function xjwFacebookPageFetch(input, init = {}) {
    if (!isFacebookPublishRequest(input, init)) return originalFetch(input, init);

    const auth = await resolveFacebookPageAuth();
    const response = await originalFetch(input, {
      ...init,
      body: replaceAccessToken(init.body, auth.token),
    });

    if (response.ok) return response;
    const cloned = response.clone();
    const data = await readJson(cloned);
    const originalMessage = data.error?.message || data.raw || `HTTP ${response.status}`;
    const friendly = friendlyFacebookError(originalMessage);
    if (friendly === originalMessage) return response;

    return new Response(JSON.stringify({ error: { ...(data.error || {}), message: friendly, original_message: originalMessage } }), {
      status: response.status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  };
}

module.exports = {
  graphUrl,
  resolveFacebookPageAuth,
  isFacebookPublishRequest,
  replaceAccessToken,
  friendlyFacebookError,
};
