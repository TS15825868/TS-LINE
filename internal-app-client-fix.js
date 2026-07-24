"use strict";

const fs = require("fs");
const path = require("path");
const Module = require("module");
const { mountInternalSocialSite } = require("./internal-social-site");

const mountedApps = new WeakSet();
const RUNTIME_VERSION = "20260724-inventory-split-1";
const shellFile = path.join(__dirname, "internal-app-shell.js");
const runtimeFile = path.join(__dirname, "internal-app-runtime.js");
const uploadControllerFile = path.join(__dirname, "internal-app-upload-controller.js");
const formControllerFile = path.join(__dirname, "internal-app-form-controller.js");
const safeExtrasFile = path.join(__dirname, "internal-app-safe-extras.js");
const orderEntryFile = path.join(__dirname, "internal-order-entry-controller.js");
const socialRetryFile = path.join(__dirname, "internal-app-social-retry.js");
const socialFilterFile = path.join(__dirname, "internal-app-social-filter.js");
const facebookHealthFile = path.join(__dirname, "internal-app-facebook-health.js");
const reviewOnlyFile = path.join(__dirname, "internal-app-review-only.js");
const mobileFile = path.join(__dirname, "internal-app-mobile-stable.js");
const postbootFile = path.join(__dirname, "internal-app-postboot.js");

function readScript(file) { return fs.readFileSync(file, "utf8"); }
function shellScript() { return readScript(shellFile); }
function runtimeScript() { return readScript(runtimeFile); }
function uploadControllerScript() { return readScript(uploadControllerFile); }
function formControllerScript() { return readScript(formControllerFile); }
function safeExtrasScript() { return readScript(safeExtrasFile); }
function orderEntryScript() { return readScript(orderEntryFile); }
function socialRetryScript() { return readScript(socialRetryFile); }
function socialFilterScript() { return readScript(socialFilterFile); }
function facebookHealthScript() { return readScript(facebookHealthFile); }
function reviewOnlyScript() { return readScript(reviewOnlyFile); }
function mobileScript() { return readScript(mobileFile); }
function postbootScript() { return readScript(postbootFile); }

function recoveryPage(message = "管理 App 暫時無法顯示") {
  const safe = String(message || "").replace(/[&<>\"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[char]));
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta http-equiv="Cache-Control" content="no-store"><title>仙加味內部管理 App</title><style>body{margin:0;background:#f7f4ed;color:#24211d;font-family:-apple-system,BlinkMacSystemFont,"PingFang TC",sans-serif;display:grid;min-height:100vh;place-items:center;padding:20px}.box{width:min(520px,100%);background:#fff;border:1px solid #ded7ca;border-radius:24px;padding:24px;box-shadow:0 20px 60px #0b1f3b18}h1{margin:0 0 10px;color:#0b1f3b;font-size:24px}p{line-height:1.7}.btn{display:inline-block;border:0;border-radius:12px;padding:12px 16px;background:#0b1f3b;color:#fff;font-weight:800;font-size:16px}</style></head><body><main class="box"><h1>仙加味內部管理 App</h1><p>${safe}</p><button class="btn" type="button" onclick="location.replace('/internal/app?recovery='+Date.now())">重新載入 App</button></main></body></html>`;
}

function fixGeneratedHtml(body) {
  if (typeof body !== "string" || !body.includes("仙加味內部管理 App")) return body;
  if (!body.includes("<main") || !body.includes("</body>")) return recoveryPage("頁面資料不完整，請按下方按鈕重新載入。");

  const cleanHtml = body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  const orderStyle = '<style id="xjwOrderEntryOverride">#xjwProductPicker{display:none!important}html,body,.app-shell{visibility:visible!important;opacity:1!important}button,a[href],[data-view],summary,[role="button"]{touch-action:manipulation!important;pointer-events:auto!important}#xjwMobileBackdrop:not(.open),#xjwMobileSheet:not(.open){pointer-events:none!important}</style>';
  const recoveryScript = `<script>(function(){window.__xjwBootStarted=Date.now();setTimeout(function(){var shell=document.querySelector('.app-shell');if(!shell||!shell.children.length){document.body.innerHTML='<main style="max-width:520px;margin:12vh auto;padding:24px;background:#fff;border:1px solid #ded7ca;border-radius:22px;font-family:-apple-system,BlinkMacSystemFont,\'PingFang TC\',sans-serif"><h1 style="color:#0b1f3b">仙加味內部管理 App</h1><p>頁面載入逾時，可能剛好遇到系統部署。請重新載入，不會影響尚未審核的貼文。</p><button style="border:0;border-radius:12px;padding:12px 16px;background:#0b1f3b;color:#fff;font-weight:800" onclick="location.replace(\'/internal/app?recovery=\'+Date.now())">重新載入 App</button></main>';}},8000);}());</script>`;
  const scripts = [
    `/internal/app-shell.js?v=${RUNTIME_VERSION}`,
    `/internal/app-runtime.js?v=${RUNTIME_VERSION}`,
    `/internal/app-upload-controller.js?v=${RUNTIME_VERSION}`,
    `/internal/app-form-controller.js?v=${RUNTIME_VERSION}`,
    `/internal/app-safe-extras.js?v=${RUNTIME_VERSION}`,
    `/internal/order-entry-controller.js?v=${RUNTIME_VERSION}`,
    `/internal/app-mobile.js?v=${RUNTIME_VERSION}`,
    `/internal/app-postboot.js?v=${RUNTIME_VERSION}`,
  ].map((src) => `<script src="${src}"></script>`).join("");
  const splitScript = `<script>(function(){function split(){var tab=document.querySelector('nav.tabs [data-view="social"]');if(tab){var link=document.createElement('a');link.className=tab.className;link.href='/internal/social-center';link.textContent='社群網站';link.setAttribute('aria-label','開啟獨立社群管理網站');tab.replaceWith(link);}var socialSection=document.getElementById('social');if(socialSection)socialSection.remove();var metric=document.getElementById('mSocial');var card=metric&&metric.closest('.metric');if(card){card.setAttribute('role','link');card.setAttribute('tabindex','0');card.style.cursor='pointer';var label=card.querySelector('span');if(label)label.textContent='社群網站';card.onclick=function(){location.href='/internal/social-center'};card.onkeydown=function(event){if(event.key==='Enter'||event.key===' '){event.preventDefault();location.href='/internal/social-center'}};}}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',split,{once:true});else split();}());</script>`;
  return cleanHtml.replace("</body>", `${orderStyle}${recoveryScript}${scripts}${splitScript}</body>`);
}

function sendScript(res, source) {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
    "Content-Type": "application/javascript; charset=utf-8",
  }).send(source);
}

function mountClientFix(app) {
  if (!app || mountedApps.has(app)) return;
  mountedApps.add(app);
  mountInternalSocialSite(app);
  app.get("/internal/app-shell.js", (_req, res) => sendScript(res, shellScript()));
  app.get("/internal/app-runtime.js", (_req, res) => sendScript(res, runtimeScript()));
  app.get("/internal/app-upload-controller.js", (_req, res) => sendScript(res, uploadControllerScript()));
  app.get("/internal/app-form-controller.js", (_req, res) => sendScript(res, formControllerScript()));
  app.get("/internal/app-safe-extras.js", (_req, res) => sendScript(res, safeExtrasScript()));
  app.get("/internal/order-entry-controller.js", (_req, res) => sendScript(res, orderEntryScript()));
  app.get("/internal/app-social-retry.js", (_req, res) => sendScript(res, socialRetryScript()));
  app.get("/internal/app-social-filter.js", (_req, res) => sendScript(res, socialFilterScript()));
  app.get("/internal/app-facebook-health.js", (_req, res) => sendScript(res, facebookHealthScript()));
  app.get("/internal/app-review-only.js", (_req, res) => sendScript(res, reviewOnlyScript()));
  app.get("/internal/app-mobile.js", (_req, res) => sendScript(res, mobileScript()));
  app.get("/internal/app-postboot.js", (_req, res) => sendScript(res, postbootScript()));
  app.get("/internal/app-recovery", (_req, res) => res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
  }).status(503).send(recoveryPage("系統正在重新部署，請稍後按下重新載入。")));
  app.use("/internal/app", (_req, res, next) => {
    res.set({
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
      "Expires": "0",
    });
    const originalSend = res.send.bind(res);
    res.send = (body) => {
      try {
        return originalSend(fixGeneratedHtml(body));
      } catch (error) {
        console.error("internal app HTML recovery failed", error.message);
        return originalSend(recoveryPage("頁面處理失敗，請重新載入。"));
      }
    };
    next();
  });
}

let installed = false;
function installHook() {
  if (installed) return;
  installed = true;
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    const loaded = originalLoad.apply(this, arguments);
    if (request === "./internal-app" && parent?.filename?.endsWith("internal-entry.js") && loaded && !loaded.__xjwClientFixWrapped) {
      const originalMount = loaded.mountInternalApp;
      loaded.mountInternalApp = function mountWithClientFix(app) {
        mountClientFix(app);
        return originalMount(app);
      };
      Object.defineProperty(loaded, "__xjwClientFixWrapped", { value: true });
    }
    return loaded;
  };
}

installHook();

module.exports = {
  RUNTIME_VERSION,
  shellScript,
  runtimeScript,
  uploadControllerScript,
  formControllerScript,
  safeExtrasScript,
  orderEntryScript,
  socialRetryScript,
  socialFilterScript,
  facebookHealthScript,
  reviewOnlyScript,
  mobileScript,
  postbootScript,
  recoveryPage,
  fixGeneratedHtml,
  mountClientFix,
  installHook,
};
