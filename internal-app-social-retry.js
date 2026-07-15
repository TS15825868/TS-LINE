"use strict";

(() => {
  const VERSION = "20260715-social-retry-1";
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
      || "";
  }

  function addPublishButton(card, post) {
    if (!["approved", "failed", "partial"].includes(post.status)) return;
    const actions = card.querySelector(".actions");
    if (!actions || actions.querySelector('[data-social-action="publish"]')) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn success";
    button.dataset.socialAction = "publish";
    button.dataset.id = post.id;

    const instagramDone = Boolean(post.result?.instagram) || post.platformStatus?.instagram === "成功";
    const facebookDone = Boolean(post.result?.facebook) || post.platformStatus?.facebook === "成功";
    button.textContent = post.status === "partial" || instagramDone || facebookDone
      ? "重試失敗平台"
      : post.status === "failed"
        ? "重新發布"
        : "立即發布";

    actions.insertAdjacentElement("afterbegin", button);
  }

  async function refresh() {
    if (running) return;
    const list = document.getElementById("socialList");
    if (!list) return;
    running = true;
    try {
      const state = await loadState();
      if (!state) return;
      const posts = Array.isArray(state.socialPosts) ? state.socialPosts : [];
      list.querySelectorAll(".item").forEach((card) => {
        const id = postIdFromCard(card);
        if (!id) return;
        const post = posts.find((item) => item.id === id);
        if (post) addPublishButton(card, post);
      });
    } catch (error) {
      console.warn("social retry controller", error.message);
    } finally {
      running = false;
    }
  }

  function start() {
    refresh();
    timer = setInterval(refresh, 2000);
    window.addEventListener("beforeunload", () => clearInterval(timer), { once: true });
    window.xjwSocialRetry = { version: VERSION, refresh };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
