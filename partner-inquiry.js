"use strict";
const catalog = require('./partner-inquiry-catalog.json');
const normalize = value => String(value || '').trim().replace(/\s+/g, '').replaceAll('台灣', '臺灣');
function findPartnerInquiry(text) {
  const key = normalize(text);
  return catalog.products.find(p => p.aliases.some(alias => normalize(alias) === key)) || null;
}
module.exports = { findPartnerInquiry };
