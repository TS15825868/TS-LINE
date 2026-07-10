from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
SERVER = ROOT / "server.js"
CORE = ROOT / "server-core.js"
DATA = ROOT / "data.json"
PACKAGE = ROOT / "package.json"
LOCK = ROOT / "package-lock.json"
VERSION = "v311.0"
PACKAGE_VERSION = "3.1.1"

# 產品與門市資料只保留在 data.json。
data = json.loads(DATA.read_text(encoding="utf-8"))
product180 = {
    "id": "guilu-drink-180",
    "series": "仙加味・龜鹿",
    "name": "龜鹿飲180cc鋁袋",
    "displayName": "龜鹿飲180cc鋁袋",
    "size": "180cc／包（鋁袋）",
    "image": "images/products-v3/guilu-drink-180.jpg?v=307.1",
    "dmImage": "images/dm-final/03_guilu-drink-180cc-dm.jpg?v=307.1",
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
products = [p for p in data.get("products", []) if p.get("id") != "guilu-drink-180"]
pos = next((i + 1 for i, p in enumerate(products) if p.get("id") == "guilu-drink-30"), len(products))
products.insert(pos, product180)
data["products"] = products
data["siteUrl"] = "https://ts15825868.github.io/xianjiawei/"
data["store"] = {
    **data.get("store", {}),
    "address": "台北市萬華區西昌街52號",
    "hours": "週一至週六 09:30–18:30",
    "holidayNote": "假日如未外出，可提前透過官方 LINE 預約。"
}
data["lineAssetsVersion"] = "311.0"

# 恢復180cc鋁袋後，原本以完整份量龜鹿飲設計的組合也統一指向180cc。
for combo in data.get("offers", {}).get("comboOffers", []):
    name = combo.get("name", "")
    if name == "日常節奏組":
        combo["items"] = ["龜鹿膏 1 罐", "龜鹿飲180cc 5 包"]
        combo["products"] = [
            {"productId": "guilu-gao", "qty": 1},
            {"productId": "guilu-drink-180", "qty": 5}
        ]
    elif name == "日常便利組":
        combo["items"] = ["龜鹿膏 1 罐", "龜鹿飲180cc 12 包（買10送2）"]
        combo["products"] = [
            {"productId": "guilu-gao", "qty": 1},
            {"productId": "guilu-drink-180", "qty": 12}
        ]
    elif name == "完整體驗組":
        combo["items"] = ["龜鹿膏 1 罐", "龜鹿飲180cc 5 包", "龜鹿湯塊75g 1 盒", "鹿茸粉75g 1 罐"]
        combo["products"] = [
            {"productId": "guilu-gao", "qty": 1},
            {"productId": "guilu-drink-180", "qty": 5},
            {"productId": "guilu-tangkuai", "qty": 1},
            {"productId": "luerong-fen", "qty": 1}
        ]

legacy = data.get("xianjiaweiFinalV80", {})
legacy["products"] = [
    "龜鹿飲180cc鋁袋" if item == "龜鹿飲30cc鋁袋" else item
    for item in legacy.get("products", [])
]
data["xianjiaweiFinalV80"] = legacy
DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# 將完整核心直接寫成唯一 server.js，移除 runtime wrapper 與 server-core.js。
source_path = CORE if CORE.exists() else SERVER
source = source_path.read_text(encoding="utf-8")
if "runtimeModule._compile" in source and CORE.exists():
    source = CORE.read_text(encoding="utf-8")
source = re.sub(r"仙加味 LINE OA(?: Bot)? v[0-9.]+", f"仙加味 LINE OA Bot {VERSION}", source, count=1)
source = re.sub(r'const VERSION = "v[0-9.]+";', f'const VERSION = "{VERSION}";', source, count=1)

paths = '''const MASCOT_PATHS = {
  welcome: "images/line-mascot/xianjiawei-mascot-line-welcome.jpg?v=311.0",
  products: "images/line-mascot/xianjiawei-mascot-line-products.jpg?v=311.0",
  recommend: "images/line-mascot/xianjiawei-mascot-line-recommend.jpg?v=311.0",
  combo: "images/line-mascot/xianjiawei-mascot-line-combo.jpg?v=311.0",
  usage: "images/line-mascot/xianjiawei-mascot-line-usage.jpg?v=311.0",
  faq: "images/line-mascot/xianjiawei-mascot-line-faq.jpg?v=311.0",
  service: "images/line-mascot/xianjiawei-mascot-line-service.jpg?v=311.0",
  brand: "images/line-mascot/xianjiawei-mascot-line-brand.jpg?v=311.0",
};'''
source, count = re.subn(r'const MASCOT_PATHS = \{.*?\n\};', paths, source, count=1, flags=re.S)
if count != 1:
    raise RuntimeError("MASCOT_PATHS replacement failed")

pose = '''function mascotPoseForTitle(title = "") {
  if (/常見問題|FAQ/.test(title)) return "faq";
  if (/客服|聯絡|確認|訂單|結帳|門市/.test(title)) return "service";
  if (/使用|沖泡|燉湯|料理/.test(title)) return "usage";
  if (/搭配|組合/.test(title)) return "combo";
  if (/推薦|幫你選|怎麼選/.test(title)) return "recommend";
  if (/傳承|故事|品牌|漢方|百科|資料/.test(title)) return "brand";
  if (/產品|介紹|價格|購物車/.test(title)) return "products";
  return "welcome";
}'''
source, count = re.subn(r'function mascotPoseForTitle\(title = ""\) \{.*?\n\}', pose, source, count=1, flags=re.S)
if count != 1:
    raise RuntimeError("mascotPoseForTitle replacement failed")

# 所有有米色底的產品與角色圖都完整顯示，不裁切。
source = re.sub(r'aspectMode: "cover"(?=,\n\s*backgroundColor: "#EFE4D2")', 'aspectMode: "contain"', source)

# 確保180cc辨識優先於30cc。
detect30 = '  if (/龜鹿飲.*30|30cc|玻璃瓶/.test(raw)) return getProduct("guilu-drink-30");'
detect180 = '  if (/龜鹿飲.*180|180cc|鋁袋/.test(raw)) return getProduct("guilu-drink-180");'
segment = source[source.find("function detectProduct"):source.find("function startCheckout")]
if detect180 not in segment:
    if detect30 not in source:
        raise RuntimeError("detectProduct anchor missing")
    source = source.replace(detect30, detect180 + "\n" + detect30, 1)

# 門市資料集中由 data.json 讀取。
helper = '''function storeServiceText() {
  const store = DATA.store || {};
  return `門市地址：${store.address || "台北市萬華區西昌街52號"}。\n營業時間：${store.hours || "週一至週六 09:30–18:30"}。\n${store.holidayNote || "假日如未外出，可提前透過官方 LINE 預約。"}\n\n請直接留下想詢問的產品、規格、數量、配送或取貨需求，我們會由人工協助回覆。`;
}

'''
if "function storeServiceText()" not in source:
    anchor = "function flexCard(title, description, buttons = []) {"
    source = source.replace(anchor, helper + anchor, 1)
source = source.replace('textMsg("請直接留下想詢問的內容，我們會由人工協助回覆。", mainQuick())', 'textMsg(storeServiceText(), mainQuick())')
if "幾點營業|幾點關門" not in source:
    route = '''  if (/營業時間|門市時間|幾點營業|幾點關門|假日預約|預約門市|門市地址/.test(text)) {
    return reply(event.replyToken, textMsg(storeServiceText(), mainQuick()));
  }

'''
    anchor = '  if (/品牌故事|四代|鹿角伯|家族傳承|曾祖父|祖父|第三代|第四代/.test(text)) {'
    source = source.replace(anchor, route + anchor, 1)

SERVER.write_text(source, encoding="utf-8")
if CORE.exists():
    CORE.unlink()

# 套件版本與測試同步。
pkg = json.loads(PACKAGE.read_text(encoding="utf-8"))
pkg["version"] = PACKAGE_VERSION
pkg["main"] = "server.js"
pkg.setdefault("scripts", {})["start"] = "node server.js"
PACKAGE.write_text(json.dumps(pkg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
if LOCK.exists():
    lock = json.loads(LOCK.read_text(encoding="utf-8"))
    lock["version"] = PACKAGE_VERSION
    if "" in lock.get("packages", {}):
        lock["packages"][""]["version"] = PACKAGE_VERSION
    LOCK.write_text(json.dumps(lock, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

for name in ["test.js", "security.test.js", "function.test.js", "catalog.test.js"]:
    p = ROOT / name
    if not p.exists():
        continue
    text = p.read_text(encoding="utf-8")
    text = re.sub(r'assert\.strictEqual\(VERSION, "v[0-9.]+"\);', f'assert.strictEqual(VERSION, "{VERSION}");', text)
    text = text.replace('fs.readFileSync("server-core.js", "utf8")', 'fs.readFileSync("server.js", "utf8")')
    text = text.replace('assert.strictEqual(productCards.contents.contents.length, 6);', 'assert.strictEqual(productCards.contents.contents.length, DATA.products.length + 1);')
    text = text.replace('assert.strictEqual(productMenuReply().contents.contents.length, 6);', 'assert.strictEqual(productMenuReply().contents.contents.length, DATA.products.length + 1);')
    text = text.replace('assert.strictEqual(priceCarousel().contents.contents.length, 6);', 'assert.strictEqual(priceCarousel().contents.contents.length, DATA.products.length);')
    text = text.replace('comboReply().contents.body.contents[1].text', 'comboReply().body.contents[1].text')
    text = text.replace('brandStoryReply().contents.body.contents[1].text', 'brandStoryReply().body.contents[1].text')
    text = text.replace('includes("小老闆搭配導覽")', 'includes("日常搭配導覽")')
    text = text.replace('/images/brand/xianjiawei-scene-', '/images/line-mascot/xianjiawei-mascot-line-')
    p.write_text(text, encoding="utf-8")

# 移除舊的暫存、診斷與一次性檔案。
for name in ["LINEOA_V309_TRIGGER.txt", "V309_TEST_OUTPUT.txt", "V309_TEST_STATUS.txt", "LINEOA_V310_TRIGGER.txt"]:
    p = ROOT / name
    if p.exists():
        p.unlink()
for p in (ROOT / "tools").glob("*v30*.py"):
    p.unlink()
for p in (ROOT / ".github" / "workflows").glob("*v30*.yml"):
    p.unlink()

assert not CORE.exists()
assert 'const VERSION = "v311.0";' in source
assert 'runtimeModule._compile' not in source
assert 'images/line-mascot/xianjiawei-mascot-line-welcome.jpg?v=311.0' in source
assert 'aspectMode: "contain"' in source
assert [p["id"] for p in data["products"]] == ["guilu-gao", "guilu-drink-30", "guilu-drink-180", "guilu-tangkuai", "guilu-jiao", "luerong-fen"]
assert data["store"]["hours"] == "週一至週六 09:30–18:30"
assert any("龜鹿飲180cc 5 包" in item for c in data.get("offers", {}).get("comboOffers", []) for item in c.get("items", []))
print("LINE OA v311 finalized")
