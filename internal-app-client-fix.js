"use strict";

const fs = require("fs");
const path = require("path");
const Module = require("module");

const mountedApps = new WeakSet();
const RUNTIME_VERSION = "20260715-4";
const runtimeFile = path.join(__dirname, "internal-app-runtime.js");

function runtimeScript() {
  return fs.readFileSync(runtimeFile, "utf8");
}

function fixGeneratedHtml(body) {
  if (typeof body !== "string" || !body.includes("仙加味內部管理 App")) return body;

  let html = body.replace(
    /<script>[\s\S]*?<\/script>/,
    `<script src="/internal/app-runtime.js?v=${RUNTIME_VERSION}"></script>`
  );

  if (!html.includes("/internal/app-runtime.js")) {
    html = html.replace("</body>", `<script src="/internal/app-runtime.js?v=${RUNTIME_VERSION}"></script></body>`);
  }

  return html;
}

function mountClientFix(app) {
  if (!app || mountedApps.has(app)) return;
  mountedApps.add(app);

  app.get("/internal/app-runtime.js", (_req, res) => {
    res.set({
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "application/javascript; charset=utf-8",
    }).send(runtimeScript());
  });

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
  runtimeScript,
  fixGeneratedHtml,
  mountClientFix,
  installHook,
};