"use strict";

(() => {
  const VERSION = "20260724-review-only-v1";

  function installNotice() {
    const list = document.getElementById("socialList");
    if (!list || document.getElementById("xjwReviewOnlyNotice")) return;
    const notice = document.createElement("div");
    notice.id = "xjwReviewOnlyNotice";
    notice.className = "notice error";
    notice.style.margin = "0 0 12px";
    notice.innerHTML = "<strong>人工審核模式已開啟</strong><br>圖片與文案只會先上傳到 App 草稿區，不會自動排程、不會自動發布，也不會自動補發。請確認內容後，再按『我已確認，手動發布』。";
    list.insertAdjacentElement("beforebegin", notice);
  }

  function decorate() {
    installNotice();
    document.querySelectorAll("#socialList .item").forEach((card) => {
      card.querySelectorAll('[data-social-action="approve"],[data-social-action="resume"],[data-social-action="pause"]').forEach((button) => {
        button.hidden = true;
        button.disabled = true;
      });
      const publish = card.querySelector('[data-social-action="publish"]');
      if (publish) {
        publish.type = "button";
        publish.textContent = "我已確認，手動發布";
        publish.title = "只有按下這個按鈕並再次確認後，才會送到 Facebook／Instagram。";
      }
      const status = card.querySelector(".pill");
      if (status && /待審核|已通過|等待發布|發布失敗|部分成功/.test(status.textContent || "")) {
        status.textContent = "等待你確認";
      }
    });
  }

  function start() {
    decorate();
    const observer = new MutationObserver(decorate);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("xjw:app-refreshed", decorate);
    window.addEventListener("beforeunload", () => observer.disconnect(), { once: true });
    window.xjwReviewOnly = { version: VERSION, decorate };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
