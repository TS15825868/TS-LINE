"use strict";

const { app } = require("./server");
const { facebookAuthHealth } = require("./facebook-page-token-bridge");

const VERSION = "1.0.0";
let cached = {
  ok: false,
  configured: false,
  usable: null,
  expired: false,
  checkedAt: "",
  error: "尚未檢查",
};
let checking = null;

async function checkFacebookHealth(force = false) {
  if (checking) return checking;
  checking = facebookAuthHealth({ force })
    .then((health) => {
      cached = {
        ok: health.usable === true,
        configured: health.configured === true,
        usable: health.usable,
        expired: health.expired === true,
        source: health.source || "",
        pageId: health.pageId || "",
        pageName: health.pageName || "",
        graphVersion: health.graphVersion || "",
        checkedAt: health.checkedAt || new Date().toISOString(),
        error: health.error || "",
      };
      return cached;
    })
    .catch((error) => {
      cached = {
        ok: false,
        configured: true,
        usable: false,
        expired: /expired|已過期/i.test(String(error.message || "")),
        checkedAt: new Date().toISOString(),
        error: String(error.message || "Facebook Token 檢查失敗").slice(0, 1000),
      };
      return cached;
    })
    .finally(() => { checking = null; });
  return checking;
}

app.get("/social/facebook-healthz", async (req, res) => {
  res.set("Cache-Control", "no-store, max-age=0");
  const force = String(req.query.refresh || "") === "1";
  const health = force || !cached.checkedAt ? await checkFacebookHealth(force) : cached;
  res.json({ service: "仙加味 Facebook 發布連線", version: VERSION, ...health });
});

setImmediate(() => checkFacebookHealth(true).catch(() => {}));
const timer = setInterval(() => checkFacebookHealth(true).catch(() => {}), 15 * 60 * 1000);
timer.unref?.();

module.exports = { VERSION, checkFacebookHealth };
