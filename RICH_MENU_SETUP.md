# 仙加味 LINE Rich Menu 正式管理方式

更新：2026-08-20

## 正式結論

仙加味正式六格圖文選單以 **LINE Official Account Manager 的「快速選單」** 為顧客端顯示權威。

目前正式漂亮版由 LINE OA Manager 管理圖片、排程與六格設定。Render／Messaging API 不得在服務啟動或重新部署時自動建立另一張 Rich Menu 並設為全體預設，避免把正式漂亮版覆蓋成程式備援版。

## 正式六格功能

1. 看產品
2. 購物車
3. 幫我推薦
4. 搭配組合
5. 怎麼使用
6. 直接下單

對話文字與 webhook 功能由 TS-LINE／Render 負責；底部六格正式視覺由 LINE OA Manager 負責。兩者職責分離。

## Render 啟動時的行為

`line-image-safety.js` 仍會呼叫 `line-rich-menu-sync.js` 的排程入口，但目前預設行為已改成 **authority reconciliation**：

1. 讀取 `LINE_RICH_MENU_AUTHORITY`。
2. 未設定時預設為 `oa-manager`。
3. 使用 LINE Messaging API 的 `DELETE /v2/bot/user/all/richmenu` 清除先前由 Messaging API 設定的全體預設 Rich Menu。
4. 不刪除 LINE OA Manager 的「快速選單」。
5. 不更改 OA Manager 的圖片、名稱、排程或六格配置。
6. 清除 API default 後，顧客端重新由 OA Manager 的正式漂亮版接管。

## 程式版 Rich Menu 的角色

Repo 中仍保留：

- `assets/rich-menu/xianjiawei-rich-menu-v12.svg.gz.b64`
- `line-rich-menu-sync.js` 的建立／上傳／設 default 能力

它們只作 **手動備援**，不是目前正式視覺來源。

只有明確設定：

```text
LINE_RICH_MENU_AUTHORITY=messaging-api
```

才允許 Render 使用 Messaging API 建立／上傳／設為全體預設。

正常正式環境不要設定這個值；預設 `oa-manager` 即為正式模式。

## 防回退規則

- Render 重啟不得重新覆蓋 OA Manager 正式快速選單。
- 新部署不得因舊 `richMenuId`、舊向量圖或舊同步器把顧客端改回程式簡化版。
- OA Manager 目前排程中的正式漂亮版不得由程式刪除。
- 若日後真的要改用 Messaging API 管理，必須是明確人工決策並設定 opt-in 環境變數。
- `line-rich-menu-sync.test.js` 必須驗證預設 authority 為 `oa-manager`，並驗證 API 管理只能 explicit opt-in。

## 驗收

正式部署後 Render log 應出現：

```text
仙加味 Rich Menu 已交還 LINE OA Manager 控制
```

並包含：

- `authority: "oa-manager"`
- `action: "cleared-messaging-api-default"`

若顧客端仍只在特定使用者看到舊版，再另查是否存在「使用者專屬 Rich Menu 綁定」；不得因此重新把 Messaging API global default 設回去。


## 2026-10-19｜新版六格商家合作選單（待 OA Manager 發布）

正式格位（左至右、上至下）：

| 格位 | 顯示名稱 | 訊息動作 |
|---|---|---|
| 1 | 看產品 | 看產品 |
| 2 | 購物車 | 查看購買清單 |
| 3 | 幫我推薦 | 幫我推薦 |
| 4 | 搭配組合 | 搭配組合 |
| 5 | 直接下單 | 直接下單 |
| 6 | 商家合作 | 商家合作 |

原「怎麼使用」保留於產品介紹、關鍵字及 FAQ，不占用圖文選單格位。

server.js 已有「商家合作」文字觸發之分步洽詢流程，毋須改動購物車或訂單程式。不可公開批發價、成本或內部客戶資料。

**發布程序**：在 LINE OA Manager 選 2500×1686、3 欄×2 列六格圖文選單版型，使用核准的圖片，依表設定每格「傳送訊息」動作，逐格預覽、測試，才發布。正式圖文選單由 OA Manager 管理；不得由 Render/Messaging API 自動覆蓋。僅 GitHub 文件更新不代表 LINE OA 已發布。


## 2026-10-19｜六格發布驗收與素材核對

新版六格維持 3 欄 × 2 列：看產品、購物車、幫我推薦、搭配組合、直接下單、商家合作。顧客端 OA Manager 尚未發布前，不得宣稱已替換。

正式上傳前必須確認：

1. 圖片 2500×1686 PNG，六格各有清楚文字、正式 Logo、小老闆（米白上衣、深橄欖綠圍裙、胸前直式仙加味印章）、小鹿與小烏龜分開；不得放虛構商品包裝。
2. 六格文字訊息依序為「看產品」「查看購買清單」「幫我推薦」「搭配組合」「直接下單」「商家合作」。
3. 保留「怎麼使用」關鍵字回覆，但不佔六格。
4. 使用 OA Manager 既有正式選單進行版本替換；先預覽與逐格驗證，避免與 Messaging API rich menu 權限衝突。
5. 商家合作只引導人工洽詢，不公開內部成本、批發價或未核准的合作身分。
6. 以顧客手機 LINE 聊天室實際顯示、點擊成功、下單功能不倒退為發布驗收條件。

二珍寶／四珍寶商務 DM 與共用官方名片的 QR 入口：連結入口 https://ts15825868.github.io/xianjiawei/links.html 及官方 LINE https://lin.ee/sHZW7NkR。商務 DM 不宣稱仙加味自製或正式代理。

## 2026-11-29｜六格正式定稿（取代上方舊版格位；OA Manager 實際發布待驗收）

使用者確認保留必要功能、去除誤導資訊並延續精緻六格插畫；不可因門市政策更新移除線上選購功能。三格簡化版不作最終設計。

| 格位 | 正式標題 | 副標 | Manager 訊息動作 |
|---|---|---|---|
| 1 | 看產品 | 商品介紹・官網 | 看產品 |
| 2 | 幫我推薦 | 協助挑選 | 幫我推薦 |
| 3 | 訂購與試喝 | 選購・試喝 | 訂購與試喝 |
| 4 | 搭配組合 | 日常・料理搭配 | 搭配組合 |
| 5 | 購買清單 | 查看選購明細 | 查看購買清單 |
| 6 | 商家合作 | 批發・通路洽詢 | 商家合作 |

新版第三格獨立服務卡提供「免費試喝」「選購商品」「查看購買清單」「價格與配送」「人工客服」；只導覽，不直接建立訂單，不清除清單或進行中的申請。使用原有正式試喝與購物流程。

正式美術：2500×1686、3×2，深藍／深紅／深綠、金色細框、米白字，正式小老闆、小鹿與小烏龜，分格情境且文字清楚。不使用虛構包裝、療效、固定門市時段或未確認取貨承諾。不啟用 API 備援圖覆蓋 Manager。舊10筆關鍵字不重新啟用。

先確認新入口已部署，再由 OA Manager 上傳正式完整圖，逐格設定訊息、預覽及驗證手機實際點擊。正式 Manager 發布尚無回執；此文件僅確立新規格。
