"use strict";

const fs=require("fs");
const path=require("path");
const {applyMaster,getPhotoAuthority}=require("../product-sales-master");
const ROOT=path.resolve(__dirname,"..");
const DATA_PATH=path.join(ROOT,"data.json");
const AUTHORITY_PATH=path.join(ROOT,"assets/data/official-products.json");
const MASTER_URL=process.env.PRODUCT_MASTER_URL||"https://raw.githubusercontent.com/TS15825868/xianjiawei/main/public-product-master.json";
const stable=v=>JSON.stringify(v,null,2)+"\n";
const PUBLIC_PRODUCT_IDS=["guilu-gao","guilu-drink-30","guilu-drink-180","guilu-tangkuai","guilu-jiao","luerong-fen"];
const CURRENT_30_USAGE="每日 1–2 罐";
const CURRENT_DM={
  "guilu-gao":"/images/dm-final/01_guilu-gao-100g-dm.jpg",
  "guilu-drink-30":"/images/dm-final/02_guilu-drink-30cc-dm-official-v20260814.jpg",
  "guilu-drink-180":"/images/dm-final/03_guilu-drink-180cc-dm.jpg",
  "guilu-tangkuai":"/images/dm-final/05_guilu-tangkuai-75g-dm.jpg",
  "guilu-jiao":"/images/dm-final/06_guilu-jiao-600g-dm.jpg",
  "luerong-fen":"/images/dm-final/04_luerong-fen-75g-dm.jpg"
};

function validateMaster(master){
  if(master?.authority!=="user-confirmed-current")throw new Error("公開產品母資料 authority 錯誤");
  if(master?.productCount!==6||!Array.isArray(master?.products)||master.products.length!==6)throw new Error("公開產品母資料必須剛好6項目前對外產品");
  const ids=master.products.map(x=>x.id);
  if(JSON.stringify(ids)!==JSON.stringify(PUBLIC_PRODUCT_IDS))throw new Error(`公開產品品項或順序錯誤：${ids.join(",")}`);
  for(const p of master.products){
    for(const f of ["id","name","specification","form"])if(!p?.[f])throw new Error(`${p.id||"產品"}缺少${f}`);
    if(!Array.isArray(p.ingredients)||!p.ingredients.length)throw new Error(`${p.id}缺少正式成分`);
  }
  const d30=master.products.find(x=>x.id==="guilu-drink-30");
  if(d30?.usage?.[0]!==CURRENT_30_USAGE)throw new Error("30cc公開母資料不是每日 1–2 罐");
}

async function fetchMaster(){
  const response=await fetch(MASTER_URL,{headers:{"user-agent":"xianjiawei-lineoa-public-product-ssot"}});
  if(!response.ok)throw new Error(`無法下載六項公開產品母資料：HTTP ${response.status}`);
  const master=await response.json();validateMaster(master);return master;
}

function mergeAuthority(local,master){
  const localBy=new Map((local.products||[]).map(x=>[x.id,x]));
  const products=master.products.map(src=>{
    const old=localBy.get(src.id)||{};
    const primary=String(src?.usage?.[0]||old.usagePrimary||"").trim();
    const timing=String(src?.usageTiming||old.usageTiming||((src.id==="guilu-drink-30"||src.id==="guilu-drink-180")?"飲用時間可依個人使用習慣與作息時間安排":"")).trim();
    return {...old,id:src.id,name:src.name,displayName:src.name,specification:src.specification,...(src.package?{package:src.package}:{}),...(src.form?{form:src.form}:{}),ingredients:[...src.ingredients],...(primary?{usagePrimary:primary}:{}),...(timing?{usageTiming:timing}:{}),...(src.detail?{detailUnitApprox:src.detail}:{}),publicProductMasterVersion:master.version};
  });
  return {...local,version:`${master.version}-line-channel-v4`,authority:"user-confirmed-current",publicAuthority:MASTER_URL,productMasterAuthority:master.authority,productMasterVersion:master.version,products,knowledgeProductIds:[...PUBLIC_PRODUCT_IDS],approvedMediaProductIds:[...PUBLIC_PRODUCT_IDS],guardRules:["LINE對客產品只使用目前官網六項公開產品；暫緩對外產品不得由舊七項資料重新加入","30cc目前正式使用方式為每日 1–2 罐，不得回退成每日一罐",...((local.guardRules||[]).filter(x=>!String(x).includes("七項")&&!String(x).includes("第七項")&&!String(x).includes("柒玄茶")))]};
}

function mergeData(localData,master,authority){
  const byMaster=new Map(master.products.map(x=>[x.id,x]));
  const byAuth=new Map((authority.products||[]).map(x=>[x.id,x]));
  const products=(localData.products||[]).filter(x=>PUBLIC_PRODUCT_IDS.includes(x.id)).map(old=>{
    const src=byMaster.get(old.id),rule=byAuth.get(old.id);if(!src||!rule)return old;
    return {...old,name:src.name,displayName:src.name,specification:src.specification,size:src.specification,spec:src.specification,form:src.form||old.form,...(src.package?{package:src.package}:{}),ingredients:[...src.ingredients],...(src.usage?.length?{usage:[...src.usage]}:{}),...(rule.usagePrimary?{usagePrimary:rule.usagePrimary}:{}),...(rule.usageTiming?{usageTiming:rule.usageTiming}:{}),...(rule.detailUnitApprox?{detailUnitApprox:rule.detailUnitApprox}:{}),detailPage:src.page||old.detailPage,image:rule.approvedProductImage,imageUrl:rule.approvedProductImage,image_url:rule.approvedProductImage,dmImage:rule.approvedDm,productMasterVersion:master.version};
  });
  return {...localData,products,officialProductIds:[...PUBLIC_PRODUCT_IDS],officialProductCount:6,knowledgeProductIds:[...PUBLIC_PRODUCT_IDS],knowledgeProductCount:6,productMasterVersion:master.version,productMasterAuthority:master.authority,productMasterSource:MASTER_URL};
}

function assertCurrent(merged,authority,photoAuthority,master){
  if(authority?.authority!=="user-confirmed-current")throw new Error("LINE目前產品權威錯誤");
  if((authority.products||[]).length!==6||(merged.products||[]).length!==6)throw new Error("LINE對客產品必須剛好6項");
  const auth=new Map(authority.products.map(x=>[x.id,x]));
  const src=new Map(master.products.map(x=>[x.id,x]));
  for(const id of PUBLIC_PRODUCT_IDS){
    const p=(merged.products||[]).find(x=>x.id===id),r=auth.get(id),s=src.get(id),photo=String(photoAuthority?.products?.[id]||"").trim();
    if(!p||!r||!s||!photo)throw new Error(`${id}缺少目前正式產品權威`);
    if(p.name!==s.name||r.name!==s.name)throw new Error(`${id}正式名稱未同步`);
    if(p.specification!==s.specification||p.size!==s.specification||p.spec!==s.specification||r.specification!==s.specification)throw new Error(`${id}正式規格未同步`);
    if(JSON.stringify(p.ingredients)!==JSON.stringify(s.ingredients))throw new Error(`${id}成分未同步`);
    if(!String(r.approvedProductImage||"").trim()||!String(r.approvedDm||"").includes(CURRENT_DM[id]))throw new Error(`${id}正式產品圖或DM不同步`);
  }
  const d30=auth.get("guilu-drink-30"),raw30=(merged.products||[]).find(x=>x.id==="guilu-drink-30");
  if(d30?.usagePrimary!==CURRENT_30_USAGE||raw30?.usage?.[0]!==CURRENT_30_USAGE)throw new Error("30cc目前新版用法／時間原則不同步");
  if(/玻璃瓶|30cc／瓶|瓶裝|開瓶/.test(JSON.stringify(raw30)))throw new Error("30cc不得出現瓶型舊稱");
  const tang=auth.get("guilu-tangkuai"),jiao=auth.get("guilu-jiao");
  if(tang?.specification!=="75g （2兩）／盒｜8塊裝"||tang?.detailUnitApprox!=="每塊約9.375g")throw new Error("龜鹿湯塊規格不同步");
  if(jiao?.specification!=="600g （1斤）／盒｜32塊裝"||!/^每塊約18\.75\s*g$/.test(String(jiao?.detailUnitApprox||"")))throw new Error("龜鹿膠規格不同步");
  if(JSON.stringify(authority).includes("qixuan-guilu-drink-powder")||JSON.stringify(authority).includes("柒玄茶・龜鹿調飲粉"))throw new Error("暫緩對外產品不得出現在LINE對客權威");
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
    if(stable(local)!==stable(nextAuthority))throw new Error("LINE official-products.json尚未同步目前六項公開母資料；請執行 npm run sync:catalog");
    if(stable(raw)!==stable(merged))throw new Error("LINE data.json尚未同步目前執行資料；請執行 npm run sync:catalog");
  }
  console.log(`PASS: LINE public SSOT ${master.version}; six public products; 30cc ${CURRENT_30_USAGE}; deferred product excluded.`);
}
main().catch(e=>{console.error(e.message||e);process.exit(1);});
