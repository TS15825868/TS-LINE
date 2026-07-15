"use strict";

(() => {
  const VERSION = "20260715-order-calculator-1";
  const H = { "Content-Type": "application/json", "X-XJW-Requested-With": "internal-app-v2" };
  const money = (value) => `$${Math.round(Number(value || 0)).toLocaleString("zh-TW")}`;
  const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[char]));

  let appState = { inventory: [], orders: [] };
  let rows = [];
  let wrapped = false;

  async function api(url) {
    const response = await fetch(url, { cache: "no-store", headers: H });
    if (response.status === 401) {
      location.href = "/internal/login";
      throw new Error("請重新登入");
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || "讀取資料失敗");
    return data;
  }

  function form() { return document.getElementById("orderForm"); }
  function field(name) { return form()?.elements?.[name] || null; }
  function inventoryItem(productId) {
    return (appState.inventory || []).find((item) => String(item.productId) === String(productId));
  }

  function ensureHidden(name) {
    const orderForm = form();
    if (!orderForm) return null;
    let input = orderForm.elements[name];
    if (!input) {
      input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      orderForm.appendChild(input);
    }
    return input;
  }

  function ensureStatusOption(select) {
    if (!select || [...select.options].some((option) => option.value === "待送貨")) return;
    const option = new Option("待送貨", "待送貨");
    const shipped = [...select.options].find((item) => item.value === "已出貨");
    if (shipped) select.insertBefore(option, shipped);
    else select.add(option);
  }

  function installStatusOptions() {
    ensureStatusOption(field("status"));
    const filter = document.getElementById("orderFilter");
    ensureStatusOption(filter);
  }

  function normalizeLine(line) {
    const product = inventoryItem(line.productId) || (appState.inventory || []).find((item) => item.name === line.name);
    const qty = Math.max(1, Number(line.qty || line.quantity || 1));
    let unitPrice = Number(line.unitPrice ?? line.price ?? product?.price ?? 0);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) unitPrice = 0;
    return {
      productId: String(product?.productId || line.productId || ""),
      name: String(product?.name || line.name || line.productName || "商品"),
      spec: String(product?.spec || line.spec || ""),
      qty,
      unitPrice,
    };
  }

  function parseText(value) {
    return String(value || "").split(/\n|；|;/).map((raw) => {
      const match = raw.trim().match(/^(.+?)\s*[×xX*]\s*(\d+(?:\.\d+)?)(?:\s*[｜|]\s*單價\s*\$?([\d,]+(?:\.\d+)?))?(?:\s*[｜|]\s*小計\s*\$?([\d,]+(?:\.\d+)?))?\s*$/);
      if (!match) return null;
      const product = (appState.inventory || []).find((item) => item.name === match[1].trim())
        || (appState.inventory || []).find((item) => String(item.name).includes(match[1].trim()) || match[1].trim().includes(String(item.name)));
      const qty = Number(match[2] || 1);
      const explicitSubtotal = Number(String(match[4] || "0").replace(/,/g, ""));
      const unitPrice = Number(String(match[3] || "0").replace(/,/g, "")) || (qty && explicitSubtotal ? explicitSubtotal / qty : Number(product?.price || 0));
      return normalizeLine({ productId: product?.productId, name: product?.name || match[1].trim(), qty, unitPrice });
    }).filter(Boolean);
  }

  function subtotal(row) { return Math.round(Number(row.qty || 0) * Number(row.unitPrice || 0)); }
  function total() { return rows.reduce((sum, row) => sum + subtotal(row), 0); }

  function syncFields() {
    const items = field("items");
    const totalField = field("total");
    const json = ensureHidden("orderLinesJson");
    const normalizedRows = rows.map((row) => ({ ...row, subtotal: subtotal(row) }));
    if (items) {
      items.value = normalizedRows.map((row) => `${row.name} × ${row.qty}｜單價 ${money(row.unitPrice)}｜小計 ${money(row.subtotal)}`).join("\n");
      items.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (totalField) {
      totalField.value = String(total());
      totalField.readOnly = true;
      totalField.inputMode = "numeric";
      totalField.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (json) json.value = JSON.stringify(normalizedRows);
    const summary = document.getElementById("xjwOrderTotalSummary");
    if (summary) summary.textContent = `訂單總額：${money(total())}`;
  }

  function renderRows() {
    const list = document.getElementById("xjwOrderLineList");
    if (!list) return;
    list.innerHTML = rows.length ? rows.map((row, index) => `
      <div class="xjw-order-line" data-order-line-index="${index}">
        <div class="xjw-order-line-name"><strong>${esc(row.name)}</strong><span>${esc(row.spec || "")}</span></div>
        <label>單價<input data-order-price="${index}" type="number" min="0" step="1" value="${Number(row.unitPrice || 0)}"></label>
        <label>數量<input data-order-qty="${index}" type="number" min="1" step="1" value="${Number(row.qty || 1)}"></label>
        <div class="xjw-order-subtotal"><span>小計</span><strong>${money(subtotal(row))}</strong></div>
        <button class="btn danger xjw-order-remove" type="button" data-order-remove="${index}">刪除</button>
      </div>`).join("") : '<div class="item muted">尚未加入商品</div>';
    syncFields();
  }

  function productOptions() {
    return '<option value="">選擇產品</option>' + (appState.inventory || []).map((item) => `<option value="${esc(item.productId)}">${esc(item.name)} ${esc(item.spec || "")}｜${money(item.price || 0)}</option>`).join("");
  }

  function installUi() {
    const orderForm = form();
    if (!orderForm) return;
    ensureHidden("orderLinesJson");
    installStatusOptions();

    const originalPicker = document.getElementById("xjwProductPicker");
    if (originalPicker && originalPicker.dataset.orderCalculator !== VERSION) {
      originalPicker.dataset.orderCalculator = VERSION;
      originalPicker.innerHTML = `
        <label>快速選商品<select id="xjwOrderProductSelect">${productOptions()}</select></label>
        <label>單價<input id="xjwOrderProductPrice" type="number" min="0" step="1" value="0"></label>
        <label>數量<input id="xjwOrderProductQty" type="number" min="1" step="1" value="1"></label>
        <label style="align-self:end"><button id="xjwOrderProductAdd" class="btn gold" type="button">加入商品</button></label>`;
      originalPicker.className = "grid4";
      originalPicker.insertAdjacentHTML("afterend", '<div id="xjwOrderLineList" class="xjw-order-line-list"></div><div id="xjwOrderTotalSummary" class="notice ok"><strong>訂單總額：$0</strong></div>');
    }

    const totalField = field("total");
    if (totalField) {
      totalField.readOnly = true;
      const label = totalField.closest("label");
      if (label && !label.dataset.orderTotalLabel) {
        label.dataset.orderTotalLabel = "1";
        const textNode = [...label.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
        if (textNode) textNode.textContent = "訂單總額（自動計算）";
      }
    }
    const items = field("items");
    if (items) {
      items.readOnly = true;
      items.placeholder = "加入商品後自動產生明細";
    }
    renderRows();
    decorateStatusButtons();
  }

  function loadOrderRows(order) {
    if (!order) return;
    const structured = Array.isArray(order.orderLines) ? order.orderLines.map(normalizeLine) : [];
    rows = structured.length ? structured : parseText(order.items);
    if (rows.length === 1 && !rows[0].unitPrice && Number(order.total || 0) > 0) {
      rows[0].unitPrice = Number(order.total) / Number(rows[0].qty || 1);
    }
    renderRows();
  }

  function resetRows() {
    rows = [];
    renderRows();
  }

  function decorateStatusButtons() {
    document.querySelectorAll("#orderList > .item").forEach((card) => {
      if (card.querySelector('[data-order-status][data-status="待送貨"]')) return;
      const edit = card.querySelector("[data-order-edit]");
      const id = edit?.dataset.orderEdit;
      const actions = card.querySelector(".actions");
      if (!id || !actions) return;
      const shipped = actions.querySelector('[data-order-status][data-status="已出貨"]');
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn soft";
      button.dataset.orderStatus = id;
      button.dataset.status = "待送貨";
      button.textContent = "待送貨";
      if (shipped) actions.insertBefore(button, shipped);
      else actions.appendChild(button);
    });
  }

  function addStyles() {
    if (document.getElementById("xjwOrderCalculatorStyles")) return;
    const style = document.createElement("style");
    style.id = "xjwOrderCalculatorStyles";
    style.textContent = `
      .grid4{display:grid;grid-template-columns:1.5fr 1fr .75fr auto;gap:12px;align-items:end;margin:12px 0}
      .xjw-order-line-list{display:grid;gap:9px;margin:12px 0}
      .xjw-order-line{display:grid;grid-template-columns:minmax(180px,1.5fr) minmax(110px,.7fr) minmax(90px,.55fr) minmax(100px,.65fr) auto;gap:10px;align-items:end;padding:12px;border:1px solid #ded7ca;border-radius:14px;background:#fffdf8}
      .xjw-order-line label{margin:0}.xjw-order-line-name span,.xjw-order-subtotal span{display:block;color:#6b655d;font-size:12px}.xjw-order-subtotal strong{font-size:18px;color:#0b1f3b}
      @media(max-width:900px){.grid4{grid-template-columns:1fr 1fr}.xjw-order-line{grid-template-columns:1fr 1fr}.xjw-order-line-name{grid-column:1/-1}.xjw-order-remove{width:100%}}
    `;
    document.head.appendChild(style);
  }

  async function refreshState() {
    appState = await api(`/internal/api/v2/state?t=${Date.now()}`);
    installUi();
  }

  function wrapLoadAll() {
    if (wrapped || typeof window.loadAll !== "function") return;
    const original = window.loadAll;
    if (original.__xjwOrderCalculatorWrapped) { wrapped = true; return; }
    const next = async (...args) => {
      const result = await original(...args);
      await refreshState();
      return result;
    };
    next.__xjwOrderCalculatorWrapped = true;
    window.loadAll = next;
    wrapped = true;
  }

  function bind() {
    addStyles();
    document.addEventListener("change", (event) => {
      if (event.target.id === "xjwOrderProductSelect") {
        const product = inventoryItem(event.target.value);
        const price = document.getElementById("xjwOrderProductPrice");
        if (price) price.value = String(Number(product?.price || 0));
      }
      if (event.target.matches("[data-order-price]")) {
        const index = Number(event.target.dataset.orderPrice);
        if (rows[index]) rows[index].unitPrice = Math.max(0, Number(event.target.value || 0));
        renderRows();
      }
      if (event.target.matches("[data-order-qty]")) {
        const index = Number(event.target.dataset.orderQty);
        if (rows[index]) rows[index].qty = Math.max(1, Number(event.target.value || 1));
        renderRows();
      }
    }, true);

    document.addEventListener("click", (event) => {
      const add = event.target.closest("#xjwOrderProductAdd");
      if (add) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const productId = document.getElementById("xjwOrderProductSelect")?.value || "";
        const product = inventoryItem(productId);
        if (!product) return alert("請先選擇商品");
        const unitPrice = Math.max(0, Number(document.getElementById("xjwOrderProductPrice")?.value || product.price || 0));
        const qty = Math.max(1, Number(document.getElementById("xjwOrderProductQty")?.value || 1));
        rows.push(normalizeLine({ productId: product.productId, name: product.name, spec: product.spec, unitPrice, qty }));
        renderRows();
        return;
      }
      const remove = event.target.closest("[data-order-remove]");
      if (remove) {
        event.preventDefault();
        event.stopImmediatePropagation();
        rows.splice(Number(remove.dataset.orderRemove), 1);
        renderRows();
        return;
      }
      const edit = event.target.closest("[data-order-edit]");
      if (edit) {
        const id = edit.dataset.orderEdit;
        setTimeout(() => loadOrderRows((appState.orders || []).find((order) => order.id === id)), 80);
      }
    }, true);

    form()?.addEventListener("reset", () => setTimeout(resetRows, 0));
    form()?.addEventListener("submit", () => syncFields(), true);
  }

  async function start() {
    bind();
    wrapLoadAll();
    try { await refreshState(); } catch (error) { console.warn("order calculator", error.message); }
    window.xjwOrderCalculator = { version: VERSION, refresh: refreshState, reset: resetRows, get rows() { return rows; } };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(start, 80), { once: true });
  else setTimeout(start, 80);
})();
