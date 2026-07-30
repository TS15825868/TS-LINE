const fs = require('node:fs');

const manifestPath = 'assets/data/final-post-image-archive-manifest-2026-07-30.json';
const reviewPath = 'assets/data/final-post-review-package-2026-07-30.json';
const registryPath = 'assets/data/post-approval-registry-2026-07-30.json';

for (const path of [manifestPath, reviewPath, registryPath]) {
  if (!fs.existsSync(path)) throw new Error(`缺少必要檔案：${path}`);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const review = JSON.parse(fs.readFileSync(reviewPath, 'utf8'));
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

const sha256 = /^[a-f0-9]{64}$/;
const ids = Array.from({ length: 15 }, (_, i) => String(i + 1).padStart(2, '0'));
const entries = Array.isArray(manifest.entries) ? manifest.entries : [];
const posts = Array.isArray(review.posts) ? review.posts : [];
const registryRows = [
  ...(Array.isArray(registry.product_posts) ? registry.product_posts : []),
  ...(Array.isArray(registry.lifestyle_posts) ? registry.lifestyle_posts : []),
];

if (manifest.total_posts !== 15 || entries.length !== 15) throw new Error('封存清單必須完整包含15篇貼文');
if (manifest.product_post_images !== 6 || manifest.lifestyle_post_images !== 9) throw new Error('封存清單圖片分類數量必須為產品6張、生活9張');
if (manifest.total_files !== 52) throw new Error(`封存檔案總數應為52，目前${manifest.total_files}`);
if (!sha256.test(manifest.archive_sha256 || '')) throw new Error('ZIP SHA-256 格式錯誤');

for (const doc of [manifest, review, registry]) {
  if (doc.manual_approval_required !== true) throw new Error('人工審核閘門未啟用');
  if (doc.auto_publish !== false || doc.publishable_now !== false) throw new Error('未核准貼文不得排程或發布');
}

const manifestIds = entries.map((row) => row.id);
if (new Set(manifestIds).size !== 15 || ids.some((id) => !manifestIds.includes(id))) throw new Error('封存清單貼文ID不完整或重複');

const reviewById = new Map(posts.map((row) => [row.id, row]));
const registryById = new Map(registryRows.map((row) => [row.id, row]));

for (const entry of entries) {
  if (!['product', 'lifestyle'].includes(entry.type)) throw new Error(`貼文類型錯誤：${entry.id}`);
  if (!entry.folder || !entry.image || !entry.copy) throw new Error(`封存路徑資料不完整：${entry.id}`);
  if (!sha256.test(entry.image_sha256 || '')) throw new Error(`圖片 SHA-256 格式錯誤：${entry.id}`);
  if (!/不得修改\.png$/.test(entry.image)) throw new Error(`圖片檔名未標示不得修改：${entry.id}`);
  if (entry.copy !== '貼文文案.txt') throw new Error(`文案檔名錯誤：${entry.id}`);

  const post = reviewById.get(entry.id);
  const reg = registryById.get(entry.id);
  if (!post || !reg) throw new Error(`貼文未在審核總表或核准登錄檔中找到：${entry.id}`);
  if (post.type !== entry.type) throw new Error(`貼文類型對照不一致：${entry.id}`);
  if (post.image_sha256 !== entry.image_sha256) throw new Error(`圖片 SHA-256 對照不一致：${entry.id}`);
  if (post.status !== 'pending_owner_approval' || reg.status !== 'pending_owner_approval') throw new Error(`貼文未維持待老闆審核：${entry.id}`);
}

const productCount = entries.filter((row) => row.type === 'product').length;
const lifestyleCount = entries.filter((row) => row.type === 'lifestyle').length;
if (productCount !== 6 || lifestyleCount !== 9) throw new Error('封存清單實際分類數量不一致');

console.log('PASS：15篇貼文封存清單、圖片SHA-256、文案總表及人工審核登錄檔完全一致。');
