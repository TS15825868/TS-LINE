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
  // Render prestart 會從官網重建詢價目錄；來源目錄刻意不帶售價。
  // 價格的唯一權威是使用者核准的零售價母檔，而非同步詢價檔的 price 欄位。
  const items = IDS.map(id => source.products.find(p => p.id === id));
  if (PRICE !== 480 || items.some(p =>
    !p || !p.name || !p.publicPage ||
    (p.price != null && Number(p.price) !== PRICE)
  )) {
    throw new Error("丹參茶包六種口味的核准單盒價格或品項資料異常，暫停該款選購");
  }
  return items.map(p => ({ ...p, price: PRICE }));
}
function byId(id) { return variants().find(p => p.id === id) || null; }
function priceText() { return "每盒 NT$480｜3g×10包"; }
function menu() {
  // LINE 在 iPhone 上六個直排 Flex footer 按鈕會只顯示前三項。
  // 拆成兩則各三個選項的 Flex 訊息，避免需要猜測隱藏按鈕或左右滑動才能看齊六款。
  const items=variants();
  return [0,3].map((start,index)=>({
    type:"flex",
    altText:`丹參茶包選口味 ${index+1}/2｜每盒 NT$480`,
    contents:{
      type:"bubble",size:"kilo",
      body:{type:"box",layout:"vertical",spacing:"sm",contents:[
        {type:"text",text:`丹參茶包｜六款口味（${index+1}/2）`,weight:"bold",size:"lg",color:"#7B1E1E",wrap:true},
        {type:"text",text:priceText(),size:"sm",color:"#333333",wrap:true},
        {type:"text",text:index===0
          ?"請選擇喜歡的口味。第一張有 3 款，下一張還有 3 款。"
          :"另外 3 款口味也在這裡，點選即可查看並選擇盒數。",size:"sm",color:"#555555",wrap:true},
      ]},
      footer:{type:"box",layout:"vertical",spacing:"sm",contents:items.slice(start,start+3).map((p,i)=>({
        type:"button",style:i===0?"primary":"secondary",
        ...(i===0?{color:"#7B1E1E"}:{}),
        action:{type:"message",label:p.name,text:`選擇丹參口味｜${p.id}`},
      }))},
    },
  }));
}
function chosen(id,absoluteUrl) {
  const p=byId(id); if(!p)return null;
  return {
    type:"flex",altText:`已選：${p.name}｜一盒 NT$480`,
    contents:{type:"bubble",size:"kilo",
      body:{type:"box",layout:"vertical",spacing:"md",contents:[
        {type:"text",text:p.name,weight:"bold",size:"xl",color:"#7B1E1E",wrap:true},
        {type:"text",text:priceText(),size:"md",wrap:true},
        {type:"text",text:"已選擇此口味。接著選擇盒數，或查看原廠商品介紹。",size:"sm",wrap:true,color:"#555555"},
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
  // 六顆直排按鈕在 iPhone 被截斷，分成兩則各三顆，確保四種盒數與客服入口都可見。
  const actions=[
    ...[1,2,3,5].map(n=>({type:"message",label:`${n} 盒｜NT$${(480*n).toLocaleString("en-US")}`,text:`丹參訂購｜${p.id}｜${n}`})),
    {type:"message",label:"其他數量請洽客服",text:`丹參訂購｜${p.id}｜其他`},
    {type:"message",label:"重新選口味",text:"丹參茶包系列"},
  ];
  return [0,3].map((start,index)=>({
    type:"flex",altText:`${p.name}｜選擇盒數（${index+1}/2）`,
    contents:{type:"bubble",size:"kilo",
      body:{type:"box",layout:"vertical",spacing:"sm",contents:[
        {type:"text",text:p.name,weight:"bold",size:"lg",color:"#7B1E1E",wrap:true},
        {type:"text",text:priceText(),size:"sm",wrap:true},
        {type:"text",text:index===0
          ?"選擇 1、2、3 盒；下一則還有 5 盒及其他數量。"
          :"選擇 5 盒、其他數量，或重新選擇口味。金額為商品小計，運費及現貨由客服確認。",size:"sm",wrap:true,color:"#555555"},
      ]},
      footer:{type:"box",layout:"vertical",spacing:"sm",contents:actions.slice(start,start+3).map((action,i)=>({
        type:"button",style:index===0&&i===0?"primary":"secondary",
        ...(index===0&&i===0?{color:"#7B1E1E"}:{}),action,
      }))},
    },
  }));
}
function inquiry(id, amount) {
  const p=byId(id); if(!p)return null;
  const n=Number(amount);
  const valid=Number.isInteger(n)&&n>=1&&n<=99&&String(n)===String(amount);
  const quantity=valid ? `選購盒數：${n} 盒\n商品小計：NT${String.fromCharCode(36)+(n*480).toLocaleString("en-US")}（未含運費）`
    : `選購盒數：${amount==="其他"?"其他數量，待客服確認":"尚未指定，請向客服確認"}`;
  return `丹參茶包訂購詢問\n已選口味：${p.name}\n${priceText()}\n${quantity}\n請由人工確認庫存、運費及訂購方式；這不是已成立的訂單。`;
}
module.exports={IDS,PRICE,variants,byId,priceText,menu,chosen,quantityMenu,inquiry};
