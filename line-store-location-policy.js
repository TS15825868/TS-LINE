"use strict";

// Approved public service policy. Environment values are retained for internal
// configuration but cannot override the current non-storefront public policy.
const fs = require("fs");
const path = require("path");
const VERSION = "2026-11-28-line-public-service-v14";
const DATA_PATH = path.join(__dirname, "data.json");
const authority = require("./config/ecosystem-authority-v20260910.json");
const service = authority.serviceHours;
const profile = authority.lineBusinessProfile;
if (service?.publicMode !== "line_individual_confirmation" || service.publicStorefrontHours !== false ||
    profile?.publicMode !== service.publicMode || service.storefront !== null || service.closed !== null) {
  throw Error("LINE public service authority needs verification");
}
const DEFAULT_ADDRESS_MESSAGE = "我們位於台北萬華，商品諮詢、訂購及配送皆可透過官方 LINE 聯繫。";
const DEFAULT_HOURS = String(service.lineOA);
const DEFAULT_NOTE = String(service.weekendFulfillment);
function resolvePublicHours(_environmentHours) {
  return DEFAULT_HOURS;
}
if (!global.__XJW_STORE_LOCATION_POLICY__) {
  const previousReadFileSync = fs.readFileSync.bind(fs);
  fs.readFileSync = function xjwStoreLocationReadFileSync(file, ...args) {
    const result = previousReadFileSync(file, ...args);
    try {
      if (path.resolve(String(file)) !== DATA_PATH) return result;
      const encoding = typeof args[0] === "string" ? args[0] : args[0]?.encoding;
      const text = Buffer.isBuffer(result) ? result.toString(encoding || "utf8") : String(result);
      const data = JSON.parse(text);
      data.store = {
        ...(data.store || {}),
        publicAddressEnabled: false,
        address: DEFAULT_ADDRESS_MESSAGE,
        hours: resolvePublicHours(process.env.PUBLIC_STORE_HOURS),
        holidayNote: DEFAULT_NOTE,
        addressAuthority: "line-confirmation-only",
      };
      const output = JSON.stringify(data, null, 2);
      return Buffer.isBuffer(result) ? Buffer.from(output, encoding || "utf8") : output;
    } catch (error) {
      console.error("仙加味公開服務政策套用失敗：" + error.message);
      throw error;
    }
  };
  global.__XJW_STORE_LOCATION_POLICY__ = Object.freeze({
    installed: true, version: VERSION, publicAddressEnabled: false,
    source: "line-confirmation-only", hoursSource: "approved-business-profile", resolvePublicHours,
  });
}
module.exports = global.__XJW_STORE_LOCATION_POLICY__;
