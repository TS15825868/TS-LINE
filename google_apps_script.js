function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Sheet1");

    if (!sheet) {
      sheet = ss.insertSheet("Sheet1");
    }

    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "時間",
        "userId",
        "產品",
        "姓名",
        "電話",
        "地址",
        "付款方式",
        "配送方式"
      ]);
    }

    var data = JSON.parse((e && e.postData && e.postData.contents) || "{}");

    sheet.appendRow([
      data.createdAt || new Date(),
      data.userId || "",
      data.product || "",
      data.name || "",
      data.phone || "",
      data.address || "",
      data.payment || "",
      data.shipping || ""
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({
        ok: false,
        error: String(err)
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
