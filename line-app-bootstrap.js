"use strict";

/**
 * LINE OA Express bootstrap｜目前正式媒體版
 *
 * server.js 建立自己的 Express app；本 bootstrap 在 app 建立當下掛上：
 * - line-entry-trial-guard：最先載入、成為最內層 outbound guard，確保其他卡片規則跑完後，歡迎卡最後仍固定為申請試喝／看產品／幫我推薦。
 * - line-image-safety 正式產品／DM／試喝 JPEG 路由
 * - line-final-card-hero-guard：只補缺 hero，不覆蓋正式產品圖
 * - line-card-compact-guard：手機卡片瘦身與獨立試喝下單摘要
 * - line-product-card-action-guard：移除多餘照片跳轉、標示官網完整介紹；產品總覽與試喝保持分流
 * - line-owner-alert-runtime：人工客服需求可選擇推播到管理員私人 LINE
 */
const express = require("express");

// 重要：replyMessage 的 patch 是層層包裝。這支要最先載入，才能成為最內層，
// 讓其他 guard 先處理完 payload，最後才由歡迎卡 guard 固定三顆按鈕再送 LINE API。
require("./line-entry-trial-guard");

const safety = require("./line-image-safety");
const ownerAlert = require("./line-owner-alert-runtime");
require("./line-final-card-hero-guard");
require("./line-card-compact-guard");
require("./line-product-card-action-guard");

if (!global.__XJW_LINE_EXPRESS_BOOTSTRAP__) {
  const originalExpress = express;
  function xjwExpress(...args) {
    const app = originalExpress(...args);
    ownerAlert.install(app);
    safety.installImageRoutes(app);
    return app;
  }
  Object.assign(xjwExpress, originalExpress);
  xjwExpress.application = originalExpress.application;
  xjwExpress.request = originalExpress.request;
  xjwExpress.response = originalExpress.response;
  xjwExpress.Router = originalExpress.Router;
  xjwExpress.json = originalExpress.json;
  xjwExpress.raw = originalExpress.raw;
  xjwExpress.static = originalExpress.static;
  xjwExpress.text = originalExpress.text;
  xjwExpress.urlencoded = originalExpress.urlencoded;
  require.cache[require.resolve("express")].exports = xjwExpress;
  global.__XJW_LINE_EXPRESS_BOOTSTRAP__ = Object.freeze({
    installed: true,
    version: "current-separated-formal-media-route-bootstrap-v20260822-welcome-final-outbound",
    capability: "formal-media-routes-no-blank-hero-compact-mobile-cards-independent-trial-checkout-owner-alert-simplified-product-actions-and-final-welcome-trial-entry",
    ownerAlertVersion: ownerAlert.VERSION,
  });
}

module.exports = global.__XJW_LINE_EXPRESS_BOOTSTRAP__;
