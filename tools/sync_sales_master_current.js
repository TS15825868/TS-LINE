"use strict";

const fs = require("fs");
const path = require("path");
const { applyMaster, getPhotoAuthority } = require("../product-sales-master");

const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "data.json");
const AUTHORITY_PATH = path.join(ROOT, "assets/data/official-products.json");
const stable = (value) => JSON.stringify(value, null, 2) + "\n";
const PRODUCT_IDS = ["guilu-gao","guilu-drink-30","guilu-drink-180","guilu-tangkuai","guilu-jiao","luerong-fen"];
const CURRENT_DM = Object.freeze({
  "guilu-gao": "/images/dm-final/01_guilu-gao-100g-dm.jpg",
  "guilu-drink-30": "/images/dm-final/02_guilu-drink-30cc-dm-official-v20260814.jpg",
  "guilu-drink-180": "/images/dm-final/03_guilu-drink-180cc-dm.jpg",
  "guilu-tangkuai": "/images/dm-final/05_guilu-tangkuai-75g-dm.jpg",
  "guilu-jiao": "/images/dm-final/06_guilu-jiao-600g-dm.jpg",
  "luerong-fen": "/images/dm-final/04_luerong-fen-75g-dm.jpg",
});

function assertCurrent(merged, authority, photoAuthority) {
  if (authority?.authority !== "user-confirmed-current") throw new Error("LINE目前產品權威不是user-confirmed-current");
  const official = new Map((authority.products || []).map((item) => [item.id, item]));
  if (official.size !== 6 || (merged.products || []).length !== 6) throw new Error("LINE正式產品必須剛好6項");
  for (const id of PRODUCT_IDS) {
    const product=(merged.products||[]).find(item=>item.id===id), rule=official.get(id), photo=String(photoAuthority?.products?.[id]||"").trim();
    if(!product||!rule||!photo)throw new Error(`${id}缺少目前正式產品權威`);
    if(product.name!==rule.name)throw new Error(`${id}正式名稱不同步`);
    if(product.specification!==rule.specification||product.size!==rule.specification||product.spec!==rule.specification)throw new Error(`${id}正式規格不同步`);
    const productImage=String(rule.approvedProductImage||"").trim(), detailedDm=String(rule.approvedDm||"").trim();
    if(!productImage||!detailedDm)throw new Error(`${id}缺少正式產品圖或詳細DM`);
    if(!detailedDm.includes(CURRENT_DM[id]))throw new Error(`${id}詳細DM不是官網目前dm-final權威：${detailedDm}`);
    if(/\/images\/dm-approved-v20260810\//.test(detailedDm))throw new Error(`${id}仍使用退役dm-approved-v20260810來源`);
    for(const field of ["image","imageUrl","image_url"]) if(String(product[field]||"")!==productImage)throw new Error(`${id}.${field} 必須使用六張正式產品圖`);
    if(String(product.dmImage||"")!==detailedDm)throw new Error(`${id}.dmImage 必須使用目前獨立詳細DM`);
    if(String(product.officialOriginalImage||"")!==photo)throw new Error(`${id}.officialOriginalImage 必須保留products-v3實物身份參考`);
    if(product.imagePolicy!=="six-official-product-images-plus-separate-corrected-dm-preserve-products-v3-identity")throw new Error(`${id}圖片政策不同步`);
  }

  const gao=official.get("guilu-gao");
  if(gao?.usagePrimary!=="食用時間可依個人使用習慣與作息時間安排")throw new Error("龜鹿膏不得回退固定早上／下午時段");
  const drink30=(merged.products||[]).find(item=>item.id==="guilu-drink-30");
  const drink30Authority=official.get("guilu-drink-30");
  if(drink30Authority?.usagePrimary!=="每日 1-2罐"||drink30Authority?.usageTiming!=="飲用時間可依個人使用習慣與作息時間安排")throw new Error("30cc目前用法／時間原則不同步");
  if(/玻璃瓶|30cc／瓶|瓶裝|開瓶/.test(JSON.stringify(drink30)))throw new Error("30cc不得出現瓶型舊稱");
  if(!String(drink30?.image||"").includes("/images/customer-display-v20260812/guilu-drink-30cc.avif"))throw new Error("30cc未使用正式產品圖");
  const drink180=(merged.products||[]).find(item=>item.id==="guilu-drink-180");
  if(!String(drink180?.image||"").includes("/images/customer-display-v20260812/guilu-drink-180cc-product.jpg"))throw new Error("180cc未使用正式產品圖");

  const tangkuai=official.get("guilu-tangkuai");
  if(tangkuai?.specification!=="75g （2兩）／盒｜8塊裝"||tangkuai?.detailUnitApprox!=="每塊約9.375g"||!String(tangkuai?.detailUnitRule||"").includes("可顯示完整規格"))throw new Error("龜鹿湯塊目前規格／約重／顧客文字規則不同步");
  const jiao=official.get("guilu-jiao");
  if(jiao?.specification!=="600g （1斤）／盒｜32塊裝"||jiao?.detailUnitApprox!=="每塊約18.75 g"||!String(jiao?.detailUnitRule||"").includes("可顯示完整規格"))throw new Error("龜鹿膠目前規格／約重／顧客文字規則不同步");

  const trial=authority.trialPosterAuthority||{};
  const trialDisplay=String(trial.currentDisplay||"").trim();
  if(!trialDisplay)throw new Error("試喝圖缺少目前正式權威");
  if(!trialDisplay.includes("/images/trial/trial-poster-small-boss-official-v20260814.jpg"))throw new Error("試喝圖未使用使用者最新指定的小老闆正式主圖");
  if(/\/trial\.webp(?:[?#]|$)|trial-clean-v4\.svg/i.test(trialDisplay))throw new Error("試喝圖不得回退已退役舊主圖");
  if(trial.status!=="approved_display"||trial.doNotRegenerate!==true)throw new Error("試喝主圖核准／禁止重生成規則不同步");
  if(String(merged.trialPosterAuthority?.currentDisplay||"")!==trialDisplay)throw new Error("試喝圖權威未同步至LINE執行資料");

  const policy=String(authority.displayPolicy||"");
  if(!policy.includes("產品介紹")||!policy.includes("正式產品圖")||!policy.includes("詳細DM")||!policy.includes("試喝")||!policy.includes("顧客文字"))throw new Error("LINE媒體／完整顧客文字政策未同步");
}
function main(){
  const mode=process.argv.includes("--write")?"write":"check"; const raw=JSON.parse(fs.readFileSync(DATA_PATH,"utf8")); const authority=JSON.parse(fs.readFileSync(AUTHORITY_PATH,"utf8")); const merged=applyMaster(raw); const photoAuthority=getPhotoAuthority(); assertCurrent(merged,authority,photoAuthority);
  if(mode==="write"){const next=stable(merged),previous=fs.readFileSync(DATA_PATH,"utf8");if(previous!==next)fs.writeFileSync(DATA_PATH,next,"utf8");}
  console.log(`PASS: LINE current catalog ${mode}; six formal product images + six current dm-final DMs + current trial master are separated and current.`);
}
main();
