"use strict";

const fs = require("fs");
const path = require("path");
const Module = require("module");

const sourcePath = path.join(__dirname, "server.js");
let source = fs.readFileSync(sourcePath, "utf8");

const mascotBlock = `const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || "").replace(/\\/$/, "");
const mascotUrl = (name) => PUBLIC_BASE_URL ? \`${"${PUBLIC_BASE_URL}"}/mascot/${"${name}"}.jpg?v=325.0\` : \`https://ts15825868.github.io/xianjiawei/images/line-mascot/xianjiawei-mascot-line-${"${name}"}.jpg?v=325.0\`;
const MASCOT_PATHS = {
  welcome: mascotUrl("welcome"),
  products: mascotUrl("products"),
  recommend: mascotUrl("recommend"),
  combo: mascotUrl("combo"),
  usage: mascotUrl("usage"),
  faq: mascotUrl("faq"),
  service: mascotUrl("service"),
  brand: mascotUrl("brand"),
};`;

source = source.replace(
  /const MASCOT_PATHS = \{[\s\S]*?\n\};/,
  mascotBlock
);

const imageRouteCode = `
const sharp = require("sharp");
const mascotSources = {
  welcome: "website-mascot-home.svg",
  products: "website-mascot-products.svg",
  recommend: "website-mascot-choose.svg",
  combo: "website-mascot-combo.svg",
  usage: "website-mascot-guide.svg",
  faq: "website-mascot-faq.svg",
  service: "website-mascot-contact.svg",
  brand: "website-mascot-home.svg",
};
const mascotCache = new Map();
app.get("/mascot/:name.jpg", async (req, res) => {
  const name = String(req.params.name || "welcome");
  const file = mascotSources[name] || mascotSources.welcome;
  try {
    if (!mascotCache.has(file)) {
      const response = await fetch(SITE_URL + "images/brand/" + file + "?v=324.2");
      if (!response.ok) throw new Error("mascot source HTTP " + response.status);
      const input = Buffer.from(await response.arrayBuffer());
      const output = await sharp(input).resize(1200, 900, { fit: "cover" }).jpeg({ quality: 88 }).toBuffer();
      mascotCache.set(file, output);
    }
    res.set("Cache-Control", "public, max-age=86400, immutable");
    res.type("image/jpeg").send(mascotCache.get(file));
  } catch (error) {
    console.error("小老闆圖片轉換失敗：" + error.message);
    res.redirect(302, SITE_URL + "images/brand/xianjiawei-scene-guide.jpg?v=324.2");
  }
});
`;

source = source.replace("const port = process.env.PORT || 3000;", imageRouteCode + "\nconst port = process.env.PORT || 3000;");
source = source.replace('const VERSION = "v312.0";', 'const VERSION = "v325.0";');
source = source.replace("if (require.main === module) {", "if (true) {");

const runtimeModule = new Module(path.join(__dirname, ".runtime-server.js"), module);
runtimeModule.filename = path.join(__dirname, ".runtime-server.js");
runtimeModule.paths = Module._nodeModulePaths(__dirname);
runtimeModule._compile(source, runtimeModule.filename);
