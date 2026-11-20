"use strict";
// Existing signed B2B intake also accepts merchant purchase quotations.
// A quotation is NOT a retail order, confirmed sale, payment or CRM transaction.
// Only validate and map already provided fields; no network call or persistence here.
const MAX_ITEMS=240;
const MAX_DELIVERY=110;
function merchantToBusinessInquiry(data) {
  const contact=typeof data?.contact==="string"?data.contact.trim():"";
  const items=typeof data?.items==="string"?data.items.trim():"";
  const delivery=typeof data?.delivery==="string"?data.delivery.trim():"";
  if (contact.length<4 || contact.length>240 ||
      items.length<4 || items.length>MAX_ITEMS ||
      !delivery || delivery.length>MAX_DELIVERY) return null;
  const details="商品與預估數量："+items+"\n交貨及其他需求："+delivery;
  if (details.length>400) return null;
  return {data:{category:"批發採購",business:contact,details}};
}
module.exports={merchantToBusinessInquiry,MAX_ITEMS,MAX_DELIVERY};
