import { readFileSync, writeFileSync } from 'node:fs';

const dataPath = 'data.json';
const serverPath = 'server.js';
const authority = JSON.parse(readFileSync('assets/data/official-products.json', 'utf8'));
const expectedById = new Map(authority.products.map((item) => [item.id, item]));
const data = JSON.parse(readFileSync(dataPath, 'utf8'));

const DRINK_NOTICE = authority.fulfillmentPolicy?.drinkNotice || '龜鹿飲為接單後安排製作加工；訂單資料與付款方式確認後，製作加工約需5～7個工作天，完成後才安排出貨，物流配送時間另計。';
const STOCK_NOTICE = authority.fulfillmentPolicy?.readyStockNotice || '本產品為預先製作備貨商品；訂單資料與付款方式確認後，依現貨狀況安排出貨，物流配送時間另計。';
const GENERAL_NOTICE = '龜鹿飲30cc與180cc為接單後安排製作加工；龜鹿膏、龜鹿湯塊、龜鹿膠與鹿茸粉為預先製作備貨商品。實際出貨時間依訂單品項與現貨狀況確認，物流配送時間另計。';
const TRIAL_NOTICE = '資料及運費確認後安排製作加工，製作加工約需5～7個工作天；完成後才安排出貨，物流配送時間另計';
const CLEAN_30_IMAGE = expectedById.get('guilu-drink-30')?.image || 'https://ts-line.onrender.com/assets/guilu-drink-30-clean.jpg?v=403.0-20260805-official-original';
const OFFICIAL_30_SOURCE = expectedById.get('guilu-drink-30')?.officialOriginalImage || 'https://ts15825868.github.io/xianjiawei/images/guilu-drink-30cc-glass.jpg?v=412.0';
const DRINK_IDS = new Set(authority.fulfillmentPolicy?.drinkProductIds || ['guilu-drink-30', 'guilu-drink-180']);
const STOCK_IDS = new Set(authority.fulfillmentPolicy?.readyStockProductIds || ['guilu-gao', 'guilu-tangkuai', 'guilu-jiao', 'luerong-fen']);

function getProduct(id) {
  const product = data.products.find((item) => item.id === id);
  if (!product) throw new Error(`找不到產品：${id}`);
  return product;
}

function applyOfficialIdentity(id) {
  const product = getProduct(id);
  const expected = expectedById.get(id);
  if (!expected) throw new Error(`權威檔缺少產品：${id}`);
  const isDrink = DRINK_IDS.has(id);
  product.name = expected.name;
  product.displayName = expected.name;
  product.size = expected.specification;
  product.spec = expected.specification;
  product.specification = expected.specification;
  product.fulfillmentType = isDrink ? 'made-to-order-drink' : 'ready-stock';
  product.fulfillmentNotice = isDrink ? DRINK_NOTICE : STOCK_NOTICE;
  product.productionLeadTime = isDrink ? '5～7個工作天' : null;
  product.readyStock = !isDrink;
  return product;
}

for (const expected of authority.products) applyOfficialIdentity(expected.id);

const drink30 = getProduct('guilu-drink-30');
Object.assign(drink30, {
  unit: '罐',
  description: '30cc小玻璃罐，把龜鹿系列整理成方便即飲的液態型態，適合第一次接觸、外出攜帶與工作空檔安排。',
  usage: ['每日一罐', '開罐即可飲用', '可隔水加熱或溫熱後飲用', '避免冰飲', '開罐後請儘速飲用完畢'],
  storage: ['未開封置於陰涼乾燥處', '避免高溫與日光直射', '開罐後請儘速飲用完畢'],
  fit: '想方便即飲、第一次接觸、外出攜帶或在工作空檔飲用的人',
  purposeDirection: '適合第一次接觸、外出攜帶、工作空檔或偏好小玻璃罐即飲的人。',
  aliases: ['龜鹿飲', '龜鹿飲30cc', '30cc', '玻璃罐', '小玻璃罐', '玻璃瓶'],
  price: 50,
  originalPrice: null,
  offers: [{ qty: 11, total: 500, label: '買10送1' }],
  promotionTexts: ['買10送1'],
  quantityOptions: [1, 3, 5, 11],
  priceText: '$50 / 罐',
  priceLabel: '售價50元，買10送1（共11罐500元）',
  image: CLEAN_30_IMAGE,
  imageUrl: CLEAN_30_IMAGE,
  image_url: CLEAN_30_IMAGE,
  dmImage: CLEAN_30_IMAGE,
  officialOriginalImage: OFFICIAL_30_SOURCE,
  imagePolicy: 'official-original-contain-no-crop',
});

Object.assign(getProduct('guilu-drink-180'), {
  unit: '包',
  price: 200,
  offers: [{ qty: 11, total: 2000, label: '買10送1' }],
  promotionTexts: ['買10送1'],
  quantityOptions: [1, 3, 5, 11],
  priceText: '$200 / 包',
  priceLabel: '售價200元，買10送1（共11包2,000元）',
});
Object.assign(getProduct('guilu-gao'), {
  unit: '罐', price: 1800, originalPrice: 2100,
  priceText: '$1,800 / 罐', originalPriceText: '$2,100',
  priceLabel: '售價2,100元，優惠價1,800元', promotionTexts: ['優惠價1,800元'],
});
Object.assign(getProduct('guilu-tangkuai'), { unit: '盒', price: 1600, priceText: '$1,600 / 盒', priceLabel: '售價1,600元' });
Object.assign(getProduct('luerong-fen'), { unit: '罐', price: 2000, priceText: '$2,000 / 罐', priceLabel: '售價2,000元' });
Object.assign(getProduct('guilu-jiao'), {
  unit: '盒', price: 9600, originalPrice: 12000,
  priceText: '$9,600 / 盒', originalPriceText: '$12,000',
  priceLabel: '售價12,000元，優惠價9,600元', promotionTexts: ['優惠價9,600元'],
});

data.trialCampaign = {
  ...(data.trialCampaign || {}),
  id: 'guilu-drink-30-evergreen-trial',
  active: true,
  evergreen: true,
  title: '龜鹿飲30cc試喝組',
  contents: '30cc小玻璃罐×3罐',
  productFee: 0,
  productFeeText: '試喝品免費',
  shippingOptions: [
    { id: 'store', label: '7-11店到店', fee: 60 },
    { id: 'home', label: '郵局宅配', fee: 100 },
  ],
  limitRule: '每位顧客、聯絡電話及收件地址限申請一次',
  paymentRule: '試喝運費需先確認，以匯款方式完成',
  fulfillmentRule: TRIAL_NOTICE,
  leadTimeDefinition: '製作加工約需5～7個工作天；完成後才安排出貨，物流配送時間另計',
  publicPrice: '龜鹿飲30cc售價50元／罐；買10送1，共11罐500元；另有180cc鋁袋單包200元，買10送1，共11包2,000元',
  lineOnly: true,
  lineId: '@762jybnm',
  lineUrl: data.lineUrl || 'https://lin.ee/sHZW7NkR',
};

data.fulfillmentPolicy = {
  version: authority.fulfillmentPolicy?.version || '2026-08-05-v2',
  drinkProductIds: [...DRINK_IDS],
  readyStockProductIds: [...STOCK_IDS],
  drinkNotice: DRINK_NOTICE,
  readyStockNotice: STOCK_NOTICE,
  generalNotice: GENERAL_NOTICE,
  drink30ImageSource: OFFICIAL_30_SOURCE,
  drink30ImageUrl: CLEAN_30_IMAGE,
  drink30ImagePolicy: 'official-original-contain-no-crop',
};
data.orderNotice = GENERAL_NOTICE;
data.shippingNotes = {
  ...(data.shippingNotes || {}),
  宅配: '龜鹿飲於製作完成後安排宅配；其他產品依現貨狀況安排出貨。物流配送時間另計；試喝組郵局宅配運費100元。',
  '7-11賣貨便': '龜鹿飲於製作完成後安排店到店；其他產品依現貨狀況安排出貨。物流配送時間另計；試喝組7-11店到店運費60元。',
  貨到付款: '正式訂單可由客服確認是否安排貨到付款；試喝組僅收運費並需先確認，不使用貨到付款。',
};
writeFileSync(dataPath, JSON.stringify(data, null, 2) + '\n');

let server = readFileSync(serverPath, 'utf8');
server = server.replace(
  /const ORDER_NOTICE = "[^"]*";/,
  `const ORDER_NOTICE = ${JSON.stringify(GENERAL_NOTICE)};`,
);
server = server
  .replaceAll('龜鹿飲30cc玻璃罐', '龜鹿飲30cc玻璃罐')
  .replaceAll('30cc／罐（小玻璃罐）', '30cc／罐（小玻璃罐）')
  .replaceAll('30cc小玻璃罐', '30cc小玻璃罐');

for (const required of [
  'function trialCampaignReply()',
  'function startTrialCheckout(state, shippingChoice)',
  '{ label: "申請試喝", text: "申請試喝" }',
  'const trialShippingMatch = text.match',
]) {
  if (!server.includes(required)) throw new Error(`server.js缺少已正式內建的試喝功能：${required}`);
}
if (/const ORDER_NOTICE = "訂單資料與付款方式確認後安排製作加工/.test(server)) {
  throw new Error('server.js不得再把龜鹿飲5～7天設為全系列ORDER_NOTICE');
}
writeFileSync(serverPath, server);

for (const product of data.products) {
  const notice = String(product.fulfillmentNotice || '');
  if (DRINK_IDS.has(product.id)) {
    if (!notice.includes('5～7個工作天') || product.readyStock !== false) throw new Error(`${product.id}龜鹿飲交期錯誤`);
  } else if (STOCK_IDS.has(product.id)) {
    if (!notice.includes('預先製作備貨商品') || /5\s*[～~〜－-]\s*7/.test(notice) || product.readyStock !== true) throw new Error(`${product.id}不得套用龜鹿飲交期`);
  }
}

console.log('PASS：龜鹿飲試喝與售價已更新；server全域出貨說明維持龜鹿飲／預先備貨分流。');
