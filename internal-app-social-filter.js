"use strict";

(() => {
  const VERSION = "20260715-social-filter-1";
  const H = { "Content-Type": "application/json", "X-XJW-Requested-With": "internal-app-v2" };
  const GROUPS = {
    all: { label: "全部", statuses: null },
    review: { label: "待審核", statuses: ["draft", "rejected"] },
    approved: { label: "已審核", statuses: ["approved", "publishing"] },
    published: { label: "已發佈", statuses: ["published"] },
    unpublished: { label: "未發佈", statuses: ["failed", "partial", "cancelled"] },
  };
  let active = "all";
  let posts = [];
  let timer = null;

  async function loadPosts() {
    const response = await fetch(`/internal/api/v2/state?t=${Date.now()}`, { cache: "no-store", headers: H });
    if (response.status === 401) {
      location.href = "/internal/login";
      return [];
    }
    const data = await response.json().catch(() => ({}));
    return Array.isArray(data.socialPosts) ? data.socialPosts : [];
  }

  function postId(card) {
    return card.querySelector("[data-social-action][data-id]")?.dataset.id
      || card.querySelector("[data-xjw-social-edit]")?.dataset.xjwSocialEdit
      || card.querySelector("[data-xjw-social-duplicate]")?.dataset.xjwSocialDuplicate
      || card.querySelector("[data-id]")?.dataset.id
      || "";
  }

  function groupFor(post) {
    if (!post) return "all";
    if (["draft", "rejected"].includes(post.status)) return "review";
    if (["approved", "publishing"].includes(post.status)) return "approved";
    if (post.status === "published") return "published";
    if (["failed", "partial", "cancelled"].includes(post.status)) return "unpublished";
    return "unpublished";
  }

  function countFor(key) {
    if (key === "all") return posts.length;
    return posts.filter((post) => groupFor(post) === key).length;
  }

  function installToolbar() {
    const list = document.getElementById("socialList");
    if (!list || document.getElementById("xjwSocialFilters")) return;
    const toolbar = document.createElement("div");
    toolbar.id = "xjwSocialFilters";
    toolbar.className = "xjw-safe-toolbar";
    toolbar.style.cssText = "position:sticky;top:74px;z-index:8;background:#f7f4ed;padding:8px 0;display:flex;gap:8px;flex-wrap:wrap";
    toolbar.innerHTML = Object.entries(GROUPS).map(([key, item]) =>
      `<button type="button" class="btn soft" data-social-filter="${key}">${item.label} <span data-filter-count="${key}">0</span></button>`
    ).join("");
    list.insertAdjacentElement("beforebegin", toolbar);
    toolbar.addEventListener("click", (event) => {
      const button = event.target.closest("[data-social-filter]");
      if (!button) return;
      active = button.dataset.socialFilter || "all";
      apply();
    });
  }

  function apply() {
    installToolbar();
    document.querySelectorAll("[data-filter-count]").forEach((node) => {
      node.textContent = `(${countFor(node.dataset.filterCount)})`;
    });
    document.querySelectorAll("[data-social-filter]").forEach((button) => {
      const selected = button.dataset.socialFilter === active;
      button.classList.toggle("primary", selected);
      button.classList.toggle("soft", !selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });
    const list = document.getElementById("socialList");
    if (!list) return;
    list.querySelectorAll(":scope > .item").forEach((card) => {
      const id = postId(card);
      const post = posts.find((item) => item.id === id);
      const visible = active === "all" || groupFor(post) === active;
      card.hidden = !visible;
      card.dataset.socialGroup = groupFor(post);
    });
  }

  async function refresh() {
    try {
      posts = await loadPosts();
      apply();
    } catch (error) {
      console.warn("social filter refresh", error.message);
    }
  }

  function start() {
    installToolbar();
    refresh();
    timer = setInterval(refresh, 5000);
    window.addEventListener("beforeunload", () => clearInterval(timer), { once: true });
    window.addEventListener("xjw:app-refreshed", refresh);
    window.xjwSocialFilter = { version: VERSION, refresh, apply, get active() { return active; } };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
