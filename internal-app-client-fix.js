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

function bindingScript() {
  return `const __xjwById=id=>document.getElementById(id);${CLIENT_BINDINGS.map((id) => `const ${id}=__xjwById(${JSON.stringify(id)});`).join("")}`;
}

function fixGeneratedHtml(body) {
  if (typeof body !== "string" || !body.includes("仙加味內部管理 App")) return body;

  // A \n escape inside the server-side template literal became a literal newline
  // inside a browser regex (replace(/<newline>/g)), which makes the entire inline
  // script invalid. Convert it back to a browser-side escaped newline matcher.
  const brokenNewlineRegex = "replace(/\n/g";
  const fixedNewlineRegex = "replace(/\\n/g";
  let html = body.split(brokenNewlineRegex).join(fixedNewlineRegex);

  // Safari does not reliably expose elements with an id as window globals.
  // Bind every element used by the management client explicitly.
  if (!html.includes("const __xjwById=")) {
    html = html.replace("<script>", `<script>${bindingScript()}`);
  }

  return html;
}

function mountClientFix(app) {
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

module.exports = { CLIENT_BINDINGS, bindingScript, fixGeneratedHtml, mountClientFix, installHook };
