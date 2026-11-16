/* mining.js — 挖礦互動、鎬子耐久、鑽石 */
/* ============================================================ */
const MINING_DURATION = 0.62;
const mining = { t: -1, node: null };

function miningBusy() { return mining.t >= 0; }

function getActivePickaxe() {
  const r = inventory['使用中鎬子'];
  return (r && r.count > 0 && (r.durability || 0) > 0) ? r : null;
}
function promotePickaxe() {
  const back = inventory['鎬子'];
  if (!back || back.count <= 0) return false;
  const d = back.durability || 30;
  back.count--;
  if (back.count <= 0) delete inventory['鎬子'];
  bagAdd(inventory, { name: '使用中鎬子', price: 0, ic: 'pickaxe', color: '#b8b8b8' }, 0);
  if (inventory['使用中鎬子']) inventory['使用中鎬子'].durability = d;
  refreshPanels();
  return true;
}
function hasPickaxe() {
  return !!getActivePickaxe() || (inventory['鎬子'] && inventory['鎬子'].count > 0);
}

function sndMine() {
  if (typeof noise === 'function') noise(0.16, 0.13, 480, 0.7);
  if (typeof tone === 'function') {
    tone(190, 95, 0.12, 'square', 0.05);
    setTimeout(() => tone(150, 80, 0.10, 'square', 0.04), 60);
  }
}

function startMining(node) {
  if (!node || !node.active || mining.t >= 0) return;
  if (AREA !== 'mine') return;

  /* 清除耐久已歸零的使用中鎬子，並自動從背包備用鎬子補上 */
  const inUse = inventory['使用中鎬子'];
  if (inUse && (inUse.durability || 0) <= 0) {
    delete inventory['使用中鎬子'];
    refreshPanels();
  }
  if (!getActivePickaxe()) promotePickaxe();

  if (!getActivePickaxe()) {
    const inMineral = mineralStore && mineralStore['鎬子'] && mineralStore['鎬子'].count > 0;
    const inStore = storage && storage['鎬子'] && storage['鎬子'].count > 0;
    mineFlash = 2.0;
    setPrompt(inMineral || inStore
      ? '鎬子在礦物倉庫／倉庫裡，先拿一把出來'
      : '需要鎬子（流浪商人販售 5 💎）', 'bad');
    return;
  }
  if (!inventory[node.name] && Object.keys(inventory).length >= INV_SIZE) {
    mineFlash = 2.0;
    setPrompt('魚簍滿了，先清出空間', 'bad');
    return;
  }

  mining.t = 0;
  mining.node = node;
  mineFlash = 0.9;
  setPrompt('挖 ' + node.name + ' 中…', '');
  if (actDig) { actDig.timeScale = 1.0; playAction(actDig, 0.12); }
  sndMine();
}

function updateMining(dt) {
  if (mining.t < 0) return;
  mining.t += dt;
  const n = mining.node;
  if (n) {
    const k = 1 + Math.sin(mining.t * 28) * 0.025;
    n.group.scale.setScalar(k);
  }
  if (mining.t >= MINING_DURATION) {
    mining.t = -1;
    const done = mining.node;
    mining.node = null;
    if (done) finishMining(done);
  }
}

function finishMining(n) {
  if (n.group) n.group.scale.setScalar(1);
  if (!n.active) return;

  /* 使用中的鎬子歸零耐久：清除並嘗試自動換上背包裡的備用鎬子 */
  let rec = inventory['使用中鎬子'];
  if (!rec || (rec.durability || 0) <= 0) {
    if (rec) delete inventory['使用中鎬子'];
    if (!promotePickaxe()) {
      mineFlash = 2.0;
      const inMineral = mineralStore && mineralStore['鎬子'] && mineralStore['鎬子'].count > 0;
      const inStore = storage && storage['鎬子'] && storage['鎬子'].count > 0;
      setPrompt(inMineral || inStore
        ? '鎬子壞了，去礦物倉庫／倉庫拿一把出來'
        : '鎬子壞了，去商人那裡買新的', 'bad');
      if (actIdle) playAction(actIdle, 0.2);
      return;
    }
    rec = inventory['使用中鎬子'];
  }

  const m = MAT[n.name];
  /* 鑽石與礦物互斥：鑽石 1/10 起算，特殊釣竿／鑽石加成料理可疊加 */
  const gotDiamond = Math.random() < Math.min(1, 0.1 + diaBonus());
  if (!gotDiamond && !inventory[n.name] && Object.keys(inventory).length >= INV_SIZE) {
    mineFlash = 2.0;
    setPrompt('魚簍滿了，先清出空間', 'bad');
    if (actIdle) playAction(actIdle, 0.2);
    return;
  }
  if (gotDiamond) {
    diamond++;
    updateDiamondHud();
  } else {
    bagAdd(inventory, { name: n.name, price: m.price, ic: m.ic, color: m.color }, 0);
  }

  rec.durability--;
  let broke = false;
  if (rec.durability <= 0) {
    delete inventory['使用中鎬子'];
    broke = true;
    promotePickaxe();
  }

  n.active = false;
  if (n.group) n.group.visible = false;
  const depth = mineDigCell(n.cellIndex);

  burstSplash(n.wx, n.baseY + 0.35, n.wz, 0.35);
  sndMine();
  if (gotDiamond) sndCatch();
  refreshPanels();

  mineFlash = 2.2;
  const atBottom = depth >= MINE_MAX_DEPTH;
  const dropName = gotDiamond ? '鑽石 ×1' : n.name + ' ×1';
  setPrompt('挖到 ' + dropName +
    (broke ? '　（鎬子壞了）' : '') +
    (atBottom ? '　已挖到最底部' : ''),
    broke ? 'bad' : 'good');

  if (actIdle) playAction(actIdle, 0.2);
}