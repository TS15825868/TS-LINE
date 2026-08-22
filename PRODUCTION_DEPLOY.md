# 仙加味 TS-LINE 正式上線

更新：2026-08-22

## 正式部署

- Repository：`TS15825868/TS-LINE`
- 分支：`main`
- Runtime：Node.js 22
- 正式服務：Render `ts-line`
- 正式入口：`server.js`
- 自動部署：main 更新後由 Render 自動部署

## 正式產品狀態

- LINE OA 對外顯示六項正式產品
- 柒玄茶・龜鹿調飲粉暫時隱藏；資料保留，不公開、不推薦、不主動回覆
- 30cc：30cc／罐（小玻璃罐），維持裸罐與實際比例
- 180cc：180cc／包（鋁袋），維持正式鋁袋比例
- 龜鹿湯塊：75g／盒｜8塊裝｜每塊約9.375g
- 龜鹿膠：600g（1斤）／盒｜32塊裝｜每塊約18.75g
- 鹿茸粉：75g／罐

## 圖片與 Flex

- 正式產品圖、詳細 DM、試喝圖、歡迎圖各自分離，不互相替代
- 產品圖片不得 AI 重畫、改包裝、拉伸、裁切重要部位或改比例
- 歡迎卡固定正式歡迎 Hero，並提供「申請試喝／看產品／幫我推薦」三入口
- 看產品固定六張正式產品卡
- 手機情境卡維持精簡高度與留白

## Rich Menu

正式顧客端快速選單由 LINE Official Account Manager 管理。

Render／Messaging API 正式預設只做 authority reconciliation，不建立另一張全體預設 Rich Menu 覆蓋 OA Manager。程式版 Rich Menu 僅作手動備援。

## 啟動與驗收

Render 啟動前會同步目前產品權威並執行 readiness 驗證。正式驗收至少包含：

- 六項產品可見
- 柒玄茶隱藏
- 30cc 目前使用資料不回退成舊「每日一罐」規則
- 歡迎卡 Hero、文案與三入口正確
- 產品卡與試喝分流正確
- 正式圖片與 DM 角色分離
- Rich Menu 權威為 OA Manager

## 系統邊界

社群貼文排程、氣候貼文、貼文審核與 ERP 不屬於 TS-LINE 正式部署文件；這些功能由各自正式系統管理，不得再混入 LINE OA 啟動與部署流程。
