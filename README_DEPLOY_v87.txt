仙加味 LINE OA v87 部署說明

本版已整合為：
- data.json：唯一資料中心
- server.js：LINE Bot 回覆與下單邏輯

Git / Render 專案建議只保留：
- server.js
- data.json
- package.json
- package-lock.json（若原本有）
- images/（若有使用產品圖）
- Procfile（若原本有）

請刪除：
- products.json
- products-old.json
- data-old.json
- backup.json
- old-products.json
- flex_combo.json
- flex_lifestyle.json
- flex_main.json
- 舊版說明 txt 檔
- google_apps_script.js
- google_script.js

Render Environment 必填：
- CHANNEL_ACCESS_TOKEN
- CHANNEL_SECRET
- CRM_URL

注意：
不要把 CHANNEL_ACCESS_TOKEN 或 CHANNEL_SECRET 寫死在 server.js。
