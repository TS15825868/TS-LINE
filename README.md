# 仙加味・龜鹿 LINE OA Bot（全卡片按鈕版）

## 1) Render 環境變數（必填）
- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_SECRET`

（相容舊命名）
- `CHANNEL_ACCESS_TOKEN`
- `CHANNEL_SECRET`

## 2) products.json（可選）
- `PRODUCTS_URL`（不填則使用官網預設）
  - 預設：`https://ts15825868.github.io/TaiShing/products.json`

## 3) Webhook
- Webhook URL：`https://<你的Render網域>/webhook`
- LINE Developers 後台：Use webhook 開啟

## 4) 開發
```bash
npm i
npm start
```

