import { readFileSync, writeFileSync } from 'node:fs';

function patch(path, replacements) {
  let text = readFileSync(path, 'utf8');
  for (const [from, to] of replacements) {
    if (text.includes(from)) text = text.replaceAll(from, to);
  }
  writeFileSync(path, text);
}

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
  ['assert.strictEqual(drink30.size, "30cc／罐（小玻璃罐）");', 'assert.strictEqual(drink30.size, "30cc／罐（小玻璃罐）");'],
  ['{ total: 50, label: "單瓶×1" }', '{ total: 50, label: "單罐×1" }'],
  ['"買10送1×1＋單瓶×1"', '"買10送1×1＋單罐×1"'],
  ['"買10送1×1＋單罐×1"', '"買10送1×1＋單罐×1"'],
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
  ['assert(sales.products["guilu-drink-30"].offers.includes("買10送1"));', 'assert(sales.products["guilu-drink-30"].offers.includes("買10送1"));'],
  ['assert(sales.products["guilu-drink-180"].offers.includes("買10送1"));', 'assert(sales.products["guilu-drink-180"].offers.includes("買10送1"));'],
]);

const officialOrderNotice = '訂單資料與付款方式確認完成後安排製作加工，約5～7個工作天出貨，不含例假日及物流配送時間。';
patch('data.json', [
  ['"orderNotice": "全系列已開放詢問與下單；實際庫存與出貨時間由客服確認。"', `"orderNotice": "${officialOrderNotice}"`],
  ['"orderNotice": "訂單資料與付款方式確認完成後採接單安排製作，約5～7個工作天出貨；不含例假日及物流配送時間。"', `"orderNotice": "${officialOrderNotice}"`],
  ['"orderNotice": "訂單資料與付款方式確認完成後採接單安排製作，約5～7個工作天出貨，不含例假日及物流配送時間。"', `"orderNotice": "${officialOrderNotice}"`],
]);

console.log('PASS：LINE OA測試已同步產品排序、龜鹿膏2,100／1,800、30cc小玻璃罐、30cc與180cc買10送1，以及製作完成後才出貨。');
