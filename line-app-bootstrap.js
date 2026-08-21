"use strict";

/**
 * LINE OA Express bootstrap｜目前正式媒體版
 *
 * server.js 建立自己的 Express app；本 bootstrap 在 app 建立當下掛上
 * line-image-safety 的目前正式媒體路由：
 * - /assets/formal-product/:id.jpg 產品介紹圖
 * - /assets/formal-dm/:id.jpg      詳細 DM
 * - /assets/formal-trial/trial.jpg 試喝海報
 *
 * 三種路由各自從目前正式 authority 取得來源並轉成 LINE 相容 JPEG，
 * products-v3 仍只作真實產品外觀／包裝／比例身份參考。
 *
 * 最後掛兩層手機顯示守門：
 * 1) line-final-card-hero-guard 只補缺 hero，不覆蓋正式產品圖。
 * 2) line-card-compact-guard 縮短 carousel 公開摘要，完整資料仍由完整介紹／產品頁承接。
 */
const express = require("express");
const safety = require("./line-image-safety");
require("./line-final-card-hero-guard");
require("./line-card-compact-guard");

if (!global.__XJW_LINE_EXPRESS_BOOTSTRAP__) {
  const originalExpress = express;
  function xjwExpress(...args) {
    const app = originalExpress(...args);
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
    version: "current-separated-formal-media-route-bootstrap-v20260821-compact-mobile-cards",
    capability: "formal-media-routes-plus-no-blank-hero-and-compact-mobile-carousel-guards",
  });
}

module.exports = global.__XJW_LINE_EXPRESS_BOOTSTRAP__;
