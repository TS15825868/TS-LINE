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
    var source = data.source || data.orderSource || "";
    if (shipping === "門市自取" && (!address || address === "門市自取")) {
      address = "台北市萬華區西昌街52號（客服確認取貨時間）";
    }

    var masterSheet = getSheet(ss, "訂單主表", [
      "時間", "訂單編號", "LINE UserID", "姓名", "電話", "訂單總額",
      "付款方式", "配送方式", "地址／取貨資訊", "訂單來源", "訂單狀態", "客服備註", "完成時間"
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
      "累積次數", "累積金額", "客戶等級", "客戶來源", "主購商品", "回購天數"
    ]);

    var dashboardSheet = getSheet(ss, "CRM儀表板", [
      "更新時間", "今日訂單數", "今日營業額", "本月訂單數", "本月營業額",
      "新客數", "回購客數", "平均客單價"
    ]);

    masterSheet.appendRow([
      now, orderId, userId, name, phone, total,
      payment, shipping, address, source, "待確認", "", ""
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
          shipping, address, "", shipping === "門市自取" ? "待自取" : "待出貨", "", ""
        ]);
      });
    }

    remitSheet.appendRow([
      now, orderId, name, phone, total, "", "",
      payment === "匯款" ? "待匯款" : (payment === "TWQR" || payment === "TWQR（建置中）" ? "TWQR待建置" : "不需匯款"),
      payment === "現金付款" ? "現金付款，現場確認" : ""
    ]);

    var productText = cart.map(function(i) {
      return (i.name || "") + " × " + (i.qty || 1) + (i.unit || "") + (i.label ? "（" + i.label + "）" : "");
    }).join("、");

    updateCustomer(customerSheet, userId, name, phone, productText, total, source);
    applyDropdowns(shipSheet, masterSheet);
    updateDashboard(ss);

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

function mainProduct(productText) {
  if (!productText) return "";
  var parts = productText.split("、");
  return parts[0] || "";
}

function repurchaseDays(lastDate) {
  if (!lastDate) return "";
  var diff = new Date().getTime() - new Date(lastDate).getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

function updateCustomer(sheet, userId, name, phone, productText, total, source) {
  if (!phone && !userId) return;
  var values = sheet.getDataRange().getValues();

  for (var i = 1; i < values.length; i++) {
    if ((userId && values[i][0] === userId) || (phone && values[i][2] === phone)) {
      var count = Number(values[i][5] || 0) + 1;
      var sum = Number(values[i][6] || 0) + Number(total || 0);
      sheet.getRange(i + 1, 2).setValue(name);
      sheet.getRange(i + 1, 3).setValue(phone);
      sheet.getRange(i + 1, 4).setValue(new Date());
      sheet.getRange(i + 1, 5).setValue(productText);
      sheet.getRange(i + 1, 6).setValue(count);
      sheet.getRange(i + 1, 7).setValue(sum);
      sheet.getRange(i + 1, 8).setValue(customerLevel(sum));
      sheet.getRange(i + 1, 9).setValue(source || values[i][8] || "");
      sheet.getRange(i + 1, 10).setValue(mainProduct(productText));
      sheet.getRange(i + 1, 11).setValue(0);
      return;
    }
  }

  var firstTotal = Number(total || 0);
  sheet.appendRow([userId, name, phone, new Date(), productText, 1, firstTotal, customerLevel(firstTotal), source || "", mainProduct(productText), 0]);
}

function applyDropdowns(shipSheet, masterSheet) {
  var shipRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["待確認", "待出貨", "已出貨", "待自取", "已完成", "取消"], true)
    .setAllowInvalid(false)
    .build();
  var orderRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["待確認", "待付款", "待出貨", "待自取", "已完成", "取消"], true)
    .setAllowInvalid(false)
    .build();

  if (shipSheet.getMaxRows() > 1) shipSheet.getRange(2, 11, shipSheet.getMaxRows() - 1, 1).setDataValidation(shipRule);
  if (masterSheet.getMaxRows() > 1) masterSheet.getRange(2, 11, masterSheet.getMaxRows() - 1, 1).setDataValidation(orderRule);
}

function updateDashboard(ss) {
  var sheet = ss.getSheetByName("CRM儀表板");
  var orders = ss.getSheetByName("訂單主表");
  var customers = ss.getSheetByName("客戶資料");
  if (!sheet || !orders) return;

  var vals = orders.getDataRange().getValues();
  var today = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyyMMdd");
  var month = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyyMM");
  var todayCount = 0, todayTotal = 0, monthCount = 0, monthTotal = 0;

  for (var i = 1; i < vals.length; i++) {
    var d = vals[i][0];
    var total = Number(vals[i][5] || 0);
    if (!d) continue;
    var ds = Utilities.formatDate(new Date(d), "Asia/Taipei", "yyyyMMdd");
    var ms = Utilities.formatDate(new Date(d), "Asia/Taipei", "yyyyMM");
    if (ds === today) { todayCount++; todayTotal += total; }
    if (ms === month) { monthCount++; monthTotal += total; }
  }

  var customerVals = customers ? customers.getDataRange().getValues() : [];
  var newCustomers = 0, repeatCustomers = 0;
  for (var c = 1; c < customerVals.length; c++) {
    var count = Number(customerVals[c][5] || 0);
    if (count <= 1) newCustomers++;
    if (count > 1) repeatCustomers++;
  }

  sheet.clearContents();
  sheet.appendRow(["更新時間", "今日訂單數", "今日營業額", "本月訂單數", "本月營業額", "新客數", "回購客數", "平均客單價"]);
  sheet.appendRow([new Date(), todayCount, todayTotal, monthCount, monthTotal, newCustomers, repeatCustomers, monthCount ? Math.round(monthTotal / monthCount) : 0]);
}

function refreshRepurchaseDays() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("客戶資料");
  if (!sheet) return;
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    sheet.getRange(i + 1, 11).setValue(repurchaseDays(values[i][3]));
  }
}
