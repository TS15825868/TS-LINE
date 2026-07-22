"use strict";

const fs = require("fs");
const path = require("path");
const Module = require("module");

const mountedApps = new WeakSet();
const RUNTIME_VERSION = "20260722-social-6";
const shellFile = path.join(__dirname, "internal-app-shell.js");
const runtimeFile = path.join(__dirname, "internal-app-runtime.js");
const uploadControllerFile = path.join(__dirname, "internal-app-upload-controller.js");
const formControllerFile = path.join(__dirname, "internal-app-form-controller.js");
const safeExtrasFile = path.join(__dirname, "internal-app-safe-extras.js");
const orderEntryFile = path.join(__dirname, "internal-order-entry-controller.js");
const socialRetryFile = path.join(__dirname, "internal-app-social-retry.js");
const socialFilterFile = path.join(__dirname, "internal-app-social-filter.js");
const facebookHealthFile = path.join(__dirname, "internal-app-facebook-health.js");
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
function mobileScript() { return readScript(mobileFile); }
function postbootScript() { return readScript(postbootFile); }

function fixGeneratedHtml(body) {
  if (typeof body !== "string" || !body.includes("仙加味內部管理 App")) return body;
  const cleanHtml = body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  const orderStyle = '<style id="xjwOrderEntryOverride">#xjwProductPicker{display:none!important}</style>';
  const scripts = [
    `/internal/app-shell.js?v=${RUNTIME_VERSION}`,
    `/internal/app-runtime.js?v=${RUNTIME_VERSION}`,
    `/internal/app-upload-controller.js?v=${RUNTIME_VERSION}`,
    `/internal/app-form-controller.js?v=${RUNTIME_VERSION}`,
    `/internal/app-safe-extras.js?v=${RUNTIME_VERSION}`,
    `/internal/order-entry-controller.js?v=${RUNTIME_VERSION}`,
    `/internal/app-social-retry.js?v=${RUNTIME_VERSION}`,
    `/internal/app-social-filter.js?v=${RUNTIME_VERSION}`,
    `/internal/app-facebook-health.js?v=${RUNTIME_VERSION}`,
    `/internal/app-mobile.js?v=${RUNTIME_VERSION}`,
    `/internal/app-postboot.js?v=${RUNTIME_VERSION}`,
  ].map((src) => `<script src="${src}"></script>`).join("");
  return cleanHtml.replace("</body>", `${orderStyle}${scripts}</body>`);
}

function sendScript(res, source) {
  res.set({
    "Cache-Control": "no-store, max-age=0",
    "Content-Type": "application/javascript; charset=utf-8",
  }).send(source);
}

function mountClientFix(app) {
  if (!app || mountedApps.has(app)) return;
  mountedApps.add(app);
  app.get("/internal/app-shell.js", (_req, res) => sendScript(res, shellScript()));
  app.get("/internal/app-runtime.js", (_req, res) => sendScript(res, runtimeScript()));
  app.get("/internal/app-upload-controller.js", (_req, res) => sendScript(res, uploadControllerScript()));
  app.get("/internal/app-form-controller.js", (_req, res) => sendScript(res, formControllerScript()));
  app.get("/internal/app-safe-extras.js", (_req, res) => sendScript(res, safeExtrasScript()));
  app.get("/internal/order-entry-controller.js", (_req, res) => sendScript(res, orderEntryScript()));
  app.get("/internal/app-social-retry.js", (_req, res) => sendScript(res, socialRetryScript()));
  app.get("/internal/app-social-filter.js", (_req, res) => sendScript(res, socialFilterScript()));
  app.get("/internal/app-facebook-health.js", (_req, res) => sendScript(res, facebookHealthScript()));
  app.get("/internal/app-mobile.js", (_req, res) => sendScript(res, mobileScript()));
  app.get("/internal/app-postboot.js", (_req, res) => sendScript(res, postbootScript()));
  app.use("/internal/app", (_req, res, next) => {
    const originalSend = res.send.bind(res);
    res.send = (body) => originalSend(fixGeneratedHtml(body));
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
  mobileScript,
  postbootScript,
  fixGeneratedHtml,
  mountClientFix,
  installHook,
};
