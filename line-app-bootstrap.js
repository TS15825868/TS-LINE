"use strict";

/**
 * LINE OA Express bootstrap｜2026-08-10
 *
 * server.js historically creates its own Express app after loading line-image-safety.
 * The formal-media layer owns the latest user-approved DM -> LINE-compatible JPEG
 * routes, so install those routes at app creation time instead of merely exporting
 * an unused installImageRoutes() function.
 *
 * This is capability based: it does not care about old/new Rich Menu, copy, or UI
 * version strings. It only guarantees that the running Express app actually serves
 * the current formal media endpoints.
 */
const express = require("express");
const safety = require("./line-image-safety");

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
    version: "20260810-formal-media-route-bootstrap-v1",
    capability: "formal-dm-routes-mounted-on-runtime-app",
  });
}

module.exports = global.__XJW_LINE_EXPRESS_BOOTSTRAP__;
