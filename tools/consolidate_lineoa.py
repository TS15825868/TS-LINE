from pathlib import Path
import json
import re

ROOT = Path('.')
VERSION = '401.3'
BOT_VERSION = 'v401.3'


def replace_block(text: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, lambda _m: replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f'{label} patch failed: {count}')
    return updated

# Centralize deploy, rich menu and mascot metadata in data.json.
data_path = ROOT / 'data.json'
data = json.loads(data_path.read_text(encoding='utf-8'))
rich_menu = json.loads((ROOT / 'rich-menu-actions.json').read_text(encoding='utf-8'))
mascot_manifest = json.loads((ROOT / 'public/mascot/manifest.json').read_text(encoding='utf-8'))

data['version'] = VERSION
data['lineBotVersion'] = BOT_VERSION
data['lineAssetsVersion'] = VERSION
data['updatedAt'] = '2026-07-14'
data['runtime'] = {
    'version': VERSION,
    'botVersion': BOT_VERSION,
    'branch': 'main',
    'service': 'https://ts-line.onrender.com',
    'status': 'production',
    'requiredEnvironment': ['CHANNEL_ACCESS_TOKEN', 'CHANNEL_SECRET', 'CRM_URL'],
    'optionalEnvironment': ['PUBLIC_BASE_URL'],
    'imagePolicy': {
        'productCards': 'real-product-images-only',
        'productIntroCollage': False,
        'redrawnPackaging': False,
        'approvedSingleSceneCards': ['welcome', 'recommend', 'usage', 'faq', 'support', 'brand'],
        'textOnlyUntilApprovedImage': ['combo', 'emptyCart'],
        'onePurposeOneImage': True,
    },
}
data['richMenu'] = rich_menu
data['mascotAssets'] = {
    'version': VERSION,
    'scope': 'TS-LINE/main LINE OA dedicated mascot assets',
    'aspectRatio': mascot_manifest.get('aspectRatio', '1:1'),
    'verifiedAt': '2026-07-14',
    'images': mascot_manifest.get('images', {}),
}
data_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

# Merge startup and image-policy behavior into server.js.
server_path = ROOT / 'server.js'
server = server_path.read_text(encoding='utf-8')
server = server.replace('仙加味 LINE OA Bot v401.0', '仙加味 LINE OA Bot v401.3')
server = server.replace('const VERSION = "v401.0";', 'const VERSION = "v401.3";')
server = server.replace('const MASCOT_VERSION = "401.0";', 'const MASCOT_VERSION = "401.3";')

server = replace_block(
    server,
    r'function productCarousel\(\) \{.*?\n\}\n\nfunction productMenuReply',
    r'''function productCarousel() {
  return {
    type: "flex",
    altText: "仙加味產品",
    contents: {
      type: "carousel",
      contents: DATA.products.map(productBubble),
    },
  };
}

function productMenuReply''',
    'productCarousel',
)

server = replace_block(
    server,
    r'function cartFlex\(state\) \{.*?\n\}\n\nconst MASCOT_PATHS',
    r'''function cartFlex(state) {
  const buildCartCard = (description, buttons) => {
    const message = flexCard("購物車｜小老闆幫你整理", description, buttons);
    message.contents.size = "mega";
    return message;
  };

  if (!state.cart.length) {
    return buildCartCard(`目前購物車是空的。\n\n${ORDER_NOTICE}`, [
      { label: "看產品", text: "看產品" },
      { label: "價格方案", text: "價格方案" },
    ]);
  }

  const lines = state.cart
    .map((item, index) => `${index + 1}. ${item.name}\n數量：${item.qty}${item.unit}\n方案：${item.label}\n小計：${money(item.total)}`)
    .join("\n\n");

  return buildCartCard(`${lines}\n\n合計：${money(cartTotal(state.cart))}\n\n${ORDER_NOTICE}`, [
    { label: "直接結帳", text: "開始結帳" },
    { label: "繼續選購", text: "看產品" },
    { label: "清空購物車", text: "清空購物車" },
  ]);
}

const MASCOT_PATHS''',
    'cartFlex',
)

server = replace_block(
    server,
    r'function comboReply\(\) \{.*?\n\}\n\nfunction getCombo',
    r'''function comboReply() {
  return flexCard(
    "搭配組合｜依日常使用方式選擇",
    `搭配組合以產品型態、使用方式與生活情境為主：

・固定日常安排：龜鹿膏
・方便即飲：龜鹿飲30cc
・沖泡與料理：龜鹿湯塊
・家庭長期使用：龜鹿膠
・自行搭配飲品：鹿茸粉

若涉及個人體質、疾病、用藥或適不適合食用，會轉介合作中醫師協助判斷。`,
    [
      { label: "查看搭配組合", text: "搭配組合" },
      { label: "查看產品", text: "看產品" },
      { label: "人工客服", text: "我要人工客服" },
    ]
  );
}

function getCombo''',
    'comboReply',
)

server = replace_block(
    server,
    r'function comboMenuReply\(\) \{.*?\n\}\n\nfunction comboDetailReply',
    r'''function comboMenuReply() {
  const combos = DATA.offers?.comboOffers || [];
  if (!combos.length) {
    return flexCard("搭配組合", "目前搭配組合由客服依需求協助整理。", [
      { label: "看產品", text: "看產品" },
      { label: "人工客服", text: "我要人工客服" },
    ]);
  }
  return {
    type: "flex",
    altText: "仙加味搭配組合",
    contents: {
      type: "carousel",
      contents: [
        flexCard(
          "日常搭配導覽",
          "依日常節奏查看搭配組合。每組價格、可選組數、活動與加入購物車功能都保留在各方案卡中。",
          [
            { label: "看產品", text: "看產品" },
            { label: "怎麼使用", text: "怎麼使用" },
            { label: "人工客服", text: "我要人工客服" },
          ]
        ).contents,
        ...combos.slice(0, 9).map((combo, index) => {
          const unitPrice = comboUnitPrice(combo);
          const quantities = combo.quantityOptions || [1, 2, 3, 5];
          const promotions = comboPromotionLines(combo);
          const description = [
            ...(combo.items || []).map((item) => `・${item}`),
            "",
            combo.desc || "",
            "",
            `每組售價：${money(unitPrice)}`,
            `可選組數：${quantities.join("、")}組`,
            ...(promotions.length ? ["", "活動／優惠已套用：", ...promotions.map((line) => `・${line}`)] : []),
          ].join("\n");
          return flexCard(combo.name, description, [
            { label: "選擇組數", text: `搭配組數｜${index}` },
            { label: "看全部產品", text: "看產品" },
            { label: "人工客服", text: "我要人工客服" },
          ]).contents;
        }),
      ],
    },
  };
}

function comboDetailReply''',
    'comboMenuReply',
)

server = replace_block(
    server,
    r'const MASCOT_PATHS = \{.*?\n\};',
    r'''const MASCOT_PATHS = {
  welcome: mascotAssetUrl("welcome"),
  recommend: mascotAssetUrl("recommend"),
  usage: mascotAssetUrl("usage"),
  faq: mascotAssetUrl("faq"),
  service: mascotAssetUrl("service"),
  brand: mascotAssetUrl("brand"),
};''',
    'MASCOT_PATHS',
)
server = re.sub(r'\n\s*if \(/搭配\|組合/\.test\(title\)\) return "combo";', '', server)
server = re.sub(r'\n\s*if \(/購物車\|購買清單/\.test\(title\)\) return "cart";', '', server)
server = re.sub(r'\n\s*if \(/產品\|介紹\|價格/\.test\(title\)\) return "products";', '', server)
server_path.write_text(server, encoding='utf-8')

# One runtime entry point.
package_path = ROOT / 'package.json'
package = json.loads(package_path.read_text(encoding='utf-8'))
package['version'] = '4.1.3'
package['main'] = 'server.js'
package['scripts']['start'] = 'node server.js'
package['scripts']['test'] = 'node --check server.js && node tools/release_check.js && node test.js && node catalog.test.js && node security.test.js && node function.test.js && node image-policy.test.js'
package['scripts']['check:release'] = 'node --check server.js && node tools/release_check.js'
package['description'] = '仙加味 LINE OA 單一主程式正式版｜中央 data.json、六項真實產品卡、獨立小老闆情境卡、價格、購物車、結帳與 CRM'
package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

# Update existing tests for the integrated runtime.
for filename in ['test.js', 'catalog.test.js', 'function.test.js', 'security.test.js']:
    path = ROOT / filename
    text = path.read_text(encoding='utf-8').replace('v401.0', 'v401.3').replace('"401.0"', '"401.3"')
    path.write_text(text, encoding='utf-8')

test_path = ROOT / 'test.js'
test_text = test_path.read_text(encoding='utf-8')
test_text = test_text.replace('productCards.contents.contents.length, DATA.products.length + 1', 'productCards.contents.contents.length, DATA.products.length')
test_text = test_text.replace('productMenuReply().contents.contents.length, DATA.products.length + 1', 'productMenuReply().contents.contents.length, DATA.products.length')
test_text = test_text.replace('comboReply().body.contents[1].text', 'comboReply().contents.body.contents[1].text')
test_path.write_text(test_text, encoding='utf-8')

function_path = ROOT / 'function.test.js'
function_text = function_path.read_text(encoding='utf-8')
function_text = function_text.replace('productMenuReply().contents.contents.length, DATA.products.length + 1', 'productMenuReply().contents.contents.length, DATA.products.length')
function_text = function_text.replace(
    'for (const message of [mascotWelcomeReply(), recommendReply(), comboMenuReply(), usageChooserReply()]) {',
    'for (const message of [mascotWelcomeReply(), recommendReply(), usageChooserReply(), faqReply()]) {'
)
function_path.write_text(function_text, encoding='utf-8')

(ROOT / 'image-policy.test.js').write_text(r'''"use strict";

const assert = require("assert");
const {
  productCarousel,
  cartFlex,
  mascotWelcomeReply,
  recommendReply,
  comboMenuReply,
  usageChooserReply,
  faqReply,
} = require("./server");

function firstBubble(message) {
  return message.contents.type === "carousel" ? message.contents.contents[0] : message.contents;
}

const products = productCarousel();
assert.strictEqual(products.contents.type, "carousel");
assert.strictEqual(products.contents.contents.length, 6, "產品入口應直接顯示六張真實產品卡");
for (const bubble of products.contents.contents) {
  assert.ok(bubble.hero, "每張產品卡都必須有真實產品主圖");
  assert.ok(bubble.hero.url.includes("/xianjiawei/images/products-v3/"), "產品卡不得使用小老闆拼湊圖或重畫包裝");
}
for (const message of [mascotWelcomeReply(), recommendReply(), usageChooserReply(), faqReply()]) {
  assert.ok(firstBubble(message).hero, "歡迎、推薦、使用方式與 FAQ 應保留一張獨立小老闆圖");
}
for (const message of [comboMenuReply(), cartFlex({ cart: [], checkout: null })]) {
  assert.ok(!firstBubble(message).hero, "搭配組合與空購物車應維持乾淨文字卡");
}
console.log("PASS LINE OA integrated image policy v401.3");
''', encoding='utf-8')

(ROOT / 'tools/release_check.js').write_text(r'''"use strict";

const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));
const data = JSON.parse(read("data.json"));
const server = read("server.js");
const pkg = JSON.parse(read("package.json"));
const errors = [];
const requiredProducts = ["guilu-gao", "guilu-drink-30", "guilu-drink-180", "guilu-tangkuai", "guilu-jiao", "luerong-fen"];
if (data.lineId !== "@762jybnm") errors.push("LINE ID 不正確");
if (!Array.isArray(data.products)) errors.push("products 必須是陣列");
for (const id of requiredProducts) {
  const product = (data.products || []).find((item) => item.id === id);
  if (!product) { errors.push(`缺少產品：${id}`); continue; }
  for (const field of ["name", "spec", "price", "unit", "image", "page", "usage", "ingredients"]) {
    if (product[field] === undefined || product[field] === null || product[field] === "") errors.push(`${id} 缺少 ${field}`);
  }
}
for (const token of ["process.env.CHANNEL_ACCESS_TOKEN", "process.env.CHANNEL_SECRET", "process.env.CRM_URL", "app.post(\"/webhook\"", "app.get(\"/healthz\"", "productCarousel()", "priceCarousel()", "cartFlex(state)", "startCheckout(state)", "doctorReferralReply()", "mascotWelcomeReply()"]) {
  if (!server.includes(token)) errors.push(`server.js 缺少必要功能：${token}`);
}
if (/channelAccessToken\s*:\s*["'][^"']{20,}/.test(server)) errors.push("server.js 疑似含硬編碼 access token");
if (/channelSecret\s*:\s*["'][^"']{10,}/.test(server)) errors.push("server.js 疑似含硬編碼 channel secret");
if (data.version !== "401.3") errors.push("data.json 版本未同步至 401.3");
if (data.catalogVersion !== "408.7") errors.push("官網素材版本未同步至 408.7");
if (data.lineBotVersion !== "v401.3") errors.push("LINE OA 版本未同步至 v401.3");
if (data.lineAssetsVersion !== "401.3") errors.push("小老闆素材版本未同步至 401.3");
if (data.runtime?.version !== "401.3") errors.push("中央 runtime 設定不正確");
if (!data.richMenu?.areas || data.richMenu.areas.length !== 6) errors.push("Rich Menu 設定未整合");
if (!data.mascotAssets?.images || Object.keys(data.mascotAssets.images).length !== 9) errors.push("小老闆素材清單未整合");
if ((data.products || []).length !== 6) errors.push("正式產品規格必須為六項");
for (const product of data.products || []) {
  if (!String(product.image || "").endsWith("?v=408.7")) errors.push(`${product.id} 產品圖版本不正確`);
  if (!String(product.dmImage || "").endsWith("?v=408.7")) errors.push(`${product.id} DM版本不正確`);
}
if (!server.includes('const VERSION = "v401.3";')) errors.push("server.js 版本不正確");
if (!server.includes('const MASCOT_VERSION = "401.3";')) errors.push("小老闆快取版本不正確");
if (pkg.version !== "4.1.3" || pkg.scripts?.start !== "node server.js") errors.push("package.json 未整合為單一主程式");
for (const obsolete of ["start.js", "no-collage-runtime.js", "deploy-version.json", "release-status.json", "rich-menu-actions.json", "mascot-manifest.json", "public/mascot/manifest.json", "tools/fix_line_aspectmode.js", "tools/fix_mascot_image_urls.js"]) {
  if (exists(obsolete)) errors.push(`應移除重複或舊檔：${obsolete}`);
}
if (errors.length) { console.error("LINE OA 正式上線檢查失敗：\n- " + errors.join("\n- ")); process.exit(1); }
console.log(`LINE OA v401.3 整合檢查通過：單一 server.js、中央 data.json、${data.products.length} 項產品、Webhook、購物車、結帳、CRM 與圖片政策正常。`);
''', encoding='utf-8')

# Remove duplicate runtime/config and one-off fix files.
for obsolete in [
    'start.js', 'no-collage-runtime.js', 'deploy-version.json', 'release-status.json', 'rich-menu-actions.json',
    'mascot-manifest.json', 'public/mascot/manifest.json', 'tools/fix_line_aspectmode.js', 'tools/fix_mascot_image_urls.js',
]:
    path = ROOT / obsolete
    if path.exists():
        path.unlink()
