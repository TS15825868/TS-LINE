"use strict";

/**
 * 仙加味 LINE OA｜門市地址單一來源政策
 *
 * 原則：
 * 1. 公開貼文、一般官網內容與 LINE 回覆預設不固定顯示實體門牌。
 * 2. 如需到店／自取，先由官方 LINE 確認最新安排，避免日後換址造成舊地址殘留。
 * 3. 未來若需要正式公開新地址，只需在 Render 設定 PUBLIC_STORE_ADDRESS；不必修改程式或舊貼文。
 * 4. 營業時間亦可由 PUBLIC_STORE_HOURS 單一環境值更新。
 */

const fs = require("fs");
const path = require("path");

const VERSION = "2026-09-16-store-location-policy-v1";
const DATA_PATH = path.join(__dirname, "data.json");
const DEFAULT_ADDRESS_MESSAGE = "最新門市／自取資訊請先透過官方 LINE 確認";
const DEFAULT_HOURS = "週一至週六 09:30–18:30";
const DEFAULT_NOTE = "如需到店／自取，請先透過官方 LINE 確認最新安排。";

if (!global.__XJW_STORE_LOCATION_POLICY__) {
  const previousReadFileSync = fs.readFileSync.bind(fs);
  const publicAddress = String(process.env.PUBLIC_STORE_ADDRESS || "").trim();
  const publicHours = String(process.env.PUBLIC_STORE_HOURS || DEFAULT_HOURS).trim();
  const publicNote = String(process.env.PUBLIC_STORE_NOTE || DEFAULT_NOTE).trim();

  fs.readFileSync = function xjwStoreLocationReadFileSync(file, ...args) {
    const result = previousReadFileSync(file, ...args);
    try {
      if (path.resolve(String(file)) !== DATA_PATH) return result;
      const encoding = typeof args[0] === "string" ? args[0] : args[0]?.encoding;
      const text = Buffer.isBuffer(result) ? result.toString(encoding || "utf8") : String(result);
      const data = JSON.parse(text);
      data.store = {
        ...(data.store || {}),
        publicAddressEnabled: Boolean(publicAddress),
        address: publicAddress || DEFAULT_ADDRESS_MESSAGE,
        hours: publicHours,
        holidayNote: publicNote,
        addressAuthority: publicAddress ? "PUBLIC_STORE_ADDRESS" : "line-confirmation-only",
      };
      return JSON.stringify(data, null, 2);
    } catch (error) {
      console.error("仙加味門市地址政策套用失敗：" + error.message);
      throw error;
    }
  };

  global.__XJW_STORE_LOCATION_POLICY__ = Object.freeze({
    installed: true,
    version: VERSION,
    publicAddressEnabled: Boolean(publicAddress),
    source: publicAddress ? "PUBLIC_STORE_ADDRESS" : "line-confirmation-only",
  });
}

module.exports = global.__XJW_STORE_LOCATION_POLICY__;
