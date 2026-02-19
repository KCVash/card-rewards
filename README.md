# 信用卡回饋查詢（GitHub Pages 靜態版 v3）

此版本維持純 `HTML + CSS + Vanilla JS`，不需要 React/Vite/Node build，可直接部署在 GitHub Pages。

## 預設卡包來源

- App 啟動會先讀取 localStorage：`my_credit_cards`。
- 若 localStorage 不存在、JSON 解析失敗、或不是陣列，會改為載入 `./data/sample-cards.json`。
- 預設卡包載入後會 normalize（補齊 card/rule id、rules 非陣列時轉空陣列），並寫回 localStorage。
- 若 `./data/sample-cards.json` 載入失敗，畫面會顯示「無法載入預設卡包資料」，並以空陣列啟動（App 仍可使用）。

## 如何恢復預設資料

### 方式 A（頁面按鈕）
在「卡包管理」頁按 **重置 localStorage**，重新整理後會再次從 `./data/sample-cards.json` 初始化。

### 方式 B（瀏覽器 Console）

```js
localStorage.removeItem('my_credit_cards')
location.reload()
```

## 目錄結構

- `index.html`
- `app.js`
- `style.css`
- `data/sample-cards.json`
