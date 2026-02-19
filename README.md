# 信用卡回饋查詢（GitHub Pages 靜態版 v2）

這個版本已從 MVP 升級為「手機優先單頁 App」，維持純 `HTML + CSS + Vanilla JS`，不需要 React/Vite/Node build，可直接部署在 GitHub Pages（`main` branch / root）。

## 功能總覽

- 底部 Tab：
  - **找回饋（Search）**：以 `category / keywords` 模糊搜尋。
  - **卡包管理（Manage）**：檢視、編輯、刪除卡片。
- **新增/編輯卡片（Editor）**：使用 modal 形式編輯 `bank/name + 多條 rules`。
- **localStorage 優先載入**：
  - key: `my_credit_cards`
  - 若 localStorage 無資料，會讀取 `cards.json`，並自動轉換舊版資料結構。
- 搜尋結果扁平化輸出（每條命中 rule 一筆），並顯示等效回饋率「權重約 xx.xx%」。
- 支援 category / keywords 高亮，含 query 正規字元 escape。

## GitHub Pages 部署方式

1. 將本 repo push 到 GitHub。
2. 到 GitHub repo 的 `Settings` → `Pages`。
3. Build and deployment 選擇：
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/root**
4. 儲存後等待部署完成，即可透過 Pages 網址開啟。

## 重置 localStorage

### 方式 A（頁面按鈕）
在「卡包管理」頁按 **重置 localStorage**，會清除 `my_credit_cards` 並重新讀取 `cards.json`。

### 方式 B（瀏覽器開發者工具）
在 Console 執行：

```js
localStorage.removeItem('my_credit_cards')
location.reload()
```

## 資料格式（v2）

網站核心資料使用 `cards[]` 結構：

```json
[
  {
    "id": "card_xxx",
    "bank": "國泰世華",
    "name": "CUBE 卡",
    "rules": [
      {
        "id": "rule_xxx",
        "category": "超商",
        "percentage": 3.0,
        "valueText": "",
        "keywords": "7-11, 全家, 超商",
        "note": "限制條件..."
      }
    ]
  }
]
```

> `percentage` 與 `valueText` 可擇一使用（或都填），搜尋會依規則計算 `equivalentRate`。

## 舊版 cards.json 自動轉換

若 `cards.json` 仍是舊版扁平格式：

```json
{ "merchant": "7-11", "bank": "國泰世華", "card": "CUBE 卡", "reward": 3.0, "note": "..." }
```

載入時會自動轉成新格式：
- 以 `bank + card` 分組成 card。
- `merchant` 轉為 `rule.category`。
- `merchant` 同步寫入 `rule.keywords`（便於搜尋）。
- `reward` 轉為 `rule.percentage`。

## 功能驗收清單

- [x] 手機優先單頁 App + 底部 Tab（Search / Manage）。
- [x] Editor modal（新增/編輯卡片 + 多條 rules）。
- [x] localStorage（`my_credit_cards`）讀寫與優先載入。
- [x] 舊格式 `cards.json` 自動轉換為 `cards[]`。
- [x] 搜尋命中條件：`category.includes(query)` 或 `keyword.includes(query)`。
- [x] 結果扁平化 + 依 `equivalentRate` 由高到低排序。
- [x] category / keywords 命中高亮，並 escape regex 特殊字元。
- [x] 等效回饋率（含 CUBE / Live+ / GoGo / 旅人 / 飛行 特例）顯示「權重約 xx.xx%」。
- [x] Manage 可編輯/刪除，刪除具 confirm。

