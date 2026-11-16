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

test("notification waits for persistence and a signed claim; ambiguous delivery is held", async () => {
  const { persistAndNotify } = require("./business-inquiry-intake.js");
  const { businessInquiryIntake } = await import("../erp/edge/business-inquiry-intake.mjs");
  const { businessInquirySchema } = await import("../erp/edge/business-inquiries.mjs");
  const { DatabaseSync } = require("node:sqlite");
  const sqlite = new DatabaseSync(":memory:");
  try {
    sqlite.exec(businessInquirySchema);
    const db = { prepare: sql => ({ bind: (...args) => ({ first: async () => sqlite.prepare(sql).get(...args) }) }) };
    const secret = "isolated-test-key-not-a-real-credential";
    const options = { secret, transport: (url, init) => businessInquiryIntake(new Request(url, init), { DB: db, XJW_B2B_INTAKE_ENABLED: "true", XJW_B2B_INTAKE_SECRET: secret }) };
    const inquiry = { data: { category: "經銷", business: "隔離測試", details: "測試需求" } };
    let attempts = 0;
    const notify = async () => {
      attempts++;
      assert.equal(sqlite.prepare("SELECT notification_status FROM business_inquiries").get()?.notification_status, "sending");
      throw new Error("mock ambiguous delivery");
    };
    const receipt = await persistAndNotify(inquiry, null, notify, options);
    assert.equal(receipt.notificationStatus, "uncertain");
    assert.equal((await persistAndNotify(inquiry, null, notify, options)).notificationStatus, "uncertain");
    assert.equal(attempts, 1);
    assert.equal(await persistAndNotify(inquiry, null, notify, { ...options, secret: "invalid" }), null);
    assert.equal(attempts, 1);
  } finally { sqlite.close(); }
});
