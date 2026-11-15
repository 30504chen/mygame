# 休閒釣魚 — 海島生活（單機版）

2.5D 等角視角休閒遊戲：釣魚、料理、採集、礦坑、商人、倉庫。
純靜態網頁，不需建置；直接用瀏覽器打開 `island3d.html` 即可（需經 HTTP 協議，GLB 模型無法走 `file://`）。

## 線上遊玩

上傳到 GitHub Pages 後直接開：

```
https://<你的帳號>.github.io/<repo>/island3d.html
```

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

## 存檔

進度存在瀏覽器 localStorage（`island3d.save.v1`），與網站位址綁定：
換網址＝另一份存檔（舊網址的存檔仍在）。

> ⚠️ 遊戲程式碼（本 repo）與存檔完全分開；更新程式碼不會動到玩家資料。
> 新增功能／改存檔格式時，請先讀 `js/core/save.js` 頂部的「存檔安全規則」。

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
