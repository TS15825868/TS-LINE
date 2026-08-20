"use strict";

const fs = require("fs");
const path = require("path");
const { applyMaster, getPhotoAuthority } = require("../product-sales-master");

const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "data.json");
const AUTHORITY_PATH = path.join(ROOT, "assets/data/official-products.json");
// 舊 product-master 目前只承擔「六項已有正式產品圖／DM的通路媒體與核心商品資料」同步；
// 七項公開文字／AI知識權威由 official-products.json.publicAuthority 指向 public-product-master.json，
// 不得再用六項媒體母檔把第七項柒玄茶刪掉，也不得把30cc新版用法改回舊值。
const MASTER_URL = process.env.PRODUCT_MASTER_URL || "https://raw.githubusercontent.com/TS15825868/xianjiawei/main/product-master.json";
const stable = (value) => JSON.stringify(value, null, 2) + "\n";
const PRODUCT_IDS = ["guilu-gao","guilu-drink-30","guilu-drink-180","guilu-tangkuai","guilu-jiao","luerong-fen"];
const KNOWLEDGE_ONLY_IDS = ["qixuan-guilu-drink-powder"];
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
  if(master?.authority!=="xianjiawei-product-ssot")throw new Error("六項媒體產品母資料 authority 錯誤");
  if(master?.productCount!==6||!Array.isArray(master?.products)||master.products.length!==6)throw new Error("六項媒體產品母資料必須剛好6項已有正式產品圖／DM的產品");
  const ids=master.products.map(item=>item.id);
  if(JSON.stringify(ids)!==JSON.stringify(PRODUCT_IDS))throw new Error(`六項媒體產品母資料品項或順序錯誤：${ids.join(",")}`);
  for(const product of master.products){
    for(const field of ["id","name","specification","ingredients","fulfillmentType","approvedProductImage","approvedDm","officialOriginalImage"]){
      const value=product[field];
      if(value===undefined||value===null||value===""||(Array.isArray(value)&&!value.length))throw new Error(`${product.id} 六項媒體母資料缺少 ${field}`);
    }
  }
}

async function fetchMaster(){
  const response=await fetch(MASTER_URL,{headers:{"user-agent":"xianjiawei-lineoa-product-media-ssot"}});
  if(!response.ok)throw new Error(`無法下載六項媒體產品母資料：HTTP ${response.status}`);
  const master=await response.json();
  validateMaster(master);
  return master;
}

function mergeAuthority(localAuthority,master){
  const localById=new Map((localAuthority.products||[]).map(item=>[item.id,item]));
  const mediaProducts=master.products.map(source=>{
    const local=localById.get(source.id)||{};
    return {
      ...local,
      id:source.id,
      name:source.name,
      specification:source.specification,
      ...(source.package?{package:source.package}:{}),
      ingredients:[...source.ingredients],
      // 使用方式與每塊約重優先保留目前新版 authority；六項舊媒體母檔不得覆蓋新版正確文字。
      ...((local.usagePrimary||source.usagePrimary)?{usagePrimary:local.usagePrimary||source.usagePrimary}:{}),
      ...((local.usageTiming||source.usageTiming)?{usageTiming:local.usageTiming||source.usageTiming}:{}),
      ...((local.detailUnitApprox||source.detailUnitApprox)?{detailUnitApprox:local.detailUnitApprox||source.detailUnitApprox}:{}),
      fulfillmentType:source.fulfillmentType,
      approvedProductImage:source.approvedProductImage,
      approvedDm:source.approvedDm,
      productMasterVersion:master.version
    };
  });
  const knowledgeOnly=KNOWLEDGE_ONLY_IDS.map(id=>localById.get(id)).filter(Boolean).map(item=>({...item}));
  const products=[...mediaProducts,...knowledgeOnly];
  return {
    ...localAuthority,
    version:`${master.version}-line-seven-knowledge-v2`,
    authority:"user-confirmed-current",
    publicAuthority:localAuthority.publicAuthority||"https://ts15825868.github.io/xianjiawei/public-product-master.json",
    aiAnswerAuthority:localAuthority.aiAnswerAuthority||"https://ts15825868.github.io/xianjiawei/ai-answers.json",
    mediaProductMasterAuthority:MASTER_URL,
    productMasterAuthority:master.authority,
    productMasterVersion:master.version,
    products,
    knowledgeProductIds:products.map(item=>item.id),
    approvedMediaProductIds:[...PRODUCT_IDS],
    fulfillmentPolicy:{...(localAuthority.fulfillmentPolicy||{}),...(master.fulfillmentPolicy||{})},
    guardRules:[
      `七項文字／AI知識使用目前公開權威；六項正式產品圖／DM由媒體母檔同步：${MASTER_URL} (${master.version})`,
      ...((localAuthority.guardRules||[]).filter(rule=>!String(rule).startsWith("六項產品核心事實唯一來源：")&&!String(rule).startsWith("七項文字／AI知識使用目前公開權威；")))
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
    // 這兩個欄位代表可直接顯示正式產品圖／DM的六項通路商品，不代表AI文字知識總數。
    officialProductIds:[...master.officialProductIds],
    officialProductCount:master.productCount,
    productMasterVersion:master.version,
    productMasterAuthority:master.authority,
    productMasterSource:MASTER_URL
  };
}

function assertCurrent(merged, authority, photoAuthority, master) {
  if (authority?.authority !== "user-confirmed-current") throw new Error("LINE目前產品權威不是user-confirmed-current");
  if(authority?.productMasterVersion!==master.version||merged?.productMasterVersion!==master.version)throw new Error("LINE六項媒體商品未同步目前產品母資料版本");
  const official = new Map((authority.products || []).map((item) => [item.id, item]));
  if (official.size !== 7) throw new Error("LINE文字／AI產品知識必須剛好7項");
  if ((merged.products || []).length !== 6) throw new Error("LINE顧客產品卡目前必須剛好6項已有核准正式實物圖產品");
  for (const id of PRODUCT_IDS) {
    const product=(merged.products||[]).find(item=>item.id===id), rule=official.get(id), source=(master.products||[]).find(item=>item.id===id), photo=String(photoAuthority?.products?.[id]||"").trim();
    if(!product||!rule||!source||!photo)throw new Error(`${id}缺少目前正式產品權威`);
    if(product.name!==source.name||rule.name!==source.name)throw new Error(`${id}正式名稱未由六項媒體母資料同步`);
    if(product.specification!==source.specification||product.size!==source.specification||product.spec!==source.specification||rule.specification!==source.specification)throw new Error(`${id}正式規格未由六項媒體母資料同步`);
    if(JSON.stringify(product.ingredients)!==JSON.stringify(source.ingredients))throw new Error(`${id}成分未由六項媒體母資料同步`);
    const productImage=String(source.approvedProductImage||"").trim(), detailedDm=String(source.approvedDm||"").trim();
    if(!productImage||!detailedDm)throw new Error(`${id}缺少正式產品圖或詳細DM`);
    if(!detailedDm.includes(CURRENT_DM[id]))throw new Error(`${id}詳細DM不是目前dm-final權威：${detailedDm}`);
    if(/\/images\/dm-approved-v20260810\//.test(detailedDm))throw new Error(`${id}仍使用退役dm-approved-v20260810來源`);
    for(const field of ["image","imageUrl","image_url"]) if(String(product[field]||"")!==productImage)throw new Error(`${id}.${field} 必須使用母資料正式產品圖`);
    if(String(product.dmImage||"")!==detailedDm)throw new Error(`${id}.dmImage 必須使用母資料目前詳細DM`);
    if(String(product.officialOriginalImage||"")!==photo)throw new Error(`${id}.officialOriginalImage 必須保留products-v3實物身份參考`);
  }

  const qixuan=official.get("qixuan-guilu-drink-powder");
  if(!qixuan||qixuan.name!=="柒玄茶・龜鹿調飲粉"||qixuan.specification!=="2g／小包；20g／包（10小包）")throw new Error("柒玄茶文字／AI知識權威缺失或規格錯誤");
  if(String(qixuan.approvedProductImage||"").trim()||photoAuthority?.products?.["qixuan-guilu-drink-powder"])throw new Error("柒玄茶尚未核准正式實物圖時不得建立假產品圖");

  const gao=official.get("guilu-gao");
  if(gao?.usagePrimary!=="食用時間可依個人使用習慣與作息時間安排")throw new Error("龜鹿膏不得回退固定早上／下午時段");
  const drink30=(merged.products||[]).find(item=>item.id==="guilu-drink-30");
  const drink30Rule=official.get("guilu-drink-30");
  if(drink30Rule?.usagePrimary!=="每日一罐"||drink30Rule?.usageTiming!=="飲用時間可依個人使用習慣與作息時間安排")throw new Error("30cc目前新版用法／時間原則不同步");
  if(drink30?.usage?.[0]!=="每日一罐")throw new Error("30cc執行資料不得回退每日1-2罐");
  if(/玻璃瓶|30cc／瓶|瓶裝|開瓶/.test(JSON.stringify(drink30)))throw new Error("30cc不得出現瓶型舊稱");

  const tangkuai=official.get("guilu-tangkuai");
  if(tangkuai?.specification!=="75g （2兩）／盒｜8塊裝"||tangkuai?.detailUnitApprox!=="每塊約9.375g")throw new Error("龜鹿湯塊目前規格／約重不同步");
  const jiao=official.get("guilu-jiao");
  if(jiao?.specification!=="600g （1斤）／盒｜32塊裝"||!/^每塊約18\.75\s*g$/.test(String(jiao?.detailUnitApprox||"")))throw new Error("龜鹿膠目前規格／約重不同步");

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
    if(currentAuthority!==stable(nextAuthority))throw new Error("LINE official-products.json 尚未同步目前六項媒體母資料／七項知識權威；請執行 npm run sync:catalog");
    if(stable(raw)!==stable(merged))throw new Error("LINE data.json 尚未同步目前執行資料；請執行 npm run sync:catalog");
  }
  console.log(`PASS: LINE media SSOT ${master.version} ${mode}; seven knowledge products + six approved media products; channel prices/promotions remain local.`);
}

main().catch(error=>{
  console.error(error.message||error);
  process.exit(1);
});
