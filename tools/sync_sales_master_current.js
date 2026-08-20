"use strict";

const fs = require("fs");
const path = require("path");
const { applyMaster, getPhotoAuthority } = require("../product-sales-master");

const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "data.json");
const AUTHORITY_PATH = path.join(ROOT, "assets/data/official-products.json");
// 唯一文字／AI產品母資料：七項目前正式產品。
// 六項正式產品圖與詳細DM屬媒體層，保留在LINE目前authority，不得反向覆蓋文字母資料。
const MASTER_URL = process.env.PRODUCT_MASTER_URL || "https://raw.githubusercontent.com/TS15825868/xianjiawei/main/public-product-master.json";
const stable = (value) => JSON.stringify(value, null, 2) + "\n";
const MEDIA_PRODUCT_IDS = ["guilu-gao","guilu-drink-30","guilu-drink-180","guilu-tangkuai","guilu-jiao","luerong-fen"];
const KNOWLEDGE_PRODUCT_IDS = [...MEDIA_PRODUCT_IDS,"qixuan-guilu-drink-powder"];
const CURRENT_30_USAGE = "每日 1–2 罐";
const CURRENT_DM = Object.freeze({
  "guilu-gao": "/images/dm-final/01_guilu-gao-100g-dm.jpg",
  "guilu-drink-30": "/images/dm-final/02_guilu-drink-30cc-dm-official-v20260814.jpg",
  "guilu-drink-180": "/images/dm-final/03_guilu-drink-180cc-dm.jpg",
  "guilu-tangkuai": "/images/dm-final/05_guilu-tangkuai-75g-dm.jpg",
  "guilu-jiao": "/images/dm-final/06_guilu-jiao-600g-dm.jpg",
  "luerong-fen": "/images/dm-final/04_luerong-fen-75g-dm.jpg",
});

function validateMaster(master){
  if(master?.authority!=="user-confirmed-current")throw new Error("七項公開產品母資料 authority 錯誤");
  if(master?.productCount!==7||!Array.isArray(master?.products)||master.products.length!==7)throw new Error("公開產品母資料必須剛好7項目前正式產品");
  const ids=master.products.map(item=>item.id);
  if(JSON.stringify(ids)!==JSON.stringify(KNOWLEDGE_PRODUCT_IDS))throw new Error(`七項公開產品母資料品項或順序錯誤：${ids.join(",")}`);
  for(const product of master.products){
    for(const field of ["id","name","specification","form"]){
      const value=product[field];
      if(value===undefined||value===null||value==="")throw new Error(`${product.id} 公開產品母資料缺少 ${field}`);
    }
    if(MEDIA_PRODUCT_IDS.includes(product.id)&&(!Array.isArray(product.ingredients)||!product.ingredients.length))throw new Error(`${product.id} 公開產品母資料缺少正式成分`);
  }
}

async function fetchMaster(){
  const response=await fetch(MASTER_URL,{headers:{"user-agent":"xianjiawei-lineoa-public-product-ssot"}});
  if(!response.ok)throw new Error(`無法下載七項公開產品母資料：HTTP ${response.status}`);
  const master=await response.json();
  validateMaster(master);
  return master;
}

function usagePrimary(source,local){
  if(Array.isArray(source?.usage)&&String(source.usage[0]||"").trim())return String(source.usage[0]).trim();
  return String(source?.usagePrimary||local?.usagePrimary||"").trim();
}

function usageTiming(source,local){
  const explicit=String(source?.usageTiming||local?.usageTiming||"").trim();
  if(explicit)return explicit;
  if(source?.id==="guilu-drink-30"||source?.id==="guilu-drink-180")return "飲用時間可依個人使用習慣與作息時間安排";
  return "";
}

function detailUnitApprox(source,local){
  return String(source?.detail||source?.detailUnitApprox||local?.detailUnitApprox||"").trim();
}

function fulfillmentType(source,local){
  if(source?.id==="guilu-drink-30"||source?.id==="guilu-drink-180")return "made-to-order-drink";
  if(MEDIA_PRODUCT_IDS.includes(source?.id))return String(local?.fulfillmentType||"ready-stock");
  return String(local?.fulfillmentType||source?.fulfillmentType||"not-publicly-specified");
}

function mergeAuthority(localAuthority,master){
  const localById=new Map((localAuthority.products||[]).map(item=>[item.id,item]));
  const products=master.products.map(source=>{
    const local=localById.get(source.id)||{};
    const primary=usagePrimary(source,local);
    const timing=usageTiming(source,local);
    const detail=detailUnitApprox(source,local);
    const media=MEDIA_PRODUCT_IDS.includes(source.id);
    return {
      ...local,
      id:source.id,
      name:source.name,
      displayName:source.name,
      specification:source.specification,
      ...(source.package?{package:source.package}:{}),
      ...(source.form?{form:source.form}:{}),
      ...(Array.isArray(source.ingredients)&&source.ingredients.length?{ingredients:[...source.ingredients]}:{}),
      ...(primary?{usagePrimary:primary}:{}),
      ...(timing?{usageTiming:timing}:{}),
      ...(detail?{detailUnitApprox:detail}:{}),
      fulfillmentType:fulfillmentType(source,local),
      ...(media?{
        approvedProductImage:local.approvedProductImage,
        approvedDm:local.approvedDm,
      }:{}),
      publicProductMasterVersion:master.version
    };
  });
  return {
    ...localAuthority,
    version:`${master.version}-line-channel-v3`,
    authority:"user-confirmed-current",
    publicAuthority:MASTER_URL,
    aiAnswerAuthority:localAuthority.aiAnswerAuthority||"https://ts15825868.github.io/xianjiawei/ai-answers.json",
    productMasterAuthority:master.authority,
    productMasterVersion:master.version,
    products,
    knowledgeProductIds:[...KNOWLEDGE_PRODUCT_IDS],
    approvedMediaProductIds:[...MEDIA_PRODUCT_IDS],
    fulfillmentPolicy:{...(localAuthority.fulfillmentPolicy||{}),...(master.fulfillmentPolicy||{})},
    guardRules:[
      `七項產品文字／AI核心事實唯一來源：${MASTER_URL} (${master.version})`,
      "六項已核准產品圖／詳細DM是媒體層；不得反向覆蓋七項文字母資料，也不得替柒玄茶自創包裝",
      ...((localAuthority.guardRules||[]).filter(rule=>!String(rule).startsWith("六項產品核心事實唯一來源：")&&!String(rule).startsWith("七項文字／AI知識使用目前公開權威；")&&!String(rule).startsWith("七項產品文字／AI核心事實唯一來源：")))
    ]
  };
}

function mergeData(localData,master,authority){
  const masterById=new Map(master.products.map(item=>[item.id,item]));
  const authorityById=new Map((authority.products||[]).map(item=>[item.id,item]));
  const products=(localData.products||[]).filter(item=>MEDIA_PRODUCT_IDS.includes(item.id)).map(local=>{
    const source=masterById.get(local.id);
    const rule=authorityById.get(local.id);
    if(!source||!rule)return local;
    return {
      ...local,
      series:source.series||local.series,
      name:source.name,
      displayName:source.name,
      specification:source.specification,
      size:source.specification,
      spec:source.specification,
      form:source.form||local.form,
      ...(source.package?{package:source.package}:{}),
      ...(Array.isArray(source.ingredients)&&source.ingredients.length?{ingredients:[...source.ingredients]}:{}),
      ...(Array.isArray(source.usage)&&source.usage.length?{usage:[...source.usage]}:{}),
      ...(rule.usagePrimary?{usagePrimary:rule.usagePrimary}:{}),
      ...(rule.usageTiming?{usageTiming:rule.usageTiming}:{}),
      ...(rule.detailUnitApprox?{detailUnitApprox:rule.detailUnitApprox}:{}),
      fulfillmentType:rule.fulfillmentType||local.fulfillmentType,
      detailPage:source.page||local.detailPage,
      fulfillmentNotice:rule.fulfillmentType==="made-to-order-drink"?(authority.fulfillmentPolicy?.drinkNotice||source.fulfillment):authority.fulfillmentPolicy?.readyStockNotice,
      image:rule.approvedProductImage,
      imageUrl:rule.approvedProductImage,
      image_url:rule.approvedProductImage,
      dmImage:rule.approvedDm,
      officialOriginalImage:local.officialOriginalImage,
      productMasterVersion:master.version
    };
  });
  return {
    ...localData,
    products,
    fulfillmentPolicy:{...(localData.fulfillmentPolicy||{}),...(authority.fulfillmentPolicy||{})},
    officialProductIds:[...MEDIA_PRODUCT_IDS],
    officialProductCount:MEDIA_PRODUCT_IDS.length,
    knowledgeProductIds:[...KNOWLEDGE_PRODUCT_IDS],
    knowledgeProductCount:KNOWLEDGE_PRODUCT_IDS.length,
    productMasterVersion:master.version,
    productMasterAuthority:master.authority,
    productMasterSource:MASTER_URL
  };
}

function assertCurrent(merged, authority, photoAuthority, master) {
  if (authority?.authority !== "user-confirmed-current") throw new Error("LINE目前產品權威不是user-confirmed-current");
  if(authority?.productMasterVersion!==master.version||merged?.productMasterVersion!==master.version)throw new Error("LINE未同步目前七項公開產品母資料版本");
  const official = new Map((authority.products || []).map((item) => [item.id, item]));
  const sourceById = new Map((master.products || []).map((item) => [item.id, item]));
  if (official.size !== 7) throw new Error("LINE文字／AI產品知識必須剛好7項");
  if ((merged.products || []).length !== 6) throw new Error("LINE顧客產品卡目前必須剛好6項已有核准正式實物圖產品");
  for (const id of MEDIA_PRODUCT_IDS) {
    const product=(merged.products||[]).find(item=>item.id===id), rule=official.get(id), source=sourceById.get(id), photo=String(photoAuthority?.products?.[id]||"").trim();
    if(!product||!rule||!source||!photo)throw new Error(`${id}缺少目前正式產品權威`);
    if(product.name!==source.name||rule.name!==source.name)throw new Error(`${id}正式名稱未由七項公開母資料同步`);
    if(product.specification!==source.specification||product.size!==source.specification||product.spec!==source.specification||rule.specification!==source.specification)throw new Error(`${id}正式規格未由七項公開母資料同步`);
    if(JSON.stringify(product.ingredients)!==JSON.stringify(source.ingredients))throw new Error(`${id}成分未由七項公開母資料同步`);
    const productImage=String(rule.approvedProductImage||"").trim(), detailedDm=String(rule.approvedDm||"").trim();
    if(!productImage||!detailedDm)throw new Error(`${id}缺少正式產品圖或詳細DM媒體層`);
    if(!detailedDm.includes(CURRENT_DM[id]))throw new Error(`${id}詳細DM不是目前dm-final權威：${detailedDm}`);
    if(/\/images\/dm-approved-v20260810\//.test(detailedDm))throw new Error(`${id}仍使用退役dm-approved-v20260810來源`);
    for(const field of ["image","imageUrl","image_url"]) if(String(product[field]||"")!==productImage)throw new Error(`${id}.${field} 必須使用目前正式產品圖`);
    if(String(product.dmImage||"")!==detailedDm)throw new Error(`${id}.dmImage 必須使用目前詳細DM`);
    if(String(product.officialOriginalImage||"")!==photo)throw new Error(`${id}.officialOriginalImage 必須保留products-v3實物身份參考`);
  }

  const qixuan=official.get("qixuan-guilu-drink-powder");
  const qixuanSource=sourceById.get("qixuan-guilu-drink-powder");
  if(!qixuan||!qixuanSource||qixuan.name!=="柒玄茶・龜鹿調飲粉"||qixuan.specification!=="2g／小包；20g／包（10小包）")throw new Error("柒玄茶文字／AI知識權威缺失或規格錯誤");
  if(String(qixuan.approvedProductImage||"").trim()||photoAuthority?.products?.["qixuan-guilu-drink-powder"])throw new Error("柒玄茶尚未核准正式實物圖時不得建立假產品圖");

  const gao=official.get("guilu-gao");
  if(gao?.usagePrimary!=="食用時間可依個人使用習慣與作息時間安排")throw new Error("龜鹿膏不得回退固定早上／下午時段");
  const drink30=(merged.products||[]).find(item=>item.id==="guilu-drink-30");
  const drink30Rule=official.get("guilu-drink-30");
  if(drink30Rule?.usagePrimary!==CURRENT_30_USAGE||drink30Rule?.usageTiming!=="飲用時間可依個人使用習慣與作息時間安排")throw new Error("30cc目前新版用法／時間原則不同步");
  if(drink30?.usage?.[0]!==CURRENT_30_USAGE)throw new Error("30cc執行資料必須維持每日 1–2 罐，不得回退每日一罐");
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
  const nextRaw=mergeData(raw,master,nextAuthority);

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
    if(currentAuthority!==stable(nextAuthority))throw new Error("LINE official-products.json 尚未同步目前七項公開產品母資料；請執行 npm run sync:catalog");
    if(stable(raw)!==stable(merged))throw new Error("LINE data.json 尚未同步目前執行資料；請執行 npm run sync:catalog");
  }
  console.log(`PASS: LINE public product SSOT ${master.version} ${mode}; seven knowledge products + six approved media products; channel prices/promotions remain local.`);
}

main().catch(error=>{
  console.error(error.message||error);
  process.exit(1);
});
