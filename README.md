# 仙加味 LINE OA v300.1

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
- `CRM_URL`

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
  "version": "v300.1",
  "credentialsConfigured": true,
  "crmConfigured": true
}
```

最後到 LINE 實際測試：看產品、直接下單、搭配組合、購物車與結帳。
