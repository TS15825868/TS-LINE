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
function gas(cart) {
 const sheets=new Map();
 const ctx={LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},ContentService:{MimeType:{JSON:'json'},createTextOutput:s=>({setMimeType:()=>JSON.parse(s)})}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('Code.gs','utf8'),ctx);
 ctx.getSpreadsheet_=()=>({});ctx.getSheet=(_,name)=>{if(!sheets.has(name))sheets.set(name,{rows:[],appendRow(row){this.rows.push(row);}});return sheets.get(name);};
 ctx.orderExists_=(s,id)=>s.rows.some(r=>r[1]===id);
 ctx.updateCustomer=()=>{};ctx.updateDashboard=()=>{};ctx.autoResizeSheets_=()=>{};
 const total=cart.reduce((s,i)=>s+i.total,0);
 const event={postData:{contents:JSON.stringify({orderId:'OFFLINE-ONLY',cart,total,name:'隔離測試'})}};
 const result=ctx.doPost(event);assert.equal(result.ok,true);assert.equal(result.total,total);
 assert.equal(sheets.get('訂單主表').rows[0][5],total);
 const rows=sheets.get('訂單明細').rows;assert.equal(rows.length,cart.length);
 cart.forEach((i,n)=>{assert.equal(rows[n][2],i.name);assert.equal(rows[n][3],i.qty);assert.equal(rows[n][5],i.label);assert.equal(rows[n][6],i.total);});
 assert.equal(ctx.doPost(event).duplicated,true);assert.equal(sheets.get('訂單主表').rows.length,1);
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
 gas([a]);gas([b]);gas([a,b]);assert.match(source,/checkout\.orderId \|\|=/);
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
