# 仙加味 LINE OA v280 檢查清理更新版

## 部署需要保留的檔案
- server.js
- package.json
- data.json
- Code.gs（選用：Google Sheet 訂單紀錄用）
- LINEOA_價格表_最新版.json（客服／人工回覆參考）
- LINEOA_正式回覆文案_v280.md（客服／文案參考）
- .env.example

## Render / Zeabur 環境變數
請在主機後台設定，不要寫死在 server.js：

- CHANNEL_ACCESS_TOKEN
- CHANNEL_SECRET
- CRM_URL（選填）

## Webhook
LINE Developers Webhook URL：
https://你的主機網址/webhook

## 價格原則
官網不公開價格；LINE OA 內可回覆最新售價、優惠與下單流程。
