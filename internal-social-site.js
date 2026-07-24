"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { session } = require("./internal-app-security-patch");

const VERSION = "2026-07-24-social-site-v3";
const ROOT = path.join(__dirname, "internal-social-site");
const FILES = {
  html: path.join(ROOT, "index.html.gz.b64"),
  css: path.join(ROOT, "site.css.gz.b64"),
  js: path.join(ROOT, "site.js.gz.b64"),
};

function read(file) {
  const encoded = fs.readFileSync(file, "utf8").replace(/\s+/g, "");
  return zlib.gunzipSync(Buffer.from(encoded, "base64")).toString("utf8");
}

function noCache(res, type) {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
    "Content-Type": type,
  });
  return res;
}

function requirePage(req, res, next) {
  const user = session(req);
  if (!user) return res.redirect(302, "/internal/login");
  req.internalUser = user;
  return next();
}

function requireAsset(req, res, next) {
  const user = session(req);
  if (!user) return res.status(401).type("text/plain").send("請重新登入");
  req.internalUser = user;
  return next();
}

function mountInternalSocialSite(app) {
  if (!app || app.locals?.xjwInternalSocialSiteMounted) return;
  app.locals.xjwInternalSocialSiteMounted = true;

  app.get("/internal/social-center-healthz", (_req, res) => {
    noCache(res, "application/json; charset=utf-8").json({
      ok: true,
      service: "仙加味社群管理中心",
      version: VERSION,
      mode: "independent-website",
      reviewRequiredBeforePublish: true,
      automaticRetryEnabled: false,
      inventoryApp: "/internal/app",
      socialWebsite: "/internal/social-center",
    });
  });
  app.get("/internal/social-center", requirePage, (_req, res) => {
    noCache(res, "text/html; charset=utf-8").send(
      read(FILES.html).replaceAll("__SOCIAL_SITE_VERSION__", VERSION)
    );
  });
  app.get("/internal/social-center/site.css", requireAsset, (_req, res) => {
    noCache(res, "text/css; charset=utf-8").send(read(FILES.css));
  });
  app.get("/internal/social-center/site.js", requireAsset, (_req, res) => {
    noCache(res, "application/javascript; charset=utf-8").send(
      read(FILES.js).replaceAll("__SOCIAL_SITE_VERSION__", VERSION)
    );
  });
  app.get("/internal/social", requirePage, (_req, res) => res.redirect(302, "/internal/social-center"));
}

module.exports = { VERSION, requirePage, requireAsset, mountInternalSocialSite };
