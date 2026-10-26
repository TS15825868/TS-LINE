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
