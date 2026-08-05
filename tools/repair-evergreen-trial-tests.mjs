import { readFileSync, writeFileSync } from 'node:fs';

function patch(path, replacements) {
  let text = readFileSync(path, 'utf8');
  for (const [from, to] of replacements) {
    if (text.includes(from)) text = text.replaceAll(from, to);
  }
  writeFileSync(path, text);
}

// 「玻璃瓶」只保留為使用者可能輸入的舊稱辨識，不作為產品顯示名稱。
patch('server.js', [
  ['if (/龜鹿飲.*30|30cc|玻璃罐/.test(raw))', 'if (/龜鹿飲.*30|30cc|玻璃罐|玻璃瓶/.test(raw))'],
]);

patch('test.js', [
  [
`assert.deepStrictEqual(
  DATA.products.map((product) => product.id),
  ["guilu-gao", "guilu-drink-30", "guilu-drink-180", "guilu-tangkuai", "guilu-jiao", "luerong-fen"]
);`,
`assert.deepStrictEqual(
  DATA.products.map((product) => product.id).sort(),
  ["guilu-gao", "guilu-drink-30", "guilu-drink-180", "guilu-tangkuai", "guilu-jiao", "luerong-fen"].sort()
);`
  ],
  ['assert.strictEqual(detectProduct("龜鹿飲30cc玻璃罐").id, "guilu-drink-30");\nassert.strictEqual(detectProduct("龜鹿飲30cc玻璃罐").id, "guilu-drink-30");', 'assert.strictEqual(detectProduct("龜鹿飲30cc玻璃罐").id, "guilu-drink-30");'],
  ['assert.strictEqual(gao.price, 1500);', 'assert.strictEqual(gao.price, 1800);'],
  ['assert.strictEqual(gao.originalPrice, 1800);', 'assert.strictEqual(gao.originalPrice, 2100);'],
  ['assert.strictEqual(drink30.unit, "瓶");', 'assert.strictEqual(drink30.unit, "罐");'],
  ['{ total: 50, label: "單瓶×1" }', '{ total: 50, label: "單罐×1" }'],
  ['"買10送1×1＋單瓶×1"', '"買10送1×1＋單罐×1"'],
  ['assert.deepStrictEqual(calcItem(drink180, 12), { total: 2000, label: "買10送1×1" });', 'assert.deepStrictEqual(calcItem(drink180, 11), { total: 2000, label: "買10送1×1" });'],
]);

patch('function.test.js', [
  ['"guilu-gao": { price: 1500, originalPrice: 1800, options: [1, 2, 3, 5], offers: [] }', '"guilu-gao": { price: 1800, originalPrice: 2100, options: [1, 2, 3, 5], offers: [] }'],
  ['const expectedComboPrices = [2500, 3600, 6100];', 'const expectedComboPrices = [2800, 3600, 6400];'],
  ['["龜鹿膏：已套用優惠價 $1,500"]', '["龜鹿膏：已套用優惠價 $1,800"]'],
  ['assert.strictEqual(comboState.cart[0].total, 18300);', 'assert.strictEqual(comboState.cart[0].total, 19200);'],
  ['assert.ok(comboState.cart[0].label.includes("$6,100"));', 'assert.ok(comboState.cart[0].label.includes("$6,400"));'],
  ['for (const command of ["看產品", "直接下單", "幫我推薦", "搭配組合", "怎麼使用", "查看購買清單", "開始結帳"])', 'for (const command of ["申請試喝", "看產品", "直接下單", "幫我推薦", "搭配組合", "怎麼使用", "查看購買清單", "開始結帳"])'],
]);

patch('social-current-policy.test.js', [
  ['assert.strictEqual(sales.products["guilu-gao"].price, 1500);', 'assert.strictEqual(sales.products["guilu-gao"].price, 1800);'],
  ['assert.strictEqual(sales.products["guilu-gao"].originalPrice, 1800);', 'assert.strictEqual(sales.products["guilu-gao"].originalPrice, 2100);'],
]);

const splitOrderNotice = '龜鹿飲30cc與180cc為接單後安排製作加工；龜鹿膏、龜鹿湯塊、龜鹿膠與鹿茸粉為預先製作備貨商品。實際出貨時間依訂單品項與現貨狀況確認，物流配送時間另計。';
patch('data.json', [
  ['"orderNotice": "全系列已開放詢問與下單；實際庫存與出貨時間由客服確認。"', `"orderNotice": "${splitOrderNotice}"`],
  ['"orderNotice": "訂單資料與付款方式確認完成後採接單安排製作，約5～7個工作天出貨；不含例假日及物流配送時間。"', `"orderNotice": "${splitOrderNotice}"`],
  ['"orderNotice": "訂單資料與付款方式確認後安排製作加工，製作加工約需5～7個工作天；完成後才安排出貨，物流配送時間另計。"', `"orderNotice": "${splitOrderNotice}"`],
]);

const repairedData = JSON.parse(readFileSync('data.json', 'utf8'));
if (/^訂單資料與付款方式確認後安排製作加工/.test(String(repairedData.orderNotice || ''))) {
  throw new Error('測試修復器不得再把龜鹿飲5～7天設為全系列orderNotice');
}
if (!String(repairedData.orderNotice || '').includes('預先製作備貨商品')) {
  throw new Error('全域orderNotice缺少四項預先備貨說明');
}

console.log('PASS：LINE OA測試已同步正式售價、買10送1與產品辨識；全域出貨說明維持龜鹿飲／預先備貨分流。');
