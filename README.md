# 仙加味 LINE OA v3.2.6

正式版以 `server.js` 為主程式、`start.js` 為部署啟動器，`data.json` 為產品與方案資料中心。

- 小老闆卡片：welcome、products、recommend、combo、usage、faq、service、brand，八種圖片內容皆不同。
- 小老闆圖片優先經 Render 同網域代理；未設定公開網址時使用仙加味官網圖片備援。
- 功能：看產品、價格、推薦、搭配、使用方式、購物車、直接下單與完整結帳。
- 服務：常見問題、配送付款、門市資訊、人工客服與中醫師轉介。
- 訂單：姓名、電話、付款、配送、地址／門市、確認送出與 CRM 寫入失敗重試。
- 安全：LINE 憑證只從部署平台環境變數讀取。

必要環境變數：

- `CHANNEL_ACCESS_TOKEN`
- `CHANNEL_SECRET`
- `CRM_URL`

選用環境變數：

- `PUBLIC_BASE_URL`：LINE OA 對外服務網址；Render 可使用平台提供的 `RENDER_EXTERNAL_URL`。

檢查指令：

```bash
npm test
```
