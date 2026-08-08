# 仙加味 LINE OA Rich Menu｜網站 Q 版正式版

圖片尺寸：2500 × 1686 px（大型圖文選單）  
版型：3 欄 × 2 列

2026-08-08 起，Rich Menu 不再以舊 `v309.jpg` 直接當正式人物版本，也不需要每次到 LINE OA Manager 手動重做。LINE 服務啟動後由 `line-rich-menu-sync.js` 自動建立／確認網站 Q 版 Rich Menu，成功後設為所有使用者的預設選單。

## 六個區域

| 區域 | 顯示名稱 | LINE 傳送文字 |
|---|---|---|
| 左上 | 看產品 | `看產品` |
| 中上 | 購物車 | `查看購買清單` |
| 右上 | 幫我推薦 | `幫我推薦` |
| 左下 | 搭配組合 | `搭配組合` |
| 中下 | 怎麼使用 | `怎麼使用` |
| 右下 | 直接下單 | `開始結帳` |

## 正式視覺規則

- 小老闆使用官網 `images/brand/line-oa/`、來源為 approved-v405 的同款柔和立體 Q 版。
- 固定識別：短黑髮、大眼、米白中式上衣、深綠圍裙、紅色直式「仙加味」。
- Rich Menu 不放產品主圖，避免舊包裝、宣傳版面或尺寸比例混進固定選單。
- 舊 `xianjiawei-rich-menu-2500x1686-v309.jpg` 只當 3×2 文字／圖示底版模板；部署時會以網站 Q 版小老闆覆蓋舊人物區。
- products-v2 才是產品實際照片；products-v3 屬宣傳版面，不能當產品主圖。

## 自動同步流程

1. `server.js` 第一行載入 `line-image-safety.js`。
2. `line-image-safety.js` 啟動 `line-rich-menu-sync.js`。
3. 系統讀取既有 2500×1686 3×2 底版與官網網站 Q 版小老闆來源。
4. Render 端使用 `sharp` 產生新版 JPEG。
5. 透過 LINE Messaging API 建立名稱含 `網站Q版` 的正式 Rich Menu。
6. 上傳 JPEG 後，自動設為所有使用者的預設 Rich Menu。
7. 若同一正式版本已存在，只重新確認設為預設，不重複建立。
8. 同步失敗只記錄錯誤，不影響 webhook 與正常聊天回覆。

## 相關檔案

- `line-rich-menu-sync.js`：建立圖片、六區動作、LINE API 同步。
- `line-rich-menu-sync.test.js`：驗證尺寸、六區動作與網站 Q 版來源。
- `line-image-safety.js`：即使 Render 直接跑 `server.js` 也會啟動 Rich Menu 同步。
- `line-recording-ui-fix.js`：產品 Flex 卡 products-v2、DM 按鈕、網站 Q 版卡片與組合金額用詞修正。

## 舊版處理

舊網址仍保留作底版模板與歷史追蹤：  
`https://ts15825868.github.io/xianjiawei/images/line/xianjiawei-rich-menu-2500x1686-v309.jpg`

它不再代表目前正式小老闆畫風。
