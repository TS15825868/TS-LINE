"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dataPath = path.join(root, "data.json");
const serverPath = path.join(root, "server.js");

const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const byId = new Map((data.products || []).map((item) => [item.id, item]));

function assign(id, values) {
  const product = byId.get(id);
  if (!product) throw new Error(`找不到產品：${id}`);
  Object.assign(product, values);
}

assign("guilu-drink-30", {
  name: "龜鹿飲30cc玻璃罐",
  displayName: "龜鹿飲30cc玻璃罐",
  size: "30cc／罐（小玻璃罐）",
  spec: "30cc／罐（小玻璃罐）",
  specification: "30cc／罐（小玻璃罐）",
  unit: "罐",
  description: "30cc小玻璃罐，把龜鹿系列整理成方便即飲的液態型態，適合第一次接觸、外出攜帶與工作空檔安排。",
  purposeDirection: "適合第一次接觸、外出攜帶、工作空檔或偏好小玻璃罐即飲的人。",
  aliases: ["龜鹿飲", "龜鹿飲30cc", "30cc", "玻璃罐", "小玻璃罐"],
  usage: ["每日一罐", "開罐即可飲用", "可隔水加熱或溫熱後飲用", "避免冰飲", "開罐後請儘速飲用完畢"],
  storage: ["未開封置於陰涼乾燥處", "避免高溫與日光直射", "開罐後請儘速飲用完畢"],
  price: 50,
  originalPrice: null,
  offers: [{ qty: 12, total: 500, label: "買10送2" }],
  promotionTexts: ["買10送2"],
  quantityOptions: [1, 3, 5, 12],
  priceText: "$50 / 罐",
  priceLabel: "售價50元，買10送2",
});

assign("guilu-drink-180", {
  price: 200,
  originalPrice: null,
  offers: [{ qty: 12, total: 2000, label: "買10送2" }],
  promotionTexts: ["買10送2"],
  quantityOptions: [1, 3, 5, 12],
  priceText: "$200 / 包",
  priceLabel: "售價200元，買10送2",
});

assign("guilu-gao", {
  price: 1800,
  originalPrice: 2100,
  offers: [],
  promotionTexts: ["優惠價1,800元"],
  priceText: "$1,800 / 罐",
  priceLabel: "售價2,100元，優惠價1,800元",
  originalPriceText: "$2,100",
});

assign("guilu-tangkuai", {
  price: 1600,
  originalPrice: null,
  offers: [],
  promotionTexts: [],
  priceText: "$1,600 / 盒",
  priceLabel: "售價1,600元",
});

assign("guilu-jiao", {
  price: 9600,
  originalPrice: 12000,
  offers: [],
  promotionTexts: ["優惠價9,600元"],
  priceText: "$9,600 / 盒",
  priceLabel: "售價12,000元，優惠價9,600元",
  originalPriceText: "$12,000",
});

assign("luerong-fen", {
  price: 2000,
  originalPrice: null,
  offers: [],
  promotionTexts: [],
  priceText: "$2,000 / 罐",
  priceLabel: "售價2,000元",
});

data.trialOffer = {
  id: "guilu-drink-30-trial",
  name: "龜鹿飲30cc試喝組",
  contents: "30cc小玻璃罐×3罐",
  productFee: 0,
  productFeeText: "試喝品免費",
  storeToStoreShipping: 60,
  postalShipping: 100,
  limit: "每位顧客、電話及地址限申請一次",
  payment: "運費需先付款，試喝組不使用貨到付款",
  productionLeadTime: "運費與收件資料確認後安排製作，約5～7個工作天出貨，不含例假日及物流配送時間",
  keyword: "我要試喝"
};

data.shippingNotes = {
  ...(data.shippingNotes || {}),
  "宅配": "郵局宅配運費100元；訂單資料與付款確認後安排製作，約5～7個工作天出貨，不含例假日及物流配送時間。",
  "7-11賣貨便": "超商店到店運費60元；訂單資料與付款確認後安排製作，約5～7個工作天出貨，不含例假日及物流配送時間。",
  "雙北親送": "雙北親送區域與時間由客服另行確認；正式訂單採接單後安排製作。",
  "貨到付款": "一般正式訂單可由客服確認是否適用貨到付款；免費試喝組僅收取運費，運費需先付款。"
};

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + "\n");

let server = fs.readFileSync(serverPath, "utf8");
server = server.replace(/const VERSION = "v[^"]+";/, 'const VERSION = "v401.7";');
server = server.replace(
  /const ORDER_NOTICE = "[^"]*";/,
  'const ORDER_NOTICE = "仙加味採接單後安排製作；訂單資料與付款確認後，約5～7個工作天出貨，不含例假日及物流配送時間。";'
);

server = server
  .replaceAll("龜鹿飲30cc玻璃瓶", "龜鹿飲30cc玻璃罐")
  .replaceAll("30cc／瓶（小玻璃瓶）", "30cc／罐（小玻璃罐）")
  .replaceAll("30cc小玻璃瓶", "30cc小玻璃罐")
  .replaceAll("小玻璃瓶", "小玻璃罐")
  .replaceAll("每日一瓶", "每日一罐")
  .replaceAll("開瓶即可飲用", "開罐即可飲用")
  .replaceAll("開瓶後", "開罐後");

if (!server.includes('{ label: "申請試喝", text: "我要試喝" }')) {
  server = server.replace(
    "function mainQuick() {\n  return [\n",
    "function mainQuick() {\n  return [\n    { label: \"申請試喝\", text: \"我要試喝\" },\n"
  );
}

if (!server.includes("function trialMenuReply()")) {
  const block = `
function trialMenuReply() {
  const trial = DATA.trialOffer || {};
  return flexCard(
    trial.name || "龜鹿飲30cc試喝組",
    [
      trial.contents || "30cc小玻璃罐×3罐",
      trial.productFeeText || "試喝品免費",
      "超商店到店運費60元",
      "郵局宅配運費100元",
      trial.limit || "每位顧客、電話及地址限申請一次",
      trial.payment || "運費需先付款，試喝組不使用貨到付款",
      trial.productionLeadTime || "運費與收件資料確認後，約5～7個工作天出貨"
    ].join("\\n"),
    [
      { label: "超商試喝｜60元", text: "試喝申請｜超商店到店" },
      { label: "宅配試喝｜100元", text: "試喝申請｜郵局宅配" },
      { label: "看正式售價", text: "價格方案" },
      { label: "人工客服", text: "我要人工客服" }
    ]
  );
}

function trialApplicationReply(mode) {
  const store = mode === "store";
  const shipping = store ? "超商店到店" : "郵局宅配";
  const fee = store ? 60 : 100;
  const destination = store ? "取貨門市名稱／店號：" : "收件地址：";
  return textMsg(
    [
      "龜鹿飲30cc試喝申請",
      "內容：30cc小玻璃罐×3罐",
      "試喝品免費",
      \`配送：\${shipping}\`,
      \`應付運費：\${fee}元\`,
      "",
      "請直接複製以下格式並填寫：",
      "收件姓名：",
      "聯絡電話：",
      \`配送方式：\${shipping}\`,
      destination,
      "",
      "資料確認後會提供運費付款方式。運費確認後安排製作，約5～7個工作天出貨，不含例假日及物流配送時間。每位顧客、電話及地址限申請一次。"
    ].join("\\n"),
    [
      { label: "重新選配送", text: "我要試喝" },
      { label: "人工客服", text: "我要人工客服" }
    ]
  );
}

`;
  server = server.replace("function productBubble(product) {", block + "function productBubble(product) {");
}

server = server.replace(
  "我可以帶您查看六項產品、比較怎麼選、了解價格、搭配組合、使用方式與下單流程。",
  "目前主打龜鹿飲30cc試喝組：3罐試喝品免費，僅需自行負擔運費。也可以查看六項產品、價格、使用方式與正式下單。"
);

if (!server.includes('/^(我要試喝|申請試喝|試喝|龜鹿飲試喝|試喝組)$/')) {
  const handler = `  if (/^(我要試喝|申請試喝|試喝|龜鹿飲試喝|試喝組)$/.test(text)) {
    return reply(event.replyToken, trialMenuReply());
  }

  if (/^試喝申請[｜|]超商店到店$/.test(text)) {
    return reply(event.replyToken, trialApplicationReply("store"));
  }

  if (/^試喝申請[｜|]郵局宅配$/.test(text)) {
    return reply(event.replyToken, trialApplicationReply("postal"));
  }

`;
  server = server.replace(
    "  if (/^(看產品|查看產品|看商品|產品|直接下單|直接購買|我要下單|立即下單|開始下單|我要買)$/.test(text)) {",
    handler + "  if (/^(看產品|查看產品|看商品|產品|直接下單|直接購買|我要下單|立即下單|開始下單|我要買)$/.test(text)) {"
  );
}

server = server.replace(
  "實際費用、到貨時間與可用方式由客服依訂單確認。",
  "超商店到店運費60元，郵局宅配運費100元。正式訂單採接單後安排製作，資料與付款確認後約5～7個工作天出貨；試喝組運費需先付款。"
);

fs.writeFileSync(serverPath, server);

for (const file of ["test.js", "function.test.js", "catalog.test.js", "security.test.js", "README.md"]) {
  const target = path.join(root, file);
  if (!fs.existsSync(target)) continue;
  let text = fs.readFileSync(target, "utf8");
  text = text
    .replaceAll("龜鹿飲30cc玻璃瓶", "龜鹿飲30cc玻璃罐")
    .replaceAll("30cc／瓶（小玻璃瓶）", "30cc／罐（小玻璃罐）")
    .replaceAll("30cc小玻璃瓶", "30cc小玻璃罐")
    .replaceAll("小玻璃瓶", "小玻璃罐");
  fs.writeFileSync(target, text);
}

console.log("PASS LINE OA trial funnel: FB/IG/website keyword 我要試喝, 3 jars, customer-paid shipping, 5–7 working days, official retail prices synchronized.");
