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

const VERSION = "2026-10-26-authoritative-store-hours-v4";
const DATA_PATH = path.join(__dirname, "data.json");
const DEFAULT_ADDRESS_MESSAGE = "最新門市／自取資訊請先透過官方 LINE 確認";
const businessHours = require("./config/ecosystem-authority-v20260910.json")
  .lineBusinessProfile?.hours || {};
// Derive the public timetable from the current approved business profile,
// rather than baking a historical weekday time into LINE runtime defaults.
const weekdays = ["monday","tuesday","wednesday","thursday","friday"];
const weekdayHours = String(businessHours.monday || "10:00－20:00").trim();
const consistentWeekdays = weekdays.every(day=>String(businessHours[day]||"").trim()===weekdayHours);
const approvedWeekdayText = consistentWeekdays
  ? "週一至週五 "+weekdayHours
  : "平日營業時間請先向官方 LINE 確認";
const approvedSaturdayText = /預約/.test(String(businessHours.saturday||""))
  ? "週六彈性預約取貨／配送（請先洽 LINE）"
  : "週六請先向官方 LINE 確認";
const approvedSundayText = /公休|休息/.test(String(businessHours.sunday||""))
  ? "週日休息" : "週日請先向官方 LINE 確認";
const DEFAULT_HOURS = [approvedWeekdayText,approvedSaturdayText,approvedSundayText].join("；");
const DEFAULT_NOTE = "官方 LINE 可隨時留言；店休及非營業時間的訊息，將依實際情況回覆。週末如有配送、自取需求，也可先透過 LINE 詢問安排。";

// Reject only known stale overrides that contradict an explicitly current,
// approved business profile. Other newer custom schedules remain permitted.
// Updating approved weekday hours in the profile automatically updates
// this stale-override check as well.
function resolvePublicHours(environmentHours) {
  const candidate=String(environmentHours||"").trim();
  if (!candidate) return DEFAULT_HOURS;
  const normalize=value=>String(value||"").replace(/\s+/g,"")
    .replace(/[–—-]/g,"－");
  const flattened=normalize(candidate);
  const weekdayPattern=/週一至週五\d{1,2}:\d{2}－\d{1,2}:\d{2}/;
  if (consistentWeekdays && weekdayPattern.test(flattened) &&
      !flattened.includes(normalize(approvedWeekdayText))) return DEFAULT_HOURS;
  if (/預約/.test(String(businessHours.saturday||"")) &&
      /週六、週日休息|週六週日休息|週六及週日休息/.test(flattened))
    return DEFAULT_HOURS;
  return candidate;
}

if (!global.__XJW_STORE_LOCATION_POLICY__) {
  const previousReadFileSync = fs.readFileSync.bind(fs);
  const publicAddress = String(process.env.PUBLIC_STORE_ADDRESS || "").trim();
  const publicHours = resolvePublicHours(process.env.PUBLIC_STORE_HOURS);
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
    hoursSource: publicHours === DEFAULT_HOURS ? "approved-business-profile" : "PUBLIC_STORE_HOURS",
    resolvePublicHours,
  });
}

module.exports = global.__XJW_STORE_LOCATION_POLICY__;
