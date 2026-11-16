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

async function sendInquiry(payload, { secret, transport = fetch, now = Date.now() }) {
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
    if (response.status !== 200 && response.status !== 201) return null;
    const receipt = await response.json();
    if (receipt.id !== payload.id || receipt.duplicate !== (response.status === 200) ||
        !["pending", "sending", "sent", "uncertain"].includes(receipt.notificationStatus)) return null;
    return { id: receipt.id, duplicate: receipt.duplicate, notificationStatus: receipt.notificationStatus };
  } catch {
    return null;
  }
}

module.exports = { prepareInquiry, sendInquiry };
