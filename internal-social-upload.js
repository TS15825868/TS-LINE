"use strict";

const crypto = require("crypto");
const express = require("express");
const Module = require("module");

const VERSION = "1.0.0";
const COOKIE = "xjw_internal";
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const DEFAULT_BUCKET = "xjw-social-media";
const rawImage = express.raw({
  type: ["image/jpeg", "image/png", "image/webp", "application/octet-stream"],
  limit: MAX_IMAGE_BYTES,
});

const clean = (value, max = 500) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, "")
  .trim()
  .slice(0, max);

function secret() {
  return clean(process.env.INTERNAL_APP_SECRET || process.env.INTERNAL_APP_PASSWORD || process.env.SOCIAL_ADMIN_PIN, 500);
}

function readCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((part) => part.trim().split("="))
      .filter((item) => item.length === 2)
  );
}

function currentSession(req) {
  try {
    const value = readCookies(req)[COOKIE] || "";
    const [payload, signature] = value.split(".");
    if (!payload || !signature || !secret()) return null;
    const expected = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!parsed.user || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function requireApi(req, res, next) {
  const user = currentSession(req);
  if (!user) return res.status(401).json({ ok: false, error: "請重新登入" });
  req.internalUser = user;
  return next();
}

function requestGuard(req, res, next) {
  if (req.get("X-XJW-Requested-With") !== "internal-app-v2") {
    return res.status(403).json({ ok: false, error: "請從管理 App 操作" });
  }
  const origin = clean(req.get("Origin"), 500);
  if (origin) {
    try {
      if (new URL(origin).host !== req.get("host")) {
        return res.status(403).json({ ok: false, error: "來源驗證失敗" });
      }
    } catch {
      return res.status(403).json({ ok: false, error: "來源驗證失敗" });
    }
  }
  return next();
}

function storageConfig() {
  const url = String(process.env.SUPABASE_URL || "https://iphexhvjhsmelbgwzhhr.supabase.co").replace(/\/$/, "");
  const key = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const bucket = clean(process.env.SUPABASE_SOCIAL_BUCKET || DEFAULT_BUCKET, 80) || DEFAULT_BUCKET;
  return { url, key, bucket, enabled: Boolean(url && key) };
}

function storageHeaders(contentType = "application/json") {
  const { key } = storageConfig();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": contentType,
  };
}

function detectImage(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: "image/jpeg", extension: "jpg" };
  }
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: "image/png", extension: "png" };
  }
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return { mime: "image/webp", extension: "webp" };
  }
  return null;
}

function encodeObjectPath(path) {
  return String(path).split("/").map(encodeURIComponent).join("/");
}

function publicUrl(config, objectPath) {
  return `${config.url}/storage/v1/object/public/${encodeURIComponent(config.bucket)}/${encodeObjectPath(objectPath)}`;
}

let bucketReady = null;
async function ensurePublicBucket() {
  const config = storageConfig();
  if (!config.enabled) throw new Error("Supabase 儲存尚未設定，請先設定 SUPABASE_SECRET_KEY");
  if (bucketReady) return bucketReady;

  bucketReady = (async () => {
    const response = await fetch(`${config.url}/storage/v1/bucket`, {
      method: "POST",
      headers: storageHeaders(),
      body: JSON.stringify({
        id: config.bucket,
        name: config.bucket,
        public: true,
        file_size_limit: MAX_IMAGE_BYTES,
        allowed_mime_types: ["image/jpeg", "image/png", "image/webp"],
      }),
    });
    if (!response.ok && response.status !== 409) {
      const text = await response.text();
      if (!/already exists|duplicate/i.test(text)) {
        bucketReady = null;
        throw new Error(`建立圖片空間失敗（${response.status}）${text ? `：${text.slice(0, 180)}` : ""}`);
      }
    }
    return config;
  })();

  return bucketReady;
}

async function uploadToSupabase(buffer, detected) {
  const config = await ensurePublicBucket();
  const date = new Date();
  const folder = `${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  const objectPath = `${folder}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${detected.extension}`;
  const response = await fetch(`${config.url}/storage/v1/object/${encodeURIComponent(config.bucket)}/${encodeObjectPath(objectPath)}`, {
    method: "POST",
    headers: {
      ...storageHeaders(detected.mime),
      "x-upsert": "false",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
    body: buffer,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`圖片上傳失敗（${response.status}）${text ? `：${text.slice(0, 180)}` : ""}`);
  }
  return { url: publicUrl(config, objectPath), objectPath, bucket: config.bucket };
}

function uploadUi() {
  return `<div class="media-upload-card">
    <label>從手機或電腦選擇圖片
      <input id="socialImageFile" type="file" accept="image/jpeg,image/png,image/webp">
    </label>
    <div class="media-upload-actions">
      <button id="socialImageUploadBtn" class="btn gold" type="button">上傳圖片</button>
      <span id="socialImageStatus" class="muted">支援 JPG、PNG、WebP，最大 12 MB</span>
    </div>
    <img id="socialImagePreview" class="media-preview" alt="社群圖片預覽" hidden>
  </div>
  <label>圖片網址（上傳完成後會自動填入，也可自行貼上公開網址）
    <input id="socialImageUrl" name="imageUrl" type="url" inputmode="url" placeholder="選擇圖片後會自動產生網址">
  </label>`;
}

function injectUploadUi(html) {
  if (typeof html !== "string" || html.includes("id=\"socialImageFile\"")) return html;
  const original = '<label>公開圖片網址<input name="imageUrl" type="url" placeholder="https://..."></label>';
  if (!html.includes(original)) return html;

  const extraCss = `.media-upload-card{border:1px dashed #b08a45;border-radius:16px;padding:13px;background:#fffaf0;margin:10px 0}.media-upload-actions{display:flex;align-items:center;gap:9px;flex-wrap:wrap}.media-preview{display:block;width:min(360px,100%);aspect-ratio:1/1;object-fit:contain;background:#f7f4ed;border:1px solid #ded7ca;border-radius:14px;margin-top:12px}.uploading{opacity:.65;pointer-events:none}`;
  const extraJs = `<script>(()=>{const file=document.getElementById('socialImageFile'),button=document.getElementById('socialImageUploadBtn'),status=document.getElementById('socialImageStatus'),url=document.getElementById('socialImageUrl'),preview=document.getElementById('socialImagePreview'),form=document.getElementById('socialForm');if(!file||!button||!status||!url||!preview||!form)return;let uploading=false;function setStatus(text,isError=false){status.textContent=text;status.style.color=isError?'#8d2024':'#6b655d'}function showPreview(src){if(!src){preview.hidden=true;preview.removeAttribute('src');return}preview.src=src;preview.hidden=false}async function upload(){const image=file.files&&file.files[0];if(!image)return alert('請先選擇圖片');if(!['image/jpeg','image/png','image/webp'].includes(image.type))return alert('只支援 JPG、PNG 或 WebP 圖片');if(image.size>12*1024*1024)return alert('圖片不可超過 12 MB');uploading=true;button.classList.add('uploading');button.textContent='上傳中…';setStatus('正在上傳，請不要關閉畫面');showPreview(URL.createObjectURL(image));try{const response=await fetch('/internal/api/v2/social/upload',{method:'POST',headers:{'Content-Type':image.type,'X-XJW-Requested-With':'internal-app-v2','X-File-Name':encodeURIComponent(image.name||'social-image')},body:image});const data=await response.json().catch(()=>({ok:false,error:'系統回覆格式錯誤'}));if(response.status===401){location.href='/internal/login';return}if(!response.ok||data.ok===false)throw new Error(data.error||'上傳失敗');url.value=data.url;showPreview(data.url);setStatus('✓ 上傳完成，可以建立草稿');}catch(error){setStatus(error.message||'上傳失敗',true);alert(error.message||'上傳失敗');}finally{uploading=false;button.classList.remove('uploading');button.textContent='重新上傳圖片'}}button.addEventListener('click',upload);file.addEventListener('change',()=>{url.value='';setStatus('已選擇圖片，正在自動上傳');upload()});url.addEventListener('change',()=>{if(/^https:\/\//i.test(url.value))showPreview(url.value)});form.addEventListener('submit',event=>{if(uploading){event.preventDefault();event.stopImmediatePropagation();alert('圖片仍在上傳，請稍候');return}const instagram=form.querySelector('[name="publishInstagram"]');if(instagram?.checked&&!url.value){event.preventDefault();event.stopImmediatePropagation();alert('發布 Instagram 前請先選擇並上傳圖片')}},true)})();</script>`;

  return html
    .replace(original, uploadUi())
    .replace("</style>", `${extraCss}</style>`)
    .replace("</body>", `${extraJs}</body>`);
}

function mountUpload(app) {
  app.use("/internal/app", (req, res, next) => {
    const originalSend = res.send.bind(res);
    res.send = (body) => originalSend(injectUploadUi(body));
    next();
  });

  app.post("/internal/api/v2/social/upload", requireApi, requestGuard, rawImage, async (req, res) => {
    try {
      const buffer = req.body;
      if (!Buffer.isBuffer(buffer) || !buffer.length) {
        return res.status(400).json({ ok: false, error: "沒有收到圖片檔案" });
      }
      const detected = detectImage(buffer);
      if (!detected) {
        return res.status(415).json({ ok: false, error: "圖片格式不支援，請使用 JPG、PNG 或 WebP" });
      }
      const result = await uploadToSupabase(buffer, detected);
      return res.json({ ok: true, ...result, mimeType: detected.mime, size: buffer.length });
    } catch (error) {
      console.error("social image upload failed", error.message);
      return res.status(503).json({ ok: false, error: error.message || "圖片上傳失敗" });
    }
  });

  app.get("/internal/api/v2/social/upload-health", requireApi, (_req, res) => {
    const config = storageConfig();
    res.status(config.enabled ? 200 : 503).json({
      ok: config.enabled,
      version: VERSION,
      storage: config.enabled ? "supabase-storage" : "not-configured",
      bucket: config.bucket,
      maxBytes: MAX_IMAGE_BYTES,
    });
  });
}

let installed = false;
function installHook() {
  if (installed) return;
  installed = true;
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    const loaded = originalLoad.apply(this, arguments);
    if (request === "./internal-app" && parent?.filename?.endsWith("internal-entry.js") && loaded && !loaded.__xjwSocialUploadWrapped) {
      const originalMount = loaded.mountInternalApp;
      loaded.mountInternalApp = function mountWithSocialUpload(app) {
        mountUpload(app);
        return originalMount(app);
      };
      Object.defineProperty(loaded, "__xjwSocialUploadWrapped", { value: true });
    }
    return loaded;
  };
}

installHook();

module.exports = {
  VERSION,
  MAX_IMAGE_BYTES,
  DEFAULT_BUCKET,
  storageConfig,
  detectImage,
  publicUrl,
  injectUploadUi,
  uploadToSupabase,
  mountUpload,
  installHook,
};