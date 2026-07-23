"use strict";

const Module = require("module");

const VERSION = "1.0.0";
let installed = false;

const now = () => new Date().toISOString();

function manualCallFromApp() {
  return new Error().stack?.includes("internal-app-pro.js") === true;
}

function appendHistory(post, action, detail) {
  const history = Array.isArray(post.history) ? post.history.slice(-49) : [];
  history.push({ action, detail, createdAt: now(), actor: "內部管理 App" });
  return history;
}

function prepareManualImmediate(social, postId) {
  const store = social.readStore();
  const index = (store.posts || []).findIndex((post) => post.id === postId);
  if (index < 0) return null;
  const post = { ...store.posts[index] };
  if (["published", "publishing", "cancelled"].includes(String(post.status || ""))) return post;

  post.status = "approved";
  post.assetLocked = true;
  post.manualImmediatePublish = true;
  post.manualScheduleOverride = true;
  post.scheduleTimePolicy = "manual-immediate";
  if (!Number.isFinite(new Date(post.scheduledAt).getTime())) post.scheduledAt = now();
  post.approvedAt = post.approvedAt || now();
  post.updatedAt = now();
  post.lastError = "";
  post.history = appendHistory(post, "手動立即發布", "略過原排程時間，立即送往已勾選平台；已成功的平台不重複發布");
  store.posts[index] = post;
  social.writeStore(store);
  return post;
}

function wrapSocial(social) {
  if (!social || social.__xjwManualImmediateWrapped) return social;
  const originalExecute = social.execute.bind(social);
  social.execute = function executeWithManualOverride(postId) {
    if (manualCallFromApp()) prepareManualImmediate(social, postId);
    return originalExecute(postId);
  };
  Object.defineProperty(social, "__xjwManualImmediateWrapped", { value: true });
  return social;
}

function install() {
  if (installed) return;
  installed = true;
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    const loaded = originalLoad.apply(this, arguments);
    if (request === "./social-server") wrapSocial(loaded);
    return loaded;
  };
}

install();
module.exports = { VERSION, manualCallFromApp, appendHistory, prepareManualImmediate, wrapSocial, install };
