# LINE OA 部署環境變數

正式部署請自行填入：

- `CHANNEL_ACCESS_TOKEN`
- `CHANNEL_SECRET`
- `CRM_URL`

程式庫不得保存實際憑證。完成設定後重新部署，並至 `/healthz` 確認 `credentialsConfigured` 與 `crmConfigured` 為 `true`。
