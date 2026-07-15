"use strict";

(() => {
  const VERSION = "20260715-social-retry-2";
  const HEADERS = {
    "Content-Type": "application/json",
    "X-XJW-Requested-With": "internal-app-v2",
  };
  let running = false;
  let timer = null;

  async function loadState() {
    const response = await fetch(`/internal/api/v2/state?t=${Date.now()}`, {
      cache: "no-store",
      headers: HEADERS,
    });
    if (response.status === 401) {
      location.href = "/internal/login";
      return null;
    }
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) return null;
    return data;
  }

  function postIdFromCard(card) {
    return card.querySelector("[data-social-action][data-id]")?.dataset.id
      || card.querySelector("[data-xjw-social-edit]")?.dataset.xjwSocialEdit
      || card.querySelector("[data-xjw-social-duplicate]")?.dataset.xjwSocialDuplicate
      || card.querySelector("[data-id]")?.dataset.id
      || "";
  }

  function needsRetryFromCard(card) {
    const value = String(card.textContent || "");
    return value.includes("Facebook：失敗")
      || value.includes("Instagram：失敗")
      || value.includes("部分成功")
      || value.includes("Access Token 已過期");
  }

  function addPublishButton(card, post = null) {
    const actions = card.querySelector(".actions");
    if (!actions || actions.querySelector('[data-social-action="publish"]')) return;

    const id = post?.id || postIdFromCard(card);
    if (!id) return;

    const allowed = post
      ? ["approved", "failed", "partial"].includes(post.status)
      : needsRetryFromCard(card);
    if (!allowed) return;

    const instagramDone = Boolean(post?.result?.instagram) || post?.platformStatus?.instagram === "成功";
    const facebookDone = Boolean(post?.result?.facebook) || post?.platformStatus?.facebook === "成功";
    const retry = post?.status === "partial" || instagramDone || facebookDone || needsRetryFromCard(card);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn success";
    button.dataset.socialAction = "publish";
    button.dataset.id = id;
    button.textContent = retry ? "重試失敗平台" : post?.status === "failed" ? "重新發布" : "立即發布";
    actions.insertAdjacentElement("afterbegin", button);
  }

  async function refresh() {
    if (running) return;
    const list = document.getElementById("socialList");
    if (!list) return;
    running = true;
    try {
      const state = await loadState();
      const posts = Array.isArray(state?.socialPosts) ? state.socialPosts : [];
      list.querySelectorAll(".item").forEach((card) => {
        const id = postIdFromCard(card);
        const post = id ? posts.find((item) => item.id === id) : null;
        addPublishButton(card, post);
      });
    } catch (error) {
      console.warn("social retry controller", error.message);
      list.querySelectorAll(".item").forEach((card) => addPublishButton(card, null));
    } finally {
      running = false;
    }
  }

  function start() {
    refresh();
    timer = setInterval(refresh, 1000);
    document.addEventListener("xjw:app-refreshed", refresh);
    window.addEventListener("beforeunload", () => clearInterval(timer), { once: true });
    window.xjwSocialRetry = { version: VERSION, refresh };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();