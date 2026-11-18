'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('server.js','utf8');
const fn = source.slice(source.indexOf('async function saveCRM('), source.indexOf('async function continueCheckout('));
async function check(body, ok=true, payload={orderId:'accepted'}) {
 const ctx={CRM_URL:'https://offline.invalid',CRM_TIMEOUT_MS:100,AbortController,setTimeout,clearTimeout,console,fetch:async()=>({ok,status:503,json:async()=>{if(body instanceof Error)throw body;return body;}})};
 vm.createContext(ctx);vm.runInContext(fn+'\nthis.save=saveCRM;',ctx);return ctx.save(payload);
}
function gasHarness(failAt) {
 const crypto=require('node:crypto');
 const sheets=new Map();let customerWrites=0,dashboardWrites=0,flushes=0,failed=false;
 const fault=label=>{if(!failed&&failAt===label){failed=true;throw Error('offline injected failure '+label)}};
 const ctx={LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
   SpreadsheetApp:{flush(){flushes++;fault('flush-'+flushes)}},
   Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_alg,s)=>Array.from(crypto.createHash('sha256').update(s).digest())},
   ContentService:{MimeType:{JSON:'json'},createTextOutput:s=>({setMimeType:()=>JSON.parse(s)})}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('Code.gs','utf8'),ctx);
 ctx.getSpreadsheet_=()=>({});
 ctx.getSheet=(_,name,headers)=>{
   if(!sheets.has(name))sheets.set(name,{rows:[Array.from(headers)],appendRow(row){this.rows.push(Array.from(row));fault(name)},getLastRow(){return this.rows.length},getRange(r,c,n,m){const self=this;return{getValues(){return self.rows.slice(r-1,r-1+n).map(row=>row.slice(c-1,c-1+m))},setValues(vals){fault('commit-marker');vals.forEach((row,i)=>row.forEach((v,j)=>{self.rows[r-1+i][c-1+j]=v}));}}}});
   return sheets.get(name);
 };
 ctx.updateCustomer=()=>{customerWrites++;fault('customer')};ctx.updateDashboard=()=>{dashboardWrites++;fault('dashboard')};ctx.autoResizeSheets_=()=>{};
 const run=(cart,override={})=>ctx.doPost({postData:{contents:JSON.stringify({orderId:'OFFLINE-ONLY',cart,total:cart.reduce((s,i)=>s+i.total,0),name:'隔離測試',...override})}});
 const count=name=>Math.max(0,(sheets.get(name)?.rows.length??1)-1);
 return {ctx,sheets,run,count,customerWrites:()=>customerWrites,dashboardWrites:()=>dashboardWrites};
}
function gas(cart) {
 const h=gasHarness(),result=h.run(cart),total=cart.reduce((s,i)=>s+i.total,0);
 assert.equal(result.ok,true);assert.equal(result.total,total);
 assert.equal(h.sheets.get('訂單主表').rows[1][5],total);
 const rows=h.sheets.get('訂單明細').rows.slice(1);assert.equal(rows.length,cart.length);
 cart.forEach((i,n)=>{assert.equal(rows[n][2],i.name);assert.equal(rows[n][3],i.qty);assert.equal(rows[n][5],i.label);assert.equal(rows[n][6],i.total);});
 assert.equal(h.run(cart).duplicated,true);assert.equal(h.count('訂單主表'),1);
 assert.equal(h.count('CRM接單回執'),1);assert.equal(h.sheets.get('CRM接單回執').rows[1][2],'completed');
 assert.equal(h.customerWrites(),1);assert.equal(h.dashboardWrites(),1);
 assert.equal(h.run(cart,{name:'different payload'}).outcome,'id_conflict');
 assert.equal(h.count('訂單主表'),1);
}
function verifyGasFailures(cart){
 // Fail after each write or flush. A durable started row must hold every
 // replay, including after a partial master or customer update. A failure
 // after the final marker can safely acknowledge only an already complete order.
 for(const stage of ['CRM接單回執','flush-1','訂單主表','訂單明細','出貨管理','匯款對帳','customer','dashboard','flush-2','commit-marker','flush-3']){
   const h=gasHarness(stage);const first=h.run(cart);
   assert.equal(first.ok,false,stage);
   const before=Array.from(h.sheets,([k,v])=>[k,v.rows.length]);
   const c=h.customerWrites(),d=h.dashboardWrites(),retry=h.run(cart);
   assert.equal(retry.ok,stage==='flush-3',stage);
   if(stage!=='flush-3')assert.equal(retry.outcome,'unknown',stage);
   assert.deepEqual(Array.from(h.sheets,([k,v])=>[k,v.rows.length]),before,stage);
   assert.equal(h.customerWrites(),c,stage);assert.equal(h.dashboardWrites(),d,stage);
 }
 const legacy=gasHarness();legacy.ctx.getSheet({},'訂單主表',['時間','訂單編號']).appendRow([new Date(),'OFFLINE-ONLY']);
 assert.equal(legacy.run(cart).outcome,'unknown');assert.equal(legacy.count('訂單主表'),1);assert.equal(legacy.customerWrites(),0);
 console.log('PASS durable CRM complete receipt; 11 interrupted writes/flushes, legacy master-only hold, payload conflicts, duplicate replay without customer double-count');
}
(async()=>{
 for(const body of [{},{ok:false},{ok:true},null,new Error('invalid JSON')])assert.equal((await check(body)).ok,false);
 assert.equal((await check({ok:true,orderId:'accepted'},false)).ok,false);
 assert.equal((await check({ok:true,orderId:'accepted'})).ok,true);
 assert.equal((await check({ok:true,orderId:'accepted',duplicated:true})).ok,true);
 assert.equal((await check({ok:true,orderId:'different-order'})).ok,false);
 assert.equal((await check({ok:true,orderId:123})).ok,false);
 assert.equal((await check({ok:true,orderId:'accepted'},true,{})).ok,false);
 assert.equal((await check({ok:true,orderId:'accepted',privateData:'not-for-caller'},false)).privateData,undefined);
 const a={name:'自有商品測試',qty:11,price:50,total:500,label:'買10送1',unit:'罐'};
 const b={name:'其他廠商商品測試',qty:2,price:900,total:1600,label:'優惠價',unit:'盒'};
 gas([a]);gas([b]);gas([a,b]);verifyGasFailures([a,b]);assert.match(source,/checkout\.orderId \|\|=/);
 assert.equal((await check({ok:false})).outcome,'unknown');
 assert.equal((await check({ok:true,orderId:'different-order'})).outcome,'unknown');
 assert.equal((await check({ok:true,orderId:'accepted'},true,{})).outcome,'not_sent');
 // Exercise the actual checkout body in isolation with fake transport, no LINE or CRM calls.
 const checkoutSource=source.slice(source.indexOf('function trialCheckoutHold('),source.indexOf('async function handleLegacyPostback('));
 const buildContext=(result)=>{
   let calls=0;
   const ctx={require,console,orderNoticeForCart:()=>'',cartTotal:()=>60,
     publicCatalog:{current:()=>[]},mainQuick:()=>[],textMsg:(text,buttons)=>({text,buttons}),flexCard:(title,text,buttons)=>({title,text,buttons}),
     reply:async(_token,card)=>card,withLineLoadingIndicator:async(_event,fn)=>fn(),
     CRM_URL:'https://offline.invalid',CRM_TIMEOUT_MS:100,AbortController,setTimeout,clearTimeout,
     fetch:async()=>{calls++;return {ok:true,json:async()=>result};}};
   vm.createContext(ctx);vm.runInContext(checkoutSource+'\nthis.run=continueCheckout;this.startTrial=startTrialCheckout;this.startOrder=startCheckout;',ctx);
   return {ctx,calls:()=>calls};
 };
 const checkoutState=()=>({cart:[{id:'trial',name:'隔離測試',qty:1,unit:'組',total:60}],checkout:{step:'confirm',trial:true,orderId:'accepted',name:'隔離測試',phone:'test',shipping:'宅配',address:'test'}});
 const evt={source:{userId:'offline'},replyToken:'offline'};
 const uncertain=buildContext({ok:true,orderId:'different-order'}),state=checkoutState();
 const held=await uncertain.ctx.run(evt,state,'確認送出');
 assert.equal(held.title,'試喝申請結果待查');
 assert.match(held.text,/accepted/);
 assert.equal(state.checkout.crmUncertain,true);
 assert.equal(uncertain.calls(),1);
 for(const action of ['確認送出','取消'])assert.equal((await uncertain.ctx.run(evt,state,action)).title,'試喝申請結果待查');
 assert.equal(uncertain.ctx.startTrial(state,'宅配').title,'試喝申請結果待查');
 assert.equal(uncertain.ctx.startOrder(state).title,'試喝申請結果待查');
 assert.equal(uncertain.calls(),1);
 assert.equal(state.cart.length,1);
 const success=buildContext({ok:true,orderId:'accepted'}),confirmed=checkoutState();
 assert.equal((await success.ctx.run(evt,confirmed,'確認送出')).title,'訂單已送出');
 assert.equal(success.calls(),1);assert.equal(confirmed.checkout,null);assert.equal(confirmed.cart.length,0);
 const gasSource=fs.readFileSync('Code.gs','utf8');
 assert.match(gasSource,/if \(cart\.length === 0\) return jsonOutput/);
 assert.match(gasSource,/Math\.abs\(Number\(data\.total\) - total\) > 0\.01/);
 console.log('PASS offline CRM acknowledgment, own/partner/mixed records, promotions, totals and duplicate protection');
})().catch(e=>{console.error(e);process.exitCode=1;});
