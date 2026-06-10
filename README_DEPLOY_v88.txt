仙加味 LINE OA v88 部署說明

本版更新：
- 產品圖片改用網站 images/ 圖片
- 產品卡新增按鈕：加入清單、立即下單、建議售價、活動優惠、食用方式、查看清單
- data.json 為唯一資料中心
- package.json 已修正 LINE SDK 版本為 10.8.0，Node 使用 22.x

請刪除 Git / Render 專案中的舊檔：
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

請保留：
- server.js
- data.json
- package.json
- package-lock.json（若原本有）
- images/

Render Environment 必填：
- CHANNEL_ACCESS_TOKEN
- CHANNEL_SECRET
- CRM_URL

Render 設定：
- Build Command: npm install
- Start Command: npm start
