import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const textFiles = [
  'server.js',
  'README.md',
  'package.json',
  'test.js',
  'function.test.js',
  'catalog.test.js',
  'security.test.js',
  'tools/apply-evergreen-trial-campaign.mjs',
  'tools/finalize-evergreen-trial-buy10get1-v412.mjs',
  'diagnostics/line-evergreen-trial-v412.json',
];

const finalLeadTime = '製作加工約需5～7個工作天；完成後才安排出貨，另加物流配送時間';
const replacements = [
  ['資料及運費確認後採接單安排製作，約5～7個工作天出貨；不含例假日及物流配送時間', `資料及運費確認後安排製作加工，${finalLeadTime}`],
  ['資料與運費確認後採接單安排製作，約5～7個工作天出貨；不含例假日及物流配送時間', `資料與運費確認後安排製作加工，${finalLeadTime}`],
  ['正式訂單資料與付款方式確認後採接單安排製作，約5～7個工作天出貨', `正式訂單資料與付款方式確認後安排製作加工，${finalLeadTime}`],
  ['訂單資料與付款方式確認後採接單安排製作，約5～7個工作天出貨；不含例假日及物流配送時間。', `訂單資料與付款方式確認後安排製作加工，${finalLeadTime}。`],
  ['資料及運費確認後約5～7個工作天出貨', `資料及運費確認後安排製作加工，${finalLeadTime}`],
  ['資料與運費確認後約5～7個工作天出貨', `資料與運費確認後安排製作加工，${finalLeadTime}`],
  ['接單後約5～7個工作天出貨', `接單後安排製作加工，${finalLeadTime}`],
  ['接單後5～7工作天', '製作加工約5～7工作天，完成後出貨'],
  ['約5～7個工作天出貨', finalLeadTime],
  ['買10送2（共12罐500元）', '買10送1（共11罐500元）'],
  ['買10送2（共12包2,000元）', '買10送1（共11包2,000元）'],
  ['買10送2，共12罐500元', '買10送1，共11罐500元'],
  ['買10送2，共12包2,000元', '買10送1，共11包2,000元'],
  ['買10送2', '買10送1'],
  ['共12罐500元', '共11罐500元'],
  ['共12包2,000元', '共11包2,000元'],
  ['qty: 12, total: 500', 'qty: 11, total: 500'],
  ['qty: 12, total: 2000', 'qty: 11, total: 2000'],
  ['[1, 3, 5, 12]', '[1, 3, 5, 11]'],
];

for (const file of textFiles) {
  if (!existsSync(file)) continue;
  let text = readFileSync(file, 'utf8');
  for (const [from, to] of replacements) text = text.split(from).join(to);
  writeFileSync(file, text);
}

const data = JSON.parse(readFileSync('data.json', 'utf8'));
const byId = new Map((data.products || []).map((item) => [item.id, item]));
const d30 = byId.get('guilu-drink-30');
const d180 = byId.get('guilu-drink-180');
if (!d30 || !d180) throw new Error('正式產品主檔缺少龜鹿飲30cc或180cc');
Object.assign(d30, {
  name: '龜鹿飲30cc玻璃罐', displayName: '龜鹿飲30cc玻璃罐',
  size: '30cc／罐（小玻璃罐）', spec: '30cc／罐（小玻璃罐）', specification: '30cc／罐（小玻璃罐）', unit: '罐',
  price: 50, offers: [{ qty: 11, total: 500, label: '買10送1' }], promotionTexts: ['買10送1'], quantityOptions: [1, 3, 5, 11],
  priceText: '$50 / 罐', priceLabel: '售價50元，買10送1（共11罐500元）',
});
Object.assign(d180, {
  price: 200, offers: [{ qty: 11, total: 2000, label: '買10送1' }], promotionTexts: ['買10送1'], quantityOptions: [1, 3, 5, 11],
  priceText: '$200 / 包', priceLabel: '售價200元，買10送1（共11包2,000元）',
});
data.trialCampaign = {
  ...(data.trialCampaign || {}),
  contents: '30cc小玻璃罐×3罐',
  fulfillmentRule: `資料及運費確認後安排製作加工，${finalLeadTime}`,
  publicPrice: '龜鹿飲30cc售價50元／罐；買10送1，共11罐500元',
};
data.shippingNotes = {
  ...(data.shippingNotes || {}),
  宅配: `正式訂單資料與付款方式確認後安排製作加工，${finalLeadTime}；試喝組郵局宅配運費100元。`,
  '7-11賣貨便': `正式訂單資料與付款方式確認後安排製作加工，${finalLeadTime}；試喝組7-11店到店運費60元。`,
};
writeFileSync('data.json', JSON.stringify(data, null, 2) + '\n');

if (existsSync('line-sales-master.json')) {
  const master = JSON.parse(readFileSync('line-sales-master.json', 'utf8'));
  const m30 = master.products?.['guilu-drink-30'];
  const m180 = master.products?.['guilu-drink-180'];
  if (m30) Object.assign(m30, { name: '龜鹿飲30cc玻璃罐', unit: '罐', price: 50, offers: ['買10送1'], quantityOptions: [1,3,5,11], offer: { qty: 11, total: 500, label: '買10送1' } });
  if (m180) Object.assign(m180, { price: 200, offers: ['買10送1'], quantityOptions: [1,3,5,11], offer: { qty: 11, total: 2000, label: '買10送1' } });
  master.trialCampaign = {
    ...(master.trialCampaign || {}),
    contents: '30cc小玻璃罐×3罐',
    fulfillmentRule: `資料及運費確認後安排製作加工，${finalLeadTime}`,
    publicPrice: '龜鹿飲30cc售價50元／罐；買10送1，共11罐500元',
  };
  writeFileSync('line-sales-master.json', JSON.stringify(master, null, 2) + '\n');
}

if (existsSync('diagnostics/line-evergreen-trial-v412.json')) {
  const report = JSON.parse(readFileSync('diagnostics/line-evergreen-trial-v412.json', 'utf8'));
  report.drink30 = '50元／罐，買10送1，共11罐500元';
  report.drink180 = '200元／包，買10送1，共11包2,000元';
  report.lead_time = '製作加工約需5～7個工作天，完成後才安排出貨';
  report.lead_time_definition = '5～7個工作天僅指製作加工，不含出貨後物流配送時間';
  writeFileSync('diagnostics/line-evergreen-trial-v412.json', JSON.stringify(report, null, 2) + '\n');
}

for (const file of ['data.json', 'line-sales-master.json', 'server.js', 'package.json', 'tools/apply-evergreen-trial-campaign.mjs']) {
  if (!existsSync(file)) continue;
  const text = readFileSync(file, 'utf8');
  if (/約5～7個工作天出貨/.test(text)) throw new Error(`${file} 仍把5～7個工作天寫成出貨天數`);
  if (text.includes('買10送2') || text.includes('共12罐500元') || text.includes('共12包2,000元')) throw new Error(`${file} 仍含舊買10送2資料`);
}

console.log('PASS：LINE OA已鎖定30cc／180cc買10送1，製作加工約需5～7個工作天，完成後才安排出貨。');
