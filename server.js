"use strict";

const express = require("express");
const line = require("@line/bot-sdk");
const https = require("https");
const http = require("http");

/* =========================
   ENV
========================= */

const {
  LINE_CHANNEL_ACCESS_TOKEN,
  LINE_CHANNEL_SECRET,
  PRODUCTS_URL,
  PORT,
} = process.env;

const config = {
  channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN || "",
  channelSecret: LINE_CHANNEL_SECRET || "",
};

const client = new line.Client(config);

const PRODUCTS_URL_FALLBACK = "https://ts15825868.github.io/TaiShing/products.json";
const PRODUCTS_ENDPOINT = PRODUCTS_URL || PRODUCTS_URL_FALLBACK;

/* =========================
   STORE
========================= */

const STORE = {
  brandName: "仙加味・龜鹿",
  address: "台北市萬華區西昌街 52 號",
  phoneDisplay: "(02) 2381-2990",
  phoneTel: "0223812990",
  website: "https://ts15825868.github.io/TaiShing/",
  mapUrl:
    "https://www.google.com/maps/search/?api=1&query=%E5%8F%B0%E5%8C%97%E5%B8%82%E8%90%AC%E8%8F%AF%E5%8D%80%E8%A5%BF%E6%98%8C%E8%A1%97+52+%E8%99%9F",
};

const DISCLAIMER = {
  price:
    "※ 不同通路因服務內容／搭配方案不同，價格可能略有差異🙂\n※ 到店另有不定期活動或搭配方案，依現場為準。",
  info:
    "※ 產品資訊以實際包裝標示為準（不同批次可能略有差異）。",
  general:
    "※ 以下為一般飲食搭配/料理分享，不屬於醫療建議；若有孕哺、慢性病、正在用藥或特殊體質，建議先詢問專業人員。",
};

/* =========================
   products.json (cache)
========================= */

let cache = { at: 0, data: null };

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    lib
      .get(url, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

async function getProducts() {
  const ttl = 5 * 60 * 1000;
  if (Date.now() - cache.at < ttl && cache.data) return cache.data;
  try {
    const data = await fetchJson(PRODUCTS_ENDPOINT);
    cache = { at: Date.now(), data };
    return data;
  } catch (e) {
    console.error("[products] fetch failed:", e?.message || e);
    return { categories: [] };
  }
}

function flattenProducts(data) {
  const list = [];
  for (const c of data.categories || []) {
    for (const i of c.items || []) list.push(i);
  }
  return list;
}

/* =========================
   helpers
========================= */

function safeText(s, max) {
  const t = String(s || "");
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

function normalizeText(s) {
  return String(s || "")
    .replace(/\u3000/g, " ")
    .replace(/[，,、/／]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function money(n) {
  const x = Math.round(Number(n) || 0);
  return "$" + String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function calcDiscount(msrp, d) {
  const m = Number(msrp);
  const dis = Number(d);
  if (!Number.isFinite(m) || !Number.isFinite(dis) || dis <= 0) return null;
  return Math.round(m * dis);
}

function matchProduct(flat, name) {
  const n = normalizeText(name);
  if (!n) return null;
  return (
    flat.find((x) => n === x.name) ||
    flat.find((x) => n.includes(x.name) || x.name.includes(n)) ||
    null
  );
}

/* =========================
   cards: main / more / food
========================= */

function mainMenuCard() {
  return {
    type: "template",
    altText: "主選單",
    template: {
      type: "buttons",
      title: STORE.brandName,
      text: "想先看哪個？直接點就好🙂",
      actions: [
        { type: "message", label: "產品介紹", text: "產品介紹" },
        { type: "message", label: "看價格", text: "看價格" },
        { type: "message", label: "飲食專區", text: "飲食專區" },
        { type: "message", label: "怎麼購買", text: "怎麼購買" },
      ],
    },
  };
}

function moreMenuCard() {
  return {
    type: "template",
    altText: "更多",
    template: {
      type: "buttons",
      title: "更多",
      text: "也可以看門市／官網🙂",
      actions: [
        { type: "message", label: "門市資訊", text: "門市資訊" },
        { type: "uri", label: "官網", uri: STORE.website },
        { type: "uri", label: "一鍵來電", uri: `tel:${STORE.phoneTel}` },
        { type: "uri", label: "地圖", uri: STORE.mapUrl },
      ],
    },
  };
}

function menuBundle() {
  return [mainMenuCard(), moreMenuCard()];
}

function foodMenuCard() {
  return {
    type: "template",
    altText: "飲食專區",
    template: {
      type: "buttons",
      title: "飲食專區",
      text: "更多搭配與建議🙂",
      actions: [
        { type: "message", label: "補養建議（綜合版）", text: "補養建議" },
        { type: "message", label: "季節推薦", text: "季節推薦" },
        { type: "message", label: "燉煮建議", text: "燉煮建議" },
        { type: "message", label: "常見問題", text: "FAQ" },
      ],
    },
  };
}

function storeCard() {
  return {
    type: "template",
    altText: "門市資訊",
    template: {
      type: "buttons",
      title: "門市資訊",
      text: `${STORE.address}\n${STORE.phoneDisplay}`,
      actions: [
        { type: "uri", label: "地圖", uri: STORE.mapUrl },
        { type: "uri", label: "一鍵來電", uri: `tel:${STORE.phoneTel}` },
        { type: "uri", label: "官網", uri: STORE.website },
        { type: "message", label: "回主選單", text: "選單" },
      ],
    },
  };
}

/* =========================
   products cards
========================= */

async function productCarousel() {
  const data = await getProducts();
  const flat = flattenProducts(data);

  const columns = flat.slice(0, 10).map((p) => ({
    title: safeText(p.name, 40),
    text: safeText((p.intro && p.intro[0]) || "點擊查看介紹", 60),
    actions: [
      { type: "message", label: "看介紹", text: `介紹 ${p.name}` },
      { type: "message", label: "看價格", text: `價格 ${p.name}` },
      { type: "message", label: "我要購買", text: `購買 ${p.name}` },
    ],
  }));

  return {
    type: "template",
    altText: "產品介紹",
    template: { type: "carousel", columns },
  };
}

function productIntroText(p) {
  if (!p) return "找不到產品🙂";

  const lines = [`【${p.name}】`];

  // intro
  for (const x of p.intro || []) lines.push(`• ${x}`);

  // spec
  if (p.variants && p.variants.length) {
    lines.push("", "規格：");
    for (const v of p.variants) {
      const part = [v.label, v.spec ? `（${v.spec}）` : "", v.note ? `｜${v.note}` : ""]
        .filter(Boolean)
        .join("");
      lines.push(`• ${part}`);
    }
  } else {
    lines.push("", `規格：${p.spec || "—"}`);
  }

  // ingredients
  if (p.ingredients && p.ingredients.length) {
    lines.push("", "成分：");
    for (const x of p.ingredients) lines.push(`• ${x}`);
  }

  // usage
  if (p.usage && p.usage.length) {
    lines.push("", "食用建議：");
    for (const x of p.usage) lines.push(`• ${x}`);
  }

  lines.push("", DISCLAIMER.info);
  return lines.join("\n");
}

function productActionCard(name) {
  return {
    type: "template",
    altText: "產品選單",
    template: {
      type: "buttons",
      title: safeText(name, 40),
      text: "接下來想看什麼？🙂",
      actions: [
        { type: "message", label: "看價格", text: `價格 ${name}` },
        { type: "message", label: "我要購買", text: `購買 ${name}` },
        { type: "message", label: "其他產品", text: "產品介紹" },
        { type: "message", label: "回主選單", text: "選單" },
      ],
    },
  };
}

async function priceCarouselAll() {
  const data = await getProducts();
  const flat = flattenProducts(data);
  const cols = [];

  for (const p of flat) {
    if (p.variants && p.variants.length) {
      for (const v of p.variants) {
        const msrp = Number(v.msrp);
        const act = calcDiscount(msrp, v.discount);
        const text = [
          v.label,
          `建議售價：${money(msrp)}`,
          act ? `活動價：${money(act)}（9折）` : "",
        ]
          .filter(Boolean)
          .join("\n");

        cols.push({
          title: safeText(p.name, 40),
          text: safeText(text, 60),
          actions: [
            { type: "message", label: "我要購買", text: `購買 ${p.name}` },
            { type: "message", label: "回主選單", text: "選單" },
          ],
        });
      }
    } else {
      const msrp = Number(p.msrp);
      const act = calcDiscount(msrp, p.discount);
      const text = [
        `建議售價：${money(msrp)}`,
        act ? `活動價：${money(act)}（9折）` : "",
      ]
        .filter(Boolean)
        .join("\n");

      cols.push({
        title: safeText(p.name, 40),
        text: safeText(text, 60),
        actions: [
          { type: "message", label: "我要購買", text: `購買 ${p.name}` },
          { type: "message", label: "回主選單", text: "選單" },
        ],
      });
    }
  }

  return {
    type: "template",
    altText: "產品價格",
    template: { type: "carousel", columns: cols.slice(0, 10) },
  };
}

async function priceForProduct(name) {
  const data = await getProducts();
  const flat = flattenProducts(data);
  const p = matchProduct(flat, name);
  if (!p) return [{ type: "text", text: "找不到這個品項🙂" }];

  // variants -> carousel
  if (p.variants && p.variants.length) {
    const columns = p.variants.slice(0, 10).map((v) => {
      const msrp = Number(v.msrp);
      const act = calcDiscount(msrp, v.discount);
      const text = [
        v.label,
        `建議售價：${money(msrp)}`,
        act ? `活動價：${money(act)}（9折）` : "",
        v.note ? `備註：${v.note}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      return {
        title: safeText(p.name, 40),
        text: safeText(text, 60),
        actions: [
          { type: "message", label: "我要購買", text: `購買 ${p.name}` },
          { type: "message", label: "回主選單", text: "選單" },
        ],
      };
    });

    return [
      {
        type: "template",
        altText: `${p.name} 價格`,
        template: { type: "carousel", columns },
      },
      { type: "text", text: DISCLAIMER.price },
    ];
  }

  const msrp = Number(p.msrp);
  const act = calcDiscount(msrp, p.discount);
  const text = [
    `【${p.name}｜價格】`,
    `建議售價：${money(msrp)}`,
    act ? `活動價：${money(act)}（9折）` : "",
    "",
    DISCLAIMER.price,
  ]
    .filter(Boolean)
    .join("\n");

  return [{ type: "text", text }, productActionCard(p.name)];
}

/* =========================
   buying (simple, no data storage)
========================= */

function buyMethodCard(productName) {
  const title = productName ? `購買｜${safeText(productName, 30)}` : "怎麼購買";
  const text = productName
    ? `好的🙂【${productName}】\n選一種方式，我再引導你填資料～`
    : "選一種方式，我再引導你填資料～";

  return {
    type: "template",
    altText: "怎麼購買",
    template: {
      type: "buttons",
      title,
      text,
      actions: [
        { type: "message", label: "宅配", text: `購買方式 宅配 ${productName || ""}`.trim() },
        { type: "message", label: "超商店到店", text: `購買方式 店到店 ${productName || ""}`.trim() },
        { type: "message", label: "雙北親送", text: `購買方式 雙北親送 ${productName || ""}`.trim() },
        { type: "message", label: "到店自取", text: `購買方式 自取 ${productName || ""}`.trim() },
      ],
    },
  };
}

function buyGuideText(method, productName) {
  const p = productName ? `【${productName}】\n` : "";
  if (method === "宅配") {
    return [
      `好的🙂\n${p}【宅配】`,
      "請直接貼：",
      "1) 品項＋數量",
      "2) 收件姓名＋電話",
      "3) 地址",
      "",
      "我收到後會跟你確認金額與出貨安排。",
    ].join("\n");
  }
  if (method === "店到店") {
    return [
      `好的🙂\n${p}【超商店到店】`,
      "請直接貼：",
      "1) 品項＋數量",
      "2) 收件姓名＋電話",
      "3) 取貨門市（店名/店號/地址）",
      "",
      "我收到後會跟你確認金額與出貨安排。",
    ].join("\n");
  }
  if (method === "雙北親送") {
    return [
      `好的🙂\n${p}【雙北親送】`,
      "（視路線/時間可安排；若不便親送會改以宅配或店到店協助）",
      "",
      "請直接貼：",
      "1) 品項＋數量",
      "2) 收件姓名＋電話",
      "3) 地址（台北/新北）",
      "",
      "我收到後會跟你確認金額與出貨安排。",
    ].join("\n");
  }

  return [
    `好的🙂\n${p}【到店自取】`,
    "請直接貼：",
    "1) 品項＋數量",
    "2) 聯絡姓名＋電話",
    "（方便保留並確認取貨時間）",
    "",
    "我收到後會跟你確認金額與保留安排。",
  ].join("\n");
}

/* =========================
   food content (no medical consult)
========================= */

function nourishCarousel() {
  return {
    type: "template",
    altText: "補養建議",
    template: {
      type: "carousel",
      columns: [
        {
          title: "日常版",
          text: "穩穩補、好持續（不追求很猛）",
          actions: [
            { type: "message", label: "看內容", text: "補養 日常" },
            { type: "message", label: "回飲食專區", text: "飲食專區" },
          ],
        },
        {
          title: "加強版",
          text: "想提高補養密度、分早晚安排",
          actions: [
            { type: "message", label: "看內容", text: "補養 加強" },
            { type: "message", label: "回飲食專區", text: "飲食專區" },
          ],
        },
        {
          title: "忙碌族",
          text: "重視方便、好攜帶、好記",
          actions: [
            { type: "message", label: "看內容", text: "補養 忙碌族" },
            { type: "message", label: "回飲食專區", text: "飲食專區" },
          ],
        },
        {
          title: "長輩版",
          text: "溫和、好入口、固定一天一次",
          actions: [
            { type: "message", label: "看內容", text: "補養 長輩" },
            { type: "message", label: "回飲食專區", text: "飲食專區" },
          ],
        },
      ],
    },
  };
}

function nourishText(kind) {
  const k = String(kind || "");
  const head = `【補養建議｜${k}】`;

  const common = ["", DISCLAIMER.general];

  if (k.includes("日常")) {
    return [
      head,
      "• 目標：穩穩補、好持續",
      "• 建議：以『龜鹿飲』或『龜鹿膏』擇一為主（看習慣）",
      "• 節奏：固定一天一次；早/晚都可以",
      "• 搭配：溫水、溫豆漿、溫牛奶/燕麥奶（依個人口味）",
      "• 小提醒：少配冰飲；晚間怕太飽可少量",
      ...common,
    ].join("\n");
  }

  if (k.includes("加強")) {
    return [
      head,
      "• 目標：想更有感、想拉高密度（但仍以日常飲食為主）",
      "• 建議：『龜鹿飲』＋『龜鹿膏』分早晚或分時段",
      "• 有煮湯習慣：可加入『龜鹿湯塊（膠）』做燉煮",
      "• 節奏：先從少量/低頻開始，覺得OK再加",
      "• 搭配：雞湯/排骨湯/牛腱湯/山藥湯，或粥品",
      ...common,
    ].join("\n");
  }

  if (k.includes("忙碌")) {
    return [
      head,
      "• 目標：省時間、好攜帶、規律補",
      "• 建議：以『龜鹿飲』為主；想更扎實再加『龜鹿膏』",
      "• 節奏：出門前/下午小空檔/運動後，都能安排",
      "• 搭配：溫水、溫茶、溫豆漿；忙的時候先求規律",
      ...common,
    ].join("\n");
  }

  // 長輩
  return [
    head,
    "• 目標：溫和、好入口、好記",
    "• 建議：『龜鹿膏』小匙或『龜鹿飲』即飲",
    "• 節奏：固定一天一次即可；想加強再視狀況",
    "• 搭配：溫水、溫牛奶、溫豆漿；避免太冰",
    "• 小提醒：腸胃較敏感者先少量",
    ...common,
  ].join("\n");
}

function seasonCarousel() {
  return {
    type: "template",
    altText: "季節推薦",
    template: {
      type: "carousel",
      columns: [
        {
          title: "春季",
          text: "換季不穩定：溫和、好持續",
          actions: [
            { type: "message", label: "看推薦", text: "季節 春" },
            { type: "message", label: "回飲食專區", text: "飲食專區" },
          ],
        },
        {
          title: "夏季",
          text: "偏燥熱：清爽但仍建議溫食",
          actions: [
            { type: "message", label: "看推薦", text: "季節 夏" },
            { type: "message", label: "回飲食專區", text: "飲食專區" },
          ],
        },
        {
          title: "秋季",
          text: "天氣轉涼：適合逐步調整",
          actions: [
            { type: "message", label: "看推薦", text: "季節 秋" },
            { type: "message", label: "回飲食專區", text: "飲食專區" },
          ],
        },
        {
          title: "冬季",
          text: "想喝熱湯：燉煮/火鍋都好搭",
          actions: [
            { type: "message", label: "看推薦", text: "季節 冬" },
            { type: "message", label: "回飲食專區", text: "飲食專區" },
          ],
        },
      ],
    },
  };
}

function seasonText(season) {
  const s = String(season || "");

  const map = {
    春: {
      title: "春季",
      tips: [
        "• 節奏：先求『穩』，固定每天/隔天都行",
        "• 推薦搭配：龜鹿飲（方便）、龜鹿膏（溫潤）",
        "• 料理：清雞湯、山藥雞湯、蔬菜排骨湯",
      ],
      products: ["龜鹿飲", "龜鹿膏"],
    },
    夏: {
      title: "夏季",
      tips: [
        "• 節奏：避免太燥熱、以『溫食』為主",
        "• 推薦搭配：龜鹿飲（溫溫喝）、鹿茸粉少量入飲品",
        "• 料理：絲瓜排骨湯、冬瓜雞湯、菇類清湯",
      ],
      products: ["龜鹿飲", "鹿茸粉"],
    },
    秋: {
      title: "秋季",
      tips: [
        "• 節奏：天氣轉涼，適合逐步加回熱湯",
        "• 推薦搭配：龜鹿膏＋龜鹿飲分時段",
        "• 料理：山藥排骨、牛蒡雞湯、南瓜濃湯（偏溫）",
      ],
      products: ["龜鹿膏", "龜鹿飲"],
    },
    冬: {
      title: "冬季",
      tips: [
        "• 節奏：偏向熱湯、慢火燉煮",
        "• 推薦搭配：龜鹿湯塊（膠）做燉湯；日常可加龜鹿膏/飲",
        "• 料理：麻油雞/薑母鴨風味（依口味）、牛腱湯、羊肉爐（清爽版）",
      ],
      products: ["龜鹿湯塊（膠）", "龜鹿膏", "龜鹿飲"],
    },
  };

  const key = s.includes("春") ? "春" : s.includes("夏") ? "夏" : s.includes("秋") ? "秋" : "冬";
  const d = map[key];

  return [
    `【季節推薦｜${d.title}】`,
    ...d.tips,
    "",
    `可先看價格：${d.products.join(" / ")}`,
    "（回：看價格 或 點選產品卡）",
    "",
    DISCLAIMER.general,
  ].join("\n");
}

function cookCarousel() {
  const cols = [
    { title: "經典雞湯", text: "清爽耐喝、適合全家", cmd: "燉煮 雞湯" },
    { title: "排骨燉煮", text: "家常好做、湯頭更厚", cmd: "燉煮 排骨" },
    { title: "牛腱/牛肉", text: "濃郁口感、搭根莖類", cmd: "燉煮 牛肉" },
    { title: "山藥/菇類", text: "滑順口感、日常好搭", cmd: "燉煮 山藥" },
    { title: "素食清湯", text: "菇類＋蔬菜的清爽版", cmd: "燉煮 素食" },
    { title: "電鍋懶人", text: "材料丟進去就好", cmd: "燉煮 電鍋" },
    { title: "火鍋加湯", text: "當高湯/加湯底都可", cmd: "燉煮 火鍋" },
    { title: "粥品/麵線", text: "想吃清淡時很方便", cmd: "燉煮 粥麵" },
  ];

  return {
    type: "template",
    altText: "燉煮建議",
    template: {
      type: "carousel",
      columns: cols.slice(0, 10).map((x) => ({
        title: x.title,
        text: x.text,
        actions: [
          { type: "message", label: "看作法", text: x.cmd },
          { type: "message", label: "回飲食專區", text: "飲食專區" },
        ],
      })),
    },
  };
}

function cookText(kind) {
  const k = String(kind || "");

  const base = [
    "※ 以一般料理分享為主（非醫療建議）",
    "※ 若使用龜鹿湯塊（膠）：建議起鍋前 10–15 分鐘再放，避免久滾太黏或流失風味。",
  ];

  if (k.includes("雞湯")) {
    return [
      "【燉煮建議｜經典雞湯】",
      "1) 雞腿/雞骨汆燙→洗淨",
      "2) 加薑片、蔥段、紅棗/枸杞（可選）",
      "3) 小火炖 60–90 分鐘",
      "4) 起鍋前加入龜鹿湯塊（膠）拌勻，試味後再鹽調味",
      "",
      "可加料：玉米、白蘿蔔、香菇、山藥、蓮子",
      ...base,
    ].join("\n");
  }

  if (k.includes("排骨")) {
    return [
      "【燉煮建議｜排骨燉煮】",
      "1) 排骨汆燙→洗淨",
      "2) 可搭：白蘿蔔/玉米/紅蘿蔔/海帶芽",
      "3) 小火炖 60 分鐘以上",
      "4) 起鍋前加入龜鹿湯塊（膠）拌勻，再調味",
      "",
      "想更香：少量胡椒、薑片即可",
      ...base,
    ].join("\n");
  }

  if (k.includes("牛肉")) {
    return [
      "【燉煮建議｜牛腱/牛肉】",
      "1) 牛腱/牛肉汆燙→洗淨",
      "2) 加洋蔥、番茄、胡蘿蔔（或牛蒡）增甜",
      "3) 小火炖 90–120 分鐘",
      "4) 起鍋前加入龜鹿湯塊（膠），拌匀後再調味",
      "",
      "可搭配：麵/冬粉/燙青菜",
      ...base,
    ].join("\n");
  }

  if (k.includes("山藥")) {
    return [
      "【燉煮建議｜山藥/菇類】",
      "1) 雞/排骨/素高湯皆可",
      "2) 山藥、香菇、杏鮑菇、金針菇依序下鍋",
      "3) 小火 30–45 分鐘",
      "4) 起鍋前加入龜鹿湯塊（膠），拌勻後調味",
      "",
      "想更清爽：加少量鹽、白胡椒即可",
      ...base,
    ].join("\n");
  }

  if (k.includes("素食")) {
    return [
      "【燉煮建議｜素食清湯】",
      "1) 乾香菇泡發，泡菇水可作湯底",
      "2) 加玉米、白蘿蔔、紅蘿蔔、昆布（可選）",
      "3) 小火 40–60 分鐘",
      "4) 起鍋前加入龜鹿湯塊（膠）拌匀，再調味",
      "",
      "小技巧：少量鹽＋香油/麻油（依口味）",
      ...base,
    ].join("\n");
  }

  if (k.includes("電鍋")) {
    return [
      "【燉煮建議｜電鍋懶人版】",
      "1) 材料（雞/排骨/蔬菜）放內鍋",
      "2) 內鍋加水到淹過材料",
      "3) 外鍋加 1–1.5 杯水（依份量）→跳起後再焖 10 分鐘",
      "4) 起鍋前加入龜鹿湯塊（膠）拌勻，再調味",
      "",
      "懶人搭配：玉米＋香菇、白蘿蔔＋排骨、山藥＋雞",
      ...base,
    ].join("\n");
  }

  if (k.includes("火鍋")) {
    return [
      "【燉煮建議｜火鍋加湯】",
      "• 可把龜鹿湯塊（膠）當作『加湯底』：",
      "1) 先用清湯/昆布湯煮滾",
      "2) 起鍋前/加湯時加入少量龜鹿湯塊拌匀",
      "3) 再依口味加鹽或醬油少許",
      "",
      "搭配：菇類、蔬菜、豆腐、肉片都OK",
      ...base,
    ].join("\n");
  }

  // 粥麵
  return [
    "【燉煮建議｜粥品/麵線】",
    "• 清淡想吃熱熱的：",
    "1) 白粥/粥底煮到順口",
    "2) 可加雞絲、香菇、青菜",
    "3) 起鍋前加入少量龜鹿湯塊（膠）拌匀",
    "",
    "小提醒：先少量試味道，喜歡再加",
    ...base,
  ].join("\n");
}

function faqText() {
  return [
    "【常見問題 FAQ】",
    "Q1：可以天天吃嗎？\nA：可作為日常飲食搭配，建議從少量開始、看自己習慣。",
    "",
    "Q2：怎麼保存？\nA：請以外包裝/瓶身標示為準；開封後依指示保存。",
    "",
    "Q3：什麼時候吃比較好？\nA：早/晚皆可，建議固定一個時段更好持續。",
    "",
    "Q4：誰比較需要注意？\nA：孕哺、慢性病、正在用藥或特殊體質者，建議先詢問專業人員。",
    "",
    DISCLAIMER.general,
  ].join("\n");
}

/* =========================
   router
========================= */

async function handleText(text) {
  const t = normalizeText(text);

  if (!t || t === "選單" || t === "主選單" || t === "0") {
    return menuBundle();
  }

  if (t === "產品介紹") {
    return [await productCarousel(), ...menuBundle()];
  }

  if (t === "看價格") {
    return [await priceCarouselAll(), { type: "text", text: DISCLAIMER.price }, ...menuBundle()];
  }

  if (t === "門市資訊") {
    return [storeCard(), ...menuBundle()];
  }

  if (t === "怎麼購買") {
    return [
      { type: "text", text: "你可以先點『產品介紹』選品，或直接輸入：購買 龜鹿膏\n（例如：購買 龜鹿湯塊（膠））🙂" },
      ...menuBundle(),
    ];
  }

  if (t === "飲食專區") {
    return [foodMenuCard(), { type: "text", text: DISCLAIMER.general }, ...menuBundle()];
  }

  if (t === "補養建議") {
    return [nourishCarousel(), ...menuBundle()];
  }

  if (t.startsWith("補養 ")) {
    const kind = t.replace("補養 ", "").trim();
    return [{ type: "text", text: nourishText(kind) }, ...menuBundle()];
  }

  if (t === "季節推薦") {
    return [seasonCarousel(), ...menuBundle()];
  }

  if (t.startsWith("季節 ")) {
    const s = t.replace("季節 ", "").trim();
    return [{ type: "text", text: seasonText(s) }, ...menuBundle()];
  }

  if (t === "燉煮建議") {
    return [cookCarousel(), ...menuBundle()];
  }

  if (t.startsWith("燉煮 ")) {
    const kind = t.replace("燉煮 ", "").trim();
    return [{ type: "text", text: cookText(kind) }, ...menuBundle()];
  }

  if (t === "FAQ" || t === "常見問題") {
    return [{ type: "text", text: faqText() }, ...menuBundle()];
  }

  if (t.startsWith("介紹 ")) {
    const name = t.replace("介紹 ", "").trim();
    const data = await getProducts();
    const flat = flattenProducts(data);
    const p = matchProduct(flat, name);
    if (!p) return [{ type: "text", text: "找不到這個品項🙂" }, ...menuBundle()];
    return [{ type: "text", text: productIntroText(p) }, productActionCard(p.name)];
  }

  if (t.startsWith("價格 ")) {
    const name = t.replace("價格 ", "").trim();
    const msgs = await priceForProduct(name);
    return [...msgs, ...menuBundle()];
  }

  if (t.startsWith("購買方式 ")) {
    // 格式：購買方式 宅配 龜鹿膏
    const rest = t.replace("購買方式 ", "").trim();
    const parts = rest.split(" ").filter(Boolean);
    const method = parts.shift() || "";
    const productName = parts.join(" ").trim() || null;

    const methodMap = {
      宅配: "宅配",
      店到店: "店到店",
      "雙北親送": "雙北親送",
      自取: "自取",
    };

    const m = methodMap[method] || method;
    return [{ type: "text", text: buyGuideText(m, productName) }, ...menuBundle()];
  }

  if (t.startsWith("購買 ")) {
    const name = t.replace("購買 ", "").trim();
    return [buyMethodCard(name), ...menuBundle()];
  }

  return [{ type: "text", text: "我有收到🙂 你可以點『選單』開始～" }, ...menuBundle()];
}

/* =========================
   server
========================= */

const app = express();

app.get("/", (req, res) => res.status(200).send("ok"));
app.get("/health", (req, res) => res.status(200).send("ok"));

app.post(
  "/webhook",
  (req, res, next) => {
    if (!config.channelAccessToken || !config.channelSecret) {
      return res.status(500).send("LINE credentials missing");
    }
    return line.middleware(config)(req, res, next);
  },
  async (req, res) => {
    try {
      const events = req.body.events || [];
      await Promise.all(
        events.map(async (event) => {
          if (event.type !== "message") return;
          if (!event.message || event.message.type !== "text") return;
          const msgs = await handleText(event.message.text);
          return client.replyMessage(event.replyToken, msgs);
        })
      );
      res.sendStatus(200);
    } catch (e) {
      console.error("webhook error:", e?.message || e);
      res.sendStatus(500);
    }
  }
);

app.listen(PORT || 3000, "0.0.0.0", () => {
  console.log("LINE Bot Running");
  console.log("PRODUCTS_URL:", PRODUCTS_ENDPOINT);
});
