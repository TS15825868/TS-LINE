
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


function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var data = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    var now = new Date();
    var orderId = data.orderId || ("XJW" + Utilities.formatDate(now, "Asia/Taipei", "yyyyMMddHHmmss"));

    var cart = data.cart || [];
    var total = Number(data.total || 0);
    var userId = data.userId || data.lineUserId || "";
    var name = data.name || "";
    var phone = data.phone || "";
    var payment = data.payment || "";
    var shipping = data.shipping || "";
    var address = data.address || "";
    var source = data.source || data.orderSource || "LINE OA";

    if (shipping === "門市自取" && (!address || address === "門市自取")) {
      address = "台北市萬華區西昌街52號（客服確認取貨時間）";
    }

    var productText = cart.map(function(i) {
      return (i.name || "") + " × " + (i.qty || 1) + (i.unit || "") + (i.label ? "（" + i.label + "）" : "");
    }).join("、");

    var mainProduct = calcMainProduct(cart);

    var masterSheet = getSheet(ss, "訂單主表", [
      "時間", "訂單編號", "LINE UserID", "姓名", "電話", "訂單總額",
      "付款方式", "配送方式", "地址／取貨資訊", "來源", "訂單狀態", "客服備註"
    ]);

    var detailSheet = getSheet(ss, "訂單明細", [
      "時間", "訂單編號", "商品", "數量", "單位", "方案", "小計", "來源", "備註"
    ]);

    var shipSheet = getSheet(ss, "出貨管理", [
      "時間", "訂單編號", "姓名", "電話", "商品", "數量", "單位",
      "配送方式", "地址／取貨資訊", "物流單號", "出貨狀態", "完成日期", "備註"
    ]);

    var remitSheet = getSheet(ss, "匯款對帳", [
      "時間", "訂單編號", "姓名", "電話", "應收金額",
      "匯款金額", "帳號後五碼", "核對狀態", "備註"
    ]);

    var customerSheet = getSheet(ss, "客戶資料", [
      "LINE UserID", "姓名", "電話", "最後購買時間", "最近購買商品",
      "累積次數", "累積金額", "客戶等級", "客戶來源", "最近來源", "主購商品", "回購天數"
    ]);

    var dashboardSheet = getSheet(ss, "CRM儀表板", [
      "更新時間", "今日訂單數", "今日營業額", "總客戶數", "總營業額", "備註"
    ]);

    masterSheet.appendRow([
      now, orderId, userId, name, phone, total,
      payment, shipping, address, source, "待確認", ""
    ]);

    if (cart.length === 0) {
      detailSheet.appendRow([now, orderId, "", "", "", "", "", source, "空購物車"]);
    } else {
      cart.forEach(function(i) {
        detailSheet.appendRow([
          now, orderId, i.name || "", i.qty || 1, i.unit || "",
          i.label || "", i.total || "", source, ""
        ]);

        shipSheet.appendRow([
          now, orderId, name, phone, i.name || "", i.qty || 1, i.unit || "",
          shipping, address, "", shipping === "門市自取" ? "待自取" : "待確認", "", ""
        ]);
      });
    }

    remitSheet.appendRow([
      now, orderId, name, phone, total, "", "",
      payment === "匯款" ? "待匯款" : (payment === "TWQR" || payment === "TWQR（建置中）" ? "TWQR待建置" : "不需匯款"),
      payment === "現金付款" ? "現金付款，現場確認" : ""
    ]);

    updateCustomer(customerSheet, userId, name, phone, productText, total, source, mainProduct);
    updateDashboard(dashboardSheet, masterSheet, customerSheet);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, orderId: orderId }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function customerLevel(total) {
  total = Number(total || 0);
  if (total >= 100000) return "經銷合作";
  if (total >= 50000) return "VIP會員";
  if (total >= 20000) return "金卡會員";
  if (total >= 5000) return "銀卡會員";
  return "一般會員";
}

function daysBetween(a, b) {
  if (!a) return "";
  var start = new Date(a);
  var end = new Date(b);
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function calcMainProduct(cart) {
  if (!cart || cart.length === 0) return "";
  var best = cart[0];
  cart.forEach(function(i) {
    if (Number(i.qty || 0) > Number(best.qty || 0)) best = i;
  });
  return best.name || "";
}

function updateCustomer(sheet, userId, name, phone, productText, total, source, mainProduct) {
  if (!phone && !userId) return;
  var values = sheet.getDataRange().getValues();
  var now = new Date();

  for (var i = 1; i < values.length; i++) {
    if ((userId && values[i][0] === userId) || (phone && values[i][2] === phone)) {
      var lastDate = values[i][3];
      var repurchaseDays = daysBetween(lastDate, now);
      var count = Number(values[i][5] || 0) + 1;
      var sum = Number(values[i][6] || 0) + Number(total || 0);
      var originalSource = values[i][8] || source || "";

      sheet.getRange(i + 1, 2).setValue(name);
      sheet.getRange(i + 1, 3).setValue(phone);
      sheet.getRange(i + 1, 4).setValue(now);
      sheet.getRange(i + 1, 5).setValue(productText);
      sheet.getRange(i + 1, 6).setValue(count);
      sheet.getRange(i + 1, 7).setValue(sum);
      sheet.getRange(i + 1, 8).setValue(customerLevel(sum));
      sheet.getRange(i + 1, 9).setValue(originalSource);
      sheet.getRange(i + 1, 10).setValue(source || "");
      sheet.getRange(i + 1, 11).setValue(mainProduct || "");
      sheet.getRange(i + 1, 12).setValue(repurchaseDays);
      return;
    }
  }

  var firstTotal = Number(total || 0);
  sheet.appendRow([
    userId, name, phone, now, productText, 1, firstTotal,
    customerLevel(firstTotal), source || "", source || "", mainProduct || "", 0
  ]);
}

function updateDashboard(dashboard, masterSheet, customerSheet) {
  var now = new Date();
  var orders = masterSheet.getDataRange().getValues();
  var customers = customerSheet.getDataRange().getValues();

  var today = Utilities.formatDate(now, "Asia/Taipei", "yyyy-MM-dd");
  var todayCount = 0;
  var todayRevenue = 0;
  var totalRevenue = 0;

  for (var i = 1; i < orders.length; i++) {
    var d = orders[i][0];
    var amount = Number(orders[i][5] || 0);
    totalRevenue += amount;
    if (d && Utilities.formatDate(new Date(d), "Asia/Taipei", "yyyy-MM-dd") === today) {
      todayCount++;
      todayRevenue += amount;
    }
  }

  if (dashboard.getLastRow() > 1) {
    dashboard.getRange(2, 1, dashboard.getLastRow() - 1, dashboard.getLastColumn()).clearContent();
  }

  dashboard.appendRow([
    now,
    todayCount,
    todayRevenue,
    Math.max(customers.length - 1, 0),
    totalRevenue,
    "v200 CRM 自動更新"
  ]);
}
