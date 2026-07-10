from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
data_path = ROOT / "data.json"
core_path = ROOT / "server-core.js"
server_path = ROOT / "server.js"
package_path = ROOT / "package.json"

# 1. data.json 成為唯一產品與門市資料來源
data = json.loads(data_path.read_text(encoding="utf-8"))
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
    "priceLabel": "售價200元，買10送2"
}
products = [p for p in data.get("products", []) if p.get("id") != product180["id"]]
idx = next((i for i, p in enumerate(products) if p.get("id") == "guilu-drink-30"), len(products) - 1)
products.insert(idx + 1, product180)
data["products"] = products
data["store"] = {
    **data.get("store", {}),
    "address": "台北市萬華區西昌街52號",
    "hours": "週一至週六 09:30–18:30",
    "holidayNote": "假日如未外出，可提前透過官方 LINE 預約。"
}
data_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# 2. server-core.js 直接使用正式資料與高解析共用圖，不再由 server.js 動態改程式
core = core_path.read_text(encoding="utf-8")
core = re.sub(r'const VERSION = "v[^"]+";', 'const VERSION = "v309.0";', core, count=1)

new_paths = '''const MASCOT_PATHS = {
  welcome: "images/brand/xianjiawei-scene-welcome.jpg?v=307.1",
  products: "images/brand/xianjiawei-scene-products.jpg?v=307.1",
  recommend: "images/brand/xianjiawei-scene-guide.jpg?v=307.1",
  combo: "images/brand/xianjiawei-scene-products.jpg?v=307.1",
  usage: "images/brand/xianjiawei-scene-usage.jpg?v=307.1",
  faq: "images/brand/xianjiawei-scene-service.jpg?v=307.1",
  service: "images/brand/xianjiawei-scene-service.jpg?v=307.1",
  brand: "images/brand/xianjiawei-scene-guide.jpg?v=307.1",
};'''
core, n = re.subn(r'const MASCOT_PATHS = \{.*?\n\};', new_paths, core, count=1, flags=re.S)
assert n == 1, "MASCOT_PATHS replace failed"

new_pose = '''function mascotPoseForTitle(title = "") {
  if (/客服|聯絡|確認|訂單|結帳/.test(title)) return "service";
  if (/常見問題|FAQ/.test(title)) return "faq";
  if (/使用|沖泡|燉湯|料理/.test(title)) return "usage";
  if (/搭配|組合/.test(title)) return "combo";
  if (/推薦|幫你選|怎麼選/.test(title)) return "recommend";
  if (/傳承|故事|品牌|漢方|百科|資料/.test(title)) return "brand";
  if (/產品|介紹|價格|購物車/.test(title)) return "products";
  return "welcome";
}'''
core, n = re.subn(r'function mascotPoseForTitle\(title = ""\) \{.*?\n\}', new_pose, core, count=1, flags=re.S)
assert n == 1, "mascotPoseForTitle replace failed"

if '龜鹿飲.*180|180cc|鋁袋' not in core:
    core = core.replace(
        '  if (/龜鹿飲.*30|30cc|玻璃瓶/.test(raw)) return getProduct("guilu-drink-30");',
        '  if (/龜鹿飲.*180|180cc|鋁袋/.test(raw)) return getProduct("guilu-drink-180");\n  if (/龜鹿飲.*30|30cc|玻璃瓶/.test(raw)) return getProduct("guilu-drink-30");'
    )

service_text = '請直接留下想詢問的內容，我們會由人工協助回覆。\\n\\n門市地址：台北市萬華區西昌街52號。\\n營業時間：週一至週六 09:30–18:30。\\n假日如未外出，可提前透過官方 LINE 預約。'
core = core.replace(
    'textMsg("請直接留下想詢問的內容，我們會由人工協助回覆。", mainQuick())',
    f'textMsg("{service_text}", mainQuick())'
)

hours_block = '''  if (/營業時間|門市時間|幾點營業|幾點關門|假日預約|預約門市/.test(text)) {
    return reply(event.replyToken, textMsg("門市地址：台北市萬華區西昌街52號。\\n營業時間：週一至週六 09:30–18:30。\\n假日如未外出，可提前透過官方 LINE 預約。", mainQuick()));
  }

'''
marker = '  if (/人工|客服|聯絡/.test(text)) {'
if hours_block.strip() not in core:
    assert marker in core, "customer service marker missing"
    core = core.replace(marker, hours_block + marker, 1)

core_path.write_text(core, encoding="utf-8")

# 3. server.js 僅作單純啟動入口，移除執行時改寫 data 與 source 的不穩定作法
server_path.write_text('''"use strict";\n\nconst core = require("./server-core");\n\nif (require.main === module) {\n  const port = process.env.PORT || 3000;\n  core.app.listen(port, () => console.log(`仙加味 LINE OA v309.0 running on ${port}`));\n}\n\nmodule.exports = core;\n''', encoding="utf-8")

pkg = json.loads(package_path.read_text(encoding="utf-8"))
pkg["version"] = "3.0.9"
package_path.write_text(json.dumps(pkg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# 必要檢查
assert any(p.get("id") == "guilu-drink-180" for p in data["products"])
assert 'aspectMode: "contain"' in core
assert 'xianjiawei-scene-welcome.jpg?v=307.1' in core
assert '龜鹿飲.*180|180cc|鋁袋' in core
assert '週一至週六 09:30–18:30' in core
print("LINE OA v309 files prepared")
