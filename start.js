"use strict";

const fs = require("fs");
const path = require("path");
const Module = require("module");

const sourcePath = path.join(__dirname, "server.js");
let source = fs.readFileSync(sourcePath, "utf8");

const mascotBlock = `const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || "").replace(/\\/$/, "");
const MASCOT_VERSION = "325.1";
const SHARED_MASCOT_BASE = "https://ts15825868.github.io/xianjiawei/images/line-mascot";
const sharedMascotUrl = (name) => \`${"${SHARED_MASCOT_BASE}"}/xianjiawei-mascot-line-${"${name}"}.jpg?v=${"${MASCOT_VERSION}"}\`;
const mascotUrl = (name) => PUBLIC_BASE_URL
  ? \`${"${PUBLIC_BASE_URL}"}/mascot/${"${name}"}.jpg?v=${"${MASCOT_VERSION}"}\`
  : sharedMascotUrl(name);
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
const mascotNames = new Set(["welcome", "products", "recommend", "combo", "usage", "faq", "service", "brand"]);
const mascotProxyCache = new Map();
app.get("/mascot/:name.jpg", async (req, res) => {
  const requested = String(req.params.name || "welcome");
  const name = mascotNames.has(requested) ? requested : "welcome";
  try {
    if (!mascotProxyCache.has(name)) {
      const url = sharedMascotUrl(name);
      const response = await fetch(url, { headers: { accept: "image/jpeg,image/*" } });
      if (!response.ok) throw new Error("mascot HTTP " + response.status);
      const contentType = response.headers.get("content-type") || "image/jpeg";
      const buffer = Buffer.from(await response.arrayBuffer());
      if (!buffer.length) throw new Error("empty mascot image");
      mascotProxyCache.set(name, { buffer, contentType });
    }
    const cached = mascotProxyCache.get(name);
    res.set("Cache-Control", "public, max-age=3600");
    res.type(cached.contentType).send(cached.buffer);
  } catch (error) {
    console.error("小老闆圖片代理失敗：" + error.message);
    res.redirect(302, sharedMascotUrl(name));
  }
});
`;

source = source.replace(
  "const port = process.env.PORT || 3000;",
  imageRouteCode + "\nconst port = process.env.PORT || 3000;"
);
source = source.replace('const VERSION = "v312.0";', 'const VERSION = "v325.1";');
source = source.replace("if (require.main === module) {", "if (true) {");

const runtimeModule = new Module(path.join(__dirname, ".runtime-server.js"), module);
runtimeModule.filename = path.join(__dirname, ".runtime-server.js");
runtimeModule.paths = Module._nodeModulePaths(__dirname);
runtimeModule._compile(source, runtimeModule.filename);
