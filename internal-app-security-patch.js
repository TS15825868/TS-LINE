"use strict";

const crypto = require("crypto");
const Module = require("module");

const COOKIE = "xjw_internal";
const clean = (value, max = 500) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);

function secret() {
  return clean(process.env.INTERNAL_APP_SECRET || process.env.INTERNAL_APP_PASSWORD || process.env.SOCIAL_ADMIN_PIN, 500);
}

function cookies(req) {
  return Object.fromEntries(String(req.headers.cookie || "").split(";").map((part) => part.trim().split("=")).filter((item) => item.length === 2));
}

function session(req) {
  try {
    const value = cookies(req)[COOKIE] || "";
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

function requireSignedIn(req, res, next) {
  const user = session(req);
  if (!user) return res.status(401).json({ ok: false, error: "請重新登入" });
  req.internalUser = user;
  return next();
}

function requireAdmin(req, res, next) {
  if (req.internalUser?.role !== "admin") return res.status(403).json({ ok: false, error: "只有管理員可以執行此操作" });
  return next();
}

let installed = false;
function install() {
  if (installed) return;
  installed = true;
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    const loaded = originalLoad.apply(this, arguments);
    if (request === "./internal-app" && parent?.filename?.endsWith("internal-entry.js") && loaded && !loaded.__xjwSecurityWrapped) {
      const originalMount = loaded.mountInternalApp;
      loaded.mountInternalApp = function mountWithSecurity(app) {
        app.get("/internal/api/v2/export/backup", requireSignedIn, requireAdmin, (_req, _res, next) => next());
        app.get("/internal/healthz", requireSignedIn, (_req, _res, next) => next());
        app.get("/internal/db-healthz", requireSignedIn, requireAdmin, (_req, _res, next) => next());
        return originalMount(app);
      };
      Object.defineProperty(loaded, "__xjwSecurityWrapped", { value: true });
    }
    return loaded;
  };
}

install();

module.exports = { install, session, requireSignedIn, requireAdmin };
