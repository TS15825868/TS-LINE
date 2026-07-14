# 仙加味 LINE OA v4.5.0

正式版以 `server.js` 為 LINE OA 主程式、`social-server.js` 為社群發布服務、`internal-entry.js` 為正式部署啟動器、`internal-app.js` 為內部管理 PWA、`supabase-state-bridge.js` 為免費方案資料持久化層、`data.json` 為產品與方案資料中心。

## 正式功能

- 五大產品型態、六項正式規格，與仙加味官網資料同步。
- LINE OA 專用小老闆圖片：welcome、products、recommend、combo、usage、faq、service、brand、cart。
- 產品卡固定使用真實產品原圖，另提供正式 DM、完整官網介紹與使用方式。
- 價格方案、數量選擇、購物車、結帳、配送、付款與 CRM 訂單寫入。
- Facebook／Instagram 草稿、審核、排程與發布。
- 內部管理 App：儀表板、訂單、客戶 CRM、庫存、提醒、報表、員工權限與操作紀錄。
- LINE OA 訂單成功寫入 CRM 後，會自動同步一份到內部管理 App。
- Supabase PostgreSQL 自動保存與還原內部 App、社群草稿及排程資料。
- 常見問題、品牌故事、門市資訊、人工客服與健康敏感問題轉介。
- LINE、Meta 與 Supabase 憑證只從部署平台環境變數讀取，不寫入程式庫。

## 必要環境變數

- `CHANNEL_ACCESS_TOKEN`
- `CHANNEL_SECRET`
- `CRM_URL`
- `SOCIAL_ADMIN_PIN`：社群審核台密碼，也可作為內部管理 App 備用密碼。

## 內部管理 App

- 網址：`/internal`
- 建議設定 `INTERNAL_APP_PASSWORD`，不要與公開服務共用密碼。
- 可設定 `INTERNAL_ADMIN_USER`，預設為 `admin`。
- 可設定 `INTERNAL_APP_SECRET` 作為登入工作階段簽章密鑰。
- 免費 Render 方案可保持 `/tmp` 本機路徑，Supabase bridge 會在啟動時還原、異動後同步到資料庫。

## Supabase 免費資料庫

1. 建立 Supabase Free 專案。
2. 在 Supabase SQL Editor 執行 `supabase/schema.sql`。
3. 在 Render Environment 加入：

```text
SUPABASE_URL=https://你的專案代碼.supabase.co
SUPABASE_SECRET_KEY=你的 Supabase Secret key
```

也相容舊版環境變數：

```text
SUPABASE_SERVICE_ROLE_KEY=舊版 service_role key
```

新專案優先使用 `SUPABASE_SECRET_KEY`。Secret key 只能放在 Render 環境變數，不可加入 GitHub、網頁前端或公開文件。

可保留下列本機暫存路徑，不需要付費 Persistent Disk：

```text
INTERNAL_DATA_PATH=/tmp/xianjiawei-internal.json
SOCIAL_DATA_PATH=/tmp/xianjiawei-social-posts.json
```

啟動流程會先從 Supabase 還原資料，再開始接收 LINE OA 與內部 App 請求；資料異動後會自動同步回 Supabase。關閉或重新部署前也會嘗試再次同步。

## 其他選用環境變數

- `PUBLIC_BASE_URL`：LINE OA 對外服務網址；Render 可使用 `RENDER_EXTERNAL_URL`。
- `META_PAGE_ID`、`META_PAGE_ACCESS_TOKEN`。
- `INSTAGRAM_USER_ID`、`INSTAGRAM_ACCESS_TOKEN`。
- `CRM_TIMEOUT_MS`、`STATE_TTL_MS`、`STATE_CLEANUP_INTERVAL_MS`、`MAX_STATE_ENTRIES`。

## 正式檢查

```bash
npm test
```

GitHub Actions 會在每次推送到 `main` 時自動執行完整驗收。

健康檢查：

- LINE OA：`/healthz`
- 社群發布：`/social/healthz`
- 內部管理 App：`/internal/healthz`
- Supabase 持久化：`/internal/db-healthz`
