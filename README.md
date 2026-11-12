# 影城訂票資料庫｜SQL 查詢練習

以虛構的「長巷影城」為案例，可以直接在網頁上修改、執行 SQL 的資料庫作業。
SQL 透過 [sql.js](https://sql.js.org/)（SQLite 的 WebAssembly 版本）在瀏覽器中執行，不需要後端伺服器，可以直接部署到 GitHub Pages。

## 檔案結構

| 檔案 | 內容 |
|---|---|
| `index.html` | 網頁結構與文字：案例背景、ERD、設計重點 |
| `css/style.css` | 樣式 |
| `js/data.js` | 建表 SQL（`SCHEMA_SQL`）、樣本資料（`SEED_SQL`）、欄位說明（`TABLE_DOCS`） |
| `js/queries.js` | 8 道查詢題（`QUESTIONS`）與 5 組結果比較（`COMPARISONS`） |
| `js/app.js` | 載入資料庫、執行 SQL、產生畫面的程式 |

想換電影或資料，只要改 `js/data.js`；想改題目，改 `js/queries.js`。
「預期結果」是網頁載入時執行參考 SQL 算出來的，所以改了資料之後會自動更新。
不過 `queries.js` 裡的文字說明（例如「從 8 列變成 0 列」）需要自己手動同步修改。

## 本機預覽

直接用瀏覽器開啟 `index.html` 就可以（需要網路連線，才能從 CDN 載入 sql.js 與 Mermaid）。

## 部署到 GitHub Pages

1. 在 GitHub 建立一個新的 **public** repository，例如 `cinema-sql`
2. 把這個資料夾的所有檔案上傳到 repository 根目錄（`index.html` 必須在最外層）
3. 進入 repository 的 **Settings → Pages**
4. **Source** 選 `Deploy from a branch`，Branch 選 `main`、資料夾選 `/ (root)`，按 **Save**
5. 等 1～2 分鐘，網址會是 `https://<你的帳號>.github.io/cinema-sql/`
6. 用無痕視窗和手機各打開一次，確認可以執行 SQL
