# 刷卡神隊友（Card Rewards Finder）

一個可直接部署在 **GitHub Pages** 的純前端信用卡回饋查詢工具，使用 `HTML + CSS + Vanilla JS`，不需要打包流程或後端服務。使用者可以搜尋通路關鍵字、比較不同卡片規則，並在本機（`localStorage`）維護自己的卡包。 

---

## 1) 專案定位與核心價值

這個專案的目標是用「最低部署複雜度」提供「可編輯、可搜尋、可排序」的回饋比較體驗：

- **零建置成本**：打開 `index.html` 就能跑，也可直接上 GitHub Pages。
- **資料在地化**：卡片資料預設來自 `data/sample-cards.json`，並同步到 `localStorage`，不依賴後端。
- **搜尋導向**：輸入「商店 / 情境」關鍵字即可找到對應規則。
- **權重排序**：不同型態回饋（現金%、哩程等）會被換算成可比較的「等效回饋率」，再排序顯示。

---

## 2) 功能總覽

### A. 找回饋（Search）
- 依「回饋類型 category」與「通路關鍵字 keywords」做模糊比對。
- 搜尋結果依等效回饋率高到低排序。
- 查詢字會在通路文字中高亮標示。

### B. 我的卡包管理（Manage）
- 顯示所有卡片及其規則。
- 可新增卡片、編輯卡片、刪除卡片。
- 可新增/刪除規則（至少需保留一條有效規則）。
- 長關鍵字清單會以 chip 呈現並支援展開/收合。
- 可重置為預設卡包資料。

### C. 初始化與復原
- 啟動時優先讀取 `localStorage` 的 `my_credit_cards`。
- 若資料不存在或格式錯誤，回退載入 `./data/sample-cards.json`。
- 若預設資料載入失敗，會顯示錯誤訊息並以空白資料啟動。

---

## 3) 技術架構（完整解析）

### 3.1 檔案結構

```text
.
├─ index.html              # UI 結構（雙分頁 + 編輯 Modal）
├─ style.css               # 視覺樣式（卡片、tab、chip、表單）
├─ app.js                  # 所有狀態、資料處理、渲染、事件綁定
├─ data/
│  └─ sample-cards.json    # 預設卡包資料
└─ README.md
```

### 3.2 執行模型

- **單一入口**：`init()` 依序執行資料載入、主題選單初始化、事件綁定、首屏渲染。
- **狀態中心**：`cardsState` 作為記憶體中的單一來源（single source of truth）。
- **渲染方式**：由 JS 以 template string 產生 HTML 並覆蓋容器內容（無框架）。
- **持久化**：每次異動後呼叫 `saveCards()` 寫回 `localStorage`。

### 3.3 資料正規化策略

`normalizeCards()` 會在載入時統一資料形狀，避免 UI 因髒資料壞掉：

- 缺 `id` 會補 `uid()`。
- `color` 不在白名單時落回預設色系。
- `rules` 若非陣列轉成空陣列。
- `percentage` 嘗試數字化，失敗轉 `null`。
- `keywords` 若是陣列會 join 成字串。

這讓資料來源（localStorage / JSON）不一致時仍可穩定運作。

---

## 4) 回饋計算與排序邏輯

### 4.1 顯示回饋文字

`rewardText(rule)` 規則：

1. 若 `percentage` 可解析數字，顯示 `N%`。
2. 否則顯示 `valueText`（例如 `18元/哩`）。
3. 再不行顯示 `-`。

### 4.2 等效回饋率（equivalentRate）

搜尋排序使用 `equivalentRate(rule, cardName)`：

1. 預設取 `percentage`。
2. 若 `valueText` 符合「元/哩」，會擷取數字 `n` 並換算 `(1 / n) * 100`。
3. 對特定卡名套用客製權重：
   - `CUBE`: `(percentage / 360) * 1000`
   - `Live+`: `percentage * 2`
   - `GoGo`: `(percentage / 11) * 13`
   - `旅人`: `(1 / 18) * 100`
   - `飛行`: `(1 / 22) * 100`

> 這是專案內定的比較模型，目的是讓不同回饋型態可在同一清單裡排序。

---

## 5) 搜尋流程拆解

使用者輸入關鍵字後：

1. `flattenMatches(query)` 逐卡逐規則掃描。
2. 比對來源：
   - `rule.category`（類別）
   - `rule.keywords`（通路清單，會先切詞）
3. 命中後組成 row，帶入 `equivalentRate`。
4. 依等效回饋率由高到低排序。
5. `renderSearchResult()` 渲染結果；查無資料時顯示空狀態文案。

---

## 6) 卡包管理流程拆解

### 6.1 新增/編輯卡片

- `openEditor(cardId)`：開啟 Modal，若有 `cardId` 載入既有資料。
- `collectEditorForm()`：收集欄位並驗證：
  - `bank`、`name` 必填。
  - 至少要有一條非空規則。
- `editor-save`：
  - 編輯模式：以 `map` 更新指定卡。
  - 新增模式：`unshift` 新卡到最前方。
- 成功後 `saveCards()` + 重繪列表。

### 6.2 刪除卡片

- 管理頁點擊刪除按鈕。
- 經 `confirm` 後，自 `cardsState` 濾除該卡並保存。

### 6.3 重置資料

- 按下「重置卡片資料」→ `confirm`。
- 移除 `localStorage` 鍵值。
- 重新從預設 JSON 載入並保存。

---

## 7) 資料格式（Card Schema）

```json
{
  "id": "card_xxx",
  "bank": "國泰",
  "name": "CUBE卡",
  "color": "藍色系",
  "rules": [
    {
      "id": "rule_xxx",
      "category": "玩數位",
      "percentage": 3,
      "valueText": "",
      "keywords": "Google Play,Apple,iTunes",
      "note": "需切換【玩數位】"
    }
  ]
}
```

欄位說明：

- `percentage`：數值型回饋（可為 `null`）。
- `valueText`：文字型回饋（如哩程、區間）。
- `keywords`：逗號或空白分隔字串，搜尋時會切詞。
- `color`：需在內建色系清單內，否則會被正規化成預設值。

---

## 8) UI/UX 設計重點

- 雙分頁底部導覽（Search / Manage）適合行動裝置操作。
- 搜尋結果卡片與管理卡片沿用同一視覺語彙，降低認知成本。
- 關鍵字 chip 設計避免長列表撐爆畫面。
- 編輯採 Modal，維持操作上下文，不離開主頁。

---

## 9) 本機啟動與部署

### 本機快速啟動

可直接用瀏覽器開 `index.html`，或建議用簡易 HTTP 伺服器（避免某些環境對 `fetch` 的檔案協定限制）：

```bash
python3 -m http.server 5500
# 開啟 http://localhost:5500
```

### GitHub Pages 部署

1. 推送程式到 GitHub repo。
2. 在 `Settings > Pages` 選擇分支（如 `main`）與根目錄。
3. 儲存後等待頁面發布。

---

## 10) 常見維護任務

### 更新預設卡包

修改 `data/sample-cards.json`，並確保為合法 JSON 陣列。

### 強制重新初始化使用者資料

在瀏覽器 Console 執行：

```js
localStorage.removeItem('my_credit_cards');
location.reload();
```

### 調整權重公式

修改 `app.js` 內 `equivalentRate()` 的分支邏輯即可。

---

## 11) 已知限制與可改進方向

- 目前無後端同步，資料只存在單一瀏覽器。
- 權重公式為專案規則，非財務建議或真實年化報酬模型。
- 搜尋為基本字串比對，可進一步導入同義詞、拼字容錯、分詞策略。
- 可擴充為：
  - 匯入/匯出 JSON
  - 規則生效期間與上限欄位
  - 多幣別、海外手續費、門檻條件

---

## 12) 授權

可依你的專案需求補上（例如 MIT License）。
