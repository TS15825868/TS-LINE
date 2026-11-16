"use strict";
const { createHmac, randomUUID } = require("node:crypto");
const path = "/api/internal/business-inquiries";
const originHost = "https://xianjiawei-internal.tung314069.workers.dev";

function prepareInquiry(inquiry, verifiedOrigin) {
  inquiry.receiptPayload ??= {
    id: "B2B-" + randomUUID(),
    source: "LINE",
    receivedAt: new Date().toISOString(),
    category: inquiry.data.category,
    businessContact: inquiry.data.business,
    details: inquiry.data.details,
    origin: /^website:[a-z0-9_-]{1,48}$/.test(verifiedOrigin ?? "") ? verifiedOrigin : null,
  };
  return inquiry.receiptPayload;
}

async function postSigned(payload, { secret, transport = fetch, now = Date.now() }) {
  if (typeof secret !== "string" || secret.length < 32) return null;
  const body = JSON.stringify(payload);
  const timestamp = String(now);
  const mac = createHmac("sha256", secret)
    .update(`xjw-b2b-intake-v1\nPOST\n${path}\n${timestamp}\n${body}`)
    .digest("hex");
  try {
    const response = await transport(originHost + path, {
      method: "POST", body, redirect: "error", signal: AbortSignal.timeout(5000),
      headers: { "content-type": "application/json", "x-xjw-timestamp": timestamp, "x-xjw-signature": mac },
    });
    return { status: response.status, body: await response.json() };
  } catch {
    return null;
  }
}

async function sendInquiry(payload, options) {
  const reply = await postSigned(payload, options);
  if (!reply || ![200, 201].includes(reply.status)) return null;
  const receipt = reply.body;
  if (receipt?.id !== payload.id || receipt.duplicate !== (reply.status === 200) ||
      !["pending", "sending", "sent", "uncertain"].includes(receipt.notificationStatus)) return null;
  return { id: receipt.id, duplicate: receipt.duplicate, notificationStatus: receipt.notificationStatus };
}

async function persistAndNotify(inquiry, verifiedOrigin, notify, options) {
  const payload = prepareInquiry(inquiry, verifiedOrigin);
  const receipt = await sendInquiry(payload, options);
  if (!receipt || receipt.notificationStatus !== "pending") return receipt;
  const claimId = randomUUID();
  const claim = await postSigned({ action: "claim", id: payload.id, claimId }, options);
  if (claim?.status !== 200 || claim.body?.id !== payload.id ||
      claim.body.action !== "claim" || claim.body.applied !== true) return receipt;

  let outcome = "unknown";
  try { outcome = await notify() ? "delivered" : "rejected"; }
  catch { /* A transport error may have occurred after delivery. */ }
  const update = await postSigned({ action: "finish", id: payload.id, claimId, outcome }, options);
  if (update?.status === 200 && update.body?.id === payload.id &&
      update.body.action === "finish" && update.body.applied === true) {
    receipt.notificationStatus = { delivered: "sent", rejected: "pending", unknown: "uncertain" }[outcome];
  } else {
    receipt.notificationStatus = "uncertain";
  }
  return receipt;
}

module.exports = { prepareInquiry, sendInquiry, persistAndNotify };
