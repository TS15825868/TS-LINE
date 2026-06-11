"use strict";

const line = require("@line/bot-sdk");
const express = require("express");
const fs = require("fs");
const path = require("path");

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || "IKjy0y2zfPOhMCp7xiJ4R4z7UkkvzoQgj7A6OH1AJjdMYpDnEzaicgz2HWy4pVz1KMSsUHzhoHoXZVztRQwibp3Q8UPfN+Dp4pBfT2k3Mzu5bBtdO1P78Cpffq+75liFPLL3ftcHMzvzr+WOgm6AEgdB04t89/1O/w1cDnyilFU=",
  channelSecret: process.env.CHANNEL_SECRET || "7c3c4740afa5a281d54afb9f8ffc1e96",
};

const CRM_URL = process.env.CRM_URL || "https://script.google.com/macros/s/AKfycbwAFBxeROd2ZYGJ_h0O7_H2MMxptOMoj3EXIErZpbKuTYFOzOVwQkrk8X1MoxapkHVGSA/exec";

const app = express();
const client = new line.Client(config);
const states = new Map();

function loadData() {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, "data.json"), "utf8"));
  data.products = (data.products || []).map((p) => ({
    ...p,
    spec: p.spec || p.size || "",
    displayName: p.displayName || p.name,
    imageUrl: p.imageUrl || ((data.siteUrl || "https://ts15825868.github.io/xianjiawei/") + (p.image || "images/logo.png")),
  }));
  data.combos = data.combos || [];
  data.payments = data.payments || ["匯款", "貨到付款"];
  data.shipping = data.shipping || ["宅配", "7-11賣貨便", "門市自取", "雙北親送"];
  return data;
}
const DATA = loadData();

function money(n){ return `$${Number(n || 0).toLocaleString("zh-TW")}`; }
function getState(userId){ if(!states.has(userId)) states.set(userId,{cart:[],checkout:null}); return states.get(userId); }
function qr(items){ return {items:items.slice(0,13).map(i=>({type:"action",action:{type:"message",label:i.label,text:i.text}}))}; }
function textMsg(text,quick){ const m={type:"text",text}; if(quick) m.quickReply=qr(quick); return m; }
function reply(token,messages){ return client.replyMessage(token,Array.isArray(messages)?messages:[messages]); }
function cleanName(text){ return String(text||"").replace(/我要買|我要|加入清單|加入購買清單|直接買|只買|建議售價|活動優惠|食用方式|推薦搭配|價格方案|怎麼使用|看|了解|刪除|移除/g,"").trim(); }
function productByName(text){
  const raw=cleanName(text);
  return DATA.products.find(p => p.name===raw || p.displayName===raw || String(text).includes(p.name) || String(text).includes(p.displayName) || (p.aliases||[]).some(a=>raw.includes(a)||String(text).includes(a)));
}
function comboByName(text){
  const raw=cleanName(text);
  return DATA.combos.find(c => c.name===raw || String(text).includes(c.name) || (c.aliases||[]).some(a=>raw.includes(a)||String(text).includes(a)));
}
function cartItemFromProduct(p){ return {type:"product",id:p.id,name:p.displayName||p.name,qty:1,price:p.price||0}; }
function cartItemFromCombo(c){ return {type:"combo",id:c.id||c.name,name:c.name,qty:1,price:c.price||0}; }
function addToCart(state,item){ const found=state.cart.find(x=>x.type===item.type && x.id===item.id); if(found) found.qty+=1; else state.cart.push(item); }
function cartTotal(cart){ return cart.reduce((s,i)=>s+(i.price||0)*(i.qty||1),0); }
function cartText(cart){
  if(!cart.length) return "目前購買清單是空的。";
  const lines=cart.map((i,idx)=>`${idx+1}. ${i.name} × ${i.qty}${i.price ? "\n"+money((i.price||0)*(i.qty||1)) : ""}`);
  return `目前購買清單：\n\n${lines.join("\n\n")}\n\n預估合計：${money(cartTotal(cart))}\n\n實際金額、活動與配送方式會由客服再協助確認。`;
}
function mainQuick(){ return [{label:"看產品",text:"看產品"},{label:"價格方案",text:"價格方案"},{label:"怎麼使用",text:"怎麼使用"},{label:"幫我推薦",text:"幫我推薦"},{label:"查看清單",text:"查看購買清單"}]; }
function cartActions(state){ return state.cart.length ? [{label:"繼續選購",text:"看產品"},{label:"移除商品",text:"移除商品"},{label:"清空清單",text:"清空購買清單"},{label:"直接結帳",text:"直接結帳"}] : [{label:"看產品",text:"看產品"},{label:"價格方案",text:"價格方案"}]; }

function button(label,text,style="secondary",color){
  const b={type:"button",style,action:{type:"message",label,text}};
  if(color) b.color=color;
  return b;
}
function bubble(title,desc,buttons=[],opts={}){
  const contents=[
    {type:"text",text:title,weight:"bold",size:"xl",color:opts.color||"#7B1E1E",wrap:true},
    {type:"text",text:desc||"",size:"sm",color:"#555555",wrap:true}
  ];
  if(opts.extraText) contents.push({type:"text",text:opts.extraText,wrap:true,size:"sm",color:"#111111"});
  return {type:"flex",altText:title,contents:{type:"bubble",body:{type:"box",layout:"vertical",spacing:"md",contents},footer:{type:"box",layout:"vertical",spacing:"sm",contents:buttons}}};
}
function productPriceText(p){
  const activity=(p.activity&&p.activity.length)?`\n\n活動優惠：\n${p.activity.map(x=>`・${x}`).join("\n")}`:"";
  return `【${p.displayName||p.name}】\n\n規格：${p.spec||p.size||""}\n建議售價：${money(p.price)} / ${p.unit||"件"}${activity}\n\n配送方式：\n✓ 宅配\n✓ 7-11賣貨便\n✓ 門市自取\n✓ 雙北親送`;
}
function productActivityText(p){
  if(p.activity&&p.activity.length) return `【${p.displayName||p.name}｜活動優惠】\n\n${p.activity.map(x=>`・${x}`).join("\n")}\n\n單品建議售價：${money(p.price)} / ${p.unit||"件"}\n\n實際活動與配送方式由客服協助確認。`;
  return `【${p.displayName||p.name}｜活動優惠】\n\n目前多入優惠請洽客服確認。\n\n單品建議售價：${money(p.price)} / ${p.unit||"件"}`;
}
function productUsageText(p){
  const ing=(p.ingredients&&p.ingredients.length)?`\n\n成分：${p.ingredients.join("、")}`:"";
  return `【${p.displayName||p.name}｜食用方式】\n\n${(p.usage||[]).join("\n\n")}${ing}`;
}
function productFlex(p){
  return {type:"bubble",size:"mega",
    hero:{type:"image",url:p.imageUrl,size:"full",aspectRatio:"1:1",aspectMode:"cover"},
    body:{type:"box",layout:"vertical",spacing:"md",contents:[
      {type:"text",text:p.displayName||p.name,weight:"bold",size:"xl",wrap:true},
      {type:"text",text:p.description||"",wrap:true,size:"sm",color:"#555555"},
      {type:"text",text:`規格：${p.spec||p.size||""}`,wrap:true,size:"sm",color:"#555555"},
      {type:"text",text:"價格、使用方式與搭配建議可點下方按鈕查看",wrap:true,weight:"bold",color:"#7B1E1E"}
    ]},
    footer:{type:"box",layout:"vertical",spacing:"sm",contents:[
      button("加入清單",`加入清單 ${p.displayName||p.name}`,"primary","#7B1E1E"),
      button("立即下單",`直接買 ${p.displayName||p.name}`),
      button("價格方案",`建議售價 ${p.displayName||p.name}`,"link"),
      button("怎麼使用",`食用方式 ${p.displayName||p.name}`,"link"),
      button("推薦搭配",`推薦搭配 ${p.displayName||p.name}`,"link")
    ]}
  };
}
function productCarousel(products=DATA.products){ return {type:"flex",altText:"仙加味產品",contents:{type:"carousel",contents:products.map(productFlex)}}; }
function comboFlex(c){
  const body=[`內容：${(c.items||[]).join("＋")}`,c.desc||"",c.priceNote||"套餐優惠依數量與配送方式，由客服協助確認。"].filter(Boolean).join("\n");
  return {type:"bubble",body:{type:"box",layout:"vertical",spacing:"md",contents:[
    {type:"text",text:c.name,weight:"bold",size:"xl",color:"#7B1E1E",wrap:true},
    {type:"text",text:body,wrap:true,size:"sm",color:"#555555"}
  ]},footer:{type:"box",layout:"vertical",spacing:"sm",contents:[
    button("查看內容",`套餐內容 ${c.name}`,"link"),
    button("適合對象",`適合對象 ${c.name}`,"link"),
    button("加入清單",`加入清單 ${c.name}`,"primary","#7B1E1E"),
    button("立即下單",`直接買 ${c.name}`)
  ]}};
}
function comboCarousel(){ return {type:"flex",altText:"仙加味搭配組合",contents:{type:"carousel",contents:DATA.combos.map(comboFlex)}}; }
function priceMenuFlex(){
  return bubble("仙加味｜價格方案","可查看單品售價、活動優惠與套餐搭配。\n\n實際優惠內容會依數量、配送方式與活動安排協助確認。",[
    button("單品售價","單品售價","primary","#7B1E1E"),
    button("活動優惠","活動優惠"),
    button("套餐搭配","套餐搭配"),
    button("看產品","看產品","link")
  ]);
}
function priceCarousel(){
  const bubbles=DATA.products.map(p=>({type:"bubble",body:{type:"box",layout:"vertical",spacing:"md",contents:[
    {type:"text",text:p.displayName||p.name,weight:"bold",size:"xl",color:"#7B1E1E",wrap:true},
    {type:"text",text:`規格：${p.spec||p.size||""}`,size:"sm",color:"#555555",wrap:true},
    {type:"text",text:`建議售價：${money(p.price)} / ${p.unit||"件"}`,weight:"bold",wrap:true},
    ...(p.activity&&p.activity.length?[{type:"text",text:`活動：\n${p.activity.join("\n")}`,size:"sm",color:"#555555",wrap:true}]:[])
  ]},footer:{type:"box",layout:"vertical",spacing:"sm",contents:[
    button("加入清單",`加入清單 ${p.displayName||p.name}`,"primary","#7B1E1E"),
    button("立即下單",`直接買 ${p.displayName||p.name}`)
  ]}}));
  return {type:"flex",altText:"單品售價",contents:{type:"carousel",contents:bubbles}};
}
function activityFlex(){
  return bubble("仙加味｜活動優惠","目前主要活動如下。\n\n龜鹿飲30cc玻璃瓶\n・12瓶 500元\n・24瓶 900元\n\n龜鹿飲180cc鋁袋\n・6包 1000元\n・12包 1800元\n\n其他品項多入優惠請洽客服確認。",[
    button("加入30cc玻璃瓶","加入清單 龜鹿飲30cc玻璃瓶","primary","#7B1E1E"),
    button("加入180cc鋁袋","加入清單 龜鹿飲180cc鋁袋"),
    button("看產品","看產品","link")
  ]);
}
function usageMenuFlex(){
  return bubble("仙加味｜使用方式","依產品型態查看使用方式。建議以日常飲食安排為主，不急、不誇張，選擇自己容易持續的方式。",[
    button("龜鹿膏","食用方式 龜鹿膏","primary","#7B1E1E"),
    button("龜鹿湯塊","食用方式 龜鹿湯塊"),
    button("龜鹿膠","食用方式 龜鹿膠"),
    button("龜鹿飲","食用方式 龜鹿飲"),
    button("鹿茸粉","食用方式 鹿茸粉")
  ]);
}
function recommendMenuFlex(){
  return bubble("仙加味｜產品建議","依平常使用習慣選擇，先從最容易放進生活的方式開始。",[
    button("固定補養","推薦 固定補養","primary","#7B1E1E"),
    button("方便飲用","推薦 方便飲用"),
    button("料理燉湯","推薦 料理燉湯"),
    button("固定使用","推薦 固定使用"),
    button("自行搭配","推薦 自行搭配")
  ]);
}
function recommendText(msg){
  if(/固定補養/.test(msg)) return "推薦：龜鹿膏\n\n適合希望建立固定補養節奏的人。可直接食用，也可加入熱飲或料理使用。";
  if(/方便飲用/.test(msg)) return "推薦：龜鹿飲\n\n開封即可飲用，適合外出、上班與日常安排。";
  if(/料理燉湯/.test(msg)) return "推薦：龜鹿湯塊\n\n適合燉雞湯、排骨湯與日常料理。";
  if(/固定使用/.test(msg)) return "推薦：龜鹿膠\n\n600g一斤裝，適合家庭使用、固定安排與通路合作。";
  if(/自行搭配/.test(msg)) return "推薦：鹿茸粉\n\n可搭配熱飲、牛奶與豆漿使用。";
  return "";
}
function differenceFlex(){
  return bubble("龜鹿湯塊／龜鹿膠差異","兩者內容物相同，差異在規格與包裝方式。\n\n龜鹿湯塊\n75g（2兩／8塊）\n每塊約9.375g\n\n龜鹿膠\n600g（一斤裝／32塊）\n每塊約18.75g",[
    button("看龜鹿湯塊","龜鹿湯塊","primary","#7B1E1E"),
    button("看龜鹿膠","龜鹿膠"),
    button("價格方案","價格方案","link")
  ]);
}
function cartFlex(state){
  const body=state.cart.length?cartText(state.cart):"目前購買清單是空的。";
  return bubble("目前購買清單",body,cartActions(state).map((x,i)=>button(x.label,x.text,i==0?"primary":"secondary",i==0?"#7B1E1E":undefined)));
}
function checkoutCard(title, desc, buttons){
  return bubble(title,desc,buttons.map((b,i)=>button(b.label,b.text,i==0?"primary":"secondary",i==0?"#7B1E1E":undefined)));
}
function orderConfirmFlex(state,ck){
  return bubble("請確認訂單",`商品與金額\n${cartText(state.cart)}\n\n姓名：${ck.name}\n電話：${ck.phone}\n地址／門市：${ck.address}\n付款：${ck.payment}\n配送：${ck.shipping}`,[
    button("確認送出","確認送出","primary","#7B1E1E"),
    button("重新修改","取消"),
    button("取消訂單","取消","link")
  ]);
}
function orderSuccessFlex(order){
  return bubble("訂單建立成功",`訂單編號：${order.orderId||"已建立"}\n\n商品：\n${order.productText||""}\n\n付款：${order.payment}\n配送：${order.shipping}\n\n我們會再為你確認金額、活動與配送安排。`,[
    button("查看產品","看產品","primary","#7B1E1E"),
    button("再次下單","看產品"),
    button("聯絡客服","價格方案","link")
  ]);
}
async function saveCRM(data){
  if(!CRM_URL) return {ok:false};
  try{
    const res=await fetch(CRM_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
    const txt=await res.text();
    try{return JSON.parse(txt);}catch(e){return {ok:res.ok,text:txt};}
  }catch(e){ console.error("CRM error",e); return {ok:false,error:String(e)}; }
}

app.get("/",(req,res)=>res.send("仙加味 LINE Bot is running"));
app.get("/healthz",(req,res)=>res.json({ok:true,time:new Date().toISOString()}));
app.post("/webhook",line.middleware(config),async(req,res)=>{try{await Promise.all((req.body.events||[]).map(handleEvent));res.sendStatus(200);}catch(e){console.error(e);res.sendStatus(500);}});

async function handleEvent(event){
  if(event.type==="follow") return reply(event.replyToken,textMsg("歡迎來到仙加味・龜鹿🙂\n可以直接點下面按鈕，不用自己打字。",mainQuick()));
  if(event.type!=="message"||event.message.type!=="text") return;
  const userId=event.source.userId; const state=getState(userId); const msg=event.message.text.trim();

  if(msg.startsWith("建議售價")){const p=productByName(msg);return reply(event.replyToken,textMsg(p?productPriceText(p):"請先點產品卡上的價格方案按鈕。",mainQuick()));}
  if(msg.startsWith("活動優惠")){const p=productByName(msg);return reply(event.replyToken,textMsg(p?productActivityText(p):"請先點產品卡上的活動優惠按鈕。",mainQuick()));}
  if(msg.startsWith("食用方式")){const p=productByName(msg);return reply(event.replyToken,textMsg(p?productUsageText(p):"請先點產品卡上的怎麼使用按鈕。",mainQuick()));}
  if(msg.startsWith("推薦搭配")) return reply(event.replyToken, recommendMenuFlex());

  if(/價格方案|價格|售價|價錢|多少錢/.test(msg)) return reply(event.replyToken, priceMenuFlex());
  if(/單品售價|單項售價|單品價格|單項價格/.test(msg)) return reply(event.replyToken, priceCarousel());
  if(/活動優惠|優惠活動/.test(msg)) return reply(event.replyToken, activityFlex());
  if(/套餐搭配|套餐售價|套餐價格|搭配組合|看搭配組合/.test(msg)) return reply(event.replyToken, comboCarousel());
  if(/怎麼使用|使用方式|怎麼吃|食用方式/.test(msg)) return reply(event.replyToken, usageMenuFlex());
  if(/幫我推薦|推薦|怎麼選|適合哪個|不知道/.test(msg)) return reply(event.replyToken, recommendMenuFlex());
  if(msg.startsWith("推薦 ")){ const txt=recommendText(msg); return reply(event.replyToken,textMsg(txt||"請選擇想了解的使用情境。",mainQuick()));}
  if(/龜鹿膠.*湯塊|湯塊.*龜鹿膠|湯塊.*膠|膠.*湯塊|差別/.test(msg)) return reply(event.replyToken,differenceFlex());
  if(/配送|運費|寄送|親送|宅配/.test(msg)) return reply(event.replyToken, checkoutCard("配送方式","請選擇你方便的配送方式。",DATA.shipping.map(x=>({label:x,text:x}))));

  if(/^(清空購買清單|清空清單|清空購物清單)$/.test(msg)){state.cart=[];state.checkout=null;return reply(event.replyToken,cartFlex(state));}
  if(msg==="移除商品"){if(!state.cart.length)return reply(event.replyToken,cartFlex(state));return reply(event.replyToken,textMsg("要移除哪一個？",state.cart.map(i=>({label:i.name.slice(0,20),text:`刪除 ${i.name}`}))));}
  if(msg.startsWith("刪除 ")||msg.startsWith("移除 ")){const name=msg.replace(/^刪除\s*|^移除\s*/,"").trim();state.cart=state.cart.filter(i=>i.name!==name);return reply(event.replyToken,cartFlex(state));}

  if(state.checkout && !["看產品","看搭配組合","查看購買清單","取消"].includes(msg)) return continueCheckout(event,state,msg);
  if(msg==="取消"){state.checkout=null;return reply(event.replyToken,textMsg("已取消本次下單流程。",mainQuick()));}
  if(msg==="看產品"||msg==="直接下單"||msg==="我想直接下單") return reply(event.replyToken,productCarousel());
  if(msg==="查看購買清單"||msg==="查看清單") return reply(event.replyToken,cartFlex(state));
  if(msg==="直接結帳") return startCheckout(event,state);

  if(msg.startsWith("加入清單")||msg.startsWith("加入購買清單")){const p=productByName(msg);const c=comboByName(msg);if(!p&&!c)return reply(event.replyToken,textMsg("找不到要加入的品項，請再點一次商品或套餐。",mainQuick()));const item=c?cartItemFromCombo(c):cartItemFromProduct(p);addToCart(state,item);return reply(event.replyToken,cartFlex(state));}
  if(msg.startsWith("直接買")||msg.startsWith("我要買")||msg.startsWith("我要 ")){const p=productByName(msg);const c=comboByName(msg);if(!p&&!c)return reply(event.replyToken,textMsg("可以先看產品或搭配組合，再點按鈕直接加入。",mainQuick()));state.cart=[c?cartItemFromCombo(c):cartItemFromProduct(p)];return startCheckout(event,state);}
  const p=productByName(msg); if(p) return reply(event.replyToken,{type:"flex",altText:p.displayName,contents:productFlex(p)});
  return reply(event.replyToken,textMsg("可以直接點下面按鈕，我幫你整理🙂",mainQuick()));
}
function startCheckout(event,state){
  if(!state.cart.length) return reply(event.replyToken,cartFlex(state));
  state.checkout={step:"name",name:"",phone:"",address:"",payment:"",shipping:""};
  return reply(event.replyToken,[cartFlex(state), checkoutCard("第一步｜收件姓名","請直接回覆收件人姓名。",[{label:"取消",text:"取消"}])]);
}
async function continueCheckout(event,state,msg){
  const ck=state.checkout; const text=msg.trim();
  if(ck.step==="name"){ck.name=text;ck.step="phone";return reply(event.replyToken,checkoutCard("第二步｜收件電話","請直接回覆收件人電話。",[{label:"取消",text:"取消"}]));}
  if(ck.step==="phone"){ck.phone=text;ck.step="address";return reply(event.replyToken,checkoutCard("第三步｜地址或門市資訊","請回覆收件地址、7-11門市資訊，或門市自取備註。",[{label:"取消",text:"取消"}]));}
  if(ck.step==="address"){ck.address=text;ck.step="payment";return reply(event.replyToken,checkoutCard("第四步｜付款方式","請選擇付款方式。",[{label:"匯款",text:"匯款"},{label:"貨到付款",text:"貨到付款"},{label:"取消",text:"取消"}]));}
  if(ck.step==="payment"){
    if(/匯款/.test(text)) ck.payment="匯款"; else if(/貨到付款|貨付|到付/.test(text)) ck.payment="貨到付款"; else return reply(event.replyToken,checkoutCard("第四步｜付款方式","請選擇付款方式。",[{label:"匯款",text:"匯款"},{label:"貨到付款",text:"貨到付款"},{label:"取消",text:"取消"}]));
    ck.step="shipping"; return reply(event.replyToken,checkoutCard("第五步｜配送方式","請選擇配送方式。",[{label:"宅配",text:"宅配"},{label:"7-11賣貨便",text:"7-11賣貨便"},{label:"門市自取",text:"門市自取"},{label:"雙北親送",text:"雙北親送"},{label:"取消",text:"取消"}]));
  }
  if(ck.step==="shipping"){
    if(/宅配/.test(text)) ck.shipping="宅配"; else if(/7-11|711|賣貨便|超商/.test(text)) ck.shipping="7-11賣貨便"; else if(/自取|門市/.test(text)) ck.shipping="門市自取"; else if(/雙北|親送/.test(text)) ck.shipping="雙北親送"; else return reply(event.replyToken,checkoutCard("第五步｜配送方式","請選擇配送方式。",[{label:"宅配",text:"宅配"},{label:"7-11賣貨便",text:"7-11賣貨便"},{label:"門市自取",text:"門市自取"},{label:"雙北親送",text:"雙北親送"},{label:"取消",text:"取消"}]));
    ck.step="confirm"; return reply(event.replyToken,orderConfirmFlex(state,ck));
  }
  if(ck.step==="confirm"){
    if(!/確認送出|確認|送出/.test(text)) return reply(event.replyToken,orderConfirmFlex(state,ck));
    const productText=state.cart.map(i=>`${i.name} × ${i.qty}`).join("、");
    const summary={cart:state.cart,total:cartTotal(state.cart),productText,userId:event.source.userId,lineUserId:event.source.userId,...ck,createdAt:new Date().toISOString()};
    const crm=await saveCRM(summary);
    state.cart=[]; state.checkout=null;
    return reply(event.replyToken,orderSuccessFlex({...summary,orderId:crm.orderId||""}));
  }
}
const port=process.env.PORT||3000;
app.listen(port,()=>console.log(`仙加味 LINE Bot running on ${port}`));
