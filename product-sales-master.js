"use strict";

const fs = require("fs");
const path = require("path");

const originalReadFileSync = fs.readFileSync.bind(fs);
const masterPath = path.join(__dirname, "line-sales-master.json");
const currentAuthorityPath = path.join(__dirname, "assets/data/official-products.json");
const photoAuthorityPath = path.join(__dirname, "line-product-photo-authority.json");
let master = null;
let currentAuthority = null;
let photoAuthority = null;

const SALES_OVERRIDE_FIELDS = Object.freeze([
  "name", "displayName", "specification", "size", "spec", "unit",
  "description", "ingredients", "usage", "storage", "fit", "purposeDirection", "aliases",
  "price", "originalPrice", "offers", "priceText", "originalPriceText",
  "priceLabel", "quoteOnly",
  "fulfillmentType", "fulfillmentNotice", "productionLeadTime", "readyStock",
  "image", "imageUrl", "image_url", "dmImage", "officialOriginalImage", "imagePolicy", "physicalScalePolicy",
]);

const FORMAL_PRODUCT_COPY = Object.freeze({});
const RETIRED_COPY_REPLACEMENTS = Object.freeze([
  [/每日早上及下午各一小匙/g, "食用時間可依個人使用習慣與作息時間安排"],
  [/建議白天飲用/g, "飲用時間可依個人使用習慣與作息時間安排"],
  [/每日一罐/g, "每日 1-2罐"],
  [/每日1罐/g, "每日 1-2罐"],
  [/每日 1 罐/g, "每日 1-2罐"],
  [/每日1～2罐/g, "每日 1-2罐"],
  [/每日 1～2罐/g, "每日 1-2罐"],
  [/一天一次一小匙/g, "可依個人使用習慣與作息時間安排"],
  [/早晚各一小匙/g, "可依個人使用習慣與作息時間安排"],
  [/75g深藍盒、8塊裝、每塊約9\.375g/g, "75g深藍盒、8塊裝"],
  [/600g （1斤）／盒｜32塊裝｜每塊約18\.75g/g, "600g （1斤）／盒｜32塊裝"],
  [/600g一斤淡紫盒/g, "600g （1斤）淡紫盒"],
  [/一斤大規格/g, "600g （1斤）大規格"],
]);

function sanitizeCurrentCopy(value) {
  if (Array.isArray(value)) return value.map(sanitizeCurrentCopy);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key,item]) => [key, sanitizeCurrentCopy(item)]));
  if (typeof value !== "string") return value;
  return RETIRED_COPY_REPLACEMENTS.reduce((text,[pattern,replacement]) => text.replace(pattern,replacement), value);
}
function getMaster(){ if(master)return master; master=JSON.parse(originalReadFileSync(masterPath,"utf8")); return master; }
function getCurrentAuthority(){ if(currentAuthority)return currentAuthority; currentAuthority=JSON.parse(originalReadFileSync(currentAuthorityPath,"utf8")); return currentAuthority; }
function getPhotoAuthority(){ if(photoAuthority)return photoAuthority; photoAuthority=JSON.parse(originalReadFileSync(photoAuthorityPath,"utf8")); return photoAuthority; }
function rootCombos(comboOffers=[]){return comboOffers.map(combo=>({id:combo.id,name:combo.name,aliases:combo.aliases||[],items:combo.items||[],gift:combo.gift||"",desc:combo.desc||"",unit:combo.unit||"組",products:combo.products||[],quantityOptions:combo.quantityOptions||[1,2,3,5],priceNote:"實際組合金額由正式產品售價計算；活動與通路條件請洽客服確認。"}));}
function normalizeProductOffers(product,override={}){
  const raw=Array.isArray(override.offers)?override.offers:(Array.isArray(product.offers)?product.offers:[]); const price=Number(override.price??product.price??0); const offers=[]; const promotionTexts=[];
  for(const entry of raw){
    if(entry&&typeof entry==="object"){const qty=Number(entry.qty||0),total=Number(entry.total||0),label=String(entry.label||"").trim().replace(/買\s*10\s*送\s*2/g,"買10送1");if(qty>0&&total>=0&&label)offers.push({qty:label==="買10送1"?11:qty,total,label});continue;}
    const originalLabel=String(entry||"").trim(); if(!originalLabel)continue; const label=originalLabel.replace(/買\s*10\s*送\s*2/g,"買10送1"); promotionTexts.push(label); if(/買\s*10\s*送\s*1/.test(label)&&price>0)offers.push({qty:11,total:price*10,label:"買10送1"});
  }
  return {offers,promotionTexts};
}
function salesOverride(override={}){return Object.fromEntries(SALES_OVERRIDE_FIELDS.filter(field=>override[field]!==undefined).map(field=>[field,sanitizeCurrentCopy(override[field])]));}
function formalCopy(id,value={}){return {...value,...(FORMAL_PRODUCT_COPY[id]||{})};}
function authorityProduct(id){return (getCurrentAuthority().products||[]).find(item=>item.id===id)||null;}
function currentAuthorityOverride(id,merged={}){
  const official=authorityProduct(id); if(!official)throw new Error(`${id} 缺少目前正式產品權威`); const spec=String(official.specification||"").trim();
  const usage=(Array.isArray(merged.usage)?[...merged.usage]:[]).map(sanitizeCurrentCopy); if(official.usagePrimary){if(usage.length)usage[0]=official.usagePrimary;else usage.push(official.usagePrimary);}
  const aliases=(Array.isArray(merged.aliases)?merged.aliases:[]).map(v=>sanitizeCurrentCopy(String(v||"").trim())).filter(Boolean).filter(v=>id!=="guilu-drink-30"||!/瓶/.test(v)).filter(v=>id!=="guilu-jiao"||!/^一斤$/.test(v));
  const cleaned=sanitizeCurrentCopy({description:merged.description,storage:merged.storage,fit:merged.fit,purposeDirection:merged.purposeDirection,physicalScalePolicy:merged.physicalScalePolicy});
  return {name:official.name,displayName:official.name,specification:spec,size:spec,spec,ingredients:official.ingredients||merged.ingredients,...(String(official.detailUnitApprox||"").trim()?{detailUnitApprox:String(official.detailUnitApprox).trim()}:{}),...(official.usagePrimary?{usage}:{}),aliases,...Object.fromEntries(Object.entries(cleaned).filter(([,v])=>v!==undefined))};
}
function photoOverride(id){
  const photo=getPhotoAuthority(); const original=String(photo?.products?.[id]||"").trim(); const official=authorityProduct(id);
  const productImage=String(official?.approvedProductImage||"").trim(); const detailedDm=String(official?.approvedDm||"").trim();
  if(!original)throw new Error(`${id} 缺少 products-v3 正式產品原圖權威`);
  const customerProductImage=productImage||original; const customerDm=detailedDm||customerProductImage;
  return {image:customerProductImage,imageUrl:customerProductImage,image_url:customerProductImage,dmImage:customerDm,officialOriginalImage:original,imagePolicy:"six-official-product-images-plus-separate-corrected-dm-preserve-products-v3-identity"};
}
function applyMaster(data){
  const policy=getMaster(),authority=getCurrentAuthority(),productOverrides=policy.products||{},comboOffers=Array.isArray(policy.comboOffers)?sanitizeCurrentCopy(policy.comboOffers):[];
  data.products=(data.products||[]).filter(product=>productOverrides[product.id]).map(product=>{
    const rawOverride=formalCopy(product.id,productOverrides[product.id]||{}),override=salesOverride(rawOverride),normalized=normalizeProductOffers(product,override);
    const quantityOptions=[...new Set([...(Array.isArray(product.quantityOptions)?product.quantityOptions:[1,2,3,5]),...normalized.offers.map(offer=>offer.qty)].map(Number).filter(v=>Number.isFinite(v)&&v>0))];
    let merged={...sanitizeCurrentCopy(product),...override,...photoOverride(product.id),offers:normalized.offers,promotionTexts:normalized.promotionTexts,quantityOptions};
    merged={...merged,...currentAuthorityOverride(product.id,merged)}; if(!merged.physicalScalePolicy)merged.physicalScalePolicy="uniform-only-preserve-realistic-product-scale"; delete merged.variants; delete merged.variantSelectionMode; return merged;
  });
  data.offers={comboOffers}; data.combos=rootCombos(comboOffers); data.retentionOffers={combos:Object.fromEntries(comboOffers.map(combo=>[combo.name,"可依組合內容、數量與需求協助整理較適合的方案。"]))};
  data.fulfillmentPolicy={...(authority.fulfillmentPolicy||policy.fulfillmentPolicy||{})}; data.payments=Array.isArray(policy.payments)?policy.payments:(data.payments||[]); data.shipping=Array.isArray(policy.shipping)?policy.shipping:(data.shipping||[]); data.store=policy.store?{...policy.store}:(data.store||{});
  data.trialCampaign=sanitizeCurrentCopy({...(policy.trialCampaign||data.trialCampaign||{}),...(authority.trialCampaign||{})}); data.trialPosterAuthority=sanitizeCurrentCopy({...(authority.trialPosterAuthority||{})});
  data.runtime={...(data.runtime||{}),imagePolicy:{...((data.runtime||{}).imagePolicy||{}),...(policy.imagePolicy||{}),actualProductPhotoAuthority:getPhotoAuthority().version,customerMainImageSource:"six-user-confirmed-product-images",detailedDmSource:"separate-corrected-dm",productIdentityReference:"products-v3-user-approved-originals",productsV2Use:"legacy-reference-only",productScalePolicy:"uniform-only-no-stretch-preserve-real-product-proportion",dmFallback:"approved-product-image-only-if-detailed-dm-missing"},productMainImageSource:"six-user-confirmed-product-images",detailedDmSource:"separate-corrected-dm",productIdentityReference:"products-v3-user-approved-originals",productsV2Use:"legacy-reference-only",productScalePolicy:"uniform-only-no-stretch-preserve-real-product-proportion",formalCopyVersion:authority.version,formalCopyAuthority:authority.authority,trialAuthority:"assets/data/official-products.json",contentApproval:{mode:"review-only",defaultStatus:"pending_review",scheduleRequiresApproval:true,publishRequiresApproval:true,lineVoomManualOnly:true}};
  data.salesMasterVersion=`${policy.version}-authority-driven-current`; data.salesMasterSource=`${policy.source}; product image / detailed DM / trial roles separated by current official authority`; data.currentProductAuthorityVersion=authority.version; data.productPhotoAuthorityVersion=getPhotoAuthority().version; return data;
}
fs.readFileSync=function patchedReadFileSync(file,...args){const result=originalReadFileSync(file,...args);try{const resolved=path.resolve(String(file));if(resolved===path.join(__dirname,"data.json")){const encoding=typeof args[0]==="string"?args[0]:args[0]?.encoding;const text=Buffer.isBuffer(result)?result.toString(encoding||"utf8"):String(result);return JSON.stringify(applyMaster(JSON.parse(text)),null,2);}}catch(error){console.error("仙加味正式銷售主檔套用失敗："+error.message);throw error;}return result;};
module.exports={applyMaster,getMaster,getCurrentAuthority,getPhotoAuthority,rootCombos,normalizeProductOffers,salesOverride,formalCopy,authorityProduct,currentAuthorityOverride,photoOverride,sanitizeCurrentCopy,FORMAL_PRODUCT_COPY,SALES_OVERRIDE_FIELDS};
