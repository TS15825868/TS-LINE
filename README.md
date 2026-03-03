# 仙加味・龜鹿 LINE OA Bot（v2）

## 環境變數（Render / 本機都一樣）
- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_SECRET`
- `PRODUCTS_URL`（可選；未填會用官網預設）
- `PORT`（Render 會自動給）

## Webhook
- 路徑：`/webhook`
- 健康檢查：`/health`

## 備註
- 主要互動採用「卡片按鈕」與「Carousel」。
- 飲食/補養內容以一般飲食建議呈現，避免醫療諮詢語氣；仍會附上提醒（孕哺/慢性病/用藥等請先詢問專業人員）。
