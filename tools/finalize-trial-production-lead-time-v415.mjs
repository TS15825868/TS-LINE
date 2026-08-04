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
];

for (const file of textFiles) {
  if (!existsSync(file)) continue;
  let text = readFileSync(file, 'utf8');
  for (const [from, to] of replacements) text = text.split(from).join(to);
  writeFileSync(file, text);
}

const data = JSON.parse(readFileSync('data.json', 'utf8'));
data.trialCampaign = {
  ...(data.trialCampaign || {}),
  fulfillmentRule: `資料及運費確認後安排製作加工，${finalLeadTime}`,
};
data.shippingNotes = {
  ...(data.shippingNotes || {}),
  宅配: `正式訂單資料與付款方式確認後安排製作加工，${finalLeadTime}；試喝組郵局宅配運費100元。`,
  '7-11賣貨便': `正式訂單資料與付款方式確認後安排製作加工，${finalLeadTime}；試喝組7-11店到店運費60元。`,
};
writeFileSync('data.json', JSON.stringify(data, null, 2) + '\n');

if (existsSync('line-sales-master.json')) {
  const master = JSON.parse(readFileSync('line-sales-master.json', 'utf8'));
  master.trialCampaign = {
    ...(master.trialCampaign || {}),
    fulfillmentRule: `資料及運費確認後安排製作加工，${finalLeadTime}`,
  };
  writeFileSync('line-sales-master.json', JSON.stringify(master, null, 2) + '\n');
}

if (existsSync('diagnostics/line-evergreen-trial-v412.json')) {
  const report = JSON.parse(readFileSync('diagnostics/line-evergreen-trial-v412.json', 'utf8'));
  report.lead_time = '製作加工約需5～7個工作天，完成後才安排出貨';
  report.lead_time_definition = '5～7個工作天僅指製作加工，不含出貨後物流配送時間';
  writeFileSync('diagnostics/line-evergreen-trial-v412.json', JSON.stringify(report, null, 2) + '\n');
}

for (const file of ['data.json', 'line-sales-master.json', 'server.js', 'package.json']) {
  if (!existsSync(file)) continue;
  const text = readFileSync(file, 'utf8');
  if (/約5～7個工作天出貨/.test(text)) throw new Error(`${file} 仍把5～7個工作天寫成出貨天數`);
  if (!text.includes('製作加工約需5～7個工作天') && !text.includes('製作加工約5～7工作天')) {
    throw new Error(`${file} 缺少正式製作加工天數說明`);
  }
}

console.log('PASS：LINE OA已統一為製作加工約需5～7個工作天，完成後才安排出貨。');
