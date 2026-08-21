"use strict";

/**
 * LINE OA Express bootstrap｜目前正式媒體版
 *
 * server.js 建立自己的 Express app；本 bootstrap 在 app 建立當下掛上：
 * - line-image-safety 正式產品／DM／試喝 JPEG 路由
 * - line-final-card-hero-guard：只補缺 hero，不覆蓋正式產品圖
 * - line-card-compact-guard：手機卡片瘦身與獨立試喝下單摘要
 * - line-product-card-action-guard：移除多餘照片跳轉、標示官網完整介紹、30cc補試喝入口
 * - line-entry-trial-guard：一般入口歡迎卡第一層直接顯示申請試喝
 * - line-owner-alert-runtime：人工客服需求可選擇推播到管理員私人 LINE
 */
const express = require("express");
const safety = require("./line-image-safety");
const ownerAlert = require("./line-owner-alert-runtime");
require("./line-final-card-hero-guard");
require("./line-card-compact-guard");
require("./line-product-card-action-guard");
require("./line-entry-trial-guard");

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
    version: "current-separated-formal-media-route-bootstrap-v20260821-direct-trial-entry",
    capability: "formal-media-routes-no-blank-hero-compact-mobile-cards-independent-trial-checkout-owner-alert-simplified-product-actions-and-first-level-trial-entry",
    ownerAlertVersion: ownerAlert.VERSION,
  });
}

module.exports = global.__XJW_LINE_EXPRESS_BOOTSTRAP__;
