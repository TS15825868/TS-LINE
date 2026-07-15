"use strict";

(() => {
  const VERSION = "20260715-upload-2";
  const byId = (id) => document.getElementById(id);
  let uploadPromise = null;
  let resubmitting = false;
  let initialized = false;

  function init() {
    if (initialized) return true;
    const file = byId("socialImageFile");
    const button = byId("socialImageUploadBtn");
    const status = byId("socialImageStatus");
    const url = byId("socialImageUrl");
    const preview = byId("socialImagePreview");
    const form = byId("socialForm");
    if (!file || !button || !status || !url || !preview || !form) return false;
    initialized = true;

    const submitButtons = [...form.querySelectorAll('button[type="submit"],input[type="submit"]')];
    const setStatus = (message, kind = "normal") => {
      status.textContent = message;
      status.style.color = kind === "error" ? "#8d2024" : kind === "success" ? "#315c45" : "#6b655d";
    };
    const setBusy = (busy) => {
      button.disabled = busy;
      button.style.opacity = busy ? ".65" : "";
      button.textContent = busy ? "照片上傳中…" : "重新上傳照片";
      submitButtons.forEach((node) => {
        node.disabled = busy;
        node.style.opacity = busy ? ".65" : "";
      });
    };
    const hasUrl = () => /^https:\/\//i.test(String(url.value || "").trim());
    const showPreview = (src) => {
      if (!src) {
        preview.hidden = true;
        preview.removeAttribute("src");
        return;
      }
      preview.src = src;
      preview.hidden = false;
    };
    const loadImage = (src) => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("這張照片無法讀取，請改選 JPG 或 PNG"));
      image.src = src;
    });
    const normalizeImage = async (source) => {
      const allowed = ["image/jpeg", "image/png", "image/webp"];
      if (allowed.includes(source.type) && source.size <= 8 * 1024 * 1024) return source;
      const localUrl = URL.createObjectURL(source);
      try {
        const image = await loadImage(localUrl);
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;
        const maxSide = 2048;
        const scale = Math.min(1, maxSide / Math.max(width, height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("瀏覽器無法處理照片");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
        if (!blob) throw new Error("照片轉檔失敗");
        return blob;
      } finally {
        URL.revokeObjectURL(localUrl);
      }
    };
    const upload = async () => {
      if (hasUrl()) return url.value;
      const selected = file.files && file.files[0];
      if (!selected) throw new Error("請先從相簿或檔案選擇照片");
      if (uploadPromise) return uploadPromise;
      uploadPromise = (async () => {
        setBusy(true);
        setStatus("正在自動壓縮並上傳照片，請不要關閉畫面");
        const localPreview = URL.createObjectURL(selected);
        showPreview(localPreview);
        try {
          const image = await normalizeImage(selected);
          if (image.size > 12 * 1024 * 1024) throw new Error("照片處理後仍超過 12 MB");
          const response = await fetch("/internal/api/v2/social/upload", {
            method: "POST",
            headers: {
              "Content-Type": image.type || "image/jpeg",
              "X-XJW-Requested-With": "internal-app-v2",
            },
            body: image,
          });
          const data = await response.json().catch(() => ({ ok: false, error: "系統回覆格式錯誤" }));
          if (response.status === 401) {
            location.href = "/internal/login";
            throw new Error("請重新登入");
          }
          if (!response.ok || data.ok === false) throw new Error(data.error || "照片上傳失敗");
          url.value = data.url;
          url.dispatchEvent(new Event("input", { bubbles: true }));
          showPreview(data.url);
          setStatus("✓ 照片已上傳，可以建立待審草稿", "success");
          return data.url;
        } catch (error) {
          url.value = "";
          setStatus(error.message || "照片上傳失敗", "error");
          throw error;
        } finally {
          URL.revokeObjectURL(localPreview);
          setBusy(false);
          uploadPromise = null;
        }
      })();
      return uploadPromise;
    };

    file.addEventListener("change", () => {
      url.value = "";
      const selected = file.files && file.files[0];
      if (!selected) {
        showPreview("");
        setStatus("選擇照片後會自動壓縮並上傳");
        return;
      }
      showPreview(URL.createObjectURL(selected));
      setStatus("已選擇照片，正在自動上傳…");
      upload().catch((error) => alert(error.message || "照片上傳失敗"));
    });

    button.textContent = "重新上傳照片";
    button.addEventListener("click", () => {
      if (hasUrl()) url.value = "";
      upload().catch((error) => alert(error.message || "照片上傳失敗"));
    });

    url.addEventListener("input", () => {
      if (hasUrl()) {
        showPreview(url.value);
        setStatus("✓ 已取得公開 HTTPS 圖片網址", "success");
      }
    });

    document.addEventListener("submit", async (event) => {
      if (event.target !== form || resubmitting) return;
      const instagram = form.querySelector('[name="publishInstagram"]');
      if (!instagram || !instagram.checked || hasUrl()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const selected = file.files && file.files[0];
      if (!selected) {
        alert("Instagram 需要照片，請先從相簿或檔案選擇一張圖片");
        return;
      }
      try {
        await upload();
        resubmitting = true;
        form.requestSubmit();
        setTimeout(() => { resubmitting = false; }, 0);
      } catch (error) {
        alert(error.message || "照片上傳失敗");
      }
    }, true);

    if (hasUrl()) showPreview(url.value);
    else setStatus("選擇照片後會自動壓縮並上傳");
    window.xjwSocialImageUpload = { version: VERSION, upload };
    return true;
  }

  function start() {
    if (init()) return;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (init() || attempts >= 50) clearInterval(timer);
    }, 100);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
