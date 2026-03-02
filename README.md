# 仙加味・龜鹿 LINE OA Bot（可部署版｜全卡片流程）

## 1) 必要環境
- Node.js 18+

## 2) Render 環境變數（必填）
在 Render Dashboard → Environment Variables 設定：
- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_SECRET`

（相容舊命名：`CHANNEL_ACCESS_TOKEN` / `CHANNEL_SECRET`）

## 3) products.json 來源（可選）
- `PRODUCTS_URL`

若不填，預設使用：
- `https://ts15825868.github.io/TaiShing/products.json`

## 4) 啟動
```bash
npm i
npm start
```

## 5) LINE Developers Webhook
Webhook URL：
- `https://<你的-render-網域>/webhook`

並打開：
- Use webhook

> 小提醒：若你要在 LINE 後台 Verify，請確認 Render 服務已成功 Deploy，且環境變數已填。
