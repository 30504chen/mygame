/* save.js — 海島 3D Demo：island3d 的一部分

   ===== 存檔安全規則（給未來修改這段程式的 AI／人工） =====
   使用者的舊資料與程式碼完全分開：
   存檔存在瀏覽器 localStorage，跟 js/css/html 毫無關係。更新程式碼本身不會動到存檔，
   但下面這些地方一旦錯誤，玩家舊資料就會壞掉或讀不到——修改時務必遵守。

   【鐵律】
   1. `v: 1` 是硬門檻：`loadGame()` 只認 `s.v === 1`。要大改存檔格式、決定 bump 成 v2
      之前，必須先保留 v1 的讀取路徑或把 v1 舊檔遷移成新格式；否則舊玩家會被整批
      當成新遊戲（舊檔還留在 localStorage，但原封不可讀）。
   2. picks / spots / worms 是「按位置索引」的陣列：
      存檔用第幾格對應哪個採集點／魚群，不可以 reorder、插入、刪除舊項目；
      新增點只能 append 在陣列尾端。新品種的物件請用全新的獨立陣列。
   3. 物品／料理／卡片／任務／魚種／特效卡的 key 只會新增、不會刪改：
      舊存檔沒有新 key 時當作初值讀回很安全；舊 key 若改名，就一定要寫
      migrate...() 遷移函式（loadGame() 內）。參考範例：
        - migrateOldMinerals()：石頭／銅礦… → 石碎屑／銅碎屑…
        - migratePickaxe()：鎬子耐久 >0 拆成「使用中鎬子」+ 備用「鎬子」
        - migrateNightfallPotion()：舊藥水補上 use: 'nightfall'
   4. 整個存檔的 per-origin 都是獨立的：換域名／埠／協定等於玩家換了網址，
      舊存檔在舊網址裡其實沒被清掉，只是新網址讀不到——部署正式網域必須固定網址，
      或提前告知使用者。
   5. `refresh / F5` 一律把玩家放回島上小屋門口（不會回到礦坑或黑暗場景），
      因為礦坑是獨立的 `AREA='mine'`、畫面漆黑，會讓玩家以為遊戲跳到夜晚。
      不要改回「載入後恢復 s.area」。
   6. clearSave() 會清 `island3d.save.v1` 與 `island3d.mine.seed`：新遊戲要連礦物／
      菇點／發光貝殼位置一起重新洗牌，這是刻意的，不要只要清存檔不清種子。
   7. 新增存檔欄位的正確做法：snapshot() 中加入欄位，loadGame() 中用
      `if (s.xxx !== undefined)` 讀回、舊檔沒有就給預設值；不要無條件
      `s.xxx` 直接解構。
   8. 數值平衡（價格、倍率、DAY_SECONDS…）改了不會壞存檔；真正會壞的只有
      「陣列索引順序」、「物品 key」、「版本號 v」這三件事。

   【測試紀律】
   - 日常測試一律用 `?save=test`（寫入 island3d.save.test，不碰玩家正式檔）
     或 `?nosave=1`（完全不讀寫存檔）；不要用私人瀏覽或無痕視窗改完才發現。
   - 改了物品 key 的場合，確認 migrate 函式在 loadGame 裡跑到：數量保留、不變 ?????。
   - 新增採集點／魚群：舊檔陣列長度 < 新陣列長度時，forEach 只迭代舊長度，
     新點預設 active: true 即可（隨版本上線），不需要特別遷移。
   ============================================================ */
/* ============================================================
   自動存檔（localStorage）
   ============================================================ */
const SAVE_PROFILE = new URLSearchParams(location.search).get('save') || 'v1';
const SAVE_KEY = 'island3d.save.' + SAVE_PROFILE;
/* 測試／截圖用的網址參數不讀也不寫，保證每次都是乾淨的第 1 天 */
const NO_SAVE = /[?&](demo|nosave|freeze|phase|pose|t|daylen|night|fixdt)=/.test(location.search);
let saveAcc = 0;

/* ⚠ 存檔安全規則（save.js 頂部「存檔安全規則」）：新增欄位只能在尾端加、
   不刪改舊欄位；陣列欄位只能 append、不可 reorder。 */
function snapshot() {
  return {
    v: 1, ts: Date.now(),
    gold: gold, diamond: diamond, bait: bait, sat: satiety,
    t: dayT, day: dayIndex,
    inv: inventory, sto: storage, dex: dex,
    tools: Object.keys(TOOLS).reduce((o, k) => { o[k] = TOOLS[k].lv; return o; }, {}),
    storeLv: storeLv, storeSize: STORE_SIZE,
    tilled: Array.from(tilled),
    picks: pickSpots.map(p => (p.active ? 1 : 0)),
    spots: spots.map(p => (p.active ? 1 : 0)),
    worms: wormSpots.map(p => (p.active ? 1 : 0)),
    quests: Object.assign({}, quests),
    mute: muted,
    area: (typeof AREA !== 'undefined') ? AREA : 'island',
    mine: (typeof mineSaveState === 'function') ? mineSaveState() : null,
    mineralStore: mineralStore,
    mineralStoreLv: mineralStoreLv,
    mineralStoreSize: MINERAL_STORE_SIZE,
    special: (typeof special !== 'undefined') ? Object.assign({}, special) : null,
    hero: [heroPos.x, heroPos.z]
  };
}

function saveGame() {
  if (NO_SAVE) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot())); } catch (e) { }
}

function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { }
  /* 新遊戲：礦物位置也重新洗牌 */
  try { localStorage.removeItem('island3d.mine.seed'); } catch (e) { }
}

function copyBag(dst, src) {
  Object.keys(dst).forEach(k => { delete dst[k]; });
  if (src) Object.keys(src).forEach(k => { dst[k] = src[k]; });
}

/* ⚠ 舊檔遷移依照檔案頂部「存檔安全規則」規則 3：新增物品 key 只加不改；
   改名舊 key 必在此寫 migrate...() 函式。清理規則請勿動 `if (s.xxx !== undefined)` 的保護。 */
function loadGame() {
  if (NO_SAVE) return false;
  let s = null;
  try { s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { s = null; }
  if (!s || s.v !== 1) return false;

  gold = s.gold || 0;
  diamond = s.diamond === undefined ? 0 : s.diamond;
  bait = s.bait === undefined ? 10 : s.bait;
  satiety = s.sat === undefined ? 100 : s.sat;
  copyBag(inventory, s.inv);
  copyBag(storage, s.sto);
  copyBag(dex, s.dex);

  /* 舊存檔的礦物名稱改為碎屑，保留原數量 */
  (function migrateOldMinerals() {
    const MIGRATE = { '石頭': '石碎屑', '銅礦': '銅碎屑', '鐵礦': '鐵碎屑', '銀礦': '銀碎屑', '金礦': '金碎屑' };
    for (const bag of [inventory, storage]) {
      for (const oldName of Object.keys(MIGRATE)) {
        const newName = MIGRATE[oldName];
        const rec = bag[oldName];
        if (!rec) continue;
        delete bag[oldName];
        if (bag[newName]) {
          bag[newName].count += rec.count;
          bag[newName].maxSize = Math.max(bag[newName].maxSize || 0, rec.maxSize || 0);
        } else {
          rec.name = newName;
          const m = MAT[newName];
          if (m) { rec.price = m.price; rec.ic = m.ic; rec.color = m.color; }
          bag[newName] = rec;
        }
      }
    }
  })();

  if (s.tools) Object.keys(TOOLS).forEach(k => {
    if (s.tools[k]) TOOLS[k].lv = Math.max(1, Math.min(TOOLS[k].max, s.tools[k]));
  });
  /* 耕地功能已取消，忽略舊存檔的 tilled 資料 */

  if (Array.isArray(s.picks)) s.picks.forEach((a, i) => {
    const p = pickSpots[i];
    if (!p) return;
    p.active = !!a;
    p.cd = a ? 0 : (p.dawnRespawn ? Infinity : p.cooldown);
  });
  if (Array.isArray(s.spots)) s.spots.forEach((a, i) => {
    const p = spots[i];
    if (!p) return;
    p.active = !!a;
    p.cd = a ? 0 : 180;
  });
  if (Array.isArray(s.worms)) s.worms.forEach((a, i) => {
    const p = wormSpots[i];
    if (!p) return;
    p.active = !!a;
    p.cd = a ? 0 : 180;
  });

  if (s.quests) Object.keys(quests).forEach(k => { quests[k] = !!s.quests[k]; });

  if (s.mineralStore) {
    copyBag(mineralStore, s.mineralStore);
    mineralStoreLv = s.mineralStoreLv || 1;
    MINERAL_STORE_SIZE = s.mineralStoreSize || 15;
  }

  /* 舊存檔鎬子：數量與使用中的拆分開，保留原本的耐久度 */
  (function migratePickaxe() {
    var activeDone = false;
    var bags = [inventory, storage, mineralStore];
    for (var gi = 0; gi < bags.length; gi++) {
      if (activeDone) break;
      var r = bags[gi]['鎬子'];
      if (!r) continue;
      if ((r.durability || 0) > 0) {
        r.count--;
        var d = r.durability;
        bags[gi]['使用中鎬子'] = { name: '使用中鎬子', count: 1, price: 0, rarity: '', color: '#b8b8b8', ic: 'pickaxe', maxSize: 0, sat: 0, eff: '', durability: d };
        if (r.count <= 0) delete bags[gi]['鎬子'];
        activeDone = true;
      }
    }
    for (var gj = 0; gj < bags.length; gj++) {
      var r = bags[gj]['鎬子'];
      if (r) r.durability = 0;
    }
  })();

  /* 舊存檔的夜晚降臨藥沒有 use 欄位：補上後才能從背包使用 */
  (function migrateNightfallPotion() {
    var bags = [inventory, storage, mineralStore];
    for (var gi = 0; gi < bags.length; gi++) {
      var r = bags[gi]['夜晚降臨藥'];
      if (r && !r.use) r.use = 'nightfall';
    }
  })();

  /* 靜音狀態跟著存檔 */
  if (s.mute !== undefined) {
    muted = !!s.mute;
    if (masterGain) masterGain.gain.value = muted ? 0 : 1;
    const tag = document.getElementById('muteTag');
    if (tag) tag.classList.toggle('on', muted);
  }

  if (s.special && typeof special !== 'undefined') {
    for (const k of Object.keys(special)) special[k] = !!s.special[k];
    if (typeof reapplySpecialVisuals === 'function') reapplySpecialVisuals();
  }
  storeLv = s.storeLv || 1;
  if (typeof updateStoreSize === 'function') updateStoreSize();

  if (s.day) dayIndex = s.day;
  if (typeof s.t === 'number') {
    dayT = Math.min(0.999, Math.max(0, s.t));
    applyLight(dayT);
    updateDial();
  }
  /* 重新整理一律回到島上小木屋門口，避免進到黑暗場景看起來像時間跳到夜晚 */
  const savedIndoors = s.area && s.area !== 'island';
  if (typeof restoreArea === 'function') restoreArea('island', s.mine);
  if (savedIndoors) {
    const dx = CABIN.x, dz = CABIN.z + CABIN.d / 2 + 1.0;
    heroPos.set(dx, groundHeightAt(dx, dz), dz);
    if (hero) hero.position.copy(heroPos);
    if (typeof syncCameraToHero === 'function') syncCameraToHero();
  } else if (Array.isArray(s.hero)) {
    const hx = s.hero[0], hz = s.hero[1];
    const hy = groundHeightAt(hx, hz);
    heroPos.set(hx, hy, hz);
    if (hero) hero.position.copy(heroPos);
    if (typeof syncCameraToHero === 'function') syncCameraToHero();
  }

  updateSatHud();
  updateBaitHud();
  renderQuests();
  refreshPanels();
  return true;
}

addEventListener('pagehide', () => saveGame());
document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });

/* 多分頁防護：同一瀏覽器開兩個分頁會互相覆蓋 localStorage 存檔
   （刷新後可能讀到另一分頁存的狀態，看似「時間暴變」）
   開頁時先清掉所有別的分頁的標記殘影，再靠心跳定期偵測是否真有另一個活分頁 */
const TAB_PREFIX = 'island3d.tab.' + SAVE_PROFILE + '.';
const myTabId = Math.random().toString(36).slice(2) + Date.now().toString(36);
function cleanupForeignTabKeys() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k) continue;
      /* 同一個存檔前綴、但不是自己：清掉（只留自己的） */
      if (k.indexOf(TAB_PREFIX) === 0 && k !== TAB_PREFIX + myTabId) {
        localStorage.removeItem(k);
        continue;
      }
      /* 舊版／測試殘留的標記：沒有該前綴也一律清掉 */
      if (k.indexOf('island3d.tab.') === 0 && k.indexOf(TAB_PREFIX) !== 0) {
        localStorage.removeItem(k);
      }
    }
  } catch (e) {}
}
cleanupForeignTabKeys();
function tabPulse() {
  let other = false;
  try { localStorage.setItem(TAB_PREFIX + myTabId, JSON.stringify({ ts: Date.now() })); } catch (e) {}
  try {
    const now = Date.now();
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.indexOf(TAB_PREFIX) === 0 && k !== TAB_PREFIX + myTabId) {
        let rec = null;
        try { rec = JSON.parse(localStorage.getItem(k)); } catch (e) {}
        if (rec && (now - rec.ts) < 6000) other = true;
        else localStorage.removeItem(k);
      }
    }
  } catch (e) {}
  const el = document.getElementById('tabWarn');
  if (other && !el) {
    const w = document.createElement('div');
    w.id = 'tabWarn';
    w.textContent = '⚠ 偵測到另一個遊戲分頁正在執行，兩個分頁會互相覆蓋存檔，請關閉多餘的分頁';
    document.body.appendChild(w);
  } else if (!other && el) {
    el.remove();
  }
}
try { localStorage.removeItem('island3d.tab'); } catch (e) {}
tabPulse();
setInterval(tabPulse, 3000);
