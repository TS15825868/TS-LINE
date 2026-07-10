from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
server_path = ROOT / "server.js"
test_path = ROOT / "test.js"
function_test_path = ROOT / "function.test.js"
package_path = ROOT / "package.json"
setup_path = ROOT / "RICH_MENU_SETUP.md"

server = server_path.read_text(encoding="utf-8")
server = server.replace('const VERSION = "v311.0";', 'const VERSION = "v312.0";')
server = server.replace('?v=311.0', '?v=312.0')

server = server.replace(
'''    return flexCard("購物車", `目前購物車是空的。\n\n${ORDER_NOTICE}`, [
      { label: "看產品", text: "看產品" },
      { label: "價格方案", text: "價格方案" },
    ]);''',
'''    return {
      type: "flex",
      altText: "仙加味購物車",
      contents: mascotBubble(
        "購物車｜小老闆陪您選購",
        `目前購物車是空的。可以先查看產品，或請小老闆依日常使用方式協助比較。\n\n${ORDER_NOTICE}`,
        [
          { label: "看產品", text: "看產品" },
          { label: "幫我推薦", text: "幫我推薦" },
          { label: "人工客服", text: "我要人工客服" },
        ],
        "products"
      ),
    };'''
)

server = server.replace(
'''  return flexCard("購物車", `${lines}\n\n合計：${money(cartTotal(state.cart))}\n\n${ORDER_NOTICE}`, [
    { label: "直接結帳", text: "開始結帳" },
    { label: "繼續選購", text: "看產品" },
    { label: "清空購物車", text: "清空購物車" },
  ]);''',
'''  return {
    type: "flex",
    altText: "仙加味購物車",
    contents: mascotBubble(
      "購物車｜請確認選購內容",
      `${lines}\n\n合計：${money(cartTotal(state.cart))}\n\n${ORDER_NOTICE}`,
      [
        { label: "直接結帳", text: "開始結帳" },
        { label: "繼續選購", text: "看產品" },
        { label: "清空購物車", text: "清空購物車" },
      ],
      "service"
    ),
  };'''
)

server = server.replace(
'''  return flexCard("第一步｜收件姓名", "請直接回覆收件人姓名。", [{ label: "取消", text: "取消" }]);''',
'''  return {
    type: "flex",
    altText: "開始下單",
    contents: mascotBubble(
      "開始下單｜第一步",
      "請直接回覆收件人姓名，小老闆會依序協助確認電話、付款、配送與地址。",
      [{ label: "取消", text: "取消" }],
      "service"
    ),
  };'''
)

server = server.replace(
'''  return flexCard(
    "確認訂單",
    `姓名：${checkout.name}\n電話：${checkout.phone}\n付款：${checkout.payment}\n配送：${checkout.shipping}\n地址／門市：${checkout.address}\n訂單金額：${money(cartTotal(state.cart))}\n\n${ORDER_NOTICE}`,
    [
      { label: "確認送出", text: "確認送出" },
      { label: "取消", text: "取消" },
    ]
  );''',
'''  return {
    type: "flex",
    altText: "確認訂單",
    contents: mascotBubble(
      "確認訂單｜小老闆為您核對",
      `姓名：${checkout.name}\n電話：${checkout.phone}\n付款：${checkout.payment}\n配送：${checkout.shipping}\n地址／門市：${checkout.address}\n訂單金額：${money(cartTotal(state.cart))}\n\n${ORDER_NOTICE}`,
      [
        { label: "確認送出", text: "確認送出" },
        { label: "取消", text: "取消" },
      ],
      "service"
    ),
  };'''
)

server_path.write_text(server, encoding="utf-8")

for path in (test_path, function_test_path):
    text = path.read_text(encoding="utf-8")
    text = text.replace('"v311.0"', '"v312.0"')
    text = text.replace('v311.0', 'v312.0')
    path.write_text(text, encoding="utf-8")

package = json.loads(package_path.read_text(encoding="utf-8"))
package["version"] = "3.1.2"
package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

setup_path.write_text('''# 仙加味 LINE OA Rich Menu｜大字正式版\n\n圖片尺寸：2500 × 1686 px（大型圖文選單）\n版型：3 欄 × 2 列\n檔名：`xianjiawei-rich-menu-v312-large-text.jpg`\n\n## 六個按鈕\n\n| 區域 | 顯示名稱 | 動作類型 | 傳送文字 |\n|---|---|---|---|\n| 左上 | 看產品 | 文字 | `看產品` |\n| 中上 | 購物車 | 文字 | `購物車` |\n| 右上 | 幫我推薦 | 文字 | `幫我推薦` |\n| 左下 | 搭配組合 | 文字 | `搭配組合` |\n| 中下 | 怎麼使用 | 文字 | `怎麼使用` |\n| 右下 | 直接下單 | 文字 | `直接下單` |\n\n## 卡片角色配置\n\n- 看產品：小老闆端著產品，後接真實產品卡。\n- 幫我推薦：小老闆比讚或指引，後接情境比較卡。\n- 搭配組合：小老闆搭配產品陳列，後接方案與加入購物車。\n- 怎麼使用：小老闆示範沖泡，後接各產品使用方式。\n- FAQ：小老闆思考姿勢。\n- 人工客服、購物車與訂單確認：戴耳機的小老闆。\n- 品牌故事：第四代品牌導覽角色。\n\n圖片一律使用 `aspectMode: contain`，不得裁頭或拉伸。產品卡仍使用真實產品照片。\n''', encoding="utf-8")

print("LINE OA v312 mascot cards patch completed")
