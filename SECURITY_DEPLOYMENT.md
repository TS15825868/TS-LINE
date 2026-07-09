# LINE OA 正式部署設定

正式部署平台請自行填入以下環境變數：

- `CHANNEL_ACCESS_TOKEN`
- `CHANNEL_SECRET`
- `CRM_URL`

程式庫不保存任何實際憑證或 CRM 網址。

## 設定完成後

1. 重新部署 LINE OA 服務。
2. 開啟 `/healthz`。
3. 確認：
   - `credentialsConfigured` 為 `true`
   - `crmConfigured` 為 `true`
4. 到 LINE 實際測試「看產品、直接下單、搭配組合、購物車、結帳」。

舊憑證曾出現在 Git 紀錄中，建議重新發行 Channel Access Token，並視需要重設 Channel Secret。
