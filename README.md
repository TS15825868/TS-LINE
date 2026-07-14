# 仙加味 LINE OA v4.4.0

正式版以 `server.js` 為 LINE OA 主程式、`social-server.js` 為社群發布服務、`internal-entry.js` 為正式部署啟動器、`internal-app.js` 為內部管理 PWA、`data.json` 為產品與方案資料中心。

## 正式功能

- 五大產品型態、六項正式規格，與仙加味官網資料同步。
- LINE OA 專用小老闆圖片：welcome、products、recommend、combo、usage、faq、service、brand、cart。
- 產品卡固定使用真實產品原圖，另提供正式 DM、完整官網介紹與使用方式。
- 價格方案、數量選擇、購物車、結帳、配送、付款與 CRM 訂單寫入。
- Facebook／Instagram 草稿、審核、排程與發布。
- 內部管理 App：儀表板、訂單、客戶 CRM、庫存、提醒、報表、員工權限與操作紀錄。
- LINE OA 訂單成功寫入 CRM 後，會自動同步一份到內部管理 App。
- 常見問題、品牌故事、門市資訊、人工客服與健康敏感問題轉介。
- LINE 與 Meta 憑證只從部署平台環境變數讀取，不寫入程式庫。

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
- 可設定 `INTERNAL_DATA_PATH` 為 Render 持久磁碟路徑；未設定時使用 `/tmp/xianjiawei-internal.json`，重新部署可能清除。

## 其他選用環境變數

- `PUBLIC_BASE_URL`：LINE OA 對外服務網址；Render 可使用 `RENDER_EXTERNAL_URL`。
- `SOCIAL_DATA_PATH`：社群貼文持久化檔案路徑。
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
