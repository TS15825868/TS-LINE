"use strict";

const crypto = require("crypto");
const Module = require("module");
const express = require("express");

const PRO_VERSION = "2.0.0";
const COOKIE = "xjw_internal";
const json = express.json({ limit: "5mb" });
const ORDER_STATUSES = ["新訂單", "已聯絡", "已付款", "備貨中", "已出貨", "已完成", "已取消"];
const clean = (value, max = 1000) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
const esc = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
const now = () => new Date().toISOString();
const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
const finiteNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

function secret() {
  return clean(process.env.INTERNAL_APP_SECRET || process.env.INTERNAL_APP_PASSWORD || process.env.SOCIAL_ADMIN_PIN, 500);
}

function readCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || "").split(";").map((part) => part.trim().split("=")).filter((item) => item.length === 2));
}

function currentSession(req) {
  try {
    const value = readCookies(req)[COOKIE] || "";
    const [payload, signature] = value.split(".");
    if (!payload || !signature || !secret()) return null;
    const expected = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!parsed.user || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function requirePage(req, res, next) {
  const user = currentSession(req);
  if (!user) return res.redirect("/internal/login");
  req.internalUser = user;
  return next();
}

function requireApi(req, res, next) {
  const user = currentSession(req);
  if (!user) return res.status(401).json({ ok: false, error: "請重新登入" });
  req.internalUser = user;
  return next();
}

function requireAdmin(req, res, next) {
  if (req.internalUser?.role !== "admin") return res.status(403).json({ ok: false, error: "需要管理員權限" });
  return next();
}

function requestGuard(req, res, next) {
  if (req.get("X-XJW-Requested-With") !== "internal-app-v2") return res.status(403).json({ ok: false, error: "請從管理 App 操作" });
  const origin = clean(req.get("Origin"), 500);
  if (origin) {
    try {
      const parsed = new URL(origin);
      if (parsed.host !== req.get("host")) return res.status(403).json({ ok: false, error: "來源驗證失敗" });
    } catch {
      return res.status(403).json({ ok: false, error: "來源驗證失敗" });
    }
  }
  return next();
}

function sanitizeStaff(staff = []) {
  return staff.map(({ passwordHash, ...item }) => item);
}

function logActivity(store, actor, action, detail = "") {
  store.activities = Array.isArray(store.activities) ? store.activities : [];
  store.activities.push({ id: uid("act"), actor: clean(actor, 80), action: clean(action, 120), detail: clean(detail, 500), createdAt: now() });
  store.activities = store.activities.slice(-1000);
}

function normalizeOrder(body = {}, existing = {}) {
  const status = ORDER_STATUSES.includes(clean(body.status, 40)) ? clean(body.status, 40) : (existing.status || "新訂單");
  return {
    ...existing,
    customerName: clean(body.customerName ?? existing.customerName, 80),
    phone: clean(body.phone ?? existing.phone, 40),
    items: clean(body.items ?? existing.items, 2000),
    total: Math.max(0, finiteNumber(body.total ?? existing.total, 0)),
    status,
    payment: clean(body.payment ?? existing.payment, 80),
    shipping: clean(body.shipping ?? existing.shipping, 120),
    address: clean(body.address ?? existing.address, 500),
    trackingNo: clean(body.trackingNo ?? existing.trackingNo, 120),
    note: clean(body.note ?? existing.note, 2000),
    updatedAt: now(),
  };
}

function dashboardMetrics(store, socialPosts = []) {
  const orders = Array.isArray(store.orders) ? store.orders : [];
  const customers = Array.isArray(store.customers) ? store.customers : [];
  const inventory = Array.isArray(store.inventory) ? store.inventory : [];
  const reminders = Array.isArray(store.reminders) ? store.reminders : [];
  const active = orders.filter((item) => !["已完成", "已取消"].includes(item.status));
  const paidSales = orders.filter((item) => !["已取消"].includes(item.status)).reduce((sum, item) => sum + finiteNumber(item.total), 0);
  const low = inventory.filter((item) => finiteNumber(item.stock) <= finiteNumber(item.lowStock));
  const due = reminders.filter((item) => !item.done && new Date(item.dueAt).getTime() <= Date.now());
  const pendingSocial = socialPosts.filter((item) => ["draft", "rejected", "approved", "failed"].includes(item.status));
  return {
    orderCount: orders.length,
    activeOrderCount: active.length,
    customerCount: customers.length,
    totalSales: paidSales,
    lowStockCount: low.length,
    dueReminderCount: due.length,
    pendingSocialCount: pendingSocial.length,
  };
}

function securityHeaders(_req, res, next) {
  res.set({
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  });
  next();
}

function css() {
  return `:root{--navy:#0b1f3b;--red:#8d2024;--cream:#f7f4ed;--gold:#b08a45;--green:#315c45;--line:#ded7ca;--muted:#6b655d;--white:#fff;--shadow:0 14px 38px #0b1f3b12}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--cream);color:#24211d;font-family:-apple-system,BlinkMacSystemFont,"PingFang TC","Noto Sans TC",sans-serif}button,input,select,textarea{font:inherit}button{cursor:pointer}a{color:inherit}.shell{max-width:1320px;margin:auto;padding:16px 16px 96px}.top{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}.top h1{font-size:25px;margin:0;color:var(--navy)}.top small,.muted{color:var(--muted)}.actions,.toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.toolbar{justify-content:space-between}.btn{border:0;border-radius:12px;padding:10px 13px;font-weight:800;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}.primary{background:var(--navy);color:#fff}.danger{background:var(--red);color:#fff}.success{background:var(--green);color:#fff}.soft{background:#ece8df;color:#24211d}.gold{background:var(--gold);color:#fff}.cards{display:grid;grid-template-columns:repeat(7,1fr);gap:10px}.metric,.panel{background:#fff;border:1px solid var(--line);border-radius:18px;padding:16px;box-shadow:var(--shadow)}.metric strong{display:block;font-size:24px;color:var(--navy)}.metric span{font-size:13px;color:var(--muted)}.tabs{position:sticky;top:0;z-index:20;background:#f7f4edeb;backdrop-filter:blur(12px);display:flex;gap:8px;overflow:auto;padding:10px 0}.tab{white-space:nowrap;border:1px solid var(--line);background:#fff;border-radius:999px;padding:9px 13px;font-weight:800}.tab.active{background:var(--navy);color:#fff}.view{display:none;margin-top:12px}.view.active{display:block}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.list{display:grid;gap:10px;margin-top:12px}.item{border:1px solid var(--line);border-radius:14px;padding:13px;background:#fff}.item h3{margin:0 0 6px;color:var(--navy)}.meta{font-size:13px;color:var(--muted);line-height:1.55}.pill{display:inline-block;border-radius:999px;padding:4px 8px;font-size:12px;font-weight:800;background:#ece8df}.pill.low,.pill.failed{background:#fff0ee;color:#8d2024}.pill.done,.pill.published{background:#eaf5ee;color:#315c45}label{display:block;font-weight:700;margin:10px 0}input,select,textarea{width:100%;border:1px solid #cfc8bc;border-radius:12px;padding:11px;background:#fff}textarea{min-height:90px;resize:vertical}.compact{max-width:290px}.right{text-align:right}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:9px;border-bottom:1px solid #eee;font-size:14px}.notice{padding:11px 13px;border-radius:12px;background:#fff3c9;margin:10px 0}.error{background:#fff0ee;color:#8d2024}.ok{background:#eaf5ee;color:#315c45}.bottom{position:fixed;left:0;right:0;bottom:0;background:#fff;border-top:1px solid var(--line);display:none;grid-template-columns:repeat(5,1fr);z-index:30;padding-bottom:env(safe-area-inset-bottom)}.bottom button{border:0;background:#fff;padding:10px 4px;font-size:12px}.bottom button.active{color:var(--red);font-weight:800}.stack{display:grid;gap:8px}.danger-zone{border-color:#e3b5b5}.status-dot{width:9px;height:9px;border-radius:50%;display:inline-block;background:#aaa;margin-right:6px}.status-dot.ok{background:#315c45}.status-dot.bad{background:#8d2024}.install{display:none}@media(max-width:1050px){.cards{grid-template-columns:repeat(4,1fr)}.grid3{grid-template-columns:1fr 1fr}}@media(max-width:760px){.grid2,.grid3{grid-template-columns:1fr}.cards{grid-template-columns:repeat(2,1fr)}.tabs{display:none}.bottom{display:grid}.shell{padding:12px 12px 80px}.top{align-items:flex-start}.top h1{font-size:21px}.metric strong{font-size:21px}.desktop{display:none}.install{display:inline-flex}.panel{padding:13px}}`;
}

function page(user, persistence, supabase) {
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0b1f3b"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="default"><link rel="manifest" href="/internal/manifest.webmanifest"><link rel="apple-touch-icon" href="/internal/icon.svg"><title>仙加味內部管理 App</title><style>${css()}</style></head><body><main class="shell"><header class="top"><div><h1>仙加味內部管理 App</h1><small>${esc(user.user)}｜${user.role === "admin" ? "管理員" : "員工"}｜v${PRO_VERSION}｜${esc(persistence)}｜Supabase ${supabase ? "已啟用" : "未啟用"}</small></div><div class="actions"><button id="installBtn" class="btn soft install">安裝 App</button><button class="btn soft" onclick="loadAll()">重新整理</button><form method="post" action="/internal/logout"><button class="btn danger">登出</button></form></div></header><section class="cards"><div class="metric"><strong id="mActive">0</strong><span>處理中訂單</span></div><div class="metric"><strong id="mCustomers">0</strong><span>客戶總數</span></div><div class="metric"><strong id="mSales">$0</strong><span>累計訂單金額</span></div><div class="metric"><strong id="mLow">0</strong><span>低庫存品項</span></div><div class="metric"><strong id="mReminders">0</strong><span>到期提醒</span></div><div class="metric"><strong id="mSocial">0</strong><span>社群待處理</span></div><div class="metric"><strong id="mDb">—</strong><span>資料庫狀態</span></div></section><nav class="tabs">${["dashboard:總覽","orders:訂單","customers:客戶 CRM","inventory:庫存","reminders:提醒","social:社群排程","reports:報表","backup:備份"].map(x=>{const [id,label]=x.split(":");return `<button class="tab ${id==="dashboard"?"active":""}" data-view="${id}">${label}</button>`}).join("")}${user.role === "admin" ? '<button class="tab" data-view="staff">員工權限</button>' : ""}</nav>
<section id="dashboard" class="view active"><div class="grid2"><article class="panel"><div class="toolbar"><h2>待處理事項</h2><button class="btn primary" onclick="showView('orders')">查看訂單</button></div><div id="todoList" class="list"></div></article><article class="panel"><div class="toolbar"><h2>系統狀態</h2><span id="lastSync" class="muted"></span></div><div id="systemList" class="list"></div></article></div><article class="panel" style="margin-top:14px"><h2>最近操作</h2><div id="activityList" class="list"></div></article></section>
<section id="orders" class="view"><div class="grid2"><article class="panel"><h2 id="orderFormTitle">新增訂單</h2><form id="orderForm"><input type="hidden" name="id"><label>客戶姓名<input name="customerName" required></label><div class="grid2"><label>電話<input name="phone" inputmode="tel"></label><label>金額<input name="total" type="number" min="0" value="0"></label></div><label>商品內容<textarea name="items" placeholder="例如：龜鹿膏100g × 1"></textarea></label><div class="grid2"><label>狀態<select name="status">${ORDER_STATUSES.map(s=>`<option>${s}</option>`).join("")}</select></label><label>付款方式<input name="payment" placeholder="匯款／貨到付款／現金"></label></div><div class="grid2"><label>配送方式<input name="shipping" placeholder="宅配／7-11／門市自取"></label><label>物流單號<input name="trackingNo"></label></div><label>地址<input name="address"></label><label>備註<textarea name="note"></textarea></label><div class="actions"><button class="btn primary" type="submit">儲存訂單</button><button class="btn soft" type="button" onclick="resetOrderForm()">清除</button></div></form></article><article class="panel"><div class="toolbar"><h2>訂單清單</h2><div class="actions"><input id="orderSearch" class="compact" placeholder="搜尋姓名、電話、商品"><select id="orderFilter" class="compact"><option value="">全部狀態</option>${ORDER_STATUSES.map(s=>`<option>${s}</option>`).join("")}</select></div></div><div id="orderList" class="list"></div></article></div></section>
<section id="customers" class="view"><div class="grid2"><article class="panel"><h2 id="customerFormTitle">新增客戶</h2><form id="customerForm"><input type="hidden" name="id"><label>姓名<input name="name" required></label><div class="grid2"><label>電話<input name="phone" inputmode="tel"></label><label>LINE／識別資料<input name="lineId"></label></div><label>詢問產品<input name="interests"></label><label>標籤<input name="tags" placeholder="熟客、診所、通路"></label><label>備註<textarea name="note"></textarea></label><div class="actions"><button class="btn primary">儲存客戶</button><button class="btn soft" type="button" onclick="resetCustomerForm()">清除</button></div></form></article><article class="panel"><div class="toolbar"><h2>客戶資料</h2><input id="customerSearch" class="compact" placeholder="搜尋姓名、電話、產品、標籤"></div><div id="customerList" class="list"></div></article></div></section>
<section id="inventory" class="view"><article class="panel"><div class="toolbar"><h2>庫存管理</h2><span class="muted">可直接調整庫存或記錄進貨／出貨</span></div><div id="inventoryList" class="list"></div></article></section>
<section id="reminders" class="view"><div class="grid2"><article class="panel"><h2 id="reminderFormTitle">新增提醒</h2><form id="reminderForm"><input type="hidden" name="id"><label>事項<input name="title" required></label><label>時間<input name="dueAt" type="datetime-local" required></label><label>說明<textarea name="note"></textarea></label><div class="actions"><button class="btn primary">儲存提醒</button><button class="btn soft" type="button" onclick="resetReminderForm()">清除</button><button class="btn gold" type="button" onclick="requestNotifications()">開啟通知</button></div></form></article><article class="panel"><h2>提醒清單</h2><div id="reminderList" class="list"></div></article></div></section>
<section id="social" class="view"><div class="grid2"><article class="panel"><h2>建立社群草稿</h2><form id="socialForm"><label>標題<input name="title" required></label><label>預定時間<input name="scheduledAt" type="datetime-local" required></label><label>公開圖片網址<input name="imageUrl" type="url" placeholder="https://..."></label><label>Instagram 文案<textarea name="instagramCaption" maxlength="2200"></textarea></label><label>Facebook 文案<textarea name="facebookCaption" maxlength="5000"></textarea></label><label><input style="width:auto" type="checkbox" name="publishInstagram" checked> Instagram</label><label><input style="width:auto" type="checkbox" name="publishFacebook" checked> Facebook</label><button class="btn primary">建立待審草稿</button></form></article><article class="panel"><div class="toolbar"><h2>審核與排程</h2><span id="socialConfig" class="muted"></span></div><div id="socialList" class="list"></div></article></div></section>
<section id="reports" class="view"><article class="panel"><div class="toolbar"><h2>營運報表</h2><div class="actions"><label style="margin:0">起日<input id="reportFrom" type="date"></label><label style="margin:0">迄日<input id="reportTo" type="date"></label><button class="btn primary" onclick="renderReports()">套用</button></div></div><div id="reportArea"></div></article></section>
<section id="backup" class="view"><div class="grid2"><article class="panel"><h2>匯出與備份</h2><p class="muted">完整 JSON 可用於災難還原；CSV 適合用 Excel 查看。</p><div class="stack"><a class="btn primary" href="/internal/api/v2/export/backup">下載完整備份 JSON</a><a class="btn soft" href="/internal/api/v2/export/orders.csv">下載訂單 CSV</a><a class="btn soft" href="/internal/api/v2/export/customers.csv">下載客戶 CSV</a></div></article>${user.role === "admin" ? '<article class="panel danger-zone"><h2>還原備份</h2><p class="notice">匯入會覆蓋目前內部資料與社群草稿，請先下載備份。</p><form id="restoreForm"><label>選擇 JSON 備份檔<input name="file" type="file" accept="application/json,.json" required></label><label><input style="width:auto" name="confirm" type="checkbox" required> 我確認要覆蓋目前資料</label><button class="btn danger">匯入並還原</button></form></article>' : ""}</div></section>
${user.role === "admin" ? `<section id="staff" class="view"><div class="grid2"><article class="panel"><h2>新增員工帳號</h2><form id="staffForm"><label>帳號<input name="username" pattern="[A-Za-z0-9._-]{3,80}" required></label><label>顯示名稱<input name="displayName" required></label><label>密碼<input name="password" type="password" minlength="8" required></label><label>權限<select name="role"><option value="staff">員工</option><option value="admin">管理員</option></select></label><button class="btn primary">新增帳號</button></form></article><article class="panel"><h2>員工與權限</h2><div id="staffList" class="list"></div></article></div></section>` : ""}
</main><nav class="bottom"><button class="active" data-view="dashboard">總覽</button><button data-view="orders">訂單</button><button data-view="customers">客戶</button><button data-view="inventory">庫存</button><button data-view="reminders">提醒</button></nav><script>${clientJs(user.role)}</script></body></html>`;
}

function clientJs(role) {
  return `const role=${JSON.stringify(role)};const S={orders:[],customers:[],inventory:[],reminders:[],activities:[],staff:[],socialPosts:[],summary:{},system:{}};const H={"Content-Type":"application/json","X-XJW-Requested-With":"internal-app-v2"};let deferredPrompt=null;window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;document.getElementById("installBtn")?.classList.add("show")});document.getElementById("installBtn")?.addEventListener("click",async()=>{if(!deferredPrompt)return alert("請使用瀏覽器的『加入主畫面』安裝");deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null});if("serviceWorker"in navigator)navigator.serviceWorker.register("/internal/sw.js").catch(()=>{});function showView(id){document.querySelectorAll(".view").forEach(x=>x.classList.toggle("active",x.id===id));document.querySelectorAll("[data-view]").forEach(x=>x.classList.toggle("active",x.dataset.view===id));scrollTo(0,0)}document.querySelectorAll("[data-view]").forEach(x=>x.addEventListener("click",()=>showView(x.dataset.view)));function e(v){return String(v??"").replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;","'":"&#039;"}[c]))}function cash(v){return "$"+Number(v||0).toLocaleString("zh-TW")}function dt(v){return v?new Date(v).toLocaleString("zh-TW",{hour12:false}):""}function localInput(v){if(!v)return"";const d=new Date(v);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16)}function formObj(form){const o=Object.fromEntries(new FormData(form).entries());form.querySelectorAll('input[type="checkbox"]').forEach(x=>o[x.name]=x.checked);return o}async function api(url,opt={}){const r=await fetch(url,{...opt,headers:{...H,...(opt.headers||{})}});if(r.status===401){location.href="/internal/login";throw new Error("請重新登入")}const d=await r.json().catch(()=>({ok:false,error:"系統回覆格式錯誤"}));if(!r.ok||d.ok===false)throw new Error(d.error||"操作失敗");return d}async function act(fn){try{await fn()}catch(err){alert(err.message)}}async function loadAll(){const d=await api("/internal/api/v2/state");Object.assign(S,d);render();document.getElementById("lastSync").textContent="更新："+dt(new Date())}function render(){mActive.textContent=S.summary.activeOrderCount;mCustomers.textContent=S.summary.customerCount;mSales.textContent=cash(S.summary.totalSales);mLow.textContent=S.summary.lowStockCount;mReminders.textContent=S.summary.dueReminderCount;mSocial.textContent=S.summary.pendingSocialCount;mDb.textContent=S.system.supabaseConnected?"正常":(S.system.supabaseEnabled?"異常":"本機");renderDashboard();renderOrders();renderCustomers();renderInventory();renderReminders();renderSocial();renderReports();renderStaff()}function renderDashboard(){const todos=[...S.orders.filter(o=>!["已完成","已取消"].includes(o.status)).slice(0,6).map(o=>({t:o.customerName+"｜"+o.status,d:o.items||"未填商品"})),...S.inventory.filter(i=>Number(i.stock)<=Number(i.lowStock)).slice(0,6).map(i=>({t:"低庫存｜"+i.name,d:"目前 "+i.stock+"，警戒 "+i.lowStock})),...S.reminders.filter(r=>!r.done&&new Date(r.dueAt)<=new Date()).slice(0,6).map(r=>({t:"到期提醒｜"+r.title,d:dt(r.dueAt)})),...S.socialPosts.filter(p=>["draft","rejected","failed"].includes(p.status)).slice(0,4).map(p=>({t:"社群｜"+p.title,d:p.status}))];todoList.innerHTML=todos.length?todos.map(x=>'<div class="item"><h3>'+e(x.t)+'</h3><div class="meta">'+e(x.d)+'</div></div>').join(""):'<div class="item muted">目前沒有待處理事項</div>';activityList.innerHTML=S.activities.slice(0,20).map(a=>'<div class="item"><strong>'+e(a.action)+'</strong><div class="meta">'+e(a.actor)+'｜'+dt(a.createdAt)+'｜'+e(a.detail||"")+'</div></div>').join("")||'<div class="item muted">尚無操作紀錄</div>';const sys=S.system;systemList.innerHTML=['Supabase：'+(sys.supabaseEnabled?(sys.supabaseConnected?'已連線':'連線異常'):'未啟用'),'儲存：'+e(sys.persistence||''),'LINE：'+(sys.lineConfigured?'已設定':'未設定'),'Instagram：'+(sys.instagramConfigured?'已設定':'未設定'),'Facebook：'+(sys.facebookConfigured?'已設定':'未設定'),sys.lastError?'錯誤：'+e(sys.lastError):'最近同步：'+e(sys.lastSavedAt||sys.restoredAt||'尚無')].map((x,i)=>'<div class="item"><span class="status-dot '+(i<5&&!x.includes('未')&&!x.includes('異常')?'ok':(x.includes('異常')||x.includes('錯誤')?'bad':''))+'"></span>'+x+'</div>').join("")}function renderOrders(){const q=(orderSearch.value||"").toLowerCase(),f=orderFilter.value;const rows=S.orders.filter(o=>(!f||o.status===f)&&(!q||[o.customerName,o.phone,o.items,o.note,o.trackingNo].join(" ").toLowerCase().includes(q)));orderList.innerHTML=rows.map(o=>'<div class="item"><div class="toolbar"><h3>'+e(o.customerName)+'</h3><span class="pill '+(o.status==='已完成'?'done':'')+'">'+e(o.status)+'</span></div><div>'+e(o.items||"未填商品")+'</div><div class="meta">'+e(o.phone||"")+'｜'+cash(o.total)+'｜'+dt(o.createdAt)+'</div><div class="meta">'+e([o.payment,o.shipping,o.address,o.trackingNo,o.note].filter(Boolean).join('｜'))+'</div><div class="actions"><button class="btn soft" onclick="editOrder(\''+o.id+'\')">編輯</button>'+["已聯絡","已付款","備貨中","已出貨","已完成"].map(s=>'<button class="btn soft" onclick="statusOrder(\''+o.id+'\',\''+s+'\')">'+s+'</button>').join("")+(role==='admin'?'<button class="btn danger" onclick="deleteOrder(\''+o.id+'\')">刪除</button>':'')+'</div></div>').join("")||'<div class="item muted">沒有訂單</div>'}function editOrder(id){const o=S.orders.find(x=>x.id===id);if(!o)return;const f=orderForm;for(const k of ['id','customerName','phone','items','total','status','payment','shipping','address','trackingNo','note'])if(f.elements[k])f.elements[k].value=o[k]??'';orderFormTitle.textContent='編輯訂單';showView('orders');scrollTo(0,0)}function resetOrderForm(){orderForm.reset();orderForm.elements.id.value='';orderFormTitle.textContent='新增訂單'}async function statusOrder(id,status){await act(async()=>{await api('/internal/api/v2/orders/'+id,{method:'PATCH',body:JSON.stringify({status})});await loadAll()})}async function deleteOrder(id){if(!confirm('確定刪除這筆訂單？'))return;await act(async()=>{await api('/internal/api/v2/orders/'+id,{method:'DELETE'});await loadAll()})}function renderCustomers(){const q=(customerSearch.value||"").toLowerCase();const rows=S.customers.filter(c=>!q||[c.name,c.phone,c.lineId,c.interests,c.tags,c.note].join(' ').toLowerCase().includes(q));customerList.innerHTML=rows.map(c=>'<div class="item"><h3>'+e(c.name)+'</h3><div>'+e(c.interests||'尚未記錄詢問產品')+'</div><div class="meta">'+e(c.phone||'')+'｜'+e(c.lineId||'')+'｜'+e(c.tags||'')+'</div><div class="meta">'+e(c.note||'')+'</div><div class="actions"><button class="btn soft" onclick="editCustomer(\''+c.id+'\')">編輯</button>'+(c.phone?'<a class="btn success" href="tel:'+encodeURIComponent(c.phone)+'">撥電話</a>':'')+(role==='admin'?'<button class="btn danger" onclick="deleteCustomer(\''+c.id+'\')">刪除</button>':'')+'</div></div>').join('')||'<div class="item muted">沒有客戶資料</div>'}function editCustomer(id){const c=S.customers.find(x=>x.id===id);if(!c)return;const f=customerForm;for(const k of ['id','name','phone','lineId','interests','tags','note'])if(f.elements[k])f.elements[k].value=c[k]??'';customerFormTitle.textContent='編輯客戶';showView('customers')}function resetCustomerForm(){customerForm.reset();customerForm.elements.id.value='';customerFormTitle.textContent='新增客戶'}async function deleteCustomer(id){if(!confirm('確定刪除客戶資料？'))return;await act(async()=>{await api('/internal/api/v2/customers/'+id,{method:'DELETE'});await loadAll()})}function renderInventory(){inventoryList.innerHTML=S.inventory.map(i=>'<div class="item"><div class="toolbar"><h3>'+e(i.name)+'</h3><span class="pill '+(Number(i.stock)<=Number(i.lowStock)?'low':'')+'">庫存 '+i.stock+'</span></div><div class="grid3"><label>目前庫存<input id="stock-'+i.productId+'" type="number" min="0" value="'+Number(i.stock||0)+'"></label><label>警戒值<input id="low-'+i.productId+'" type="number" min="0" value="'+Number(i.lowStock||0)+'"></label><label>本次調整<input id="adj-'+i.productId+'" type="number" value="0" placeholder="進貨填正數，出貨填負數"></label></div><label>調整原因<input id="reason-'+i.productId+'" placeholder="進貨、盤點、破損、門市銷售"></label><div class="actions"><button class="btn primary" onclick="saveInventory(\''+i.productId+'\')">直接儲存</button><button class="btn gold" onclick="adjustInventory(\''+i.productId+'\')">記錄調整</button></div><div class="meta">最後更新：'+dt(i.updatedAt)+'</div></div>').join('')}async function saveInventory(id){await act(async()=>{await api('/internal/api/v2/inventory/'+id,{method:'PATCH',body:JSON.stringify({stock:Number(document.getElementById('stock-'+id).value),lowStock:Number(document.getElementById('low-'+id).value)})});await loadAll()})}async function adjustInventory(id){const delta=Number(document.getElementById('adj-'+id).value),reason=document.getElementById('reason-'+id).value;if(!delta)return alert('請輸入本次調整數量');await act(async()=>{await api('/internal/api/v2/inventory/'+id+'/adjust',{method:'POST',body:JSON.stringify({delta,reason})});await loadAll()})}function renderReminders(){reminderList.innerHTML=S.reminders.map(r=>'<div class="item"><div class="toolbar"><h3>'+e(r.title)+'</h3><span class="pill '+(r.done?'done':(!r.done&&new Date(r.dueAt)<=new Date()?'low':''))+'">'+(r.done?'已完成':dt(r.dueAt))+'</span></div><div class="meta">'+e(r.note||'')+'</div><div class="actions"><button class="btn soft" onclick="editReminder(\''+r.id+'\')">編輯</button><button class="btn success" onclick="toggleReminder(\''+r.id+'\','+(!r.done)+')">'+(r.done?'重新開啟':'完成')+'</button>'+(role==='admin'?'<button class="btn danger" onclick="deleteReminder(\''+r.id+'\')">刪除</button>':'')+'</div></div>').join('')||'<div class="item muted">沒有提醒</div>';notifyDue()}function editReminder(id){const r=S.reminders.find(x=>x.id===id);if(!r)return;reminderForm.elements.id.value=r.id;reminderForm.elements.title.value=r.title;reminderForm.elements.dueAt.value=localInput(r.dueAt);reminderForm.elements.note.value=r.note||'';reminderFormTitle.textContent='編輯提醒';showView('reminders')}function resetReminderForm(){reminderForm.reset();reminderForm.elements.id.value='';reminderFormTitle.textContent='新增提醒'}async function toggleReminder(id,done){await act(async()=>{await api('/internal/api/v2/reminders/'+id,{method:'PATCH',body:JSON.stringify({done})});await loadAll()})}async function deleteReminder(id){if(!confirm('確定刪除此提醒？'))return;await act(async()=>{await api('/internal/api/v2/reminders/'+id,{method:'DELETE'});await loadAll()})}async function requestNotifications(){if(!('Notification'in window))return alert('此裝置不支援通知');const p=await Notification.requestPermission();alert(p==='granted'?'通知已開啟':'通知未開啟')}function notifyDue(){if(!('Notification'in window)||Notification.permission!=='granted')return;S.reminders.filter(r=>!r.done&&new Date(r.dueAt)<=new Date()&&!sessionStorage.getItem('n-'+r.id)).forEach(r=>{navigator.serviceWorker?.ready.then(reg=>reg.showNotification('仙加味提醒',{body:r.title,icon:'/internal/icon.svg'}));sessionStorage.setItem('n-'+r.id,'1')})}function renderSocial(){socialConfig.textContent='IG '+(S.system.instagramConfigured?'已設定':'未設定')+'／FB '+(S.system.facebookConfigured?'已設定':'未設定');socialList.innerHTML=S.socialPosts.map(p=>'<div class="item"><div class="toolbar"><h3>'+e(p.title)+'</h3><span class="pill '+e(p.status)+'">'+e(p.status)+'</span></div><div class="meta">預定：'+dt(p.scheduledAt)+'｜'+(p.publishInstagram?'IG ':'')+(p.publishFacebook?'FB':'')+'</div>'+ (p.imageUrl?'<img src="'+e(p.imageUrl)+'" alt="" style="width:100%;max-width:260px;border-radius:12px;margin-top:8px">':'')+'<details><summary>Instagram 文案</summary><p>'+e(p.instagramCaption||'').replace(/\n/g,'<br>')+'</p></details><details><summary>Facebook 文案</summary><p>'+e(p.facebookCaption||'').replace(/\n/g,'<br>')+'</p></details>'+(p.lastError?'<div class="notice error">'+e(p.lastError)+'</div>':'')+'<div class="actions">'+(['draft','rejected'].includes(p.status)?'<button class="btn success" onclick="socialAction(\''+p.id+'\',\'approve\')">通過排程</button><button class="btn danger" onclick="socialAction(\''+p.id+'\',\'reject\')">退回</button>':'')+(['approved','failed'].includes(p.status)?'<button class="btn success" onclick="socialAction(\''+p.id+'\',\'publish\')">立即發布</button><button class="btn danger" onclick="socialAction(\''+p.id+'\',\'cancel\')">取消</button>':'')+(role==='admin'?'<button class="btn soft" onclick="socialAction(\''+p.id+'\',\'delete\')">刪除</button>':'')+'</div></div>').join('')||'<div class="item muted">目前沒有社群草稿</div>'}async function socialAction(id,action){if(action==='publish'&&!confirm('確定立即發布？'))return;await act(async()=>{await api('/internal/api/v2/social/'+id+'/'+action,{method:'POST',body:'{}'});await loadAll()})}function renderReports(){const from=reportFrom.value?new Date(reportFrom.value+'T00:00:00'):null,to=reportTo.value?new Date(reportTo.value+'T23:59:59'):null;const rows=S.orders.filter(o=>{const d=new Date(o.createdAt);return(!from||d>=from)&&(!to||d<=to)});const byStatus={},byMonth={};let total=0;rows.forEach(o=>{byStatus[o.status]=(byStatus[o.status]||0)+1;const m=String(o.createdAt||'').slice(0,7)||'未知';byMonth[m]=(byMonth[m]||0)+Number(o.total||0);if(o.status!=='已取消')total+=Number(o.total||0)});reportArea.innerHTML='<div class="cards"><div class="metric"><strong>'+rows.length+'</strong><span>期間訂單</span></div><div class="metric"><strong>'+cash(total)+'</strong><span>期間金額</span></div><div class="metric"><strong>'+S.customers.length+'</strong><span>客戶總數</span></div><div class="metric"><strong>'+S.summary.lowStockCount+'</strong><span>低庫存</span></div></div><div class="grid2" style="margin-top:14px"><div><h3>訂單狀態</h3><table>'+Object.entries(byStatus).map(([k,v])=>'<tr><td>'+e(k)+'</td><td class="right">'+v+'</td></tr>').join('')+'</table></div><div><h3>月份金額</h3><table>'+Object.entries(byMonth).sort().reverse().map(([k,v])=>'<tr><td>'+e(k)+'</td><td class="right">'+cash(v)+'</td></tr>').join('')+'</table></div></div>'}function renderStaff(){const el=document.getElementById('staffList');if(!el)return;el.innerHTML=S.staff.map(s=>'<div class="item"><div class="toolbar"><h3>'+e(s.displayName||s.username)+'</h3><span class="pill">'+e(s.role)+'</span></div><div class="meta">帳號：'+e(s.username)+'｜'+(s.active===false?'停用':'啟用')+'</div><div class="actions"><button class="btn soft" onclick="staffAction(\''+s.id+'\',{active:'+(s.active===false)+'})">'+(s.active===false?'啟用':'停用')+'</button><button class="btn soft" onclick="resetStaffPassword(\''+s.id+'\')">重設密碼</button><button class="btn danger" onclick="deleteStaff(\''+s.id+'\')">刪除</button></div></div>').join('')||'<div class="item muted">尚未新增員工帳號</div>'}async function staffAction(id,data){await act(async()=>{await api('/internal/api/v2/staff/'+id,{method:'PATCH',body:JSON.stringify(data)});await loadAll()})}async function resetStaffPassword(id){const password=prompt('輸入新密碼（至少8碼）');if(!password)return;await staffAction(id,{password})}async function deleteStaff(id){if(!confirm('確定刪除此員工帳號？'))return;await act(async()=>{await api('/internal/api/v2/staff/'+id,{method:'DELETE'});await loadAll()})}orderForm.addEventListener('submit',e=>{e.preventDefault();act(async()=>{const d=formObj(e.target),id=d.id;delete d.id;await api('/internal/api/v2/orders'+(id?'/'+id:''),{method:id?'PATCH':'POST',body:JSON.stringify(d)});resetOrderForm();await loadAll()})});customerForm.addEventListener('submit',e=>{e.preventDefault();act(async()=>{const d=formObj(e.target),id=d.id;delete d.id;await api('/internal/api/v2/customers'+(id?'/'+id:''),{method:id?'PATCH':'POST',body:JSON.stringify(d)});resetCustomerForm();await loadAll()})});reminderForm.addEventListener('submit',e=>{e.preventDefault();act(async()=>{const d=formObj(e.target),id=d.id;delete d.id;await api('/internal/api/v2/reminders'+(id?'/'+id:''),{method:id?'PATCH':'POST',body:JSON.stringify(d)});resetReminderForm();await loadAll()})});socialForm.addEventListener('submit',e=>{e.preventDefault();act(async()=>{await api('/internal/api/v2/social',{method:'POST',body:JSON.stringify(formObj(e.target))});e.target.reset();e.target.publishInstagram.checked=true;e.target.publishFacebook.checked=true;await loadAll()})});document.getElementById('staffForm')?.addEventListener('submit',e=>{e.preventDefault();act(async()=>{await api('/internal/api/v2/staff',{method:'POST',body:JSON.stringify(formObj(e.target))});e.target.reset();await loadAll()})});document.getElementById('restoreForm')?.addEventListener('submit',e=>{e.preventDefault();act(async()=>{const file=e.target.file.files[0];if(!file)throw new Error('請選擇檔案');const data=JSON.parse(await file.text());await api('/internal/api/v2/import/backup',{method:'POST',body:JSON.stringify({confirm:true,data})});alert('還原完成');await loadAll()})});orderFilter.addEventListener('change',renderOrders);orderSearch.addEventListener('input',renderOrders);customerSearch.addEventListener('input',renderCustomers);loadAll().catch(err=>alert(err.message));`;
}

function removePublicDebug(app) {
  if (!app?._router?.stack) return;
  app._router.stack = app._router.stack.filter((layer) => layer?.route?.path !== "/debug");
  app.get("/debug", (_req, res) => res.status(404).json({ ok: false, error: "Not found" }));
}

function mountInternalPro(app, legacy) {
  const social = require("./social-server");
  const bridge = require("./supabase-state-bridge");
  removePublicDebug(app);
  app.use("/internal", securityHeaders);

  app.get("/internal/app", requirePage, (req, res) => {
    const health = bridge.health();
    res.send(page(req.internalUser, health.storage || "local-json", health.enabled));
  });

  app.get("/internal/api/v2/state", requireApi, (req, res) => {
    const store = legacy.readStore();
    const socialStore = social.readStore();
    const health = bridge.health();
    const lineConfigured = Boolean(process.env.CHANNEL_ACCESS_TOKEN && process.env.CHANNEL_SECRET);
    res.json({
      ok: true,
      ...store,
      staff: sanitizeStaff(store.staff || []),
      orders: [...(store.orders || [])].reverse(),
      customers: [...(store.customers || [])].reverse(),
      reminders: [...(store.reminders || [])].sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt)),
      activities: [...(store.activities || [])].reverse(),
      socialPosts: [...(socialStore.posts || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
      summary: dashboardMetrics(store, socialStore.posts || []),
      role: req.internalUser.role,
      system: {
        appVersion: PRO_VERSION,
        persistence: health.storage,
        supabaseEnabled: health.enabled,
        supabaseConnected: health.connected,
        restoredAt: health.restoredAt,
        lastSavedAt: health.lastSavedAt,
        lastError: health.lastError,
        lineConfigured,
        instagramConfigured: Boolean(process.env.INSTAGRAM_USER_ID && process.env.INSTAGRAM_ACCESS_TOKEN),
        facebookConfigured: Boolean(process.env.META_PAGE_ID && process.env.META_PAGE_ACCESS_TOKEN),
      },
    });
  });

  app.post("/internal/api/v2/orders", requireApi, requestGuard, json, (req, res) => {
    const store = legacy.readStore();
    const order = normalizeOrder(req.body, { id: uid("ord"), source: "內部 App", createdAt: now() });
    if (!order.customerName) return res.status(400).json({ ok: false, error: "客戶姓名不可空白" });
    store.orders.push(order);
    if (order.phone && !store.customers.some((item) => item.phone === order.phone)) {
      store.customers.push({ id: uid("cus"), name: order.customerName, phone: order.phone, lineId: "", interests: order.items, tags: "", note: "由訂單自動建立", createdAt: now(), updatedAt: now() });
    }
    logActivity(store, req.internalUser.user, "建立訂單", `${order.customerName}｜$${order.total}`);
    legacy.writeStore(store);
    res.json({ ok: true, order });
  });

  app.patch("/internal/api/v2/orders/:id", requireApi, requestGuard, json, (req, res) => {
    const store = legacy.readStore();
    const index = store.orders.findIndex((item) => item.id === req.params.id);
    if (index < 0) return res.status(404).json({ ok: false, error: "找不到訂單" });
    const before = store.orders[index];
    const order = normalizeOrder(req.body, before);
    if (!order.customerName) return res.status(400).json({ ok: false, error: "客戶姓名不可空白" });
    store.orders[index] = order;
    logActivity(store, req.internalUser.user, "更新訂單", `${order.customerName}｜${before.status} → ${order.status}`);
    legacy.writeStore(store);
    res.json({ ok: true, order });
  });

  app.delete("/internal/api/v2/orders/:id", requireApi, requireAdmin, requestGuard, (req, res) => {
    const store = legacy.readStore();
    const index = store.orders.findIndex((item) => item.id === req.params.id);
    if (index < 0) return res.status(404).json({ ok: false, error: "找不到訂單" });
    const [removed] = store.orders.splice(index, 1);
    logActivity(store, req.internalUser.user, "刪除訂單", removed.customerName || removed.id);
    legacy.writeStore(store);
    res.json({ ok: true });
  });

  app.post("/internal/api/v2/customers", requireApi, requestGuard, json, (req, res) => {
    const store = legacy.readStore();
    const customer = { id: uid("cus"), name: clean(req.body.name, 80), phone: clean(req.body.phone, 40), lineId: clean(req.body.lineId, 120), interests: clean(req.body.interests, 1000), tags: clean(req.body.tags, 300), note: clean(req.body.note, 2000), createdAt: now(), updatedAt: now() };
    if (!customer.name) return res.status(400).json({ ok: false, error: "客戶姓名不可空白" });
    if (customer.phone && store.customers.some((item) => item.phone === customer.phone)) return res.status(409).json({ ok: false, error: "此電話已存在客戶資料" });
    store.customers.push(customer);
    logActivity(store, req.internalUser.user, "新增客戶", customer.name);
    legacy.writeStore(store);
    res.json({ ok: true, customer });
  });

  app.patch("/internal/api/v2/customers/:id", requireApi, requestGuard, json, (req, res) => {
    const store = legacy.readStore();
    const customer = store.customers.find((item) => item.id === req.params.id);
    if (!customer) return res.status(404).json({ ok: false, error: "找不到客戶" });
    for (const [key, max] of [["name",80],["phone",40],["lineId",120],["interests",1000],["tags",300],["note",2000]]) if (req.body[key] !== undefined) customer[key] = clean(req.body[key], max);
    if (!customer.name) return res.status(400).json({ ok: false, error: "客戶姓名不可空白" });
    customer.updatedAt = now();
    logActivity(store, req.internalUser.user, "更新客戶", customer.name);
    legacy.writeStore(store);
    res.json({ ok: true, customer });
  });

  app.delete("/internal/api/v2/customers/:id", requireApi, requireAdmin, requestGuard, (req, res) => {
    const store = legacy.readStore();
    const index = store.customers.findIndex((item) => item.id === req.params.id);
    if (index < 0) return res.status(404).json({ ok: false, error: "找不到客戶" });
    const [removed] = store.customers.splice(index, 1);
    logActivity(store, req.internalUser.user, "刪除客戶", removed.name || removed.id);
    legacy.writeStore(store);
    res.json({ ok: true });
  });

  app.patch("/internal/api/v2/inventory/:productId", requireApi, requestGuard, json, (req, res) => {
    const store = legacy.readStore();
    const item = store.inventory.find((entry) => entry.productId === req.params.productId);
    if (!item) return res.status(404).json({ ok: false, error: "找不到庫存品項" });
    item.stock = Math.max(0, finiteNumber(req.body.stock));
    item.lowStock = Math.max(0, finiteNumber(req.body.lowStock));
    item.updatedAt = now();
    logActivity(store, req.internalUser.user, "更新庫存", `${item.name}｜${item.stock}`);
    legacy.writeStore(store);
    res.json({ ok: true, item });
  });

  app.post("/internal/api/v2/inventory/:productId/adjust", requireApi, requestGuard, json, (req, res) => {
    const store = legacy.readStore();
    const item = store.inventory.find((entry) => entry.productId === req.params.productId);
    if (!item) return res.status(404).json({ ok: false, error: "找不到庫存品項" });
    const delta = finiteNumber(req.body.delta);
    if (!delta) return res.status(400).json({ ok: false, error: "調整數量不可為 0" });
    item.stock = Math.max(0, finiteNumber(item.stock) + delta);
    item.updatedAt = now();
    item.movements = Array.isArray(item.movements) ? item.movements : [];
    item.movements.push({ id: uid("mov"), delta, reason: clean(req.body.reason, 300), actor: req.internalUser.user, createdAt: now() });
    item.movements = item.movements.slice(-200);
    logActivity(store, req.internalUser.user, "庫存調整", `${item.name}｜${delta > 0 ? "+" : ""}${delta}｜${clean(req.body.reason, 100)}`);
    legacy.writeStore(store);
    res.json({ ok: true, item });
  });

  app.post("/internal/api/v2/reminders", requireApi, requestGuard, json, (req, res) => {
    const dueAt = new Date(req.body.dueAt);
    if (!clean(req.body.title, 120) || Number.isNaN(dueAt.getTime())) return res.status(400).json({ ok: false, error: "提醒事項或時間不正確" });
    const store = legacy.readStore();
    const reminder = { id: uid("rem"), title: clean(req.body.title, 120), dueAt: dueAt.toISOString(), note: clean(req.body.note, 1000), done: false, createdAt: now(), updatedAt: now() };
    store.reminders.push(reminder);
    logActivity(store, req.internalUser.user, "建立提醒", reminder.title);
    legacy.writeStore(store);
    res.json({ ok: true, reminder });
  });

  app.patch("/internal/api/v2/reminders/:id", requireApi, requestGuard, json, (req, res) => {
    const store = legacy.readStore();
    const reminder = store.reminders.find((item) => item.id === req.params.id);
    if (!reminder) return res.status(404).json({ ok: false, error: "找不到提醒" });
    if (req.body.title !== undefined) reminder.title = clean(req.body.title, 120);
    if (req.body.note !== undefined) reminder.note = clean(req.body.note, 1000);
    if (req.body.dueAt !== undefined) {
      const dueAt = new Date(req.body.dueAt);
      if (Number.isNaN(dueAt.getTime())) return res.status(400).json({ ok: false, error: "提醒時間不正確" });
      reminder.dueAt = dueAt.toISOString();
    }
    if (req.body.done !== undefined) reminder.done = Boolean(req.body.done);
    reminder.updatedAt = now();
    logActivity(store, req.internalUser.user, "更新提醒", reminder.title);
    legacy.writeStore(store);
    res.json({ ok: true, reminder });
  });

  app.delete("/internal/api/v2/reminders/:id", requireApi, requireAdmin, requestGuard, (req, res) => {
    const store = legacy.readStore();
    const index = store.reminders.findIndex((item) => item.id === req.params.id);
    if (index < 0) return res.status(404).json({ ok: false, error: "找不到提醒" });
    const [removed] = store.reminders.splice(index, 1);
    logActivity(store, req.internalUser.user, "刪除提醒", removed.title || removed.id);
    legacy.writeStore(store);
    res.json({ ok: true });
  });

  app.post("/internal/api/v2/social", requireApi, requestGuard, json, (req, res) => {
    const scheduledAt = new Date(req.body.scheduledAt);
    const publishInstagram = Boolean(req.body.publishInstagram);
    const publishFacebook = Boolean(req.body.publishFacebook);
    const imageUrl = clean(req.body.imageUrl, 1000);
    const instagramCaption = clean(req.body.instagramCaption, 2200);
    const facebookCaption = clean(req.body.facebookCaption, 5000);
    if (!clean(req.body.title, 120) || Number.isNaN(scheduledAt.getTime())) return res.status(400).json({ ok: false, error: "標題或排程時間不正確" });
    if (!publishInstagram && !publishFacebook) return res.status(400).json({ ok: false, error: "至少選擇一個平台" });
    if (publishInstagram && (!/^https:\/\//i.test(imageUrl) || !instagramCaption)) return res.status(400).json({ ok: false, error: "Instagram 必須有公開 HTTPS 圖片與文案" });
    if (publishFacebook && !(facebookCaption || instagramCaption)) return res.status(400).json({ ok: false, error: "Facebook 文案不可空白" });
    const store = social.readStore();
    const post = { id: uid("post"), title: clean(req.body.title, 120), imageUrl, instagramCaption, facebookCaption, scheduledAt: scheduledAt.toISOString(), publishInstagram, publishFacebook, status: "draft", result: {}, lastError: "", createdAt: now(), updatedAt: now() };
    store.posts.push(post);
    social.writeStore(store);
    const internal = legacy.readStore();
    logActivity(internal, req.internalUser.user, "建立社群草稿", post.title);
    legacy.writeStore(internal);
    res.json({ ok: true, post });
  });

  app.post("/internal/api/v2/social/:id/:action", requireApi, requestGuard, json, async (req, res) => {
    const action = req.params.action;
    const store = social.readStore();
    const index = store.posts.findIndex((item) => item.id === req.params.id);
    if (index < 0) return res.status(404).json({ ok: false, error: "找不到社群貼文" });
    const post = store.posts[index];
    if (action === "publish") {
      await social.execute(post.id);
    } else if (action === "delete") {
      if (req.internalUser.role !== "admin") return res.status(403).json({ ok: false, error: "需要管理員權限" });
      store.posts.splice(index, 1);
      social.writeStore(store);
    } else {
      const map = { approve: "approved", reject: "rejected", cancel: "cancelled" };
      if (!map[action]) return res.status(400).json({ ok: false, error: "不支援的操作" });
      post.status = map[action];
      post.lastError = action === "reject" ? "已退回修改" : "";
      post.updatedAt = now();
      social.writeStore(store);
    }
    const internal = legacy.readStore();
    logActivity(internal, req.internalUser.user, "社群操作", `${post.title}｜${action}`);
    legacy.writeStore(internal);
    res.json({ ok: true });
  });

  app.post("/internal/api/v2/staff", requireApi, requireAdmin, requestGuard, json, (req, res) => {
    const username = clean(req.body.username, 80);
    const password = String(req.body.password || "");
    if (!/^[a-zA-Z0-9._-]{3,80}$/.test(username)) return res.status(400).json({ ok: false, error: "帳號格式不正確" });
    if (password.length < 8) return res.status(400).json({ ok: false, error: "密碼至少 8 碼" });
    const store = legacy.readStore();
    const master = clean(process.env.INTERNAL_ADMIN_USER || "admin", 80) || "admin";
    if (username === master || store.staff.some((item) => item.username === username)) return res.status(409).json({ ok: false, error: "帳號已存在" });
    const salt = crypto.randomBytes(16).toString("hex");
    const staff = { id: uid("staff"), username, displayName: clean(req.body.displayName, 80) || username, role: req.body.role === "admin" ? "admin" : "staff", passwordHash: `${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`, active: true, createdAt: now(), updatedAt: now() };
    store.staff.push(staff);
    logActivity(store, req.internalUser.user, "新增員工", `${staff.displayName}（${staff.role}）`);
    legacy.writeStore(store);
    res.json({ ok: true, staff: sanitizeStaff([staff])[0] });
  });

  app.patch("/internal/api/v2/staff/:id", requireApi, requireAdmin, requestGuard, json, (req, res) => {
    const store = legacy.readStore();
    const staff = store.staff.find((item) => item.id === req.params.id);
    if (!staff) return res.status(404).json({ ok: false, error: "找不到員工帳號" });
    if (req.body.active !== undefined) staff.active = Boolean(req.body.active);
    if (req.body.role !== undefined) staff.role = req.body.role === "admin" ? "admin" : "staff";
    if (req.body.displayName !== undefined) staff.displayName = clean(req.body.displayName, 80) || staff.username;
    if (req.body.password !== undefined) {
      const password = String(req.body.password || "");
      if (password.length < 8) return res.status(400).json({ ok: false, error: "密碼至少 8 碼" });
      const salt = crypto.randomBytes(16).toString("hex");
      staff.passwordHash = `${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`;
    }
    staff.updatedAt = now();
    logActivity(store, req.internalUser.user, "更新員工", staff.displayName || staff.username);
    legacy.writeStore(store);
    res.json({ ok: true });
  });

  app.delete("/internal/api/v2/staff/:id", requireApi, requireAdmin, requestGuard, (req, res) => {
    const store = legacy.readStore();
    const index = store.staff.findIndex((item) => item.id === req.params.id);
    if (index < 0) return res.status(404).json({ ok: false, error: "找不到員工帳號" });
    if (store.staff[index].username === req.internalUser.user) return res.status(400).json({ ok: false, error: "不可刪除目前登入帳號" });
    const [removed] = store.staff.splice(index, 1);
    logActivity(store, req.internalUser.user, "刪除員工", removed.displayName || removed.username);
    legacy.writeStore(store);
    res.json({ ok: true });
  });

  app.get("/internal/api/v2/export/backup", requirePage, (req, res) => {
    const backup = { version: PRO_VERSION, exportedAt: now(), internal: legacy.readStore(), social: social.readStore() };
    res.set("Content-Disposition", `attachment; filename="xianjiawei-backup-${new Date().toISOString().slice(0,10)}.json"`);
    res.type("application/json").send(JSON.stringify(backup, null, 2));
  });

  app.get("/internal/api/v2/export/orders.csv", requirePage, (_req, res) => {
    const rows = legacy.readStore().orders || [];
    const header = ["訂單編號","建立時間","客戶","電話","商品","金額","狀態","付款","配送","地址","物流單號","備註"];
    const lines = [header, ...rows.map(o=>[o.id,o.createdAt,o.customerName,o.phone,o.items,o.total,o.status,o.payment,o.shipping,o.address,o.trackingNo,o.note])].map(row=>row.map(csvCell).join(","));
    res.set("Content-Disposition", "attachment; filename=orders.csv").type("text/csv; charset=utf-8").send("\ufeff"+lines.join("\n"));
  });

  app.get("/internal/api/v2/export/customers.csv", requirePage, (_req, res) => {
    const rows = legacy.readStore().customers || [];
    const lines = [["客戶編號","姓名","電話","LINE","詢問產品","標籤","備註","建立時間"],...rows.map(c=>[c.id,c.name,c.phone,c.lineId,c.interests,c.tags,c.note,c.createdAt])].map(row=>row.map(csvCell).join(","));
    res.set("Content-Disposition", "attachment; filename=customers.csv").type("text/csv; charset=utf-8").send("\ufeff"+lines.join("\n"));
  });

  app.post("/internal/api/v2/import/backup", requireApi, requireAdmin, requestGuard, json, (req, res) => {
    if (req.body.confirm !== true) return res.status(400).json({ ok: false, error: "請確認覆蓋資料" });
    const data = req.body.data;
    if (!data || typeof data !== "object" || !data.internal || !data.social) return res.status(400).json({ ok: false, error: "備份格式不正確" });
    if (!Array.isArray(data.internal.orders) || !Array.isArray(data.internal.customers) || !Array.isArray(data.social.posts)) return res.status(400).json({ ok: false, error: "備份內容不完整" });
    const before = { version: PRO_VERSION, exportedAt: now(), internal: legacy.readStore(), social: social.readStore() };
    legacy.writeStore(data.internal);
    social.writeStore(data.social);
    const restored = legacy.readStore();
    logActivity(restored, req.internalUser.user, "還原完整備份", `匯入前自動備份時間 ${before.exportedAt}`);
    legacy.writeStore(restored);
    res.json({ ok: true });
  });

  app.get("/internal/api/v2/health", requireApi, (_req, res) => {
    const health = bridge.health();
    res.status(health.enabled && !health.connected ? 503 : 200).json({ ok: !health.enabled || health.connected, version: PRO_VERSION, storage: health.storage, connected: health.connected, checkedAt: now() });
  });
}

let installed = false;
function installHook() {
  if (installed) return;
  installed = true;
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    const loaded = originalLoad.apply(this, arguments);
    if (request === "./internal-app" && parent?.filename?.endsWith("internal-entry.js") && loaded && !loaded.__xjwProWrapped) {
      const originalMount = loaded.mountInternalApp;
      loaded.mountInternalApp = function mountWithPro(app) {
        mountInternalPro(app, loaded);
        return originalMount(app);
      };
      Object.defineProperty(loaded, "__xjwProWrapped", { value: true });
    }
    return loaded;
  };
}

installHook();

module.exports = { PRO_VERSION, ORDER_STATUSES, normalizeOrder, dashboardMetrics, csvCell, mountInternalPro, installHook };
