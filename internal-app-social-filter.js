"use strict";

(() => {
  const VERSION = "20260720-social-review-2";
  const H = { "Content-Type": "application/json", "X-XJW-Requested-With": "internal-app-v2" };
  const PAGE_SIZE = 8;
  const GROUPS = {
    review: { label: "待審核", statuses: ["draft", "rejected"] },
    scheduled: { label: "已排程", statuses: ["approved", "paused", "publishing"] },
    failed: { label: "發布失敗", statuses: ["failed", "partial"] },
    published: { label: "已發布", statuses: ["published"] },
    cancelled: { label: "已取消", statuses: ["cancelled"] },
    all: { label: "全部", statuses: null },
  };
  const STATUS_LABELS = {
    draft: "待審核",
    rejected: "退回修改",
    approved: "已通過／等待發布",
    paused: "已暫停",
    publishing: "發布中",
    failed: "發布失敗",
    partial: "部分成功",
    published: "已發布",
    cancelled: "已取消",
  };
  let active = "review";
  let posts = [];
  let timer = null;
  let page = 1;

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
    for (const [key, group] of Object.entries(GROUPS)) {
      if (group.statuses?.includes(post.status)) return key;
    }
    return "all";
  }

  function countFor(key) {
    if (key === "all") return posts.length;
    return posts.filter((post) => groupFor(post) === key).length;
  }

  function taipeiParts(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  }

  function targetSlot(post) {
    const parts = taipeiParts(post?.scheduledAt);
    return Boolean(parts && ["Wed", "Fri"].includes(parts.weekday) && parts.hour === "20" && parts.minute === "00");
  }

  function localMonth(value) {
    const parts = taipeiParts(value);
    return parts ? `${parts.year}-${parts.month}` : "";
  }

  function nextTargetInput() {
    const earliest = Date.now() + 24 * 60 * 60 * 1000;
    const parts = taipeiParts(earliest);
    if (!parts) return "";
    for (let offset = 0; offset < 14; offset += 1) {
      const localDate = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + offset));
      const day = localDate.getUTCDay();
      if (day !== 3 && day !== 5) continue;
      const candidate = Date.UTC(localDate.getUTCFullYear(), localDate.getUTCMonth(), localDate.getUTCDate(), 12, 0, 0);
      if (candidate < earliest) continue;
      return `${localDate.getUTCFullYear()}-${String(localDate.getUTCMonth() + 1).padStart(2, "0")}-${String(localDate.getUTCDate()).padStart(2, "0")}T20:00`;
    }
    return "";
  }

  function installScheduleDefault() {
    const form = document.getElementById("socialForm");
    const field = form?.elements?.scheduledAt;
    if (!form || !field || form.dataset.xjwScheduleDefault === "1") return;
    form.dataset.xjwScheduleDefault = "1";
    const applyDefault = () => {
      const editing = Boolean(form.elements.socialEditId?.value);
      if (!editing) field.value = nextTargetInput();
    };
    if (!field.value) applyDefault();
    form.addEventListener("reset", () => setTimeout(applyDefault, 0));
    const hint = document.createElement("div");
    hint.className = "meta";
    hint.textContent = "固定排程：每週三、週五晚上 20:00";
    field.closest("label")?.appendChild(hint);
  }

  function installStyles() {
    if (document.getElementById("xjwSocialReviewStyles")) return;
    const style = document.createElement("style");
    style.id = "xjwSocialReviewStyles";
    style.textContent = `
      #xjwSocialReviewTools{position:sticky;top:68px;z-index:9;background:#f7f4ed;padding:9px 0 10px;border-bottom:1px solid #ded7ca}
      #xjwSocialReviewTools .xjw-social-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
      #xjwSocialReviewTools input{margin:0;max-width:260px}
      #xjwSocialReviewTools input[type="month"]{max-width:170px}
      #xjwSocialSummary{margin:0 0 9px;line-height:1.65}
      #xjwSocialPager{display:flex;gap:8px;align-items:center;justify-content:center;margin:12px 0}
      #xjwSocialPager button:disabled{opacity:.45;cursor:not-allowed}
      #socialList>.item[hidden]{display:none!important}
      #socialList>.item{scroll-margin-top:190px}
      .xjw-social-warning{border-color:#d59678!important;background:#fff9f2!important}
      @media(max-width:760px){#xjwSocialReviewTools{top:0}#xjwSocialReviewTools input{max-width:none;flex:1 1 100%}}
    `;
    document.head.appendChild(style);
  }

  function installToolbar() {
    const list = document.getElementById("socialList");
    if (!list || document.getElementById("xjwSocialReviewTools")) return;
    installStyles();
    const toolbar = document.createElement("div");
    toolbar.id = "xjwSocialReviewTools";
    toolbar.innerHTML = `
      <div id="xjwSocialSummary" class="notice ok"></div>
      <div class="xjw-social-row">
        ${Object.entries(GROUPS).map(([key, item]) => `<button type="button" class="btn soft" data-social-filter="${key}">${item.label} <span data-filter-count="${key}">0</span></button>`).join("")}
      </div>
      <div class="xjw-social-row" style="margin-top:8px">
        <input id="xjwSocialSearch" placeholder="搜尋標題或文案">
        <input id="xjwSocialMonth" type="month" aria-label="篩選月份">
        <button id="xjwSocialClear" type="button" class="btn soft">清除篩選</button>
      </div>`;
    list.insertAdjacentElement("beforebegin", toolbar);
    const pager = document.createElement("div");
    pager.id = "xjwSocialPager";
    pager.innerHTML = '<button type="button" class="btn soft" data-social-page="prev">上一頁</button><span id="xjwSocialPageText"></span><button type="button" class="btn soft" data-social-page="next">下一頁</button>';
    list.insertAdjacentElement("afterend", pager);

    toolbar.addEventListener("click", (event) => {
      const button = event.target.closest("[data-social-filter]");
      if (button) {
        active = button.dataset.socialFilter || "review";
        page = 1;
        apply();
        return;
      }
      if (event.target.closest("#xjwSocialClear")) {
        document.getElementById("xjwSocialSearch").value = "";
        document.getElementById("xjwSocialMonth").value = "";
        page = 1;
        apply();
      }
    });
    document.getElementById("xjwSocialSearch")?.addEventListener("input", () => { page = 1; apply(); });
    document.getElementById("xjwSocialMonth")?.addEventListener("change", () => { page = 1; apply(); });
    pager.addEventListener("click", (event) => {
      const direction = event.target.closest("[data-social-page]")?.dataset.socialPage;
      if (!direction) return;
      page += direction === "next" ? 1 : -1;
      apply();
      document.getElementById("xjwSocialReviewTools")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function sortedFilteredPosts() {
    const search = String(document.getElementById("xjwSocialSearch")?.value || "").trim().toLowerCase();
    const month = document.getElementById("xjwSocialMonth")?.value || "";
    const filtered = posts.filter((post) => {
      if (active !== "all" && groupFor(post) !== active) return false;
      if (month && localMonth(post.scheduledAt) !== month) return false;
      if (search && ![post.title, post.instagramCaption, post.facebookCaption, post.status].join(" ").toLowerCase().includes(search)) return false;
      return true;
    });
    const newestFirst = ["published", "cancelled"].includes(active);
    return filtered.sort((a, b) => newestFirst
      ? new Date(b.publishedAt || b.updatedAt || b.createdAt) - new Date(a.publishedAt || a.updatedAt || a.createdAt)
      : new Date(a.scheduledAt) - new Date(b.scheduledAt));
  }

  function decorateCard(card, post) {
    card.dataset.socialGroup = groupFor(post);
    card.classList.toggle("xjw-social-warning", !targetSlot(post) && post.status !== "cancelled" && post.status !== "published");
    const pill = card.querySelector(".pill");
    if (pill) pill.textContent = STATUS_LABELS[post.status] || post.status || "未知";
    const actions = card.querySelector(".actions");
    if (!actions) return;

    actions.querySelectorAll('[data-social-action="delete"]').forEach((button) => {
      button.hidden = !["draft", "rejected", "cancelled", "failed"].includes(post.status);
    });
    actions.querySelectorAll("[data-xjw-social-edit]").forEach((button) => {
      button.hidden = ["published", "publishing"].includes(post.status);
    });
    if (["approved", "failed", "partial"].includes(post.status) && !actions.querySelector('[data-social-action="pause"]')) {
      actions.insertAdjacentHTML("beforeend", `<button class="btn gold" data-social-action="pause" data-id="${post.id}">暫停</button>`);
    }
    if (post.status === "paused" && !actions.querySelector('[data-social-action="resume"]')) {
      actions.insertAdjacentHTML("afterbegin", `<button class="btn success" data-social-action="resume" data-id="${post.id}">重新檢查並恢復</button>`);
    }
  }

  function updateSummary() {
    const activePosts = posts.filter((post) => !["published", "cancelled"].includes(post.status));
    const scheduled = activePosts.filter((post) => ["approved", "paused", "publishing", "failed", "partial"].includes(post.status));
    const future = activePosts.filter((post) => new Date(post.scheduledAt).getTime() >= Date.now()).sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
    const invalid = activePosts.filter((post) => !targetSlot(post)).length;
    const slots = new Map();
    let duplicates = 0;
    activePosts.forEach((post) => {
      const date = new Date(post.scheduledAt);
      if (Number.isNaN(date.getTime())) return;
      const key = date.toISOString().slice(0, 16);
      if (slots.has(key)) duplicates += 1;
      slots.set(key, true);
    });
    const last = future.at(-1);
    const lastText = last ? new Date(last.scheduledAt).toLocaleString("zh-TW", { hour12: false, timeZone: "Asia/Taipei" }) : "目前沒有未來排程";
    const summary = document.getElementById("xjwSocialSummary");
    if (!summary) return;
    summary.className = `notice ${invalid || duplicates ? "error" : "ok"}`;
    summary.textContent = `固定每週 2 篇｜週三、週五 20:00｜待審 ${countFor("review")} 篇｜排程／暫停 ${scheduled.length} 篇｜排至 ${lastText}${invalid ? `｜${invalid} 篇日期不合規` : ""}${duplicates ? `｜${duplicates} 個重複時段` : ""}`;
  }

  function apply() {
    installToolbar();
    installScheduleDefault();
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
    const cards = [...list.querySelectorAll(":scope > .item")];
    const cardMap = new Map(cards.map((card) => [postId(card), card]).filter(([id]) => id));
    const filtered = sortedFilteredPosts();
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    page = Math.min(Math.max(1, page), totalPages);
    const visibleIds = new Set(filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((post) => post.id));

    filtered.forEach((post) => {
      const card = cardMap.get(post.id);
      if (card) list.appendChild(card);
    });
    cards.forEach((card) => {
      const id = postId(card);
      const post = posts.find((item) => item.id === id);
      card.hidden = !post || !visibleIds.has(id);
      if (post) decorateCard(card, post);
    });

    const pageText = document.getElementById("xjwSocialPageText");
    if (pageText) pageText.textContent = `${filtered.length} 篇｜第 ${page} / ${totalPages} 頁`;
    document.querySelector('[data-social-page="prev"]')?.toggleAttribute("disabled", page <= 1);
    document.querySelector('[data-social-page="next"]')?.toggleAttribute("disabled", page >= totalPages);
    updateSummary();
  }

  async function refresh() {
    try {
      posts = await loadPosts();
      apply();
    } catch (error) {
      console.warn("social review refresh", error.message);
    }
  }

  function start() {
    installToolbar();
    installScheduleDefault();
    refresh();
    timer = setInterval(refresh, 5000);
    window.addEventListener("beforeunload", () => clearInterval(timer), { once: true });
    window.addEventListener("xjw:app-refreshed", refresh);
    window.xjwSocialFilter = { version: VERSION, refresh, apply, get active() { return active; } };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
