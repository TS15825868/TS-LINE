from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SERVER = ROOT / "server.js"


def patch_server():
    text = SERVER.read_text(encoding="utf-8")
    text = text.replace('const VERSION = "v300.8";', 'const VERSION = "v301.0";')

    mascot_block = r'''const MASCOT_PATHS = {
  wave: "images/brand/xianjiawei-mascot-wave.jpg?v=301.0",
  tray: "images/brand/xianjiawei-mascot-tray.jpg?v=301.0",
  full: "images/brand/xianjiawei-mascot-full.jpg?v=301.0",
  thumbs: "images/brand/xianjiawei-mascot-thumbs.jpg?v=301.0",
};

function mascotPoseForTitle(title = "") {
  if (/搭配|產品|介紹|料理/.test(title)) return "tray";
  if (/推薦|幫你選|怎麼選|常見問題|確認/.test(title)) return "thumbs";
  if (/品牌|故事|傳承|使用|資料|漢方|百科/.test(title)) return "full";
  return "wave";
}

function mascotBubble(title, description, buttons, pose = "") {
  const bubble = flexCard(title, description, buttons).contents;
  const imagePath = MASCOT_PATHS[pose || mascotPoseForTitle(title)] || MASCOT_PATHS.wave;
  bubble.hero = {
    type: "image",
    url: absoluteUrl(imagePath),
    size: "full",
    aspectRatio: "4:5",
    aspectMode: "contain",
    backgroundColor: "#F7F4ED",
    action: { type: "uri", uri: absoluteUrl("brand.html") },
  };
  return bubble;
}
'''

    pattern = re.compile(
        r'const MASCOT_PATH = .*?\n\}\n\n(?=function mascotWelcomeReply\(\))',
        re.S,
    )
    text, count = pattern.subn(mascot_block + "\n", text, count=1)
    if count != 1:
        raise SystemExit("Could not locate existing LINE mascot block")

    old_carousel = 'contents: { type: "carousel", contents: DATA.products.map(productBubble) },'
    new_carousel = '''contents: {
      type: "carousel",
      contents: [
        mascotBubble(
          "小老闆介紹產品",
          "先看產品型態與日常使用方式，再進入各產品卡查看規格、價格、使用方式與購買按鈕。",
          [
            { label: "幫我推薦", text: "幫我推薦" },
            { label: "搭配組合", text: "搭配組合" },
            { label: "人工客服", text: "我要人工客服" },
          ],
          "tray"
        ),
        ...DATA.products.map(productBubble),
      ],
    },'''
    if old_carousel not in text:
        raise SystemExit("Could not locate product carousel")
    text = text.replace(old_carousel, new_carousel, 1)

    brand_pattern = re.compile(
        r'(function brandStoryReply\(\) \{\s*)return flexCard\(',
        re.S,
    )
    text, brand_count = brand_pattern.subn(r'\1return mascotBubble(', text, count=1)
    if brand_count != 1:
        raise SystemExit("Could not update brand story mascot card")

    SERVER.write_text(text, encoding="utf-8")


def update_spec():
    spec = ROOT / "MASCOT_CHARACTER_SPEC.md"
    text = spec.read_text(encoding="utf-8") if spec.exists() else ""
    marker = "## LINE OA 情境動作配置"
    if marker not in text:
        text += """

## LINE OA 情境動作配置

LINE OA 不再只重複同一張角色圖，而是依功能選用固定角色的不同情境：

- 新好友歡迎與客服引導：招手版
- 產品介紹與搭配組合：托盤介紹版
- 怎麼選與推薦：比讚推薦版
- 使用方式、品牌故事與漢方資料：全身說明版

角色本人、臉型、髮型、服裝、圍裙 Logo、小鹿與小烏龜均維持一致；只更換構圖、動作、道具與文案。
"""
        spec.write_text(text, encoding="utf-8")


if __name__ == "__main__":
    patch_server()
    update_spec()
