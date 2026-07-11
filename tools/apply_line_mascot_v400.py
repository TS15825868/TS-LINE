from pathlib import Path
import json
import re

server_path = Path("server.js")
s = server_path.read_text(encoding="utf-8")
s = s.replace("仙加味 LINE OA Bot v312.0", "仙加味 LINE OA Bot v400.0")
s = re.sub(r'const VERSION = "v[^"]+";', 'const VERSION = "v400.0";', s, count=1)

mascot_block = '''const MASCOT_PATHS = {
  welcome: "images/line-mascot/xianjiawei-mascot-line-welcome.jpg?v=400.0",
  products: "images/line-mascot/xianjiawei-mascot-line-products.jpg?v=400.0",
  recommend: "images/line-mascot/xianjiawei-mascot-line-recommend.jpg?v=400.0",
  combo: "images/line-mascot/xianjiawei-mascot-line-combo.jpg?v=400.0",
  usage: "images/line-mascot/xianjiawei-mascot-line-usage.jpg?v=400.0",
  faq: "images/line-mascot/xianjiawei-mascot-line-faq.jpg?v=400.0",
  service: "images/line-mascot/xianjiawei-mascot-line-service.jpg?v=400.0",
  brand: "images/line-mascot/xianjiawei-mascot-line-brand.jpg?v=400.0",
  cart: "images/line-mascot/xianjiawei-mascot-line-cart.jpg?v=400.0",
};'''
s, count = re.subn(r"const MASCOT_PATHS = \{.*?\n\};", mascot_block, s, count=1, flags=re.S)
if count != 1:
    raise SystemExit("找不到 MASCOT_PATHS")

pose_function = '''function mascotPoseForTitle(title = "") {
  if (/購物車|購買清單|結帳|下單|訂單/.test(title)) return "cart";
  if (/常見問題|FAQ/.test(title)) return "faq";
  if (/客服|聯絡|門市|配送|付款/.test(title)) return "service";
  if (/使用|沖泡|燉湯|料理/.test(title)) return "usage";
  if (/搭配|組合/.test(title)) return "combo";
  if (/推薦|幫你選|怎麼選/.test(title)) return "recommend";
  if (/傳承|故事|品牌|漢方|百科|資料/.test(title)) return "brand";
  if (/產品|介紹|價格/.test(title)) return "products";
  return "welcome";
}'''
s, count = re.subn(r"function mascotPoseForTitle\(title = \"\"\) \{.*?\n\}", pose_function, s, count=1, flags=re.S)
if count != 1:
    raise SystemExit("找不到 mascotPoseForTitle")

cart_function = '''function cartFlex(state) {
  if (!state.cart.length) {
    return {
      type: "flex",
      altText: "仙加味購物車",
      contents: mascotBubble(
        "購物車｜目前沒有商品",
        `目前購物車是空的。\n\n${ORDER_NOTICE}`,
        [
          { label: "看產品", text: "看產品" },
          { label: "價格方案", text: "價格方案" },
        ],
        "cart"
      ),
    };
  }

  const lines = state.cart
    .map((item, index) => `${index + 1}. ${item.name}\n數量：${item.qty}${item.unit}\n方案：${item.label}\n小計：${money(item.total)}`)
    .join("\n\n");

  return {
    type: "flex",
    altText: "仙加味購物車",
    contents: mascotBubble(
      "購物車｜確認購買清單",
      `${lines}\n\n合計：${money(cartTotal(state.cart))}\n\n${ORDER_NOTICE}`,
      [
        { label: "直接結帳", text: "開始結帳" },
        { label: "繼續選購", text: "看產品" },
        { label: "清空購物車", text: "清空購物車" },
      ],
      "cart"
    ),
  };
}'''
s, count = re.subn(r"function cartFlex\(state\) \{.*?\n\}\n\nconst MASCOT_PATHS", cart_function + "\n\nconst MASCOT_PATHS", s, count=1, flags=re.S)
if count != 1:
    raise SystemExit("找不到 cartFlex")

price_function = '''function priceCarousel() {
  return {
    type: "flex",
    altText: "仙加味價格方案",
    contents: {
      type: "carousel",
      contents: [
        mascotBubble(
          "價格方案｜小老闆幫你整理",
          `先查看各產品規格、單價與目前活動，再選擇數量加入購物車。\n\n${ORDER_NOTICE}`,
          [
            { label: "看產品", text: "看產品" },
            { label: "查看購物車", text: "查看購買清單" },
            { label: "人工客服", text: "我要人工客服" },
          ],
          "products"
        ),
        ...DATA.products.map((product) => {
          const original = product.originalPrice && product.originalPrice > product.price
            ? `售價：${money(product.originalPrice)}\n優惠價：${money(product.price)}`
            : `售價：${money(product.price)}`;
          const offers = product.offers.length
            ? `\n\n活動：\n${product.offers.map((offer) => `・${offer.label} ${money(offer.total)}`).join("\n")}`
            : "";
          return flexCard(product.displayName, `規格：${product.spec}\n${original}${offers}\n\n${ORDER_NOTICE}`, [
            { label: "選擇數量", text: `選擇數量｜${product.id}` },
            { label: "看產品DM", uri: absoluteUrl(product.dmImage || product.image || "images/logo.png") },
            { label: "看產品", text: "看產品" },
          ]).contents;
        }),
      ],
    },
  };
}'''
s, count = re.subn(r"function priceCarousel\(\) \{.*?\n\}\n\nfunction qtyMenu", price_function + "\n\nfunction qtyMenu", s, count=1, flags=re.S)
if count != 1:
    raise SystemExit("找不到 priceCarousel")

server_path.write_text(s, encoding="utf-8")

# 同步測試版本。
test_path = Path("function.test.js")
t = test_path.read_text(encoding="utf-8")
t = t.replace('assert.strictEqual(VERSION, "v312.0");', 'assert.strictEqual(VERSION, "v400.0");')
t = t.replace('v312.0', 'v400.0')
test_path.write_text(t, encoding="utf-8")

# 更新套件與發布資訊。
package_path = Path("package.json")
package = json.loads(package_path.read_text(encoding="utf-8"))
package["version"] = "4.0.0"
package["description"] = "仙加味 LINE OA v400｜LINE 專用小老闆、產品卡、價格方案、購物車、結帳、CRM、使用方式、FAQ 與敏感問題轉介"
package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

status = {
    "release": "4.0.0",
    "updated": "2026-07-11",
    "branch": "main",
    "website": "https://ts15825868.github.io/xianjiawei/",
    "lineId": "@762jybnm",
    "mascotAssets": "website-hosted LINE OA dedicated v400 images",
    "mascotScenes": ["welcome", "products", "recommend", "combo", "usage", "faq", "service", "brand", "cart"],
    "features": [
        "產品卡片與產品圖片",
        "價格方案導覽卡",
        "產品推薦與搭配組合",
        "使用方式與常見問題",
        "LINE專用購物車小老闆卡",
        "完整結帳流程",
        "CRM訂單寫入與失敗重試",
        "健康敏感問題轉介合作中醫師",
        "Webhook重送事件防重複處理",
        "healthz部署健康檢查"
    ],
    "requiredEnvironment": ["CHANNEL_ACCESS_TOKEN", "CHANNEL_SECRET", "CRM_URL"],
    "releaseCheck": "npm test"
}
Path("release-status.json").write_text(json.dumps(status, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

print("LINE OA v400 小老闆、購物車、價格導覽與版本資料已套用")
