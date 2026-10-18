"use strict";
// 丹參茶包六款口味正式選單，唯一資料來源為核准的 LINE 商品／零售價母資料。
const source = require("./partner-inquiry-catalog.json");
const priceAuthority = require("./line-partner-retail-authority.json");
const IDS = [
  "jianfeng-rose-fruit-tea",
  "jianfeng-leisure-tea",
  "jianfeng-wudahan-tea",
  "jianfeng-fiber-tea",
  "jianfeng-white-tea",
  "jianfeng-refresh-tea",
];
const PRICE = priceAuthority.products["danshen-tea-collection"]?.price;
function variants() {
  const items = IDS.map(id => source.products.find(p => p.id === id));
  if (items.some(p => !p || p.price !== PRICE) || PRICE !== 480) {
    throw new Error("丹參茶包六種口味的正式單盒價格不一致，停止顯示以避免錯誤報價");
  }
  return items;
}
function byId(id) { return variants().find(p => p.id === id) || null; }
function priceText() { return "售價 NT$480／盒（單盒只選一種口味，3g×10包）"; }
function menu() {
  return {
    type:"flex",
    altText:"丹參茶包｜六種口味任選一盒 NT$480",
    contents:{
      type:"bubble", size:"kilo",
      body:{type:"box",layout:"vertical",spacing:"sm",contents:[
        {type:"text",text:"丹參茶包｜選擇口味",weight:"bold",size:"xl",color:"#7B1E1E",wrap:true},
        {type:"text",text:priceText(),size:"md",color:"#555555",wrap:true},
        {type:"text",text:"共有六種口味，每次選擇一款、每盒 NT$480；不是六盒合售。點選口味可看單款資料與詢問訂購。",size:"sm",color:"#555555",wrap:true},
      ]},
      footer:{type:"box",layout:"vertical",spacing:"sm",contents:variants().map((p,index)=>({
        type:"button",style:index===0?"primary":"secondary",
        ...(index===0?{color:"#7B1E1E"}:{}),
        action:{type:"message",label:p.name,text:`選擇丹參口味｜${p.id}`},
      }))},
    },
  };
}
function chosen(id,absoluteUrl) {
  const p=byId(id); if(!p)return null;
  return {
    type:"flex",altText:`已選：${p.name}｜一盒 NT$480`,
    contents:{type:"bubble",size:"kilo",
      body:{type:"box",layout:"vertical",spacing:"md",contents:[
        {type:"text",text:p.name,weight:"bold",size:"xl",color:"#7B1E1E",wrap:true},
        {type:"text",text:priceText(),size:"md",wrap:true},
        {type:"text",text:"目前選的是這一種口味、單盒計價。可查看原廠包裝及原料，再向客服確認數量與供貨。",size:"sm",wrap:true,color:"#555555"},
      ]},
      footer:{type:"box",layout:"vertical",spacing:"sm",contents:[
        {type:"button",style:"primary",color:"#7B1E1E",action:{type:"message",label:"選擇訂購盒數",text:`丹參數量｜${p.id}`}},
        {type:"button",style:"secondary",action:{type:"uri",label:"查看這款介紹",uri:absoluteUrl(p.publicPage)}},
        {type:"button",style:"secondary",action:{type:"message",label:"重新選擇口味",text:"丹參茶包系列"}},
      ]},
    },
  };
}
function quantityMenu(id) {
  const p=byId(id); if(!p)return null;
  return {
    type:"flex",altText:`${p.name}｜選擇盒數，每盒 NT$480`,
    contents:{type:"bubble",size:"kilo",
      body:{type:"box",layout:"vertical",spacing:"sm",contents:[
        {type:"text",text:p.name,weight:"bold",size:"xl",color:"#7B1E1E",wrap:true},
        {type:"text",text:priceText(),size:"md",wrap:true},
        {type:"text",text:"請選擇需要的盒數，單一口味每盒 NT$480。運費、現貨與實際付款由人工確認。",size:"sm",wrap:true,color:"#555555"},
      ]},
      footer:{type:"box",layout:"vertical",spacing:"sm",contents:[
        ...[1,2,3,5].map(n=>({type:"button",style:n===1?"primary":"secondary",
          ...(n===1?{color:"#7B1E1E"}:{}),
          action:{type:"message",label:`${n} 盒｜NT${(480*n).toLocaleString("en-US")}`,text:`丹參訂購｜${p.id}｜${n}`}})),
        {type:"button",style:"secondary",action:{type:"message",label:"其他數量洽客服",text:`丹參訂購｜${p.id}｜其他`}},
        {type:"button",style:"secondary",action:{type:"message",label:"重新選擇口味",text:"丹參茶包系列"}},
      ]},
    },
  };
}
function inquiry(id, amount) {
  const p=byId(id); if(!p)return null;
  const n=Number(amount);
  const valid=Number.isInteger(n)&&n>=1&&n<=99&&String(n)===String(amount);
  const quantity=valid ? `選購盒數：${n} 盒\n商品小計：NT${(n*480).toLocaleString("en-US")}（未含運費）`
    : `選購盒數：${amount==="其他"?"其他數量，待客服確認":"尚未指定，請向客服確認"}`;
  return `丹參茶包訂購詢問\n已選口味：${p.name}\n${priceText()}\n${quantity}\n請由人工確認庫存、運費及訂購方式；這不是已成立的訂單。`;
}
module.exports={IDS,PRICE,variants,byId,priceText,menu,chosen,quantityMenu,inquiry};
