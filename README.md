# 仙加味 LINE OA v288｜全系列開放詢問與下單

## 本版主軸
- 六項產品全部開放詢問、選擇數量與下單。
- 產品盒裝到貨後，依訂單順序確認並安排出貨。
- 保留產品卡、價格、優惠、購物車、結帳、付款、配送與 CRM。
- 官網產品頁、產品 DM 與 LINE OA 互相導流。
- 以產品成分、規格、食補用途方向與一般使用方式為主，不直接做疾病療效宣稱。

## 主要檔案
- `server.js`：LINE Bot v288 正式主程式。
- `data.json`：產品、價格、用途方向、FAQ、套餐與品牌資料。
- `Code.gs`：既有 CRM／Google Apps Script，未修改。
- `.env.example`：部署環境變數名稱範例，不包含真實憑證。

## 部署環境變數
- `CHANNEL_ACCESS_TOKEN`
- `CHANNEL_SECRET`
- `CRM_URL`（有使用 CRM 時設定）
- `PORT`（通常由部署平台自動提供）

## 部署檢查
部署後開啟 `/healthz`，應顯示：

```json
{
  "ok": true,
  "version": "v288",
  "orderOpen": true,
  "credentialsConfigured": true
}
```

若 `credentialsConfigured` 為 `false`，請在部署平台補上 LINE 憑證環境變數後重新部署。

## 安全提醒
LINE 憑證不得寫入公開 GitHub 程式碼。若舊版憑證曾公開，應至 LINE Developers 重新發行 Channel access token，並同步更新部署平台環境變數。
