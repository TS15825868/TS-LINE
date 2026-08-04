import { readFileSync, writeFileSync } from 'node:fs';

const path = 'tools/release_check.js';
let source = readFileSync(path, 'utf8');
const replacements = [
  ["assert.match(String(trial.fulfillmentRule || ''), /製作加工約需5～7個工作天/);", "assert.match(String(trial.fulfillmentRule || ''), /約5～7個工作天出貨/);"],
  ["assert.match(String(trial.fulfillmentRule || ''), /完成後才安排出貨/);", "assert.match(String(trial.fulfillmentRule || ''), /接單安排製作/);"],
  ["assert.match(String(trial.fulfillmentRule || ''), /物流配送時間另計/);", "assert.match(String(trial.fulfillmentRule || ''), /不含例假日及物流配送時間/);"],
  ["assert.match(String(trial.leadTimeDefinition || ''), /5～7個工作天.*製作加工/);", "assert.match(String(trial.leadTimeDefinition || ''), /約5～7個工作天出貨/);"],
  ["console.log('PASS release check：產品、試喝、買10送1、製作完成後出貨與四位固定夥伴均符合正式規則');", "console.log('PASS release check：產品、試喝、買10送1、約5～7個工作天出貨與四位固定夥伴均符合正式規則');"]
];
for (const [from, to] of replacements) source = source.split(from).join(to);
if (source.includes('製作加工約需5～7個工作天') || source.includes('完成後才安排出貨')) throw new Error('release_check.js 仍含舊出貨規則');
if (!source.includes('約5～7個工作天出貨') || !source.includes('接單安排製作')) throw new Error('release_check.js 缺少使用者確認規則');
writeFileSync(path, source);
console.log('PASS LINE OA release check v426 已同步使用者確認的約5～7個工作天出貨規則。');
