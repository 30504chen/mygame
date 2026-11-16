/* synthesis.js — 礦物合成與特殊物品交換 */
/* ============================================================ */
const SYNTH_CHAINS = [
  { type: '石', frag: '石碎屑', ingot: '石錠', block: '石塊' },
  { type: '銅', frag: '銅碎屑', ingot: '銅錠', block: '銅塊' },
  { type: '鐵', frag: '鐵碎屑', ingot: '鐵錠', block: '鐵塊' },
  { type: '銀', frag: '銀碎屑', ingot: '銀錠', block: '銀塊' },
  { type: '金', frag: '金碎屑', ingot: '金錠', block: '金塊' }
];

/* 4 碎屑 → 1 錠，4 錠 → 1 塊 */
const SYNTH_RECIPES = [];
for (const c of SYNTH_CHAINS) {
  SYNTH_RECIPES.push({ id: c.frag + '>' + c.ingot, out: c.ingot, needs: [[c.frag, 4]], tier: 1 });
  SYNTH_RECIPES.push({ id: c.ingot + '>' + c.block, out: c.block, needs: [[c.ingot, 4]], tier: 2 });
}

const SPECIAL = [
  { key: 'autoTrap', name: '自動收成誘捕籠',
    desc: '陷阱每次產出直接進倉庫（倉庫滿才進魚簍）',
    cost: [['銀塊', 2], ['鐵塊', 1]] },
  { key: 'diamondRod', name: '永久鑽石釣竿',
    desc: '釣魚釣到鑽石的機率+3.33%',
    cost: [['鐵塊', 2], ['金塊', 1]] },
  { key: 'axeBoost', name: '加成斧頭',
    desc: '砍樹木材、樹枝各 +2',
    cost: [['金塊', 1]] },
  { key: 'mysteryBook', name: '神秘書本',
    desc: '',
    cost: [['石塊', 100], ['銅塊', 100], ['鐵塊', 50], ['金塊', 50]] }
];

const special = { autoTrap: false, diamondRod: false, axeBoost: false, shellSpawn: false, mushSpawn: false, chestPlus10: false, wormsPlus1: false, mysteryBook: false };

const elsSynth = document.getElementById('panel-synth');
const elsExchange = document.getElementById('panel-exchange');

function isNoSell(name) { return !!(MAT[name] && MAT[name].noSell); }

function canAffordCost(cost) {
  return cost.every(([n, q]) => bagCount(n) >= q);
}
function payCost(cost) {
  cost.forEach(([n, q]) => takeItem(n, q));
}

/* 合成前檢查能否存放產出（魚簍或倉庫） */
function canStoreItem(name) {
  if (inventory[name]) return true;
  if (Object.keys(inventory).length < INV_SIZE) return true;
  if (storage[name]) return true;
  if (Object.keys(storage).length < STORE_SIZE) return true;
  return false;
}
function addOutput(name, item) {
  const m = MAT[name];
  if (bagAdd(inventory, item || { name: name, price: m.price, ic: m.ic, color: m.color }, 0)) return true;
  if (bagAdd(storage, item || { name: name, price: m.price, ic: m.ic, color: m.color }, 0)) return true;
  return false;
}

function canSynth(r) {
  return canAffordCost(r.needs) && canStoreItem(r.out);
}
function doSynth(index) {
  const r = SYNTH_RECIPES[index];
  if (!r || !canSynth(r)) { setPrompt('素材不足，或魚簍與倉庫都滿了', 'bad'); return; }
  const out = MAT[r.out];
  payCost(r.needs);
  const ok = addOutput(r.out, { name: r.out, price: out.price, ic: out.ic, color: out.color });
  if (!ok) { setPrompt('產出空間不足', 'bad'); return; }
  setPrompt('合成 ' + r.out + ' ×1', 'good');
  sndCatch();
  renderSynth();
  refreshPanels();
  if (typeof saveGame === 'function') saveGame();
}

function needText(needs) {
  return needs.map(([n, q]) => {
    const m = MAT[n];
    const icon = iconSVG(m ? m.ic : 'mineral', m ? m.color : '#cccccc');
    return '<span class="costItem">' + icon + n + '×' + q +
      ' <i>(' + bagCount(n) + ')</i></span>';
  }).join('');
}

function renderSynth() {
  const m = MAT['石塊'];
  let html = '';
  for (let i = 0; i < SYNTH_RECIPES.length; i++) {
    const r = SYNTH_RECIPES[i];
    const o = MAT[r.out];
    const ok = canSynth(r);
    html += '<div class="cookrow synthrow' + (ok ? '' : ' locked') + '">' +
      '<span class="nm">' + iconSVG(o.ic, o.color) + r.out + '</span>' +
      '<span class="ing">' + needText(r.needs) + '</span>' +
      '<button data-synth="' + i + '"' + (ok ? '' : ' disabled') + '>合成</button></div>';
  }
  const list = document.getElementById('synthList');
  if (!list) return;
  list.innerHTML = html;
  list.querySelectorAll('button[data-synth]').forEach(b => {
    b.onclick = () => doSynth(parseInt(b.dataset.synth, 10));
  });
}

function canExchange(sp) {
  if (special[sp.key]) return false;
  return canAffordCost(sp.cost);
}

/* 購買後的效果 */
function applySpecialVisual(key) {
  if (key === 'autoTrap' && typeof trap !== 'undefined' && trap.group) {
    if (trap.group.userData.autoBand) return;
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.78, 0.055, 8, 26),
      new THREE.MeshStandardMaterial({ color: lin(0xd8b84a), roughness: 0.35, metalness: 0.6, emissive: lin(0x7a5e10), emissiveIntensity: 0.5 })
    );
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.6;
    trap.group.add(band);
    trap.group.userData.autoBand = band;
  }
}
function reapplySpecialVisuals() {
  if (special.autoTrap) applySpecialVisual('autoTrap');
}

function buySpecial(index) {
  const sp = SPECIAL[index];
  if (!sp || special[sp.key]) { setPrompt('已經兌換過了', 'bad'); return; }
  if (!canAffordCost(sp.cost)) { setPrompt('礦物不足', 'bad'); return; }
  payCost(sp.cost);
  special[sp.key] = true;
  applySpecialVisual(sp.key);
  if (sp.key === 'mysteryBook') {
    bagAdd(inventory, { name: '神秘書本', price: 0, ic: 'book', color: '#5a3a6f', use: 'mysteryBook' }, 0);
    if (typeof openMysteryBook === 'function') openMysteryBook();
  }
  setPrompt('換到 ' + sp.name + '！', 'good');
  sndCatch();
  renderExchange();
  refreshPanels();
  if (typeof saveGame === 'function') saveGame();
}

function renderExchange() {
  let html = '';
  for (let i = 0; i < SPECIAL.length; i++) {
    const sp = SPECIAL[i];
    const owned = !!special[sp.key];
    const ok = canExchange(sp);
    const descHtml = sp.desc ? '<span class="descLine">' + sp.desc + '</span><br>' : '';
    html += '<div class="cookrow exchrow' + (owned ? ' done' : '') + '">' +
      '<span class="nm">' + sp.name + '</span>' +
      '<span class="ing">' + descHtml + '<span class="costWrap">' + needText(sp.cost) + '</span></span>' +
      '<button data-exch="' + i + '"' + (owned || !ok ? ' disabled' : '') + '>' + (owned ? '已擁有' : '兌換') + '</button></div>';
  }
  const list = document.getElementById('exchangeList');
  if (!list) return;
  list.innerHTML = html;
  list.querySelectorAll('button[data-exch]').forEach(b => {
    b.onclick = () => buySpecial(parseInt(b.dataset.exch, 10));
  });
}

function toggleSynth() {
  const on = elsSynth && elsSynth.classList.contains('on');
  closePanels();
  if (elsSynth && !on) { renderSynth(); elsSynth.classList.add('on'); }
}
function toggleExchange() {
  const on = elsExchange && elsExchange.classList.contains('on');
  closePanels();
  if (elsExchange && !on) { renderExchange(); elsExchange.classList.add('on'); }
}