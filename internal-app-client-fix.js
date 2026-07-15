"use strict";

const Module = require("module");

const CLIENT_BINDINGS = [
  "mActive", "mCustomers", "mSales", "mLow", "mReminders", "mSocial", "mDb",
  "lastSync", "systemList", "todoList", "activityList",
  "orderSearch", "orderFilter", "orderList", "orderForm", "orderFormTitle",
  "customerSearch", "customerList", "customerForm", "customerFormTitle",
  "inventoryList", "reminderList", "reminderForm", "reminderFormTitle",
  "socialConfig", "socialList", "socialForm",
  "reportArea", "reportFrom", "reportTo", "staffList", "staffForm", "restoreForm",
];

const mountedApps = new WeakSet();
const RECOVERY_VERSION = "20260715-3";

function bindingScript() {
  return `const __xjwById=id=>document.getElementById(id);${CLIENT_BINDINGS.map((id) => `const ${id}=__xjwById(${JSON.stringify(id)});`).join("")}`;
}

function recoveryScript() {
  return `(()=>{"use strict";function show(id){document.querySelectorAll(".view").forEach(x=>x.classList.toggle("active",x.id===id));document.querySelectorAll("[data-view]").forEach(x=>x.classList.toggle("active",x.dataset.view===id));window.scrollTo(0,0)}window.showView=window.showView||show;document.addEventListener("click",e=>{const b=e.target.closest("[data-view]");if(!b)return;e.preventDefault();show(b.dataset.view)});document.addEventListener("DOMContentLoaded",()=>{document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>show(b.dataset.view)));if(typeof window.loadAll!=="function"){const h=document.querySelector(".top");if(h&&!document.getElementById("xjwClientWarning")){const n=document.createElement("div");n.id="xjwClientWarning";n.className="notice error";n.textContent="管理 App 前端正在修復模式，頁籤已恢復；請重新整理一次載入完整資料。";h.insertAdjacentElement("afterend",n)}}});})();`;
}

function fixGeneratedHtml(body) {
  if (typeof body !== "string" || !body.includes("仙加味內部管理 App")) return body;

  const brokenNewlineRegex = "replace(/\n/g";
  const fixedNewlineRegex = "replace(/\\n/g";
  let html = body.split(brokenNewlineRegex).join(fixedNewlineRegex);

  if (!html.includes("const __xjwById=")) {
    html = html.replace("<script>", `<script>${bindingScript()}`);
  }

  if (!html.includes("/internal/client-recovery.js")) {
    html = html.replace("</body>", `<script src="/internal/client-recovery.js?v=${RECOVERY_VERSION}"></script></body>`);
  }

  return html;
}

function mountClientFix(app) {
  if (!app || mountedApps.has(app)) return;
  mountedApps.add(app);

  app.get("/internal/client-recovery.js", (_req, res) => {
    res.set({
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "application/javascript; charset=utf-8",
    }).send(recoveryScript());
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
  CLIENT_BINDINGS,
  RECOVERY_VERSION,
  bindingScript,
  recoveryScript,
  fixGeneratedHtml,
  mountClientFix,
  installHook,
};