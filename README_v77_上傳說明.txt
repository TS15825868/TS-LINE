仙加味 v77 LINE OA 上傳說明

1. line_oa/ 內容覆蓋 Render 專案。
2. Render Environment 必須設定：
   CHANNEL_ACCESS_TOKEN
   CHANNEL_SECRET
   CRM_URL（若要寫入 Google Sheet）
3. server.js 已改讀 data.json，products.json 只保留為相容備份。
4. 回覆速度：若使用 Render 免費方案，慢通常是冷啟動造成。此版已新增 /healthz，可用 UptimeRobot 每 10 分鐘 ping 一次：
   https://你的render網址/healthz
   若要完全避免冷啟動，建議升級 Render 付費方案。
5. 不建議在客戶端加「系統較慢請稍等」警語，會降低專業感；優先用 keep-alive 或付費方案改善。
