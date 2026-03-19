
const axios = require("axios");

const SHEET_URL = "https://script.google.com/macros/s/AKfycbw98YESWy0vKhmDxyrS_H8OoZ8XalHh0FZutxfB4_9NYlPUFBroHEt_Mbd_5EizGW5flQ/exec";

const userState = {};
const userProfile = {}; // VIP / 回購

function getState(id){
  if(!userState[id]) userState[id] = {};
  return userState[id];
}

function getProfile(id){
  if(!userProfile[id]){
    userProfile[id] = {orders:0, vip:false};
  }
  return userProfile[id];
}

async function sendOrder(state, userId){
  await axios.post(SHEET_URL, state).catch(()=>{});

  const profile = getProfile(userId);
  profile.orders += 1;

  if(profile.orders >= 3){
    profile.vip = true;
  }
}

function mainFlex(){
  return {
    type:"flex",
    altText:"選單",
    contents:{
      type:"bubble",
      body:{type:"box",layout:"vertical",contents:[
        {type:"text",text:"仙加味",weight:"bold",size:"xl"},
        {type:"text",text:"選擇功能👇",size:"sm"}
      ]},
      footer:{type:"box",layout:"vertical",contents:[
        {type:"button",style:"primary",action:{type:"message",label:"我要搭配",text:"我要搭配"}},
        {type:"button",action:{type:"message",label:"全部產品",text:"全部產品"}},
        {type:"button",action:{type:"message",label:"一鍵下單",text:"一鍵下單"}}
      ]}
    }
  };
}

function buyFlex(){
  return {
    type:"flex",
    altText:"下單",
    contents:{
      type:"bubble",
      body:{type:"box",layout:"vertical",contents:[
        {type:"text",text:"快速下單",weight:"bold",size:"lg"}
      ]},
      footer:{type:"box",layout:"vertical",contents:[
        {type:"button",style:"primary",action:{
          type:"uri",
          label:"填寫訂單",
          uri:"https://ts15825868.github.io/xianjiawei/order.html"
        }}
      ]}
    }
  };
}

function reply(client,event,msg){
  return client.replyMessage(event.replyToken,{type:"text",text:msg});
}

module.exports = async (client,event)=>{

  const userId = event.source.userId;
  const msg = event.message.text;
  const state = getState(userId);
  const profile = getProfile(userId);

  if(msg === "選單"){
    return client.replyMessage(event.replyToken, mainFlex());
  }

  if(msg === "一鍵下單"){
    return client.replyMessage(event.replyToken, buyFlex());
  }

  if(msg === "完成訂單"){
    await sendOrder({
      name:"測試",
      phone:"0900",
      shipping:"7-11",
      address:"門市",
      product:"龜鹿膏",
      qty:1,
      payment:"貨到付款"
    }, userId);

    let vipText = "";
    if(profile.vip){
      vipText = "\n🎖 VIP 已啟用（專屬優惠）";
    }

    return reply(client,event,"訂單已完成 👍" + vipText);
  }

  if(msg === "回購"){
    return reply(client,event,"最近可以補一下 👍\n需要我幫你安排嗎？");
  }

  return client.replyMessage(event.replyToken, mainFlex());
};
