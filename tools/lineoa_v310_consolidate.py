from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
VERSION = "v310.0"
PACKAGE_VERSION = "3.1.0"
SITE_URL = "https://ts15825868.github.io/xianjiawei/"

server_path = ROOT / "server.js"
core_path = ROOT / "server-core.js"
data_path = ROOT / "data.json"
package_path = ROOT / "package.json"
lock_path = ROOT / "package-lock.json"

PRODUCT_180 = {
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


def update_data():
    data = json.loads(data_path.read_text(encoding="utf-8"))
    products = [p for p in data.get("products", []) if p.get("id") != PRODUCT_180["id"]]
    insert_at = next((i + 1 for i, p in enumerate(products) if p.get("id") == "guilu-drink-30"), len(products))
    products.insert(insert_at, PRODUCT_180)
    data["products"] = products
    data["siteUrl"] = data.get("siteUrl") or SITE_URL
    data["store"] = {
        **data.get("store", {}),
        "address": "台北市萬華區西昌街52號",
        "hours": "週一至週六 09:30–18:30",
        "holidayNote": "假日如未外出，可提前透過官方 LINE 預約。"
    }
    data.setdefault("retentionOffers", {}).setdefault("products", {})["龜鹿飲180cc鋁袋"] = "可依需求協助整理單包或買10送2方案。"
    data_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return data


def consolidate_server():
    source_path = core_path if core_path.exists() else server_path
    text = source_path.read_text(encoding="utf-8")

    # 移除過往 runtime wrapper，只保留完整正式主程式。
    if "runtime wrapper" in text or "runtimeModule._compile" in text:
        if not core_path.exists():
            raise RuntimeError("找到 runtime wrapper，但缺少 server-core.js")
        text = core_path.read_text(encoding="utf-8")

    text = re.sub(r"仙加味 LINE OA(?: Bot)? v[0-9.]+", f"仙加味 LINE OA Bot {VERSION}", text, count=1)
    text = re.sub(r'const VERSION = "v[0-9.]+";', f'const VERSION = "{VERSION}";', text, count=1)

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
    text, count = re.subn(r'const MASCOT_PATHS = \{.*?\n\};', new_paths, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError("MASCOT_PATHS replace failed")

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
    text, count = re.subn(r'function mascotPoseForTitle\(title = ""\) \{.*?\n\}', new_pose, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError("mascotPoseForTitle replace failed")

    # 小老闆與產品卡均完整顯示，不再裁切。
    text = re.sub(r'aspectMode: "cover"(?=,\n\s*backgroundColor: "#EFE4D2")', 'aspectMode: "contain"', text)

    detect_30 = '  if (/龜鹿飲.*30|30cc|玻璃瓶/.test(raw)) return getProduct("guilu-drink-30");'
    detect_180 = '  if (/龜鹿飲.*180|180cc|鋁袋/.test(raw)) return getProduct("guilu-drink-180");'
    if detect_180 not in text:
        if detect_30 not in text:
            raise RuntimeError("detectProduct anchor missing")
        text = text.replace(detect_30, detect_180 + "\n" + detect_30, 1)

    old_recommend = "想建立固定日常安排可從龜鹿膏開始；需要外出或忙碌時方便飲用，可查看龜鹿飲30cc。"
    new_recommend = "想建立固定日常安排可從龜鹿膏開始；需要輕巧攜帶可看龜鹿飲30cc，偏好較完整即飲份量可看龜鹿飲180cc鋁袋。"
    text = text.replace(old_recommend, new_recommend)

    anchor_30 = '{ label: "看30cc", text: "產品詳情｜guilu-drink-30" },'
    button_180 = '{ label: "看180cc", text: "產品詳情｜guilu-drink-180" },'
    if button_180 not in text and anchor_30 in text:
        text = text.replace(anchor_30, anchor_30 + "\n        " + button_180, 1)

    hours_block = '''  if (/營業時間|門市時間|幾點營業|幾點關門|假日預約|預約門市/.test(text)) {
    return reply(event.replyToken, textMsg("門市地址：台北市萬華區西昌街52號。\\n營業時間：週一至週六 09:30–18:30。\\n假日如未外出，可提前透過官方 LINE 預約。", mainQuick()));
  }

'''
    marker = '  if (/人工|客服|聯絡/.test(text)) {'
    if "幾點營業|幾點關門" not in text:
        if marker not in text:
            raise RuntimeError("customer service marker missing")
        text = text.replace(marker, hours_block + marker, 1)

    service_old = '請直接留下想詢問的內容，我們會由人工協助回覆。'
    service_new = '請直接留下想詢問的內容，我們會由人工協助回覆。\\n\\n門市地址：台北市萬華區西昌街52號。\\n營業時間：週一至週六 09:30–18:30。\\n假日如未外出，可提前透過官方 LINE 預約。'
    text = text.replace(service_old, service_new)

    server_path.write_text(text, encoding="utf-8")
    if core_path.exists():
        core_path.unlink()
    return text


def update_package_and_tests():
    pkg = json.loads(package_path.read_text(encoding="utf-8"))
    pkg["version"] = PACKAGE_VERSION
    pkg["main"] = "server.js"
    pkg.setdefault("scripts", {})["start"] = "node server.js"
    package_path.write_text(json.dumps(pkg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if lock_path.exists():
        lock = json.loads(lock_path.read_text(encoding="utf-8"))
        lock["version"] = PACKAGE_VERSION
        if "" in lock.get("packages", {}):
            lock["packages"][""]["version"] = PACKAGE_VERSION
        lock_path.write_text(json.dumps(lock, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    for filename in ["test.js", "security.test.js", "function.test.js", "catalog.test.js"]:
        path = ROOT / filename
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        text = re.sub(r'assert\.strictEqual\(VERSION, "v[0-9.]+"\);', f'assert.strictEqual(VERSION, "{VERSION}");', text)
        text = text.replace('fs.readFileSync("server-core.js", "utf8")', 'fs.readFileSync("server.js", "utf8")')
        text = text.replace('assert.strictEqual(productCards.contents.contents.length, 6);', 'assert.strictEqual(productCards.contents.contents.length, DATA.products.length + 1);')
        text = text.replace('assert.strictEqual(productMenuReply().contents.contents.length, 6);', 'assert.strictEqual(productMenuReply().contents.contents.length, DATA.products.length + 1);')
        text = text.replace('assert.strictEqual(priceCarousel().contents.contents.length, 6);', 'assert.strictEqual(priceCarousel().contents.contents.length, DATA.products.length);')
        text = text.replace('comboReply().contents.body.contents[1].text', 'comboReply().body.contents[1].text')
        text = text.replace('brandStoryReply().contents.body.contents[1].text', 'brandStoryReply().body.contents[1].text')
        text = re.sub(r'PASS ([^\n"]*?) v(?:300\.8|306\.0|309\.0)', rf'PASS \1 {VERSION}', text)
        path.write_text(text, encoding="utf-8")


def clean_stale_files():
    exact = [
        "LINEOA_V309_TRIGGER.txt",
        "V309_TEST_OUTPUT.txt",
        "V309_TEST_STATUS.txt",
        "LINE_V306_TRIGGER.txt",
        "LINE_MASCOT_TRIGGER.txt",
        "V305_PR_NOTE.txt",
    ]
    for name in exact:
        path = ROOT / name
        if path.exists():
            path.unlink()
    for pattern in ["LINE_MASCOT_PR_TRIGGER_*.txt", "LINE_V30*_TRIGGER*.txt"]:
        for path in ROOT.glob(pattern):
            path.unlink()
    for path in (ROOT / ".github" / "workflows").glob("*v30*.yml"):
        if path.name != "lineoa-v310-consolidate.yml":
            path.unlink()
    for path in (ROOT / "tools").glob("*v30*.py"):
        if path.name != "lineoa_v310_consolidate.py":
            path.unlink()


data = update_data()
server = consolidate_server()
update_package_and_tests()
clean_stale_files()

assert not core_path.exists(), "server-core.js should be removed"
assert "runtime wrapper" not in server
assert f'const VERSION = "{VERSION}";' in server
assert 'aspectMode: "contain"' in server
assert '龜鹿飲.*180|180cc|鋁袋' in server
assert '週一至週六 09:30–18:30' in server
assert [p["id"] for p in data["products"]] == [
    "guilu-gao", "guilu-drink-30", "guilu-drink-180", "guilu-tangkuai", "guilu-jiao", "luerong-fen"
]
assert data["store"]["hours"] == "週一至週六 09:30–18:30"
print("LINE OA v310 consolidated")
