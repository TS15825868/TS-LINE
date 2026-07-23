"use strict";

(() => {
  const VERSION = "20260723-social-ui-fix-2";
  const HEADERS = {
    "Content-Type": "application/json",
    "X-XJW-Requested-With": "internal-app-v2",
  };
  const ASSET_VERSION = "approved-original-1254-v10";
  const ACTION_LABELS = {
    approve: "通過排程",
    reject: "退回",
    publish: "立即發布",
    cancel: "取消",
    delete: "刪除",
    pause: "暫停",
    resume: "重新檢查並恢復",
  };
  let posts = [];
  let running = false;
  let timer = null;

  async function request(url, options = {}) {
    const response = await fetch(url, {
      cache: "no-store",
      ...options,
      headers: { ...HEADERS, ...(options.headers || {}) },
    });
    if (response.status === 401) {
      location.href = "/internal/login";
      throw new Error("請重新登入");
    }
    const data = await response.json().catch(() => ({ ok: false, error: "系統回覆格式錯誤" }));
    if (!response.ok || data.ok === false) throw new Error(data.error || "操作失敗");
    return data;
  }

  async function loadState() {
    const data = await request(`/internal/api/v2/state?t=${Date.now()}`);
    posts = Array.isArray(data.socialPosts) ? data.socialPosts : [];
    return data;
  }

  function postIdFromCard(card) {
    return card.querySelector("[data-social-action][data-id]")?.dataset.id
      || card.querySelector("[data-xjw-social-edit]")?.dataset.xjwSocialEdit
      || card.querySelector("[data-xjw-social-duplicate]")?.dataset.xjwSocialDuplicate
      || card.querySelector("[data-id]")?.dataset.id
      || "";
  }

  function fallbackImage(post = {}) {
    if (post.imageUrl) return post.imageUrl;
    const name = post.imageName || ({
      "first-batch-v2-care-work-rest-20260729": "care-work-rest.jpg",
      "clear-republish-care-work-rest-20260724": "care-work-rest-clear.jpg",
      "first-batch-v2-care-hydration-20260819": "care-hot-hydration.jpg",
      "first-batch-v2-care-family-20260805": "care-family.jpg",
      "first-batch-v2-care-temperature-gap-20260812": "care-temperature-gap.jpg",
      "first-batch-v2-care-rainy-day-20260826": "care-rainy-day.jpg",
    }[post.id] || "");
    return name ? `/social-approved-assets/${encodeURIComponent(name)}?v=${ASSET_VERSION}` : "";
  }

  function ensureImage(card, post) {
    const src = fallbackImage(post);
    if (!src) return;
    let image = card.querySelector("img.xjw-social-image, img[data-xjw-social-image]") || card.querySelector("img");
    if (!image) {
      image = document.createElement("img");
      image.className = "xjw-social-image";
      image.dataset.xjwSocialImage = "1";
      image.alt = post.title || "社群貼文圖片";
      const details = card.querySelector("details");
      if (details) details.insertAdjacentElement("beforebegin", image);
      else card.querySelector(".actions")?.insertAdjacentElement("beforebegin", image);
    }
    image.classList.add("xjw-social-image");
    image.dataset.xjwSocialImage = "1";
    image.style.cssText = "display:block;width:100%;max-width:560px;aspect-ratio:1/1;object-fit:contain;border-radius:16px;margin:12px auto;background:#f4efe5";
    if (image.getAttribute("src") !== src) image.src = src;
    image.hidden = false;
    image.onerror = () => {
      image.hidden = true;
      let warning = card.querySelector(".xjw-image-error");
      if (!warning) {
        warning = document.createElement("div");
        warning.className = "notice error xjw-image-error";
        warning.textContent = "圖片載入失敗，請按重新整理；系統不會在沒有圖片時發布 Instagram。";
        image.insertAdjacentElement("afterend", warning);
      }
    };
    image.onload = () => card.querySelector(".xjw-image-error")?.remove();
  }

  function ensurePublishButton(card, post) {
    const actions = card.querySelector(".actions");
    if (!actions || ["published", "publishing", "cancelled"].includes(post.status)) return;
    let button = actions.querySelector('[data-social-action="publish"]');
    if (!button) {
      button = document.createElement("button");
      button.className = "btn success";
      button.dataset.socialAction = "publish";
      button.dataset.id = post.id;
      actions.insertAdjacentElement("afterbegin", button);
    }
    button.type = "button";
    button.disabled = false;
    button.removeAttribute("aria-disabled");
    button.style.pointerEvents = "auto";
    const retry = post.status === "partial" || post.status === "failed"
      || Boolean(post.result?.instagram) || Boolean(post.result?.facebook)
      || post.platformStatus?.instagram === "成功" || post.platformStatus?.facebook === "成功";
    button.textContent = retry ? "重試失敗平台" : "立即發布";
    button.title = "不必等待原排程時間；立即送到目前勾選的平台。已成功的平台不會重複發布。";
  }

  function normalizeButtons(card) {
    card.querySelectorAll("button[data-social-action]").forEach((button) => {
      button.type = "button";
      button.style.pointerEvents = "auto";
      if (button.dataset.socialAction !== "publish") button.disabled = false;
      if (!button.textContent.trim()) button.textContent = ACTION_LABELS[button.dataset.socialAction] || "操作";
    });
  }

  function decorate() {
    const list = document.getElementById("socialList");
    if (!list) return;
    list.querySelectorAll(":scope > .item").forEach((card) => {
      const id = postIdFromCard(card);
      const post = posts.find((item) => item.id === id);
      if (!post) return;
      ensureImage(card, post);
      ensurePublishButton(card, post);
      normalizeButtons(card);
    });
  }

  function showProgress(card, message, bad = false) {
    let notice = card?.querySelector(".xjw-social-action-status");
    if (!notice && card) {
      notice = document.createElement("div");
      notice.className = "notice xjw-social-action-status";
      card.querySelector(".actions")?.insertAdjacentElement("beforebegin", notice);
    }
    if (!notice) return;
    notice.className = `notice ${bad ? "error" : "ok"} xjw-social-action-status`;
    notice.textContent = message;
    notice.hidden = false;
  }

  async function runAction(button) {
    const action = button.dataset.socialAction;
    const id = button.dataset.id;
    if (!action || !id) return;
    const card = button.closest(".item");
    if (action === "publish" && !confirm("確定立即發布？系統會立刻發到已勾選的平台；已成功的平台不會重複發。")) return;
    if (action === "delete" && !confirm("確定刪除這筆社群貼文？")) return;
    if (action === "cancel" && !confirm("確定取消這篇貼文？")) return;

    const original = button.textContent;
    button.disabled = true;
    button.textContent = "處理中…";
    showProgress(card, "正在處理，請稍候…");
    try {
      const data = await request(`/internal/api/v2/social/${encodeURIComponent(id)}/${encodeURIComponent(action)}`, {
        method: "POST",
        body: "{}",
      });
      showProgress(card, action === "publish" ? "已送出發布，正在更新平台狀態。" : "操作完成。");
      if (typeof window.loadAll === "function") await window.loadAll();
      await loadState();
      decorate();
      window.xjwSocialFilter?.refresh?.();
      if (action === "publish") alert("已執行立即發布；已成功的平台不會重複發布。請查看卡片上的平台狀態。");
      return data;
    } catch (error) {
      showProgress(card, error.message || "操作失敗", true);
      alert(error.message || "操作失敗");
    } finally {
      button.disabled = false;
      button.textContent = original;
      decorate();
    }
  }

  function installCaptureHandler() {
    if (document.documentElement.dataset.xjwSocialActionsFixed === "2") return;
    document.documentElement.dataset.xjwSocialActionsFixed = "2";
    document.addEventListener("click", (event) => {
      const button = event.target.closest("#socialList [data-social-action]");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      runAction(button);
    }, true);
  }

  async function refresh() {
    if (running) return;
    running = true;
    try {
      await loadState();
      decorate();
    } catch (error) {
      console.warn("social UI repair", error.message);
    } finally {
      running = false;
    }
  }

  function start() {
    installCaptureHandler();
    refresh();
    const observer = new MutationObserver(decorate);
    observer.observe(document.body, { childList: true, subtree: true });
    timer = setInterval(refresh, 5000);
    window.addEventListener("xjw:app-refreshed", refresh);
    window.addEventListener("beforeunload", () => {
      clearInterval(timer);
      observer.disconnect();
    }, { once: true });
    window.xjwSocialRetry = { version: VERSION, refresh, decorate, get posts() { return posts; } };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
