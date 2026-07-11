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

source = source.replace(/const MASCOT_PATHS = \{[\s\S]*?\n\};/, mascotBlock);

const imageRouteCode = `
const sharp = require("sharp");
const mascotTiles = {
  welcome: [0, 0],
  products: [1, 0],
  recommend: [2, 0],
  combo: [3, 0],
  usage: [0, 1],
  faq: [2, 1],
  service: [3, 1],
  brand: [0, 0],
};
let mascotSpritePromise = null;
const mascotCache = new Map();
async function getMascotSprite() {
  if (!mascotSpritePromise) {
    mascotSpritePromise = fetch(SITE_URL + "images/brand/xianjiawei-web-scenes-v324.webp?v=324.2")
      .then((response) => {
        if (!response.ok) throw new Error("mascot sprite HTTP " + response.status);
        return response.arrayBuffer();
      })
      .then((buffer) => Buffer.from(buffer));
  }
  return mascotSpritePromise;
}
app.get("/mascot/:name.jpg", async (req, res) => {
  const name = String(req.params.name || "welcome");
  const tile = mascotTiles[name] || mascotTiles.welcome;
  try {
    if (!mascotCache.has(name)) {
      const sprite = await getMascotSprite();
      const metadata = await sharp(sprite).metadata();
      const tileWidth = Math.floor(metadata.width / 4);
      const tileHeight = Math.floor(metadata.height / 2);
      const output = await sharp(sprite)
        .extract({ left: tile[0] * tileWidth, top: tile[1] * tileHeight, width: tileWidth, height: tileHeight })
        .resize(1200, 900, { fit: "cover" })
        .jpeg({ quality: 88 })
        .toBuffer();
      mascotCache.set(name, output);
    }
    res.set("Cache-Control", "public, max-age=86400, immutable");
    res.type("image/jpeg").send(mascotCache.get(name));
  } catch (error) {
    mascotSpritePromise = null;
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
