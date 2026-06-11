
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Sheet1");
  var data = JSON.parse(e.postData.contents);
  sheet.appendRow([
    new Date(),
    data.userId,
    data.message,
    data.intent
  ]);
  return ContentService.createTextOutput("ok");
}
