import { readFileSync, writeFileSync } from 'node:fs';

const authority = JSON.parse(readFileSync('assets/data/official-products.json', 'utf8'));
const POLICY_VERSION = authority.fulfillmentPolicy?.version || '2026-08-05-v2';
const DRINK_NOTICE = authority.fulfillmentPolicy?.drinkNotice || '龜鹿飲為接單後安排製作加工；訂單資料與付款方式確認後，製作加工約需5～7個工作天，完成後才安排出貨，物流配送時間另計。';
const STOCK_NOTICE = authority.fulfillmentPolicy?.readyStockNotice || '本產品為預先製作備貨商品；訂單資料與付款方式確認後，依現貨狀況安排出貨，物流配送時間另計。';
const GENERAL_NOTICE = '龜鹿飲30cc與180cc為接單後安排製作加工；龜鹿膏、龜鹿湯塊、龜鹿膠與鹿茸粉為預先製作備貨商品。實際出貨時間依訂單品項與現貨狀況確認，物流配送時間另計。';
const TRIAL_NOTICE = '資料及運費確認後安排製作加工，製作加工約需5～7個工作天；完成後才安排出貨，物流配送時間另計';
const DRINK_IDS = new Set(authority.fulfillmentPolicy?.drinkProductIds || ['guilu-drink-30', 'guilu-drink-180']);
const STOCK_IDS = new Set(authority.fulfillmentPolicy?.readyStockProductIds || ['guilu-gao', 'guilu-tangkuai', 'guilu-jiao', 'luerong-fen']);
const byId = new Map(authority.products.map((item) => [item.id, item]));
const OFFICIAL_DRINK_ORIGINAL = byId.get('guilu-drink-30')?.officialOriginalImage || 'https://ts15825868.github.io/xianjiawei/images/guilu-drink-30cc-glass.jpg?v=412.0';
const CLEAN_DRINK_RENDER = byId.get('guilu-drink-30')?.image || 'https://ts-line.onrender.com/assets/guilu-drink-30-clean.jpg?v=403.0-20260805-official-original';

function mapProducts(source) {
  return Array.isArray(source.products)
    ? new Map(source.products.map((item) => [item.id, item]))
    : new Map(Object.entries(source.products || {}));
}

function applyExactProduct(product, expected) {
  if (!product || !expected) throw new Error(`缺少正式產品：${expected?.id || 'unknown'}`);
  const isDrink = DRINK_IDS.has(expected.id);
  product.name = expected.name;
  if ('displayName' in product || isDrink) product.displayName = expected.name;
  product.specification = expected.specification;
  product.size = expected.specification;
  product.spec = expected.specification;
  product.fulfillmentType = isDrink ? 'made-to-order-drink' : 'ready-stock';
  product.fulfillmentNotice = isDrink ? DRINK_NOTICE : STOCK_NOTICE;
  product.productionLeadTime = isDrink ? '5～7個工作天' : null;
  product.readyStock = !isDrink;

  if (expected.id === 'guilu-drink-30') {
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
  if (expected.id === 'guilu-drink-180') {
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
  if (expected.id === 'guilu-tangkuai' || expected.id === 'guilu-jiao') product.unit = '盒';
  if (expected.id === 'guilu-gao' || expected.id === 'luerong-fen') product.unit = '罐';
}

function policy() {
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

function trialCampaign(current = {}, lineUrl = 'https://lin.ee/sHZW7NkR') {
  return {
    ...current,
    id: 'guilu-drink-30-evergreen-trial',
    active: true,
    evergreen: true,
    title: '龜鹿飲30cc試喝組',
    contents: '30cc小玻璃罐×3罐',
    productFee: 0,
    productFeeText: '試喝品免費',
    shippingOptions: current.shippingOptions || [
      { id: 'store', label: '7-11店到店', fee: 60 },
      { id: 'home', label: '郵局宅配', fee: 100 },
    ],
    limitRule: current.limitRule || '每位顧客、聯絡電話及收件地址限申請一次',
    paymentRule: current.paymentRule || '試喝運費需先確認並完成付款，試喝組不使用貨到付款',
    fulfillmentRule: TRIAL_NOTICE,
    leadTimeDefinition: '製作加工約需5～7個工作天；完成後才安排出貨，物流配送時間另計',
    publicPrice: current.publicPrice || '龜鹿飲30cc售價50元／罐；買10送1，共11罐500元；另有180cc鋁袋單包200元，買10送1，共11包2,000元',
    lineOnly: true,
    lineId: '@762jybnm',
    lineUrl,
  };
}

for (const file of ['data.json', 'line-sales-master.json']) {
  const source = JSON.parse(readFileSync(file, 'utf8'));
  const products = mapProducts(source);
  if (products.size !== 6) throw new Error(`${file}正式產品必須剛好6項，目前${products.size}項`);
  for (const expected of authority.products) applyExactProduct(products.get(expected.id), expected);
  source.fulfillmentPolicy = policy();
  source.trialCampaign = trialCampaign(source.trialCampaign, source.lineUrl || source.trialCampaign?.lineUrl);
  if (file === 'data.json') {
    source.shippingNotes = {
      ...(source.shippingNotes || {}),
      宅配: '龜鹿飲於製作完成後安排宅配；其他產品依現貨狀況安排出貨。物流配送時間另計。',
      '7-11賣貨便': '龜鹿飲於製作完成後安排店到店；其他產品依現貨狀況安排出貨。物流配送時間另計。',
    };
    source.orderNotice = GENERAL_NOTICE;
  } else {
    source.version = '2026-08-05-v15-fulfillment-v2';
  }
  writeFileSync(file, JSON.stringify(source, null, 2) + '\n');
}

for (const file of ['data.json', 'line-sales-master.json']) {
  const source = JSON.parse(readFileSync(file, 'utf8'));
  const products = mapProducts(source);
  for (const expected of authority.products) {
    const product = products.get(expected.id);
    if (!product || product.name !== expected.name || product.specification !== expected.specification) {
      throw new Error(`${file}：${expected.id}名稱或規格未同步`);
    }
    const notice = String(product.fulfillmentNotice || '');
    if (DRINK_IDS.has(expected.id)) {
      if (product.readyStock !== false || product.productionLeadTime !== '5～7個工作天' || !notice.includes('完成後才安排出貨')) throw new Error(`${file}：${expected.id}龜鹿飲交期錯誤`);
    } else if (product.readyStock !== true || product.productionLeadTime !== null || !notice.includes('預先製作備貨商品') || /5\s*[～~〜－-]\s*7/.test(notice)) {
      throw new Error(`${file}：${expected.id}不得套用龜鹿飲交期`);
    }
  }
  const drink30 = products.get('guilu-drink-30');
  if (!String(drink30?.officialOriginalImage || '').includes('/images/guilu-drink-30cc-glass.jpg')) throw new Error(`${file}：30cc正式原圖來源錯誤`);
  if (drink30?.imagePolicy !== 'official-original-contain-no-crop') throw new Error(`${file}：30cc圖片政策錯誤`);
  if (source.fulfillmentPolicy?.version !== POLICY_VERSION) throw new Error(`${file}：出貨政策版本錯誤`);
}

console.log('PASS：LINE OA啟動權威v3已同步六項名稱、規格、30cc正式原圖與產品別出貨政策。');
