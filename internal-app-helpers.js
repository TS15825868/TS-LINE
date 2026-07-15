"use strict";

(() => {
  const VERSION = "20260715-ops-1";
  const H = { "Content-Type": "application/json", "X-XJW-Requested-With": "internal-app-v2" };
  const byId = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
  const money = (value) => `$${Number(value || 0).toLocaleString("zh-TW")}`;
  const dt = (value) => value ? new Date(value).toLocaleString("zh-TW", { hour12: false }) : "";
  let state = null;
  let analytics = null;
  let diagnostics = null;

  async function api(url, options = {}) {
    const response = await fetch(url, { ...options, headers: { ...H, ...(options.headers || {}) } });
    if (response.status === 401) {
      location.href = "/internal/login";
      throw new Error("請重新登入");
    }
    const data = await response.json().catch(() => ({ ok: false, error: "系統回覆格式錯誤" }));
    if (!response.ok || data.ok === false) throw new Error(data.error || "操作失敗");
    return data;
  }

  async function refreshExtra() {
    const results = await Promise.allSettled([
      api("/internal/api/v2/state"),
      api("/internal/api/v2/ops/analytics"),
      api("/internal/api/v2/ops/diagnostics"),
    ]);
    if (results[0].status === "fulfilled") state = results[0].value;
    if (results[1].status === "fulfilled") analytics = results[1].value;
    if (results[2].status === "fulfilled") diagnostics = results[2].value;
    renderTools();
    decorateAll();
  }

  function installStyles() {
    if (byId("xjwOpsStyles")) return;
    const style = document.createElement("style");
    style.id = "xjwOpsStyles";
    style.textContent = `
      .ops-search{position:sticky;top:56px;z-index:18;background:#f7f4ed;padding:8px 0}
      .ops-search-row{display:flex;gap:8px;align-items:center}.ops-search-row input{flex:1}
      .ops-results{display:grid;gap:8px;margin-top:8px}.ops-result{border:1px solid #ded7ca;border-radius:12px;padding:10px;background:#fff}
      .ops-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.ops-mini{padding:7px 10px;font-size:13px}
      .ops-kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.ops-kpi .metric{min-height:92px}
      .ops-table{width:100%;overflow:auto}.ops-table table{min-width:620px}
      .ops-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0}
      .ops-badge{display:inline-block;padding:4px 8px;border-radius:999px;background:#ece8df;font-size:12px;font-weight:800}
      .ops-online{position:fixed;right:12px;bottom:72px;z-index:50;padding:7px 10px;border-radius:999px;background:#315c45;color:#fff;font-size:12px;box-shadow:0 8px 24px #0002}
      .ops-online.offline{background:#8d2024}.ops-draft{font-size:12px;color:#6b655d;margin-top:4px}
      @media(max-width:760px){.ops-kpi{grid-template-columns:repeat(2,1fr)}.ops-search{top:0}.ops-online{bottom:68px}}
    `;
    document.head.appendChild(style);
  }

  function installToolsView() {
    if (byId("tools")) return;
    const tabs = document.querySelector("nav.tabs");
    if (tabs) {
      const button = document.createElement("button");
      button.className = "tab";
      button.dataset.view = "tools";
      button.textContent = "營運工具";
      tabs.appendChild(button);
    }
    const main = document.querySelector("main.shell");
    if (!main) return;
    const section = document.createElement("section");
    section.id = "tools";
    section.className = "view";
    section.innerHTML = `
      <div class="ops-search"><article class="panel"><div class="ops-search-row"><input id="opsGlobalSearch" placeholder="搜尋訂單、客戶、電話、商品、提醒、社群貼文"><button class="btn primary" id="opsSearchBtn" type="button">搜尋</button></div><div id="opsSearchResults" class="ops-results"></div></article></div>
      <div id="opsKpis" class="ops-kpi"></div>
      <div class="grid2" style="margin-top:14px">
        <article class="panel"><h2>快速工作</h2><div class="ops-actions"><button class="btn primary" data-view="orders">新增訂單</button><button class="btn soft" data-view="customers">新增客戶</button><button class="btn gold" data-view="inventory">庫存盤點</button><button class="btn success" data-view="social">建立貼文</button></div><div class="ops-actions"><button id="opsSyncBtn" class="btn soft" type="button">立即同步 Supabase</button><button id="opsRefreshBtn" class="btn soft" type="button">重新載入全部資料</button></div></article>
        <article class="panel"><h2>匯出資料</h2><div class="stack"><a class="btn soft" href="/internal/api/v2/export/orders.csv">訂單 CSV</a><a class="btn soft" href="/internal/api/v2/export/customers.csv">客戶 CSV</a><a class="btn soft" href="/internal/api/v2/export/inventory.csv">庫存 CSV</a><a class="btn soft" href="/internal/api/v2/export/activities.csv">操作紀錄 CSV</a><a class="btn primary" href="/internal/api/v2/export/backup">完整備份 JSON</a></div></article>
      </div>
      <div class="grid2" style="margin-top:14px"><article class="panel"><h2>熱銷產品</h2><div id="opsTopProducts" class="list"></div></article><article class="panel"><h2>重要客戶</h2><div id="opsTopCustomers" class="list"></div></article></div>
      <article class="panel" style="margin-top:14px"><div class="toolbar"><h2>系統診斷</h2><span class="muted">工具版本 ${VERSION}</span></div><div id="opsDiagnostics" class="list"></div></article>
    `;
    main.appendChild(section);
  }

  function installGlobalSearch() {
    const run = () => {
      const query = (byId("opsGlobalSearch")?.value || "").trim().toLowerCase();
      const area = byId("opsSearchResults");
      if (!area) return;
      if (!query || !state) { area.innerHTML = ""; return; }
      const results = [];
      for (const item of state.orders || []) {
        const hay = [item.customerName,item.phone,item.items,item.note,item.trackingNo,item.status].join(" ").toLowerCase();
        if (hay.includes(query)) results.push({ type:"訂單", title:`${item.customerName}｜${item.status}`, detail:`${item.items || ""}｜${money(item.total)}`, view:"orders" });
      }
      for (const item of state.customers || []) {
        const hay = [item.name,item.phone,item.lineId,item.interests,item.tags,item.note].join(" ").toLowerCase();
        if (hay.includes(query)) results.push({ type:"客戶", title:item.name, detail:[item.phone,item.interests,item.tags].filter(Boolean).join("｜"), view:"customers" });
      }
      for (const item of state.inventory || []) {
        if ([item.name,item.spec,item.productId].join(" ").toLowerCase().includes(query)) results.push({ type:"庫存", title:item.name, detail:`庫存 ${item.stock}｜警戒 ${item.lowStock}`, view:"inventory" });
      }
      for (const item of state.reminders || []) {
        if ([item.title,item.note].join(" ").toLowerCase().includes(query)) results.push({ type:"提醒", title:item.title, detail:dt(item.dueAt), view:"reminders" });
      }
      for (const item of state.socialPosts || []) {
        if ([item.title,item.instagramCaption,item.facebookCaption,item.status].join(" ").toLowerCase().includes(query)) results.push({ type:"社群", title:item.title, detail:`${item.status}｜${dt(item.scheduledAt)}`, view:"social" });
      }
      area.innerHTML = results.slice(0,50).map((item) => `<button class="ops-result" data-view="${item.view}" style="text-align:left;width:100%"><span class="ops-badge">${item.type}</span><strong style="display:block;margin-top:5px">${esc(item.title)}</strong><span class="meta">${esc(item.detail)}</span></button>`).join("") || '<div class="item muted">找不到符合資料</div>';
    };
    byId("opsSearchBtn")?.addEventListener("click", run);
    byId("opsGlobalSearch")?.addEventListener("input", run);
  }

  function renderTools() {
    if (!analytics || !diagnostics) return;
    const kpis = byId("opsKpis");
    if (kpis) kpis.innerHTML = [
      [analytics.validOrderCount,"有效訂單"],[money(analytics.totalSales),"訂單金額"],[money(analytics.averageOrderValue),"平均客單"],[analytics.repeatCustomerCount,"回購客戶"],
    ].map(([value,label]) => `<div class="metric"><strong>${esc(value)}</strong><span>${label}</span></div>`).join("");
    const products = byId("opsTopProducts");
    if (products) products.innerHTML = (analytics.topProducts || []).slice(0,10).map((item,index) => `<div class="item"><strong>${index+1}. ${esc(item.name)}</strong><span class="pill" style="float:right">${Number(item.qty)} 件</span></div>`).join("") || '<div class="item muted">尚無銷售資料</div>';
    const customers = byId("opsTopCustomers");
    if (customers) customers.innerHTML = (analytics.topCustomers || []).slice(0,10).map((item,index) => `<div class="item"><strong>${index+1}. ${esc(item.name)}</strong><div class="meta">${esc(item.phone)}｜${item.orders} 筆｜${money(item.total)}｜最近 ${dt(item.lastAt)}</div></div>`).join("") || '<div class="item muted">尚無客戶消費資料</div>';
    const diag = byId("opsDiagnostics");
    if (diag) {
      const rows = [
        `Supabase：${diagnostics.supabaseConnected ? "正常" : (diagnostics.supabaseEnabled ? "異常" : "未啟用")}`,
        `資料筆數：訂單 ${diagnostics.counts?.orders || 0}、客戶 ${diagnostics.counts?.customers || 0}、庫存 ${diagnostics.counts?.inventory || 0}、提醒 ${diagnostics.counts?.reminders || 0}、社群 ${diagnostics.counts?.socialPosts || 0}`,
        `LINE：${diagnostics.integrations?.line ? "已設定" : "未設定"}｜CRM：${diagnostics.integrations?.crm ? "已設定" : "使用預設網址"}`,
        `Instagram：${diagnostics.integrations?.instagram ? "已設定" : "未設定"}｜Facebook：${diagnostics.integrations?.facebook ? "已設定" : "未設定"}`,
        `社群圖片儲存：${diagnostics.integrations?.socialStorage ? "已設定" : "未設定"}`,
        diagnostics.lastError ? `最近錯誤：${diagnostics.lastError}` : `最近儲存：${diagnostics.lastSavedAt || "尚無"}`,
      ];
      diag.innerHTML = rows.map((row) => `<div class="item">${esc(row)}</div>`).join("");
    }
  }

  function customerStats(customer) {
    const matches = (state?.orders || []).filter((order) => (customer.phone && order.phone === customer.phone) || (!customer.phone && order.customerName === customer.name));
    return { count: matches.length, total: matches.filter((item) => item.status !== "已取消").reduce((sum,item) => sum + Number(item.total || 0), 0), last: matches.sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt))[0] };
  }

  function decorateOrders() {
    document.querySelectorAll("#orderList .item").forEach((card) => {
      if (card.dataset.opsDecorated) return;
      card.dataset.opsDecorated = "1";
      const edit = card.querySelector("[data-order-edit]");
      const id = edit?.dataset.orderEdit;
      if (!id) return;
      const actions = card.querySelector(".actions");
      actions?.insertAdjacentHTML("beforeend", `<button class="btn soft ops-mini" data-ops-order-duplicate="${esc(id)}">複製</button><button class="btn soft ops-mini" data-ops-order-print="${esc(id)}">列印</button><button class="btn soft ops-mini" data-ops-order-copy="${esc(id)}">複製通知文字</button>`);
    });
  }

  function decorateCustomers() {
    document.querySelectorAll("#customerList .item").forEach((card) => {
      if (card.dataset.opsDecorated) return;
      const edit = card.querySelector("[data-customer-edit]");
      const id = edit?.dataset.customerEdit;
      const customer = (state?.customers || []).find((item) => item.id === id);
      if (!customer) return;
      card.dataset.opsDecorated = "1";
      const stats = customerStats(customer);
      card.querySelector("h3")?.insertAdjacentHTML("afterend", `<div class="meta">消費統計：${stats.count} 筆｜${money(stats.total)}${stats.last ? `｜最近 ${dt(stats.last.createdAt)}` : ""}</div>`);
      card.querySelector(".actions")?.insertAdjacentHTML("beforeend", `<button class="btn primary ops-mini" data-ops-customer-order="${esc(id)}">建立訂單</button><button class="btn gold ops-mini" data-ops-customer-reminder="${esc(id)}">7天後追蹤</button>`);
    });
  }

  function decorateInventory() {
    const list = byId("inventoryList");
    if (!list || byId("opsInventoryToolbar")) return;
    list.insertAdjacentHTML("beforebegin", `<div id="opsInventoryToolbar" class="ops-toolbar"><input id="opsInventorySearch" class="compact" placeholder="搜尋產品"><label style="margin:0"><input id="opsLowOnly" style="width:auto" type="checkbox"> 只看低庫存</label><button id="opsInventorySaveAll" class="btn primary" type="button">儲存全部盤點</button><a class="btn soft" href="/internal/api/v2/export/inventory.csv">匯出庫存</a></div>`);
    byId("opsInventorySearch")?.addEventListener("input", filterInventory);
    byId("opsLowOnly")?.addEventListener("change", filterInventory);
    byId("opsInventorySaveAll")?.addEventListener("click", bulkInventory);
  }

  function filterInventory() {
    const q = (byId("opsInventorySearch")?.value || "").toLowerCase();
    const lowOnly = Boolean(byId("opsLowOnly")?.checked);
    document.querySelectorAll("#inventoryList > .item").forEach((card) => {
      const textValue = card.textContent.toLowerCase();
      const low = Boolean(card.querySelector(".pill.low"));
      card.style.display = (!q || textValue.includes(q)) && (!lowOnly || low) ? "" : "none";
    });
  }

  async function bulkInventory() {
    if (!state?.inventory?.length) return;
    const items = state.inventory.map((item) => ({ productId:item.productId, stock:Number(byId(`stock-${item.productId}`)?.value || 0), lowStock:Number(byId(`low-${item.productId}`)?.value || 0) }));
    await api("/internal/api/v2/inventory/bulk", { method:"POST", body:JSON.stringify({ items }) });
    await window.loadAll?.();
    await refreshExtra();
    alert("全部庫存盤點已儲存");
  }

  function decorateSocial() {
    const form = byId("socialForm");
    if (form && !form.elements.socialEditId) form.insertAdjacentHTML("afterbegin", '<input type="hidden" name="socialEditId"><div id="opsSocialEditNotice" class="notice" hidden>正在編輯草稿 <button class="btn soft ops-mini" type="button" id="opsSocialCancelEdit">取消編輯</button></div>');
    document.querySelectorAll("#socialList .item").forEach((card) => {
      if (card.dataset.opsDecorated) return;
      const anyAction = card.querySelector("[data-social-action]");
      const id = anyAction?.dataset.id;
      if (!id) return;
      card.dataset.opsDecorated = "1";
      card.querySelector(".actions")?.insertAdjacentHTML("beforeend", `<button class="btn primary ops-mini" data-ops-social-edit="${esc(id)}">編輯</button><button class="btn soft ops-mini" data-ops-social-duplicate="${esc(id)}">複製</button><button class="btn soft ops-mini" data-ops-social-copy="${esc(id)}">複製文案</button>`);
    });
  }

  function installOrderProductPicker() {
    const form = byId("orderForm");
    if (!form || byId("opsProductPicker")) return;
    const items = form.elements.items;
    const label = items?.closest("label");
    if (!label) return;
    label.insertAdjacentHTML("beforebegin", `<div id="opsProductPicker" class="grid3"><label>快速選商品<select id="opsProductSelect"></select></label><label>數量<input id="opsProductQty" type="number" min="1" value="1"></label><label style="align-self:end"><button id="opsProductAdd" class="btn gold" type="button">加入商品內容</button></label></div>`);
    const select = byId("opsProductSelect");
    if (select) select.innerHTML = '<option value="">選擇產品</option>' + (state?.inventory || []).map((item) => `<option value="${esc(item.name)}" data-unit="${esc(item.unit || "件")}">${esc(item.name)} ${esc(item.spec || "")}</option>`).join("");
    byId("opsProductAdd")?.addEventListener("click", () => {
      const name = select?.value;
      const qty = Math.max(1, Number(byId("opsProductQty")?.value || 1));
      if (!name || !items) return alert("請先選擇商品");
      items.value = [items.value.trim(), `${name} × ${qty}`].filter(Boolean).join("\n");
      items.dispatchEvent(new Event("input", { bubbles:true }));
    });
  }

  function installReminderTemplates() {
    const form = byId("reminderForm");
    if (!form || byId("opsReminderTemplate")) return;
    form.insertAdjacentHTML("afterbegin", `<label>快速範本<select id="opsReminderTemplate"><option value="">選擇範本</option><option value="follow7">7天後追蹤客戶</option><option value="stock7">7天後盤點庫存</option><option value="social1">明天檢查社群貼文</option><option value="payment3">3天後確認付款</option></select></label>`);
    byId("opsReminderTemplate")?.addEventListener("change", (event) => {
      const map = { follow7:[7,"追蹤客戶","確認客戶使用與後續需求"], stock7:[7,"盤點庫存","確認庫存、警戒值與補貨需求"], social1:[1,"檢查社群貼文","確認排程、圖片與文案"], payment3:[3,"確認付款","確認訂單付款與後續出貨"] };
      const row = map[event.target.value];
      if (!row) return;
      const date = new Date(Date.now() + row[0]*86400000); date.setHours(10,0,0,0); date.setMinutes(date.getMinutes()-date.getTimezoneOffset());
      form.elements.title.value = row[1]; form.elements.note.value = row[2]; form.elements.dueAt.value = date.toISOString().slice(0,16);
    });
  }

  function installAutosave() {
    ["orderForm","customerForm","reminderForm","socialForm"].forEach((id) => {
      const form = byId(id); if (!form || form.dataset.autosave) return; form.dataset.autosave = "1";
      const key = `xjw-draft-${id}`;
      try {
        const saved = JSON.parse(localStorage.getItem(key) || "null");
        if (saved) Object.entries(saved).forEach(([name,value]) => { const field=form.elements[name]; if (!field || name === "id" || name === "socialEditId") return; if (field.type === "checkbox") field.checked=Boolean(value); else if (!field.value) field.value=value; });
      } catch {}
      const save = () => { const data={}; new FormData(form).forEach((value,name)=>{ if (!(value instanceof File)) data[name]=value; }); form.querySelectorAll('input[type="checkbox"]').forEach((field)=>data[field.name]=field.checked); localStorage.setItem(key,JSON.stringify(data)); let note=form.querySelector(".ops-draft"); if(!note){note=document.createElement("div");note.className="ops-draft";form.appendChild(note)} note.textContent=`已自動暫存 ${new Date().toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"})}`; };
      form.addEventListener("input", save); form.addEventListener("change", save); form.addEventListener("submit",()=>setTimeout(()=>localStorage.removeItem(key),500));
    });
  }

  function decorateAll() {
    decorateOrders(); decorateCustomers(); decorateInventory(); decorateSocial(); installOrderProductPicker(); installReminderTemplates(); installAutosave();
  }

  function copyText(value) {
    navigator.clipboard?.writeText(value).then(()=>alert("已複製")).catch(()=>prompt("請複製以下文字",value));
  }

  function printOrder(id) {
    const item = state?.orders?.find((row)=>row.id===id); if(!item)return;
    const win=window.open("","_blank"); if(!win)return alert("瀏覽器阻擋了列印視窗");
    win.document.write(`<title>仙加味訂單</title><style>body{font-family:sans-serif;padding:30px;line-height:1.7}h1{color:#0b1f3b}table{width:100%;border-collapse:collapse}td{border-bottom:1px solid #ddd;padding:8px}</style><h1>仙加味訂單</h1><table><tr><td>訂單編號</td><td>${esc(item.id)}</td></tr><tr><td>客戶</td><td>${esc(item.customerName)}</td></tr><tr><td>電話</td><td>${esc(item.phone||"")}</td></tr><tr><td>商品</td><td>${esc(item.items||"").replace(/\n/g,"<br>")}</td></tr><tr><td>金額</td><td>${money(item.total)}</td></tr><tr><td>付款</td><td>${esc(item.payment||"")}</td></tr><tr><td>配送</td><td>${esc(item.shipping||"")}</td></tr><tr><td>地址</td><td>${esc(item.address||"")}</td></tr><tr><td>備註</td><td>${esc(item.note||"")}</td></tr></table>`); win.document.close(); win.focus(); setTimeout(()=>win.print(),300);
  }

  async function editSocial(id) {
    const item=state?.socialPosts?.find((row)=>row.id===id); const form=byId("socialForm"); if(!item||!form)return;
    form.elements.socialEditId.value=item.id; ["title","imageUrl","instagramCaption","facebookCaption"].forEach((key)=>{if(form.elements[key])form.elements[key].value=item[key]||""});
    if(form.elements.scheduledAt){const d=new Date(item.scheduledAt);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());form.elements.scheduledAt.value=d.toISOString().slice(0,16)}
    if(form.elements.publishInstagram)form.elements.publishInstagram.checked=Boolean(item.publishInstagram); if(form.elements.publishFacebook)form.elements.publishFacebook.checked=Boolean(item.publishFacebook);
    const notice=byId("opsSocialEditNotice");if(notice)notice.hidden=false; const preview=byId("socialImagePreview");if(preview&&item.imageUrl){preview.src=item.imageUrl;preview.hidden=false} window.showView?.("social"); window.scrollTo(0,0);
  }

  function bindActions() {
    document.addEventListener("click", async (event) => {
      try {
        const duplicate=event.target.closest("[data-ops-order-duplicate]"); if(duplicate){await api(`/internal/api/v2/orders/${encodeURIComponent(duplicate.dataset.opsOrderDuplicate)}/duplicate`,{method:"POST",body:"{}"});await window.loadAll?.();await refreshExtra();return}
        const print=event.target.closest("[data-ops-order-print]"); if(print){printOrder(print.dataset.opsOrderPrint);return}
        const copy=event.target.closest("[data-ops-order-copy]"); if(copy){const item=state?.orders?.find((row)=>row.id===copy.dataset.opsOrderCopy);if(item)copyText(`您好 ${item.customerName}，仙加味訂單內容：\n${item.items||""}\n金額：${money(item.total)}\n狀態：${item.status}\n如有需要調整請直接回覆，謝謝。`);return}
        const customerOrder=event.target.closest("[data-ops-customer-order]"); if(customerOrder){const customer=state?.customers?.find((row)=>row.id===customerOrder.dataset.opsCustomerOrder);const form=byId("orderForm");if(customer&&form){form.elements.customerName.value=customer.name;form.elements.phone.value=customer.phone||"";window.showView?.("orders");}return}
        const customerReminder=event.target.closest("[data-ops-customer-reminder]"); if(customerReminder){await api(`/internal/api/v2/customers/${encodeURIComponent(customerReminder.dataset.opsCustomerReminder)}/reminder`,{method:"POST",body:"{}"});await window.loadAll?.();await refreshExtra();alert("已建立7天後追蹤提醒");return}
        const socialEdit=event.target.closest("[data-ops-social-edit]"); if(socialEdit){editSocial(socialEdit.dataset.opsSocialEdit);return}
        const socialDuplicate=event.target.closest("[data-ops-social-duplicate]"); if(socialDuplicate){await api(`/internal/api/v2/social/${encodeURIComponent(socialDuplicate.dataset.opsSocialDuplicate)}/duplicate`,{method:"POST",body:"{}"});await window.loadAll?.();await refreshExtra();return}
        const socialCopy=event.target.closest("[data-ops-social-copy]"); if(socialCopy){const item=state?.socialPosts?.find((row)=>row.id===socialCopy.dataset.opsSocialCopy);if(item)copyText([item.instagramCaption,item.facebookCaption].filter(Boolean).join("\n\n--- Facebook ---\n"));return}
      } catch(error){alert(error.message||"操作失敗")}
    });
    byId("opsSyncBtn")?.addEventListener("click",async()=>{try{await api("/internal/api/v2/ops/sync",{method:"POST",body:"{}"});await refreshExtra();alert("同步完成")}catch(error){alert(error.message)}});
    byId("opsRefreshBtn")?.addEventListener("click",async()=>{await window.loadAll?.();await refreshExtra()});
    byId("opsSocialCancelEdit")?.addEventListener("click",()=>{const form=byId("socialForm");if(!form)return;form.elements.socialEditId.value="";form.reset();byId("opsSocialEditNotice").hidden=true});
    byId("socialForm")?.addEventListener("submit",async(event)=>{const form=event.currentTarget;const id=form.elements.socialEditId?.value;if(!id)return;event.preventDefault();event.stopImmediatePropagation();try{const data=Object.fromEntries(new FormData(form).entries());form.querySelectorAll('input[type="checkbox"]').forEach((field)=>data[field.name]=field.checked);delete data.socialEditId;await api(`/internal/api/v2/social/${encodeURIComponent(id)}`,{method:"PATCH",body:JSON.stringify(data)});form.reset();form.elements.socialEditId.value="";byId("opsSocialEditNotice").hidden=true;await window.loadAll?.();await refreshExtra();alert("草稿已更新")}catch(error){alert(error.message)}},true);
  }

  function installConnectionBadge() {
    const badge=document.createElement("div");badge.id="opsConnection";badge.className="ops-online";document.body.appendChild(badge);
    const update=()=>{badge.textContent=navigator.onLine?"已連線":"離線模式";badge.classList.toggle("offline",!navigator.onLine)};window.addEventListener("online",update);window.addEventListener("offline",update);update();
  }

  function watchChanges() {
    const observer=new MutationObserver(()=>decorateAll());["orderList","customerList","inventoryList","socialList"].forEach((id)=>{const node=byId(id);if(node)observer.observe(node,{childList:true,subtree:true})});
  }

  async function start() {
    installStyles();installToolsView();installGlobalSearch();bindActions();installConnectionBadge();watchChanges();await refreshExtra();decorateAll();
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();