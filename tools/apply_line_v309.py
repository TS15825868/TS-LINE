from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / "server-core.js"
SERVER = ROOT / "server.js"
DATA_PATH = ROOT / "data.json"

if not CORE.exists():
    raise FileNotFoundError("server-core.js not found")

# 1. Consolidate the final catalog and store information into the only data.json.
data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
products = data.get("products") or []
ids = [item.get("id") for item in products]
if "guilu-drink-180" not in ids:
    product180 = {
        "id": "guilu-drink-180",
        "series": "仙加味・龜鹿",
        "name": "龜鹿飲180cc鋁袋",
        "displayName": "龜鹿飲180cc鋁袋",
        "size": "180cc／包（鋁袋）",
        "image": "images/products-v3/guilu-drink-180.jpg?v=305.0",
        "dmImage": "images/dm-final/03_guilu-drink-180cc-dm.jpg?v=305.0",
        "description": "180cc鋁袋包裝，把龜鹿膏的成分方向整理成方便即飲的液態型態。適合居家、工作空檔或偏好一次安排較完整份量的人。",
        "ingredients": ["水", "鹿角萃取物", "龜板萃取物", "枸杞", "紅棗", "黃耆", "粉光蔘"],
        "usage": ["撕開包裝即可飲用", "可依個人習慣溫熱後飲用", "開封後請儘速飲用完畢"],
        "storage": ["未開封置於陰涼乾燥處", "避免高溫與日光直射", "開封後請儘速飲用完畢"],
        "fit": "想要較完整即飲份量、居家安排或工作空檔飲用的人",
        "page": "product-guilu-drink-180cc.html",
        "purpose": "完整份量即飲食補",
        "purposeDirection": "適合偏好180cc鋁袋、居家安排、工作空檔或想一次飲用較完整份量的人。",
        "aliases": ["龜鹿飲180cc", "龜鹿飲180", "180cc", "180cc鋁袋", "鋁袋", "龜鹿飲鋁袋"],
        "spec": "180cc鋁袋",
        "price": 200,
        "unit": "包",
        "offers": [{"qty": 12, "total": 2000, "label": "買10送2（12包）"}],
        "quantityOptions": [1, 3, 5, 12],
        "priceText": "$200 / 包",
        "priceLabel": "售價200元，買10送2",
    }
    pos = next((i + 1 for i, item in enumerate(products) if item.get("id") == "guilu-drink-30"), len(products))
    products.insert(pos, product180)

data["products"] = products
data["store"] = {
    **(data.get("store") or {}),
    "address": "台北市萬華區西昌街52號",
    "hours": "週一至週六 09:30–18:30",
    "holidayNote": "假日如未外出，可提前透過官方 LINE 預約。",
}
data["lineAssetsVersion"] = "309.0"
data["updatedAt"] = "2026-07-11"

# Keep the restored 180cc aluminium pouch in the combinations that were designed for the full-size drink.
for combo in (data.get("offers") or {}).get("comboOffers", []):
    name = combo.get("name", "")
    if name == "日常節奏組":
        combo["items"] = ["龜鹿膏 1 罐", "龜鹿飲180cc 5 包"]
        combo["products"] = [{"productId": "guilu-gao", "qty": 1}, {"productId": "guilu-drink-180", "qty": 5}]
    elif name == "日常便利組":
        combo["items"] = ["龜鹿膏 1 罐", "龜鹿飲180cc 12 包（買10送2）"]
        combo["products"] = [{"productId": "guilu-gao", "qty": 1}, {"productId": "guilu-drink-180", "qty": 12}]
    elif name == "完整體驗組":
        combo["items"] = ["龜鹿膏 1 罐", "龜鹿飲180cc 5 包", "龜鹿湯塊75g 1 盒", "鹿茸粉75g 1 罐"]
        combo["products"] = [
            {"productId": "guilu-gao", "qty": 1},
            {"productId": "guilu-drink-180", "qty": 5},
            {"productId": "guilu-tangkuai", "qty": 1},
            {"productId": "luerong-fen", "qty": 1},
        ]

# Correct a legacy typo without changing the rest of the catalog.
legacy = data.get("xianjiaweiFinalV80") or {}
legacy_products = legacy.get("products") or []
legacy["products"] = ["龜鹿飲180cc鋁袋" if value == "龜鹿飲30cc鋁袋" else value for value in legacy_products]
data["xianjiaweiFinalV80"] = legacy

DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# 2. Promote server-core.js into the only runtime server.js.
source = CORE.read_text(encoding="utf-8")
source = source.replace("v306.0", "v309.0")

new_paths = '''const MASCOT_PATHS = {
  welcome: "images/line-mascot/xianjiawei-mascot-line-welcome.jpg?v=309.0",
  products: "images/line-mascot/xianjiawei-mascot-line-products.jpg?v=309.0",
  recommend: "images/line-mascot/xianjiawei-mascot-line-recommend.jpg?v=309.0",
  combo: "images/line-mascot/xianjiawei-mascot-line-combo.jpg?v=309.0",
  usage: "images/line-mascot/xianjiawei-mascot-line-usage.jpg?v=309.0",
  faq: "images/line-mascot/xianjiawei-mascot-line-faq.jpg?v=309.0",
  service: "images/line-mascot/xianjiawei-mascot-line-service.jpg?v=309.0",
  brand: "images/line-mascot/xianjiawei-mascot-line-brand.jpg?v=309.0",
};'''
source, count = re.subn(r"const MASCOT_PATHS = \{.*?\n\};", new_paths, source, count=1, flags=re.S)
if count != 1:
    raise RuntimeError("MASCOT_PATHS replacement failed")

new_pose = '''function mascotPoseForTitle(title = "") {
  if (/常見問題|FAQ/.test(title)) return "faq";
  if (/客服|聯絡|確認|訂單|結帳|門市/.test(title)) return "service";
  if (/使用|沖泡|燉湯|料理/.test(title)) return "usage";
  if (/搭配/.test(title)) return "combo";
  if (/推薦|幫你選|怎麼選/.test(title)) return "recommend";
  if (/傳承|故事|品牌|資料|漢方|百科/.test(title)) return "brand";
  if (/產品|介紹|價格|購物車/.test(title)) return "products";
  return "welcome";
}'''
source, count = re.subn(r"function mascotPoseForTitle\(title = \"\"\) \{.*?\n\}", new_pose, source, count=1, flags=re.S)
if count != 1:
    raise RuntimeError("mascotPoseForTitle replacement failed")

# Keep the full product and mascot image visible in LINE Flex cards.
source = source.replace('aspectRatio: "1:1",\n      aspectMode: "cover",', 'aspectRatio: "1:1",\n      aspectMode: "contain",')

# Ensure 180cc is detected before the generic 30cc rule.
old_detect = '  if (/龜鹿飲.*30|30cc|玻璃瓶/.test(raw)) return getProduct("guilu-drink-30");'
new_detect = '  if (/龜鹿飲.*180|180cc|鋁袋/.test(raw)) return getProduct("guilu-drink-180");\n  if (/龜鹿飲.*30|30cc|玻璃瓶/.test(raw)) return getProduct("guilu-drink-30");'
if old_detect in source and 'getProduct("guilu-drink-180")' not in source[source.find("function detectProduct"):source.find("function startCheckout")]:
    source = source.replace(old_detect, new_detect, 1)

# Add one centralized store-service message instead of repeating hours in several branches.
store_helper = '''function storeServiceText() {
  const store = DATA.store || {};
  return `門市地址：${store.address || "台北市萬華區西昌街52號"}。\n營業時間：${store.hours || "週一至週六 09:30–18:30"}。\n${store.holidayNote || "假日如未外出，可提前透過官方 LINE 預約。"}\n\n請直接留下想詢問的產品、規格、數量、配送或取貨需求，我們會由人工協助回覆。`;
}

'''
if "function storeServiceText()" not in source:
    marker = "function flexCard(title, description, buttons = []) {"
    if marker not in source:
        raise RuntimeError("store helper insertion marker missing")
    source = source.replace(marker, store_helper + marker, 1)

source = source.replace(
    'if (websiteIntent === "human") return reply(event.replyToken, textMsg("請直接留下想詢問的內容，我們會由人工協助回覆。", mainQuick()));',
    'if (websiteIntent === "human") return reply(event.replyToken, textMsg(storeServiceText(), mainQuick()));'
)
source = source.replace(
    'return reply(event.replyToken, textMsg("請直接留下想詢問的內容，我們會由人工協助回覆。", mainQuick()));',
    'return reply(event.replyToken, textMsg(storeServiceText(), mainQuick()));'
)

hours_block = '''  if (/營業時間|門市時間|幾點營業|幾點關門|假日預約|預約門市|門市地址/.test(text)) {
    return reply(event.replyToken, textMsg(storeServiceText(), mainQuick()));
  }

'''
if "幾點營業" not in source:
    marker = '  if (/品牌故事|四代|鹿角伯|家族傳承|曾祖父|祖父|第三代|第四代/.test(text)) {'
    if marker not in source:
        raise RuntimeError("hours route insertion marker missing")
    source = source.replace(marker, hours_block + marker, 1)

# Make the expected production image paths explicit in the generated source.
required_paths = [
    "xianjiawei-mascot-line-welcome.jpg",
    "xianjiawei-mascot-line-products.jpg",
    "xianjiawei-mascot-line-recommend.jpg",
    "xianjiawei-mascot-line-combo.jpg",
    "xianjiawei-mascot-line-usage.jpg",
    "xianjiawei-mascot-line-faq.jpg",
    "xianjiawei-mascot-line-service.jpg",
    "xianjiawei-mascot-line-brand.jpg",
]
for name in required_paths:
    if name not in source:
        raise RuntimeError(f"missing LINE mascot asset path: {name}")

SERVER.write_text(source, encoding="utf-8")
CORE.unlink()

# 3. Point tests at the single runtime and the final LINE-specific assets.
for test_name in ["function.test.js", "security.test.js"]:
    test_path = ROOT / test_name
    text = test_path.read_text(encoding="utf-8")
    text = text.replace('fs.readFileSync("server-core.js", "utf8")', 'fs.readFileSync("server.js", "utf8")')
    text = text.replace('/images/brand/xianjiawei-scene-', '/images/line-mascot/xianjiawei-mascot-line-')
    test_path.write_text(text, encoding="utf-8")

print("LINE OA v309 consolidated into server.js with final mascot assets")
