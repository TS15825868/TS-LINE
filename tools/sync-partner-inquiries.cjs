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
   const aliases=[p.name];
   if(p.brand&&p.brand!=='原廠待核對'&&!p.name.includes(p.brand))aliases.push(p.brand+p.name);
   return {id:p.id,name:p.name,aliases,publicPage:publicPage||null};
  });
  fs.writeFileSync(target+'.tmp',JSON.stringify({source:'TS15825868/xianjiawei/partner-catalog.json',products},null,2)+'\n');
  fs.renameSync(target+'.tmp',target);
  console.log('Partner inquiry catalog synced: '+products.length+' records; public page links only');
 }catch(error){
  if(!fs.existsSync(target))throw error;
  console.warn('Using existing partner inquiry catalog: '+error.message);
 }
})().catch(error=>{console.error(error.message);process.exitCode=1});
