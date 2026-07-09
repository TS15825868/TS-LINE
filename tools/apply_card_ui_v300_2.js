"use strict";

const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");

const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const write = (name, content) => fs.writeFileSync(path.join(root, name), content, "utf8");

function replaceBlock(source, pattern, replacement, label) {
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`找不到更新區塊：${label}`);
  return next;
}

const crmUrl = "https://script.google.com/macros/s/AKfycbwAFBxeROd2ZYGJ_h0O7_H2MMxptOMoj3EXIErZpbKuTYFOzOVwQkrk8X1MoxapkHVGSA/exec";

let server = read("server.js");
server = server.replace(/仙加味 LINE OA Bot v300\.1/g, "仙加味 LINE OA Bot v300.2");
server = server.replace('const VERSION = "v300.1";', 'const VERSION = "v300.2";');
server = server.replace(
  /const CRM_URL = process\.env\.CRM_URL \|\| "[^"]*";/,
  `const CRM_URL = process.env.CRM_URL || "${crmUrl}";`
);
server = replaceBlock(
  server,
  /const config = \{[\s\S]*?\n\};\n\nconst app = express\(\);/,
  `const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || "",
  channelSecret: process.env.CHANNEL_SECRET || "",
};

const app = express();`,
  "LINE 憑證"
);

server = replaceBlock(
  server,
  /function productMenuReply\(\) \{[\s\S]*?\n\}\n\nfunction priceCarousel/,
  `function productMenuReply() {
  return productCarousel();
}

function priceCarousel`,
  "產品卡片選單"
);

server = replaceBlock(
  server,
  /function recommendReply\(\) \{[\s\S]*?\n\}\n\nfunction comboReply/,
  `function recommendReply() {
  const cards = [
    flexCard(
      "固定日常安排",
      "想建立固定日常食補，可從龜鹿膏開始；需要外出或忙碌時方便飲用，可選龜鹿飲30cc或180cc。",
      [
        { label: "看龜鹿膏", text: "產品詳情｜guilu-gao" },
        { label: "看30cc", text: "產品詳情｜guilu-drink-30" },
        { label: "看180cc", text: "產品詳情｜guilu-drink-180" },
      ]
    ).contents,
    flexCard(
      "沖泡、燉湯與家庭使用",
      "想搭配熱水、料理或家庭較大規格使用，可比較龜鹿湯塊與龜鹿膠。",
      [
        { label: "看龜鹿湯塊", text: "產品詳情｜guilu-tangkuai" },
        { label: "看龜鹿膠", text: "產品詳情｜guilu-jiao" },
        { label: "看搭配方案", text: "搭配組合" },
      ]
    ).contents,
    flexCard(
      "自行搭配飲品",
      "喜歡依自己的飲食習慣加入溫水、牛奶、豆漿或其他飲品，可查看鹿茸粉。個人體質、疾病與用藥問題會轉介中醫師協助判斷。",
      [
        { label: "看鹿茸粉", text: "產品詳情｜luerong-fen" },
        { label: "怎麼使用", text: "怎麼使用" },
        { label: "人工客服", text: "我要人工客服" },
      ]
    ).contents,
  ];

  return {
    type: "flex",
    altText: "仙加味怎麼選",
    contents: { type: "carousel", contents: cards },
  };
}

function comboReply`,
  "推薦卡片"
);

server = replaceBlock(
  server,
  /function comboMenuReply\(\) \{[\s\S]*?\n\}\n\nfunction comboDetailReply/,
  `function comboMenuReply() {
  const combos = DATA.offers?.comboOffers || [];
  if (!combos.length) {
    return flexCard("搭配方案", "目前搭配方案由客服依需求協助整理。", [
      { label: "看產品", text: "看產品" },
      { label: "人工客服", text: "我要人工客服" },
    ]);
  }

  return {
    type: "flex",
    altText: "仙加味搭配方案",
    contents: {
      type: "carousel",
      contents: combos.slice(0, 10).map((combo, index) =>
        flexCard(
          combo.name,
          (combo.items || []).map((item) => "・" + item).join("\\n") +
            "\\n\\n" + (combo.desc || "") +
            "\\n\\n" + (combo.priceNote || "實際價格、庫存與活動由客服確認。"),
          [
            { label: "查看方案", text: "搭配方案｜" + index },
            { label: "查看產品", text: "看產品" },
            { label: "人工客服", text: "我要人工客服" },
          ]
        ).contents
      ),
    },
  };
}

function comboDetailReply`,
  "搭配方案卡片"
);

server = replaceBlock(
  server,
  /function usageChooserReply\(\) \{[\s\S]*?\n\}\n\nfunction usageReply/,
  `function usageChooserReply() {
  return {
    type: "flex",
    altText: "仙加味產品使用方式",
    contents: {
      type: "carousel",
      contents: DATA.products.map((product) => usageReply(product).contents),
    },
  };
}

function usageReply`,
  "使用方式卡片"
);

write("server.js", server);

let test = read("test.js");
test = test.replace('assert.strictEqual(VERSION, "v300.1");', 'assert.strictEqual(VERSION, "v300.2");');
test = test.replace(
  'assert.ok(recommendReply().text.includes("龜鹿飲180cc"));',
  'assert.strictEqual(recommendReply().contents.contents.length, 3);'
);
test = test.replace(
  'assert.strictEqual(usageChooserReply().quickReply.items.length, 6);',
  'assert.strictEqual(usageChooserReply().contents.contents.length, 6);'
);
test = test.replace(
  'assert.strictEqual(productMenuReply().quickReply.items.length, 6);\nassert.ok(comboMenuReply().text.includes("日常節奏組"));\nassert.ok(comboDetailReply(0).contents.body.contents[0].text.includes("日常節奏組"));',
  'assert.strictEqual(productMenuReply().contents.contents.length, 6);\nassert.strictEqual(comboMenuReply().contents.contents.length, DATA.offers.comboOffers.length);\nassert.ok(comboMenuReply().contents.contents[0].body.contents[0].text.includes("日常節奏組"));\nassert.ok(comboDetailReply(0).contents.body.contents[0].text.includes("日常節奏組"));'
);
write("test.js", test);

let security = read("security.test.js");
security = security.replace('assert.strictEqual(VERSION, "v300.1");', 'assert.strictEqual(VERSION, "v300.2");');
security = security.replace("PASS security and UX v300.1", "PASS security and UX v300.2");
write("security.test.js", security);

const pkg = JSON.parse(read("package.json"));
pkg.version = "3.0.2";
write("package.json", JSON.stringify(pkg, null, 2) + "\n");

let verify = read(".github/workflows/verify-line-and-website-catalog.yml");
verify = verify.replace('"version":"v300.1"', '"version":"v300.2"');
write(".github/workflows/verify-line-and-website-catalog.yml", verify);

let readme = read("README.md");
readme = readme.replace("# 仙加味 LINE OA v300.1", "# 仙加味 LINE OA v300.2");
readme = readme.replace('"version": "v300.1"', '"version": "v300.2"');
if (!readme.includes("## 卡片式操作")) {
  readme += `
## 卡片式操作

- 看產品／直接下單：顯示六項產品圖片卡與按鈕。
- 幫我推薦：顯示三張使用情境推薦卡。
- 搭配組合：顯示各組合卡片，可查看方案、產品或轉人工。
- 怎麼使用：顯示六項產品使用方式卡片。
`;
}
write("README.md", readme);

const obsolete = [
  "CHECK_REPORT_v286_LINEOA.json",
  "CHECK_REPORT_v287_LINEOA.json",
  "LINEOA_v285文案修正說明.md",
  "LINEOA_v288全系列上架更新說明.md",
  "LINEOA_古籍藥典與正向QA_v286.md",
  "LINEOA_正式回覆文案_v280.md",
  "LINEOA_正式回覆文案_v286.md",
  "LINEOA_正式回覆文案_v287.md",
  "LINEOA_龜鹿網路說法安全回覆_v284.md",
  "LIVE_STATUS_v288.json",
  "LIVE_STATUS_v289.json",
  "LIVE_STATUS_v294.json",
  "LIVE_STATUS_v295_1.json",
  "RUN_SECURITY_V300_1.txt",
  "products.json",
  "google_script.js",
  "REPO_FILE_MANIFEST.txt",
  "INVENTORY_TRIGGER.txt",
  "RESTORE_LINE_CARDS_TRIGGER.txt",
  ".github/workflows/repo-inventory.yml",
  ".github/workflows/restore-line-cards-v300-2.yml",
];
for (const relative of obsolete) {
  const target = path.join(root, relative);
  if (fs.existsSync(target)) fs.rmSync(target, { force: true });
}

console.log("Applied LINE OA v300.2 card interface and cleanup");
