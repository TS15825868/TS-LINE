"use strict";

const campaign = require("./social-guilu-drink-trial-v1.json");
const sales = require("./line-sales-master.json");
const data = require("./data.json");

const required = [
  "龜鹿飲試喝組｜先試喝，再決定",
  "3罐試喝品免費，運費自付",
  "正式售價 60元／罐",
  "買10送1｜11罐600元",
  "單包200元",
  "買10送1｜11包2,000元",
  "皆在 官方LINE 完成",
];

for (const value of required) {
  if (!campaign.copy.includes(value)) throw new Error(`統一試喝文案缺漏：${value}`);
}
if (campaign.version !== "2026-08-06-trial-campaign-v1") throw new Error("試喝文案版本錯誤");
if (campaign.posterUrl !== "https://ts15825868.github.io/xianjiawei/images/posts/approved-v413/guilu-drink-trial-60.svg") {
  throw new Error("試喝海報網址錯誤");
}
if (campaign.officialLine?.label !== "官方LINE" || campaign.officialLine?.id !== "@762jybnm") {
  throw new Error("官方LINE資料錯誤");
}
if (campaign.publishingSafety?.ownerReviewRequired !== true || campaign.publishingSafety?.autoPublish !== false) {
  throw new Error("試喝貼文人工審核安全鎖錯誤");
}
if (campaign.publishingSafety?.lineVoomManualOnly !== true || campaign.publishingSafety?.googleBusinessManualOnly !== true) {
  throw new Error("LINE VOOM或Google商家必須維持人工發布");
}

const drink30 = sales.products?.["guilu-drink-30"];
const drink180 = sales.products?.["guilu-drink-180"];
if (drink30?.price !== 60 || drink30?.priceLabel !== "正式售價60元／罐，買10送1（共11罐600元）") {
  throw new Error("LINE正式30cc價格未同步");
}
if (drink180?.price !== 200 || drink180?.priceLabel !== "售價200元，買10送1（共11包2,000元）") {
  throw new Error("LINE正式180cc價格未同步");
}
if (sales.trialCampaign?.publicPrice !== "龜鹿飲30cc正式售價60元／罐；買10送1，共11罐600元；180cc鋁袋單包200元，買10送1，共11包2,000元") {
  throw new Error("LINE試喝公開價格未同步");
}

const data30 = data.products?.find((item) => item.id === "guilu-drink-30");
const data180 = data.products?.find((item) => item.id === "guilu-drink-180");
const offer30 = (data30?.offers || []).find((item) => item.label === "買10送1");
const offer180 = (data180?.offers || []).find((item) => item.label === "買10送1");
if (data30?.price !== 60 || offer30?.qty !== 11 || offer30?.total !== 600) throw new Error("data.json 30cc價格鏡像錯誤");
if (data180?.price !== 200 || offer180?.qty !== 11 || offer180?.total !== 2000) throw new Error("data.json 180cc價格鏡像錯誤");

console.log("PASS：LINE OA統一試喝文案、正式海報、最新售價與人工發布安全鎖。");
