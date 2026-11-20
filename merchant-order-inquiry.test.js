"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {merchantToBusinessInquiry,MAX_ITEMS,MAX_DELIVERY}=require("./merchant-order-inquiry");
const {prepareInquiry}=require("./business-inquiry-intake");
const sample=()=>({contact:"仙加味合作店／以 LINE 聯絡",items:"龜鹿飲30cc玻璃罐 20罐；龜鹿膏100g 5罐",delivery:"新北市／交期待討論"});
test("merchant quote maps to signed B2B category and retains complete details; not an order",()=>{
 const record=merchantToBusinessInquiry(sample());
 assert.equal(record.data.category,"批發採購");
 assert.equal(record.data.business,sample().contact);
 assert(record.data.details.includes(sample().items)&&record.data.details.includes(sample().delivery));
 assert(record.data.details.length<=400);
 const payload=prepareInquiry(record,"website:contact-b2b");
 assert.match(payload.id,/^B2B-/);
 assert.equal(payload.source,"LINE");
 assert.equal(payload.category,"批發採購");
 assert.equal(payload.origin,"website:contact-b2b");
 assert.equal(payload.details,record.data.details);
 assert(!("orderNo" in payload)&&!("paymentStatus" in payload)&&!("price" in payload));
});
test("length and emptiness boundaries never silently trim merchant contact, product list or delivery needs",()=>{
 assert.equal(MAX_ITEMS,240);assert.equal(MAX_DELIVERY,110);
 for(const patch of [{contact:""},{contact:"abc"},{items:""},{items:"abc"},{delivery:""},{items:"A".repeat(MAX_ITEMS+1)},{delivery:"B".repeat(MAX_DELIVERY+1)},{contact:"C".repeat(241)}])
   assert.equal(merchantToBusinessInquiry({...sample(),...patch}),null);
 assert.equal(merchantToBusinessInquiry({...sample(),items:"A".repeat(MAX_ITEMS),delivery:"B".repeat(MAX_DELIVERY)}).data.details.length<=400,true);
});
test("server only confirms signed actor-bound merchant draft, holds ambiguous notification, and preserves older quote path",()=>{
 const s=fs.readFileSync("server.js","utf8");
 assert(s.includes('const merchantReceiptCommand = text.match(/^確認送出商家詢價｜(B2B-[a-f0-9-]{36})$/i)'));
 assert(s.includes('accessDraft("load-draft", event.source.userId, inquiryOptions, {id})'));
 assert(s.includes('payload.category !== "批發採購"'));
 assert(s.includes('persistAndNotify('));
 assert(s.includes('accessDraft("save-draft", event.source.userId, inquiryOptions, {payload})'));
 assert(s.includes('merchantToBusinessInquiry(merchant.data)'));
 assert(s.includes('receipt ? `商家採購詢價已收件，編號：${id}。'));
 assert(s.includes('if (text !== "確認送出商家詢價")'));
 assert(s.includes('ownerAlert.pushOwnerAlert(event, summary)'));
 assert(s.includes("確認前尚未成立訂單"));
 assert(!s.includes("XJW_B2B_CRM_ENABLED ="));
});
