"use strict";

const crypto = require("crypto");
const express = require("express");
const fs = require("fs");
const path = require("path");

const APP_VERSION = "1.0.0";
const COOKIE = "xjw_internal";
const json = express.json({ limit: "1mb" });
const form = express.urlencoded({ extended: false, limit: "256kb" });
const loginAttempts = new Map();

const clean = (value, max = 500) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
const esc = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
const now = () => new Date().toISOString();
const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
const money = (value) => `$${Number(value || 0).toLocaleString("zh-TW")}`;

function dataPath() {
  return process.env.INTERNAL_DATA_PATH || process.env.SOCIAL_DATA_PATH?.replace(/[^/]+$/, "xianjiawei-internal.json") || "/tmp/xianjiawei-internal.json";
}

function catalogPath() {
  return path.join(__dirname, "data.json");
}

function readCatalog() {
  try {
    const data = JSON.parse(fs.readFileSync(catalogPath(), "utf8"));
    return Array.isArray(data.products) ? data.products : [];
  } catch (error) {
    console.error("internal catalog read failed", error.message);
    return [];
  }
}

function defaultStore() {
  const inventory = readCatalog().map((product) => ({
    productId: product.id,
    name: product.displayName || product.name,
    stock: 0,
    lowStock: 5,
    updatedAt: now(),
  }));
  return {
    schemaVersion: 1,
    orders: [],
    customers: [],
    inventory,
    reminders: [],
    staff: [],
    activities: [],
    settings: { notifications: true },
    updatedAt: now(),
  };
}

function normalizeStore(input) {
  const base = defaultStore();
  const store = input && typeof input === "object" ? input : {};
  return {
    ...base,
    ...store,
    orders: Array.isArray(store.orders) ? store.orders : [],
    customers: Array.isArray(store.customers) ? store.customers : [],
    inventory: Array.isArray(store.inventory) && store.inventory.length ? store.inventory : base.inventory,
    reminders: Array.isArray(store.reminders) ? store.reminders : [],
    staff: Array.isArray(store.staff) ? store.staff : [],
    activities: Array.isArray(store.activities) ? store.activities.slice(-500) : [],
    settings: { ...base.settings, ...(store.settings || {}) },
  };
}

function readStore() {
  try {
    const file = dataPath();
    if (!fs.existsSync(file)) return defaultStore();
    return normalizeStore(JSON.parse(fs.readFileSync(file, "utf8")));
  } catch (error) {
    console.error("internal store read failed", error.message);
    return defaultStore();
  }
}

function writeStore(store) {
  const file = dataPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  const normalized = normalizeStore({ ...store, updatedAt: now() });
  fs.writeFileSync(temp, JSON.stringify(normalized, null, 2), { mode: 0o600 });
  fs.renameSync(temp, file);
  return normalized;
}

function logActivity(store, actor, action, detail = "") {
  store.activities.push({ id: uid("act"), actor, action, detail: clean(detail, 300), createdAt: now() });
  store.activities = store.activities.slice(-500);
}

function secret() {
  return clean(process.env.INTERNAL_APP_SECRET || process.env.INTERNAL_APP_PASSWORD || process.env.SOCIAL_ADMIN_PIN, 500);
}

function masterUser() {
  return clean(process.env.INTERNAL_ADMIN_USER || "admin", 80) || "admin";
}

function masterPassword() {
  return clean(process.env.INTERNAL_APP_PASSWORD || process.env.SOCIAL_ADMIN_PIN, 500);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, encoded) {
  try {
    const [salt, expected] = String(encoded || "").split(":");
    if (!salt || !expected) return false;
    const actual = crypto.scryptSync(String(password), salt, 64);
    const target = Buffer.from(expected, "hex");
    return actual.length === target.length && crypto.timingSafeEqual(actual, target);
  } catch {
    return false;
  }
}

function signSession(user) {
  const payload = Buffer.from(JSON.stringify({ user: user.username, role: user.role, exp: Date.now() + 12 * 60 * 60 * 1000 })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function readCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || "").split(";").map((part) => part.trim().split("=")).filter((item) => item.length === 2));
}

function session(req) {
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

function requireUser(req, res, next) {
  const current = session(req);
  if (!current) return res.status(401).json({ ok: false, error: "請重新登入" });
  req.internalUser = current;
  return next();
}

function requirePageUser(req, res, next) {
  const current = session(req);
  if (!current) return res.redirect("/internal/login");
  req.internalUser = current;
  return next();
}

function requireAdmin(req, res, next) {
  if (req.internalUser?.role !== "admin") return res.status(403).json({ ok: false, error: "需要管理員權限" });
  return next();
}

function metrics(store) {
  const activeOrders = store.orders.filter((order) => !["已完成", "已取消"].includes(order.status));
  const totalSales = store.orders.filter((order) => order.status !== "已取消").reduce((sum, order) => sum + Number(order.total || 0), 0);
  const lowStock = store.inventory.filter((item) => Number(item.stock || 0) <= Number(item.lowStock || 0));
  const dueReminders = store.reminders.filter((item) => !item.done && new Date(item.dueAt).getTime() <= Date.now());
  return {
    orderCount: store.orders.length,
    activeOrderCount: activeOrders.length,
    customerCount: store.customers.length,
    totalSales,
    lowStockCount: lowStock.length,
    dueReminderCount: dueReminders.length,
    pendingSocialCount: 0,
  };
}

function loginPage(message = "") {
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0b1f3b"><title>仙加味管理台登入</title><style>${baseCss()}</style></head><body class="login"><main class="login-card"><div class="brand-mark">仙加味</div><h1>仙加味內部管理 App</h1><p>訂單、客戶、庫存、提醒、社群與營運報表</p>${message ? `<div class="notice error">${esc(message)}</div>` : ""}<form method="post" action="/internal/login"><label>帳號<input name="username" autocomplete="username" value="${esc(masterUser())}" required></label><label>密碼<input name="password" type="password" autocomplete="current-password" required></label><button class="primary" type="submit">登入</button></form></main></body></html>`;
}

function baseCss() {
  return `:root{--navy:#0b1f3b;--red:#8d2024;--cream:#f7f4ed;--gold:#b08a45;--green:#315c45;--line:#ded7ca;--muted:#6b655d}*{box-sizing:border-box}body{margin:0;background:var(--cream);color:#24211d;font-family:-apple-system,BlinkMacSystemFont,"PingFang TC","Noto Sans TC",sans-serif}button,input,select,textarea{font:inherit}button{cursor:pointer}.login{min-height:100vh;display:grid;place-items:center;padding:20px}.login-card{width:min(430px,100%);background:#fff;border:1px solid var(--line);border-radius:26px;padding:26px;box-shadow:0 20px 60px #0b1f3b18}.brand-mark{display:inline-block;background:var(--red);color:#fff;padding:7px 12px;border-radius:8px;font-weight:800}.login h1{color:var(--navy);margin-bottom:8px}.login p{color:var(--muted)}label{display:block;font-weight:700;margin:12px 0}input,select,textarea{width:100%;border:1px solid #cfc8bc;border-radius:12px;padding:12px;background:#fff}textarea{min-height:90px}.primary,.danger,.soft,.success{border:0;border-radius:12px;padding:11px 14px;font-weight:800}.primary{background:var(--navy);color:#fff}.danger{background:var(--red);color:#fff}.success{background:var(--green);color:#fff}.soft{background:#ece8df;color:#24211d}.notice{padding:11px 13px;border-radius:12px;margin:10px 0}.error{background:#fff0ee;color:#8d2024}.app-shell{max-width:1180px;margin:auto;padding:16px 16px 90px}.topbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.topbar h1{font-size:25px;margin:0;color:var(--navy)}.topbar small{color:var(--muted)}.cards{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}.metric,.panel{background:#fff;border:1px solid var(--line);border-radius:18px;padding:16px}.metric strong{display:block;font-size:25px;color:var(--navy)}.metric span{font-size:13px;color:var(--muted)}.tabs{position:sticky;top:0;z-index:10;background:#f7f4edef;backdrop-filter:blur(12px);display:flex;gap:8px;overflow:auto;padding:10px 0}.tab{white-space:nowrap;border:1px solid var(--line);background:#fff;border-radius:999px;padding:9px 13px;font-weight:800}.tab.active{background:var(--navy);color:#fff}.view{display:none;margin-top:12px}.view.active{display:block}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}.toolbar{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap}.list{display:grid;gap:10px;margin-top:12px}.item{border:1px solid var(--line);border-radius:14px;padding:13px;background:#fff}.item h3{margin:0 0 6px;color:var(--navy)}.meta{font-size:13px;color:var(--muted)}.actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.actions button{padding:8px 10px}.pill{display:inline-block;border-radius:999px;padding:4px 8px;font-size:12px;font-weight:800;background:#ece8df}.pill.low{background:#fff0ee;color:#8d2024}.bottom-nav{position:fixed;left:0;right:0;bottom:0;background:#fff;border-top:1px solid var(--line);display:none;grid-template-columns:repeat(5,1fr);z-index:20;padding-bottom:env(safe-area-inset-bottom)}.bottom-nav button{border:0;background:#fff;padding:10px 4px;font-size:12px}.bottom-nav button.active{color:var(--red);font-weight:800}.install{display:none}.muted{color:var(--muted)}.right{text-align:right}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:9px;border-bottom:1px solid #eee;font-size:14px}@media(max-width:900px){.cards{grid-template-columns:repeat(3,1fr)}.grid2{grid-template-columns:1fr}}@media(max-width:640px){.app-shell{padding:12px 12px 78px}.cards{grid-template-columns:repeat(2,1fr)}.metric strong{font-size:21px}.topbar h1{font-size:21px}.tabs{display:none}.bottom-nav{display:grid}.panel{padding:13px}.desktop-only{display:none}.install{display:inline-flex}}`;
}

function appPage(user) {
  const store = readStore();
  const summary = metrics(store);
  const persistence = dataPath().startsWith("/tmp/") ? "暫存模式" : "持久化模式";
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0b1f3b"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="default"><link rel="manifest" href="/internal/manifest.webmanifest"><link rel="apple-touch-icon" href="/internal/icon.svg"><title>仙加味管理台</title><style>${baseCss()}</style></head><body><main class="app-shell"><header class="topbar"><div><h1>仙加味內部管理 App</h1><small>${esc(user.user)}｜${user.role === "admin" ? "管理員" : "員工"}｜${persistence}</small></div><div class="actions"><button id="installBtn" class="soft install">安裝 App</button><button class="soft" onclick="location.href='/social-review'">社群審核</button><form method="post" action="/internal/logout"><button class="danger">登出</button></form></div></header><section class="cards"><div class="metric"><strong id="mActive">${summary.activeOrderCount}</strong><span>處理中訂單</span></div><div class="metric"><strong id="mCustomers">${summary.customerCount}</strong><span>客戶總數</span></div><div class="metric"><strong id="mSales">${money(summary.totalSales)}</strong><span>累計訂單金額</span></div><div class="metric"><strong id="mLow">${summary.lowStockCount}</strong><span>低庫存品項</span></div><div class="metric"><strong id="mReminders">${summary.dueReminderCount}</strong><span>到期提醒</span></div><div class="metric"><strong>${APP_VERSION}</strong><span>管理台版本</span></div></section><nav class="tabs" id="tabs"><button class="tab active" data-view="dashboard">總覽</button><button class="tab" data-view="orders">訂單</button><button class="tab" data-view="customers">客戶 CRM</button><button class="tab" data-view="inventory">庫存</button><button class="tab" data-view="reminders">提醒</button><button class="tab" data-view="reports">報表</button>${user.role === "admin" ? '<button class="tab" data-view="staff">員工</button>' : ""}</nav><section id="dashboard" class="view active"><div class="grid2"><article class="panel"><div class="toolbar"><h2>待處理事項</h2><button class="primary" onclick="showView('orders')">查看訂單</button></div><div id="todoList" class="list"></div></article><article class="panel"><div class="toolbar"><h2>最近操作</h2><button class="soft" onclick="loadAll()">重新整理</button></div><div id="activityList" class="list"></div></article></div></section><section id="orders" class="view"><div class="grid2"><article class="panel"><h2>新增訂單</h2><form id="orderForm"><label>客戶姓名<input name="customerName" required></label><label>電話<input name="phone"></label><label>商品內容<textarea name="items" placeholder="例如：龜鹿膏100g × 1"></textarea></label><div class="grid2"><label>金額<input name="total" type="number" min="0" value="0"></label><label>狀態<select name="status"><option>新訂單</option><option>已聯絡</option><option>已付款</option><option>已出貨</option><option>已完成</option><option>已取消</option></select></label></div><label>配送與備註<textarea name="note"></textarea></label><button class="primary">建立訂單</button></form></article><article class="panel"><div class="toolbar"><h2>訂單清單</h2><select id="orderFilter"><option value="">全部狀態</option><option>新訂單</option><option>已聯絡</option><option>已付款</option><option>已出貨</option><option>已完成</option><option>已取消</option></select></div><div id="orderList" class="list"></div></article></div></section><section id="customers" class="view"><div class="grid2"><article class="panel"><h2>新增客戶</h2><form id="customerForm"><label>姓名<input name="name" required></label><label>電話<input name="phone"></label><label>LINE／識別資料<input name="lineId"></label><label>詢問產品<input name="interests"></label><label>備註<textarea name="note"></textarea></label><button class="primary">加入 CRM</button></form></article><article class="panel"><div class="toolbar"><h2>客戶資料</h2><input id="customerSearch" placeholder="搜尋姓名、電話、產品" style="max-width:280px"></div><div id="customerList" class="list"></div></article></div></section><section id="inventory" class="view"><article class="panel"><div class="toolbar"><h2>庫存管理</h2><span class="muted">低於警戒值會顯示提醒</span></div><div id="inventoryList" class="list"></div></article></section><section id="reminders" class="view"><div class="grid2"><article class="panel"><h2>新增提醒</h2><form id="reminderForm"><label>事項<input name="title" required></label><label>時間<input name="dueAt" type="datetime-local" required></label><label>說明<textarea name="note"></textarea></label><button class="primary">建立提醒</button></form></article><article class="panel"><div class="toolbar"><h2>提醒清單</h2><button class="soft" onclick="requestNotifications()">開啟通知</button></div><div id="reminderList" class="list"></div></article></div></section><section id="reports" class="view"><article class="panel"><h2>營運報表</h2><div id="reportArea"></div></article></section>${user.role === "admin" ? `<section id="staff" class="view"><div class="grid2"><article class="panel"><h2>新增員工帳號</h2><form id="staffForm"><label>帳號<input name="username" required></label><label>顯示名稱<input name="displayName" required></label><label>密碼<input name="password" type="password" minlength="8" required></label><label>權限<select name="role"><option value="staff">員工</option><option value="admin">管理員</option></select></label><button class="primary">新增帳號</button></form></article><article class="panel"><h2>員工清單</h2><div id="staffList" class="list"></div></article></div></section>` : ""}</main><nav class="bottom-nav"><button class="active" data-view="dashboard">總覽</button><button data-view="orders">訂單</button><button data-view="customers">客戶</button><button data-view="inventory">庫存</button><button data-view="reminders">提醒</button></nav><script>${clientJs(user.role)}</script></body></html>`;
}

function clientJs(role) {
  return `const state={orders:[],customers:[],inventory:[],reminders:[],activities:[],staff:[],summary:{}};const headers={"Content-Type":"application/json","X-XJW-Requested-With":"internal-app"};let deferredPrompt=null;window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;document.getElementById("installBtn")?.classList.add("show")});document.getElementById("installBtn")?.addEventListener("click",async()=>{if(!deferredPrompt)return alert("請使用瀏覽器的『加入主畫面』安裝");deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null});if("serviceWorker" in navigator)navigator.serviceWorker.register("/internal/sw.js").catch(()=>{});function showView(id){document.querySelectorAll(".view").forEach(x=>x.classList.toggle("active",x.id===id));document.querySelectorAll("[data-view]").forEach(x=>x.classList.toggle("active",x.dataset.view===id));scrollTo(0,0)}document.querySelectorAll("[data-view]").forEach(x=>x.addEventListener("click",()=>showView(x.dataset.view)));async function api(url,options={}){const r=await fetch(url,{...options,headers:{...headers,...(options.headers||{})}});const d=await r.json().catch(()=>({ok:false,error:"系統回覆格式錯誤"}));if(r.status===401){location.href="/internal/login";throw new Error("請重新登入")}if(!r.ok||d.ok===false)throw new Error(d.error||"操作失敗");return d}function f(form){return Object.fromEntries(new FormData(form).entries())}function dt(value){return value?new Date(value).toLocaleString("zh-TW",{hour12:false}):""}function e(value){return String(value??"").replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;","'":"&#039;"}[c]))}function cash(value){return "$"+Number(value||0).toLocaleString("zh-TW")}async function loadAll(){const d=await api("/internal/api/state");Object.assign(state,d);render()}function render(){document.getElementById("mActive").textContent=state.summary.activeOrderCount;document.getElementById("mCustomers").textContent=state.summary.customerCount;document.getElementById("mSales").textContent=cash(state.summary.totalSales);document.getElementById("mLow").textContent=state.summary.lowStockCount;document.getElementById("mReminders").textContent=state.summary.dueReminderCount;renderOrders();renderCustomers();renderInventory();renderReminders();renderDashboard();renderReports();renderStaff()}function renderDashboard(){const todos=[...state.orders.filter(o=>!["已完成","已取消"].includes(o.status)).slice(0,5).map(o=>({t:o.customerName+"｜"+o.status,d:o.items||"未填商品"})),...state.inventory.filter(i=>Number(i.stock)<=Number(i.lowStock)).slice(0,5).map(i=>({t:"低庫存｜"+i.name,d:"目前 "+i.stock+"，警戒 "+i.lowStock})),...state.reminders.filter(r=>!r.done&&new Date(r.dueAt)<=new Date()).slice(0,5).map(r=>({t:"到期提醒｜"+r.title,d:dt(r.dueAt)}))];document.getElementById("todoList").innerHTML=todos.length?todos.map(x=>'<div class="item"><h3>'+e(x.t)+'</h3><div class="meta">'+e(x.d)+'</div></div>').join(""):'<div class="item muted">目前沒有待處理事項</div>';document.getElementById("activityList").innerHTML=state.activities.slice(0,12).map(a=>'<div class="item"><strong>'+e(a.action)+'</strong><div class="meta">'+e(a.actor)+'｜'+dt(a.createdAt)+'｜'+e(a.detail||"")+'</div></div>').join("")||'<div class="item muted">尚無操作紀錄</div>'}function renderOrders(){const filter=document.getElementById("orderFilter")?.value||"";const rows=state.orders.filter(o=>!filter||o.status===filter);document.getElementById("orderList").innerHTML=rows.map(o=>'<div class="item"><div class="toolbar"><h3>'+e(o.customerName)+'</h3><span class="pill">'+e(o.status)+'</span></div><div>'+e(o.items||"未填商品")+'</div><div class="meta">'+e(o.phone||"")+"｜"+cash(o.total)+"｜"+dt(o.createdAt)+'</div><div class="meta">'+e(o.note||"")+'</div><div class="actions">'+["新訂單","已聯絡","已付款","已出貨","已完成","已取消"].map(s=>'<button class="'+(s==="已取消"?"danger":"soft")+'" onclick="setOrderStatus(\''+o.id+'\',\''+s+'\')">'+s+'</button>').join("")+'</div></div>').join("")||'<div class="item muted">沒有訂單</div>'}function renderCustomers(){const q=(document.getElementById("customerSearch")?.value||"").toLowerCase();const rows=state.customers.filter(c=>!q||[c.name,c.phone,c.lineId,c.interests,c.note].join(" ").toLowerCase().includes(q));document.getElementById("customerList").innerHTML=rows.map(c=>'<div class="item"><h3>'+e(c.name)+'</h3><div>'+e(c.interests||"尚未記錄詢問產品")+'</div><div class="meta">'+e(c.phone||"")+"｜"+e(c.lineId||"")+'</div><div class="meta">'+e(c.note||"")+'</div></div>').join("")||'<div class="item muted">沒有客戶資料</div>'}function renderInventory(){document.getElementById("inventoryList").innerHTML=state.inventory.map(i=>'<div class="item"><div class="toolbar"><h3>'+e(i.name)+'</h3><span class="pill '+(Number(i.stock)<=Number(i.lowStock)?"low":"")+'">庫存 '+i.stock+'</span></div><div class="grid2"><label>目前庫存<input id="stock-'+i.productId+'" type="number" value="'+Number(i.stock||0)+'"></label><label>警戒值<input id="low-'+i.productId+'" type="number" value="'+Number(i.lowStock||0)+'"></label></div><button class="primary" onclick="saveInventory(\''+i.productId+'\')">儲存</button></div>').join("")}function renderReminders(){document.getElementById("reminderList").innerHTML=state.reminders.map(r=>'<div class="item"><div class="toolbar"><h3>'+e(r.title)+'</h3><span class="pill '+(!r.done&&new Date(r.dueAt)<=new Date()?"low":"")+'">'+(r.done?"已完成":dt(r.dueAt))+'</span></div><div class="meta">'+e(r.note||"")+'</div><div class="actions"><button class="success" onclick="toggleReminder(\''+r.id+'\','+(!r.done)+')">'+(r.done?"重新開啟":"完成")+'</button></div></div>').join("")||'<div class="item muted">沒有提醒</div>';notifyDue()}function renderReports(){const by={};state.orders.forEach(o=>by[o.status]=(by[o.status]||0)+1);const low=state.inventory.filter(i=>Number(i.stock)<=Number(i.lowStock));document.getElementById("reportArea").innerHTML='<div class="cards"><div class="metric"><strong>'+state.orders.length+'</strong><span>全部訂單</span></div><div class="metric"><strong>'+cash(state.summary.totalSales)+'</strong><span>訂單總額</span></div><div class="metric"><strong>'+state.customers.length+'</strong><span>客戶</span></div></div><h3>訂單狀態</h3><table>'+Object.entries(by).map(([k,v])=>'<tr><td>'+e(k)+'</td><td class="right">'+v+'</td></tr>').join("")+'</table><h3>低庫存</h3><table>'+low.map(i=>'<tr><td>'+e(i.name)+'</td><td class="right">'+i.stock+' / '+i.lowStock+'</td></tr>').join("")+'</table>'}function renderStaff(){const el=document.getElementById("staffList");if(!el)return;el.innerHTML=state.staff.map(s=>'<div class="item"><div class="toolbar"><h3>'+e(s.displayName||s.username)+'</h3><span class="pill">'+e(s.role)+'</span></div><div class="meta">帳號：'+e(s.username)+'｜'+(s.active===false?"停用":"啟用")+'</div><div class="actions"><button class="soft" onclick="toggleStaff(\''+s.id+'\','+(s.active===false)+')">'+(s.active===false?"啟用":"停用")+'</button></div></div>').join("")||'<div class="item muted">尚未新增員工帳號</div>'}async function setOrderStatus(id,status){await api('/internal/api/orders/'+id,{method:'PATCH',body:JSON.stringify({status})});loadAll()}async function saveInventory(productId){await api('/internal/api/inventory/'+productId,{method:'PATCH',body:JSON.stringify({stock:Number(document.getElementById('stock-'+productId).value),lowStock:Number(document.getElementById('low-'+productId).value)})});loadAll()}async function toggleReminder(id,done){await api('/internal/api/reminders/'+id,{method:'PATCH',body:JSON.stringify({done})});loadAll()}async function toggleStaff(id,active){await api('/internal/api/staff/'+id,{method:'PATCH',body:JSON.stringify({active})});loadAll()}async function requestNotifications(){if(!('Notification'in window))return alert('此裝置不支援通知');const p=await Notification.requestPermission();alert(p==='granted'?'通知已開啟':'通知未開啟')}function notifyDue(){if(!('Notification'in window)||Notification.permission!=='granted')return;state.reminders.filter(r=>!r.done&&new Date(r.dueAt)<=new Date()&&!sessionStorage.getItem('n-'+r.id)).forEach(r=>{navigator.serviceWorker?.ready.then(reg=>reg.showNotification('仙加味提醒',{body:r.title,icon:'/internal/icon.svg'}));sessionStorage.setItem('n-'+r.id,'1')})}document.getElementById('orderForm')?.addEventListener('submit',async e=>{e.preventDefault();await api('/internal/api/orders',{method:'POST',body:JSON.stringify(f(e.target))});e.target.reset();loadAll()});document.getElementById('customerForm')?.addEventListener('submit',async e=>{e.preventDefault();await api('/internal/api/customers',{method:'POST',body:JSON.stringify(f(e.target))});e.target.reset();loadAll()});document.getElementById('reminderForm')?.addEventListener('submit',async e=>{e.preventDefault();await api('/internal/api/reminders',{method:'POST',body:JSON.stringify(f(e.target))});e.target.reset();loadAll()});document.getElementById('staffForm')?.addEventListener('submit',async e=>{e.preventDefault();await api('/internal/api/staff',{method:'POST',body:JSON.stringify(f(e.target))});e.target.reset();loadAll()});document.getElementById('orderFilter')?.addEventListener('change',renderOrders);document.getElementById('customerSearch')?.addEventListener('input',renderCustomers);loadAll().catch(e=>alert(e.message));`;
}

function requestGuard(req, res, next) {
  if (req.get("X-XJW-Requested-With") !== "internal-app") return res.status(403).json({ ok: false, error: "請從管理 App 操作" });
  return next();
}

function mountInternalApp(app) {
  app.get("/internal", (_req, res) => res.redirect("/internal/app"));
  app.get("/internal/login", (req, res) => {
    res.set("Cache-Control", "no-store");
    if (!masterPassword()) return res.status(503).send(loginPage("請先在 Render 設定 INTERNAL_APP_PASSWORD 或 SOCIAL_ADMIN_PIN"));
    if (session(req)) return res.redirect("/internal/app");
    return res.send(loginPage());
  });
  app.post("/internal/login", form, (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const attempts = loginAttempts.get(ip) || { count: 0, until: 0 };
    if (attempts.until > Date.now()) return res.status(429).send(loginPage("登入嘗試過多，請稍後再試"));
    const username = clean(req.body.username, 80);
    const password = String(req.body.password || "");
    let user = null;
    if (username === masterUser() && password === masterPassword()) user = { username, role: "admin" };
    if (!user) {
      const staff = readStore().staff.find((item) => item.username === username && item.active !== false && verifyPassword(password, item.passwordHash));
      if (staff) user = { username: staff.username, role: staff.role || "staff" };
    }
    if (!user) {
      attempts.count += 1;
      if (attempts.count >= 5) attempts.until = Date.now() + 10 * 60 * 1000;
      loginAttempts.set(ip, attempts);
      return res.status(401).send(loginPage("帳號或密碼不正確"));
    }
    loginAttempts.delete(ip);
    res.cookie(COOKIE, signSession(user), { httpOnly: true, secure: true, sameSite: "lax", maxAge: 12 * 60 * 60 * 1000, path: "/" });
    return res.redirect("/internal/app");
  });
  app.post("/internal/logout", form, (_req, res) => {
    res.clearCookie(COOKIE, { path: "/" });
    res.redirect("/internal/login");
  });
  app.get("/internal/app", requirePageUser, (req, res) => {
    res.set("Cache-Control", "no-store");
    res.send(appPage(req.internalUser));
  });
  app.get("/internal/manifest.webmanifest", (_req, res) => res.type("application/manifest+json").send(JSON.stringify({ name: "仙加味內部管理 App", short_name: "仙加味管理", start_url: "/internal/app", display: "standalone", background_color: "#f7f4ed", theme_color: "#0b1f3b", icons: [{ src: "/internal/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }] })));
  app.get("/internal/icon.svg", (_req, res) => res.type("image/svg+xml").send(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="110" fill="#0b1f3b"/><rect x="116" y="72" width="280" height="368" rx="46" fill="#f7f4ed"/><rect x="157" y="116" width="198" height="280" rx="22" fill="#8d2024"/><text x="256" y="205" text-anchor="middle" font-size="72" font-weight="700" fill="#fff" font-family="serif">仙</text><text x="256" y="291" text-anchor="middle" font-size="72" font-weight="700" fill="#fff" font-family="serif">加</text><text x="256" y="377" text-anchor="middle" font-size="72" font-weight="700" fill="#fff" font-family="serif">味</text></svg>`));
  app.get("/internal/sw.js", (_req, res) => {
    res.type("application/javascript").set("Cache-Control", "no-cache").send(`const CACHE='xjw-internal-${APP_VERSION}';self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['/internal/login','/internal/icon.svg'])))});self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)))})`);
  });

  app.get("/internal/api/state", requireUser, (req, res) => {
    const store = readStore();
    res.json({ ok: true, ...store, activities: store.activities.slice().reverse(), orders: store.orders.slice().reverse(), customers: store.customers.slice().reverse(), reminders: store.reminders.slice().sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt)), summary: metrics(store), persistence: dataPath().startsWith("/tmp/") ? "temporary" : "persistent", role: req.internalUser.role });
  });
  app.post("/internal/api/orders", requireUser, requestGuard, json, (req, res) => {
    const store = readStore();
    const order = { id: uid("ord"), customerName: clean(req.body.customerName, 80), phone: clean(req.body.phone, 40), items: clean(req.body.items, 1000), total: Number(req.body.total || 0), status: clean(req.body.status, 40) || "新訂單", note: clean(req.body.note, 1000), createdAt: now(), updatedAt: now() };
    if (!order.customerName) return res.status(400).json({ ok: false, error: "客戶姓名不可空白" });
    store.orders.push(order);
    const existing = store.customers.find((item) => order.phone && item.phone === order.phone);
    if (!existing) store.customers.push({ id: uid("cus"), name: order.customerName, phone: order.phone, lineId: "", interests: order.items, note: "由訂單自動建立", createdAt: now(), updatedAt: now() });
    logActivity(store, req.internalUser.user, "建立訂單", `${order.customerName} ${money(order.total)}`);
    writeStore(store);
    res.json({ ok: true, order });
  });
  app.patch("/internal/api/orders/:id", requireUser, requestGuard, json, (req, res) => {
    const store = readStore();
    const order = store.orders.find((item) => item.id === req.params.id);
    if (!order) return res.status(404).json({ ok: false, error: "找不到訂單" });
    if (req.body.status) order.status = clean(req.body.status, 40);
    if (req.body.note !== undefined) order.note = clean(req.body.note, 1000);
    order.updatedAt = now();
    logActivity(store, req.internalUser.user, "更新訂單", `${order.customerName} → ${order.status}`);
    writeStore(store);
    res.json({ ok: true, order });
  });
  app.post("/internal/api/customers", requireUser, requestGuard, json, (req, res) => {
    const store = readStore();
    const customer = { id: uid("cus"), name: clean(req.body.name, 80), phone: clean(req.body.phone, 40), lineId: clean(req.body.lineId, 100), interests: clean(req.body.interests, 500), note: clean(req.body.note, 1000), createdAt: now(), updatedAt: now() };
    if (!customer.name) return res.status(400).json({ ok: false, error: "客戶姓名不可空白" });
    store.customers.push(customer);
    logActivity(store, req.internalUser.user, "新增客戶", customer.name);
    writeStore(store);
    res.json({ ok: true, customer });
  });
  app.patch("/internal/api/inventory/:productId", requireUser, requestGuard, json, (req, res) => {
    const store = readStore();
    let item = store.inventory.find((entry) => entry.productId === req.params.productId);
    if (!item) {
      const product = readCatalog().find((entry) => entry.id === req.params.productId);
      item = { productId: req.params.productId, name: product?.displayName || product?.name || req.params.productId, stock: 0, lowStock: 5, updatedAt: now() };
      store.inventory.push(item);
    }
    item.stock = Math.max(0, Number(req.body.stock || 0));
    item.lowStock = Math.max(0, Number(req.body.lowStock || 0));
    item.updatedAt = now();
    logActivity(store, req.internalUser.user, "更新庫存", `${item.name}：${item.stock}`);
    writeStore(store);
    res.json({ ok: true, item });
  });
  app.post("/internal/api/reminders", requireUser, requestGuard, json, (req, res) => {
    const dueAt = new Date(req.body.dueAt);
    if (!clean(req.body.title, 120) || Number.isNaN(dueAt.getTime())) return res.status(400).json({ ok: false, error: "提醒事項或時間不正確" });
    const store = readStore();
    const reminder = { id: uid("rem"), title: clean(req.body.title, 120), dueAt: dueAt.toISOString(), note: clean(req.body.note, 500), done: false, createdAt: now(), updatedAt: now() };
    store.reminders.push(reminder);
    logActivity(store, req.internalUser.user, "建立提醒", reminder.title);
    writeStore(store);
    res.json({ ok: true, reminder });
  });
  app.patch("/internal/api/reminders/:id", requireUser, requestGuard, json, (req, res) => {
    const store = readStore();
    const reminder = store.reminders.find((item) => item.id === req.params.id);
    if (!reminder) return res.status(404).json({ ok: false, error: "找不到提醒" });
    reminder.done = Boolean(req.body.done);
    reminder.updatedAt = now();
    logActivity(store, req.internalUser.user, reminder.done ? "完成提醒" : "重新開啟提醒", reminder.title);
    writeStore(store);
    res.json({ ok: true, reminder });
  });
  app.post("/internal/api/staff", requireUser, requireAdmin, requestGuard, json, (req, res) => {
    const username = clean(req.body.username, 80);
    const password = String(req.body.password || "");
    if (!/^[a-zA-Z0-9._-]{3,80}$/.test(username)) return res.status(400).json({ ok: false, error: "帳號格式不正確" });
    if (password.length < 8) return res.status(400).json({ ok: false, error: "密碼至少 8 碼" });
    const store = readStore();
    if (store.staff.some((item) => item.username === username) || username === masterUser()) return res.status(409).json({ ok: false, error: "帳號已存在" });
    const staff = { id: uid("staff"), username, displayName: clean(req.body.displayName, 80) || username, role: req.body.role === "admin" ? "admin" : "staff", passwordHash: hashPassword(password), active: true, createdAt: now(), updatedAt: now() };
    store.staff.push(staff);
    logActivity(store, req.internalUser.user, "新增員工", `${staff.displayName}（${staff.role}）`);
    writeStore(store);
    res.json({ ok: true, staff: { ...staff, passwordHash: undefined } });
  });
  app.patch("/internal/api/staff/:id", requireUser, requireAdmin, requestGuard, json, (req, res) => {
    const store = readStore();
    const staff = store.staff.find((item) => item.id === req.params.id);
    if (!staff) return res.status(404).json({ ok: false, error: "找不到員工帳號" });
    staff.active = Boolean(req.body.active);
    staff.updatedAt = now();
    logActivity(store, req.internalUser.user, staff.active ? "啟用員工" : "停用員工", staff.displayName || staff.username);
    writeStore(store);
    res.json({ ok: true });
  });
  app.get("/internal/healthz", (_req, res) => {
    const store = readStore();
    res.json({ ok: true, app: "仙加味內部管理 App", version: APP_VERSION, persistence: dataPath().startsWith("/tmp/") ? "temporary" : "persistent", orders: store.orders.length, customers: store.customers.length, reminders: store.reminders.length, staff: store.staff.length, checkedAt: now() });
  });
}

module.exports = { mountInternalApp, readStore, writeStore, metrics, APP_VERSION };
