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
