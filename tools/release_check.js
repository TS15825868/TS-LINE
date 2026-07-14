"use strict";

const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));
const data = JSON.parse(read("data.json"));
const server = read("server.js");
const pkg = JSON.parse(read("package.json"));
const errors = [];
const requiredProducts = ["guilu-gao", "guilu-drink-30", "guilu-drink-180", "guilu-tangkuai", "guilu-jiao", "luerong-fen"];
if (data.lineId !== "@762jybnm") errors.push("LINE ID 不正確");
if (!Array.isArray(data.products)) errors.push("products 必須是陣列");
for (const id of requiredProducts) {
  const product = (data.products || []).find((item) => item.id === id);
  if (!product) { errors.push(`缺少產品：${id}`); continue; }
  for (const field of ["name", "spec", "price", "unit", "image", "page", "usage", "ingredients"]) {
    if (product[field] === undefined || product[field] === null || product[field] === "") errors.push(`${id} 缺少 ${field}`);
  }
}
for (const token of ["process.env.CHANNEL_ACCESS_TOKEN", "process.env.CHANNEL_SECRET", "process.env.CRM_URL", "app.post(\"/webhook\"", "app.get(\"/healthz\"", "productCarousel()", "priceCarousel()", "cartFlex(state)", "startCheckout(state)", "doctorReferralReply()", "mascotWelcomeReply()"]) {
  if (!server.includes(token)) errors.push(`server.js 缺少必要功能：${token}`);
}
if (/channelAccessToken\s*:\s*["'][^"']{20,}/.test(server)) errors.push("server.js 疑似含硬編碼 access token");
if (/channelSecret\s*:\s*["'][^"']{10,}/.test(server)) errors.push("server.js 疑似含硬編碼 channel secret");
if (data.version !== "401.3") errors.push("data.json 版本未同步至 401.3");
if (data.catalogVersion !== "408.7") errors.push("官網素材版本未同步至 408.7");
if (data.lineBotVersion !== "v401.3") errors.push("LINE OA 版本未同步至 v401.3");
if (data.lineAssetsVersion !== "401.3") errors.push("小老闆素材版本未同步至 401.3");
if (data.runtime?.version !== "401.3") errors.push("中央 runtime 設定不正確");
if (!data.richMenu?.areas || data.richMenu.areas.length !== 6) errors.push("Rich Menu 設定未整合");
if (!data.mascotAssets?.images || Object.keys(data.mascotAssets.images).length !== 9) errors.push("小老闆素材清單未整合");
if ((data.products || []).length !== 6) errors.push("正式產品規格必須為六項");
for (const product of data.products || []) {
  if (!String(product.image || "").endsWith("?v=408.7")) errors.push(`${product.id} 產品圖版本不正確`);
  if (!String(product.dmImage || "").endsWith("?v=408.7")) errors.push(`${product.id} DM版本不正確`);
}
if (!server.includes('const VERSION = "v401.3";')) errors.push("server.js 版本不正確");
if (!server.includes('const MASCOT_VERSION = "401.3";')) errors.push("小老闆快取版本不正確");
if (pkg.version !== "4.1.3" || pkg.scripts?.start !== "node server.js") errors.push("package.json 未整合為單一主程式");
for (const obsolete of ["start.js", "no-collage-runtime.js", "deploy-version.json", "release-status.json", "rich-menu-actions.json", "mascot-manifest.json", "public/mascot/manifest.json", "tools/fix_line_aspectmode.js", "tools/fix_mascot_image_urls.js"]) {
  if (exists(obsolete)) errors.push(`應移除重複或舊檔：${obsolete}`);
}
if (errors.length) { console.error("LINE OA 正式上線檢查失敗：\n- " + errors.join("\n- ")); process.exit(1); }
console.log(`LINE OA v401.3 整合檢查通過：單一 server.js、中央 data.json、${data.products.length} 項產品、Webhook、購物車、結帳、CRM 與圖片政策正常。`);
