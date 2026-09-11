'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PUBLIC_IDS = ['guilu-gao','guilu-drink-30','guilu-drink-180','guilu-tangkuai','guilu-jiao','luerong-fen'];
const DEFERRED_ID = 'qixuan-guilu-drink-powder';

// 只掃真正會形成 LINE 顧客資料／公開貼文的 payload。
// 程式碼內可以合法保留「舊字串 -> 新字串」轉換規則，不應因為看見舊字串本身就判失敗。
const ACTIVE_PUBLIC_FILES = [
  'assets/data/official-products.json',
  'data.json',
  'approved-post-library.js',
  'approved-post-static.js',
];

const STALE_PUBLIC_LITERALS = [
  '台興山產',
  '30cc玻璃瓶',
  '30cc 玻璃瓶',
  '30 cc玻璃瓶',
  '30 cc 玻璃瓶',
  '30cc／瓶',
  '建議安排在白天',
  '建議白天',
  '早上＋下午',
  '早上+下午',
  '早晚各一小匙',
  '每日早上及下午各一小匙',
  '一天一次一小匙',
];

const PUBLIC_CLAIM_LITERALS = [
  '關節',
  '卡卡',
  '精神不濟',
  '補氣',
  '生津',
  '膠原蛋白',
  '鈣質',
  '保證功效',
];

const must = (ok, message) => {
  if (!ok) throw new Error(message);
};

for (const rel of ACTIVE_PUBLIC_FILES) {
  const full = path.join(ROOT, rel);
  must(fs.existsSync(full), `LINE 正式公開檔案缺失：${rel}`);
  const text = fs.readFileSync(full, 'utf8');
  for (const retired of STALE_PUBLIC_LITERALS) {
    must(!text.includes(retired), `${rel} 仍含退役公開資料：${retired}`);
  }
  for (const claim of PUBLIC_CLAIM_LITERALS) {
    must(!text.includes(claim), `${rel} 含目前公開內容禁用療效詞：${claim}`);
  }
}

const current = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/official-products.json'), 'utf8'));
must(current.authority === 'user-confirmed-current', 'LINE 產品 authority 不是目前正式版本');
must(JSON.stringify(current.knowledgeProductIds) === JSON.stringify(PUBLIC_IDS), 'LINE 可見產品知識不是六項正式產品');
must(Array.isArray(current.temporarilyHiddenProductIds) && current.temporarilyHiddenProductIds.includes(DEFERRED_ID), '柒玄茶未維持暫時隱藏');

const byId = Object.fromEntries((current.products || []).map(p => [p.id, p]));
const drink30 = byId['guilu-drink-30'];
const drink180 = byId['guilu-drink-180'];
const gao = byId['guilu-gao'];

must(drink30 && drink30.name === '龜鹿飲30cc玻璃罐', '30cc 正式名稱不是龜鹿飲30cc玻璃罐');
must(drink30.specification === '30cc／罐（小玻璃罐）', '30cc 正式規格回退');
must(String(drink30.package || '').includes('小玻璃裸罐'), '30cc 正式包裝未鎖定小玻璃裸罐');
must(String(drink30.package || '').includes('無貼紙'), '30cc 正式包裝未鎖定無貼紙');
must(drink30.usagePrimary === '每日 1–2 罐', '30cc 正式使用方式被舊資料回退');
must(drink30.usageTiming === '飲用時間可依個人使用習慣與作息時間安排', '30cc 飲用時段不是目前彈性規則');
must(drink180 && drink180.name === '龜鹿飲180cc鋁袋', '180cc 正式名稱回退');
must(String(drink180.package || '').includes('狹長直立鋁袋'), '180cc 包裝不是目前狹長直立鋁袋');
must(drink180.usageTiming === '飲用時間可依個人使用習慣與作息時間安排', '180cc 飲用時段不是目前彈性規則');
must(gao && gao.usagePrimary === '食用時間可依個人使用習慣與作息時間安排', '龜鹿膏又被鎖回固定時段');

const qixuan = byId[DEFERRED_ID];
must(qixuan && qixuan.temporarilyHidden === true && qixuan.lineKnowledgeVisible === false && qixuan.publicVisible === false, '柒玄茶公開隱藏旗標回退');

const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data.json'), 'utf8'));
must(Array.isArray(data.products) && data.products.length === 6, 'LINE 顧客產品卡不是六項');
must(!data.products.some(p => p.id === DEFERRED_ID), '柒玄茶重新混入顧客產品卡');

// 驗證舊資料清洗程式仍存在且方向正確；這裡刻意允許來源碼出現退役字串，因為它們是替換規則的比對端。
const salesMasterSource = fs.readFileSync(path.join(ROOT, 'product-sales-master.js'), 'utf8');
must(salesMasterSource.includes('/建議白天飲用/g, "飲用時間可依個人使用習慣與作息時間安排"'), 'LINE 舊白天時段清洗規則遺失或方向錯誤');
must(salesMasterSource.includes('/每日早上及下午各一小匙/g, "食用時間可依個人使用習慣與作息時間安排"'), '龜鹿膏舊固定時段清洗規則遺失或方向錯誤');
must(salesMasterSource.includes(".filter((v) => id !== \"guilu-drink-30\" || !/瓶/.test(v))"), '30cc 舊瓶別名過濾規則遺失');

console.log('PASS: LINE OA customer-facing copy authority; six visible products; 30cc small glass jar/bare/no sticker; flexible timing; stale-source sanitizers remain active; no stale public brand/product/timing or high-risk claim regression.');
