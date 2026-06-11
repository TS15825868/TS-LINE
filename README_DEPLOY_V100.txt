仙加味 LINE OA V100 部署說明

保留：
- server.js
- data.json
- package.json
- images/
- Code.gs（給 Google Apps Script 使用）

刪除：
- products.json
- flex_combo.json
- flex_lifestyle.json
- flex_main.json
- 舊版 txt 備份
- data-old.json / products-old.json / backup.json

Render Environment 必填：
- CHANNEL_ACCESS_TOKEN
- CHANNEL_SECRET
- CRM_URL

Google Apps Script：
請把 Code.gs 全部貼到 Apps Script，重新部署 Web App。
執行身分：我
存取權：任何人
複製 /exec 結尾網址到 Render 的 CRM_URL。
