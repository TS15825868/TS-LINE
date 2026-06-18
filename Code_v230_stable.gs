/**
 * 仙加味 CRM 訂單寫入系統
 * Version: v230_stable
 *
 * 用途：
 * - LINE OA / 官網表單送單到 Google Sheet
 * - 自動寫入：訂單主表、訂單明細、出貨管理、匯款對帳、客戶資料、CRM儀表板
 *
 * 建議：
 * 1. 如果 Apps Script 是綁在試算表上的，可以直接使用 getActiveSpreadsheet()
 * 2. 如果是獨立 Apps Script，請在 SCRIPT PROPERTIES 設定 SPREADSHEET_ID
 */

var CONFIG = {
  TZ: "Asia/Taipei",
  DEFAULT_SOURCE: "LINE OA",
  VERSION_NOTE: "仙加味 v230 CRM 自動更新",
  STORE_PICKUP_ADDRESS: "台北市萬華區西昌街52號（客服確認取貨時間）"
};

function doGet(e) {
  return jsonOutput({
    ok: true,
    service: "仙加味 CRM",
    version: "v230_stable",
    message: "Webhook is running"
  });
}

function doPost(e) {
  var lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    var ss = getSpreadsheet_();
    var data = parsePostData_(e);
    var now = new Date();

    var orderId = sanitize_(data.orderId) || ("XJW" + Utilities.formatDate(now, CONFIG.TZ, "yyyyMMddHHmmss"));
    var cart = normalizeCart_(data.cart);
    var total = Number(data.total || calcCartTotal_(cart) || 0);

    var userId = sanitize_(data.userId || data.lineUserId || "");
    var name = sanitize_(data.name || "");
    var phone = sanitize_(data.phone || "");
    var payment = sanitize_(data.payment || "");
    var shipping = sanitize_(data.shipping || "");
    var address = sanitize_(data.address || "");
    var source = sanitize_(data.source || data.orderSource || CONFIG.DEFAULT_SOURCE);

    if (shipping === "門市自取" && (!address || address === "門市自取")) {
      address = CONFIG.STORE_PICKUP_ADDRESS;
    }

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

    if (orderExists_(masterSheet, orderId)) {
      return jsonOutput({
        ok: true,
        duplicated: true,
        orderId: orderId,
        message: "訂單已存在，未重複寫入"
      });
    }

    var productText = cart.map(function(i) {
      return (i.name || "") + " × " + (i.qty || 1) + (i.unit || "") + (i.label ? "（" + i.label + "）" : "");
    }).join("、");

    var mainProduct = calcMainProduct(cart);

    masterSheet.appendRow([
      now, orderId, userId, name, phone, total,
      payment, shipping, address, source, "待確認", ""
    ]);

    if (cart.length === 0) {
      detailSheet.appendRow([now, orderId, "", "", "", "", "", source, "空購物車"]);
      shipSheet.appendRow([
        now, orderId, name, phone, "", "", "",
        shipping, address, "", shippingStatus_(shipping), "", "空購物車，需人工確認"
      ]);
    } else {
      cart.forEach(function(i) {
        detailSheet.appendRow([
          now, orderId, i.name || "", i.qty || 1, i.unit || "",
          i.label || "", i.total || "", source, ""
        ]);

        shipSheet.appendRow([
          now, orderId, name, phone, i.name || "", i.qty || 1, i.unit || "",
          shipping, address, "", shippingStatus_(shipping), "", ""
        ]);
      });
    }

    remitSheet.appendRow([
      now, orderId, name, phone, total, "", "",
      remitStatus_(payment),
      remitNote_(payment)
    ]);

    updateCustomer(customerSheet, userId, name, phone, productText, total, source, mainProduct);
    updateDashboard(dashboardSheet, masterSheet, customerSheet);

    autoResizeSheets_([masterSheet, detailSheet, shipSheet, remitSheet, customerSheet, dashboardSheet]);

    return jsonOutput({
      ok: true,
      orderId: orderId,
      total: total,
      cartCount: cart.length
    });

  } catch (err) {
    return jsonOutput({
      ok: false,
      error: String(err),
      stack: err && err.stack ? String(err.stack) : ""
    });
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {}
  }
}

function getSpreadsheet_() {
  var propId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (propId) return SpreadsheetApp.openById(propId);

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error("找不到試算表。若此 Apps Script 不是綁定在試算表上，請到 Script Properties 設定 SPREADSHEET_ID。");
  }
  return ss;
}

function parsePostData_(e) {
  var raw = (e && e.postData && e.postData.contents) || "{}";
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error("POST JSON 格式錯誤：" + String(err));
  }
}

function normalizeCart_(cart) {
  if (!Array.isArray(cart)) return [];

  return cart.map(function(i) {
    i = i || {};
    var qty = Number(i.qty || i.quantity || 1);
    if (!qty || qty < 1) qty = 1;

    var price = Number(i.price || 0);
    var total = Number(i.total || i.subtotal || 0);
    if (!total && price) total = price * qty;

    return {
      name: sanitize_(i.name || i.productName || ""),
      qty: qty,
      unit: sanitize_(i.unit || ""),
      label: sanitize_(i.label || i.plan || ""),
      price: price,
      total: total
    };
  }).filter(function(i) {
    return i.name || i.qty || i.total;
  });
}

function calcCartTotal_(cart) {
  if (!cart || !cart.length) return 0;
  return cart.reduce(function(sum, i) {
    return sum + Number(i.total || 0);
  }, 0);
}

function sanitize_(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function getSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    styleHeader_(sheet, headers.length);
  } else {
    ensureHeaders_(sheet, headers);
  }

  return sheet;
}

function ensureHeaders_(sheet, headers) {
  var lastCol = Math.max(sheet.getLastColumn(), headers.length);
  var existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  var changed = false;
  for (var i = 0; i < headers.length; i++) {
    if (!existing[i]) {
      existing[i] = headers[i];
      changed = true;
    }
  }

  if (changed) {
    sheet.getRange(1, 1, 1, headers.length).setValues([existing.slice(0, headers.length)]);
    sheet.setFrozenRows(1);
    styleHeader_(sheet, headers.length);
  }
}

function styleHeader_(sheet, colCount) {
  try {
    sheet.getRange(1, 1, 1, colCount)
      .setFontWeight("bold")
      .setBackground("#7B1E1E")
      .setFontColor("#FFFFFF");
  } catch (e) {}
}

function autoResizeSheets_(sheets) {
  sheets.forEach(function(sheet) {
    try {
      var cols = sheet.getLastColumn();
      if (cols > 0) sheet.autoResizeColumns(1, cols);
    } catch (e) {}
  });
}

function orderExists_(sheet, orderId) {
  if (!orderId || sheet.getLastRow() < 2) return false;
  var values = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(orderId)) return true;
  }
  return false;
}

function shippingStatus_(shipping) {
  if (shipping === "門市自取") return "待自取";
  if (shipping === "雙北親送") return "待親送";
  if (shipping === "7-11賣貨便") return "待建單";
  if (shipping === "宅配") return "待出貨";
  return "待確認";
}

function remitStatus_(payment) {
  if (payment === "匯款") return "待匯款";
  if (payment === "TWQR") return "待核對";
  if (payment === "TWQR（建置中）") return "TWQR待建置";
  if (payment === "現金付款") return "現金付款";
  if (payment === "貨到付款") return "貨到付款";
  return "不需匯款";
}

function remitNote_(payment) {
  if (payment === "現金付款") return "現金付款，現場確認";
  if (payment === "TWQR") return "TWQR付款，待確認金流或截圖";
  if (payment === "TWQR（建置中）") return "TWQR尚未完成建置，請人工確認";
  if (payment === "貨到付款") return "貨到付款，出貨時確認";
  return "";
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
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return "";
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function calcMainProduct(cart) {
  if (!cart || cart.length === 0) return "";
  var best = cart[0];

  cart.forEach(function(i) {
    var qty = Number(i.qty || 0);
    var bestQty = Number(best.qty || 0);
    var total = Number(i.total || 0);
    var bestTotal = Number(best.total || 0);

    if (qty > bestQty || (qty === bestQty && total > bestTotal)) best = i;
  });

  return best.name || "";
}

function updateCustomer(sheet, userId, name, phone, productText, total, source, mainProduct) {
  if (!phone && !userId) return;

  var values = sheet.getDataRange().getValues();
  var now = new Date();

  for (var i = 1; i < values.length; i++) {
    var sameUser = userId && String(values[i][0]) === String(userId);
    var samePhone = phone && String(values[i][2]) === String(phone);

    if (sameUser || samePhone) {
      var lastDate = values[i][3];
      var repurchaseDays = daysBetween(lastDate, now);
      var count = Number(values[i][5] || 0) + 1;
      var sum = Number(values[i][6] || 0) + Number(total || 0);
      var originalSource = values[i][8] || source || "";

      sheet.getRange(i + 1, 1).setValue(userId || values[i][0]);
      sheet.getRange(i + 1, 2).setValue(name || values[i][1]);
      sheet.getRange(i + 1, 3).setValue(phone || values[i][2]);
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

  var today = Utilities.formatDate(now, CONFIG.TZ, "yyyy-MM-dd");
  var todayCount = 0;
  var todayRevenue = 0;
  var totalRevenue = 0;

  for (var i = 1; i < orders.length; i++) {
    var d = orders[i][0];
    var amount = Number(orders[i][5] || 0);
    totalRevenue += amount;

    if (d && Utilities.formatDate(new Date(d), CONFIG.TZ, "yyyy-MM-dd") === today) {
      todayCount++;
      todayRevenue += amount;
    }
  }

  if (dashboard.getLastRow() > 1) {
    dashboard.getRange(2, 1, dashboard.getLastRow() - 1, dashboard.getLastColumn()).clearContent();
  }

  dashboard.getRange(2, 1, 1, 6).setValues([[
    now,
    todayCount,
    todayRevenue,
    Math.max(customers.length - 1, 0),
    totalRevenue,
    CONFIG.VERSION_NOTE
  ]]);

  try {
    dashboard.getRange("A:A").setNumberFormat("yyyy/mm/dd hh:mm:ss");
    dashboard.getRange("C:C").setNumberFormat("#,##0");
    dashboard.getRange("E:E").setNumberFormat("#,##0");
  } catch (e) {}
}

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
