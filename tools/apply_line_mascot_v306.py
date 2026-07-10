from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
core_path = ROOT / 'server-core.js'
core = core_path.read_text(encoding='utf-8')

core = core.replace('仙加味 LINE OA Bot v303.0', '仙加味 LINE OA Bot v306.0')
core = re.sub(r'const VERSION = "v[0-9.]+";', 'const VERSION = "v306.0";', core, count=1)
core = re.sub(r'xianjiawei-scene-([a-z]+)\.jpg\?v=[0-9.]+', r'xianjiawei-scene-\1.jpg?v=306.0', core)
core = core.replace('aspectRatio: "4:5",\n    aspectMode: "cover",', 'aspectRatio: "4:3",\n    aspectMode: "contain",')

# 依功能選擇固定角色情境；同一角色、不同動作，不裁切。
old = '''function mascotPoseForTitle(title = "") {
  if (/搭配|產品|介紹|料理|價格/.test(title)) return "products";
  if (/推薦|幫你選|怎麼選|資料|漢方|百科|傳承|故事/.test(title)) return "guide";
  if (/使用|沖泡|燉湯/.test(title)) return "usage";
  if (/客服|常見問題|確認|訂單|購物車/.test(title)) return "service";
  return "welcome";
}'''
new = '''function mascotPoseForTitle(title = "") {
  if (/客服|聯絡|確認|訂單|結帳/.test(title)) return "service";
  if (/常見問題|FAQ/.test(title)) return "service";
  if (/使用|沖泡|燉湯|料理/.test(title)) return "usage";
  if (/推薦|幫你選|怎麼選|資料|漢方|百科|傳承|故事/.test(title)) return "guide";
  if (/搭配|產品|介紹|價格|購物車/.test(title)) return "products";
  return "welcome";
}'''
if old in core:
    core = core.replace(old, new)

# 推薦回覆同步保留180cc鋁袋。
core = core.replace(
    '想建立固定日常安排可從龜鹿膏開始；需要外出或忙碌時方便飲用，可查看龜鹿飲30cc。',
    '想建立固定日常安排可從龜鹿膏開始；需要輕巧攜帶可看龜鹿飲30cc，偏好較完整即飲份量可看龜鹿飲180cc鋁袋。'
)
if '{ label: "看180cc", text: "產品詳情｜guilu-drink-180" },' not in core:
    core = core.replace(
        '{ label: "看30cc", text: "產品詳情｜guilu-drink-30" },',
        '{ label: "看30cc", text: "產品詳情｜guilu-drink-30" },\n        { label: "看180cc", text: "產品詳情｜guilu-drink-180" },'
    )
core_path.write_text(core, encoding='utf-8')

wrapper_path = ROOT / 'server.js'
wrapper = wrapper_path.read_text(encoding='utf-8')
wrapper = wrapper.replace('仙加味 LINE OA v305 runtime wrapper', '仙加味 LINE OA v306 runtime wrapper')
wrapper = wrapper.replace('仙加味 LINE OA Bot v305.0', '仙加味 LINE OA Bot v306.0')
wrapper = wrapper.replace('const VERSION = "v305.0";', 'const VERSION = "v306.0";')
wrapper = wrapper.replace('仙加味 LINE OA v305.0 running', '仙加味 LINE OA v306.0 running')
wrapper = re.sub(r'xianjiawei-scene-\(\[a-z\]\+\)\\\.jpg\\\?v=303\\\.0', r'xianjiawei-scene-([a-z]+)\\.jpg\\?v=306\\.0', wrapper)
wrapper = wrapper.replace('.replace(/xianjiawei-scene-([a-z]+)\\.jpg\\?v=303\\.0/g, "xianjiawei-scene-$1.jpg?v=305.0")', '.replace(/xianjiawei-scene-([a-z]+)\\.jpg\\?v=[0-9.]+/g, "xianjiawei-scene-$1.jpg?v=306.0")')
wrapper = wrapper.replace('aspectRatio: "4:5",\\n    aspectMode: "cover",', 'aspectRatio: "4:3",\\n    aspectMode: "contain",')
wrapper_path.write_text(wrapper, encoding='utf-8')

for required in ('welcome', 'products', 'guide', 'service', 'usage'):
    expected = f'xianjiawei-scene-{required}.jpg?v=306.0'
    if expected not in core:
        raise SystemExit(f'LINE OA 缺少新版情境圖引用：{expected}')
if 'aspectMode: "contain"' not in core:
    raise SystemExit('LINE OA 圖片仍未使用 contain')
