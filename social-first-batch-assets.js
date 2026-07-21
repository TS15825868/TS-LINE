"use strict";

const fs = require("fs");
const path = require("path");
const Module = require("module");
const sharp = require("sharp");

const VERSION = "1.0.0";
const ROUTE_PREFIX = "/social-assets/first-batch";
const CACHE = new Map();
const RAW_SOURCE = "https://raw.githubusercontent.com/TS15825868/TS-LINE/main/public/social/first-batch";
const RENDER_SOURCE = "https://ts-line.onrender.com/social-assets/first-batch";

const ASSETS = {
  "other-choose-form-2026-07-24.jpg": { kicker: "仙加味怎麼選", title: ["依照自己的作息", "選擇適合的日常型態"], bullets: ["先看使用情境", "再看攜帶與沖泡方式", "選自己順手的節奏"], pose: "point", layout: "left", icon: "sign" },
  "care-work-rest-2026-07-29.jpg": { kicker: "仙加味日常關心", title: ["工作再忙", "也別忘了休息一下"], bullets: ["久坐時起身伸展", "喝水也要記得補上", "留一點時間照顧自己"], pose: "clock", layout: "right", icon: "clock" },
  "other-hot-drink-2026-07-31.jpg": { kicker: "仙加味使用小提醒", title: ["想喝熱熱的時候", "先化開再調整溫度"], bullets: ["先依標示使用熱水", "再調到適口溫度", "照自己的節奏慢慢喝"], pose: "pour", layout: "left", icon: "cup" },
  "care-family-2026-08-05.jpg": { kicker: "仙加味日常關心", title: ["照顧自己", "也別忘了關心家人"], bullets: ["一句問候很有溫度", "一起吃飯、一起休息", "把關心放進日常裡"], pose: "heart", layout: "right", icon: "heart" },
  "other-storage-2026-08-07.jpg": { kicker: "仙加味保存小提醒", title: ["開封後與平時保存", "記得放在適合的地方"], bullets: ["常溫放在陰涼處", "需要時依標示冷藏", "開封後留意保存方式"], pose: "box", layout: "left", icon: "box" },
  "care-temperature-gap-2026-08-12.jpg": { kicker: "仙加味日常關心", title: ["早晚溫差大", "出門多帶一件薄外套"], bullets: ["依當下溫度調整穿著", "忙碌中也留點休息", "慢慢照顧自己"], pose: "jacket", layout: "right", icon: "jacket" },
  "other-warm-meal-2026-08-14.jpg": { kicker: "仙加味日常分享", title: ["想吃得暖一點", "日常也可以慢慢安排"], bullets: ["簡單準備也很好", "坐下來慢慢吃飯", "把生活過得穩穩的"], pose: "bowl", layout: "left", icon: "bowl" },
  "care-hydration-2026-08-19.jpg": { kicker: "仙加味日常關心", title: ["天氣炎熱", "記得分次補充水分"], bullets: ["外出記得帶水瓶", "不要等口渴才喝", "也提醒身邊的家人"], pose: "bottle", layout: "right", icon: "drop" },
  "care-rainy-day-2026-08-26.jpg": { kicker: "仙加味日常分享", title: ["下雨天在家", "留一點暖暖的時間"], bullets: ["泡杯溫熱飲品", "把生活步調放慢", "陪家人聊聊天"], pose: "cup", layout: "left", icon: "rain" },
};

function escapeXml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function addApprovedHost() {
  const hosts = new Set(String(process.env.SOCIAL_APPROVED_IMAGE_HOSTS || "raw.githubusercontent.com,ts15825868.github.io").split(",").map((value) => value.trim()).filter(Boolean));
  hosts.add("ts-line.onrender.com");
  try { const host = new URL(String(process.env.RENDER_EXTERNAL_URL || "")).hostname; if (host) hosts.add(host); } catch {}
  process.env.SOCIAL_APPROVED_IMAGE_HOSTS = [...hosts].join(",");
}

function stamp() {
  return `<g transform="translate(58 46)"><rect width="86" height="138" rx="28" fill="#a22521" stroke="#d9aa58" stroke-width="4"/><text x="43" y="42" text-anchor="middle" class="stamp">仙</text><text x="43" y="81" text-anchor="middle" class="stamp">加</text><text x="43" y="120" text-anchor="middle" class="stamp">味</text></g>`;
}

function deer(x, y, scale = 1) {
  return `<g transform="translate(${x} ${y}) scale(${scale})"><ellipse cx="0" cy="38" rx="46" ry="52" fill="#ca7d38" stroke="#73451f" stroke-width="5"/><circle cx="0" cy="-7" r="43" fill="#d58a43" stroke="#73451f" stroke-width="5"/><path d="M-26-38 Q-45-73-28-82 M-11-45 Q-22-77-8-91 M26-38 Q45-73 28-82 M11-45 Q22-77 8-91" fill="none" stroke="#73451f" stroke-width="7" stroke-linecap="round"/><ellipse cx="-28" cy="-25" rx="15" ry="22" fill="#d58a43" stroke="#73451f" stroke-width="4" transform="rotate(-35 -28 -25)"/><ellipse cx="28" cy="-25" rx="15" ry="22" fill="#d58a43" stroke="#73451f" stroke-width="4" transform="rotate(35 28 -25)"/><circle cx="-15" cy="-8" r="8" fill="#24170f"/><circle cx="15" cy="-8" r="8" fill="#24170f"/><circle cx="-12" cy="-11" r="2.5" fill="white"/><circle cx="18" cy="-11" r="2.5" fill="white"/><ellipse cx="0" cy="10" rx="8" ry="6" fill="#4e2b1b"/><path d="M-9 21 Q0 30 9 21" fill="none" stroke="#4e2b1b" stroke-width="4" stroke-linecap="round"/><path d="M-39 15 Q-55 28-48 53 M39 15 Q55 28 48 53" fill="none" stroke="#73451f" stroke-width="9" stroke-linecap="round"/><path d="M-31 65 L-32 91 M31 65 L32 91" stroke="#73451f" stroke-width="10" stroke-linecap="round"/><path d="M-39 31 Q0 53 39 31 L34 61 Q0 78-34 61Z" fill="#315c45"/></g>`;
}

function turtle(x, y, scale = 1) {
  return `<g transform="translate(${x} ${y}) scale(${scale})"><ellipse cx="0" cy="43" rx="51" ry="48" fill="#6f914f" stroke="#345332" stroke-width="5"/><circle cx="0" cy="-4" r="42" fill="#a9bd73" stroke="#345332" stroke-width="5"/><circle cx="-15" cy="-8" r="8" fill="#1d291b"/><circle cx="15" cy="-8" r="8" fill="#1d291b"/><circle cx="-12" cy="-11" r="2.5" fill="white"/><circle cx="18" cy="-11" r="2.5" fill="white"/><path d="M-10 16 Q0 25 10 16" fill="none" stroke="#345332" stroke-width="4" stroke-linecap="round"/><circle cx="-15" cy="-8" r="16" fill="none" stroke="#26394f" stroke-width="4"/><circle cx="15" cy="-8" r="16" fill="none" stroke="#26394f" stroke-width="4"/><path d="M1-8 H-1" stroke="#26394f" stroke-width="4"/><path d="M-44 31 Q-63 43-52 62 M44 31 Q63 43 52 62" fill="none" stroke="#345332" stroke-width="10" stroke-linecap="round"/><path d="M-36 45 Q0 17 36 45 Q31 77 0 82 Q-31 77-36 45Z" fill="#547641" stroke="#345332" stroke-width="4"/><path d="M0 26 V79 M-31 48 H31 M-24 67 H24" stroke="#78985b" stroke-width="3" opacity=".7"/></g>`;
}

function boy(x, y, pose = "point", scale = 1) {
  const props = {
    point: `<path d="M150 246 Q195 215 208 171" fill="none" stroke="#f4cba9" stroke-width="30" stroke-linecap="round"/><path d="M208 171 L214 127" stroke="#f4cba9" stroke-width="14" stroke-linecap="round"/>`,
    clock: `<circle cx="166" cy="211" r="39" fill="#f7f0dd" stroke="#855c2f" stroke-width="7"/><path d="M166 185 V213 L187 226" fill="none" stroke="#173554" stroke-width="6" stroke-linecap="round"/>`,
    pour: `<path d="M130 243 Q173 218 197 242" fill="none" stroke="#f4cba9" stroke-width="27" stroke-linecap="round"/><path d="M188 224 Q225 214 236 242 L226 280 Q194 283 179 259Z" fill="#dbe8e6" stroke="#315c45" stroke-width="6"/><path d="M236 243 Q266 248 269 264" fill="none" stroke="#a7c8d0" stroke-width="8"/>`,
    heart: `<path d="M154 224 C128 197 85 236 154 292 C223 236 180 197 154 224Z" fill="#a22521" stroke="#6f1717" stroke-width="6"/>`,
    box: `<rect x="111" y="211" width="105" height="76" rx="12" fill="#b9844e" stroke="#66411f" stroke-width="7"/><path d="M111 234 H216 M163 211 V287" stroke="#e3bf83" stroke-width="5"/>`,
    jacket: `<path d="M103 205 Q154 169 205 205 L222 287 H86Z" fill="#d3b79a" stroke="#84644c" stroke-width="7"/><path d="M154 188 V287 M104 209 L83 251 M204 209 L225 251" stroke="#84644c" stroke-width="6"/>`,
    bowl: `<ellipse cx="159" cy="245" rx="58" ry="22" fill="#d9c6a3" stroke="#705437" stroke-width="7"/><path d="M103 245 Q113 299 159 305 Q205 299 215 245Z" fill="#b98d5d" stroke="#705437" stroke-width="7"/><path d="M147 205 Q157 186 166 205 M174 205 Q184 184 193 205" fill="none" stroke="#d9aa58" stroke-width="6"/>`,
    bottle: `<rect x="127" y="191" width="66" height="116" rx="18" fill="#b8d8dc" stroke="#315c45" stroke-width="7"/><rect x="141" y="171" width="38" height="28" rx="8" fill="#315c45"/><path d="M145 235 Q160 219 176 235 Q160 257 145 235Z" fill="#f7f4ed" opacity=".9"/>`,
    cup: `<path d="M118 221 H199 L190 292 H128Z" fill="#e8e0ca" stroke="#315c45" stroke-width="7"/><path d="M199 235 Q236 236 226 270 Q218 287 192 279" fill="none" stroke="#315c45" stroke-width="8"/><path d="M142 201 Q148 183 156 201 M171 201 Q178 181 185 201" fill="none" stroke="#d9aa58" stroke-width="6"/>`,
  };
  return `<g transform="translate(${x} ${y}) scale(${scale})"><ellipse cx="154" cy="330" rx="116" ry="26" fill="#4b3622" opacity=".18"/><path d="M70 159 Q78 102 154 97 Q230 102 238 159 L229 326 H79Z" fill="#f5f0e4" stroke="#8b6846" stroke-width="7"/><path d="M91 183 H217 L224 326 H84Z" fill="#344f33" stroke="#203621" stroke-width="7"/><rect x="126" y="190" width="56" height="91" rx="16" fill="#a22521" stroke="#d9aa58" stroke-width="4"/><text x="154" y="221" text-anchor="middle" class="apronLogo">仙</text><text x="154" y="246" text-anchor="middle" class="apronLogo">加</text><text x="154" y="271" text-anchor="middle" class="apronLogo">味</text><circle cx="154" cy="94" r="83" fill="#f4cba9" stroke="#78472f" stroke-width="7"/><path d="M75 93 Q80 7 155 5 Q232 8 235 91 Q218 61 196 51 Q173 74 142 48 Q117 73 91 57 Q84 75 75 93Z" fill="#171717"/><path d="M83 57 Q108 21 144 33 M144 33 Q171 3 195 40 M195 40 Q223 29 230 67" fill="none" stroke="#171717" stroke-width="20" stroke-linecap="round"/><ellipse cx="120" cy="105" rx="17" ry="22" fill="#3c2418"/><ellipse cx="188" cy="105" rx="17" ry="22" fill="#3c2418"/><circle cx="126" cy="97" r="5" fill="white"/><circle cx="194" cy="97" r="5" fill="white"/><ellipse cx="100" cy="135" rx="18" ry="9" fill="#ec8f84" opacity=".6"/><ellipse cx="208" cy="135" rx="18" ry="9" fill="#ec8f84" opacity=".6"/><path d="M132 139 Q154 161 177 139" fill="#b54e45" stroke="#78472f" stroke-width="5" stroke-linecap="round"/><path d="M83 215 Q42 230 43 284 M224 215 Q267 231 260 284" fill="none" stroke="#f4cba9" stroke-width="29" stroke-linecap="round"/>${props[pose] || props.point}<circle cx="112" cy="304" r="13" fill="#ca7d38"/><path d="M106 301 l6-13 6 13" fill="none" stroke="#f5e3bd" stroke-width="3"/><circle cx="197" cy="304" r="13" fill="#78985b"/><path d="M188 304 h18 M197 295 v18" stroke="#e8efcf" stroke-width="3"/></g>`;
}

function propIcon(type, x, y) {
  const common = `fill="none" stroke="#f7f4ed" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"`;
  const map = {
    sign: `<path d="M${x-28} ${y-26} H${x+28} V${y+26} H${x-28}Z M${x} ${y+26} V${y+48}" ${common}/>` ,
    clock: `<circle cx="${x}" cy="${y}" r="34" ${common}/><path d="M${x} ${y-18} V${y+2} L${x+17} ${y+14}" ${common}/>` ,
    cup: `<path d="M${x-31} ${y-18} H${x+23} L${x+16} ${y+27} H${x-24}Z M${x+23} ${y-9} Q${x+50} ${y-8} ${x+40} ${y+16}" ${common}/>` ,
    heart: `<path d="M${x} ${y+31} C${x-57} ${y-5} ${x-25} ${y-49} ${x} ${y-22} C${x+25} ${y-49} ${x+57} ${y-5} ${x} ${y+31}Z" ${common}/>` ,
    box: `<rect x="${x-34}" y="${y-27}" width="68" height="57" rx="8" ${common}/><path d="M${x-34} ${y-7} H${x+34} M${x} ${y-27} V${y+30}" ${common}/>` ,
    jacket: `<path d="M${x-25} ${y-27} Q${x} ${y-42} ${x+25} ${y-27} L${x+38} ${y+28} H${x-38}Z M${x} ${y-34} V${y+28}" ${common}/>` ,
    bowl: `<path d="M${x-37} ${y-3} Q${x} ${y+43} ${x+37} ${y-3}Z M${x-43} ${y-4} H${x+43} M${x-17} ${y-18} Q${x-10} ${y-37} ${x-3} ${y-18} M${x+12} ${y-18} Q${x+19} ${y-37} ${x+26} ${y-18}" ${common}/>` ,
    drop: `<path d="M${x} ${y-39} C${x-22} ${y-9} ${x-32} ${y+3} ${x-32} ${y+19} A32 32 0 0 0 ${x+32} ${y+19} C${x+32} ${y+3} ${x+22} ${y-9} ${x} ${y-39}Z" ${common}/>` ,
    rain: `<path d="M${x-38} ${y} Q${x-22} ${y-38} ${x+10} ${y-25} Q${x+39} ${y-22} ${x+42} ${y+2} H${x-38} M${x-24} ${y+19} L${x-31} ${y+35} M${x} ${y+19} L${x-7} ${y+35} M${x+24} ${y+19} L${x+17} ${y+35}" ${common}/>` ,
  };
  return map[type] || map.sign;
}

function renderSvg(config) {
  const left = config.layout === "left";
  const characterX = left ? 30 : 660;
  const panelX = left ? 480 : 45;
  const titleX = left ? 520 : 65;
  const deerX = left ? 650 : 385;
  const turtleX = left ? 815 : 535;
  const title = config.title.map((line, index) => `<text x="${titleX}" y="${250 + index * 86}" class="title">${escapeXml(line)}</text>`).join("");
  const bullets = config.bullets.map((line, index) => { const cy = 542 + index * 126; return `<circle cx="${panelX+64}" cy="${cy-8}" r="43" fill="#0b2c4c" stroke="#d9aa58" stroke-width="5"/>${propIcon(index === 0 ? config.icon : index === 1 ? "drop" : "heart", panelX+64, cy-8)}<text x="${panelX+130}" y="${cy+7}" class="bullet">${escapeXml(line)}</text>${index < 2 ? `<path d="M${panelX+28} ${cy+58} H${panelX+485}" stroke="#d9aa58" stroke-width="2" stroke-dasharray="8 9" opacity=".75"/>` : ""}`; }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fbf4df"/><stop offset="1" stop-color="#ead9b8"/></linearGradient><pattern id="grain" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="4" cy="6" r="1" fill="#b88a2b" opacity=".08"/><circle cx="21" cy="19" r="1" fill="#0b2c4c" opacity=".05"/></pattern><filter id="shadow"><feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#3b2a1d" flood-opacity=".22"/></filter><style>.brand{font-family:'Noto Serif TC','PingFang TC','Microsoft JhengHei',serif;font-size:53px;font-weight:800;fill:#24170f}.small{font-family:'Noto Serif TC','PingFang TC','Microsoft JhengHei',serif;font-size:30px;fill:#f8edcf;font-weight:700;letter-spacing:5px}.title{font-family:'Noto Serif TC','PingFang TC','Microsoft JhengHei',serif;font-size:61px;font-weight:900;fill:#0b2c4c}.bullet{font-family:'Noto Serif TC','PingFang TC','Microsoft JhengHei',sans-serif;font-size:34px;font-weight:700;fill:#173554}.stamp{font-family:'Noto Serif TC','PingFang TC','Microsoft JhengHei',serif;font-size:31px;font-weight:800;fill:#fff5df}.apronLogo{font-family:'Noto Serif TC','PingFang TC','Microsoft JhengHei',serif;font-size:22px;font-weight:800;fill:#fff5df}.footer{font-family:'Noto Serif TC','PingFang TC','Microsoft JhengHei',serif;font-size:38px;font-weight:700;fill:#f8edcf;letter-spacing:3px}</style></defs><rect width="1080" height="1080" fill="url(#bg)"/><rect width="1080" height="1080" fill="url(#grain)"/><rect x="18" y="18" width="1044" height="1044" rx="42" fill="none" stroke="#c69a51" stroke-width="4"/>${stamp()}<text x="170" y="104" class="brand">仙加味</text><text x="170" y="150" font-family="'Noto Serif TC','PingFang TC'" font-size="22" fill="#624b34" letter-spacing="6">自然・安心・好漢方</text><g filter="url(#shadow)"><rect x="360" y="55" width="565" height="96" rx="48" fill="#0b2c4c" stroke="#d9aa58" stroke-width="5"/><text x="642" y="116" text-anchor="middle" class="small">${escapeXml(config.kicker)}</text></g>${title}<g filter="url(#shadow)"><rect x="${panelX}" y="466" width="548" height="420" rx="32" fill="#fffaf0" stroke="#c9994d" stroke-width="5"/>${bullets}</g>${boy(characterX, 570, config.pose, 1.03)}${deer(deerX, 876, .74)}${turtle(turtleX, 881, .74)}<g filter="url(#shadow)"><rect x="142" y="947" width="796" height="84" rx="42" fill="#0b2c4c" stroke="#d9aa58" stroke-width="4"/><text x="540" y="1002" text-anchor="middle" class="footer">補養，是一種節奏。</text></g></svg>`;
}

async function imageBuffer(name) {
  if (!ASSETS[name]) throw new Error("unknown social asset");
  if (!CACHE.has(name)) CACHE.set(name, sharp(Buffer.from(renderSvg(ASSETS[name]))).jpeg({ quality: 91, chromaSubsampling: "4:4:4" }).toBuffer());
  return CACHE.get(name);
}

function mount(app) {
  if (!app || app.__xjwFirstBatchAssetsMounted) return;
  Object.defineProperty(app, "__xjwFirstBatchAssetsMounted", { value: true });
  app.get(`${ROUTE_PREFIX}/:name`, async (req, res) => {
    const name = String(req.params.name || "");
    if (!Object.prototype.hasOwnProperty.call(ASSETS, name)) return res.status(404).send("not found");
    try { const buffer = await imageBuffer(name); res.set("Cache-Control", "public, max-age=604800, immutable"); res.type("image/jpeg").send(buffer); }
    catch (error) { console.error("social asset render failed", error); res.status(500).send("render failed"); }
  });
  app.get("/social-assets/healthz", (_req, res) => res.json({ ok: true, version: VERSION, assets: Object.keys(ASSETS).length }));
}

function installSourcePatch() {
  const previousLoader = Module._extensions[".js"];
  if (previousLoader.__xjwFirstBatchAssetUrl) return;
  const wrapped = function loadWithFirstBatchAssetUrl(module, filename) {
    if (path.basename(filename) !== "social-first-batch-202607.js") return previousLoader(module, filename);
    const source = fs.readFileSync(filename, "utf8").replace(RAW_SOURCE, RENDER_SOURCE);
    return module._compile(source, filename);
  };
  Object.defineProperty(wrapped, "__xjwFirstBatchAssetUrl", { value: true });
  Module._extensions[".js"] = wrapped;
}

function install() {
  addApprovedHost();
  installSourcePatch();
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    const loaded = originalLoad.apply(this, arguments);
    if (request === "./server" && loaded?.app) mount(loaded.app);
    return loaded;
  };
}

install();
module.exports = { VERSION, ROUTE_PREFIX, ASSETS, renderSvg, imageBuffer, mount, addApprovedHost, installSourcePatch, install };
