# 仙加味・龜鹿 LINE OA Bot（卡片按鈕版｜串接 products.json）

## Render 環境變數
- `LINE_CHANNEL_ACCESS_TOKEN`（或 `CHANNEL_ACCESS_TOKEN`）
- `LINE_CHANNEL_SECRET`（或 `CHANNEL_SECRET`）
- `PRODUCTS_URL`（可不填；預設：`https://ts15825868.github.io/TaiShing/products.json`）
- `PORT`（Render 會自動給）

## LINE Developers Webhook URL
- `https://<你的render網域>/webhook`

（程式也同時支援 `/` 作為 webhook，避免後台填錯路徑造成「Verify 成功但沒回覆」）

## 健康檢查
- `GET /health` 會回 `ok`
