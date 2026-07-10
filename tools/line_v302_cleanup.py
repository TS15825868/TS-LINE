from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
SERVER = ROOT / "server.js"
REMOVED_ID = "guilu-drink-180"

REPLACEMENTS = {
    "龜鹿飲30cc或180cc": "龜鹿飲30cc",
    "龜鹿飲 30cc 或 180cc": "龜鹿飲30cc",
    "30cc或180cc": "30cc",
    "30cc 或 180cc": "30cc",
    "30cc與180cc": "30cc",
    "30cc 與 180cc": "30cc",
    "30cc、180cc": "30cc",
    "30cc／180cc": "30cc",
    "龜鹿飲180cc": "龜鹿飲30cc",
    "龜鹿飲 180cc": "龜鹿飲30cc",
    "180cc鋁袋": "30cc玻璃瓶",
    "180 cc鋁袋": "30cc玻璃瓶",
}


def replace_text(text: str) -> str:
    for old, new in REPLACEMENTS.items():
        text = text.replace(old, new)
    text = re.sub(r"(?i)180\s*cc", "30cc", text)
    return text


def is_removed(value):
    if not isinstance(value, dict):
        return False
    probe = " ".join(str(value.get(k, "")) for k in ("id", "name", "displayName", "spec", "size", "page")).lower()
    return REMOVED_ID in probe or "180cc" in probe or "180 cc" in probe


def clean_json(value):
    if isinstance(value, list):
        out = []
        for item in value:
            if is_removed(item):
                continue
            cleaned = clean_json(item)
            if isinstance(cleaned, dict):
                for key in ("products", "components"):
                    if isinstance(cleaned.get(key), list):
                        cleaned[key] = [x for x in cleaned[key] if not (
                            isinstance(x, dict) and str(x.get("productId", x.get("id", ""))) == REMOVED_ID
                        )]
                lists = [cleaned.get(k) for k in ("products", "components") if isinstance(cleaned.get(k), list)]
                if lists and all(not x for x in lists):
                    continue
            out.append(cleaned)
        return out
    if isinstance(value, dict):
        return {k: clean_json(v) for k, v in value.items()}
    if isinstance(value, str):
        return replace_text(value)
    return value


def clean_data():
    path = ROOT / "data.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    data = clean_json(data)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def patch_server():
    text = SERVER.read_text(encoding="utf-8")
    text = text.replace("仙加味 LINE OA Bot v300.8", "仙加味 LINE OA Bot v302.0")
    text = re.sub(r'const VERSION = "v[^"]+";', 'const VERSION = "v302.0";', text, count=1)

    block = r'''const MASCOT_PATHS = {
  welcome: "images/brand/xianjiawei-scene-welcome.jpg?v=302.0",
  products: "images/brand/xianjiawei-scene-products.jpg?v=302.0",
  guide: "images/brand/xianjiawei-scene-guide.jpg?v=302.0",
  service: "images/brand/xianjiawei-scene-service.jpg?v=302.0",
  usage: "images/brand/xianjiawei-scene-usage.jpg?v=302.0",
};

function mascotPoseForTitle(title = "") {
  if (/搭配|產品|介紹|料理|價格/.test(title)) return "products";
  if (/推薦|幫你選|怎麼選|資料|漢方|百科|傳承|故事/.test(title)) return "guide";
  if (/使用|沖泡|燉湯/.test(title)) return "usage";
  if (/客服|常見問題|確認|訂單|購物車/.test(title)) return "service";
  return "welcome";
}
'''
    start = text.find("const MASCOT_PATHS = {")
    end = text.find("function mascotBubble", start)
    if start < 0 or end < 0:
        raise SystemExit("找不到 LINE 小老闆情境設定")
    text = text[:start] + block + "\n" + text[end:]

    text = text.replace("MASCOT_PATHS.wave", "MASCOT_PATHS.welcome")
    text = text.replace('          "tray"\n', '          "products"\n')

    kept_lines = []
    for line in text.splitlines():
        low = line.lower()
        if "guilu-drink-180" in low or "看180cc" in low:
            continue
        if "龜鹿飲.*180" in line or "180cc|鋁袋" in line:
            continue
        kept_lines.append(replace_text(line))
    text = "\n".join(kept_lines) + "\n"

    text = text.replace(
        "固定日常食補，可從龜鹿膏開始；需要外出或忙碌時方便飲用，可選龜鹿飲30cc。",
        "固定日常安排可從龜鹿膏開始；需要外出或忙碌時方便飲用，可查看龜鹿飲30cc。"
    )
    text = text.replace("仙加味小老闆｜歡迎您", "歡迎來到仙加味")
    text = text.replace("仙加味小老闆幫你選", "依日常使用方式幫你選")
    text = text.replace("小老闆搭配導覽", "日常搭配導覽")
    text = text.replace("小老闆使用方式導覽", "產品使用方式導覽")

    SERVER.write_text(text, encoding="utf-8")


def audit():
    server = SERVER.read_text(encoding="utf-8")
    data = (ROOT / "data.json").read_text(encoding="utf-8")
    bad = []
    for term in ("guilu-drink-180", "180cc", "180 cc", "MASCOT_PATHS.wave"):
        if term.lower() in server.lower() or term.lower() in data.lower():
            bad.append(term)
    if bad:
        raise SystemExit("LINE 公開內容仍有舊資料：" + ", ".join(bad))
    json.loads(data)


if __name__ == "__main__":
    clean_data()
    patch_server()
    audit()
