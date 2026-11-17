"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const { accessDraft, prepareInquiry, persistAndNotify } = require("./business-inquiry-intake");
const secret = "isolated-hmac-key-not-a-real-credential";
const accessClientId = "test-client-id";
const accessClientSecret = "test-client-secret";
const now = 1760000000000;
const opts = { secret, accessClientId, accessClientSecret, now };
const inquiry = () => ({ data: { category: "經銷", business: "隔離測試", details: "隔離需求" } });
function checkRequest(url, init) {
  assert.equal(url, "https://xianjiawei-internal.tung314069.workers.dev/api/internal/business-inquiries");
  assert.equal(init.method, "POST");
  assert.equal(init.redirect, "error");
  assert.equal(init.headers["CF-Access-Client-Id"], accessClientId);
  assert.equal(init.headers["CF-Access-Client-Secret"], accessClientSecret);
  assert.equal(init.headers["x-xjw-timestamp"], String(now));
  assert.equal(init.headers["x-xjw-signature"], createHmac("sha256", secret).update(`xjw-b2b-intake-v1\nPOST\n/api/internal/business-inquiries\n${now}\n${init.body}`).digest("hex"));
  assert.equal(init.body.includes(accessClientSecret), false);
}
test("every signed draft, confirmation, claim and finish carries Access credentials without changing the HMAC", async () => {
  const i = inquiry();
  const payload = prepareInquiry(i, null);
  const actions = [];
  const transport = async (url, init) => {
    checkRequest(url, init);
    const b = JSON.parse(init.body);
    actions.push(b.action);
    if (b.action === "save-draft") return Response.json({ id: payload.id });
    if (b.action === "confirm-draft") return Response.json({ id: payload.id, duplicate: false, notificationStatus: "pending" }, { status: 201 });
    return Response.json({ id: payload.id, action: b.action, applied: true });
  };
  assert.deepEqual(await accessDraft("save-draft", "isolated-user", { ...opts, transport }, { payload }), { id: payload.id });
  const result = await persistAndNotify(i, null, async () => true, { ...opts, actorUserId: "isolated-user", transport });
  assert.equal(result.notificationStatus, "sent");
  assert.deepEqual(actions, ["save-draft", "confirm-draft", "claim", "finish"]);
});
test("partial Access configuration fails before transport", async () => {
  let calls = 0;
  const transport = async () => { calls++; throw Error("must not send"); };
  for (const options of [{ ...opts, accessClientId: "" }, { ...opts, accessClientSecret: "" }]) {
    assert.equal(await accessDraft("load-draft", "isolated-user", { ...options, transport }), null);
  }
  assert.equal(calls, 0);
});
test("isolated transport without an Access token retains HMAC and sends no Access headers", async () => {
  const result = await accessDraft("load-draft", "isolated-user", { secret, now, accessClientId: "", accessClientSecret: "", transport: async (_url, init) => {
    assert.equal(init.headers["CF-Access-Client-Id"], undefined);
    assert.equal(init.headers["CF-Access-Client-Secret"], undefined);
    assert.match(init.headers["x-xjw-signature"], /^[a-f0-9]{64}$/);
    return Response.json({ payload: null });
  } });
  assert.deepEqual(result, { payload: null });
});

test("readiness requires Access credentials, signs a fresh nonce, and rejects mismatched acknowledgments", async () => {
  const { probeReadiness } = require("./business-inquiry-intake");
  let calls = 0;
  const transport = async (url, init) => {
    calls++;
    checkRequest(url, init);
    assert.equal(init.headers["x-xjw-readiness"], "1");
    const payload = JSON.parse(init.body);
    assert.equal(payload.action, "readiness");
    assert.match(payload.nonce, /^[a-f0-9]{32}$/);
    return Response.json({ok:true, action:"readiness", nonce:payload.nonce, version:"xjw-b2b-intake-v1", enabled:false});
  };
  assert.deepEqual(await probeReadiness({...opts, transport}), {verified:true,intakeEnabled:false});
  assert.deepEqual(await probeReadiness({...opts, accessClientId:"", transport}), {verified:false});
  assert.equal(calls,1);
  const wrong = await probeReadiness({...opts, transport:async()=>Response.json({ok:true,action:"readiness",nonce:"wrong",version:"xjw-b2b-intake-v1",enabled:false})});
  assert.equal(wrong.verified,false);
});
