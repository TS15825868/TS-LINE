from pathlib import Path
import re

path = Path('erp-publish-bridge.js')
source = path.read_text(encoding='utf-8')

replacement = r'''function instagramLoginGraphUrl(pathname, params = {}) {
  const url = new URL(`https://graph.instagram.com/${GRAPH_VERSION}/${String(pathname || "").replace(/^\\/+/, "")}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value) !== "") url.searchParams.set(key, String(value));
  }
  return url;
}

async function instagramLoginGet(pathname, token, params = {}) {
  const response = await fetch(instagramLoginGraphUrl(pathname, { ...params, access_token: token }), {
    method: "GET",
    cache: "no-store",
    headers: { authorization: `Bearer ${token}` },
  });
  return readJson(response);
}

async function instagramLoginPost(pathname, token, params = {}) {
  const response = await fetch(instagramLoginGraphUrl(pathname), {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/x-www-form-urlencoded; charset=utf-8",
    },
    body: new URLSearchParams({ ...params, access_token: token }),
  });
  return readJson(response);
}

function sanitizeMetaError(message) {
  return clean(message || "Meta API error", 900)
    .replace(/access_token[=:]?[A-Za-z0-9._-]+/gi, "access_token=[redacted]")
    .replace(/Bearer\\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]");
}

async function resolveInstagramAuthCandidates() {
  const metaId = clean(process.env.META_INSTAGRAM_USER_ID, 200);
  const instagramId = clean(process.env.INSTAGRAM_USER_ID, 200);
  const pageToken = clean(process.env.META_PAGE_ACCESS_TOKEN, 20000);
  const instagramToken = clean(process.env.INSTAGRAM_ACCESS_TOKEN, 20000);
  const candidates = [];
  const seen = new Set();

  const add = (instagramUserId, token, mode, source) => {
    const id = clean(instagramUserId, 200);
    const authToken = clean(token, 20000);
    if (!id || !authToken) return;
    const key = `${mode}:${id}:${authToken}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ instagramUserId: id, token: authToken, mode, source });
  };

  // Instagram Login uses an Instagram User access token and graph.instagram.com.
  // Prefer that exact pair first when it is configured.
  add(instagramId, instagramToken, "instagram-login", "INSTAGRAM_USER_ID+INSTAGRAM_ACCESS_TOKEN");
  add(metaId, instagramToken, "instagram-login", "META_INSTAGRAM_USER_ID+INSTAGRAM_ACCESS_TOKEN");

  // Facebook Login uses the connected IG professional account ID with a Page token.
  add(metaId, pageToken, "facebook-login", "META_INSTAGRAM_USER_ID+META_PAGE_ACCESS_TOKEN");
  add(instagramId, pageToken, "facebook-login", "INSTAGRAM_USER_ID+META_PAGE_ACCESS_TOKEN");

  let pageAuth = null;
  try { pageAuth = await resolvePageAuth(); } catch {}
  if (pageAuth?.instagramUserId && pageAuth?.token) {
    add(pageAuth.instagramUserId, pageAuth.token, "facebook-login", "page-accounts");
  }

  if (pageAuth?.pageId) {
    for (const token of unique([pageAuth.token, ...metaTokenCandidates()])) {
      try {
        const page = await graphGet(pageAuth.pageId, token, {
          fields: "instagram_business_account,connected_instagram_account",
        });
        const id = clean(page?.instagram_business_account?.id || page?.connected_instagram_account?.id, 200);
        if (id) add(id, token, "facebook-login", "page-fields");
      } catch {}
    }
  }

  for (const token of metaTokenCandidates()) {
    const accounts = await accountsForToken(token);
    for (const account of accounts) {
      const id = clean(account?.instagram_business_account?.id || account?.connected_instagram_account?.id, 200);
      if (id) add(id, clean(account?.access_token || token, 20000), "facebook-login", "linked-account");
    }
  }

  // Some older deployments stored an Instagram token under META_* names. Trying
  // the Instagram host as a final compatibility path is safe and keeps retries idempotent.
  add(instagramId, pageToken, "instagram-login", "instagram-host-compat");
  add(metaId, pageToken, "instagram-login", "meta-instagram-host-compat");

  return candidates;
}

async function publishInstagramWithAuth(post, auth) {
  const image = imageUrl(post);
  const get = auth.mode === "instagram-login" ? instagramLoginGet : graphGet;
  const postRequest = auth.mode === "instagram-login" ? instagramLoginPost : graphPost;
  const created = await postRequest(`${encodeURIComponent(auth.instagramUserId)}/media`, auth.token, {
    image_url: image,
    caption: postText(post),
  });
  const creationId = clean(created?.id, 300);
  if (!creationId) throw new Error("Instagram 未回傳媒體容器 ID");

  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 1500));
    try {
      const status = await get(creationId, auth.token, { fields: "status_code,status" });
      if (status?.status_code === "FINISHED") break;
      if (["ERROR", "EXPIRED"].includes(status?.status_code)) {
        throw new Error(status?.status || `Instagram 容器狀態：${status.status_code}`);
      }
      if (attempt === 11) throw new Error("Instagram 圖片處理尚未完成，請稍後重試");
    } catch (error) {
      if (attempt === 11 || /容器狀態|尚未完成/.test(error.message)) throw error;
    }
  }

  const published = await postRequest(`${encodeURIComponent(auth.instagramUserId)}/media_publish`, auth.token, {
    creation_id: creationId,
  });
  return {
    ...published,
    instagram_user_id: auth.instagramUserId,
    auth_source: auth.source,
    auth_mode: auth.mode,
  };
}

async function publishInstagram(post) {
  const image = imageUrl(post);
  if (!/^https:\\/\\//i.test(image)) throw new Error("Instagram 圖片必須是公開 HTTPS 網址");

  const candidates = await resolveInstagramAuthCandidates();
  if (!candidates.length) {
    throw new Error("找不到可嘗試的 Instagram 正式發布憑證組合");
  }

  const failures = [];
  for (const auth of candidates) {
    try {
      return await publishInstagramWithAuth(post, auth);
    } catch (error) {
      failures.push(`${auth.source}/${auth.mode}：${sanitizeMetaError(error?.message || error)}`);
    }
  }

  throw new Error(`Instagram 所有既有正式授權路徑均失敗：${failures.join("｜")}`.slice(0, 1750));
}

async function publishLine(post) {'''

pattern = re.compile(r'async function publishInstagram\(post\) \{.*?\n\}\n\nasync function publishLine\(post\) \{', re.S)
if not pattern.search(source):
    raise SystemExit('找不到 publishInstagram 區塊，停止修改')

updated, count = pattern.subn(replacement, source, count=1)
if count != 1:
    raise SystemExit(f'publishInstagram 區塊替換數異常: {count}')

# Bump bridge version so healthz proves the new runtime is live.
updated = updated.replace('const VERSION = "2.0.0-20260904";', 'const VERSION = "2.1.0-20260904-multi-instagram-auth";', 1)

path.write_text(updated, encoding='utf-8')
print('patched erp-publish-bridge.js with multi-mode Instagram auth candidates')
