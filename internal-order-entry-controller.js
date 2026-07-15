"use strict";

(() => {
  const VERSION = "20260715-order-entry-1";
  const HEADERS = { "Content-Type": "application/json", "X-XJW-Requested-With": "internal-app-v2" };
  const byId = (id) => document.getElementById(id);
  const num = (value) => Number.isFinite(Number(String(value ?? "").replace(/,/g, ""))) ? Number(String(value ?? "").replace(/,/g, "")) : 0;
  const money = (value) => `$${Math.round(num(value)).toLocaleString("zh-TW")}`;
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));

  let state = { inventory: [], orders: [] };
  let lines = [];
  let installed = false;

  async function api(url) {
    const response = await fetch(url, { cache: "no-store", headers: HEADERS });
    if (response.status === 401) {
      location.href = "/internal/login";
      throw new Error("請重新登入");
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || "讀取訂單資料失敗");
    return data;
  }

  function inventoryItem(productId, name = "") {
    return (state.inventory || []).find((item) => item.productId === productId)
      || (state.inventory || []).find((item) => String(item.name || "").trim() === String(name || "").trim());
  }

  function parseLegacy(order) {
    if (Array.isArray(order?.orderLines) && order.orderLines.length) {
      return order.orderLines.map((line) => ({
        productId: String(line.productId || ""),
        name: String(line.name || line.productName || "自訂商品"),
        qty: Math.max(1, num(line.qty ?? line.quantity)),
        unitPrice: Math.max(0, num(line.unitPrice ?? line.price)),
      }));
    }
    const raw = String(order?.items || "").split(/\n|、|；|;/).map((item) => item.trim()).filter(Boolean);
    const parsed = raw.map((text) => {
      const match = text.match(/^(.+?)\s*[×xX*]\s*(\d+(?:\.\d+)?)(?:\s*[｜|]\s*單價\s*\$?([\d,]+(?:\.\d+)?))?(?:\s*[｜|]\s*小計\s*\$?([\d,]+(?:\.\d+)?))?/);
      if (!match) return { productId: "", name: text, qty: 1, unitPrice: 0 };
      const name = match[1].trim();
      const qty = Math.max(1, num(match[2]));
      const item = inventoryItem("", name);
      let unitPrice = num(match[3]);
      if (!unitPrice && num(match[4])) unitPrice = num(match[4]) / qty;
      if (!unitPrice && raw.length === 1 && num(order?.total)) unitPrice = num(order.total) / qty;
      if (!unitPrice) unitPrice = num(item?.price);
      return { productId: item?.productId || "", name, qty, unitPrice };
    });
    return parsed;
  }

  function ensureOption(select, value, label = value) {
    if (!select || [...select.options].some((option) => option.value === value)) return;
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    const shipped = [...select.options].find((item) => item.value === "已出貨");
    if (shipped) select.insertBefore(option, shipped);
    else select.appendChild(option);
  }

  function installStyles() {
    if (byId("xjwOrderEntryStyles")) return;
    const style = document.createElement("style");
    style.id = "xjwOrderEntryStyles";
    style.textContent = `
      #xjwOrderPricing{border:1px solid #ded7ca;border-radius:18px;padding:14px;background:#fffaf0;margin:12px 0}
      #xjwOrderPricing h3{margin:0 0 10px;color:#0b1f3b}
      .xjw-order-line-grid{display:grid;grid-template-columns:1.5fr 1fr .7fr auto;gap:10px;align-items:end}
      .xjw-order-lines{display:grid;gap:8px;margin:12px 0}
      .xjw-order-line{display:grid;grid-template-columns:1.5fr .65fr .8fr .8fr auto;gap:8px;align-items:center;padding:10px;border:1px solid #ded7ca;border-radius:13px;background:#fff}
      .xjw-order-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:12px}
      .xjw-order-total{font-size:20px;font-weight:900;color:#0b1f3b}
      .xjw-stock-note{font-size:12px;color:#6b655d;margin-top:5px}
      .xjw-order-finance{margin:8px 0;padding:8px 10px;border-radius:10px;background:#f7f4ed;font-size:13px}
      @media(max-width:820px){.xjw-order-line-grid,.xjw-order-summary{grid-template-columns:1fr 1fr}.xjw-order-line{grid-template-columns:1fr 1fr}.xjw-order-line .xjw-line-name{grid-column:1/-1}}
      @media(max-width:520px){.xjw-order-line-grid,.xjw-order-summary{grid-template-columns:1fr}.xjw-order-line{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(style);
  }

  function productOptions() {
    return '<option value="">選擇正式產品</option>'
      + (state.inventory || []).map((item) => {
        const available = num(item.availableStock != null ? item.availableStock : num(item.stock) - num(item.reserved));
        return `<option value="${esc(item.productId)}" data-name="${esc(item.name)}" data-price="${num(item.price)}" data-available="${available}">${esc(item.name)} ${esc(item.spec || "")}｜可用 ${available}｜${money(item.price)}</option>`;
      }).join("")
      + '<option value="__custom__">自訂商品／服務</option>';
  }

  function installForm() {
    const form = byId("orderForm");
    if (!form || byId("xjwOrderPricing")) return;
    byId("xjwProductPicker")?.remove();
    installStyles();

    const items = form.elements.items;
    const itemsLabel = items?.closest("label");
    if (!itemsLabel) return;
    items.readOnly = true;
    items.placeholder = "商品明細會由上方自動產生";
    const total = form.elements.total;
    if (total) {
      total.readOnly = true;
      total.inputMode = "numeric";
      total.setAttribute("aria-label", "訂單總額，自動計算");
    }

    itemsLabel.insertAdjacentHTML("beforebegin", `
      <section id="xjwOrderPricing">
        <h3>商品與金額</h3>
        <div class="xjw-order-line-grid">
          <label>商品<select id="xjwLineProduct">${productOptions()}</select></label>
          <label>單價<input id="xjwLinePrice" type="number" min="0" step="1" inputmode="numeric" placeholder="輸入單價"></label>
          <label>數量<input id="xjwLineQty" type="number" min="1" step="1" value="1" inputmode="numeric"></label>
          <button id="xjwLineAdd" type="button" class="btn gold">加入明細</button>
        </div>
        <label id="xjwCustomNameWrap" hidden>自訂品名<input id="xjwCustomName" placeholder="例如：運費補差額、客製商品"></label>
        <div id="xjwSelectedStock" class="xjw-stock-note">選擇正式產品後會顯示可用庫存與建議售價。</div>
        <div id="xjwOrderLines" class="xjw-order-lines"></div>
        <input type="hidden" name="orderLines" id="xjwOrderLinesData">
        <input type="hidden" name="subtotal" id="xjwOrderSubtotalData">
        <input type="hidden" name="balance" id="xjwOrderBalanceData">
        <div class="xjw-order-summary">
          <label>商品小計<input id="xjwSubtotalView" readonly value="0"></label>
          <label>折扣<input name="discount" id="xjwDiscount" type="number" min="0" value="0" inputmode="numeric"></label>
          <label>運費<input name="shippingFee" id="xjwShippingFee" type="number" min="0" value="0" inputmode="numeric"></label>
          <label>已收金額<input name="paidAmount" id="xjwPaidAmount" type="number" min="0" value="0" inputmode="numeric"></label>
          <label>付款狀態<select name="paymentStatus" id="xjwPaymentStatus"><option value="未付款">未付款</option><option value="部分付款">部分付款</option><option value="已付款">已付款</option><option value="已退款">已退款</option></select></label>
          <label>預計送貨日<input name="expectedDeliveryAt" id="xjwExpectedDeliveryAt" type="date"></label>
          <div><span class="meta">未收餘額</span><div id="xjwBalanceView" class="xjw-order-total">$0</div></div>
          <div><span class="meta">訂單總額</span><div id="xjwTotalView" class="xjw-order-total">$0</div></div>
        </div>
      </section>`);

    ensureOption(form.elements.status, "待送貨");
    ensureOption(byId("orderFilter"), "待送貨");
    bindFormActions();
    calculate();
  }

  function calculate() {
    const form = byId("orderForm");
    if (!form) return;
    lines = lines.map((line) => ({ ...line, qty: Math.max(1, num(line.qty)), unitPrice: Math.max(0, num(line.unitPrice)) }));
    const subtotal = lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0);
    const discount = Math.max(0, num(byId("xjwDiscount")?.value));
    const shippingFee = Math.max(0, num(byId("xjwShippingFee")?.value));
    const total = Math.max(0, subtotal + shippingFee - discount);
    const paidAmount = Math.max(0, num(byId("xjwPaidAmount")?.value));
    const balance = Math.max(0, total - paidAmount);
    const paymentStatus = byId("xjwPaymentStatus");
    if (paymentStatus && paymentStatus.value !== "已退款") {
      paymentStatus.value = total > 0 && paidAmount >= total ? "已付款" : paidAmount > 0 ? "部分付款" : "未付款";
    }

    if (form.elements.total) form.elements.total.value = String(Math.round(total));
    if (form.elements.items) form.elements.items.value = lines.map((line) => `${line.name} × ${line.qty}｜單價 ${money(line.unitPrice)}｜小計 ${money(line.qty * line.unitPrice)}`).join("\n");
    byId("xjwOrderLinesData").value = JSON.stringify(lines.map((line) => ({ ...line, subtotal: Math.round(line.qty * line.unitPrice) })));
    byId("xjwOrderSubtotalData").value = String(Math.round(subtotal));
    byId("xjwOrderBalanceData").value = String(Math.round(balance));
    byId("xjwSubtotalView").value = money(subtotal);
    byId("xjwBalanceView").textContent = money(balance);
    byId("xjwTotalView").textContent = money(total);
    renderLines();
  }

  function renderLines() {
    const area = byId("xjwOrderLines");
    if (!area) return;
    area.innerHTML = lines.length ? lines.map((line, index) => {
      const item = inventoryItem(line.productId, line.name);
      const available = item ? num(item.availableStock != null ? item.availableStock : num(item.stock) - num(item.reserved)) : null;
      return `<div class="xjw-order-line" data-line-index="${index}">
        <div class="xjw-line-name"><strong>${esc(line.name)}</strong><div class="meta">${item ? `可用庫存 ${available}` : "自訂項目，不連動庫存"}</div></div>
        <label>數量<input data-line-qty="${index}" type="number" min="1" value="${line.qty}"></label>
        <label>單價<input data-line-price="${index}" type="number" min="0" value="${line.unitPrice}"></label>
        <strong>${money(line.qty * line.unitPrice)}</strong>
        <button class="btn danger xjw-safe-mini" type="button" data-line-remove="${index}">移除</button>
      </div>`;
    }).join("") : '<div class="muted">尚未加入商品明細</div>';
  }

  function addLine() {
    const select = byId("xjwLineProduct");
    const selected = select?.selectedOptions?.[0];
    const productId = select?.value || "";
    const custom = productId === "__custom__";
    const name = custom ? String(byId("xjwCustomName")?.value || "").trim() : String(selected?.dataset.name || "").trim();
    const qty = Math.max(1, num(byId("xjwLineQty")?.value || 1));
    const unitPrice = Math.max(0, num(byId("xjwLinePrice")?.value));
    if (!name) return alert(custom ? "請輸入自訂品名" : "請先選擇商品");
    const item = custom ? null : inventoryItem(productId, name);
    const available = item ? num(item.availableStock != null ? item.availableStock : num(item.stock) - num(item.reserved)) : null;
    if (item && qty > available) {
      alert(`${name}目前可用庫存 ${available}，不能加入 ${qty} 件。請先補貨或調整數量。`);
      return;
    }
    const existing = lines.find((line) => line.productId === (custom ? "" : productId) && line.name === name && line.unitPrice === unitPrice);
    if (existing) existing.qty += qty;
    else lines.push({ productId: custom ? "" : productId, name, qty, unitPrice });
    if (byId("xjwLineQty")) byId("xjwLineQty").value = "1";
    if (custom && byId("xjwCustomName")) byId("xjwCustomName").value = "";
    calculate();
  }

  function loadOrder(order) {
    lines = parseLegacy(order);
    const set = (id, value) => { const field = byId(id); if (field) field.value = value == null ? "" : String(value); };
    set("xjwDiscount", order?.discount || 0);
    set("xjwShippingFee", order?.shippingFee || 0);
    set("xjwPaidAmount", order?.paidAmount || 0);
    set("xjwPaymentStatus", order?.paymentStatus || (num(order?.paidAmount) >= num(order?.total) && num(order?.total) > 0 ? "已付款" : "未付款"));
    set("xjwExpectedDeliveryAt", order?.expectedDeliveryAt ? String(order.expectedDeliveryAt).slice(0, 10) : "");
    calculate();
  }

  function clearOrderEntry() {
    lines = [];
    ["xjwDiscount", "xjwShippingFee", "xjwPaidAmount"].forEach((id) => { const field = byId(id); if (field) field.value = "0"; });
    const payment = byId("xjwPaymentStatus"); if (payment) payment.value = "未付款";
    const delivery = byId("xjwExpectedDeliveryAt"); if (delivery) delivery.value = "";
    calculate();
  }

  function decorateOrderCards() {
    ensureOption(byId("orderFilter"), "待送貨");
    document.querySelectorAll("#orderList > .item").forEach((card) => {
      const edit = card.querySelector("[data-order-edit]");
      const order = (state.orders || []).find((item) => item.id === edit?.dataset.orderEdit);
      if (!order) return;
      if (!card.querySelector('[data-status="待送貨"]')) {
        const shipped = card.querySelector('[data-status="已出貨"]');
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn soft";
        button.dataset.orderStatus = order.id;
        button.dataset.status = "待送貨";
        button.textContent = "待送貨";
        if (shipped) shipped.insertAdjacentElement("beforebegin", button);
        else card.querySelector(".actions")?.appendChild(button);
      }
      if (!card.querySelector(".xjw-order-finance")) {
        const subtotal = num(order.subtotal) || (Array.isArray(order.orderLines) ? order.orderLines.reduce((sum, line) => sum + num(line.subtotal || num(line.qty) * num(line.unitPrice)), 0) : num(order.total));
        const balance = order.balance != null ? num(order.balance) : Math.max(0, num(order.total) - num(order.paidAmount));
        card.querySelector(".actions")?.insertAdjacentHTML("beforebegin", `<div class="xjw-order-finance">商品小計 ${money(subtotal)}｜折扣 ${money(order.discount)}｜運費 ${money(order.shippingFee)}｜已收 ${money(order.paidAmount)}｜<strong>未收 ${money(balance)}</strong>${order.expectedDeliveryAt ? `｜預計送貨 ${esc(String(order.expectedDeliveryAt).slice(0, 10))}` : ""}</div>`);
      }
    });
  }

  async function refresh() {
    state = await api(`/internal/api/v2/state?t=${Date.now()}`);
    installForm();
    const select = byId("xjwLineProduct");
    if (select) {
      const current = select.value;
      select.innerHTML = productOptions();
      if ([...select.options].some((option) => option.value === current)) select.value = current;
    }
    decorateOrderCards();
  }

  function bindFormActions() {
    if (installed) return;
    installed = true;
    document.addEventListener("change", (event) => {
      if (event.target.id === "xjwLineProduct") {
        const option = event.target.selectedOptions?.[0];
        const custom = event.target.value === "__custom__";
        byId("xjwCustomNameWrap").hidden = !custom;
        if (!custom && byId("xjwLinePrice")) byId("xjwLinePrice").value = option?.dataset.price || "0";
        byId("xjwSelectedStock").textContent = custom ? "自訂項目不會扣除庫存。" : event.target.value ? `可用庫存 ${option?.dataset.available || 0}｜建議售價 ${money(option?.dataset.price || 0)}，單價可自行調整。` : "選擇正式產品後會顯示可用庫存與建議售價。";
      }
      if (["xjwDiscount", "xjwShippingFee", "xjwPaidAmount", "xjwPaymentStatus"].includes(event.target.id)) calculate();
    });
    document.addEventListener("input", (event) => {
      const qty = event.target.closest?.("[data-line-qty]");
      const price = event.target.closest?.("[data-line-price]");
      if (qty) { lines[num(qty.dataset.lineQty)].qty = Math.max(1, num(qty.value)); calculate(); }
      if (price) { lines[num(price.dataset.linePrice)].unitPrice = Math.max(0, num(price.value)); calculate(); }
      if (["xjwDiscount", "xjwShippingFee", "xjwPaidAmount"].includes(event.target.id)) calculate();
    });
    document.addEventListener("click", (event) => {
      if (event.target.closest("#xjwLineAdd")) { event.preventDefault(); addLine(); return; }
      const remove = event.target.closest("[data-line-remove]");
      if (remove) { lines.splice(num(remove.dataset.lineRemove), 1); calculate(); return; }
      const edit = event.target.closest("[data-order-edit]");
      if (edit) {
        const order = (state.orders || []).find((item) => item.id === edit.dataset.orderEdit);
        setTimeout(() => { if (order) loadOrder(order); }, 0);
      }
    });
  }

  function wrapFunctions() {
    const originalLoad = window.loadAll;
    if (typeof originalLoad === "function" && !originalLoad.__xjwOrderEntryWrapped) {
      const wrapped = async (...args) => {
        const result = await originalLoad(...args);
        await refresh();
        return result;
      };
      wrapped.__xjwOrderEntryWrapped = true;
      window.loadAll = wrapped;
    }
    const originalReset = window.resetOrderForm;
    if (typeof originalReset === "function" && !originalReset.__xjwOrderEntryWrapped) {
      const wrappedReset = (...args) => {
        const result = originalReset(...args);
        clearOrderEntry();
        return result;
      };
      wrappedReset.__xjwOrderEntryWrapped = true;
      window.resetOrderForm = wrappedReset;
    }
  }

  async function start() {
    try {
      installForm();
      wrapFunctions();
      await refresh();
      window.xjwOrderEntry = { version: VERSION, refresh, calculate, clear: clearOrderEntry, get lines() { return [...lines]; } };
    } catch (error) {
      console.error("order entry controller", error);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
