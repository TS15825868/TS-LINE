"use strict";

(() => {
  const VERSION = "20260724-review-gate-v3";
  const H = { "Content-Type": "application/json", "X-XJW-Requested-With": "internal-app-v2" };
  let posts = [];
  let timer = null;

  function postId(card) {
    return card.querySelector("[data-social-action][data-id]")?.dataset.id
      || card.querySelector("[data-xjw-social-edit]")?.dataset.xjwSocialEdit
      || card.querySelector("[data-id]")?.dataset.id
      || "";
  }

  async function loadPosts() {
    const response = await fetch(`/internal/api/v2/state?t=${Date.now()}`, { cache: "no-store", headers: H });
    if (response.status === 401) {
      location.href = "/internal/login";
      return;
    }
    const data = await response.json().catch(() => ({}));
    posts = Array.isArray(data.socialPosts) ? data.socialPosts : [];
    decorate();
  }

  function installNotice() {
    const list = document.getElementById("socialList");
    if (!list || document.getElementById("xjwReviewGateNotice")) return;
    const notice = document.createElement("div");
    notice.id = "xjwReviewGateNotice";
    notice.className = "notice ok";
    notice.style.margin = "0 0 12px";
    notice.innerHTML = "<strong>人工審核閘門已開啟</strong><br>圖片與文案先放在 App 草稿區。只有你按下「審核通過・啟用自動發布」後，固定貼文才會依排程自動發布；氣候貼文才會開始等待實際氣候。未審核內容不會發布，也不會自動補發。已過期的時間會自動改排下一個空白的週三／週五上午10:00，不會突然補發。";
    list.insertAdjacentElement("beforebegin", notice);
  }

  function ensureReviewMeta(card, post) {
    let meta = card.querySelector(".xjw-review-gate-meta");
    if (!meta) {
      meta = document.createElement("div");
      meta.className = "meta xjw-review-gate-meta";
      meta.style.margin = "8px 0";
      card.querySelector(".actions")?.insertAdjacentElement("beforebegin", meta);
    }
    if (!meta) return;
    if (!post.reviewApprovedAt) {
      const expired = post.scheduledAt && new Date(post.scheduledAt).getTime() <= Date.now();
      meta.textContent = expired
        ? "尚未審核：原時間已過。審核通過後會自動改排下一個空白的週三／週五上午10:00，不會立刻發布。"
        : "尚未審核：請先核對圖片、文案、發布平台與時間。";
      meta.style.color = "#8d2024";
    } else if (post.conditionalWeather && post.status === "paused") {
      meta.textContent = "已審核：等待萬華實際氣候符合後，由系統安排非週三、週五上午10:00發布。";
      meta.style.color = "#315c45";
    } else {
      const time = post.scheduledAt ? new Date(post.scheduledAt).toLocaleString("zh-TW", { hour12: false, timeZone: "Asia/Taipei" }) : "尚未設定時間";
      meta.textContent = post.reviewScheduleNote
        ? `已審核：${post.reviewScheduleNote}。預定 ${time} 自動發布。`
        : `已審核：預定 ${time} 自動發布。`;
      meta.style.color = "#315c45";
    }
  }

  function decorateCard(card, post) {
    const reviewed = Boolean(post.reviewApprovedAt || post.manualReviewConfirmedAt);
    const approve = card.querySelector('[data-social-action="approve"]');
    if (approve) {
      approve.type = "button";
      approve.hidden = reviewed || !["draft", "rejected"].includes(post.status);
      approve.disabled = false;
      approve.textContent = "審核通過・啟用自動發布";
      approve.title = "確認圖片、文案、平台與時間正確後，才讓這篇進入自動發布流程。";
    }

    const publish = card.querySelector('[data-social-action="publish"]');
    if (publish) {
      publish.type = "button";
      publish.hidden = !reviewed || ["published", "publishing", "cancelled"].includes(post.status);
      publish.disabled = !reviewed;
      publish.textContent = reviewed ? "立即發布（已審核）" : "請先完成審核";
      publish.title = reviewed
        ? "略過原排程時間立即發布；已成功的平台不會重複發布。"
        : "必須先按『審核通過・啟用自動發布』。";
    }

    card.querySelectorAll('[data-social-action="resume"]').forEach((button) => {
      if (post.conditionalWeather) {
        button.hidden = true;
        button.disabled = true;
      }
    });

    const status = card.querySelector(".pill");
    if (status) {
      if (!reviewed && post.status === "rejected") status.textContent = "已退回・等待重新審核";
      else if (!reviewed) status.textContent = "等待你審核";
      else if (post.status === "paused" && post.conditionalWeather) status.textContent = "已審核・等待氣候";
      else if (post.status === "approved") status.textContent = "已審核・等待自動發布";
      else if (post.status === "publishing") status.textContent = "發布中";
      else if (post.status === "partial") status.textContent = "部分成功・請檢查";
      else if (post.status === "failed") status.textContent = "發布失敗・請檢查";
      else if (post.status === "published") status.textContent = "已發布";
    }
    ensureReviewMeta(card, post);
  }

  function decorate() {
    installNotice();
    const byId = new Map(posts.map((post) => [String(post.id || ""), post]));
    document.querySelectorAll("#socialList .item").forEach((card) => {
      const post = byId.get(postId(card));
      if (post) decorateCard(card, post);
    });
  }

  function installApprovalConfirmation() {
    if (document.documentElement.dataset.xjwReviewGateConfirm === "1") return;
    document.documentElement.dataset.xjwReviewGateConfirm = "1";
    document.addEventListener("click", (event) => {
      const button = event.target.closest('#socialList [data-social-action="approve"]');
      if (!button) return;
      const card = button.closest(".item");
      const post = posts.find((item) => item.id === postId(card));
      const expired = post?.scheduledAt && new Date(post.scheduledAt).getTime() <= Date.now();
      const schedule = post?.conditionalWeather
        ? "通過後會等待實際氣候，不會立刻發布。"
        : expired
          ? "原排程已過；通過後會自動改排下一個沒有衝突的週三／週五上午10:00，不會立刻發布。"
          : "通過後會依畫面上的排程時間自動發布。";
      if (!confirm(`確定圖片、文案、平台與時間都正確嗎？\n\n${schedule}`)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    }, true);
  }

  function start() {
    installApprovalConfirmation();
    installNotice();
    loadPosts().catch(() => {});
    const observer = new MutationObserver(decorate);
    observer.observe(document.body, { childList: true, subtree: true });
    timer = setInterval(() => loadPosts().catch(() => {}), 5000);
    window.addEventListener("xjw:app-refreshed", () => loadPosts().catch(() => {}));
    window.addEventListener("beforeunload", () => {
      clearInterval(timer);
      observer.disconnect();
    }, { once: true });
    window.xjwReviewGate = { version: VERSION, refresh: loadPosts, decorate, get posts() { return posts; } };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();