"use strict";

const assert = require("assert");
const {
  FONT_URL,
  ensureFont,
  renderCardSvg,
} = require("./knowledge-card-server");

(async () => {
  assert.ok(FONT_URL.includes("SourceHanSansTW-Regular.otf"));
  const font = await ensureFont();
  assert.ok(font.endsWith("SourceHanSansTW-Regular.otf"));

  const svg = await renderCardSvg("units");
  assert.ok(typeof svg === "string" && svg.length > 100000, "embedded glyph SVG is unexpectedly small");
  assert.ok(svg.includes("<path"), "knowledge card must contain embedded glyph paths");
  assert.ok(!svg.includes("<text"), "knowledge card must not depend on runtime system fonts");
  assert.ok(svg.includes("1080") && svg.includes("1350"), "knowledge card size must remain 1080x1350");
  console.log("PASS Traditional Chinese knowledge card text embedded as glyph paths");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
