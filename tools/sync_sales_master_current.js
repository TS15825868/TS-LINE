"use strict";

const fs = require("fs");
const path = require("path");
const { applyMaster, getPhotoAuthority } = require("../product-sales-master");

const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "data.json");
const AUTHORITY_PATH = path.join(ROOT, "assets/data/official-products.json");
const MASTER_URL = process.env.PRODUCT_MASTER_URL || "https://raw.githubusercontent.com/TS15825868/xianjiawei/main/product-master.json";
const stable = (value) => JSON.stringify(value, null, 2) + "\n";
const PRODUCT_IDS = ["guilu-gao","guilu-drink-30","guilu-drink-180","guilu-tangkuai","guilu-jiao","luerong-fen"];
const SHARED_FIELDS = [
  "series","name","displayName","specification","size","form","package","description","ingredients",
  "usagePrimary","usageTiming","usage","storage","fit","purpose","purposeDirection","fulfillmentType",
  "readyStock","page","detailUnitApprox","knownContainerDimensionsMm","aspectRatioWidthToHeight"
];
const CURRENT_DM = Object.freeze({
  "guilu-gao": "/images/dm-final/01_guilu-gao-100g-dm.jpg",
  "guilu-drink-30": "/images/dm-final/02_guilu-drink-30cc-dm-official-v20260814.jpg",
  "guilu-drink-180": "/images/dm-final/03_guilu-drink-180cc-dm.jpg",
  "guilu-tangkuai": "/images/dm-final/05_guilu-tangkuai-75g-dm.jpg",
  "guilu-jiao": "/images/dm-final/06_guilu-jiao-600g-dm.jpg",
  "luerong-fen": "/images/dm-final/04_luerong-fen-75g-dm.jpg",
});

function validateMaster(master){
  if(master?.authority!=="xianjiawei-product-ssot")throw new Error("產品母資料 authority 錯誤");
  if(master?.productCount!==6||!Array.isArray(master?.products)||master.products.length!==6)throw new Error("產品母資料必須剛好6項正式產品");
  const ids=master.products.map(item=>item.id);
  if(JSON.stringify(ids)!==JSON.stringify(PRODUCT_IDS))throw new Error(`產品母資料品項或順序錯誤：${ids.join(",")}`);
  for(const product of master.products){
    for(const field of ["id","name","specification","ingredients","fulfillmentType","approvedProductImage","approvedDm","officialOriginalImage"]){
      const value=product[field];
      if(value===undefined||value===null||value===""||(Array.isArray(value)&&!value.length))throw new Error(`${product.id} 母資料缺少 ${field}`);
    }
  }
}

async function fetchMaster(){
  const response=await fetch(MASTER_URL,{headers:{"user-agent":"xianjiawei-lineoa-product-ssot"}});
  if(!response.ok)throw new Error(`無法下載產品母資料：HTTP ${response.status}`);
  const master=await response.json();
  validateMaster(master);
  return master;
}

function mergeAuthority(localAuthority,master){
  const localById=new Map((localAuthority.products||[]).map(item=>[item.id,item]));
  const products=master.products.map(source=>{
    const local=localById.get(source.id)||{};
    return {
      ...local,
      id:source.id,
      name:source.name,
      specification:source.specification,
      ...(source.package?{package:source.package}:{}),
      ingredients:[...source.ingredients],
      ...(source.usagePrimary?{usagePrimary:source.usagePrimary}:{}),
      ...(source.usageTiming?{usageTiming:source.usageTiming}:{}),
      ...(source.detailUnitApprox?{detailUnitApprox:source.detailUnitApprox}:{}),
      fulfillmentType:source.fulfillmentType,
      approvedProductImage:source.approvedProductImage,
      approvedDm:source.approvedDm,
      productMasterVersion:master.version
    };
  });
  return {
    ...localAuthority,
    version:`${master.version}-line-channel-v1`,
    authority:"user-confirmed-current",
    publicAuthority:MASTER_URL,
    productMasterAuthority:master.authority,
    productMasterVersion:master.version,
    products,
    fulfillmentPolicy:{...(localAuthority.fulfillmentPolicy||{}),...(master.fulfillmentPolicy||{})},
    guardRules:[
      `六項產品核心事實唯一來源：${MASTER_URL} (${master.version})`,
      ...((localAuthority.guardRules||[]).filter(rule=>!String(rule).startsWith("六項產品核心事實唯一來源：")))
    ]
  };
}

function mergeData(localData,master){
  const masterById=new Map(master.products.map(item=>[item.id,item]));
  const products=(localData.products||[]).map(local=>{
    const source=masterById.get(local.id);
    if(!source)return local;
    const shared={};
    for(const field of SHARED_FIELDS){
      if(source[field]!==undefined)shared[field]=source[field];
    }
    return {
      ...local,
      ...shared,
      spec:source.specification,
      detailPage:source.page||local.detailPage,
      fulfillmentNotice:source.fulfillmentType==="made-to-order-drink"?master.fulfillmentPolicy?.drinkNotice:master.fulfillmentPolicy?.readyStockNotice,
      image:source.approvedProductImage,
      imageUrl:source.approvedProductImage,
      image_url:source.approvedProductImage,
      dmImage:source.approvedDm,
      officialOriginalImage:source.officialOriginalImage,
      productMasterVersion:master.version
    };
  });
  return {
    ...localData,
    products,
    fulfillmentPolicy:{...(localData.fulfillmentPolicy||{}),...(master.fulfillmentPolicy||{})},
    officialProductIds:[...master.officialProductIds],
    officialProductCount:master.productCount,
    productMasterVersion:master.version,
    productMasterAuthority:master.authority,
    productMasterSource:MASTER_URL
  };
}

function assertCurrent(merged, authority, photoAuthority, master) {
  if (authority?.authority !== "user-confirmed-current") throw new Error("LINE目前產品權威不是user-confirmed-current");
  if(authority?.productMasterVersion!==master.version||merged?.productMasterVersion!==master.version)throw new Error("LINE未同步目前產品母資料版本");
  const official = new Map((authority.products || []).map((item) => [item.id, item]));
  if (official.size !== 6 || (merged.products || []).length !== 6) throw new Error("LINE正式產品必須剛好6項");
  for (const id of PRODUCT_IDS) {
    const product=(merged.products||[]).find(item=>item.id===id), rule=official.get(id), source=(master.products||[]).find(item=>item.id===id), photo=String(photoAuthority?.products?.[id]||"").trim();
    if(!product||!rule||!source||!photo)throw new Error(`${id}缺少目前正式產品權威`);
    if(product.name!==source.name||rule.name!==source.name)throw new Error(`${id}正式名稱未由母資料同步`);
    if(product.specification!==source.specification||product.size!==source.specification||product.spec!==source.specification||rule.specification!==source.specification)throw new Error(`${id}正式規格未由母資料同步`);
    if(JSON.stringify(product.ingredients)!==JSON.stringify(source.ingredients))throw new Error(`${id}成分未由母資料同步`);
    const productImage=String(source.approvedProductImage||"").trim(), detailedDm=String(source.approvedDm||"").trim();
    if(!productImage||!detailedDm)throw new Error(`${id}缺少正式產品圖或詳細DM`);
    if(!detailedDm.includes(CURRENT_DM[id]))throw new Error(`${id}詳細DM不是目前dm-final權威：${detailedDm}`);
    if(/\/images\/dm-approved-v20260810\//.test(detailedDm))throw new Error(`${id}仍使用退役dm-approved-v20260810來源`);
    for(const field of ["image","imageUrl","image_url"]) if(String(product[field]||"")!==productImage)throw new Error(`${id}.${field} 必須使用母資料正式產品圖`);
    if(String(product.dmImage||"")!==detailedDm)throw new Error(`${id}.dmImage 必須使用母資料目前詳細DM`);
    if(String(product.officialOriginalImage||"")!==photo)throw new Error(`${id}.officialOriginalImage 必須保留products-v3實物身份參考`);
  }

  const gao=(master.products||[]).find(item=>item.id==="guilu-gao");
  if(gao?.usagePrimary!=="食用時間可依個人使用習慣與作息時間安排")throw new Error("龜鹿膏不得回退固定早上／下午時段");
  const drink30=(merged.products||[]).find(item=>item.id==="guilu-drink-30");
  const drink30Master=(master.products||[]).find(item=>item.id==="guilu-drink-30");
  if(drink30Master?.usagePrimary!=="每日 1-2罐"||drink30Master?.usageTiming!=="飲用時間可依個人使用習慣與作息時間安排")throw new Error("30cc母資料用法／時間原則不同步");
  if(/玻璃瓶|30cc／瓶|瓶裝|開瓶/.test(JSON.stringify(drink30)))throw new Error("30cc不得出現瓶型舊稱");

  const tangkuai=(master.products||[]).find(item=>item.id==="guilu-tangkuai");
  if(tangkuai?.specification!=="75g （2兩）／盒｜8塊裝"||tangkuai?.detailUnitApprox!=="每塊約9.375g")throw new Error("龜鹿湯塊母資料規格／約重不同步");
  const jiao=(master.products||[]).find(item=>item.id==="guilu-jiao");
  if(jiao?.specification!=="600g （1斤）／盒｜32塊裝"||jiao?.detailUnitApprox!=="每塊約18.75 g")throw new Error("龜鹿膠母資料規格／約重不同步");

  const trial=authority.trialPosterAuthority||{};
  const trialDisplay=String(trial.currentDisplay||"").trim();
  if(!trialDisplay)throw new Error("試喝圖缺少目前正式權威");
  if(!trialDisplay.includes("/images/trial/trial-poster-small-boss-official-v20260814.jpg"))throw new Error("試喝圖未使用目前正式主圖");
  if(/\/trial\.webp(?:[?#]|$)|trial-clean-v4\.svg/i.test(trialDisplay))throw new Error("試喝圖不得回退已退役舊主圖");
  if(trial.status!=="approved_display"||trial.doNotRegenerate!==true)throw new Error("試喝主圖核准／禁止重生成規則不同步");
}

async function main(){
  const mode=process.argv.includes("--write")?"write":"check";
  const master=await fetchMaster();
  const raw=JSON.parse(fs.readFileSync(DATA_PATH,"utf8"));
  const localAuthority=JSON.parse(fs.readFileSync(AUTHORITY_PATH,"utf8"));
  const nextAuthority=mergeAuthority(localAuthority,master);
  const nextRaw=mergeData(raw,master);

  if(mode==="write"){
    const authorityText=stable(nextAuthority);
    const previousAuthority=fs.readFileSync(AUTHORITY_PATH,"utf8");
    if(previousAuthority!==authorityText)fs.writeFileSync(AUTHORITY_PATH,authorityText,"utf8");
  }

  const merged=applyMaster(nextRaw);
  const photoAuthority=getPhotoAuthority();
  assertCurrent(merged,nextAuthority,photoAuthority,master);

  if(mode==="write"){
    const next=stable(merged),previous=fs.readFileSync(DATA_PATH,"utf8");
    if(previous!==next)fs.writeFileSync(DATA_PATH,next,"utf8");
  }else{
    const currentAuthority=stable(localAuthority);
    if(currentAuthority!==stable(nextAuthority))throw new Error("LINE official-products.json 尚未同步目前產品母資料；請執行 npm run sync:catalog");
    if(stable(raw)!==stable(merged))throw new Error("LINE data.json 尚未同步目前產品母資料；請執行 npm run sync:catalog");
  }
  console.log(`PASS: LINE product SSOT ${master.version} ${mode}; channel prices/promotions remain local.`);
}

main().catch(error=>{
  console.error(error.message||error);
  process.exit(1);
});
