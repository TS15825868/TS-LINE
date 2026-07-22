"use strict";

const VERSION = "1.0.0";
const inFlight = new Map();

function platformDone(post = {}, key) {
  return Boolean(post?.result?.[key])
    || post?.platformStatus?.[key] === "成功"
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
  publishOutcome,
  withPostLock,
  inFlightCount,
};
