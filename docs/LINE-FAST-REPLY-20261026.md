# 仙加味 LINE OA 即時回覆改進｜2026-10-26

## 避免顧客等待外部官網

實際檢查 TS-LINE 正式來源確認：文字入口已在背景更新，**Rich Menu/Postback 的 products 分支卻仍 `await publicCatalog.refresh()`**，需等待 raw GitHub 官網兩個 HTTP 請求，每個設定最長 8500ms 逾時。官網慢時 LINE 產品按鈕會像卡住。

此修正版讓所有商品入口都先從正式核准快照產生 LINE Flex 回覆，並非阻塞更新公開商品資訊。既有產品母本、價格審核、隱藏商品、官網 `public=true` 篩選與 15 分鐘 single-flight 快取不變。原本 Cloudflare 每五分鐘 GET `/healthz` 的保活連線，額外非同步觸發同一份 15 分鐘商品快取刷新；不增設新付費排程、不讓查詢等候更新。

## 資料安全與上線限制

新離線測試模擬遠端網站無回應，產品 Postback 仍直接回傳最近正式核准快照，沒有呼叫 LINE、CRM 或其他對客 API。CRM 建立訂單與合作表單必須等待可採信通知／寫入回執，**不會為了速度假裝成功或提前清除顧客購物車**。

Render 2026-10 的 build pipeline minutes 已耗盡，使用 `[skip render]` Commit 避免反覆失敗建置。即使 GitHub 安全測試通過，這份加速程式在 Render 成功部署前都**不算已對顧客上線**。正式服務仍受 Render 免費方案可能休眠／重啟影響；唯一完全脫離依賴的方式，是先把簽章、回覆與付款訂單流程逐項移轉並完成官方 Webhook 端對端驗證，不能拿現有「只收件」的 Cloudflare 待命 Worker 當正式 LINE 客服。

## 2026-10-26｜正在核對訂單／商家通知時不顯示卡住

一般商品／FAQ 繼續即時使用核准的本地資料，不使用 Loading API。只有需要等待**正式 CRM 試喝需求寫入**，或**商家採購／合作／詢價管理員通知**時，若實際超過 650ms 才非同步啟動 LINE 官方 1:1 10 秒 Loading Animation（LINE 官方入口 `/v2/bot/chat/loading/start`）。動畫 HTTP 最長 1.5 秒，失敗也不阻擋原交易；只有 `source.type=user`、格式正確的 LINE User ID 與受保護 Token 才可觸發；群組不呼叫。

這是**顧客進度提示而非加快 CRM 寫入**，對外正式成功仍必須以原管理員 Push 回傳或 CRM 訂單 ID 為準，失敗時保留購物車及原錯誤訊息，不另外發 Push、不提前清除待確認訂單。LINE 官方文件說明 Loading Animation 本身非「發送訊息」，支援的 1:1 聊天中，新訊息到達會自動停止動畫。此程式在 Render 建置額度恢復並部署前仍**未正式上線**。

## 2026-10-26｜由真實收到客戶事件到 LINE 平台接受回覆的指標

原 LINE `/healthz` 會完整回傳 `lastReplyError`，可能攜帶 LINE SDK 例外中的私有內容；改成 `lastReplyErrorPresent` 布林值，內部仍維持錯誤診斷，不公開原文。

新增無客戶身分資訊的 `lastCustomerProcessingMs`、`lastEventToLineAckApproxMs`、`lastCustomerEventProcessedAt`、`lastCustomerResponseAccepted`、`slowCustomerEventCount`。收到 LINE 有效 timestamp 時，會將從 LINE 事件建立到後端處理／API 回覆完成的時間納入，包括 Render 冷啟動造成的延遲。超過 8 秒計入累積慢事件；失敗回覆不標記成功。無 timestamp 或逾 15 分鐘舊事件只記處理時間，不假造事件起點。

**注意：LINE 平台接受回覆 != 顧客手機完整顯示訊息**。這是降低事故偵測盲點，不代表通過官方端對端測試。Render build 額度未恢復前，程式更新不會自動生效。
