"use strict";

/**
 * 仙加味 LINE OA v288 全系列上架入口
 * 保留 v287 核心功能，統一補上開放下單、到貨與出貨提醒。
 */

const fs = require("fs");
const line = require("@line/bot-sdk");

const ORDER_NOTICE = "目前全系列已開放詢問與下單；產品盒裝到貨後，將依訂單順序確認並安排出貨。";

const originalReadFileSync = fs.readFileSync.bind(fs);
fs.readFileSync = function patchedReadFileSync(file, options, ...rest) {
  const result = originalReadFileSync(file, options, ...rest);
  if (!String(file || "").endsWith("data.json")) return result;

  try {
    const encoding = typeof options === "string" ? options : options?.encoding;
    const source = Buffer.isBuffer(result) ? result.toString(encoding || "utf8") : String(result);
    const data = JSON.parse(source);

    data.version = "v288";
    data.launchStatus = {
      orderOpen: true,
      statusLabel: "全系列已開放詢問與下單",
      shippingNotice: "產品盒裝到貨後，將依訂單順序確認並安排出貨。",
      customerReply: ORDER_NOTICE,
    };

    data.shippingNotes = data.shippingNotes || {};
    Object.keys(data.shippingNotes).forEach((key) => {
      const current = String(data.shippingNotes[key] || "");
      if (!current.includes("盒裝到貨後")) {
        data.shippingNotes[key] = `${current.replace(/。+$/, "")}。產品盒裝到貨後，將依訂單順序確認並安排出貨。`;
      }
    });

    data.products = (data.products || []).map((product) => ({
      ...product,
      orderStatus: "開放下單",
      shippingNotice: "盒裝到貨後依訂單順序確認並安排出貨。",
      description: String(product.description || "").includes("全系列已開放詢問與下單")
        ? product.description
        : `${String(product.description || "").replace(/。+$/, "")}。${ORDER_NOTICE}`,
    }));

    const json = JSON.stringify(data);
    return Buffer.isBuffer(result) && !encoding ? Buffer.from(json, "utf8") : json;
  } catch (error) {
    console.warn("v288 上架資料補強失敗，改用原始資料：", error.message);
    return result;
  }
};

const originalReplyMessage = line.Client.prototype.replyMessage;
line.Client.prototype.replyMessage = function patchedReplyMessage(replyToken, messages, ...rest) {
  const isArray = Array.isArray(messages);
  const list = isArray ? messages.slice() : [messages];
  const searchable = JSON.stringify(list);
  const related = /歡迎|產品|價格|優惠|購物車|結帳|付款|配送|下單|購買|出貨|到貨/.test(searchable);
  const alreadyHasNotice = searchable.includes("盒裝到貨後") || searchable.includes("全系列已開放詢問與下單");

  if (related && !alreadyHasNotice && list.length < 5) {
    list.push({
      type: "text",
      text: `${ORDER_NOTICE}\n\n可先選擇產品與數量完成訂購安排；實際出貨時間、配送方式與優惠由客服再協助確認。`,
      quickReply: {
        items: [
          { type: "action", action: { type: "postback", label: "看產品", data: "action=products" } },
          { type: "action", action: { type: "postback", label: "價格方案", data: "action=price_menu" } },
          { type: "action", action: { type: "postback", label: "購物車", data: "action=cart" } },
          { type: "action", action: { type: "message", label: "人工客服", text: "我要人工客服" } },
        ],
      },
    });
  }

  return originalReplyMessage.call(this, replyToken, isArray ? list : (list.length === 1 ? list[0] : list), ...rest);
};

require("./server-v287-core.js");
