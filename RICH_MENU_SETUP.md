# 仙加味 LINE OA Rich Menu｜正式版

正式尺寸：2500 × 1686 px  
正式版型：3 欄 × 2 列  
正式程式：`line-rich-menu-sync.js`

目前 Rich Menu 已改為 **單一完整 SVG 向量母稿**。不再使用舊 JPG 底版、不再把六張角色圖後貼合成，也不依賴 Render 主機中文字型。

## 六個正式功能區

| 區域 | 顯示名稱 | LINE 傳送文字 |
|---|---|---|
| 左上 | 看產品 | `看產品` |
| 中上 | 購物車 | `查看購買清單` |
| 右上 | 幫我推薦 | `幫我推薦` |
| 左下 | 搭配組合 | `搭配組合` |
| 中下 | 怎麼使用 | `怎麼使用` |
| 右下 | 直接下單 | `直接下單` |

Rich Menu 固定六格只放最常用入口；`申請試喝`、`價格方案`、`常見問題`、`人工客服` 仍由 Quick Reply 與文字關鍵字直接進入，不需要塞入固定選單。

## 正式視覺規則

- 母稿：`assets/rich-menu/xianjiawei-rich-menu-v12.svg.gz.b64`
- 原始設計尺寸固定 2500×1686
- 顧客可見繁中文字全部轉為 SVG path，避免亂碼／缺字
- 不內嵌照片、不使用舊產品圖、不使用產品拼貼
- 不產生黑色空白補位區
- 不使用 `sharp.composite()` 做 runtime 拼貼
- 點擊熱區只覆蓋六個功能面板；品牌 Header 不成為熱區
- 產品本體與 Rich Menu 視覺分離，避免產品包裝或比例更新時污染固定選單

## 正式產品圖片角色

Rich Menu 本身不放產品主圖。LINE 產品訊息的圖片來源另依目前產品媒體權威：

- 顧客產品介紹：`assets/data/official-products.json` 的 `approvedProductImage`
- 詳細 DM：各產品 `approvedDm`
- 試喝：2026-08-14 使用者核准的小老闆試喝海報
- `products-v3`：只作實際產品外觀、包裝與比例身份參考
- `products-v2`：退役／歷史參考，不得恢復成正式顧客顯示來源

## 自動同步流程

1. `server.js` 啟動時載入 LINE 圖片安全層。
2. `line-image-safety.js` 啟動 `line-rich-menu-sync.js`。
3. 程式讀取單一正式 SVG 母稿並檢查尺寸、向量字與禁止元素。
4. Render 端使用 `sharp` 直接把完整 SVG 轉成 JPEG；不另外拼貼圖片。
5. 透過 LINE Messaging API 建立／確認目前正式 Rich Menu。
6. 上傳 JPEG 後設為所有使用者預設選單。
7. 同一正式版本已存在時只確認預設，不重複建立。
8. 舊仙加味正式選單會在新選單成功後安全清理。
9. LINE API 暫時失敗時只做有限次安全重試；缺少憑證時停止，不影響 webhook 正常啟動。

## 驗收

`line-rich-menu-sync.test.js` 會驗證：

- 2500×1686 尺寸
- 六個熱區與正確傳送文字
- 單一完整 SVG 母稿
- 無 `<text>` 字型依賴
- 無 `<image>` 舊圖片內嵌
- 無黑色補位
- 無 runtime composite
- 有限次安全重試

執行：

```bash
npm test
```

## 退役資料

舊 `xianjiawei-rich-menu-2500x1686-v309.jpg`、舊 JPG 模板與「底版＋後貼小老闆」流程只屬歷史資料，不是目前正式 Rich Menu 的任何一部分，也不得重新接回 runtime。
