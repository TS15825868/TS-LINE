from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
VERSION = "v307.1"
PACKAGE_VERSION = "3.0.10"

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
    path = ROOT / "data.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    products = [p for p in data.get("products", []) if p.get("id") != PRODUCT_180["id"]]
    index = next((i + 1 for i, p in enumerate(products) if p.get("id") == "guilu-drink-30"), len(products))
    products.insert(index, PRODUCT_180)
    data["products"] = products
    data["siteUrl"] = data.get("siteUrl") or "https://ts15825868.github.io/xianjiawei/"
    data["store"] = {
        **data.get("store", {}),
        "address": "台北市萬華區西昌街52號",
        "hours": "週一至週六 09:30–18:30",
        "holidayNote": "假日如未外出，可提前透過官方 LINE 預約。"
    }
    data.setdefault("retentionOffers", {}).setdefault("products", {})["龜鹿飲180cc鋁袋"] = "可依需求協助整理單包或買10送2方案。"
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def consolidate_server():
    core_path = ROOT / "server-core.js"
    source_path = core_path if core_path.exists() else ROOT / "server.js"
    text = source_path.read_text(encoding="utf-8")

    text = re.sub(r"仙加味 LINE OA(?: Bot)? v[0-9.]+", "仙加味 LINE OA Bot v307.1", text, count=1)
    text = re.sub(r'const VERSION = "v[0-9.]+";', 'const VERSION = "v307.1";', text, count=1)
    text = re.sub(r"\?v=(?:303|305|306|307)\.[0-9]+", "?v=307.1", text)
    text = re.sub(r'aspectMode: "cover"(?=,\n\s*backgroundColor: "#EFE4D2")', 'aspectMode: "contain"', text)

    detect_30 = '  if (/龜鹿飲.*30|30cc|玻璃瓶/.test(raw)) return getProduct("guilu-drink-30");'
    detect_180 = '  if (/龜鹿飲.*180|180cc|鋁袋/.test(raw)) return getProduct("guilu-drink-180");'
    if detect_180 not in text and detect_30 in text:
        text = text.replace(detect_30, detect_180 + "\n" + detect_30, 1)

    if '{ label: "看180cc", text: "產品詳情｜guilu-drink-180" },' not in text:
        anchor = '{ label: "看30cc", text: "產品詳情｜guilu-drink-30" },'
        if anchor in text:
            text = text.replace(anchor, anchor + '\n        { label: "看180cc", text: "產品詳情｜guilu-drink-180" },', 1)

    text = text.replace(
        "想建立固定日常安排可從龜鹿膏開始；需要外出或忙碌時方便飲用，可查看龜鹿飲30cc。",
        "想建立固定日常安排可從龜鹿膏開始；需要輕巧攜帶可看龜鹿飲30cc，偏好較完整即飲份量可看龜鹿飲180cc鋁袋。"
    )

    business_block = '''  if (/營業時間|門市時間|幾點營業|幾點關門|假日預約|預約門市/.test(text)) {
    return reply(event.replyToken, textMsg("門市地址：台北市萬華區西昌街52號。\\n營業時間：週一至週六 09:30–18:30。\\n假日如未外出，可提前透過官方 LINE 預約。", mainQuick()));
  }

'''
    if "幾點營業|幾點關門" not in text:
        anchor = '  if (/人工|客服|聯絡/.test(text)) {'
        if anchor in text:
            text = text.replace(anchor, business_block + anchor, 1)

    human_old = "請直接留下想詢問的內容，我們會由人工協助回覆。"
    human_new = "請直接留下想詢問的內容，我們會由人工協助回覆。\\n\\n門市營業時間：週一至週六 09:30–18:30。\\n假日如未外出，可提前透過官方 LINE 預約。"
    if human_new not in text:
        text = text.replace(human_old, human_new)

    (ROOT / "server.js").write_text(text, encoding="utf-8")
    if core_path.exists():
        core_path.unlink()


def update_tests_and_package():
    package_path = ROOT / "package.json"
    package = json.loads(package_path.read_text(encoding="utf-8"))
    package["version"] = PACKAGE_VERSION
    package["main"] = "server.js"
    package.setdefault("scripts", {})["start"] = "node server.js"
    package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    lock_path = ROOT / "package-lock.json"
    if lock_path.exists():
        lock = json.loads(lock_path.read_text(encoding="utf-8"))
        lock["version"] = PACKAGE_VERSION
        if "" in lock.get("packages", {}):
            lock["packages"][""]["version"] = PACKAGE_VERSION
        lock_path.write_text(json.dumps(lock, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    test_path = ROOT / "test.js"
    if test_path.exists():
        text = test_path.read_text(encoding="utf-8")
        text = re.sub(r'assert\.strictEqual\(VERSION, "v[0-9.]+"\);', 'assert.strictEqual(VERSION, "v307.1");', text)
        text = re.sub(r'assert\.strictEqual\(productCards\.contents\.contents\.length, \d+\);', 'assert.strictEqual(productCards.contents.contents.length, DATA.products.length + 1);', text)
        text = re.sub(r'assert\.strictEqual\(priceCarousel\(\)\.contents\.contents\.length, \d+\);', 'assert.strictEqual(priceCarousel().contents.contents.length, DATA.products.length);', text)
        text = re.sub(r'assert\.strictEqual\(productMenuReply\(\)\.contents\.contents\.length, \d+\);', 'assert.strictEqual(productMenuReply().contents.contents.length, DATA.products.length + 1);', text)
        test_path.write_text(text, encoding="utf-8")


def update_rich_menu_docs():
    actions_path = ROOT / "rich-menu-actions.json"
    if actions_path.exists():
        actions = json.loads(actions_path.read_text(encoding="utf-8"))
        actions["name"] = "仙加味服務 v307.1"
        actions_path.write_text(json.dumps(actions, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    setup_path = ROOT / "RICH_MENU_SETUP.md"
    if setup_path.exists():
        text = setup_path.read_text(encoding="utf-8")
        text = re.sub(r"xianjiawei-rich-menu-2500x1686(?:-v307)?\.jpg", "xianjiawei-rich-menu-2500x1686-v307.jpg", text)
        if "新版採大型主標文字" not in text:
            text = text.replace("## 注意", "## 圖片字級\n\n新版採大型主標文字，手機顯示更清楚。\n\n## 注意")
        setup_path.write_text(text, encoding="utf-8")


def clean_stale_files():
    for item in ["LINE_V306_TRIGGER.txt", "LINE_MASCOT_TRIGGER.txt", "V305_PR_NOTE.txt", "V307_LINE_TRIGGER.txt", "V307_LINE_PR_TRIGGER_2.txt"]:
        path = ROOT / item
        if path.exists():
            path.unlink()


update_data()
consolidate_server()
update_tests_and_package()
update_rich_menu_docs()
clean_stale_files()

server = (ROOT / "server.js").read_text(encoding="utf-8")
data = json.loads((ROOT / "data.json").read_text(encoding="utf-8"))
assert not (ROOT / "server-core.js").exists()
assert "runtime wrapper" not in server
assert 'const VERSION = "v307.1";' in server
assert any(p.get("id") == "guilu-drink-180" for p in data["products"])
assert data["store"]["hours"] == "週一至週六 09:30–18:30"
assert 'aspectMode: "contain"' in server
print("LINE OA v307.1 consolidated")
