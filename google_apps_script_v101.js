function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var data = JSON.parse((e && e.postData && e.postData.contents) || "{}");

    var orderSheet = getSheet(ss, "訂單總表", [
      "時間", "訂單編號", "LINE UserID", "姓名", "電話", "商品", "數量", "金額",
      "付款方式", "配送方式", "地址", "狀態"
    ]);

    var shipSheet = getSheet(ss, "出貨管理", [
      "時間", "訂單編號", "姓名", "電話", "商品", "配送方式",
      "地址", "物流單號", "出貨狀態"
    ]);

    var customerSheet = getSheet(ss, "客戶資料", [
      "姓名", "電話", "最後購買時間", "最近購買商品", "累積次數"
    ]);

    var orderId = "XJW" + Utilities.formatDate(new Date(), "Asia/Taipei", "yyyyMMddHHmmss");
    var cart = data.cart || [];
    var productText = cart.map(function(i) { return i.name + " × " + i.qty; }).join("、");
    var qtyText = cart.map(function(i) { return i.qty; }).join("、");
    var total = data.total || "";

    orderSheet.appendRow([
      new Date(), orderId, data.userId || "", data.name || "", data.phone || "",
      productText, qtyText, total, data.payment || "", data.shipping || "", data.address || "", "待確認"
    ]);

    shipSheet.appendRow([
      new Date(), orderId, data.name || "", data.phone || "",
      productText, data.shipping || "", data.address || "", "", "未出貨"
    ]);

    updateCustomer(customerSheet, data.name || "", data.phone || "", productText);

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

function updateCustomer(sheet, name, phone, productText) {
  if (!phone) return;
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][1] === phone) {
      var count = Number(values[i][4] || 0) + 1;
      sheet.getRange(i + 1, 3).setValue(new Date());
      sheet.getRange(i + 1, 4).setValue(productText);
      sheet.getRange(i + 1, 5).setValue(count);
      return;
    }
  }
  sheet.appendRow([name, phone, new Date(), productText, 1]);
}
