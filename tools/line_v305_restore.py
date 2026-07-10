from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
VERSION = "v305.0"

PRODUCT_180 = {
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


def update_data():
    path = ROOT / "data.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    products = [p for p in data.get("products", []) if p.get("id") != "guilu-drink-180"]
    idx = next((i + 1 for i, p in enumerate(products) if p.get("id") == "guilu-drink-30"), len(products))
    products.insert(idx, PRODUCT_180)
    data["products"] = products
    data["store"] = {
      "address": "台北市萬華區西昌街52號",
      "hours": "週一至週六 09:30–18:30",
      "holidayNote": "假日如未外出，可提前透過官方 LINE 預約。"
    }
    data.setdefault("retentionOffers", {}).setdefault("products", {})["龜鹿飲180cc鋁袋"] = "可依需求協助整理單包或買10送2方案。"
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def update_server():
    path = ROOT / "server.js"
    text = path.read_text(encoding="utf-8")
    text = text.replace("仙加味 LINE OA Bot v303.0", "仙加味 LINE OA Bot v305.0")
    text = re.sub(r'const VERSION = "v[0-9.]+";', f'const VERSION = "{VERSION}";', text, count=1)
    text = re.sub(r'xianjiawei-scene-([a-z]+)\.jpg\?v=[0-9.]+', rf'xianjiawei-scene-\1.jpg?v=305.0', text)
    text = text.replace('aspectRatio: "4:5",\n    aspectMode: "cover",', 'aspectRatio: "4:3",\n    aspectMode: "contain",')
    text = text.replace(
      '"想建立固定日常安排可從龜鹿膏開始；需要外出或忙碌時方便飲用，可查看龜鹿飲30cc。",',
      '"想建立固定日常安排可從龜鹿膏開始；需要輕巧攜帶可看龜鹿飲30cc，想要較完整份量可看龜鹿飲180cc鋁袋。",'
    )
    text = text.replace(
      '{ label: "看30cc", text: "產品詳情｜guilu-drink-30" },',
      '{ label: "看30cc", text: "產品詳情｜guilu-drink-30" },\n        { label: "看180cc", text: "產品詳情｜guilu-drink-180" },'
    )
    old_detect = '  if (/龜鹿飲.*30|30cc|玻璃瓶/.test(raw)) return getProduct("guilu-drink-30");'
    new_detect = '  if (/龜鹿飲.*180|180cc|鋁袋/.test(raw)) return getProduct("guilu-drink-180");\n  if (/龜鹿飲.*30|30cc|玻璃瓶/.test(raw)) return getProduct("guilu-drink-30");'
    text = text.replace(old_detect, new_detect)
    human = "請直接留下想詢問的內容，我們會由人工協助回覆。"
    human_new = "請直接留下想詢問的內容，我們會由人工協助回覆。\n\n門市營業時間：週一至週六 09:30–18:30。\n假日如未外出，可提前透過官方 LINE 預約。"
    text = text.replace(human, human_new)
    fallback = "您可以直接輸入產品名稱、價格、怎麼選、搭配組合、怎麼使用、品牌故事、購物車或人工客服。"
    fallback_new = "您可以直接輸入產品名稱、價格、怎麼選、搭配組合、怎麼使用、門市時間、品牌故事、購物車或人工客服。"
    text = text.replace(fallback, fallback_new)

    # 門市／營業時間直接回覆，避免只轉人工而沒有資訊。
    anchor = '  if (/人工|客服|聯絡/.test(text)) {'
    block = '''  if (/營業時間|門市時間|幾點營業|幾點關門|假日預約|預約門市/.test(text)) {
    return reply(event.replyToken, textMsg("門市地址：台北市萬華區西昌街52號。\n營業時間：週一至週六 09:30–18:30。\n假日如未外出，可提前透過官方 LINE 預約。", mainQuick()));
  }

'''
    if block.strip() not in text and anchor in text:
        text = text.replace(anchor, block + anchor, 1)
    path.write_text(text, encoding="utf-8")


def validate():
    data = json.loads((ROOT / "data.json").read_text(encoding="utf-8"))
    ids = [p.get("id") for p in data.get("products", [])]
    assert ids.count("guilu-drink-180") == 1
    p = next(p for p in data["products"] if p["id"] == "guilu-drink-180")
    assert p["price"] == 200 and p["offers"][0]["total"] == 2000
    server = (ROOT / "server.js").read_text(encoding="utf-8")
    assert 'getProduct("guilu-drink-180")' in server
    assert "週一至週六 09:30–18:30" in server
    assert 'aspectMode: "contain"' in server


if __name__ == "__main__":
    update_data()
    update_server()
    validate()
