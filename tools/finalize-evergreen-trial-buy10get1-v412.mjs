import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const files = ['server.js','test.js','function.test.js','catalog.test.js','security.test.js','README.md','package.json','line-sales-master.json'];
const replacements = [
  ['買10送2（共12罐500元）','買10送1（共11罐500元）'],
  ['買10送2（共12包2,000元）','買10送1（共11包2,000元）'],
  ['買10送2，共12罐500元','買10送1，共11罐500元'],
  ['買10送2，共12包2,000元','買10送1，共11包2,000元'],
  ['買10送2', '買10送1'],
  ['共12罐500元','共11罐500元'],
  ['共12包2,000元','共11包2,000元'],
  ['12罐優惠組500元','11罐優惠組500元'],
  ['12包優惠組2,000元','11包優惠組2,000元'],
  ['qty: 12, total: 500', 'qty: 11, total: 500'],
  ['qty: 12, total: 2000', 'qty: 11, total: 2000'],
  ['[1, 3, 5, 12]', '[1, 3, 5, 11]'],
  ['calcItem(drink30, 12)', 'calcItem(drink30, 11)'],
  ['calcItem(drink30, 24)', 'calcItem(drink30, 22)'],
  ['addCart(state, drink30, 12)', 'addCart(state, drink30, 11)'],
  ['state.cart[0].qty, 13', 'state.cart[0].qty, 12'],
  ['cartTotal(state.cart), 550', 'cartTotal(state.cart), 550'],
  ['買10送2×1＋單罐×1', '買10送1×1＋單罐×1'],
  ['買10送2×1', '買10送1×1'],
  ['買10送2×2', '買10送1×2'],
  ['offers.includes(\'買10送2\')', 'offers.includes(\'買10送1\')'],
];

for (const file of files) {
  if (!existsSync(file)) continue;
  let text = readFileSync(file, 'utf8');
  for (const [from,to] of replacements) text = text.split(from).join(to);
  writeFileSync(file, text);
}

const data = JSON.parse(readFileSync('data.json','utf8'));
const byId = new Map((data.products || []).map((item) => [item.id,item]));
const d30 = byId.get('guilu-drink-30');
const d180 = byId.get('guilu-drink-180');
if (!d30 || !d180) throw new Error('缺少龜鹿飲30cc或180cc');
Object.assign(d30, {
  name: '龜鹿飲30cc玻璃罐', displayName: '龜鹿飲30cc玻璃罐',
  size: '30cc／罐（小玻璃罐）', spec: '30cc／罐（小玻璃罐）', specification: '30cc／罐（小玻璃罐）', unit: '罐',
  price: 50, originalPrice: null,
  offers: [{ qty: 11, total: 500, label: '買10送1' }],
  promotionTexts: ['買10送1'], quantityOptions: [1,3,5,11],
  priceText: '$50 / 罐', priceLabel: '售價50元，買10送1（共11罐500元）'
});
Object.assign(d180, {
  price: 200, originalPrice: null,
  offers: [{ qty: 11, total: 2000, label: '買10送1' }],
  promotionTexts: ['買10送1'], quantityOptions: [1,3,5,11],
  priceText: '$200 / 包', priceLabel: '售價200元，買10送1（共11包2,000元）'
});
data.trialCampaign = {
  ...(data.trialCampaign || {}),
  id: 'guilu-drink-30-evergreen-trial', active: true, evergreen: true,
  title: '龜鹿飲30cc試喝組', contents: '30cc小玻璃罐×3罐',
  productFee: 0, productFeeText: '試喝品免費',
  shippingOptions: [{id:'store',label:'7-11店到店',fee:60},{id:'home',label:'郵局宅配',fee:100}],
  limitRule: '每位顧客、聯絡電話及收件地址限申請一次',
  paymentRule: '試喝運費需先確認並完成付款，試喝組不使用貨到付款',
  fulfillmentRule: '資料及運費確認後採接單安排製作，約5～7個工作天出貨；不含例假日及物流配送時間',
  publicPrice: '龜鹿飲30cc售價50元／罐；買10送1，共11罐500元',
  lineOnly: true, lineId: '@762jybnm', lineUrl: data.lineUrl || 'https://lin.ee/sHZW7NkR'
};
writeFileSync('data.json', JSON.stringify(data,null,2)+'\n');

if (existsSync('line-sales-master.json')) {
  const master = JSON.parse(readFileSync('line-sales-master.json','utf8'));
  const m30 = master.products?.['guilu-drink-30'];
  const m180 = master.products?.['guilu-drink-180'];
  if (m30) Object.assign(m30,{name:'龜鹿飲30cc玻璃罐',unit:'罐',price:50,offers:['買10送1'],quantityOptions:[1,3,5,11],offer:{qty:11,total:500,label:'買10送1'}});
  if (m180) Object.assign(m180,{price:200,offers:['買10送1'],quantityOptions:[1,3,5,11],offer:{qty:11,total:2000,label:'買10送1'}});
  master.trialCampaign = data.trialCampaign;
  writeFileSync('line-sales-master.json',JSON.stringify(master,null,2)+'\n');
}

const verification = JSON.stringify(data);
for (const bad of ['買10送2','共12罐500元','共12包2,000元','30cc／瓶（小玻璃瓶）']) {
  if (verification.includes(bad)) throw new Error(`LINE母本仍有舊資料：${bad}`);
}
console.log('PASS LINE OA v412：長期試喝與買10送1正式政策已完成。');
