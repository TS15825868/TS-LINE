# 仙加味 LINE OA 即時回覆改進｜2026-10-26

## 避免顧客等待外部官網

實際檢查 TS-LINE 正式來源確認：文字入口已在背景更新，**Rich Menu/Postback 的 products 分支卻仍 `await publicCatalog.refresh()`**，需等待 raw GitHub 官網兩個 HTTP 請求，每個設定最長 8500ms 逾時。官網慢時 LINE 產品按鈕會像卡住。

此修正版讓所有商品入口都先從正式核准快照產生 LINE Flex 回覆，並非阻塞更新公開商品資訊。既有產品母本、價格審核、隱藏商品、官網 `public=true` 篩選與 15 分鐘 single-flight 快取不變。原本 Cloudflare 每五分鐘 GET `/healthz` 的保活連線，額外非同步觸發同一份 15 分鐘商品快取刷新；不增設新付費排程、不讓查詢等候更新。

## 資料安全與上線限制

新離線測試模擬遠端網站無回應，產品 Postback 仍直接回傳最近正式核准快照，沒有呼叫 LINE、CRM 或其他對客 API。CRM 建立訂單與合作表單必須等待可採信通知／寫入回執，**不會為了速度假裝成功或提前清除顧客購物車**。

Render 2026-10 的 build pipeline minutes 已耗盡，使用 `[skip render]` Commit 避免反覆失敗建置。即使 GitHub 安全測試通過，這份加速程式在 Render 成功部署前都**不算已對顧客上線**。正式服務仍受 Render 免費方案可能休眠／重啟影響；唯一完全脫離依賴的方式，是先把簽章、回覆與付款訂單流程逐項移轉並完成官方 Webhook 端對端驗證，不能拿現有「只收件」的 Cloudflare 待命 Worker 當正式 LINE 客服。
