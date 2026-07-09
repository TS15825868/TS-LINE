# LINE OA 安全部署設定

正式部署必須由環境變數提供 CHANNEL_ACCESS_TOKEN、CHANNEL_SECRET、CRM_URL。程式庫不再保存任何憑證或 CRM 網址。

舊憑證曾出現在 Git 紀錄中，請重新發行 Channel Access Token，並視需要重設 Channel Secret。
