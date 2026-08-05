import { readFileSync, writeFileSync } from 'node:fs';

const authority = JSON.parse(readFileSync('assets/data/official-products.json', 'utf8'));
const specs = new Map(authority.products.map((item) => [item.id, item.specification]));

const POLICY_VERSION = '2026-08-05-v2';
const DRINK_NOTICE = '龜鹿飲為接單後安排製作加工；訂單資料與付款方式確認後，製作加工約需5～7個工作天，完成後才安排出貨，物流配送時間另計。';
const TRIAL_NOTICE = '資料及運費確認後安排製作加工，製作加工約需5～7個工作天；完成後才安排出貨，物流配送時間另計';
const STOCK_NOTICE = '本產品為預先製作備貨商品；訂單資料與付款方式確認後，依現貨狀況安排出貨，物流配送時間另計。';
const GENERAL_NOTICE = '龜鹿飲30cc與180cc為接單後安排製作加工；龜鹿膏、龜鹿湯塊、龜鹿膠與鹿茸粉為預先製作備貨商品。實際出貨時間依訂單品項與現貨狀況確認，物流配送時間另計。';
const OFFICIAL_DRINK_ORIGINAL = 'https://ts15825868.github.io/xianjiawei/images/guilu-drink-30cc-glass.jpg?v=412.0';
const CLEAN_DRINK_RENDER = 'https://ts-line.onrender.com/assets/guilu-drink-30-clean.jpg?v=403.0-20260805-official-original';

const DRINK_IDS = new Set(['guilu-drink-30', 'guilu-drink-180']);
const STOCK_IDS = new Set(['guilu-gao', 'guilu-tangkuai', 'guilu-jiao', 'luerong-fen']);

function applySpec(product, id) {
  const specification = specs.get(id);
  if (!product || !specification) throw new Error(`缺少正式產品：${id}`);
  const isDrink = DRINK_IDS.has(id);
  product.specification = specification;
  product.size = specification;
  product.spec = specification;
  product.fulfillmentType = isDrink ? 'made-to-order-drink' : 'ready-stock';
  product.fulfillmentNotice = isDrink ? DRINK_NOTICE : STOCK_NOTICE;
  product.productionLeadTime = isDrink ? '5～7個工作天' : null;
  product.readyStock = !isDrink;
}

function normalizeDrink30(product) {
  product.name = '龜鹿飲30cc玻璃罐';
  product.displayName = '龜鹿飲30cc玻璃罐';
  product.unit = '罐';
  product.price = 50;
  product.originalPrice = null;
  product.quantityOptions = [1, 3, 5, 11];
  product.priceText = '$50 / 罐';
  product.priceLabel = '售價50元，買10送1（共11罐500元）';
  product.image = CLEAN_DRINK_RENDER;
  product.imageUrl = CLEAN_DRINK_RENDER;
  product.image_url = CLEAN_DRINK_RENDER;
  product.dmImage = CLEAN_DRINK_RENDER;
  product.officialOriginalImage = OFFICIAL_DRINK_ORIGINAL;
  product.imagePolicy = 'official-original-contain-no-crop';
  if (Array.isArray(product.offers)) {
    product.offers = product.offers.every((item) => typeof item === 'string')
      ? ['買10送1']
      : [{ qty: 11, total: 500, label: '買10送1' }];
  }
}

function normalizeDrink180(product) {
  product.name = '龜鹿飲180cc鋁袋';
  product.displayName = '龜鹿飲180cc鋁袋';
  product.unit = '包';
  product.price = 200;
  product.originalPrice = null;
  product.quantityOptions = [1, 3, 5, 11];
  product.priceText = '$200 / 包';
  product.priceLabel = '售價200元，買10送1（共11包2,000元）';
  if (Array.isArray(product.offers)) {
    product.offers = product.offers.every((item) => typeof item === 'string')
      ? ['買10送1']
      : [{ qty: 11, total: 2000, label: '買10送1' }];
  }
}

function applyProductAuthority(products) {
  for (const item of authority.products) applySpec(products.get(item.id), item.id);
  normalizeDrink30(products.get('guilu-drink-30'));
  normalizeDrink180(products.get('guilu-drink-180'));
}

function fulfillmentPolicy() {
  return {
    version: POLICY_VERSION,
    drinkProductIds: [...DRINK_IDS],
    readyStockProductIds: [...STOCK_IDS],
    drinkNotice: DRINK_NOTICE,
    readyStockNotice: STOCK_NOTICE,
    generalNotice: GENERAL_NOTICE,
    drink30ImageSource: OFFICIAL_DRINK_ORIGINAL,
    drink30ImageUrl: CLEAN_DRINK_RENDER,
    drink30ImagePolicy: 'official-original-contain-no-crop',
  };
}

function normalizeData() {
  const file = 'data.json';
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const products = new Map((data.products || []).map((item) => [item.id, item]));
  applyProductAuthority(products);

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
    paymentRule: '試喝運費需先確認並完成付款，試喝組不使用貨到付款',
    fulfillmentRule: TRIAL_NOTICE,
    leadTimeDefinition: '製作加工約需5～7個工作天；完成後才安排出貨，物流配送時間另計',
    publicPrice: '龜鹿飲30cc售價50元／罐；買10送1，共11罐500元；另有180cc鋁袋單包200元，買10送1，共11包2,000元',
    lineOnly: true,
    lineId: '@762jybnm',
    lineUrl: data.lineUrl || 'https://lin.ee/sHZW7NkR',
  };

  data.fulfillmentPolicy = fulfillmentPolicy();
  data.shippingNotes = {
    ...(data.shippingNotes || {}),
    宅配: '龜鹿飲於製作完成後安排宅配；其他產品依現貨狀況安排出貨。物流配送時間另計。',
    '7-11賣貨便': '龜鹿飲於製作完成後安排店到店；其他產品依現貨狀況安排出貨。物流配送時間另計。',
  };
  data.orderNotice = GENERAL_NOTICE;
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

function normalizeMaster() {
  const file = 'line-sales-master.json';
  const master = JSON.parse(readFileSync(file, 'utf8'));
  const products = master.products || {};
  applyProductAuthority(new Map(Object.entries(products)));

  master.version = '2026-08-05-v15-fulfillment-v2';
  master.trialCampaign = {
    ...(master.trialCampaign || {}),
    id: 'guilu-drink-30-evergreen-trial',
    active: true,
    evergreen: true,
    title: '龜鹿飲30cc試喝組',
    contents: '30cc小玻璃罐×3罐',
    productFee: 0,
    productFeeText: '試喝品免費',
    fulfillmentRule: TRIAL_NOTICE,
    leadTimeDefinition: '製作加工約需5～7個工作天；完成後才安排出貨，物流配送時間另計',
  };
  master.fulfillmentPolicy = fulfillmentPolicy();
  writeFileSync(file, JSON.stringify(master, null, 2) + '\n');
}

function verify() {
  for (const file of ['data.json', 'line-sales-master.json']) {
    const source = JSON.parse(readFileSync(file, 'utf8'));
    const products = Array.isArray(source.products)
      ? Object.fromEntries(source.products.map((item) => [item.id, item]))
      : source.products;
    const drink30 = products?.['guilu-drink-30'];
    if (!drink30 || drink30.specification !== '30cc／罐（小玻璃罐）' || drink30.unit !== '罐') throw new Error(`${file}：30cc名稱、規格或單位錯誤`);
    if (!String(drink30.image || '').includes('/assets/guilu-drink-30-clean.jpg')) throw new Error(`${file}：30cc未使用Render正式原圖端點`);
    if (!String(drink30.officialOriginalImage || '').includes('/images/guilu-drink-30cc-glass.jpg')) throw new Error(`${file}：30cc缺少正式原圖來源`);
    if (drink30.imagePolicy !== 'official-original-contain-no-crop') throw new Error(`${file}：30cc圖片政策錯誤`);

    for (const id of STOCK_IDS) {
      const product = products?.[id];
      const notice = String(product?.fulfillmentNotice || '');
      if (!notice.includes('預先製作備貨商品') || /5\s*[～~〜－-]\s*7/.test(notice) || product?.productionLeadTime !== null || product?.readyStock !== true) {
        throw new Error(`${file}：${id}不得套用龜鹿飲5～7工作天交期`);
      }
    }
    for (const id of DRINK_IDS) {
      const product = products?.[id];
      if (!String(product?.fulfillmentNotice || '').includes('5～7個工作天') || product?.productionLeadTime !== '5～7個工作天' || product?.readyStock !== false) {
        throw new Error(`${file}：${id}缺少龜鹿飲製作交期`);
      }
    }
    if (source.fulfillmentPolicy?.version !== POLICY_VERSION) throw new Error(`${file}：出貨政策版本不是${POLICY_VERSION}`);
  }
}

normalizeData();
normalizeMaster();
verify();
console.log('PASS：出貨政策v2與30cc正式原圖已同步；5～7個工作天只套用龜鹿飲，其他四項為預先製作備貨。');
