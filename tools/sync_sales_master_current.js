"use strict";

const fs = require("fs");
const path = require("path");
const { applyMaster, getPhotoAuthority } = require("../product-sales-master");

const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "data.json");
const AUTHORITY_PATH = path.join(ROOT, "assets/data/official-products.json");
const stable = (value) => JSON.stringify(value, null, 2) + "\n";
const PRODUCT_IDS = ["guilu-gao","guilu-drink-30","guilu-drink-180","guilu-tangkuai","guilu-jiao","luerong-fen"];

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
    for(const field of ["image","imageUrl","image_url"]) if(String(product[field]||"")!==productImage)throw new Error(`${id}.${field} 必須使用六張正式產品圖`);
    if(String(product.dmImage||"")!==detailedDm)throw new Error(`${id}.dmImage 必須使用獨立修正版詳細DM`);
    if(String(product.officialOriginalImage||"")!==photo)throw new Error(`${id}.officialOriginalImage 必須保留products-v3實物身份參考`);
    if(product.imagePolicy!=="six-official-product-images-plus-separate-corrected-dm-preserve-products-v3-identity")throw new Error(`${id}圖片政策不同步`);
  }
  const drink30=(merged.products||[]).find(item=>item.id==="guilu-drink-30");
  if(/玻璃瓶|30cc／瓶|瓶裝|開瓶/.test(JSON.stringify(drink30)))throw new Error("30cc不得出現瓶型舊稱");
  if(!String(drink30?.image||"").includes("/images/customer-display-v20260812/guilu-drink-30cc.webp"))throw new Error("30cc未使用正式產品圖");
  if(!String(drink30?.dmImage||"").includes("/images/dm-approved-v20260810/guilu-drink-30cc.webp"))throw new Error("30cc未使用修正版詳細DM");
  const drink180=(merged.products||[]).find(item=>item.id==="guilu-drink-180");
  if(!String(drink180?.image||"").includes("/images/customer-display-v20260812/guilu-drink-180cc.webp"))throw new Error("180cc未使用正式產品圖");
  const tangkuai=official.get("guilu-tangkuai");
  if(tangkuai?.specification!=="75g／盒｜8塊裝"||tangkuai?.detailUnitApprox!=="每塊約9.375g"||!String(tangkuai?.detailUnitRule||"").includes("僅詳細資料"))throw new Error("龜鹿湯塊主規格／詳細約重規則不同步");
  const jiao=official.get("guilu-jiao");
  if(jiao?.specification!=="600g（1斤）／盒｜32塊裝"||jiao?.detailUnitApprox!=="每塊約18.75g"||!String(jiao?.detailUnitRule||"").includes("僅詳細資料"))throw new Error("龜鹿膠主規格／詳細約重規則不同步");
  const trial=authority.trialPosterAuthority||{};
  if(!String(trial.currentDisplay||"").includes("/images/customer-display-v20260812/trial.webp"))throw new Error("試喝圖未使用獨立正式試喝主圖");
  if(String(merged.trialPosterAuthority?.currentDisplay||"")!==String(trial.currentDisplay||""))throw new Error("試喝圖權威未同步至LINE執行資料");
  if(!String(authority.displayPolicy||"").includes("詳細DM使用獨立修正版DM"))throw new Error("LINE媒體角色分離政策未同步");
}
function main(){
  const mode=process.argv.includes("--write")?"write":"check"; const raw=JSON.parse(fs.readFileSync(DATA_PATH,"utf8")); const authority=JSON.parse(fs.readFileSync(AUTHORITY_PATH,"utf8")); const merged=applyMaster(raw); const photoAuthority=getPhotoAuthority(); assertCurrent(merged,authority,photoAuthority);
  if(mode==="write"){const next=stable(merged),previous=fs.readFileSync(DATA_PATH,"utf8");if(previous!==next)fs.writeFileSync(DATA_PATH,next,"utf8");}
  console.log(`PASS: LINE current catalog ${mode}; product images + corrected detailed DMs + trial master are separated.`);
}
main();
