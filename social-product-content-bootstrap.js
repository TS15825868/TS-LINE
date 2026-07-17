"use strict";

const Module = require("module");
const {
  VERSION,
  CAMPAIGN_ID,
  TOPICS,
  rebuildProductContentSchedule,
} = require("./social-product-content-rebuild");

const status = {
  ok: false,
  state: "waiting",
  version: VERSION,
  campaignId: CAMPAIGN_ID,
  activeTotal: 0,
  pendingReview: 0,
  preservedPublished: 0,
  preservedMascot: 0,
  firstAt: "",
  lastAt: "",
  error: "",
  updatedAt: new Date().toISOString(),
};

function setStatus(change) {
  Object.assign(status, change, { updatedAt: new Date().toISOString() });
}

function currentHealth(readStore) {
  const store = readStore();
  const posts = Array.isArray(store.posts) ? store.posts : [];
  const active = posts
    .filter((post) => post.campaignId === CAMPAIGN_ID && post.status !== "published")
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  const published = posts.filter((post) => post.campaignId === CAMPAIGN_ID && post.status === "published");
  const validImages = active.every((post) => /^https:\/\/ts15825868\.github\.io\/xianjiawei\//.test(String(post.imageUrl || "")));
  return {
    ok: active.length + published.length === TOPICS.length && validImages,
    state: active.length + published.length === TOPICS.length ? "ready" : "incomplete",
    version: VERSION,
    campaignId: CAMPAIGN_ID,
    activeTotal: active.length,
    published: published.length,
    pendingReview: active.filter((post) => post.status === "draft").length,
    approved: active.filter((post) => post.status === "approved").length,
    rejected: active.filter((post) => post.status === "rejected").length,
    firstAt: active[0]?.scheduledAt || "",
    lastAt: active.at(-1)?.scheduledAt || "",
    validImages,
    total: posts.length,
    updatedAt: new Date().toISOString(),
  };
}

let installed = false;
function install() {
  if (installed) return;
  installed = true;
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    const loaded = originalLoad.apply(this, arguments);
    if (request === "./social-server" && parent?.filename?.endsWith("internal-entry.js") && loaded?.app) {
      const before = loaded.readStore();
      const previousPosts = (Array.isArray(before.posts) ? before.posts : []).filter(
        (post) => post.campaignId === CAMPAIGN_ID
      );

      loaded.app.get("/internal/product-content-healthz", (_req, res) => {
        const health = currentHealth(loaded.readStore);
        res.status(health.ok ? 200 : 503).json(health);
      });

      setImmediate(() => {
        try {
          setStatus({ state: "rebuilding", error: "" });
          const result = rebuildProductContentSchedule(loaded.readStore, loaded.writeStore, { previousPosts });
          setStatus({ ok: true, state: "ready", ...result, error: "" });
          console.log("Approved product and brand social schedule rebuild", result);
        } catch (error) {
          setStatus({ ok: false, state: "failed", error: error.message || "product content rebuild failed" });
          console.error("Approved product and brand social schedule rebuild failed", error);
        }
      });
    }
    return loaded;
  };
}

install();

module.exports = { VERSION, CAMPAIGN_ID, status, currentHealth, install };
