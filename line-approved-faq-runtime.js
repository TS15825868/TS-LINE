"use strict";
// 仙加味零新增費用問答：只從既有核准的公開答案讀取；不呼叫AI API、
// 不推測醫療適用性、報價、庫存、營業時間，也不取代人工審核。
// 未經明確匹配的詢問交回既有LINE處理流程。
const knowledge=require("./config/ai-commerce-answers.json");
const byId=new Map((knowledge.answers||[])
  .filter(item=>typeof item?.id==="string"&&typeof item?.answer==="string")
  .map(item=>[item.id,item.answer.trim()]));
const retired=/柒玄茶|龜鹿湯塊|龜鹿膠|台興山產/;
const privateOrMedical=/疾病|症狀|治療|醫療|醫師|藥師|用藥|禁忌|懷孕|孕婦|糖尿病|高血壓|血壓|腫瘤|癌症|副作用|關節|疲勞|失眠|手術|中風|心臟病|腎臟病/;

function approvedAnswer(id){
  const answer=byId.get(id);
  if(!answer||retired.test(answer))return null;
  return {id,text:answer};
}

function matchApprovedFaq(question){
  const text=String(question||"").replace(/\s+/g,"").slice(0,300);
  if(!text||privateOrMedical.test(text)||retired.test(text))return null;
  const comparison=/差別|差異|差在哪|不一樣|不同|比較|怎麼選|如何選|哪個好|哪一種/;
  if(/龜鹿膏/.test(text)&&/龜鹿飲/.test(text)&&comparison.test(text))
    return approvedAnswer("difference-gao-drink");
  if(/30(?:cc|毫升|ml)/i.test(text)&&/180(?:cc|毫升|ml)/i.test(text)&&comparison.test(text))
    return approvedAnswer("drink-30-vs-180");
  if(/龜鹿飲|30(?:cc|毫升)|180(?:cc|毫升)/i.test(text)&&
     /多久.*出貨|幾天.*出貨|等多久|出貨要等|製作要多久|多久.*寄出/.test(text))
    return approvedAnswer("drink-shipping");
  if(/龜鹿飲|30(?:cc|毫升)|180(?:cc|毫升)/i.test(text)&&
     /溫熱|加熱|微波|熱喝|熱飲|隔水加熱|冰飲|冷飲/.test(text))
    return approvedAnswer("warm-use");
  if(/龜鹿飲|30(?:cc|毫升)|180(?:cc|毫升)/i.test(text)&&
     /直接飲用|直接喝|開罐.*喝|開封.*喝/.test(text))
    return approvedAnswer("drink-direct-use");
  if(/第一次|初次|新手|沒買過/.test(text)&&/選|買|試喝|哪個|入門/.test(text))
    return approvedAnswer("first-time-choice");
  if(/送長輩|送禮|給長輩/.test(text)&&/送|禮物|禮盒|推薦|選|適合/.test(text))
    return approvedAnswer("gift-for-elder");
  if(/官網|網站/.test(text)&&/直接下單|線上結帳|直接購買|線上購買|可以買|能買/.test(text))
    return approvedAnswer("online-purchase");
  return null;
}
module.exports={matchApprovedFaq};
