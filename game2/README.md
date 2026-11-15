# 休閒釣魚 — 海島生活（單機版）

2.5D 等角視角休閒遊戲：釣魚、料理、採集、礦坑、商人、倉庫。
純靜態網頁，不需建置；直接用瀏覽器打開 `island3d.html` 即可（需經 HTTP 協議，GLB 模型無法走 `file://`）。

## 🔒 兩份副本都要同步修改

本專案存在**兩個位置**，功能完全相同，修改時**務必兩邊一起改**：

1. `C:\Users\e2253\OneDrive\ドキュメント\預設專案 - 單機版\demo`（開發用，本地測試）
2. `C:\Users\e2253\OneDrive\ドキュメント\GitHub\mygame\game2`（GitHub 上傳版，GitHub Pages 部署）

> 目前無自動同步機制，新增功能、修 bug、調平衡都要手動套用到兩個位置。
> 測試一律用 `?save=test`（獨立存檔 profile），不要直接動到玩家正式檔。

## 存檔與遊戲本身是分開的檔案

**存檔存在玩家自己的瀏覽器 localStorage，跟遊戲程式碼是兩件事。**

| 類別 | 位置 |
|---|---|
| 遊戲本身（HTML／JS／CSS／模型／貼圖） | 本 repo 的檔案 |
| 玩家的進度 | 玩家瀏覽器 `localStorage`，key = `island3d.save.v1`（`?save=test` → `island3d.save.test`） |

- **更新遊戲不會動到玩家存檔**：玩家打開同一個網址會自動吃到新版程式，存檔不受影響
- 舊存檔能不能正常讀進新版，只看這三件事：
  1. 物品／料理／卡片／任務／魚種的 **key 是否改名**（改名一定要寫 `migrate...()` 遷移函式，參考 `js/core/save.js` 的 `migrateOldMinerals`、`migratePickaxe`）
  2. 存檔裡**按位置索引的陣列**（`picks`/`spots`/`worms`）是否被重新排序——只能在尾端 append，不能排序、插入、刪除
  3. `s.v` **版本號**是否被 bump 而沒寫舊檔遷移（`loadGame()` 只認 `v === 1`）
- **網址變了＝舊存檔讀不到**（資料其實還在舊網址的瀏覽器空間裡）：上傳前先固定網址
- 玩家換裝置／清瀏覽器資料 → 存檔拿不回來（localStorage 的本質限制，只能被玩家自己保命）
- 測試參數 `?nosave=1`、`?demo=...` 完全不讀寫存檔，不會污染玩家檔案

> ⚠️ 遊戲程式碼（本 repo）與存檔完全分開。新增功能／改存檔格式前，請先讀 `js/core/save.js` 頂部的「存檔安全規則」。

## 本機執行

### 方法一（推薦）
雙擊 `serve.ps1`（需 Windows PowerShell）：
```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1
```
然後開 `http://localhost:8080/island3d.html`

### 方法二
任何靜態伺服器都行，例如：
```
npx http-server . -p 8080
```

## 線上遊玩

上傳到 GitHub Pages 後直接開：
```
https://<你的帳號>.github.io/<repo>/island3d.html
```

## 操作

| 按鍵 | 功能 |
|---|---|
| WASD | 移動 |
| E | 互動（釣魚／砍樹／開倉庫…） |
| Space | 跳躍 |
| I | 背包 |
| B | 圖鑒 |
| M | 靜音 |
| Shift | 跑 |

## 測試與除錯參數（網址加在 `island3d.html` 後面）

- `?nosave=1` 完全不讀寫存檔（乾淨的測試環境）
- `?save=test` 用獨立存檔 profile（測試不碰玩家正式檔）
- `?pose=x,z[,yaw]` 直接傳送到指定位置
- `?t=0.35` 指定時間（0=清晨…0.9=夜晚）
- `?daylen=60` 改變一天的長度（預設 120 秒）
- `?low=1` 低畫質模式（1x 像素比、512 陰影）

## 專案結構

```
island3d.html        入口
css/                  樣式
js/core/              場景、世界、存檔
js/actors/            角色、商人、自然素材
js/mine/              礦坑場景、挖掘邏輯
js/sim/               時間、釣魚、背包、採集、料理、合成、任務
lib/                  three.js（UMD）＋ GLTFLoader
assets/               模型（GLB/GLTF）與貼圖
serve.ps1             本機靜態伺服器
```
