"use strict";
// Offline-only LINE latency contract: no secrets, customer data or HTTP calls.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const source=fs.readFileSync(require("node:path").join(__dirname,"server.js"),"utf8");
const catalog=fs.readFileSync(require("node:path").join(__dirname,"line-public-catalog-runtime.js"),"utf8");

assert.ok(source.includes("function schedulePublicCatalogRefresh()"));
assert.ok(source.includes("app.get(\"/healthz\", (_req, res) => {\n  // Existing Cloudflare heartbeat"));
assert.ok(source.includes("  schedulePublicCatalogRefresh();\n  res.json({"));
assert.ok(!source.includes("await publicCatalog.refresh()"),
  "Never await an external GitHub catalog request before replying to customers");
assert.match(catalog,/const PERIOD_MS = 15 \* 60 \* 1000/);
assert.match(catalog,/if \(activeRefresh\) return activeRefresh/);
assert.match(catalog,/snapshot\.products \|\| \[\]/);

const start=source.indexOf('  if (data.action === "products") {');
const end=source.indexOf('  if (data.action === "prices")',start);
assert.ok(start>0&&end>start,"Postback product route missing");
const branch=source.slice(start,end);
assert.match(branch,/schedulePublicCatalogRefresh\(\)/);
assert.match(branch,/return reply\(event.replyToken, productMenuReply\(\)\)/);
assert.doesNotMatch(branch,/await |saveCRM|pushOwnerAlert/);
const run=vm.runInNewContext('(async function(data,event,reply,productMenuReply,schedulePublicCatalogRefresh){'+branch+'})');

(async()=>{
 let backgroundRequests=0,replies=0;
 const neverFinishes=()=>{backgroundRequests++;return new Promise(()=>{});};
 let timer;
 try{
  const reply=run({action:"products"},{replyToken:"OFFLINE_FIXTURE"},
   async(_token,message)=>{replies++;return message;},
   ()=>({type:"text",text:"最近正式核准商品目錄"}),
   neverFinishes);
  const answer=await Promise.race([
   reply,
   new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error("LINE blocked on remote catalog")),300)})
  ]);
  assert.equal(answer.text,"最近正式核准商品目錄");
  assert.equal(backgroundRequests,1);
  assert.equal(replies,1);
  console.log("PASS LINE approved product reply does not wait for remote catalog");
 }finally{clearTimeout(timer)}
})().catch(e=>{console.error(e);process.exitCode=1});

const fallbackStart=source.indexOf('function canUseTextFallback(error)');
const fallbackEnd=source.indexOf('async function reply(token, messages)',fallbackStart);
assert.ok(fallbackStart>0&&fallbackEnd>fallbackStart);
const canUseTextFallback=vm.runInNewContext(
 '('+source.slice(fallbackStart,fallbackEnd).trim()+')');
for(const uncertain of [
 {name:'AbortError',message:'unknown if delivered'},
 {status:502},{status:503},{status:504},{status:429},{status:401},
 {status:400,body:{message:'Invalid reply token'}},
 {status:400,body:{message:'bad',details:[{property:'replyToken',message:'Invalid value'}]}}
])assert.equal(canUseTextFallback(uncertain),false,'Never retry a spent or uncertain reply token');
for(const definitelyRejected of [
 {status:400,body:{message:'Invalid messages[0].contents'}},
 {response:{status:400,data:{details:[{property:'messages[0].altText',message:'invalid'}]}}}
])assert.equal(canUseTextFallback(definitelyRejected),true,'A definitive invalid Flex payload may fall back to plain text');
assert.match(source,/&&canUseTextFallback\(error\)/);
assert.doesNotMatch(source,/lastReplyError = typeof detail === "object"/);
assert.doesNotMatch(source,/JSON\.stringify\(fallbackDetail\)/);


// Offline mocked LINE SDK path: a definitively rejected Flex may be retried
// once as text; its successful acceptance must reset the health error flag.
const replyStart=source.indexOf('async function reply(token, messages)',fallbackEnd);
const replyEnd=source.indexOf('function productBubble(product)',replyStart);
assert.ok(replyStart>0&&replyEnd>replyStart,'Reply implementation anchor missing');
const makeReplyHarness=vm.runInNewContext([
 '(function(client){',
 'let lastReplyError=""; let lastReplySuccessAt="";',
 'const mainQuick=()=>[{label:"看產品",text:"看產品"}];',
 'const fallbackReplyText=()=>"仙加味已收到您的詢問";',
 source.slice(fallbackStart,replyEnd),
 'return {reply,get:()=>({lastReplyError,lastReplySuccessAt})};',
 '})'
].join('\n'),{Date,console:{error(){},warn(){}}});
(async()=>{
 let attempts=0;
 const accepted=makeReplyHarness({async replyMessage({messages}){
   attempts++;
   if(attempts===1)throw {status:400,body:{message:'Invalid messages[0].contents'}};
   assert.equal(messages[0].type,'text');
   return {};
 }});
 assert.equal(await accepted.reply('offline-test-token',{type:'flex',altText:'仙加味',contents:{}}),true);
 assert.equal(attempts,2,'Definitively rejected Flex gets exactly one safe text fallback');
 assert.equal(accepted.get().lastReplyError,'','Successful recovery must clear stale failed state');
 assert.ok(accepted.get().lastReplySuccessAt,'Successful fallback must retain acknowledgement timestamp');
 let uncertainAttempts=0;
 const uncertain=makeReplyHarness({async replyMessage(){
   uncertainAttempts++;
   throw {status:503,body:{message:'Temporary failure'}};
 }});
 assert.equal(await uncertain.reply('offline-second-token',{type:'flex',altText:'仙加味',contents:{}}),false);
 assert.equal(uncertainAttempts,1,'Uncertain 5xx must not reuse a one-time reply token');
 assert.match(uncertain.get().lastReplyError,/503/);
 console.log('PASS LINE fallback success clears stale error while ambiguous 5xx never retries');
})().catch(error=>{console.error(error);process.exitCode=1});


// The LINE event source is not always an identifiable one-to-one customer.
// Simulate all supported event origins without loading credentials or sending.
const privateStart=source.indexOf('function isPrivateCustomerEvent(event) {');
const privateEnd=source.indexOf('async function handleLegacyPostback(event)',privateStart);
assert.ok(privateStart>0&&privateEnd>privateStart,"Private customer guard missing");
const handlers=vm.runInNewContext([
  '(function(reply,textMsg){',
  source.slice(privateStart,privateEnd),
  'return {isPrivateCustomerEvent,replyNonPrivateCustomerEvent};',
  '})'
].join('\n'))(
  async(token,msg)=>({token,msg}),
  text=>({type:'text',text})
);
const validUser={source:{type:'user',userId:'U0123456789abcdef0123456789abcdef'},replyToken:'FAKE_ONE_TO_ONE'};
assert.equal(handlers.isPrivateCustomerEvent(validUser),true);
for(const evt of [
  {source:{type:'user'}},
  {source:{type:'group',groupId:'Cgroup',userId:validUser.source.userId}},
  {source:{type:'group',groupId:'Cgroup'}},
  {source:{type:'room',roomId:'Rroom',userId:validUser.source.userId}},
  {source:{}},
  {}
])assert.equal(handlers.isPrivateCustomerEvent(evt),false,'Nonprivate input must not touch a customer cart');
(async()=>{
  const guarded=await handlers.replyNonPrivateCustomerEvent({
    source:{type:'group',groupId:'Cgroup'},replyToken:'OFFLINE_GROUP_TOKEN'
  });
  assert.equal(guarded.token,'OFFLINE_GROUP_TOKEN');
  assert.equal(guarded.msg.type,'text');
  assert.match(guarded.msg.text,/一對一聊天室/);
  assert.equal(await handlers.replyNonPrivateCustomerEvent({source:{type:'user'}}),false);
  console.log('PASS nonprivate LINE events never receive personal cart or order flow');
})().catch(e=>{console.error(e);process.exitCode=1});
assert.match(source,/if \(\(event\.type === "message" \|\| event\.type === "postback"\) &&\s+!isPrivateCustomerEvent\(event\)\)/);
assert.match(source,/result = await replyNonPrivateCustomerEvent\(event\)/);
assert.doesNotMatch(source,/getState\(event\.source\.userId \|\| "anonymous"\)/);
assert.equal((source.match(/getState\(event\.source\.userId\)/g)||[]).length,2);


// Safe free FAQ must use existing approved facts and leave unrelated,
// medical or potentially identifying questions to the existing routes.
const {matchApprovedFaq}=require("./line-approved-faq-runtime");
const expectedApproved=[
 ["龜鹿膏跟龜鹿飲差在哪裡","difference-gao-drink"],
 ["30cc和180cc有什麼不一樣","drink-30-vs-180"],
 ["龜鹿飲製作要多久","drink-shipping"],
 ["龜鹿飲可以微波嗎","warm-use"],
 ["龜鹿飲能直接喝嗎","drink-direct-use"],
 ["第一次買怎麼選","first-time-choice"],
 ["想送長輩選什麼好","gift-for-elder"],
 ["官網可以線上結帳嗎","online-purchase"]
];
for(const [question,id] of expectedApproved){
 const matched=matchApprovedFaq(question);
 assert.equal(matched?.id,id,question);
 assert.ok(matched.text.trim(),question);
}
for(const question of [
 "龜鹿飲對糖尿病有用嗎","我有高血壓能喝嗎","柒玄茶怎麼買",
 "龜鹿膠還有現貨嗎","今天營業到幾點","有沒有特價",
 "我的訂單在哪","商採數量｜5","龜鹿飲","人工客服"
])assert.equal(matchApprovedFaq(question),null,"Unsafe or stateful question must stay in existing flow: "+question);
const answers=require("./config/ai-commerce-answers.json");
const hours=answers.answers.find(x=>x.id==="business-hours")?.answer||"";
assert.match(hours,/輸入「營業時間」/);
assert.doesNotMatch(hours,/\b(?:10:00|10:30|09:30)\b/,
  "Static FAQ must not override the live PUBLIC_STORE_HOURS value");
assert.match(source,/const approvedFaq = matchApprovedFaq\(text\)/);
const aiBranch=source.indexOf("const approvedFaq = matchApprovedFaq(text)");
assert.ok(aiBranch>source.indexOf("if (state.checkout) return continueCheckout"));
assert.ok(aiBranch<source.indexOf("const product = detectProduct(text)"));

const comboStart=source.indexOf("function orderNoticeForCombo(combo) {");
const comboEnd=source.indexOf("function orderNoticeForCart(cart = [])",comboStart);
assert.ok(comboStart>0&&comboEnd>comboStart);
const comboFn=vm.runInNewContext(
 "(function(getProduct,MIXED_ORDER_NOTICE,DRINK_ORDER_NOTICE,READY_STOCK_ORDER_NOTICE){"+
 source.slice(comboStart,comboEnd)+"return orderNoticeForCombo;})"
)(
 id=>id==="drink"?{fulfillmentType:"made-to-order-drink",readyStock:false}:
     id==="stock"?{fulfillmentType:"ready-stock",readyStock:true}:null,
 "混合","飲品5～7個工作天","現貨依供貨");
assert.match(comboFn(null),/商品明細需由客服確認/);
assert.doesNotMatch(comboFn({products:[]}),/5～7個工作天/);
assert.match(comboFn({products:[{productId:"invalid"}]}),/商品明細需由客服確認/);
assert.equal(comboFn({products:[{productId:"drink"}]}),"飲品5～7個工作天");
assert.equal(comboFn({products:[{productId:"stock"}]}),"現貨依供貨");
assert.equal(comboFn({products:[{productId:"drink"},{productId:"stock"}]}),"混合");
console.log("PASS approved zero-cost FAQs, no static hours and empty-combo fulfillment fallback");


// Runtime security: no public LINE message may enroll a manager or log PII.
// Use a fully stubbed LINE client: no external network, credentials or data.
const ownerSource=fs.readFileSync(require("node:path").join(__dirname,"line-owner-alert-runtime.js"),"utf8");
assert.doesNotMatch(ownerSource,/process\.env\.OWNER_LINE_USER_ID\s*=/);
assert.doesNotMatch(ownerSource,/console\.log\(\x60\[XJW_OWNER_BIND\]/);
assert.match(ownerSource,/event\?\.source\?\.type !== "user"/);
for(const marker of ["[XJW_QUOTE_REQUEST]","[XJW_APPROVED_MERCHANT_ALERT]","[XJW_MERCHANT_INQUIRY_ALERT]",
 "[XJW_PARTNER_ALERT]","[XJW_LINE_EVENT_FALLBACK]"])
  assert.ok(source.includes(marker),"Missing privacy-safe diagnostic: "+marker);
assert.doesNotMatch(source,/error:\s*String\(error\?\.message \|\| error\)/);
assert.doesNotMatch(source,/stack:\s*String\(error\?\.stack/);
assert.doesNotMatch(source,/console\.error\("[XJW_CRM_WRITE]"\s*,?\s*error/);

function fakeOwnerRuntime(env,captures){
 const context={
   module:{exports:{}},process:{env},
   console:{log:(...args)=>captures.logs.push(args.join(" ")),
     warn:(...args)=>captures.logs.push(args.join(" ")),
     error:(...args)=>captures.logs.push(args.join(" "))},
   Date,Promise,
   require:(id)=>{assert.equal(id,"@line/bot-sdk");
     return {messagingApi:{MessagingApiClient:class {
       async pushMessage(request){
         captures.pushes.push(request);
         if(captures.fail)throw Error("private phone 0912345678, full customer request");
       }
     }}};
   }
 };
 vm.runInNewContext(ownerSource,context);
 return context.module.exports;
}
(async()=>{
 const privateId="U1234567890abcdefghijklmnopqrstuv";
 const own={logs:[],pushes:[]};
 const env={CHANNEL_ACCESS_TOKEN:"OFFLINE_FAKE_TOKEN"};
 const mod=fakeOwnerRuntime(env,own);
 mod.inspectEvents({body:{events:[{
   type:"message",message:{type:"text",text:"綁定人工客服通知"},
   source:{type:"user",userId:privateId}}]}});
 assert.equal(env.OWNER_LINE_USER_ID,undefined,"Customer-controlled manager binding must remain prohibited");
 assert.equal(own.pushes.length,0);
 assert.ok(!own.logs.join(" ").includes(privateId),"Never print private source LINE user ID");
 const guarded={logs:[],pushes:[]};
 const checked=fakeOwnerRuntime({
   CHANNEL_ACCESS_TOKEN:"OFFLINE_FAKE_TOKEN",OWNER_LINE_USER_ID:"U_PRIVATE_OWNER"
 },guarded);
 checked.inspectEvents({body:{events:[{
   type:"message",message:{type:"text",text:"人工客服"},
   source:{type:"group",groupId:"C_GROUP",userId:privateId}}]}});
 await Promise.resolve();await Promise.resolve();
 assert.equal(guarded.pushes.length,0,"Group messages may not trigger owner alerts");
 checked.inspectEvents({body:{events:[{
   type:"message",message:{type:"text",text:"人工客服"},
   source:{type:"user",userId:privateId}}]}});
 await Promise.resolve();await Promise.resolve();
 assert.equal(guarded.pushes.length,1,"Configured owner still receives legitimate 1:1 alerts");
 assert.equal(guarded.pushes[0].to,"U_PRIVATE_OWNER");
 assert.ok(!guarded.logs.join(" ").includes(privateId));
 const fail={logs:[],pushes:[],fail:true};
 const failing=fakeOwnerRuntime({CHANNEL_ACCESS_TOKEN:"OFFLINE_FAKE_TOKEN",
   OWNER_LINE_USER_ID:"U_PRIVATE_OWNER"},fail);
 failing.inspectEvents({body:{events:[{
   type:"message",message:{type:"text",text:"人工客服"},
   source:{type:"user",userId:privateId}}]}});
 await Promise.resolve();await Promise.resolve();await new Promise(resolve=>setImmediate(resolve));
 assert.ok(!fail.logs.join(" ").includes("0912345678"),"No raw private SDK failure in logs");
 console.log("PASS: owner binding blocked, groups ignored, configured owner preserved, private errors redacted");
})().catch(e=>{console.error(e);process.exitCode=1});
