"use strict";
const assert=require("node:assert/strict");
const {withLineLoadingIndicator}=require("./line-chat-loading");
const event={source:{type:"user",userId:"U"+"a".repeat(32)}};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 let called=0;
 const fetchImpl=async(url,options)=>{
  called++;
  assert.equal(url,"https://api.line.me/v2/bot/chat/loading/start");
  assert.equal(options.method,"POST");
  assert.equal(options.headers.Authorization,"Bearer local-fixture-token");
  assert.equal(JSON.parse(options.body).chatId,event.source.userId);
  assert.equal(JSON.parse(options.body).loadingSeconds,10);
  return{ok:true,status:202};
 };
 assert.equal(await withLineLoadingIndicator(event,async()=>"fast",{
  token:"local-fixture-token",fetchImpl,delayMs:25}),"fast");
 await wait(35);
 assert.equal(called,0,"Fast LINE replies must never send an extra loading request");
 let done;
 const pending=new Promise(resolve=>{done=resolve;});
 const slow=withLineLoadingIndicator(event,()=>pending,{
  token:"local-fixture-token",fetchImpl,delayMs:10});
 await wait(35);
 assert.equal(called,1,"A genuinely slow order should show exactly one loading animation");
 done({ok:true,orderId:"LOCAL-123"});
 assert.deepEqual(await slow,{ok:true,orderId:"LOCAL-123"});
 assert.equal(called,1,"No repeated or billable customer messages");
 for(const invalid of [
  {source:{type:"group",userId:event.source.userId}},
  {source:{type:"user",userId:"not-a-line-user"}},
  {source:null}
 ]){
  assert.equal(await withLineLoadingIndicator(invalid,async()=>"fallback",{
   token:"local-fixture-token",fetchImpl,delayMs:5}),"fallback");
 }
 await wait(20);
 assert.equal(called,1,"Invalid or group LINE conversations never call one-to-one loading API");
 assert.equal(await withLineLoadingIndicator(event,async()=>"no-credential",{
  token:"",fetchImpl,delayMs:5}),"no-credential");
 assert.equal(called,1);
 // A loading API network exception must never mask the actual CRM result.
 let rejectRequests=0;
 const task=new Promise(resolve=>setTimeout(()=>resolve({ok:false,reason:"CRM unverified"}),40));
 const result=await withLineLoadingIndicator(event,()=>task,{
  token:"local-fixture-token",delayMs:5,fetchImpl:async()=>{rejectRequests++;throw Error("Loading service unavailable");}
 });
 assert.deepEqual(result,{ok:false,reason:"CRM unverified"});
 assert.equal(rejectRequests,1);
 console.log("PASS LINE only shows optional loading for slow, verified one-on-one business operations without affecting actual outcome");
})().catch(error=>{console.error(error);process.exitCode=1});
