"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const source=fs.readFileSync(require("node:path").join(__dirname,"server.js"),"utf8");
const start=source.indexOf("function recordCustomerReplyTiming(");
const end=source.indexOf("async function handleEvent(event)",start);
assert.ok(start>0&&end>start,"Real webhook acceptance timing helper missing");
const helper=source.slice(start,end);
let clock=Date.parse("2026-10-26T06:00:00.000Z");
class VirtualDate extends Date{
 constructor(...args){super(...(args.length?args:[clock]));}
 static now(){return clock;}
}
const vmCode=[
 "(function(){",
 "let lastCustomerProcessingMs=null,lastEventToLineAckApproxMs=null;",
 "let lastCustomerEventProcessedAt='',lastCustomerResponseAccepted=false,slowCustomerEventCount=0;",
 helper,
 "return {record:recordCustomerReplyTiming,get:()=>({handler:lastCustomerProcessingMs,",
 "eventToAck:lastEventToLineAckApproxMs,at:lastCustomerEventProcessedAt,",
 "accepted:lastCustomerResponseAccepted,slow:slowCustomerEventCount})};",
 "})()"
].join("\n");
const metrics=vm.runInNewContext(vmCode,{Date:VirtualDate});
const eventAt=clock-125;
clock+=25;
metrics.record({type:"message",timestamp:eventAt},clock-25,true);
let m=metrics.get();
assert.equal(m.handler,25);
assert.equal(m.eventToAck,150);
assert.equal(m.accepted,true);
assert.equal(m.slow,0);
assert.match(m.at,/^2026-10-26T06:00:00/);
clock+=100;
metrics.record({type:"follow",timestamp:clock-14000},clock-100,true);
m=metrics.get();
assert.equal(m.handler,100);
assert.equal(m.eventToAck,14000,"Estimate must count Render cold-start time from LINE event timestamp");
assert.equal(m.slow,1);
clock+=50;
metrics.record({type:"postback",timestamp:clock-15100},clock-50,false);
m=metrics.get();
assert.equal(m.accepted,false,"HTTP reply failure must never be reported accepted");
assert.equal(m.slow,2);
metrics.record({type:"unfollow",timestamp:clock-2},clock,true);
assert.equal(metrics.get().slow,2);
clock+=10;
metrics.record({type:"message",timestamp:-1},clock-10,true);
assert.equal(metrics.get().eventToAck,null,"Missing or bogus event timestamp cannot fabricate an E2E latency");
assert.match(source,/recordCustomerReplyTiming\(event,startedAt,success\)/);
assert.match(source,/recordCustomerReplyTiming\(event,startedAt,false\)/);
assert.match(source,/lastReplyErrorPresent:Boolean\(lastReplyError\)/);
assert.doesNotMatch(source,/^\s+lastReplyError,\s*$/m,
 "Public health endpoint must never expose a raw LINE SDK exception or customer detail");
assert.match(source,/customerReplyFullyDeliveredVerified:false/);
console.log("PASS customer reply API acceptance timing tracked without identifying customers or fabricating delivery");
