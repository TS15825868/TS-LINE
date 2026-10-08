"use strict";

const fs=require("fs");
const path=require("path");
const {applyMaster,getPhotoAuthority}=require("../product-sales-master");
const ROOT=path.resolve(__dirname,"..");
const DATA_PATH=path.join(ROOT,"data.json");
const AUTHORITY_PATH=path.join(ROOT,"assets/data/official-products.json");
const MASTER_URL=process.env.PRODUCT_MASTER_URL||"https://raw.githubusercontent.com/TS15825868/xianjiawei/main/public-product-master.json";
const stable=v=>JSON.stringify(v,null,2)+"\n";
const REQUIRED_CURRENT_IDS=["guilu-gao","guilu-drink-30","guilu-drink-180","luerong-fen"];
const QIXUAN_ID="qixuan-guilu-drink-powder";
const publicIdsFromMaster=(master)=>[...new Set((master?.products||[]).map(x=>String(x?.id||"").trim()).filter(Boolean))];
const CURRENT_30_USAGE="每日 1–2 罐";
const QIXUAN_HIDDEN=Object.freeze({
  id:QIXUAN_ID,
  name:"柒玄茶・龜鹿調飲粉",
  specification:"2g／小包；20g／包（10小包）",
  form:"調飲粉",
  websiteVisible:false,
  lineKnowledgeVisible:false,
  publicVisible:false,
  temporarilyHidden:true,
  hiddenReason:"依使用者 2026-08-22 最新指示先隱藏",
  ingredientsStatus:"目前尚未確認正式公開成分表，不自行推測或補寫",
  fulfillmentType:"not-publicly-specified",
  mediaStatus:"formal-product-image-pending",
  displayMode:"hidden-until-user-reactivates"
});
const CURRENT_DM={
  "guilu-gao":"/images/dm-final/01_guilu-gao-100g-dm.jpg",
  "guilu-drink-30":"/images/dm-final/02_guilu-drink-30cc-dm-official-v20260814.jpg",
  "guilu-drink-180":"/images/dm-final/03_guilu-drink-180cc-dm.jpg",
  "luerong-fen":"/images/dm-final/04_luerong-fen-75g-dm.jpg"
};

function validateMaster(master){
  if(master?.authority!=="user-confirmed-current")throw new Error("公開產品母資料 authority 錯誤");
  if(!Array.isArray(master?.products)||master.products.length<1)throw new Error("官網公開產品母資料不得為空");
  const ids=publicIdsFromMaster(master);
  if(ids.length!==master.products.length)throw new Error("官網公開產品母資料含重複或空白產品 id");
  if(Number(master?.productCount)!==ids.length)throw new Error(`官網公開產品 productCount 與實際清單不一致：${master?.productCount} vs ${ids.length}`);
  for(const id of REQUIRED_CURRENT_IDS)if(!ids.includes(id))throw new Error(`目前核心公開產品缺失：${id}`);
  for(const p of master.products){
    for(const f of ["id","name","specification","form"])if(!p?.[f])throw new Error(`${p.id||"產品"}缺少${f}`);
    if(!Array.isArray(p.ingredients)||!p.ingredients.length)throw new Error(`${p.id}缺少正式成分`);
  }
  const d30=master.products.find(x=>x.id==="guilu-drink-30");
  if(d30?.usage?.[0]!==CURRENT_30_USAGE)throw new Error(`30cc公開母資料未同步目前正式用法：${CURRENT_30_USAGE}`);
  if(!d30.usage.includes("可依個人需求調整"))throw new Error("30cc公開母資料缺少正式用量調整說明");
  if(ids.includes(QIXUAN_ID))throw new Error("柒玄茶維持暫緩公開，未明確重新上架不得自動公開");
}

async function fetchMaster(){
  if(process.env.PRODUCT_MASTER_FILE){
    const master=JSON.parse(fs.readFileSync(process.env.PRODUCT_MASTER_FILE,"utf8"));
    validateMaster(master);return master;
  }
  const response=await fetch(MASTER_URL,{headers:{"user-agent":"xianjiawei-lineoa-public-product-ssot"}});
  if(!response.ok)throw new Error(`無法下載官網公開產品母資料：HTTP ${response.status}`);
  const master=await response.json();validateMaster(master);return master;
}

function mergeAuthority(local,master){
  const localBy=new Map((local.products||[]).map(x=>[x.id,x]));
  const publicIds=publicIdsFromMaster(master);
  const qixuanIsPublic=publicIds.includes(QIXUAN_ID);
  const publicProducts=master.products.map(src=>{
    const old=localBy.get(src.id)||{};
    const primary=String(src?.usage?.[0]||old.usagePrimary||"").trim();
    const adjustment=String(src.usageAdjustment||src.usage?.find(x=>x==="可依個人需求調整")||"").trim();
    const timing=String(src?.usageTiming||old.usageTiming||((src.id==="guilu-drink-30"||src.id==="guilu-drink-180")?"飲用時間可依個人使用習慣與作息時間安排":"")).trim();
    return {...old,id:src.id,name:src.name,displayName:src.name,specification:src.specification,...(src.package?{package:src.package}:{}),...(src.form?{form:src.form}:{}),ingredients:[...src.ingredients],...(primary?{usagePrimary:primary}:{}),...(adjustment?{usageAdjustment:adjustment}:{}),...(timing?{usageTiming:timing}:{}),...(src.detail?{detailUnitApprox:src.detail}:{}),publicProductMasterVersion:master.version};
  });
  const previousQixuan=localBy.get(QIXUAN_ID)||{};
  const qixuan={...previousQixuan,...QIXUAN_HIDDEN};
  if(!qixuanIsPublic){
    delete qixuan.approvedProductImage;
    delete qixuan.approvedDm;
    delete qixuan.ingredients;
  }
  const deferredRules=qixuanIsPublic?[]:[
    `目前對外與LINE OA依官網公開母資料顯示${publicIds.length}項正式產品；柒玄茶目前維持暫時隱藏，直到使用者明確重新啟用`,
    "柒玄茶資料保留但不得出現在產品卡、推薦、公開文字知識或主動回覆",
    "柒玄茶目前沒有核准正式產品實物原圖與正式公開成分表；不得自創包裝、替代產品圖或自行補成分"
  ];
  const guardRules=[...new Set([
    ...deferredRules,
    "30cc正式使用方式依官網 public-product-master.json 最新權威同步；目前為每日 1–2 罐，可依個人需求調整，舊守門員不得覆蓋新版正確資料。",
    ...((local.guardRules||[]).filter(x=>{const v=String(x);return !/龜鹿湯塊|龜鹿膠/.test(v)&& !v.includes("LINE可保留柒玄茶文字知識")&&!v.includes("七項產品文字知識完整")&&!v.includes("LINE文字知識必須保留7項")&&!v.includes("30cc目前正式使用方式")&&!v.includes("30cc正式使用方式")&&!v.includes("75g （2兩）")&&!v.includes("柒玄茶目前維持暫時隱藏")&&!v.includes("柒玄茶資料保留但不得出現在產品卡")&&!v.includes("柒玄茶目前沒有核准正式產品實物原圖");}))
  ])];
  return {
    ...local,
    version:`${master.version}-line-visible-${publicIds.length}-qixuan-${qixuanIsPublic?"public":"hidden"}-v10`,
    authority:"user-confirmed-current",
    publicAuthority:MASTER_URL,
    productMasterAuthority:master.authority,
    productMasterVersion:master.version,
    displayPolicy:`目前對外與 LINE OA 依官網公開母資料顯示 ${publicIds.length} 項正式產品；未在公開母資料中的暫緩產品只保留內部資料，不進產品卡、推薦、公開文字知識或主動回覆。`,
    products:[...publicProducts,...(qixuanIsPublic?[]:[qixuan])],
    knowledgeProductIds:[...publicIds],
    websitePublicProductIds:[...publicIds],
    approvedMediaProductIds:[...publicIds],
    temporarilyHiddenProductIds:qixuanIsPublic?[]:[QIXUAN_ID],
    guardRules
  };
}

function mergeData(localData,master,authority){
  const publicIds=publicIdsFromMaster(master);
  const byMaster=new Map(master.products.map(x=>[x.id,x]));
  const byAuth=new Map((authority.products||[]).map(x=>[x.id,x]));
  const localBy=new Map((localData.products||[]).map(x=>[x.id,x]));
  const products=publicIds.map(id=>{
    const old=localBy.get(id),src=byMaster.get(id),rule=byAuth.get(id);
    if(!old)throw new Error(`${id} 尚未建立LINE銷售資料；新增公開產品前必須先完成價格、出貨與正式媒體設定`);
    if(!src||!rule)throw new Error(`${id} 缺少公開母資料或LINE權威`);
    return {...old,name:src.name,displayName:src.name,specification:src.specification,size:src.specification,spec:src.specification,form:src.form||old.form,...(src.package?{package:src.package}:{}),ingredients:[...src.ingredients],...(src.usage?.length?{usage:[...src.usage]}:{}),...(rule.usagePrimary?{usagePrimary:rule.usagePrimary}:{}),...(rule.usageAdjustment?{usageAdjustment:rule.usageAdjustment}:{}),...(rule.usageTiming?{usageTiming:rule.usageTiming}:{}),...(rule.detailUnitApprox?{detailUnitApprox:rule.detailUnitApprox}:{}),detailPage:src.page||old.detailPage,image:rule.approvedProductImage,imageUrl:rule.approvedProductImage,image_url:rule.approvedProductImage,dmImage:rule.approvedDm,productMasterVersion:master.version};
  });
  return {...localData,products,officialProductIds:[...publicIds],officialProductCount:products.length,knowledgeProductIds:[...publicIds],knowledgeProductCount:products.length,websitePublicProductIds:[...publicIds],websitePublicProductCount:products.length,temporarilyHiddenProductIds:publicIds.includes(QIXUAN_ID)?[]:[QIXUAN_ID],productMasterVersion:master.version,productMasterAuthority:master.authority,productMasterSource:MASTER_URL};
}

function assertCurrent(merged,authority,photoAuthority,master){
  const publicIds=publicIdsFromMaster(master);
  if(authority?.authority!=="user-confirmed-current")throw new Error("LINE目前產品權威錯誤");
  if((merged.products||[]).length!==publicIds.length)throw new Error(`LINE顧客產品卡數量未跟官網公開母資料同步：${merged.products?.length||0} vs ${publicIds.length}`);
  if(JSON.stringify(authority.websitePublicProductIds)!==JSON.stringify(publicIds))throw new Error("LINE記錄的官網公開產品清單未跟最新母資料同步");
  if(JSON.stringify(authority.knowledgeProductIds)!==JSON.stringify(publicIds))throw new Error("LINE可見文字知識產品清單未跟最新母資料同步");
  if(Number(merged.knowledgeProductCount)!==publicIds.length)throw new Error("LINE可見文字知識數量未跟最新母資料同步");
  const auth=new Map(authority.products.map(x=>[x.id,x]));
  const src=new Map(master.products.map(x=>[x.id,x]));
  for(const id of publicIds){
    const p=(merged.products||[]).find(x=>x.id===id),r=auth.get(id),s=src.get(id),photo=String(photoAuthority?.products?.[id]||"").trim();
    if(!p||!r||!s||!photo)throw new Error(`${id}缺少目前正式產品權威`);
    if(p.name!==s.name||r.name!==s.name)throw new Error(`${id}正式名稱未同步`);
    if(p.specification!==s.specification||p.size!==s.specification||p.spec!==s.specification||r.specification!==s.specification)throw new Error(`${id}正式規格未同步`);
    if(JSON.stringify(p.ingredients)!==JSON.stringify(s.ingredients))throw new Error(`${id}成分未同步`);
    const dm=String(r.approvedDm||"").trim(),expectedDm=CURRENT_DM[id];
    if(!String(r.approvedProductImage||"").trim()||!dm)throw new Error(`${id}缺少正式產品圖或DM`);
    if(expectedDm?!dm.includes(expectedDm):!dm.includes("/images/dm-final/"))throw new Error(`${id}正式DM來源不同步`);
  }
  const d30=auth.get("guilu-drink-30"),raw30=(merged.products||[]).find(x=>x.id==="guilu-drink-30");
  if(d30?.usagePrimary!==CURRENT_30_USAGE||raw30?.usage?.[0]!==CURRENT_30_USAGE||d30?.usageAdjustment!=="可依個人需求調整"||!raw30?.usage?.includes("可依個人需求調整")||raw30?.usageAdjustment!=="可依個人需求調整")throw new Error("30cc目前新版用法／時間原則不同步");
  if(/玻璃瓶|30cc／瓶|瓶裝|開瓶/.test(JSON.stringify(raw30)))throw new Error("30cc不得出現瓶型舊稱");
  if(!publicIds.includes(QIXUAN_ID)){
    const qixuan=auth.get(QIXUAN_ID);
    if(!qixuan||qixuan.name!==QIXUAN_HIDDEN.name||qixuan.specification!==QIXUAN_HIDDEN.specification||qixuan.websiteVisible!==false||qixuan.lineKnowledgeVisible!==false||qixuan.temporarilyHidden!==true)throw new Error("柒玄茶暫時隱藏規則不同步");
    if((authority.knowledgeProductIds||[]).includes(QIXUAN_ID))throw new Error("柒玄茶暫時隱藏時不得進LINE可見文字知識清單");
    if(String(qixuan.approvedProductImage||"").trim()||String(qixuan.approvedDm||"").trim()||Array.isArray(qixuan.ingredients))throw new Error("柒玄茶尚未核准正式媒體／成分時不得建立假資料");
  }
  const trial=authority.trialPosterAuthority||{};
  if(!String(trial.currentDisplay||"").includes("/images/trial/trial-poster-small-boss-official-v20260814.jpg")||trial.status!=="approved_display"||trial.doNotRegenerate!==true)throw new Error("試喝主圖權威不同步");
}

async function main(){
  const write=process.argv.includes("--write"),master=await fetchMaster();
  const raw=JSON.parse(fs.readFileSync(DATA_PATH,"utf8"));
  const local=JSON.parse(fs.readFileSync(AUTHORITY_PATH,"utf8"));
  const nextAuthority=mergeAuthority(local,master),nextRaw=mergeData(raw,master,nextAuthority);
  if(write)fs.writeFileSync(AUTHORITY_PATH,stable(nextAuthority),"utf8");
  const merged=applyMaster(nextRaw);assertCurrent(merged,nextAuthority,getPhotoAuthority(),master);
  if(write)fs.writeFileSync(DATA_PATH,stable(merged),"utf8");
  else{
    if(stable(local)!==stable(nextAuthority))throw new Error("LINE official-products.json尚未同步最新官網公開產品清單與暫緩產品架構；請執行 npm run sync:catalog");
    if(stable(raw)!==stable(merged))throw new Error("LINE data.json尚未同步目前執行資料；請執行 npm run sync:catalog");
  }
  const publicCount=publicIdsFromMaster(master).length;
  console.log(`PASS: website/LINE public product authority synchronized (${publicCount} visible); deferred products remain internal; 30cc ${CURRENT_30_USAGE}.`);
}
main().catch(e=>{console.error(e.message||e);process.exit(1);});

