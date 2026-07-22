"use strict";

const crypto = require("crypto");

const VERSION = "2.0.0";
const inFlight = new Map();
const DONE_LABELS = new Set(["成功", "已略過重複", "已發布"]);

function platformDone(post = {}, key) {
  return Boolean(post?.result?.[key])
    || DONE_LABELS.has(String(post?.platformStatus?.[key] || ""))
    || Boolean(post?.[`${key}PublishedAt`]);
}

function platformEnabled(post = {}, key) {
  if (key === "instagram") return Boolean(post.publishInstagram);
  if (key === "facebook") return Boolean(post.publishFacebook);
  return false;
}

function requestedPlatforms(post = {}) {
  return ["instagram", "facebook"].filter((key) => platformEnabled(post, key));
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeAsset(post = {}) {
  const source = normalizeText(post.sourceImageFile || post.imageName || "");
  if (source) return source.toLowerCase();
  try {
    const url = new URL(String(post.imageUrl || ""));
    return `${url.hostname.toLowerCase()}${decodeURIComponent(url.pathname).toLowerCase()}`;
  } catch {
    return normalizeText(post.imageUrl).toLowerCase();
  }
}

function platformCaption(post = {}, key) {
  return key === "facebook"
    ? normalizeText(post.facebookCaption || post.instagramCaption)
    : normalizeText(post.instagramCaption);
}

function platformFingerprint(post = {}, key) {
  const payload = [
    String(key || "").toLowerCase(),
    normalizeText(post.title).toLowerCase(),
    platformCaption(post, key).toLowerCase(),
    normalizeAsset(post),
  ].join("\n");
  return crypto.createHash("sha256").update(payload).digest("hex");
}

function ledgerEntry(store = {}, key, fingerprint) {
  return store?.publicationLedger?.[key]?.[fingerprint] || null;
}

function findPublishedMatch(store = {}, post = {}, key) {
  const fingerprint = platformFingerprint(post, key);
  const ledger = ledgerEntry(store, key, fingerprint);
  if (ledger) return { ...ledger, fingerprint, source: "ledger" };

  const match = (store.posts || []).find((candidate) => {
    if (!candidate || candidate.id === post.id) return false;
    return platformDone(candidate, key) && platformFingerprint(candidate, key) === fingerprint;
  });
  if (!match) return null;
  return {
    fingerprint,
    source: "post-history",
    postId: match.id,
    platformId: match.result?.[key]?.id || match.result?.[key]?.post_id || "",
    publishedAt: match[`${key}PublishedAt`] || match.publishedAt || match.updatedAt || "",
  };
}

function recordPublication(store = {}, post = {}, key, result = {}, publishedAt = new Date().toISOString()) {
  const fingerprint = platformFingerprint(post, key);
  store.publicationLedger = { ...(store.publicationLedger || {}) };
  store.publicationLedger[key] = { ...(store.publicationLedger[key] || {}) };
  store.publicationLedger[key][fingerprint] = {
    postId: post.id,
    platformId: result?.id || result?.post_id || "",
    publishedAt,
    sourceImageFile: post.sourceImageFile || post.imageName || "",
    title: post.title || "",
  };
  return fingerprint;
}

function publishOutcome(post = {}) {
  const requested = requestedPlatforms(post);
  const completed = requested.filter((key) => platformDone(post, key));
  const allDone = requested.length > 0 && completed.length === requested.length;
  const anyDone = completed.length > 0;
  return {
    requested,
    completed,
    allDone,
    anyDone,
    status: allDone ? "published" : anyDone ? "partial" : "failed",
  };
}

function withPostLock(postId, task) {
  const key = String(postId || "").trim();
  if (!key) return Promise.resolve().then(task);
  if (inFlight.has(key)) return inFlight.get(key);
  let operation;
  operation = Promise.resolve()
    .then(task)
    .finally(() => {
      if (inFlight.get(key) === operation) inFlight.delete(key);
    });
  inFlight.set(key, operation);
  return operation;
}

function inFlightCount() {
  return inFlight.size;
}

module.exports = {
  VERSION,
  platformDone,
  platformEnabled,
  requestedPlatforms,
  normalizeText,
  normalizeAsset,
  platformCaption,
  platformFingerprint,
  findPublishedMatch,
  recordPublication,
  publishOutcome,
  withPostLock,
  inFlightCount,
};
