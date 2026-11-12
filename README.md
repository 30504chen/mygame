# Death Line｜像素跑酷

岩漿洞穴主題的像素風橫向捲軸跑酷遊戲。純 Canvas 2D、無外部圖片與字型，支援鍵盤操作，含 6 個關卡區段、24 個感應突襲點、60 枚金幣與全球排行榜。

**線上遊玩：** <https://30504chen.github.io/mygame/>

## 檔案

- `index.html`：頁面、畫布、名字輸入視窗
- `style.css`：頁面與像素縮放樣式
- `game.js`：遊戲邏輯、繪圖、音效、排行榜流程
- `firebase.js`：Firebase 全球排行榜（Firestore）
- `firestore.rules`：Firestore 安全規則
- `firebase.json`：Firebase CLI 設定

## 操作

| 按鍵 | 功能 |
| --- | --- |
| ← → / A D | 左右移動 |
| 雙擊 A / D 後按住 | 加速跑（左右皆可） |
| 空白 / ↑ | 跳躍（可二段跳） |
| S / ↓ | 蹲下（按住） |
| Esc | 暫停 / 返回 |
| R | 重新開始本輪 |
| M | 靜音 |

## 本機執行

直接雙擊 `index.html` 可以玩，但 `file://` 模式會自動使用**本機排行榜**。

要測試全球排行榜，請用任一靜態伺服器開啟，例如：

```powershell
# 在專案資料夾內
python -m http.server 8080
# 或使用 VS Code Live Server
```

再開啟 `http://localhost:8080`。

## Firebase 全球排行榜設定

專案已接上 Firebase 專案 `mygame-5c409`，使用 Firestore 集合 `scores`。

### 1. Firestore 資料庫

此專案使用 Firebase 專案 `mygame-5c409` 的 Firestore。若日後重建，請到 Firebase Console → **Build → Firestore Database → Create database**，選擇 **Production mode**（正式模式）建立。

### 2. 部署安全規則

`firestore.rules` 會限制：

- 所有人可讀取排行榜
- 只能寫入合法成績（分數 0–7000、金幣 0–60、時間 > 0、死亡次數 ≥ 0）
- 同名成績只能變好，不能變差
- 前端不能刪除全球紀錄

使用 Firebase CLI 部署：

```powershell
npm install -g firebase-tools
firebase login
firebase use mygame-5c409
firebase deploy --only firestore:rules
```

或直接把 `firestore.rules` 的內容貼到 Firebase Console → Firestore → Rules → Publish。

> **重要：** 如果 Firestore 目前還是測試模式（`allow read, write: if true`），任何玩家都能刪除全球榜。請務必部署上面的規則，或至少把 Rules 貼進 Console 後按 Publish。

### 3. GitHub Pages

本專案已連到 <https://github.com/30504chen/mygame>，GitHub Pages 設定為 `main` / `/ (root)`，線上網址是 <https://30504chen.github.io/mygame/>。

之後更新版本：

```powershell
git add .
git commit -m "Update Death Line"
git push
```

> Firestore 不需要把 GitHub Pages 網域加入授權網域；那是 Firebase Authentication 才需要的設定。

> repo 裡的 `run/` 是舊版重複資料夾，GitHub Pages 使用的是根目錄；如果不需要，可以在 GitHub 上刪除 `run/`，不影響線上版本。

## 排行榜行為

- 讀取 Firestore 中分數最高的前 50 筆，前端再依「分數 → 時間 → 死亡次數」排序取前 10 名。
- 文件 ID 使用 `n_` + `encodeURIComponent(名字)`，同名只保留一筆。
- 寫入使用 Firestore Transaction：只有更好的成績才會覆蓋。
- 網路或 Firebase 失敗時，自動退回本機排行榜，遊戲仍可正常遊玩。
- 為了避免任何玩家清空全球榜，前端已移除 C 清除功能；需要清除時請到 Firebase Console 操作。

## 安全說明

`firebase.js` 內的 `apiKey` 是 Firebase Web API Key，本來就會公開在前端。真正的存取控制由 `firestore.rules` 負責，請務必部署規則，不要使用 `allow read, write: if true` 的測試規則上線。

另外，純前端遊戲的成績仍可能被改造後直接送出；若需要嚴格防作弊，建議加入 Firebase App Check，或把成績驗證移到伺服器端。
