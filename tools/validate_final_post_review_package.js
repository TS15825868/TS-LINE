"use strict";

const fs = require("node:fs");
const path = require("node:path");

const file = path.join(process.cwd(), "assets", "data", "final-post-review-package-2026-07-30.json");
if (!fs.existsSync(file)) throw new Error(`缺少正式貼文圖文核對總表：${file}`);

const data = JSON.parse(fs.readFileSync(file, "utf8"));
const posts = Array.isArray(data.posts) ? data.posts : [];
const failures = [];

if (data.manual_approval_required !== true) failures.push("人工審核閘門未啟用");
if (data.auto_publish !== false) failures.push("auto_publish 必須為 false");
if (data.publishable_now !== false) failures.push("publishable_now 必須為 false");
if (data.total_posts !== 15 || posts.length !== 15) failures.push(`正式貼文必須為15篇，目前總表${data.total_posts}、資料${posts.length}`);
if (data.verified_png_count !== 15) failures.push(`已核對圖片數必須為15，目前${data.verified_png_count}`);

const ids = new Set();
for (const post of posts) {
  const id = String(post.id || "");
  if (!/^\d{2}$/.test(id)) failures.push(`貼文 ID 格式錯誤：${id || "empty"}`);
  if (ids.has(id)) failures.push(`貼文 ID 重複：${id}`);
  ids.add(id);
  if (!post.title || !post.copy) failures.push(`貼文 ${id} 缺少標題或文案`);
  if (!/^[a-f0-9]{64}$/.test(String(post.image_sha256 || ""))) failures.push(`貼文 ${id} 圖片 SHA-256 格式錯誤`);
  if (post.status !== "pending_owner_approval") failures.push(`貼文 ${id} 未維持待老闆審核`);
  if (/NT\$|\$\s*\d|售價|優惠價|買\s*\d+\s*送\s*\d+/i.test(String(post.copy || ""))) failures.push(`貼文 ${id} 公開文案含價格或促銷`);
  if (/治療|療效|改善疾病|保證有效|治癒/.test(String(post.copy || ""))) failures.push(`貼文 ${id} 含療效宣稱`);
}

const policy = data.image_policy || {};
if (policy.official_original_images_only !== true) failures.push("未鎖定正式原圖");
if (policy.product_redraw_forbidden !== true) failures.push("未禁止重畫產品");
if (policy.package_or_label_change_forbidden !== true) failures.push("未禁止修改包裝或貼紙");
if (policy.traditional_chinese_only !== true) failures.push("未鎖定繁體中文");
if (policy.mascot !== "官網正式版仙加味小老闆") failures.push("小老闆角色規格不一致");
if (!Array.isArray(policy.partners) || !policy.partners.includes("小鹿娃娃") || !policy.partners.includes("小烏龜娃娃")) failures.push("缺少小鹿或小烏龜夥伴規格");

if (failures.length) throw new Error(`正式貼文圖文核對失敗：\n${failures.join("\n")}`);
console.log("PASS：15篇貼文文案、圖片校驗碼、角色與人工審核規則完整。");
