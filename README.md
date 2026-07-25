# 仙加味 LINE OA v6.0.6

正式版以 `server.js` 為 LINE OA 主程式、`social-server.js` 為社群發布服務、`internal-entry.js` 為正式部署啟動器。

## 正式資料來源

- 官網公開產品資料：`TS15825868/xianjiawei` 的 `catalog-public.json`
- LINE OA 銷售資料與最新建議售價：`line-sales-master.json`
- LINE OA 執行資料：`data.json`
- 官網小老闆、夥伴與出圖規格：`MASCOT_CHARACTER_SPEC.md`
- 社群內容：先進待審核，人工核准後才可排程或發布

## 正式功能

- 五大產品型態、六項公開規格，與仙加味官網資料同步。
- LINE OA 產品卡固定使用真實產品原圖。
- 最新建議售價由 `product-sales-master.js` 在啟動時套用，避免舊活動價重新出現。
- 價格方案、數量選擇、購物車、結帳、配送、付款與 CRM 訂單寫入。
- Facebook／Instagram 草稿、人工審核、排程與發布。
- 內部管理 App：營運儀表板、訂單、客戶 CRM、庫存異動、提醒、社群排程、期間報表、員工權限、操作紀錄與備份還原。
- Supabase PostgreSQL 保存與還原內部 App、社群草稿及排程資料。
- LINE、Meta 與 Supabase 憑證只從部署平台環境變數讀取，不寫入程式庫。

## 角色與圖片規則

- 唯一母版：仙加味官網正式版小老闆。
- 固定夥伴：小鹿娃娃、小烏龜娃娃。
- 人物臉型、髮型、服裝、圍裙紅色直式「仙加味」印章及夥伴造型不得更換。
- 圖片不足時可依正式規格生成，但生成後先進待審核。
- 產品只使用真實原圖，不重畫、不變形、不改包裝文字或規格。
- 圖片文字只使用繁體中文，不顯示內部貼文編號。

## 社群發布規則

1. 先完成文案。
2. 依文案選擇或生成對應圖片。
3. 圖文一起進入待審核。
4. 人工核准後才可啟用排程或立即發布。
5. 文案、圖片、平台或時間修改後，必須撤銷核准並重新審核。
6. 固定內容每週一篇，建議安排週三晚上 8:00（Asia/Taipei）。
7. 週六、週日不發布固定或氣候貼文。
8. 天氣內容不預先啟用；符合萬華實際氣候時，可於其他平日晚上 8:00 送審並加發，每週最多一篇。
9. 失敗平台不自動補發，避免重複發布；確認後由人工處理。

## 必要環境變數

- `CHANNEL_ACCESS_TOKEN`
- `CHANNEL_SECRET`
- `CRM_URL`
- `SOCIAL_ADMIN_PIN`
- `INTERNAL_APP_PASSWORD`
- `INTERNAL_APP_SECRET`

## Supabase 免費資料庫

在 Supabase SQL Editor 執行 `supabase/schema.sql`，並在 Render Environment 加入：

```text
SUPABASE_URL=https://你的專案代碼.supabase.co
SUPABASE_SECRET_KEY=你的 Supabase Secret key
```

Secret key 只能放在 Render 環境變數，不可加入 GitHub、網頁前端或公開文件。

可保留下列本機暫存路徑：

```text
INTERNAL_DATA_PATH=/tmp/xianjiawei-internal.json
SOCIAL_DATA_PATH=/tmp/xianjiawei-social-posts.json
```

## 正式檢查

```bash
npm test
npm run check:catalog
```

GitHub Actions 會在推送到 `main` 時自動驗收，不建立其他分支。

健康檢查：

- LINE OA：`/healthz`
- 社群發布：`/social/healthz`
- 人工審核閘門：`/social/review-gate-status`
- 每週一篇排程：`/social/schedule-status`
- 社群管理網站：`/internal/social-center-healthz`
- 繁體中文圖片：`/social/raster-healthz`
- 內部管理 App：`/internal/healthz`
- Supabase 持久化：`/internal/db-healthz`
