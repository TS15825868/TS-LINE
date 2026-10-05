const fs=require('fs');
const must=(ok,msg)=>{if(!ok)throw new Error(msg)};
const authority=JSON.parse(fs.readFileSync('formal-media-authority-v20260810.json','utf8'));
const current=JSON.parse(fs.readFileSync('assets/data/official-products.json','utf8'));
const publicProducts=current.products.filter(p=>current.websitePublicProductIds.includes(p.id));
const master=JSON.parse(fs.readFileSync('line-sales-master.json','utf8'));
const safety=fs.readFileSync('line-image-safety.js','utf8');
const text=JSON.stringify(master);
const expected=publicProducts.map(p=>p.specification);
for(const spec of expected) must(text.includes(spec),`LINE正式銷售母本缺少最新規格：${spec}`);
must(Object.keys(authority.source_product_dm||{}).length===publicProducts.length,'LINE核准DM清單必須跟隨最新公開產品');
for(const url of Object.values(authority.source_product_dm||{})) must(/^https:\/\/ts15825868\.github\.io\/xianjiawei\/images\/dm-final\/.+\.jpg(?:\?v=.+)?$/.test(url),`核准DM來源不正確：${url}`);
for(const url of Object.values(authority.product_dm||{})) must(/^https:\/\/ts-line\.onrender\.com\/assets\/formal-dm\/.+\.jpg\?v=/.test(url),`LINE顯示圖必須由正式JPEG轉換路由提供：${url}`);
must(/trial-poster-small-boss-official-v20260814\.jpg/.test(authority.source_trial||''),'試喝原始圖未指向最新使用者核准WebP');
must(/\/assets\/formal-trial\/trial\.jpg\?v=/.test(authority.trial||''),'LINE試喝顯示圖未指向正式JPEG路由');
must(/fit:\s*["']inside["']/.test(safety)&&/withoutEnlargement:\s*true/.test(safety)&&/\.jpeg\(/.test(safety),'LINE核准圖必須等比例、避免放大並轉JPEG');
must(safety.includes('officialOriginalImage: identity')&&safety.includes('products-v3-identity-only'),'不得以DM取代products-v3產品本體識別權威');
for(const product of publicProducts){
  must(authority.source_product_image[product.name]===product.approvedProductImage,`產品正式主圖與權威不一致：${product.name}`);
  must(authority.source_product_dm[product.name]!==authority.source_product_image[product.name],`產品與DM角色不可混用：${product.name}`);
}
must(authority.hard_rules.some(x=>x.includes('products-v3')),'不得放寬products-v3產品本體權威');
must(authority.guard_principle.includes('目前正式權威')&&authority.guard_principle.includes('新版正確資料'),'守門員必須驗正式能力，不得守舊版號／舊固定文案');
console.log('PASS：LINE目前公開規格、正式產品／DM／試喝角色、JPEG相容轉換與能力式守門。');
