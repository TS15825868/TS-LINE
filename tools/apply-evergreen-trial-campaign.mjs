import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const dataPath = 'data.json';
const serverPath = 'server.js';
const data = JSON.parse(readFileSync(dataPath, 'utf8'));

const drink30 = data.products.find((item) => item.id === 'guilu-drink-30');
if (!drink30) throw new Error('找不到龜鹿飲30cc產品');
Object.assign(drink30, {
  name: '龜鹿飲30cc玻璃罐',
  displayName: '龜鹿飲30cc玻璃罐',
  size: '30cc／罐（小玻璃罐）',
  description: '30cc小玻璃罐，把龜鹿系列整理成方便即飲的液態型態，適合第一次接觸、外出攜帶與工作空檔安排。',
  usage: ['每日一罐','開罐即可飲用','可隔水加熱或溫熱後飲用','避免冰飲','開罐後請儘速飲用完畢'],
  storage: ['未開封置於陰涼乾燥處','避免高溫與日光直射','開罐後請儘速飲用完畢'],
  fit: '想方便即飲、第一次接觸、外出攜帶或在工作空檔飲用的人',
  purposeDirection: '適合第一次接觸、外出攜帶、工作空檔或偏好小玻璃罐即飲的人。',
  aliases: ['龜鹿飲','龜鹿飲30cc','30cc','玻璃罐','小玻璃罐'],
  spec: '30cc／罐（小玻璃罐）',
  specification: '30cc／罐（小玻璃罐）',
  unit: '罐',
  price: 50,
  originalPrice: null,
  offers: [{ qty: 11, total: 500, label: '買10送1' }],
  promotionTexts: ['買10送1'],
  quantityOptions: [1, 3, 5, 11],
  priceText: '$50 / 罐',
  priceLabel: '售價50元，買10送1（共11罐500元）',
});

const drink180 = data.products.find((item) => item.id === 'guilu-drink-180');
if (drink180) Object.assign(drink180, {
  price: 200,
  offers: [{ qty: 11, total: 2000, label: '買10送1' }],
  promotionTexts: ['買10送1'],
  priceText: '$200 / 包',
  priceLabel: '售價200元，買10送1（共11包2,000元）',
});
const gao = data.products.find((item) => item.id === 'guilu-gao');
if (gao) Object.assign(gao, {
  price: 1800,
  originalPrice: 2100,
  priceText: '$1,800 / 罐',
  originalPriceText: '$2,100',
  priceLabel: '售價2,100元，優惠價1,800元',
  promotionTexts: ['優惠價1,800元'],
});
const tangkuai = data.products.find((item) => item.id === 'guilu-tangkuai');
if (tangkuai) Object.assign(tangkuai, { price: 1600, priceText: '$1,600 / 盒', priceLabel: '售價1,600元' });
const fen = data.products.find((item) => item.id === 'luerong-fen');
if (fen) Object.assign(fen, { price: 2000, priceText: '$2,000 / 罐', priceLabel: '售價2,000元' });
const jiao = data.products.find((item) => item.id === 'guilu-jiao');
if (jiao) Object.assign(jiao, {
  price: 9600,
  originalPrice: 12000,
  priceText: '$9,600 / 盒',
  originalPriceText: '$12,000',
  priceLabel: '售價12,000元，優惠價9,600元',
  promotionTexts: ['優惠價9,600元'],
});

data.trialCampaign = {
  id: 'guilu-drink-30-evergreen-trial',
  active: true,
  evergreen: true,
  title: '龜鹿飲30cc試喝組',
  contents: '30cc小玻璃罐×3罐',
  productFee: 0,
  productFeeText: '試喝品免費',
  shippingOptions: [
    { id: 'store', label: '7-11店到店', fee: 60 },
    { id: 'home', label: '郵局宅配', fee: 100 }
  ],
  limitRule: '每位顧客、聯絡電話及收件地址限申請一次',
  paymentRule: '試喝運費需先確認，以匯款方式完成',
  fulfillmentRule: '資料及運費確認後安排製作加工，製作加工約需5～7個工作天；完成後才安排出貨，物流配送時間另計',
  publicPrice: '龜鹿飲30cc售價50元／罐；買10送1，共11罐500元',
  lineOnly: true,
  lineId: '@762jybnm',
  lineUrl: data.lineUrl || 'https://lin.ee/sHZW7NkR',
};

data.shippingNotes = {
  ...(data.shippingNotes || {}),
  宅配: '訂單資料與付款方式確認後安排製作加工，製作加工約需5～7個工作天；完成後才安排出貨，物流配送時間另計；試喝組郵局宅配運費100元。',
  '7-11賣貨便': '訂單資料與付款方式確認後安排製作加工，製作加工約需5～7個工作天；完成後才安排出貨，物流配送時間另計；試喝組7-11店到店運費60元。',
  貨到付款: '正式訂單可由客服確認是否安排貨到付款；試喝組僅收運費並需先確認，不使用貨到付款。',
};
writeFileSync(dataPath, JSON.stringify(data, null, 2) + '\n');

let server = readFileSync(serverPath, 'utf8');
server = server.replace(
  /const ORDER_NOTICE = "[^"]*";/,
  'const ORDER_NOTICE = "訂單資料與付款方式確認後安排製作加工，製作加工約需5～7個工作天；完成後才安排出貨，物流配送時間另計。";',
);
server = server.replace(/30cc玻璃瓶/g, '30cc玻璃罐').replace(/小玻璃瓶/g, '小玻璃罐').replace(/30cc／瓶/g, '30cc／罐');
server = server.replace(/龜鹿飲\.\*30\|30cc\|玻璃瓶/, '龜鹿飲.*30|30cc|玻璃罐|玻璃瓶');

if (!server.includes('{ label: "申請試喝", text: "申請試喝" }')) {
  server = server.replace(
    '  return [\n    { label: "看產品", text: "看產品" },',
    '  return [\n    { label: "申請試喝", text: "申請試喝" },\n    { label: "看產品", text: "看產品" },',
  );
}

const trialFunctions = `
function trialCampaignReply() {
  const trial = DATA.trialCampaign || {};
  return {
    type: "flex",
    altText: trial.title || "龜鹿飲30cc試喝組",
    contents: mascotBubble(
      trial.title || "龜鹿飲30cc試喝組",
      [
        "內容：" + (trial.contents || "30cc小玻璃罐×3罐"),
        trial.productFeeText || "試喝品免費",
        "7-11店到店運費60元",
        "郵局宅配運費100元",
        "",
        trial.limitRule || "每位顧客、聯絡電話及收件地址限申請一次",
        trial.fulfillmentRule || "資料及運費確認後安排製作加工，製作加工約需5～7個工作天；完成後才安排出貨，物流配送時間另計",
        "",
        trial.publicPrice || "正式售價50元／罐；買10送1，共11罐500元",
      ].join("\\n"),
      [
        { label: "7-11運費60元", text: "試喝配送｜7-11" },
        { label: "宅配運費100元", text: "試喝配送｜宅配" },
        { label: "看正式售價", text: "價格方案" },
      ],
      "service"
    ),
  };
}

function startTrialCheckout(state, shippingChoice) {
  const isStore = /7-11/.test(shippingChoice);
  const shipping = isStore ? "7-11賣貨便" : "宅配";
  const fee = isStore ? 60 : 100;
  state.cart = [{
    id: "guilu-drink-30-trial",
    name: "龜鹿飲30cc試喝組（3罐）",
    qty: 1,
    unit: "組",
    total: fee,
    label: "試喝品免費｜" + shipping + "運費" + fee + "元",
    trial: true,
  }];
  state.checkout = {
    step: "name",
    name: "",
    phone: "",
    payment: "匯款",
    shipping,
    address: "",
    trial: true,
    trialFee: fee,
  };
  return flexCard(
    "申請試喝｜第一步",
    "龜鹿飲30cc小玻璃罐×3罐，試喝品免費；本次僅收" + shipping + "運費" + fee + "元。\\n\\n請直接回覆收件人姓名。",
    [{ label: "取消", text: "取消" }]
  );
}
`;
if (!server.includes('function trialCampaignReply()')) {
  server = server.replace('function startCheckout(state) {', trialFunctions + '\nfunction startCheckout(state) {');
}

server = server.replace(
  '    checkout.phone = phone;\n    checkout.step = "payment";',
  '    checkout.phone = phone;\n    if (checkout.trial) {\n      checkout.step = "address";\n      return reply(event.replyToken, flexCard(\n        "第三步｜地址或門市",\n        checkout.shipping === "7-11賣貨便" ? "請回覆7-11門市名稱或門市地址。" : "請回覆完整收件地址。",\n        [{ label: "取消", text: "取消" }]\n      ));\n    }\n    checkout.step = "payment";',
);
server = server.replace(
  '      ...checkout,\n      createdAt: new Date().toISOString(),',
  '      ...checkout,\n      orderType: checkout.trial ? "trial" : "purchase",\n      campaignId: checkout.trial ? "guilu-drink-30-evergreen-trial" : "",\n      createdAt: new Date().toISOString(),',
);

if (!server.includes('const trialShippingMatch = text.match')) {
  server = server.replace(
    '  if (state.checkout) return continueCheckout(event, state, text);',
    '  const trialShippingMatch = text.match(/^試喝配送｜(.+)$/);\n  if (trialShippingMatch) return reply(event.replyToken, startTrialCheckout(state, trialShippingMatch[1]));\n\n  if (/^(申請試喝|我要試喝|試喝|試喝組|龜鹿飲試喝)$/.test(text)) {\n    return reply(event.replyToken, trialCampaignReply());\n  }\n\n  if (state.checkout) return continueCheckout(event, state, text);',
  );
}
server = server.replace(
  'if (/我看了產品整理|幫我比較產品|產品差異|規格比較|想請你幫我比較|哪一種比較適合|適合我的|我目前是/.test(value)) return "recommend";',
  'if (/試喝|體驗龜鹿飲/.test(value)) return "trial";\n  if (/我看了產品整理|幫我比較產品|產品差異|規格比較|想請你幫我比較|哪一種比較適合|適合我的|我目前是/.test(value)) return "recommend";',
);
server = server.replace(
  '  if (websiteIntent === "recommend") return reply(event.replyToken, recommendReply());',
  '  if (websiteIntent === "trial") return reply(event.replyToken, trialCampaignReply());\n  if (websiteIntent === "recommend") return reply(event.replyToken, recommendReply());',
);
writeFileSync(serverPath, server);

for (const file of ['test.js','function.test.js','catalog.test.js','security.test.js','README.md']) {
  if (!existsSync(file)) continue;
  let text = readFileSync(file, 'utf8');
  text = text.replace(/龜鹿飲30cc玻璃罐/g, '龜鹿飲30cc玻璃罐')
    .replace(/30cc／罐（小玻璃罐）/g, '30cc／罐（小玻璃罐）')
    .replace(/小玻璃瓶/g, '小玻璃罐');
  writeFileSync(file, text);
}
console.log('PASS：LINE OA長期試喝、正式售價、5～7個工作天與小玻璃罐名稱已套用。');
