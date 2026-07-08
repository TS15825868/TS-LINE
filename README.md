# 仙加味 LINE OA v286｜網站同步・古籍藥典・正向 QA

## 本版更新
- 同步仙加味網站 v286 的產品名稱、規格、使用方式與六個獨立產品頁。
- 修正所有產品圖與 DM 圖路徑，避免網站更新後 LINE 圖片失效。
- 功效／症狀問答改為「先說日常補養價值，再補專業提醒」，避免過度負面。
- 新增《本草綱目》、《臺灣中藥典》、《中華藥典》與七項成分名稱對照回覆。
- 保留購物車、價格、優惠、結帳、配送、付款與 CRM 寫入功能。
- `Code.gs` 保留已確認正常的 v231_stable，不需要重新修改。

## 部署檔案
- server.js
- package.json
- data.json
- Code.gs（Google Sheet CRM，維持原本正常版本）
- LINEOA_價格表_最新版.json
- LINEOA_正式回覆文案_v286.md
- LINEOA_古籍藥典與正向QA_v286.md
- .env.example

## 環境變數
- CHANNEL_ACCESS_TOKEN
- CHANNEL_SECRET
- CRM_URL（選填）

## Webhook
`https://你的主機網址/webhook`

## 更新部署提醒
只更新壓縮檔不會自動上線。請把新版檔案部署至目前使用的 Render／Zeabur／其他 Node.js 主機，並重新啟動服務。

健康檢查：
- `/` 會顯示 v286 running
- `/healthz` 會回傳 version: v286
