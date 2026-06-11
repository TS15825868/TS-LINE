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

    var masterSheet = getSheet(ss, "訂單主表", [
      "時間", "訂單編號", "LINE UserID", "姓名", "電話", "訂單總額",
      "付款方式", "配送方式", "地址／取貨資訊", "訂單狀態", "備註"
    ]);

    var detailSheet = getSheet(ss, "訂單明細", [
      "時間", "訂單編號", "商品", "數量", "單位", "方案", "小計", "備註"
    ]);

    var shipSheet = getSheet(ss, "出貨管理", [
      "時間", "訂單編號", "姓名", "電話", "商品", "數量", "單位",
      "配送方式", "地址／取貨資訊", "物流單號", "出貨狀態", "備註"
    ]);

    var remitSheet = getSheet(ss, "匯款對帳", [
      "時間", "訂單編號", "姓名", "電話", "應收金額",
      "匯款金額", "帳號後五碼", "核對狀態", "備註"
    ]);

    var customerSheet = getSheet(ss, "客戶資料", [
      "LINE UserID", "姓名", "電話", "最後購買時間", "最近購買商品",
      "累積次數", "累積金額", "客戶等級"
    ]);

    masterSheet.appendRow([
      now, orderId, userId, name, phone, total,
      payment, shipping, address, "待確認", ""
    ]);

    if (cart.length === 0) {
      detailSheet.appendRow([now, orderId, "", "", "", "", "", "空購物車"]);
    } else {
      cart.forEach(function(i) {
        detailSheet.appendRow([
          now, orderId, i.name || "", i.qty || 1, i.unit || "",
          i.label || "", i.total || "", ""
        ]);

        shipSheet.appendRow([
          now, orderId, name, phone, i.name || "", i.qty || 1, i.unit || "",
          shipping, address, "", shipping === "門市自取" ? "待自取" : "未出貨", ""
        ]);
      });
    }

    remitSheet.appendRow([
      now,
      orderId,
      name,
      phone,
      total,
      "",
      "",
      payment === "匯款" ? "待匯款" : (payment === "TWQR" || payment === "TWQR（建置中）" ? "TWQR待建置" : "不需匯款"),
      payment === "現金付款" ? "現金付款，現場確認" : ""
    ]);

    var productText = cart.map(function(i) {
      return (i.name || "") + " × " + (i.qty || 1) + (i.unit || "") + (i.label ? "（" + i.label + "）" : "");
    }).join("、");

    updateCustomer(customerSheet, userId, name, phone, productText, total);

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
  if (total >= 30000) return "金牌會員";
  if (total >= 10000) return "VIP會員";
  return "一般會員";
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
      sheet.getRange(i + 1, 8).setValue(customerLevel(sum));
      return;
    }
  }

  var firstTotal = Number(total || 0);
  sheet.appendRow([userId, name, phone, new Date(), productText, 1, firstTotal, customerLevel(firstTotal)]);
}
