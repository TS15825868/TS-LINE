"use strict";

const fs = require("node:fs");

const rules = {
  "social-first-batch-202607.js": [
    ["龜鹿飲30cc｜輕巧瓶裝，外出攜帶方便", "龜鹿飲30cc｜小玻璃罐，外出攜帶方便"],
    ["龜鹿飲30cc為矮胖的小玻璃瓶裝，輕巧好攜帶。", "龜鹿飲30cc為小玻璃罐裝，輕巧好攜帶。"],
    ["龜鹿飲30cc是矮胖的小玻璃瓶裝，適合需要輕巧攜帶的日常情境。", "龜鹿飲30cc為小玻璃罐裝，適合需要輕巧攜帶的日常情境。"],
    ["#仙加味 #龜鹿飲 #30cc #玻璃瓶 #日常攜帶", "#仙加味 #龜鹿飲 #30cc #小玻璃罐 #日常攜帶"]
  ],
  "social-final-reconcile.js": [
    ["龜鹿飲有30cc矮胖玻璃瓶與180cc鋁袋兩種規格。", "龜鹿飲有30cc小玻璃罐與180cc鋁袋兩種規格。"]
  ]
};

let changedFiles = 0;
for (const [file, replacements] of Object.entries(rules)) {
  if (!fs.existsSync(file)) throw new Error(`找不到公開文案檔案：${file}`);
  const original = fs.readFileSync(file, "utf8");
  let next = original;
  for (const [from, to] of replacements) next = next.split(from).join(to);

  const forbiddenPublicTerms = [
    "矮胖的小玻璃瓶裝",
    "矮胖玻璃瓶",
    "#玻璃瓶",
    "龜鹿飲30cc｜輕巧瓶裝"
  ];
  const remaining = forbiddenPublicTerms.filter((term) => next.includes(term));
  if (remaining.length) throw new Error(`${file} 仍含公開舊稱：${remaining.join("、")}`);
  if (!next.includes("小玻璃罐")) throw new Error(`${file} 未寫入正式名稱「小玻璃罐」`);

  if (next !== original) {
    fs.writeFileSync(file, next, "utf8");
    changedFiles += 1;
    console.log(`已統一公開用語：${file}`);
  }
}

console.log(`30cc 公開用語驗證完成：${changedFiles} 個檔案已更新；搜尋別名與舊稱辨識不受影響。`);
