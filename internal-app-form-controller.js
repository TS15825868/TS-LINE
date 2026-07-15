"use strict";

(() => {
  const VERSION = "20260715-form-stable-2";
  const HEADERS = {
    "Content-Type": "application/json",
    "X-XJW-Requested-With": "internal-app-v2",
  };

  const formObject = (form) => {
    const data = Object.fromEntries(new FormData(form).entries());
    form.querySelectorAll('input[type="checkbox"]').forEach((field) => {
      data[field.name] = field.checked;
    });
    return data;
  };

  async function api(url, options = {}) {
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

  function clearDraft(form) {
    try { localStorage.removeItem(`xjw-draft-${form.id}`); } catch {}
    const note = form.querySelector(".xjw-safe-draft,.stable-draft-note,.ops-draft");
    if (note) note.textContent = "";
  }

  function nextSocialTime() {
    const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
  }

  function resetSocial(form) {
    form.reset();
    if (form.elements.socialEditId) form.elements.socialEditId.value = "";
    ["title", "imageUrl", "instagramCaption", "facebookCaption"].forEach((name) => {
      if (form.elements[name]) form.elements[name].value = "";
    });
    if (form.elements.scheduledAt) form.elements.scheduledAt.value = nextSocialTime();
    if (form.elements.publishInstagram) form.elements.publishInstagram.checked = true;
    if (form.elements.publishFacebook) form.elements.publishFacebook.checked = true;

    const preview = document.getElementById("socialImagePreview");
    if (preview) {
      preview.hidden = true;
      preview.removeAttribute("src");
    }
    const url = document.getElementById("socialImageUrl");
    if (url) url.value = "";
    const file = document.getElementById("socialImageFile");
    if (file) file.value = "";
    const status = document.getElementById("socialImageStatus");
    if (status) {
      status.textContent = "選擇照片後會自動壓縮並上傳";
      status.style.color = "#6b655d";
    }
    clearDraft(form);
  }

  async function refresh() {
    if (typeof window.loadAll === "function") await window.loadAll();
    if (typeof window.xjwSafeExtras?.refresh === "function") await window.xjwSafeExtras.refresh();
  }

  async function submitForm(form) {
    const data = formObject(form);

    if (form.id === "orderForm") {
      const id = data.id;
      delete data.id;
      await api(id ? `/internal/api/v2/orders/${encodeURIComponent(id)}` : "/internal/api/v2/orders", {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(data),
      });
      window.resetOrderForm?.();
      clearDraft(form);
      await refresh();
      return "訂單已儲存";
    }

    if (form.id === "customerForm") {
      const id = data.id;
      delete data.id;
      await api(id ? `/internal/api/v2/customers/${encodeURIComponent(id)}` : "/internal/api/v2/customers", {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(data),
      });
      window.resetCustomerForm?.();
      clearDraft(form);
      await refresh();
      return "客戶資料已儲存";
    }

    if (form.id === "reminderForm") {
      const id = data.id;
      delete data.id;
      await api(id ? `/internal/api/v2/reminders/${encodeURIComponent(id)}` : "/internal/api/v2/reminders", {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(data),
      });
      window.resetReminderForm?.();
      clearDraft(form);
      await refresh();
      return "提醒已儲存";
    }

    if (form.id === "socialForm") {
      const id = data.socialEditId || "";
      delete data.socialEditId;
      await api(id ? `/internal/api/v2/social/${encodeURIComponent(id)}` : "/internal/api/v2/social", {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(data),
      });
      resetSocial(form);
      await refresh();
      return id ? "草稿已更新，表單已清空" : "已建立待審草稿，表單已清空";
    }

    if (form.id === "staffForm") {
      await api("/internal/api/v2/staff", {
        method: "POST",
        body: JSON.stringify(data),
      });
      form.reset();
      clearDraft(form);
      await refresh();
      return "員工帳號已建立";
    }

    if (form.id === "restoreForm") {
      const file = form.elements.file?.files?.[0];
      if (!file) throw new Error("請選擇備份檔");
      const backup = JSON.parse(await file.text());
      await api("/internal/api/v2/import/backup", {
        method: "POST",
        body: JSON.stringify({ confirm: true, data: backup }),
      });
      form.reset();
      await refresh();
      return "備份還原完成";
    }

    return "操作完成";
  }

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (!["orderForm", "customerForm", "reminderForm", "socialForm", "staffForm", "restoreForm"].includes(form.id)) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const submit = form.querySelector('button[type="submit"],button:not([type]),input[type="submit"]');
    const originalText = submit?.tagName === "BUTTON" ? submit.textContent : submit?.value;
    if (submit) {
      submit.disabled = true;
      if (submit.tagName === "BUTTON") submit.textContent = "處理中…";
      else submit.value = "處理中…";
    }

    submitForm(form)
      .then((message) => {
        if (message) alert(message);
      })
      .catch((error) => alert(error.message || "操作失敗"))
      .finally(() => {
        if (!submit) return;
        submit.disabled = false;
        if (submit.tagName === "BUTTON") submit.textContent = originalText || "送出";
        else submit.value = originalText || "送出";
      });
  }, true);

  window.xjwFormController = { version: VERSION, resetSocial };
})();
