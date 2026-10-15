'use strict';
const fs=require('node:fs');
const path=require('node:path');
const target=path.join(__dirname,'../partner-inquiry-catalog.json');
(async()=>{
 try{
  const response=await fetch('https://ts15825868.github.io/xianjiawei/partner-catalog.json',{signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw Error('catalog HTTP '+response.status);
  const catalog=await response.json();
  if(!Array.isArray(catalog.products)||!catalog.products.length)throw Error('empty partner catalog');
  const ids=new Set();
  const products=catalog.products.map(p=>{
   if(!p.id||!p.name||ids.has(p.id))throw Error('invalid product identity');ids.add(p.id);
   const group=catalog.products.find(g=>g.public===true&&g.id===p.groupedIn);
   const publicPage=group?group.page+'#'+p.id:p.public===true?p.page:null;
   if(publicPage&&!/^product-[a-z0-9-]+\.html(?:#[a-z0-9-]+)?$/.test(publicPage))throw Error('unsafe public page');
   // 使用正式商品名稱與原廠包裝名稱建立不重複別名；不引入醫療宣稱或價格。
   const aliases=[p.name];
   if(p.packagingName&&p.packagingName!==p.name)aliases.push(p.packagingName);
   if(p.officialLicensedName&&p.officialLicensedName!==p.name)aliases.push(p.officialLicensedName);
   if(p.brand&&p.brand!=='原廠待核對'&&!p.name.includes(p.brand))aliases.push(p.brand+p.name);
   if(Array.isArray(p.inquiryAliases))aliases.push(...p.inquiryAliases.filter(a=>typeof a==='string'&&a.trim()));
   const verified=Boolean(p.licenseVerification
      && p.licenseVerification.authority==='衛生福利部中醫藥司中藥許可證查詢'
      && /^衛[署部]成製\d+$/.test(p.licenseVerification.licenseNo||'')
      && /^20\d{2}-\d{2}-\d{2}$/.test(p.licenseVerification.validUntil||'')
      && new Date(p.licenseVerification.validUntil+'T23:59:59+08:00')>new Date()
      && p.licensedProductType==='成藥');
   const medicine=verified?{
    classification:'licensed-traditional-medicine',
    licensedName:p.officialLicensedName,
    licenseNo:p.licenseVerification.licenseNo,
    licensedCategory:'成藥',
    storeService:'in-person-subject-to-dealer-license-scope',
    onlineSaleEligible:false
   }:undefined;
   const food=(p.businessClassification==='一般食品' && p.foodStatusSource)?{
    classification:'supplier-confirmed-food',
    size:typeof p.size==='string'?p.size:'',
    ingredients:Array.isArray(p.packagingEvidence?.ingredientsFromLabel)?
      p.packagingEvidence.ingredientsFromLabel.filter(x=>typeof x==='string').slice(0,18):
      (Array.isArray(p.ingredients)?p.ingredients.filter(x=>typeof x==='string').slice(0,18):[]),
    service:'仙加味LINE商品、價格與供貨詢問',
    websitePublic:!!p.public,
    autoCheckout:false,
    photoState:p.imageSourceStatus||'pending'
   }:undefined;
   return {id:p.id,name:p.name,aliases:[...new Set(aliases)],publicPage:publicPage||null,
    ...(medicine?{medicine}:{}),...(food?{food}:{})};
  });
  fs.writeFileSync(target+'.tmp',JSON.stringify({source:'TS15825868/xianjiawei/partner-catalog.json',products},null,2)+'\n');
  fs.renameSync(target+'.tmp',target);
  console.log('Partner inquiry catalog synced: '+products.length+' records; public page links and verified medicine status only');
 }catch(error){
  if(!fs.existsSync(target))throw error;
  console.warn('Using existing partner inquiry catalog: '+error.message);
 }
})().catch(error=>{console.error(error.message);process.exitCode=1});
