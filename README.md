# 仙加味 LINE OA v4.1.0

正式版以 `server.js` 為主程式、`start.js` 為部署啟動器、`data.json` 為產品與方案資料中心。

## 正式功能

- 五大產品型態、六項正式規格，與仙加味官網 v408.7 同步。
- 九種 LINE OA 專用高清小老闆：welcome、products、recommend、combo、usage、faq、service、brand、cart。
- 產品卡固定使用真實產品原圖，另提供正式 DM、完整官網介紹與使用方式。
- 價格方案、數量選擇、購物車、結帳、配送、付款與 CRM 訂單寫入。
- 常見問題、品牌故事、門市資訊、人工客服與健康敏感問題轉介。
- LINE 憑證只從部署平台環境變數讀取，不寫入程式庫。

## 必要環境變數

- `CHANNEL_ACCESS_TOKEN`
- `CHANNEL_SECRET`
- `CRM_URL`

## 選用環境變數

- `PUBLIC_BASE_URL`：LINE OA 對外服務網址；Render 可使用 `RENDER_EXTERNAL_URL`。
- `CRM_TIMEOUT_MS`、`STATE_TTL_MS`、`STATE_CLEANUP_INTERVAL_MS`、`MAX_STATE_ENTRIES`。

## 正式檢查

```bash
npm test
```

健康檢查端點：`/healthz`，會回傳版本、產品數、官網目錄版本、憑證與 CRM 設定狀態。
