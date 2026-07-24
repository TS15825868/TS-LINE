"use strict";

(() => {
  const VERSION = "20260724-social-final-1";
  const H = { "Content-Type": "application/json", "X-XJW-Requested-With": "internal-app-v2" };
  const PAGE_SIZE = 8;
  const ACTIVE_STATUSES = new Set(["draft", "rejected", "approved", "paused", "publishing", "failed", "partial"]);
  const FIXED_ACTIVE_STATUSES = new Set(["approved", "paused", "publishing", "failed", "partial"]);
  const GROUPS = {
    review: { label: "待審核", test: (post) => ["draft", "rejected"].includes(post.status) },
    scheduled: { label: "固定排程", test: (post) => FIXED_ACTIVE_STATUSES.has(post.status) && !isWeatherPost(post) },
    weather: { label: "氣候例外", test: (post) => isWeatherPost(post) && !["published", "cancelled"].includes(post.status) },
    failed: { label: "發布失敗", test: (post) => ["failed", "partial"].includes(post.status) },
    published: { label: "已發布", test: (post) => post.status === "published" },
    cancelled: { label: "已取消", test: (post) => post.status === "cancelled" },
    all: { label: "全部", test: () => true },
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

  function isWeatherPost(post = {}) {
    return post.oneTimeWeatherPost === true
      || post.conditionalWeather === true
      || post.automationStandby === true
      || Boolean(post.weatherTrigger);
  }

  function isWeatherStandby(post = {}) {
    return isWeatherPost(post)
      && post.automationStandby === true
      && post.status === "paused"
      && !post.scheduledAt;
  }

  function validTargetSlot(post = {}) {
    if (isWeatherStandby(post)) return true;
    const parts = taipeiParts(post.scheduledAt);
    if (!parts) return false;
    if (isWeatherPost(post)) return parts.hour === "10" && parts.minute === "00";
    return ["Wed", "Fri"].includes(parts.weekday) && parts.hour === "10" && parts.minute === "00";
  }

  function groupFor(post) {
    if (!post) return "all";
    for (const [key, group] of Object.entries(GROUPS)) {
      if (key !== "all" && group.test(post)) return key;
    }
    return "all";
  }

  function countFor(key) {
    return posts.filter((post) => GROUPS[key]?.test(post)).length;
  }

  function localMonth(value) {
    const parts = taipeiParts(value);
    return parts ? `${parts.year}-${parts.month}` : "";
  }

  function nextTargetInput() {
    const earliest = Date.now() + 60 * 60 * 1000;
    const nowParts = taipeiParts(earliest);
    if (!nowParts) return "";
    for (let offset = 0; offset < 21; offset += 1) {
      const localDate = new Date(Date.UTC(Number(nowParts.year), Number(nowParts.month) - 1, Number(nowParts.day) + offset));
      const day = localDate.getUTCDay();
      if (day !== 3 && day !== 5) continue;
      const hour = 10;
      const minute = 0;
      const utcCandidate = Date.UTC(localDate.getUTCFullYear(), localDate.getUTCMonth(), localDate.getUTCDate(), hour - 8, minute, 0);
      if (utcCandidate < earliest) continue;
      return `${localDate.getUTCFullYear()}-${String(localDate.getUTCMonth() + 1).padStart(2, "0")}-${String(localDate.getUTCDate()).padStart(2, "0")}T10:00`;
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
    hint.id = "xjwSocialScheduleHint";
    hint.className = "meta";
    hint.textContent = "固定排程：每週三、週五上午 10:00；氣候與補水依萬華實際天氣於非週三、週五上午 10:00 例外加發。";
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
      .xjw-weather-standby{border-color:#b8a777!important;background:#fffdf4!important}
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
      if (!GROUPS[active]?.test(post)) return false;
      if (month && localMonth(post.scheduledAt) !== month) return false;
      if (search && ![post.title, post.instagramCaption, post.facebookCaption, post.status].join(" ").toLowerCase().includes(search)) return false;
      return true;
    });
    const newestFirst = ["published", "cancelled"].includes(active);
    return filtered.sort((a, b) => {
      if (newestFirst) return new Date(b.publishedAt || b.updatedAt || b.createdAt) - new Date(a.publishedAt || a.updatedAt || a.createdAt);
      if (!a.scheduledAt && !b.scheduledAt) return String(a.title || "").localeCompare(String(b.title || ""), "zh-Hant");
      if (!a.scheduledAt) return 1;
      if (!b.scheduledAt) return -1;
      return new Date(a.scheduledAt) - new Date(b.scheduledAt);
    });
  }

  function decorateCard(card, post) {
    card.dataset.socialGroup = groupFor(post);
    const invalid = ACTIVE_STATUSES.has(post.status) && !validTargetSlot(post);
    card.classList.toggle("xjw-social-warning", invalid);
    card.classList.toggle("xjw-weather-standby", isWeatherStandby(post));
    const pill = card.querySelector(".pill");
    if (pill) {
      if (isWeatherStandby(post)) pill.textContent = "氣候待命";
      else if (post.oneTimeWeatherPost === true && post.status === "approved") pill.textContent = "氣候例外／等待發布";
      else pill.textContent = STATUS_LABELS[post.status] || post.status || "未知";
    }
    const actions = card.querySelector(".actions");
    if (!actions) return;
    actions.querySelectorAll('[data-social-action="delete"]').forEach((button) => {
      button.hidden = !["draft", "rejected", "cancelled", "failed"].includes(post.status);
    });
    actions.querySelectorAll("[data-xjw-social-edit]").forEach((button) => {
      button.hidden = ["published", "publishing"].includes(post.status) || isWeatherStandby(post);
    });
    if (["approved", "failed", "partial"].includes(post.status) && !actions.querySelector('[data-social-action="pause"]')) {
      actions.insertAdjacentHTML("beforeend", `<button class="btn gold" data-social-action="pause" data-id="${post.id}">暫停</button>`);
    }
    if (post.status === "paused" && !isWeatherStandby(post) && !actions.querySelector('[data-social-action="resume"]')) {
      actions.insertAdjacentHTML("afterbegin", `<button class="btn success" data-social-action="resume" data-id="${post.id}">重新檢查並恢復</button>`);
    }
  }

  function updateSummary() {
    const current = posts.filter((post) => !["published", "cancelled"].includes(post.status));
    const fixedScheduled = current.filter((post) => FIXED_ACTIVE_STATUSES.has(post.status) && !isWeatherPost(post));
    const weatherStandby = current.filter(isWeatherStandby);
    const weatherActive = current.filter((post) => isWeatherPost(post) && !isWeatherStandby(post) && FIXED_ACTIVE_STATUSES.has(post.status));
    const future = current.filter((post) => post.scheduledAt && new Date(post.scheduledAt).getTime() >= Date.now()).sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
    const invalid = current.filter((post) => ACTIVE_STATUSES.has(post.status) && !validTargetSlot(post)).length;
    const slots = new Map();
    let duplicates = 0;
    current.forEach((post) => {
      if (!post.scheduledAt) return;
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
    const healthText = invalid || duplicates
      ? `${invalid ? `｜${invalid} 篇時間不合規` : ""}${duplicates ? `｜${duplicates} 個重複時段` : ""}`
      : "｜排程檢查正常";
    summary.textContent = `固定每週 2 篇｜週三、週五上午 10:00｜氣候與補水符合萬華實際天氣時，於非週三、週五上午 10:00 額外發布，不占固定篇數｜立即發布可隨時使用｜待審 ${countFor("review")} 篇｜固定排程 ${fixedScheduled.length} 篇｜氣候待命 ${weatherStandby.length} 篇${weatherActive.length ? `｜氣候已啟用 ${weatherActive.length} 篇` : ""}｜共 ${posts.length} 篇｜排至 ${lastText}${healthText}`;
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
    window.xjwSocialFilter = {
      version: VERSION,
      refresh,
      apply,
      validTargetSlot,
      isWeatherPost,
      get active() { return active; },
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
