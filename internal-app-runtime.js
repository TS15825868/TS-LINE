"use strict";

(() => {
  const role = document.getElementById("staff") ? "admin" : "staff";
  const S = {
    orders: [], customers: [], inventory: [], reminders: [], activities: [],
    staff: [], socialPosts: [], summary: {}, system: {},
  };
  const H = { "Content-Type": "application/json", "X-XJW-Requested-With": "internal-app-v2" };
  const byId = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[char]));
  const money = (value) => `$${Number(value || 0).toLocaleString("zh-TW")}`;
  const dt = (value) => value ? new Date(value).toLocaleString("zh-TW", { hour12: false }) : "";
  const localInput = (value) => {
    if (!value) return "";
    const date = new Date(value);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
  };
  const formObject = (form) => {
    const result = Object.fromEntries(new FormData(form).entries());
    form.querySelectorAll('input[type="checkbox"]').forEach((input) => { result[input.name] = input.checked; });
    return result;
  };
  const text = (id, value) => { const node = byId(id); if (node) node.textContent = value; };

  async function api(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: { ...H, ...(options.headers || {}) },
    });
    if (response.status === 401) {
      location.href = "/internal/login";
      throw new Error("請重新登入");
    }
    const data = await response.json().catch(() => ({ ok: false, error: "系統回覆格式錯誤" }));
    if (!response.ok || data.ok === false) throw new Error(data.error || "操作失敗");
    return data;
  }

  async function act(task) {
    try { await task(); }
    catch (error) { alert(error.message || "操作失敗"); }
  }

  function showView(id) {
    document.querySelectorAll(".view").forEach((node) => node.classList.toggle("active", node.id === id));
    document.querySelectorAll("[data-view]").forEach((node) => node.classList.toggle("active", node.dataset.view === id));
    window.scrollTo(0, 0);
  }

  function renderDashboard() {
    const todos = [
      ...S.orders.filter((item) => !["已完成", "已取消"].includes(item.status)).slice(0, 6)
        .map((item) => ({ title: `${item.customerName}｜${item.status}`, detail: item.items || "未填商品" })),
      ...S.inventory.filter((item) => Number(item.stock) <= Number(item.lowStock)).slice(0, 6)
        .map((item) => ({ title: `低庫存｜${item.name}`, detail: `目前 ${item.stock}，警戒 ${item.lowStock}` })),
      ...S.reminders.filter((item) => !item.done && new Date(item.dueAt) <= new Date()).slice(0, 6)
        .map((item) => ({ title: `到期提醒｜${item.title}`, detail: dt(item.dueAt) })),
      ...S.socialPosts.filter((item) => ["draft", "rejected", "failed"].includes(item.status)).slice(0, 4)
        .map((item) => ({ title: `社群｜${item.title}`, detail: item.status })),
    ];
    const todoList = byId("todoList");
    if (todoList) todoList.innerHTML = todos.length
      ? todos.map((item) => `<div class="item"><h3>${esc(item.title)}</h3><div class="meta">${esc(item.detail)}</div></div>`).join("")
      : '<div class="item muted">目前沒有待處理事項</div>';

    const activityList = byId("activityList");
    if (activityList) activityList.innerHTML = S.activities.slice(0, 20).map((item) =>
      `<div class="item"><strong>${esc(item.action)}</strong><div class="meta">${esc(item.actor)}｜${dt(item.createdAt)}｜${esc(item.detail || "")}</div></div>`
    ).join("") || '<div class="item muted">尚無操作紀錄</div>';

    const systemList = byId("systemList");
    if (systemList) {
      const sys = S.system || {};
      const rows = [
        `Supabase：${sys.supabaseEnabled ? (sys.supabaseConnected ? "已連線" : "連線異常") : "未啟用"}`,
        `儲存：${sys.persistence || ""}`,
        `LINE：${sys.lineConfigured ? "已設定" : "未設定"}`,
        `Instagram：${sys.instagramConfigured ? "已設定" : "未設定"}`,
        `Facebook：${sys.facebookConfigured ? "已設定" : "未設定"}`,
        sys.lastError ? `錯誤：${sys.lastError}` : `最近同步：${sys.lastSavedAt || sys.restoredAt || "尚無"}`,
      ];
      systemList.innerHTML = rows.map((row) => `<div class="item">${esc(row)}</div>`).join("");
    }
  }

  function renderOrders() {
    const search = (byId("orderSearch")?.value || "").toLowerCase();
    const filter = byId("orderFilter")?.value || "";
    const rows = S.orders.filter((item) =>
      (!filter || item.status === filter) &&
      (!search || [item.customerName, item.phone, item.items, item.note, item.trackingNo].join(" ").toLowerCase().includes(search))
    );
    const list = byId("orderList");
    if (!list) return;
    list.innerHTML = rows.map((item) => `<div class="item">
      <div class="toolbar"><h3>${esc(item.customerName)}</h3><span class="pill ${item.status === "已完成" ? "done" : ""}">${esc(item.status)}</span></div>
      <div>${esc(item.items || "未填商品")}</div>
      <div class="meta">${esc(item.phone || "")}｜${money(item.total)}｜${dt(item.createdAt)}</div>
      <div class="meta">${esc([item.payment, item.shipping, item.address, item.trackingNo, item.note].filter(Boolean).join("｜"))}</div>
      <div class="actions">
        <button class="btn soft" data-order-edit="${esc(item.id)}">編輯</button>
        ${["已聯絡", "已付款", "備貨中", "已出貨", "已完成"].map((status) => `<button class="btn soft" data-order-status="${esc(item.id)}" data-status="${status}">${status}</button>`).join("")}
        ${role === "admin" ? `<button class="btn danger" data-order-delete="${esc(item.id)}">刪除</button>` : ""}
      </div>
    </div>`).join("") || '<div class="item muted">沒有訂單</div>';
  }

  function editOrder(id) {
    const item = S.orders.find((row) => row.id === id);
    const form = byId("orderForm");
    if (!item || !form) return;
    ["id", "customerName", "phone", "items", "total", "status", "payment", "shipping", "address", "trackingNo", "note"].forEach((key) => {
      if (form.elements[key]) form.elements[key].value = item[key] ?? "";
    });
    text("orderFormTitle", "編輯訂單");
    showView("orders");
  }

  function resetOrderForm() {
    const form = byId("orderForm");
    if (!form) return;
    form.reset();
    if (form.elements.id) form.elements.id.value = "";
    text("orderFormTitle", "新增訂單");
  }

  function renderCustomers() {
    const search = (byId("customerSearch")?.value || "").toLowerCase();
    const rows = S.customers.filter((item) => !search || [item.name, item.phone, item.lineId, item.interests, item.tags, item.note].join(" ").toLowerCase().includes(search));
    const list = byId("customerList");
    if (!list) return;
    list.innerHTML = rows.map((item) => `<div class="item">
      <h3>${esc(item.name)}</h3>
      <div>${esc(item.interests || "尚未記錄詢問產品")}</div>
      <div class="meta">${esc(item.phone || "")}｜${esc(item.lineId || "")}｜${esc(item.tags || "")}</div>
      <div class="meta">${esc(item.note || "")}</div>
      <div class="actions">
        <button class="btn soft" data-customer-edit="${esc(item.id)}">編輯</button>
        ${item.phone ? `<a class="btn success" href="tel:${encodeURIComponent(item.phone)}">撥電話</a>` : ""}
        ${role === "admin" ? `<button class="btn danger" data-customer-delete="${esc(item.id)}">刪除</button>` : ""}
      </div>
    </div>`).join("") || '<div class="item muted">沒有客戶資料</div>';
  }

  function editCustomer(id) {
    const item = S.customers.find((row) => row.id === id);
    const form = byId("customerForm");
    if (!item || !form) return;
    ["id", "name", "phone", "lineId", "interests", "tags", "note"].forEach((key) => {
      if (form.elements[key]) form.elements[key].value = item[key] ?? "";
    });
    text("customerFormTitle", "編輯客戶");
    showView("customers");
  }

  function resetCustomerForm() {
    const form = byId("customerForm");
    if (!form) return;
    form.reset();
    if (form.elements.id) form.elements.id.value = "";
    text("customerFormTitle", "新增客戶");
  }

  function renderInventory() {
    const list = byId("inventoryList");
    if (!list) return;
    list.innerHTML = S.inventory.map((item) => {
      const movements = Array.isArray(item.movements) ? item.movements.slice(-5).reverse() : [];
      return `<div class="item">
        <div class="toolbar"><div><h3>${esc(item.name)}</h3><div class="meta">${esc(item.spec || "")}｜單位：${esc(item.unit || "件")}</div></div><span class="pill ${Number(item.stock) <= Number(item.lowStock) ? "low" : "done"}">庫存 ${Number(item.stock || 0)}</span></div>
        <div class="grid3">
          <label>目前庫存<input id="stock-${esc(item.productId)}" type="number" min="0" value="${Number(item.stock || 0)}"></label>
          <label>低庫存警戒值<input id="low-${esc(item.productId)}" type="number" min="0" value="${Number(item.lowStock || 0)}"></label>
          <label>本次增減<input id="adj-${esc(item.productId)}" type="number" value="0" placeholder="進貨正數／出貨負數"></label>
        </div>
        <label>調整原因<input id="reason-${esc(item.productId)}" placeholder="進貨、盤點、門市銷售、出貨、破損"></label>
        <div class="actions">
          <button class="btn primary" data-inventory-save="${esc(item.productId)}">直接儲存盤點數</button>
          <button class="btn gold" data-inventory-adjust="${esc(item.productId)}">記錄進貨／出貨</button>
        </div>
        <div class="meta">最後更新：${dt(item.updatedAt)}</div>
        ${movements.length ? `<details><summary>最近調整紀錄</summary>${movements.map((move) => `<div class="meta">${dt(move.createdAt)}｜${Number(move.delta) > 0 ? "+" : ""}${Number(move.delta)}｜${esc(move.reason || "未填原因")}｜${esc(move.actor || "")}</div>`).join("")}</details>` : ""}
      </div>`;
    }).join("") || '<div class="item muted">產品庫存正在建立，請按右上角「重新整理」。</div>';
  }

  function renderReminders() {
    const list = byId("reminderList");
    if (!list) return;
    list.innerHTML = S.reminders.map((item) => `<div class="item">
      <div class="toolbar"><h3>${esc(item.title)}</h3><span class="pill ${item.done ? "done" : (!item.done && new Date(item.dueAt) <= new Date() ? "low" : "")}">${item.done ? "已完成" : dt(item.dueAt)}</span></div>
      <div class="meta">${esc(item.note || "")}</div>
      <div class="actions">
        <button class="btn soft" data-reminder-edit="${esc(item.id)}">編輯</button>
        <button class="btn success" data-reminder-toggle="${esc(item.id)}" data-done="${!item.done}">${item.done ? "重新開啟" : "完成"}</button>
        ${role === "admin" ? `<button class="btn danger" data-reminder-delete="${esc(item.id)}">刪除</button>` : ""}
      </div>
    </div>`).join("") || '<div class="item muted">沒有提醒</div>';
  }

  function editReminder(id) {
    const item = S.reminders.find((row) => row.id === id);
    const form = byId("reminderForm");
    if (!item || !form) return;
    form.elements.id.value = item.id;
    form.elements.title.value = item.title;
    form.elements.dueAt.value = localInput(item.dueAt);
    form.elements.note.value = item.note || "";
    text("reminderFormTitle", "編輯提醒");
    showView("reminders");
  }

  function resetReminderForm() {
    const form = byId("reminderForm");
    if (!form) return;
    form.reset();
    if (form.elements.id) form.elements.id.value = "";
    text("reminderFormTitle", "新增提醒");
  }

  function renderSocial() {
    text("socialConfig", `IG ${S.system.instagramConfigured ? "已設定" : "未設定"}／FB ${S.system.facebookConfigured ? "已設定" : "未設定"}`);
    const list = byId("socialList");
    if (!list) return;
    list.innerHTML = S.socialPosts.map((item) => `<div class="item">
      <div class="toolbar"><h3>${esc(item.title)}</h3><span class="pill ${esc(item.status)}">${esc(item.status)}</span></div>
      <div class="meta">預定：${dt(item.scheduledAt)}｜${item.publishInstagram ? "IG " : ""}${item.publishFacebook ? "FB" : ""}</div>
      ${item.imageUrl ? `<img src="${esc(item.imageUrl)}" alt="" style="width:100%;max-width:320px;max-height:320px;object-fit:contain;border-radius:12px;margin-top:8px">` : ""}
      <details><summary>Instagram 文案</summary><p>${esc(item.instagramCaption || "").replace(/\n/g, "<br>")}</p></details>
      <details><summary>Facebook 文案</summary><p>${esc(item.facebookCaption || "").replace(/\n/g, "<br>")}</p></details>
      ${item.lastError ? `<div class="notice error">${esc(item.lastError)}</div>` : ""}
      <div class="actions">
        ${["draft", "rejected"].includes(item.status) ? `<button class="btn success" data-social-action="approve" data-id="${esc(item.id)}">通過排程</button><button class="btn danger" data-social-action="reject" data-id="${esc(item.id)}">退回</button>` : ""}
        ${["approved", "failed"].includes(item.status) ? `<button class="btn success" data-social-action="publish" data-id="${esc(item.id)}">立即發布</button><button class="btn danger" data-social-action="cancel" data-id="${esc(item.id)}">取消</button>` : ""}
        ${role === "admin" ? `<button class="btn soft" data-social-action="delete" data-id="${esc(item.id)}">刪除</button>` : ""}
      </div>
    </div>`).join("") || '<div class="item muted">目前沒有社群草稿</div>';
  }

  function renderReports() {
    const area = byId("reportArea");
    if (!area) return;
    const from = byId("reportFrom")?.value ? new Date(`${byId("reportFrom").value}T00:00:00`) : null;
    const to = byId("reportTo")?.value ? new Date(`${byId("reportTo").value}T23:59:59`) : null;
    const rows = S.orders.filter((item) => {
      const created = new Date(item.createdAt);
      return (!from || created >= from) && (!to || created <= to);
    });
    const sales = rows.filter((item) => item.status !== "已取消").reduce((sum, item) => sum + Number(item.total || 0), 0);
    const completed = rows.filter((item) => item.status === "已完成").length;
    area.innerHTML = `<div class="cards" style="margin-top:12px"><div class="metric"><strong>${rows.length}</strong><span>期間訂單</span></div><div class="metric"><strong>${money(sales)}</strong><span>期間訂單金額</span></div><div class="metric"><strong>${completed}</strong><span>完成訂單</span></div></div>`;
  }

  function renderStaff() {
    const list = byId("staffList");
    if (!list) return;
    list.innerHTML = S.staff.map((item) => `<div class="item"><div class="toolbar"><div><h3>${esc(item.displayName || item.username)}</h3><div class="meta">${esc(item.username)}｜${esc(item.role)}</div></div><span class="pill ${item.active ? "done" : "low"}">${item.active ? "啟用" : "停用"}</span></div></div>`).join("") || '<div class="item muted">尚無其他員工帳號</div>';
  }

  function render() {
    text("mActive", Number(S.summary.activeOrderCount || 0));
    text("mCustomers", Number(S.summary.customerCount || 0));
    text("mSales", money(S.summary.totalSales));
    text("mLow", Number(S.summary.lowStockCount || 0));
    text("mReminders", Number(S.summary.dueReminderCount || 0));
    text("mSocial", Number(S.summary.pendingSocialCount || 0));
    text("mDb", S.system.supabaseConnected ? "正常" : (S.system.supabaseEnabled ? "異常" : "本機"));
    renderDashboard();
    renderOrders();
    renderCustomers();
    renderInventory();
    renderReminders();
    renderSocial();
    renderReports();
    renderStaff();
  }

  async function loadAll() {
    await act(async () => {
      const data = await api("/internal/api/v2/state");
      Object.assign(S, data);
      ["orders", "customers", "inventory", "reminders", "activities", "staff", "socialPosts"].forEach((key) => {
        if (!Array.isArray(S[key])) S[key] = [];
      });
      S.summary = S.summary || {};
      S.system = S.system || {};
      render();
      text("lastSync", `更新：${dt(new Date())}`);
      byId("xjwClientWarning")?.remove();
    });
  }

  async function saveInventory(id) {
    await act(async () => {
      await api(`/internal/api/v2/inventory/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          stock: Number(byId(`stock-${id}`)?.value || 0),
          lowStock: Number(byId(`low-${id}`)?.value || 0),
        }),
      });
      await loadAll();
    });
  }

  async function adjustInventory(id) {
    const delta = Number(byId(`adj-${id}`)?.value || 0);
    const reason = byId(`reason-${id}`)?.value || "";
    if (!delta) return alert("請輸入本次調整數量；進貨填正數，出貨填負數");
    await act(async () => {
      await api(`/internal/api/v2/inventory/${encodeURIComponent(id)}/adjust`, {
        method: "POST",
        body: JSON.stringify({ delta, reason }),
      });
      await loadAll();
    });
  }

  async function socialAction(id, action) {
    if (action === "publish" && !confirm("確定立即發布？")) return;
    await act(async () => {
      await api(`/internal/api/v2/social/${encodeURIComponent(id)}/${action}`, { method: "POST", body: "{}" });
      await loadAll();
    });
  }

  function bindForms() {
    byId("orderForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      act(async () => {
        const form = event.currentTarget;
        const data = formObject(form);
        const id = data.id;
        delete data.id;
        await api(id ? `/internal/api/v2/orders/${encodeURIComponent(id)}` : "/internal/api/v2/orders", {
          method: id ? "PATCH" : "POST", body: JSON.stringify(data),
        });
        resetOrderForm();
        await loadAll();
      });
    });

    byId("customerForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      act(async () => {
        const form = event.currentTarget;
        const data = formObject(form);
        const id = data.id;
        delete data.id;
        await api(id ? `/internal/api/v2/customers/${encodeURIComponent(id)}` : "/internal/api/v2/customers", {
          method: id ? "PATCH" : "POST", body: JSON.stringify(data),
        });
        resetCustomerForm();
        await loadAll();
      });
    });

    byId("reminderForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      act(async () => {
        const form = event.currentTarget;
        const data = formObject(form);
        const id = data.id;
        delete data.id;
        await api(id ? `/internal/api/v2/reminders/${encodeURIComponent(id)}` : "/internal/api/v2/reminders", {
          method: id ? "PATCH" : "POST", body: JSON.stringify(data),
        });
        resetReminderForm();
        await loadAll();
      });
    });

    byId("socialForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      act(async () => {
        await api("/internal/api/v2/social", { method: "POST", body: JSON.stringify(formObject(event.currentTarget)) });
        event.currentTarget.reset();
        const preview = byId("socialImagePreview");
        if (preview) { preview.hidden = true; preview.removeAttribute("src"); }
        await loadAll();
      });
    });

    byId("staffForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      act(async () => {
        await api("/internal/api/v2/staff", { method: "POST", body: JSON.stringify(formObject(event.currentTarget)) });
        event.currentTarget.reset();
        await loadAll();
      });
    });

    byId("restoreForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      act(async () => {
        const file = event.currentTarget.elements.file.files[0];
        if (!file) throw new Error("請選擇備份檔");
        const data = JSON.parse(await file.text());
        await api("/internal/api/v2/import/backup", { method: "POST", body: JSON.stringify({ confirm: true, data }) });
        await loadAll();
        alert("備份還原完成");
      });
    });
  }

  document.addEventListener("click", (event) => {
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) { event.preventDefault(); showView(viewButton.dataset.view); return; }
    const target = event.target;
    const orderEdit = target.closest("[data-order-edit]");
    if (orderEdit) return editOrder(orderEdit.dataset.orderEdit);
    const orderStatus = target.closest("[data-order-status]");
    if (orderStatus) return act(async () => { await api(`/internal/api/v2/orders/${encodeURIComponent(orderStatus.dataset.orderStatus)}`, { method: "PATCH", body: JSON.stringify({ status: orderStatus.dataset.status }) }); await loadAll(); });
    const orderDelete = target.closest("[data-order-delete]");
    if (orderDelete && confirm("確定刪除這筆訂單？")) return act(async () => { await api(`/internal/api/v2/orders/${encodeURIComponent(orderDelete.dataset.orderDelete)}`, { method: "DELETE" }); await loadAll(); });
    const customerEdit = target.closest("[data-customer-edit]");
    if (customerEdit) return editCustomer(customerEdit.dataset.customerEdit);
    const customerDelete = target.closest("[data-customer-delete]");
    if (customerDelete && confirm("確定刪除此客戶？")) return act(async () => { await api(`/internal/api/v2/customers/${encodeURIComponent(customerDelete.dataset.customerDelete)}`, { method: "DELETE" }); await loadAll(); });
    const inventorySave = target.closest("[data-inventory-save]");
    if (inventorySave) return saveInventory(inventorySave.dataset.inventorySave);
    const inventoryAdjust = target.closest("[data-inventory-adjust]");
    if (inventoryAdjust) return adjustInventory(inventoryAdjust.dataset.inventoryAdjust);
    const reminderEdit = target.closest("[data-reminder-edit]");
    if (reminderEdit) return editReminder(reminderEdit.dataset.reminderEdit);
    const reminderToggle = target.closest("[data-reminder-toggle]");
    if (reminderToggle) return act(async () => { await api(`/internal/api/v2/reminders/${encodeURIComponent(reminderToggle.dataset.reminderToggle)}`, { method: "PATCH", body: JSON.stringify({ done: reminderToggle.dataset.done === "true" }) }); await loadAll(); });
    const reminderDelete = target.closest("[data-reminder-delete]");
    if (reminderDelete && confirm("確定刪除此提醒？")) return act(async () => { await api(`/internal/api/v2/reminders/${encodeURIComponent(reminderDelete.dataset.reminderDelete)}`, { method: "DELETE" }); await loadAll(); });
    const social = target.closest("[data-social-action]");
    if (social) return socialAction(social.dataset.id, social.dataset.socialAction);
  });

  byId("orderSearch")?.addEventListener("input", renderOrders);
  byId("orderFilter")?.addEventListener("change", renderOrders);
  byId("customerSearch")?.addEventListener("input", renderCustomers);
  bindForms();

  window.showView = showView;
  window.loadAll = loadAll;
  window.renderReports = renderReports;
  window.resetOrderForm = resetOrderForm;
  window.resetCustomerForm = resetCustomerForm;
  window.resetReminderForm = resetReminderForm;
  window.requestNotifications = async () => {
    if (!("Notification" in window)) return alert("此裝置不支援通知");
    const permission = await Notification.requestPermission();
    alert(permission === "granted" ? "通知已開啟" : "通知未開啟");
  };

  loadAll();
})();