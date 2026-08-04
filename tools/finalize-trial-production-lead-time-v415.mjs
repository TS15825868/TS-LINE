import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import './finalize-evergreen-trial-buy10get1-v412.mjs';

const OFFICIAL_FULFILLMENT = '資料及運費確認後安排製作加工，製作加工約需5～7個工作天；完成後才安排出貨，物流配送時間另計';
const LEAD_TIME_DEFINITION = '5～7個工作天僅指製作加工，不包含完成後的物流配送時間';

for (const file of ['data.json', 'line-sales-master.json']) {
  const data = JSON.parse(readFileSync(file, 'utf8'));
  data.trialCampaign = {
    ...(data.trialCampaign || {}),
    contents: '30cc小玻璃罐×3罐',
    fulfillmentRule: OFFICIAL_FULFILLMENT,
    leadTimeDefinition: LEAD_TIME_DEFINITION,
    publicPrice: '龜鹿飲30cc售價50元／罐；買10送1，共11罐500元；另有180cc鋁袋單包200元，買10送1，共11包2,000元',
  };
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

if (existsSync('diagnostics/line-evergreen-trial-v412.json')) {
  const report = JSON.parse(readFileSync('diagnostics/line-evergreen-trial-v412.json', 'utf8'));
  report.drink30 = '50元／罐，買10送1，共11罐500元';
  report.drink180 = '200元／包，買10送1，共11包2,000元';
  report.lead_time = '製作加工約需5～7個工作天，完成後才安排出貨';
  report.lead_time_definition = LEAD_TIME_DEFINITION;
  writeFileSync('diagnostics/line-evergreen-trial-v412.json', JSON.stringify(report, null, 2) + '\n');
}

for (const file of ['data.json', 'line-sales-master.json']) {
  const text = readFileSync(file, 'utf8');
  for (const bad of ['買10送2', '共12罐500元', '共12包2,000元', '約5～7個工作天出貨']) {
    if (text.includes(bad)) throw new Error(`${file} 仍含舊資料：${bad}`);
  }
  if (!text.includes('製作加工約需5～7個工作天') || !text.includes('完成後才安排出貨')) {
    throw new Error(`${file} 缺少正式製作加工與出貨說明`);
  }
}

console.log('PASS：LINE OA已鎖定製作加工約需5～7個工作天，完成後才安排出貨。');
