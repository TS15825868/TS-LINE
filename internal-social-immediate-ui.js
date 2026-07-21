"use strict";

const Module = require("module");
const { requireSignedIn } = require("./internal-app-security-patch");

const VERSION = "1.0.0";

const CLIENT = String.raw`(() => {
  "use strict";
  const VERSION = "20260721-immediate-social-1";
  const HEADERS = {
    "Content-Type": "application/json",
    "X-XJW-Requested-With": "internal-app-v2",
  };

  function statusAllowsPublish(text = "") {
    return /已排程|失敗|部分成功/.test(String(text));
  }

  function scan() {
    document.querySelectorAll("#socialList > .item").forEach((card) => {
      const idNode = card.querySelector("[data-id]");
      const id = idNode?.dataset.id;
      if (!id) return;

      const edit = card.querySelector("[data-xjw-social-edit]");
      if (edit) edit.textContent = "編輯／改時間";

      const actions = card.querySelector(".actions");
      const status = card.querySelector(".pill")?.textContent || "";
      if (!actions || !statusAllowsPublish(status) || card.querySelector("[data-xjw-publish-now]")) return;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn gold xjw-safe-mini";
      button.dataset.xjwPublishNow = id;
      button.textContent = "立即發文";
      button.title = "立即同步發布到已勾選的 Facebook／Instagram，不必等待原排程時間";
      actions.prepend(button);
    });
  }

  async function publishNow(button) {
    const id = button.dataset.xjwPublishNow;
    if (!id) return;
    if (!confirm("確定要立即發布這篇貼文嗎？將同步發布到目前已勾選的平台。")) return;

    const original = button.textContent;
    button.disabled = true;
    button.textContent = "發布中…";
    try {
      const response = await fetch("/internal/api/v2/social/" + encodeURIComponent(id) + "/publish", {
        method: "POST",
        cache: "no-store",
        headers: HEADERS,
        body: "{}",
      });
      if (response.status === 401) {
        location.href = "/internal/login";
        return;
      }
      const data = await response.json().catch(() => ({ ok: false, error: "系統回覆格式錯誤" }));
      if (!response.ok || data.ok === false) throw new Error(data.error || "立即發布失敗");
      alert("已執行立即發文，請查看 Facebook／Instagram 狀態。");
      await window.loadAll?.();
    } catch (error) {
      alert(error.message || "立即發布失敗");
    } finally {
      button.disabled = false;
      button.textContent = original;
      scan();
    }
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-xjw-publish-now]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    publishNow(button);
  }, true);

  const observer = new MutationObserver(scan);
  const start = () => {
    scan();
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();

  window.xjwImmediateSocial = { version: VERSION, scan };
})();`;

let installed = false;

function install() {
  if (installed) return;
  installed = true;
  const originalLoad = Module._load;

  Module._load = function patchedLoad(request, parent, isMain) {
    const loaded = originalLoad.apply(this, arguments);
    if (
      request === "./internal-app" &&
      parent?.filename?.endsWith("internal-entry.js") &&
      loaded &&
      !loaded.__xjwImmediateSocialWrapped
    ) {
      const originalMount = loaded.mountInternalApp;
      loaded.mountInternalApp = function mountWithImmediateSocial(app) {
        app.get("/internal-social-immediate-ui.js", requireSignedIn, (_req, res) => {
          res.type("application/javascript").set("Cache-Control", "no-store").send(CLIENT);
        });

        app.use("/internal/app", (_req, res, next) => {
          const originalSend = res.send.bind(res);
          res.send = (body) => {
            if (typeof body === "string" && body.includes("</body>") && !body.includes("/internal-social-immediate-ui.js")) {
              body = body.replace("</body>", '<script src="/internal-social-immediate-ui.js?v=20260721-1"></script></body>');
            }
            return originalSend(body);
          };
          next();
        });

        return originalMount.apply(this, arguments);
      };
      Object.defineProperty(loaded, "__xjwImmediateSocialWrapped", { value: true });
    }
    return loaded;
  };
}

install();

module.exports = { VERSION, CLIENT, install };
