"use strict";
const catalog = require('./partner-inquiry-catalog.json');
const normalize = value => String(value || '').trim().replace(/\s+/g, '').replaceAll('台灣', '臺灣');

function findPartnerInquiry(text) {
  const key = normalize(text);
  if(!key || key.length > 100) return null;
  const exact = catalog.products.find(p => p.aliases.some(alias => normalize(alias) === key));
  if(exact) return exact;

  // 已核准成藥與使用者確認的合作食品，都先由仙加味接待報價、門市供貨等問題。
  // 只在帶有明確商品／供貨詢問時比對，避免把其他談話當成購買需求。
  if(!/請問|有賣|有貨|供貨|詢價|報價|價格|價錢|售價|多少錢|購買|下單|怎麼買|哪裡買|可以買|能買|到店|門市|詢問|想了解|如何買/.test(key))return null;
  const options = catalog.products
    .filter(p => p.medicine?.classification === 'licensed-traditional-medicine' || p.food?.classification === 'merchant-confirmed-food')
    .flatMap(p => p.aliases
      .map(alias => normalize(alias))
      .filter(alias => alias.length >= 3 && key.includes(alias))
      .map(alias => ({ p, len:alias.length })))
    .sort((a,b) => b.len - a.len);
  return options[0]?.p || null;
}
module.exports = { findPartnerInquiry };
