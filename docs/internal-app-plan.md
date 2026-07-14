# 仙加味內部管理 App｜第一、二階段合併版

## 目標

在現有 TS-LINE 正式服務中加入可安裝至 iPhone／Android 主畫面的 PWA 內部管理 App，並保留官網、LINE OA、社群發布系統彼此獨立運作。

## 合併範圍

- 管理員登入與員工權限
- 儀表板
- 訂單管理
- 客戶 CRM
- 庫存管理
- 社群草稿、審核、排程與發布狀態
- 回購與出貨提醒
- 營業報表
- PWA 安裝與離線殼層
- 操作紀錄
- LINE／Instagram／Facebook／資料儲存健康狀態
- 官網產品資料同步顯示
- LINE OA 訂單自動鏡像到內部管理台

## 不破壞原有系統

- 官網仍由 xianjiawei/main 獨立部署。
- LINE OA 仍由 TS-LINE/main 獨立部署。
- 內部 App 掛載於 TS-LINE 的 `/internal`，不另開第三個儲存庫。
- 所有正式修改直接進 main，不新增長期分支。

## 目前進度

- [x] `/internal` PWA 管理介面
- [x] 訂單、客戶、庫存、提醒、報表 API
- [x] 管理員與員工帳號權限
- [x] 與既有社群審核台整合
- [x] LINE OA 訂單自動匯入內部管理台
- [x] 自動化測試與 GitHub Actions 驗收
- [ ] Render 持久化資料路徑設定
- [ ] LINE OA 小老闆圖片正式替換
- [ ] LINE 回覆速度與健康檢查持續驗收
- [ ] 官網與 LINE OA 資料一致性最終檢查
- [ ] Render 正式部署與手機安裝驗收
