
/**
 * 仙加味 v231 product intent patch
 * 解決官網連到 LINE 的產品詢問文字沒有直接接住的問題。
 * 可辨識：
 * - 我要詢問【龜鹿飲 30cc】
 * - 我要詢問【龜鹿飲30cc】
 * - 龜鹿飲 30cc
 * - 龜鹿飲30cc
 * - 180cc / 鋁袋
 * - 龜鹿膏 / 龜鹿湯塊 / 龜鹿膠 / 鹿茸粉
 */
function normalizeXjwText(text) {
  return String(text || "")
    .replace(/[【】\[\]（）()「」『』]/g, "")
    .replace(/\s+/g, "")
    .replace(/[　]/g, "")
    .toLowerCase();
}

function detectXjwProductIntent(text) {
  var raw = String(text || "");
  var t = normalizeXjwText(raw);

  if (!t) return "";

  if (t.indexOf("龜鹿飲") >= 0 && (t.indexOf("30cc") >= 0 || t.indexOf("30") >= 0 || t.indexOf("小瓶") >= 0 || t.indexOf("玻璃瓶") >= 0)) return "龜鹿飲30cc";
  if (t.indexOf("龜鹿飲") >= 0 && (t.indexOf("180cc") >= 0 || t.indexOf("180") >= 0 || t.indexOf("鋁袋") >= 0 || t.indexOf("大包") >= 0)) return "龜鹿飲180cc";

  if (t.indexOf("龜鹿膏") >= 0) return "龜鹿膏";
  if (t.indexOf("龜鹿湯塊") >= 0 || t.indexOf("湯塊") >= 0) return "龜鹿湯塊";
  if (t.indexOf("龜鹿膠") >= 0 || t.indexOf("一斤") >= 0 || t.indexOf("600g") >= 0 || t.indexOf("600克") >= 0) return "龜鹿膠";
  if (t.indexOf("鹿茸粉") >= 0 || t.indexOf("鹿茸") >= 0) return "鹿茸粉";

  if (t.indexOf("龜鹿飲") >= 0) return "龜鹿飲";
  return "";
}

function productQuickReplyText(productName) {
  var info = {
    "龜鹿膏": "龜鹿膏｜100g／罐\n適合想固定安排日常補養節奏的人。\n可直接食用，也可加入約100～300cc熱水化開後飲用。\n\n想了解更完整用法或搭配，我可以繼續幫您整理。",
    "龜鹿飲30cc": "龜鹿飲30cc｜30cc／瓶\n小瓶即飲，適合外出、工作空檔或想方便安排的人。\n開瓶即可飲用，也可依個人需求溫熱後飲用。\n\n想看容量、成分或怎麼買，我可以繼續幫您整理。",
    "龜鹿飲180cc": "龜鹿飲180cc｜180cc／包\n容量較大，適合家庭分享或固定飲用安排。\n可打開即飲，也可隔水加熱或倒入碗杯中加熱後飲用。\n\n想了解30cc和180cc怎麼選，我可以幫您比較。",
    "鹿茸粉": "鹿茸粉｜75g／罐\n粉狀型態，適合想自行搭配飲品的人。\n可加入溫開水、牛奶、豆漿或其他飲品中攪拌均勻後飲用。\n\n想了解用量或搭配方式，我可以繼續幫您整理。",
    "龜鹿湯塊": "龜鹿湯塊｜75g／盒，8塊裝\n小包裝，適合熱水沖泡、保溫壺悶泡，也可加入雞湯、排骨湯燉煮。\n\n想了解沖泡或燉湯方式，我可以繼續幫您整理。",
    "龜鹿膠": "龜鹿膠｜600g／盒（1斤），32塊裝\n大包裝，適合固定使用或家庭安排。\n可熱水化開、直接食用，也可加入雞湯或排骨湯燉煮。\n\n想了解龜鹿膠和湯塊差別，我可以幫您比較。"
  };
  return info[productName] || "我有接收到您的產品詢問，我先幫您整理產品資訊。";
}

function productQuickReplyItems(productName) {
  return [
    { type: "action", action: { type: "message", label: "看產品DM", text: "我想看" + productName + "DM" } },
    { type: "action", action: { type: "message", label: "使用方式", text: productName + "怎麼用" } },
    { type: "action", action: { type: "message", label: "怎麼購買", text: "我要購買" + productName } },
    { type: "action", action: { type: "message", label: "人工客服", text: "我要人工客服" } }
  ];
}

function buildProductIntentMessage(productName) {
  return {
    type: "text",
    text: productQuickReplyText(productName),
    quickReply: { items: productQuickReplyItems(productName) }
  };
}

/*
安裝說明：
1. 若 server.js 已自動套用，可直接部署。
2. 若你的主程式沒有自動套用，請在收到文字訊息後、進入一般 choiceHub 之前加入：

var text = event.message.text || "";
var productIntent = detectXjwProductIntent(text);
if (productIntent) {
  return reply(event.replyToken, buildProductIntentMessage(productIntent));
}

這樣官網帶入「我要詢問【龜鹿飲 30cc】」會直接回龜鹿飲30cc，不會跳到一般整理選單。
*/
