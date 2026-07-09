# LINE OA 正式部署設定

正式部署平台請自行填入以下環境變數：

- `CHANNEL_ACCESS_TOKEN`
- `CHANNEL_SECRET`
- `CRM_URL`（已內建目前的 Google Apps Script 網址；需要更換時再設定）

程式庫不保存 LINE 憑證；CRM 使用目前指定的 Google Apps Script 預設網址，仍可由環境變數覆蓋。

## 設定完成後

1. 重新部署 LINE OA 服務。
2. 開啟 `/healthz`。
3. 確認：
   - `credentialsConfigured` 為 `true`
   - `crmConfigured` 為 `true`
4. 到 LINE 實際測試「看產品、直接下單、搭配組合、購物車、結帳」。

舊憑證曾出現在 Git 紀錄中，建議重新發行 Channel Access Token，並視需要重設 Channel Secret。
