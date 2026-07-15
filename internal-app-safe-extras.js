"use strict";

(() => {
  const VERSION = "20260715-safe-extras-1";
  const H = { "Content-Type": "application/json", "X-XJW-Requested-With": "internal-app-v2" };
  const byId = (id) => document.getElementById(id);
  const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[char]));
  const money = (value) => `$${Number(value || 0).toLocaleString("zh-TW")}`;
  const dt = (value) => value ? new Date(value).toLocaleString("zh-TW", { hour12: false }) : "";
  let state = null;
  let analytics = null;
  let diagnostics = null;
  let refreshing = false;

  async function api(url, options = {}) {
    const response = await fetch(url, {
      cache: "no-store",
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

  function showNotice(message, error = false) {
    let node = byId("xjwSafeNotice");
    if (!node) {
      node = document.createElement("div");
      node.id = "xjwSafeNotice";
      const top = document.querySelector(".top");
      top?.insertAdjacentElement("afterend", node);
    }
    node.className = `notice ${error ? "error" : "ok"}`;
    node.textContent = message;
    node.hidden = false;
    if (!error) setTimeout(() => { if (node.textContent === message) node.hidden = true; }, 1800);
  }

  function installStyles() {
    if (byId("xjwSafeStyles")) return;
    const style = document.createElement("style");
    style.id = "xjwSafeStyles";
    style.textContent = `
      .xjw-safe-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0}
      .xjw-safe-mini{padding:7px 10px;font-size:13px}
      .xjw-safe-results{display:grid;gap:8px;margin-top:8px}
      .xjw-safe-status{padding:8px 10px;border-radius:10px;background:#f4f1ea;margin:8px 0;font-size:13px}
      .xjw-safe-online{position:fixed;right:12px;bottom:72px;z-index:50;padding:7px 10px;border-radius:999px;background:#315c45;color:#fff;font-size:12px;box-shadow:0 8px 24px #0002}
      .xjw-safe-online.offline{background:#8d2024}
      .xjw-safe-draft{font-size:12px;color:#6b655d;margin-top:4px}
      @media(max-width:760px){.xjw-safe-online{bottom:68px}}
    `;
    document.head.appendChild(style);
  }

  function installToolsView() {
    if (byId("tools")) return;
    const tabs = document.querySelector("nav.tabs");
    if (tabs) tabs.insertAdjacentHTML("beforeend", '<button class="tab" data-view="tools">營運工具</button>');
    const main = document.querySelector("main.shell");
    if (!main) return;
    main.insertAdjacentHTML("beforeend", `
      <section id="tools" class="view">
        <article class="panel">
          <div class="toolbar"><h2>跨功能搜尋</h2><button id="xjwSyncBtn" class="btn soft" type="button">立即同步 Supabase</button></div>
          <input id="xjwGlobalSearch" placeholder="搜尋訂單、客戶、電話、商品、提醒、社群貼文">
          <div id="xjwSearchResults" class="xjw-safe-results"></div>
        </article>
        <div class="grid2" style="margin-top:14px">
          <article class="panel"><h2>營運摘要</h2><div id="xjwKpis" class="cards"></div></article>
          <article class="panel"><h2>系統診斷</h2><div id="xjwDiagnostics" class="list"></div></article>
        </div>
        <div class="grid2" style="margin-top:14px">
          <article class="panel"><h2>熱銷產品</h2><div id="xjwTopProducts" class="list"></div></article>
          <article class="panel"><h2>重要客戶</h2><div id="xjwTopCustomers" class="list"></div></article>
        </div>
        <article class="panel" style="margin-top:14px"><h2>資料匯出</h2><div class="actions"><a class="btn soft" href="/internal/api/v2/export/orders.csv">訂單 CSV</a><a class="btn soft" href="/internal/api/v2/export/customers.csv">客戶 CSV</a><a class="btn soft" href="/internal/api/v2/export/inventory.csv">庫存 CSV</a><a class="btn soft" href="/internal/api/v2/export/activities.csv">操作紀錄 CSV</a><a class="btn primary" href="/internal/api/v2/export/backup">完整備份 JSON</a></div></article>
      </section>`);
  }

  function installInventoryToolbar() {
    const list = byId("inventoryList");
    if (!list || byId("xjwInventoryToolbar")) return;
    list.insertAdjacentHTML("beforebegin", '<div id="xjwInventoryToolbar" class="xjw-safe-toolbar"><input id="xjwInventorySearch" class="compact" placeholder="搜尋產品"><label style="margin:0"><input id="xjwLowOnly" style="width:auto" type="checkbox"> 只看低庫存</label><button id="xjwSaveAllInventory" class="btn primary" type="button">儲存全部盤點</button><a class="btn soft" href="/internal/api/v2/export/inventory.csv">匯出庫存</a></div>');
  }

  function installOrderPicker() {
    const form = byId("orderForm");
    if (!form || byId("xjwProductPicker")) return;
    const field = form.elements.items;
    const label = field?.closest("label");
    if (!label) return;
    label.insertAdjacentHTML("beforebegin", '<div id="xjwProductPicker" class="grid3"><label>快速選商品<select id="xjwProductSelect"><option value="">選擇產品</option></select></label><label>數量<input id="xjwProductQty" type="number" min="1" value="1"></label><label style="align-self:end"><button id="xjwProductAdd" class="btn gold" type="button">加入商品內容</button></label></div>');
  }

  function installReminderTemplates() {
    const form = byId("reminderForm");
    if (!form || byId("xjwReminderTemplate")) return;
    form.insertAdjacentHTML("afterbegin", '<label>快速範本<select id="xjwReminderTemplate"><option value="">選擇範本</option><option value="follow7">7天後追蹤客戶</option><option value="stock7">7天後盤點庫存</option><option value="social1">明天檢查社群貼文</option><option value="payment3">3天後確認付款</option></select></label>');
  }

  function installConnectionBadge() {
    if (byId("xjwSafeConnection")) return;
    const badge = document.createElement("div");
    badge.id = "xjwSafeConnection";
    badge.className = "xjw-safe-online";
    document.body.appendChild(badge);
    const update = () => {
      badge.textContent = navigator.onLine ? `已連線｜${VERSION}` : "離線模式";
      badge.classList.toggle("offline", !navigator.onLine);
    };
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    update();
  }

  function installAutosave(form) {
    if (!form || form.dataset.xjwSafeAutosave === "1") return;
    form.dataset.xjwSafeAutosave = "1";
    const key = `xjw-draft-${form.id}`;
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      if (saved) Object.entries(saved).forEach(([name, value]) => {
        const field = form.elements[name];
        if (!field || name === "id" || name === "socialEditId") return;
        if (field.type === "checkbox") field.checked = Boolean(value);
        else if (!field.value) field.value = value;
      });
    } catch {}
    const save = () => {
      const data = {};
      new FormData(form).forEach((value, name) => { if (!(value instanceof File)) data[name] = value; });
      form.querySelectorAll('input[type="checkbox"]').forEach((field) => { data[field.name] = field.checked; });
      try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
      let note = form.querySelector(".xjw-safe-draft");
      if (!note) { note = document.createElement("div"); note.className = "xjw-safe-draft"; form.appendChild(note); }
      note.textContent = `已自動暫存 ${new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}`;
    };
    form.addEventListener("input", save);
    form.addEventListener("change", save);
  }

  function updateProductOptions() {
    const select = byId("xjwProductSelect");
    if (!select || !state) return;
    const current = select.value;
    select.innerHTML = '<option value="">選擇產品</option>' + (state.inventory || []).map((item) => `<option value="${esc(item.name)}">${esc(item.name)} ${esc(item.spec || "")}</option>`).join("");
    if ([...select.options].some((option) => option.value === current)) select.value = current;
  }

  function decorateOrders() {
    if (!state) return;
    document.querySelectorAll("#orderList > .item").forEach((card) => {
      if (card.dataset.xjwSafeDecorated === "1") return;
      const edit = card.querySelector("[data-order-edit]");
      const id = edit?.dataset.orderEdit;
      const item = (state.orders || []).find((row) => row.id === id);
      if (!id || !item) return;
      card.dataset.xjwSafeDecorated = "1";
      const actions = card.querySelector(".actions");
      actions?.insertAdjacentHTML("beforeend", `<button class="btn soft xjw-safe-mini" data-xjw-order-duplicate="${esc(id)}">複製</button><button class="btn soft xjw-safe-mini" data-xjw-order-print="${esc(id)}">列印</button><button class="btn soft xjw-safe-mini" data-xjw-order-copy="${esc(id)}">複製通知文字</button>`);
      const source = item.source || "內部 App";
      const mode = item.inventoryMode === "shipped" ? "已扣庫存" : item.inventoryMode === "cancelled" ? "已釋放／回補" : "已保留庫存";
      const line = item.lineUserId ? (item.lastLineNotificationError ? `LINE 通知失敗：${item.lastLineNotificationError}` : item.lastLineNotificationAt ? `LINE 已通知 ${dt(item.lastLineNotificationAt)}` : "LINE 訂單，可自動通知") : "無 LINE userId";
      actions?.insertAdjacentHTML("beforebegin", `<div class="meta"><span class="pill">${esc(source)}</span>　${esc(mode)}｜${esc(line)}</div>`);
    });
  }

  function decorateCustomers() {
    if (!state) return;
    document.querySelectorAll("#customerList > .item").forEach((card) => {
      if (card.dataset.xjwSafeDecorated === "1") return;
      const edit = card.querySelector("[data-customer-edit]");
      const id = edit?.dataset.customerEdit;
      const customer = (state.customers || []).find((item) => item.id === id);
      if (!id || !customer) return;
      card.dataset.xjwSafeDecorated = "1";
      const orders = (state.orders || []).filter((order) => (customer.phone && order.phone === customer.phone) || (!customer.phone && order.customerName === customer.name));
      const total = orders.filter((order) => order.status !== "已取消").reduce((sum, order) => sum + Number(order.total || 0), 0);
      card.querySelector("h3")?.insertAdjacentHTML("afterend", `<div class="meta">消費統計：${orders.length} 筆｜${money(total)}</div>`);
      card.querySelector(".actions")?.insertAdjacentHTML("beforeend", `<button class="btn primary xjw-safe-mini" data-xjw-customer-order="${esc(id)}">建立訂單</button><button class="btn gold xjw-safe-mini" data-xjw-customer-reminder="${esc(id)}">7天後追蹤</button>`);
    });
  }

  function decorateInventory() {
    if (!state) return;
    document.querySelectorAll("#inventoryList > .item").forEach((card) => {
      if (card.querySelector(".xjw-safe-stock")) return;
      const title = card.querySelector("h3")?.textContent?.trim();
      const item = (state.inventory || []).find((row) => row.name === title);
      if (!item) return;
      const stock = Number(item.stock || 0);
      const reserved = Number(item.reserved || item.reservedStock || 0);
      const available = Number(item.availableStock != null ? item.availableStock : stock - reserved);
      card.querySelector(".toolbar")?.insertAdjacentHTML("afterend", `<div class="xjw-safe-stock notice ${available <= Number(item.lowStock || 0) ? "error" : "ok"}"><strong>可用庫存：${available}</strong>　實體 ${stock}｜已保留 ${reserved}</div>`);
    });
  }

  function socialStatusLabel(status) {
    return ({ draft: "待審", approved: "已排程", rejected: "退回", published: "已發布", failed: "失敗", partial: "部分成功", cancelled: "已取消" })[status] || status || "未知";
  }

  function decorateSocial() {
    if (!state) return;
    const form = byId("socialForm");
    if (form && !form.elements.socialEditId) form.insertAdjacentHTML("afterbegin", '<input type="hidden" name="socialEditId">');
    document.querySelectorAll("#socialList > .item").forEach((card) => {
      if (card.dataset.xjwSafeDecorated === "1") return;
      const action = card.querySelector("[data-id]");
      const id = action?.dataset.id;
      const item = (state.socialPosts || []).find((row) => row.id === id);
      if (!id || !item) return;
      card.dataset.xjwSafeDecorated = "1";
      const ig = item.platformStatus?.instagram || (item.result?.instagram ? "成功" : item.publishInstagram ? (item.status === "failed" ? "失敗" : "待處理") : "未選擇");
      const fb = item.platformStatus?.facebook || (item.result?.facebook ? "成功" : item.publishFacebook ? (item.status === "failed" ? "失敗" : "待處理") : "未選擇");
      card.querySelector(".meta")?.insertAdjacentHTML("afterend", `<div class="xjw-safe-status ${ig === "失敗" || fb === "失敗" ? "error" : ""}">Instagram：${esc(ig)}｜Facebook：${esc(fb)}</div>`);
      const pill = card.querySelector(".pill"); if (pill) pill.textContent = socialStatusLabel(item.status);
      card.querySelector(".actions")?.insertAdjacentHTML("beforeend", `<button class="btn primary xjw-safe-mini" data-xjw-social-edit="${esc(id)}">編輯</button><button class="btn soft xjw-safe-mini" data-xjw-social-duplicate="${esc(id)}">複製</button><button class="btn soft xjw-safe-mini" data-xjw-social-copy="${esc(id)}">複製文案</button>`);
    });
  }

  function decorateAll() {
    installInventoryToolbar();
    installOrderPicker();
    installReminderTemplates();
    updateProductOptions();
    decorateOrders();
    decorateCustomers();
    decorateInventory();
    decorateSocial();
    ["orderForm", "customerForm", "reminderForm", "socialForm"].forEach((id) => installAutosave(byId(id)));
  }

  function renderTools() {
    if (!analytics || !diagnostics) return;
    const kpis = byId("xjwKpis");
    if (kpis) kpis.innerHTML = [[analytics.validOrderCount, "有效訂單"], [money(analytics.totalSales), "訂單金額"], [money(analytics.averageOrderValue), "平均客單"], [analytics.repeatCustomerCount, "回購客戶"]].map(([value, label]) => `<div class="metric"><strong>${esc(value)}</strong><span>${label}</span></div>`).join("");
    const products = byId("xjwTopProducts");
    if (products) products.innerHTML = (analytics.topProducts || []).slice(0, 10).map((item, index) => `<div class="item"><strong>${index + 1}. ${esc(item.name)}</strong><span class="pill" style="float:right">${Number(item.qty)} 件</span></div>`).join("") || '<div class="item muted">尚無銷售資料</div>';
    const customers = byId("xjwTopCustomers");
    if (customers) customers.innerHTML = (analytics.topCustomers || []).slice(0, 10).map((item, index) => `<div class="item"><strong>${index + 1}. ${esc(item.name)}</strong><div class="meta">${esc(item.phone)}｜${item.orders} 筆｜${money(item.total)}｜最近 ${dt(item.lastAt)}</div></div>`).join("") || '<div class="item muted">尚無客戶消費資料</div>';
    const diag = byId("xjwDiagnostics");
    if (diag) {
      const rows = [
        `Supabase：${diagnostics.supabaseConnected ? "正常" : diagnostics.supabaseEnabled ? "異常" : "未啟用"}`,
        `資料：訂單 ${diagnostics.counts?.orders || 0}、客戶 ${diagnostics.counts?.customers || 0}、庫存 ${diagnostics.counts?.inventory || 0}、提醒 ${diagnostics.counts?.reminders || 0}、社群 ${diagnostics.counts?.socialPosts || 0}`,
        `LINE：${diagnostics.integrations?.line ? "已設定" : "未設定"}｜CRM：${diagnostics.integrations?.crm ? "已設定" : "使用預設網址"}`,
        `Instagram：${diagnostics.integrations?.instagram ? "已設定" : "未設定"}｜Facebook：${diagnostics.integrations?.facebook ? "已設定" : "未設定"}`,
        diagnostics.lastError ? `最近錯誤：${diagnostics.lastError}` : `最近儲存：${diagnostics.lastSavedAt || "尚無"}`,
      ];
      diag.innerHTML = rows.map((row) => `<div class="item">${esc(row)}</div>`).join("");
    }
  }

  function runGlobalSearch() {
    const query = (byId("xjwGlobalSearch")?.value || "").trim().toLowerCase();
    const area = byId("xjwSearchResults");
    if (!area) return;
    if (!query || !state) { area.innerHTML = ""; return; }
    const results = [];
    (state.orders || []).forEach((item) => { if ([item.customerName, item.phone, item.items, item.note, item.trackingNo, item.status].join(" ").toLowerCase().includes(query)) results.push({ type: "訂單", title: `${item.customerName}｜${item.status}`, detail: `${item.items || ""}｜${money(item.total)}`, view: "orders" }); });
    (state.customers || []).forEach((item) => { if ([item.name, item.phone, item.lineId, item.interests, item.tags, item.note].join(" ").toLowerCase().includes(query)) results.push({ type: "客戶", title: item.name, detail: [item.phone, item.interests, item.tags].filter(Boolean).join("｜"), view: "customers" }); });
    (state.inventory || []).forEach((item) => { if ([item.name, item.spec, item.productId].join(" ").toLowerCase().includes(query)) results.push({ type: "庫存", title: item.name, detail: `庫存 ${item.stock}｜警戒 ${item.lowStock}`, view: "inventory" }); });
    (state.reminders || []).forEach((item) => { if ([item.title, item.note].join(" ").toLowerCase().includes(query)) results.push({ type: "提醒", title: item.title, detail: dt(item.dueAt), view: "reminders" }); });
    (state.socialPosts || []).forEach((item) => { if ([item.title, item.instagramCaption, item.facebookCaption, item.status].join(" ").toLowerCase().includes(query)) results.push({ type: "社群", title: item.title, detail: `${socialStatusLabel(item.status)}｜${dt(item.scheduledAt)}`, view: "social" }); });
    area.innerHTML = results.slice(0, 50).map((item) => `<button class="item" data-view="${item.view}" style="text-align:left;width:100%"><span class="pill">${item.type}</span><strong style="display:block;margin-top:5px">${esc(item.title)}</strong><span class="meta">${esc(item.detail)}</span></button>`).join("") || '<div class="item muted">找不到符合資料</div>';
  }

  async function refreshExtra() {
    if (refreshing) return;
    refreshing = true;
    try {
      const results = await Promise.allSettled([
        api(`/internal/api/v2/state?t=${Date.now()}`),
        api(`/internal/api/v2/ops/analytics?t=${Date.now()}`),
        api(`/internal/api/v2/ops/diagnostics?t=${Date.now()}`),
      ]);
      if (results[0].status === "fulfilled") state = results[0].value;
      if (results[1].status === "fulfilled") analytics = results[1].value;
      if (results[2].status === "fulfilled") diagnostics = results[2].value;
      decorateAll();
      renderTools();
    } finally {
      refreshing = false;
    }
  }

  function wrapLoadAll() {
    const original = window.loadAll;
    if (typeof original !== "function" || original.__xjwSafeWrapped) return;
    const wrapped = async (...args) => {
      const result = await original(...args);
      await refreshExtra();
      return result;
    };
    wrapped.__xjwSafeWrapped = true;
    window.loadAll = wrapped;
  }

  function copyText(value) {
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(value).then(() => showNotice("已複製")).catch(() => prompt("請複製以下文字", value));
    else prompt("請複製以下文字", value);
  }

  function printOrder(id) {
    const item = state?.orders?.find((row) => row.id === id); if (!item) return;
    const win = window.open("", "_blank"); if (!win) return alert("瀏覽器阻擋了列印視窗");
    win.document.write(`<title>仙加味訂單</title><style>body{font-family:sans-serif;padding:30px;line-height:1.7}h1{color:#0b1f3b}table{width:100%;border-collapse:collapse}td{border-bottom:1px solid #ddd;padding:8px}</style><h1>仙加味訂單</h1><table><tr><td>訂單編號</td><td>${esc(item.id)}</td></tr><tr><td>客戶</td><td>${esc(item.customerName)}</td></tr><tr><td>電話</td><td>${esc(item.phone || "")}</td></tr><tr><td>商品</td><td>${esc(item.items || "").replace(/\n/g, "<br>")}</td></tr><tr><td>金額</td><td>${money(item.total)}</td></tr><tr><td>付款</td><td>${esc(item.payment || "")}</td></tr><tr><td>配送</td><td>${esc(item.shipping || "")}</td></tr><tr><td>地址</td><td>${esc(item.address || "")}</td></tr><tr><td>備註</td><td>${esc(item.note || "")}</td></tr></table>`);
    win.document.close(); win.focus(); setTimeout(() => win.print(), 300);
  }

  function editSocial(id) {
    const item = state?.socialPosts?.find((row) => row.id === id);
    const form = byId("socialForm");
    if (!item || !form) return;
    if (!form.elements.socialEditId) form.insertAdjacentHTML("afterbegin", '<input type="hidden" name="socialEditId">');
    form.elements.socialEditId.value = id;
    ["title", "imageUrl", "instagramCaption", "facebookCaption"].forEach((key) => { if (form.elements[key]) form.elements[key].value = item[key] || ""; });
    if (form.elements.scheduledAt) {
      const date = new Date(item.scheduledAt);
      date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
      form.elements.scheduledAt.value = date.toISOString().slice(0, 16);
    }
    if (form.elements.publishInstagram) form.elements.publishInstagram.checked = Boolean(item.publishInstagram);
    if (form.elements.publishFacebook) form.elements.publishFacebook.checked = Boolean(item.publishFacebook);
    const preview = byId("socialImagePreview"); if (preview && item.imageUrl) { preview.src = item.imageUrl; preview.hidden = false; }
    window.showView?.("social"); window.scrollTo(0, 0); showNotice("正在編輯草稿");
  }

  function bindActions() {
    document.addEventListener("click", async (event) => {
      const target = event.target;
      try {
        const duplicate = target.closest("[data-xjw-order-duplicate]");
        if (duplicate) { await api(`/internal/api/v2/orders/${encodeURIComponent(duplicate.dataset.xjwOrderDuplicate)}/duplicate`, { method: "POST", body: "{}" }); await window.loadAll?.(); return; }
        const print = target.closest("[data-xjw-order-print]"); if (print) { printOrder(print.dataset.xjwOrderPrint); return; }
        const copy = target.closest("[data-xjw-order-copy]"); if (copy) { const item = state?.orders?.find((row) => row.id === copy.dataset.xjwOrderCopy); if (item) copyText(`您好 ${item.customerName}，仙加味訂單內容：\n${item.items || ""}\n金額：${money(item.total)}\n狀態：${item.status}\n如有需要調整請直接回覆，謝謝。`); return; }
        const customerOrder = target.closest("[data-xjw-customer-order]"); if (customerOrder) { const item = state?.customers?.find((row) => row.id === customerOrder.dataset.xjwCustomerOrder); const form = byId("orderForm"); if (item && form) { form.elements.customerName.value = item.name; form.elements.phone.value = item.phone || ""; window.showView?.("orders"); } return; }
        const customerReminder = target.closest("[data-xjw-customer-reminder]"); if (customerReminder) { await api(`/internal/api/v2/customers/${encodeURIComponent(customerReminder.dataset.xjwCustomerReminder)}/reminder`, { method: "POST", body: "{}" }); await window.loadAll?.(); showNotice("已建立7天後追蹤提醒"); return; }
        const socialEdit = target.closest("[data-xjw-social-edit]"); if (socialEdit) { editSocial(socialEdit.dataset.xjwSocialEdit); return; }
        const socialDuplicate = target.closest("[data-xjw-social-duplicate]"); if (socialDuplicate) { await api(`/internal/api/v2/social/${encodeURIComponent(socialDuplicate.dataset.xjwSocialDuplicate)}/duplicate`, { method: "POST", body: "{}" }); await window.loadAll?.(); return; }
        const socialCopy = target.closest("[data-xjw-social-copy]"); if (socialCopy) { const item = state?.socialPosts?.find((row) => row.id === socialCopy.dataset.xjwSocialCopy); if (item) copyText([item.instagramCaption, item.facebookCaption].filter(Boolean).join("\n\n--- Facebook ---\n")); return; }
        if (target.closest("#xjwSaveAllInventory")) {
          const items = (state?.inventory || []).map((item) => ({ productId: item.productId, stock: Number(byId(`stock-${item.productId}`)?.value || 0), lowStock: Number(byId(`low-${item.productId}`)?.value || 0) }));
          await api("/internal/api/v2/inventory/bulk", { method: "POST", body: JSON.stringify({ items }) }); await window.loadAll?.(); showNotice("全部庫存盤點已儲存"); return;
        }
        if (target.closest("#xjwProductAdd")) {
          const name = byId("xjwProductSelect")?.value; const qty = Math.max(1, Number(byId("xjwProductQty")?.value || 1)); const field = byId("orderForm")?.elements.items;
          if (!name || !field) return alert("請先選擇商品");
          field.value = [field.value.trim(), `${name} × ${qty}`].filter(Boolean).join("\n"); field.dispatchEvent(new Event("input", { bubbles: true })); return;
        }
        if (target.closest("#xjwSyncBtn")) { await api("/internal/api/v2/ops/sync", { method: "POST", body: "{}" }); await window.loadAll?.(); showNotice("Supabase 同步完成"); return; }
      } catch (error) {
        showNotice(error.message || "操作失敗", true);
        alert(error.message || "操作失敗");
      }
    });

    document.addEventListener("input", (event) => {
      if (event.target.id === "xjwGlobalSearch") runGlobalSearch();
      if (event.target.id === "xjwInventorySearch") filterInventory();
    });
    document.addEventListener("change", (event) => {
      if (event.target.id === "xjwLowOnly") filterInventory();
      if (event.target.id === "xjwReminderTemplate") {
        const map = { follow7: [7, "追蹤客戶", "確認客戶使用與後續需求"], stock7: [7, "盤點庫存", "確認庫存、警戒值與補貨需求"], social1: [1, "檢查社群貼文", "確認排程、圖片與文案"], payment3: [3, "確認付款", "確認訂單付款與後續出貨"] };
        const row = map[event.target.value]; const form = byId("reminderForm"); if (!row || !form) return;
        const date = new Date(Date.now() + row[0] * 86400000); date.setHours(10, 0, 0, 0); date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
        form.elements.title.value = row[1]; form.elements.note.value = row[2]; form.elements.dueAt.value = date.toISOString().slice(0, 16);
      }
    });
  }

  function filterInventory() {
    const query = (byId("xjwInventorySearch")?.value || "").toLowerCase();
    const lowOnly = Boolean(byId("xjwLowOnly")?.checked);
    document.querySelectorAll("#inventoryList > .item").forEach((card) => {
      const match = !query || card.textContent.toLowerCase().includes(query);
      const low = Boolean(card.querySelector(".pill.low") || card.querySelector(".xjw-safe-stock.error"));
      card.style.display = match && (!lowOnly || low) ? "" : "none";
    });
  }

  function start() {
    installStyles();
    installToolsView();
    installInventoryToolbar();
    installOrderPicker();
    installReminderTemplates();
    installConnectionBadge();
    bindActions();
    wrapLoadAll();
    refreshExtra().catch((error) => { console.warn("safe extras", error.message); });
    window.xjwSafeExtras = { version: VERSION, refresh: refreshExtra };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
