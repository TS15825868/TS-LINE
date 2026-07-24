"use strict";

const official = require("./social-official-rebuild");
const release = require("./social-final-release-20260724");

const VERSION = "2026-07-24-final-schedule-lock-v1";

official.rebuildOfficialSocialSchedule = function preserveFinalSocialSchedule(readStore, _writeStore) {
  const store = readStore();
  const posts = Array.isArray(store.posts) ? store.posts : [];
  const active = posts.filter((post) => post.status !== "published" && post.status !== "cancelled");
  const ordered = active.filter((post) => post.scheduledAt).sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  return {
    version: VERSION,
    campaignId: "xjw-social-first-batch-10-v1",
    imageVersion: release.CONTENT_VERSION,
    awaitingApprovedZip: false,
    missingFiles: [],
    preservedPublished: posts.filter((post) => post.status === "published").length,
    removedUnpublished: 0,
    inserted: 0,
    updated: 0,
    pendingReview: active.filter((post) => post.status === "draft").length,
    activeTotal: active.length,
    firstAt: ordered[0]?.scheduledAt || "",
    lastAt: ordered.at(-1)?.scheduledAt || "",
    total: posts.length,
    signature: VERSION,
    finalSchedulePreserved: true,
  };
};

module.exports = { VERSION };
