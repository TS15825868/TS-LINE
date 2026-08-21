"use strict";

/**
 * LINE OA Express bootstrap｜目前正式媒體版
 *
 * server.js 建立自己的 Express app；本 bootstrap 在 app 建立當下掛上：
 * - line-image-safety 正式產品／DM／試喝 JPEG 路由
 * - line-final-card-hero-guard：只補缺 hero，不覆蓋正式產品圖
 * - line-card-compact-guard：手機卡片瘦身與獨立試喝下單摘要
 * - line-owner-alert-runtime：人工客服需求可選擇推播到管理員私人 LINE
 *
 * OWNER_LINE_USER_ID 未設定時，人工客服仍正常留在 LINE OA 聊天室；
 * 不會猜測或硬編碼任何私人 LINE User ID。
 */
const express = require("express");
const safety = require("./line-image-safety");
const ownerAlert = require("./line-owner-alert-runtime");
require("./line-final-card-hero-guard");
require("./line-card-compact-guard");

if (!global.__XJW_LINE_EXPRESS_BOOTSTRAP__) {
  const originalExpress = express;
  function xjwExpress(...args) {
    const app = originalExpress(...args);
    // 必須在 server.js 註冊 /webhook 之前掛上，才能在 LINE 簽章 middleware 通過後檢查人工客服觸發。
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
    version: "current-separated-formal-media-route-bootstrap-v20260821-compact-trial-owner-alert",
    capability: "formal-media-routes-plus-no-blank-hero-compact-mobile-cards-independent-trial-checkout-and-optional-owner-line-alert",
    ownerAlertVersion: ownerAlert.VERSION,
  });
}

module.exports = global.__XJW_LINE_EXPRESS_BOOTSTRAP__;
