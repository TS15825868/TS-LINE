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

async function postSigned(payload, {
  secret, transport = fetch, now = Date.now(),
  accessClientId = process.env.XJW_B2B_ACCESS_CLIENT_ID,
  accessClientSecret = process.env.XJW_B2B_ACCESS_CLIENT_SECRET,
}) {
  if (typeof secret !== "string" || secret.length < 32) return null;
  const hasAccessId = typeof accessClientId === "string" && accessClientId.trim().length > 0;
  const hasAccessSecret = typeof accessClientSecret === "string" && accessClientSecret.trim().length > 0;
  // Both credentials or neither: isolated transports need no Access token.
  // The production Access policy stays in force and rejects unauthenticated requests.
  if (hasAccessId !== hasAccessSecret) return null;
  const body = JSON.stringify(payload);
  const timestamp = String(now);
  const mac = createHmac("sha256", secret)
    .update(`xjw-b2b-intake-v1\nPOST\n${path}\n${timestamp}\n${body}`)
    .digest("hex");
  const headers = { "content-type": "application/json", "x-xjw-timestamp": timestamp, "x-xjw-signature": mac };
  if (hasAccessId && hasAccessSecret) {
    headers["CF-Access-Client-Id"] = accessClientId.trim();
    headers["CF-Access-Client-Secret"] = accessClientSecret.trim();
  }
  try {
    const response = await transport(originHost + path, {
      method: "POST", body, redirect: "error", signal: AbortSignal.timeout(5000), headers,
    });
    return { status: response.status, body: await response.json() };
  } catch {
    return null;
  }
}

async function sendInquiry(payload, options) {
  if (options.actorUserId && (typeof options.secret !== "string" || options.secret.length < 32)) return null;
  const input = options.actorUserId
    ? { action: "confirm-draft", actorKey: draftActorKey(options.secret, options.actorUserId), payload }
    : payload;
  const reply = await postSigned(input, options);
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

function draftActorKey(secret, userId) {
  return createHmac("sha256", secret).update("xjw-b2b-draft:" + userId).digest("hex");
}

async function accessDraft(action, userId, options, fields = {}) {
  if (!userId || typeof options.secret !== "string" || options.secret.length < 32) return null;
  const actorKey = draftActorKey(options.secret, userId);
  const receipt = await postSigned({ action, actorKey, ...fields }, options);
  return receipt?.status === 200 ? receipt.body : null;
}
module.exports = { prepareInquiry, sendInquiry, persistAndNotify, accessDraft };
