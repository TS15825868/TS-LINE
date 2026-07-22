"use strict";

const GRAPH_VERSION = String(process.env.META_GRAPH_VERSION || "v25.0").replace(/^\/?/, "");
const PAGE_ID = String(process.env.META_PAGE_ID || "").trim();
const TOKEN_CANDIDATES = [
  ["META_PAGE_ACCESS_TOKEN_NEXT", process.env.META_PAGE_ACCESS_TOKEN_NEXT],
  ["META_PAGE_ACCESS_TOKEN", process.env.META_PAGE_ACCESS_TOKEN],
  ["META_USER_ACCESS_TOKEN", process.env.META_USER_ACCESS_TOKEN],
  ["FACEBOOK_PAGE_ACCESS_TOKEN", process.env.FACEBOOK_PAGE_ACCESS_TOKEN],
  ["FACEBOOK_USER_ACCESS_TOKEN", process.env.FACEBOOK_USER_ACCESS_TOKEN],
]
  .map(([name, value]) => ({ name, token: String(value || "").trim() }))
  .filter((item, index, rows) => item.token && rows.findIndex((row) => row.token === item.token) === index);
const originalFetch = global.fetch;
let cachedPageAuth = null;
let resolving = null;
let lastHealth = {
  checkedAt: "",
  configured: Boolean(PAGE_ID && TOKEN_CANDIDATES.length),
  usable: null,
  expired: false,
  source: "",
  pageId: PAGE_ID,
  pageName: "",
  error: "",
};

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

function tokenExpired(message) {
  return /session has expired|access token has expired|token.*expired|error validating access token/i.test(String(message || ""));
}

function sanitizeError(message) {
  return String(message || "")
    .replace(/access token\s+[A-Za-z0-9._-]+/gi, "access token")
    .slice(0, 1200);
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

async function resolveCandidate(candidate) {
  const identity = await graphGet("me", candidate.token, { fields: "id,name" });
  if (String(identity.id) === PAGE_ID) {
    return {
      pageId: PAGE_ID,
      pageName: identity.name || "Facebook 粉絲專頁",
      token: candidate.token,
      source: candidate.name,
      tasks: [],
    };
  }

  const pageAuth = await resolveFromAccounts(candidate.token);
  if (!pageAuth) {
    throw new Error(`Token 不是指定粉絲專頁的 Page Token，且管理清單中找不到 META_PAGE_ID=${PAGE_ID}`);
  }
  if (pageAuth.tasks.length && !pageAuth.tasks.includes("CREATE_CONTENT") && !pageAuth.tasks.includes("MANAGE")) {
    throw new Error(`目前帳號對「${pageAuth.pageName}」沒有建立內容權限`);
  }
  return { ...pageAuth, source: candidate.name };
}

async function resolveFacebookPageAuth(options = {}) {
  const force = options === true || options?.force === true;
  if (force) cachedPageAuth = null;
  if (cachedPageAuth) return cachedPageAuth;
  if (resolving) return resolving;
  if (!PAGE_ID || !TOKEN_CANDIDATES.length) throw new Error("請先在 Render 設定 META_PAGE_ID 與 META_PAGE_ACCESS_TOKEN");

  resolving = (async () => {
    const failures = [];
    for (const candidate of TOKEN_CANDIDATES) {
      try {
        const pageAuth = await resolveCandidate(candidate);
        cachedPageAuth = pageAuth;
        lastHealth = {
          checkedAt: new Date().toISOString(),
          configured: true,
          usable: true,
          expired: false,
          source: pageAuth.source,
          pageId: pageAuth.pageId,
          pageName: pageAuth.pageName,
          error: "",
        };
        return cachedPageAuth;
      } catch (error) {
        failures.push(`${candidate.name}：${sanitizeError(error.message)}`);
      }
    }
    const message = failures.join("｜") || "Facebook Token 無法使用";
    lastHealth = {
      checkedAt: new Date().toISOString(),
      configured: true,
      usable: false,
      expired: tokenExpired(message),
      source: "",
      pageId: PAGE_ID,
      pageName: "",
      error: message,
    };
    throw new Error(`Facebook Token 無法使用：${message}`);
  })().finally(() => { resolving = null; });

  return resolving;
}

async function facebookAuthHealth(options = {}) {
  const force = options === true || options?.force === true;
  try {
    await resolveFacebookPageAuth({ force });
  } catch {}
  return { ...lastHealth, graphVersion: GRAPH_VERSION };
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
  if (tokenExpired(text)) {
    cachedPageAuth = null;
    lastHealth = {
      checkedAt: new Date().toISOString(),
      configured: true,
      usable: false,
      expired: true,
      source: "",
      pageId: PAGE_ID,
      pageName: "",
      error: sanitizeError(text),
    };
    return "Facebook Page Token 已過期。Instagram 已成功的貼文不會重複發布；更新 Render 的 META_PAGE_ACCESS_TOKEN 後，再按「重試失敗平台」。";
  }
  if (/publish_actions/i.test(text)) {
    return "Facebook 使用到個人 Token 或錯誤的粉絲專頁 ID。系統已嘗試轉換 Page Token，但目前帳號缺少 pages_show_list／pages_manage_posts，或 META_PAGE_ID 不是仙加味粉專 ID。";
  }
  if (/permissions?|OAuthException|access token/i.test(text)) {
    return `Facebook 權限或 Token 錯誤：${sanitizeError(text)}`;
  }
  return sanitizeError(text);
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

    return new Response(JSON.stringify({ error: { ...(data.error || {}), message: friendly, original_message: sanitizeError(originalMessage) } }), {
      status: response.status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  };
}

module.exports = {
  GRAPH_VERSION,
  PAGE_ID,
  TOKEN_CANDIDATES,
  graphUrl,
  resolveFacebookPageAuth,
  facebookAuthHealth,
  isFacebookPublishRequest,
  replaceAccessToken,
  tokenExpired,
  friendlyFacebookError,
};
