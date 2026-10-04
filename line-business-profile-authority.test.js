"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const ROOT = __dirname;
const authority = JSON.parse(fs.readFileSync(path.join(ROOT, "config/ecosystem-authority-v20260910.json"), "utf8"));
const profile = authority.lineBusinessProfile || {};

assert.equal(profile.authority, "oa-manager-manual-published");
assert.equal(profile.accountName, "仙加味");
assert.equal(profile.statusMessage, "現代漢方生活品牌｜補養，是一種節奏。");
assert.ok(Array.from(profile.statusMessage || "").length <= 20, "LINE OA 狀態消息超過20字");
assert.equal(profile.address, "台北市萬華區西昌街52號");
for (const day of ["monday","tuesday","wednesday","thursday","friday"]) {
  assert.equal(profile.hours?.[day], "10:30－20:00", day + " 商業簡介營業時間回退");
}
assert.equal(profile.hours?.saturday, "公休日");
assert.equal(profile.hours?.sunday, "公休日");
assert.equal(profile.website?.label, "仙加味｜連結入口");
assert.equal(profile.website?.url, "https://ts15825868.github.io/xianjiawei/links.html");
assert.equal(profile.lineId, "@762jybnm");
assert.equal(profile.lineUrl, "https://lin.ee/sHZW7NkR");
assert.equal(profile.publishRequired, true);
assert.match(String(profile.avatarPolicy || ""), /正式仙加味 Logo/);
assert.match(String(profile.coverPolicy || ""), /正式新版封面/);
assert.match(String(profile.coverPolicy || ""), /不得.*覆蓋/);

const activeProfile = JSON.stringify({
  accountName: profile.accountName,
  statusMessage: profile.statusMessage,
  address: profile.address,
  hours: profile.hours,
  website: profile.website,
  lineId: profile.lineId,
  lineUrl: profile.lineUrl,
  avatarPolicy: profile.avatarPolicy,
  coverPolicy: profile.coverPolicy
});
for (const retired of ["歡迎諮詢","09:30－18:30","09:30 - 18:30"]) {
  const allowedInRetiredList = JSON.stringify(profile.retiredValues || []).includes(retired);
  assert.ok(!activeProfile.includes(retired), "商業簡介正式欄位仍含退役資料：" + retired);
  assert.equal(allowedInRetiredList, true, "退役商業簡介值未被明確列入 retiredValues：" + retired);
}

const storePolicy = fs.readFileSync(path.join(ROOT, "line-store-location-policy.js"), "utf8");
assert.match(storePolicy, /週一至週五 10:30－20:00；週六、週日休息/);

console.log("PASS：LINE OA 商業簡介權威已鎖定仙加味、18字品牌狀態消息、週一至週五10:30－20:00、週末公休、正式連結入口與封面保護。");
