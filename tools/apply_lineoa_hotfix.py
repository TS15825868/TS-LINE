from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
server_path = ROOT / "server.js"
safety_path = ROOT / "line-image-safety.js"
package_path = ROOT / "package.json"

server = server_path.read_text(encoding="utf-8")

if 'require("./line-image-safety");' not in server:
    server = server.replace('"use strict";\n', '"use strict";\n\n// Always install the LINE image safety layer, even when Render overrides npm start.\nrequire("./line-image-safety");\n', 1)

server = server.replace('const VERSION = "v401.5";', 'const VERSION = "v401.6";')
server = server.replace('const MASCOT_VERSION = "401.5";', 'const MASCOT_VERSION = "401.6-20260714";')

old_asset_block = '''const mascotAssetUrl = (name) => PUBLIC_BASE_URL
  ? `${PUBLIC_BASE_URL}/mascot/${name}.jpg?v=${MASCOT_VERSION}`
  : `https://raw.githubusercontent.com/TS15825868/TS-LINE/main/public/mascot/${name}.jpg?v=${MASCOT_VERSION}`;
app.use("/mascot", express.static(path.join(__dirname, "public", "mascot"), { maxAge: "7d", immutable: true }));'''
new_asset_block = '''// LINE fetches images independently from the webhook. Use GitHub's CDN instead of
// the sleeping Render instance so image cards appear faster and cache busting is reliable.
const mascotAssetUrl = (name) =>
  `https://raw.githubusercontent.com/TS15825868/TS-LINE/main/public/mascot/${name}.jpg?v=${MASCOT_VERSION}`;
app.use("/mascot", express.static(path.join(__dirname, "public", "mascot"), {
  maxAge: "1h",
  immutable: false,
  etag: true,
}));'''
if old_asset_block in server:
    server = server.replace(old_asset_block, new_asset_block)

server_path.write_text(server, encoding="utf-8")

safety = '''"use strict";

/**
 * LINE OA image safety layer.
 *
 * The current recommend/usage mascot images are known collage drafts and are not
 * approved for production. Remove those hero images at send time regardless of
 * whether Render starts through npm or directly with `node server.js`.
 */

const line = require("@line/bot-sdk");

const BLOCKED_MASCOT_ASSETS = [
  "/mascot/recommend.jpg",
  "/mascot/usage.jpg",
];

function isBlockedMascotUrl(value) {
  const url = String(value || "");
  return BLOCKED_MASCOT_ASSETS.some((asset) => url.includes(asset));
}

function removeBlockedHeroes(node) {
  if (!node || typeof node !== "object") return node;

  if (Array.isArray(node)) {
    for (const item of node) removeBlockedHeroes(item);
    return node;
  }

  if (node.type === "bubble" && node.hero?.type === "image" && isBlockedMascotUrl(node.hero.url)) {
    delete node.hero;
  }

  for (const value of Object.values(node)) removeBlockedHeroes(value);
  return node;
}

const Client = line?.messagingApi?.MessagingApiClient;
if (Client?.prototype?.replyMessage && !Client.prototype.__xjwImageSafetyInstalled) {
  const originalReplyMessage = Client.prototype.replyMessage;

  Client.prototype.replyMessage = function patchedReplyMessage(payload) {
    removeBlockedHeroes(payload?.messages);
    return originalReplyMessage.call(this, payload);
  };

  Object.defineProperty(Client.prototype, "__xjwImageSafetyInstalled", {
    value: true,
    enumerable: false,
  });
}

module.exports = {
  BLOCKED_MASCOT_ASSETS,
  isBlockedMascotUrl,
  removeBlockedHeroes,
};
'''
safety_path.write_text(safety, encoding="utf-8")

package = json.loads(package_path.read_text(encoding="utf-8"))
package["version"] = "4.3.2"
package.setdefault("scripts", {})["start"] = "node -r ./line-image-safety.js social-server.js"
package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
