# 仙加味 LINE OA v300.3

## 正式功能

- 六項產品選單與產品詳情
- 價格、優惠與數量選擇
- 購物車、結帳、付款與配送
- 搭配方案與使用方式
- 官網產品頁與產品 DM 導流
- CRM 訂單寫入
- 敏感健康問題轉介合作中醫師
- 官網共用產品目錄同步檢查

## 主要檔案

- `server.js`：LINE OA 正式主程式
- `data.json`：價格、優惠、套餐與 LINE 專用資料
- `tools/sync_website_catalog.js`：同步官網公開產品資料
- `test.js`、`catalog.test.js`、`security.test.js`：功能與安全測試
- `.env.example`：部署環境變數範例，不含真實憑證
- `SECURITY_DEPLOYMENT.md`：正式部署檢查方式

## 請自行設定的環境變數

- `CHANNEL_ACCESS_TOKEN`
- `CHANNEL_SECRET`
- `CRM_URL`（已內建目前的 Google Apps Script 網址；需要更換時再用環境變數覆蓋）

其他選用設定：

- `CRM_TIMEOUT_MS=8000`
- `STATE_TTL_MS=86400000`
- `STATE_CLEANUP_INTERVAL_MS=3600000`
- `MAX_STATE_ENTRIES=10000`
- `PORT=3000`

程式庫不保存實際憑證。設定完成後請重新部署，並開啟 `/healthz` 確認：

```json
{
  "ok": true,
  "version": "v300.3",
  "credentialsConfigured": true,
  "crmConfigured": true
}
```

最後到 LINE 實際測試：看產品、直接下單、搭配組合、購物車與結帳。

## 卡片式操作

- 看產品／直接下單：顯示六項產品圖片卡與按鈕。
- 幫我推薦：顯示三張使用情境推薦卡。
- 搭配組合：顯示各組合卡片，可查看方案、產品或轉人工。
- 怎麼使用：顯示六項產品使用方式卡片。

## v300.3 全功能檢查

產品與直接下單入口改為不依賴外部圖片載入的 Flex 卡片，保留選擇數量、完整介紹與使用方式按鈕；並加入產品、價格、推薦、搭配、使用、購物車與結帳的訊息格式測試。
