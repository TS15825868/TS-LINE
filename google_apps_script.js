function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Sheet1");
  var data = JSON.parse(e.postData.contents || "{}");

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
}
