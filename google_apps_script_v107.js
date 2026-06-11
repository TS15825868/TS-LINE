function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var data = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    var orderId = data.orderId || ("XJW" + Utilities.formatDate(new Date(), "Asia/Taipei", "yyyyMMddHHmmss"));

    var cart = data.cart || [];
    var total = Number(data.total || 0);
    var userId = data.userId || data.lineUserId || "";

    var orderSheet = getSheet(ss, "訂單總表", [
      "時間", "訂單編號", "LINE UserID", "姓名", "電話",
      "商品", "數量", "單位", "方案", "小計",
      "訂單總額", "付款方式", "配送方式", "地址", "狀態", "備註"
    ]);

    var remitSheet = getSheet(ss, "匯款對帳", [
      "時間", "訂單編號", "姓名", "電話", "應收金額", "匯款金額", "帳號後五碼", "核對狀態", "備註"
    ]);

    var shipSheet = getSheet(ss, "出貨管理", [
      "時間", "訂單編號", "姓名", "電話",
      "商品", "數量", "單位", "配送方式", "地址",
      "物流單號", "出貨狀態", "備註"
    ]);

    var customerSheet = getSheet(ss, "客戶資料", [
      "LINE UserID", "姓名", "電話", "最後購買時間", "最近購買商品", "累積次數", "累積金額"
    ]);

    if (cart.length === 0) {
      orderSheet.appendRow([
        new Date(), orderId, userId, data.name || "", data.phone || "",
        "", "", "", "", "",
        total, data.payment || "", data.shipping || "", data.address || "", "待確認", "空購物車"
      ]);
    } else {
      cart.forEach(function(i, index) {
        orderSheet.appendRow([
          new Date(),
          orderId,
          userId,
          data.name || "",
          data.phone || "",
          i.name || "",
          i.qty || 1,
          i.unit || "",
          i.label || "",
          i.total || "",
          index === 0 ? total : "",
          data.payment || "",
          data.shipping || "",
          data.address || "",
          "待確認",
          ""
        ]);

        shipSheet.appendRow([
          new Date(),
          orderId,
          data.name || "",
          data.phone || "",
          i.name || "",
          i.qty || 1,
          i.unit || "",
          data.shipping || "",
          data.address || "",
          "",
          "未出貨",
          ""
        ]);
      });
    }

    remitSheet.appendRow([
      new Date(),
      orderId,
      data.name || "",
      data.phone || "",
      total,
      "",
      "",
      data.payment === "匯款" ? "待匯款" : "不需匯款",
      ""
    ]);

    var productText = cart.map(function(i) {
      return (i.name || "") + " × " + (i.qty || 1) + (i.unit || "") + (i.label ? "（" + i.label + "）" : "");
    }).join("、");

    updateCustomer(customerSheet, userId, data.name || "", data.phone || "", productText, total);

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

function updateCustomer(sheet, userId, name, phone, productText, total) {
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
      return;
    }
  }

  sheet.appendRow([userId, name, phone, new Date(), productText, 1, Number(total || 0)]);
}
