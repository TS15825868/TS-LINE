"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { prepareInquiry, sendInquiry } = require("./business-inquiry-intake.js");

test("retry preserves identity and time and the worker accepts the signed request", async () => {
  // The real ERP handler is available in a sibling checkout for integration runs.
  const { businessInquiryIntake } = await import("../erp/edge/business-inquiry-intake.mjs");
  const rows = new Map();
  const db = { prepare(sql) { return { bind(...args) { return { async first() {
    const [id, ...fields] = args;
    if (sql.includes("INSERT")) {
      if (rows.has(id)) return null;
      rows.set(id, fields);
      return { notification_status: "pending" };
    }
    return JSON.stringify(rows.get(id)) === JSON.stringify(fields) ? { notification_status: "pending" } : null;
  } }; } }; } };
  const secret = "isolated-test-key-not-a-real-credential";
  const inquiry = { data: { category: "經銷", business: "隔離測試", details: "測試需求" } };
  const payload = prepareInquiry(inquiry, null);
  const env = { DB: db, XJW_B2B_INTAKE_ENABLED: "true", XJW_B2B_INTAKE_SECRET: secret };
  let simulateLostResponse = true;
  const transport = async (url, options) => {
    const response = await businessInquiryIntake(new Request(url, options), env);
    if (simulateLostResponse) { simulateLostResponse = false; throw new Error("response lost"); }
    return response;
  };
  assert.equal(await sendInquiry(payload, { secret, transport }), null);
  assert.equal(prepareInquiry(inquiry, "website:home"), payload);
  assert.deepEqual(await sendInquiry(payload, { secret, transport }), {
    id: payload.id, duplicate: true, notificationStatus: "pending",
  });
  assert.equal(rows.size, 1);
});
