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
