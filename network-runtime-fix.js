"use strict";

const dns = require("dns");

// Render/Node 22 may resolve an unreachable IPv6 address before IPv4.
// Prefer IPv4 first for Supabase and remote asset requests while retaining
// normal dual-stack fallback behavior.
try {
  dns.setDefaultResultOrder("ipv4first");
} catch (error) {
  console.warn("Unable to set DNS result order", error.message);
}

module.exports = { version: "2026-07-26-ipv4-first-v1" };
