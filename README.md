# 仙加味 LINE OA 正式版

目前正式部署為 **獨立 LINE OA 服務**，正式入口為 `server.js`。

- `package.json` main：`server.js`
- Render prestart：`node tools/sync_sales_master_current.js --write`，先把目前正式權威同步進執行資料
- Render start：`node -r ./product-sales-master.js -r ./line-app-bootstrap.js -r ./brand-content-runtime.js server.js`
- LINE OA 不與 ERP、貼文中心或社群發布服務共用啟動入口
- LINE 與 CRM 憑證只從部署環境變數讀取，不寫入 GitHub 或公開前端

## 正式資料權威

目前 LINE OA 依下列層級運作：

1. `assets/data/official-products.json`：目前正式產品名稱、主規格、產品圖、詳細 DM、試喝圖、出貨與媒體角色權威
2. `line-sales-master.json`：價格、促銷、組合、付款配送等銷售基礎資料
3. `line-product-photo-authority.json`：`products-v3` 實際產品外觀、包裝與比例身份參考
4. `tools/sync_sales_master_current.js` + `product-sales-master.js`：啟動時合併並強制套用目前正式權威
5. `data.json`：LINE 正式執行資料

### 圖片角色不得混用

- **產品介紹主圖**：使用 `official-products.json` 的 `approvedProductImage`，目前為六張 customer-display 正式產品圖
- **詳細 DM**：使用各產品 `approvedDm`
- **試喝主圖**：固定使用 2026-08-14 使用者核准的小老闆試喝海報
- **products-v3**：只作產品實物身份、包裝與比例校正，不直接取代 LINE 一般產品介紹主圖
- 舊 `products-v2`、舊試喝圖、退役 DM 不得恢復成正式顧客顯示來源

## 六個正式產品、六個正式主規格

1. 龜鹿膏：100g／罐
2. 龜鹿飲30cc玻璃罐：30cc／罐（小玻璃罐）；裸罐、無貼紙，不得稱瓶或改罐型比例
3. 龜鹿飲180cc鋁袋：180cc／包（鋁袋）；保持狹長直立比例
4. 龜鹿湯塊：75g （2兩）／盒｜8塊裝；每塊約9.375g只屬詳細資料
5. 龜鹿膠：600g （1斤）／盒｜32塊裝；每塊約18.75 g只屬詳細資料
6. 鹿茸粉：75g／罐

所有產品圖片一律維持正式產品外觀與比例，不重畫、不裁切、不拉伸、不更換包裝文字或規格。

## 龜鹿飲價格、試喝與出貨

目前 LINE 銷售資料：

- 30cc：60元／罐；買10送1，共11罐600元
- 180cc：200元／包；買10送1，共11包2,000元
- 30cc 試喝組：3罐試喝品免費，運費自付
- 7-11店到店60元；郵局宅配100元
- 每位顧客、電話及地址限申請一次
- 試喝運費確認完成後才安排製作；試喝組不使用貨到付款
- 30cc／180cc龜鹿飲皆為接單後安排製作，約5～7個工作天完成後安排出貨；物流配送時間另計
- 龜鹿膏、龜鹿湯塊、龜鹿膠、鹿茸粉依現貨狀況安排，不套用龜鹿飲5～7工作天

價格與活動屬可更新資料；新版正式權威優先，不得由舊 workflow 或舊文件反向覆蓋。

## Rich Menu

正式 Rich Menu 使用 **單一 2500×1686 原生 SVG 向量母稿轉 JPEG**：

- 不使用照片拼貼
- 不使用舊 JPG 底版
- 不做 runtime composite
- 顧客可見繁中文字已轉向量 path，不依賴 Render 主機中文字型
- 六個點擊熱區只覆蓋實際功能面板

六個功能區：

1. 看產品
2. 購物車
3. 幫我推薦
4. 搭配組合
5. 怎麼使用
6. 直接下單

Render 啟動後由 `line-rich-menu-sync.js` 自動建立／確認並設為預設；LINE API 暫時失敗時只做有限次安全重試，不無限呼叫。

試喝、價格、FAQ、人工客服等功能仍可由訊息關鍵字與 Quick Reply 直接進入，不需要把所有功能都塞進固定 Rich Menu。

## LINE 回覆與圖片

- 產品 Flex hero 使用 `aspectMode: fit`
- 30cc、180cc 與其他產品維持各自實際比例
- 產品介紹、實際產品照片、詳細 DM、試喝圖各自使用正確角色
- 非產品說明卡使用 LINE OA 專用 Q 版小老闆情境圖
- 小老闆依推薦、使用、FAQ、客服、品牌與歡迎等語意選擇場景
- 圖片或 Flex 發送失敗時保留純文字備援，不影響顧客取得基本資訊

## 正式關鍵字與流程

主要入口包含：

- `申請試喝`
- `看產品`
- `價格方案`
- `幫我推薦`
- `搭配組合`
- `怎麼使用`
- `常見問題`
- `查看購買清單`
- `直接下單`
- `我要人工客服`

敏感健康問題不自行做療效判斷，改由合作中醫師諮詢流程承接。

## 正式環境變數

LINE OA 必要：

- `CHANNEL_ACCESS_TOKEN`
- `CHANNEL_SECRET`

其他 CRM 或外部服務設定只有在正式程式實際使用時才配置；ERP、社群發布與貼文審核憑證不屬於 LINE OA `start` 的必要依賴。

## 正式檢查

```bash
npm test
npm run check:catalog
```

`npm test` 目前會檢查產品權威、30cc／180cc比例與命名、價格與試喝、出貨政策、Rich Menu、Webhook、圖片權威與 LINE-only 正式入口。

## 健康檢查

- LINE OA：`/healthz`
- 產品與出貨規格：`/internal/api/v2/fulfillment-policy/healthz`

貼文審核、社群發布與 ERP 的健康檢查由各自獨立正式服務負責。
