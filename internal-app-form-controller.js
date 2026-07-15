"use strict";

(() => {
  const VERSION = "20260715-form-1";
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
  }

  function resetSocial(form) {
    form.reset();
    if (form.elements.socialEditId) form.elements.socialEditId.value = "";
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
  }

  async function refresh() {
    if (typeof window.loadAll === "function") await window.loadAll();
    if (typeof window.xjwRefreshAll === "function") await window.xjwRefreshAll();
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
      return;
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
      return;
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
      return;
    }

    if (form.id === "socialForm") {
      if (data.socialEditId) return;
      delete data.socialEditId;
      await api("/internal/api/v2/social", {
        method: "POST",
        body: JSON.stringify(data),
      });
      resetSocial(form);
      clearDraft(form);
      await refresh();
      alert("已建立待審草稿");
      return;
    }

    if (form.id === "staffForm") {
      await api("/internal/api/v2/staff", {
        method: "POST",
        body: JSON.stringify(data),
      });
      form.reset();
      clearDraft(form);
      await refresh();
      return;
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
      alert("備份還原完成");
    }
  }

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (!["orderForm", "customerForm", "reminderForm", "socialForm", "staffForm", "restoreForm"].includes(form.id)) return;
    if (form.id === "socialForm" && form.elements.socialEditId?.value) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const submit = form.querySelector('button[type="submit"],input[type="submit"]');
    const originalText = submit?.tagName === "BUTTON" ? submit.textContent : submit?.value;
    if (submit) {
      submit.disabled = true;
      if (submit.tagName === "BUTTON") submit.textContent = "處理中…";
      else submit.value = "處理中…";
    }

    submitForm(form)
      .catch((error) => alert(error.message || "操作失敗"))
      .finally(() => {
        if (!submit) return;
        submit.disabled = false;
        if (submit.tagName === "BUTTON") submit.textContent = originalText || "送出";
        else submit.value = originalText || "送出";
      });
  }, true);

  window.xjwFormController = { version: VERSION };
})();
