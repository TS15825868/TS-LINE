# 仙加味 LINE OA 正式部署設定

仙加味 LINE OA 正式服務使用 Render + TS-LINE `main`，正式入口為 `server.js`。

## 必要環境變數

- `CHANNEL_ACCESS_TOKEN`
- `CHANNEL_SECRET`

## 正式架構環境變數

- `LINE_RICH_MENU_AUTHORITY=oa-manager`
- `CRM_URL`：目前程式已有正式 Google Apps Script CRM 預設網址；只有更換 CRM 時才覆蓋。
- `CRM_TIMEOUT_MS=8000`
- `STATE_TTL_MS=86400000`
- `STATE_CLEANUP_INTERVAL_MS=3600000`
- `MAX_STATE_ENTRIES=10000`

正式環境不要設定 `LINE_RICH_MENU_AUTHORITY=messaging-api`，除非日後明確決定把 Rich Menu 改由 Messaging API 管理。預設權威為 LINE Official Account Manager，Render 不得覆蓋 OA Manager 的正式快速選單。

LINE 與 CRM 憑證不得寫入 GitHub、README、公開前端或圖片素材。

## 部署後驗收

1. 確認 Render 最新 `main` 部署狀態為 `live`。
2. 開啟 `/healthz`。
3. 確認 `credentialsConfigured=true`、`crmConfigured=true`。
4. 實際測試：歡迎卡、看產品、申請試喝、幫我推薦、搭配組合、怎麼使用、購物車、直接下單與結帳。
5. 確認公開產品維持六項，柒玄茶暫時隱藏。
6. 確認 LINE OA Manager 的正式六格 Rich Menu 未被 Messaging API 覆蓋。

若曾有憑證暴露於 Git 歷史、截圖或公開紀錄，應重新發行對應憑證後再更新 Render 環境變數。
