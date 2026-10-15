"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { findPartnerInquiry } = require("./partner-inquiry.js");
const record = require("./partner-inquiry-catalog.json").products.find(p => p.id === "lian-guilu");

assert.ok(record, "立安龜鹿二仙膠詢問資料應保留");
assert.equal(record.publicPage, null, "核准實體成藥不得被當成已核准公開產品廣告頁");
assert.equal(record.medicine?.classification, "licensed-traditional-medicine");
assert.equal(record.medicine?.licensedCategory, "成藥");
assert.equal(record.medicine?.licenseNo, "衛署成製013857");
assert.equal(record.medicine?.onlineSaleEligible, false);
assert.equal(record.medicine?.storeService, "in-person-subject-to-dealer-license-scope");
for(const term of ["龜鹿二仙膠", "立安龜鹿二仙膠", "「立安」龜鹿二仙膠"]) {
  assert.equal(findPartnerInquiry(term)?.id, "lian-guilu", "成藥詢問應留在仙加味：" + term);
}

for(const input of [
  "請問立安龜鹿二仙膠有賣嗎",
  "龜鹿二仙膠多少錢",
  "龜鹿二仙膠門市有貨嗎",
  "「立安」龜鹿二仙膠怎麼買"
]) {
  assert.equal(findPartnerInquiry(input)?.id,"lian-guilu","門市供貨問法應由仙加味接待："+input);
}
for(const input of ["我的藥物過敏", "怎麼改善失眠", "我有龜鹿膏及其他問題"]) {
  assert.equal(findPartnerInquiry(input),null,"不相干談話不能誤成商品詢問："+input);
}

const src = fs.readFileSync("tools/sync-partner-inquiries.cjs","utf8");
assert.ok(src.includes("p.officialLicensedName"),"同步器需承接原廠核准品名");
assert.ok(src.includes("p.licensedProductType==='成藥'"),"僅官方已核實成藥資料可納入此流程");
assert.ok(src.includes("new Date(p.licenseVerification.validUntil"),"同步器應檢查成藥許可證效期");
assert.ok(src.includes("storeService:'in-person-subject-to-dealer-license-scope'"),"不能把藥商實體販售誤當成全面禁售");
const server = fs.readFileSync("server.js","utf8");
assert.ok(server.includes("partnerInquiry.medicine?.classification === 'licensed-traditional-medicine'"),"LINE 應辨識已核准中藥成藥");
assert.ok(server.includes("藥商營業範圍內的門市供貨"),"LINE 需保留仙加味合法實體門市諮詢");
assert.ok(server.includes("此處不提供本品網路結帳"),"不能誤開成藥網路結帳");
assert.ok(!server.includes("成藥必須先找中醫師"),"不可把已核准成藥一律轉給中醫師");
const medicalBranch = server.indexOf("if (license) {");
const regularBranch = server.indexOf("return reply(event.replyToken, flexCard(partnerInquiry.name,",medicalBranch);
assert.ok(medicalBranch>0&&regularBranch>medicalBranch,"已核准成藥需有獨立人工門市分流");
console.log("PASS：立安成藥官方許可證／仙加味門市詢問／無網路結帳／有需要才醫師轉介");
