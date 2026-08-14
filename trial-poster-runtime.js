"use strict";

const line=require("@line/bot-sdk");
const visual=require("./content/trial-campaign-visual.json");
const POSTER=visual.lineCompatiblePoster||visual.poster;
const FINAL_ASSET_ID=visual.currentFinalAssetId||"20260814-user-small-boss-trial-poster";
const proto=line?.messagingApi?.MessagingApiClient?.prototype;
const original=proto?.replyMessage;

function fixText(value){
  if(typeof value!=="string")return value;
  return value
    .replace(/正式售價50元／罐；買10送1，共11罐500元/g,"龜鹿飲30cc正式售價60元／罐；買10送1，共11罐600元；180cc鋁袋單包200元，買10送1，共11包2,000元")
    .replace(/11罐500元/g,"11罐600元")
    .replace(/正式售價50元／罐/g,"正式售價60元／罐")
    .replace(/龜鹿湯塊\s*(300g|600g)/g,"龜鹿湯塊75g");
}

function walk(node){
  if(Array.isArray(node))return node.map(walk);
  if(!node||typeof node!=="object")return fixText(node);
  const out={};
  for(const [key,value] of Object.entries(node))out[key]=walk(value);
  return out;
}

function fixTrialMessage(message){
  const next=walk(message);
  if(next?.type!=="flex"||!/試喝/.test(String(next.altText||"")))return next;
  const bubble=next.contents;
  if(!bubble||bubble.type!=="bubble")return next;
  bubble.size="mega";
  bubble.hero={
    type:"image",
    url:POSTER,
    size:"full",
    aspectRatio:"1:1",
    aspectMode:"fit",
    backgroundColor:"#F7F1E6",
    action:{type:"uri",uri:"https://ts15825868.github.io/xianjiawei/trial.html"}
  };
  bubble.xjwTrialMediaAuthority=FINAL_ASSET_ID;
  return next;
}

if(proto&&typeof original==="function"&&!proto.__xjwTrialPosterPatched){
  proto.replyMessage=function patchedReplyMessage(payload,...rest){
    const next={...payload};
    if(Array.isArray(next.messages))next.messages=next.messages.map(fixTrialMessage);
    return original.call(this,next,...rest);
  };
  proto.__xjwTrialPosterPatched=true;
}

module.exports={POSTER,FINAL_ASSET_ID,visual,fixTrialMessage};
