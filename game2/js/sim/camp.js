/* camp.js — 海島 3D Demo：island3d 的一部分 */
/* ============================================================
   素材、營地火堆、料理、飽食度
   ============================================================ */
var satiety = 100;
const TEST_FULL_SATIETY = false;  /* 飽食度恢復正常（不再鎖 100） */
let faintT = 0, faintRoll = 0, heroSaved = null;
let lastSatInt = -1;
const SAT_DRAIN = 100 / (4 * 120);   // 4 個遊戲日掉完（每日 120 秒）
const MAT = {
  '樹枝':     { price: 2,  ic: 'stick', color: '#9a7146' },
  '木材':     { price: 6,  ic: 'log',   color: '#a9803f' },
  '野莓':     { price: 4,  ic: 'berry', color: '#d4545f' },
  '椰子':     { price: 6,  ic: 'coco',  color: '#a9793f' },
  '夜光菇':   { price: 14, ic: 'mush',  color: '#7fd8b0' },
  '發光貝殼': { price: 10, ic: 'glow',  color: '#bfe8e0' },
  '沙茶醬':   { price: 40, ic: 'jar',   color: '#c9773f' },
  /* 礦物與其合成物：全部不可出售，只能合成或兌換 */
  '石碎屑':   { price: 0, ic: 'mineral', color: '#a9a68f', noSell: true },
  '銅碎屑':   { price: 0, ic: 'mineral', color: '#c07a3a', noSell: true },
  '鐵碎屑':   { price: 0, ic: 'mineral', color: '#8b949e', noSell: true },
  '銀碎屑':   { price: 0, ic: 'mineral', color: '#d8e0e8', noSell: true },
  '金碎屑':   { price: 0, ic: 'mineral', color: '#ffd24a', noSell: true },
  '石錠':     { price: 0, ic: 'ingot', color: '#c8c5ae', noSell: true },
  '銅錠':     { price: 0, ic: 'ingot', color: '#e09a55', noSell: true },
  '鐵錠':     { price: 0, ic: 'ingot', color: '#aeb6bf', noSell: true },
  '銀錠':     { price: 0, ic: 'ingot', color: '#eef3f7', noSell: true },
  '金錠':     { price: 0, ic: 'ingot', color: '#ffe066', noSell: true },
  '石塊':     { price: 0, ic: 'block', color: '#e0ddc8', noSell: true },
  '銅塊':     { price: 0, ic: 'block', color: '#f0b066', noSell: true },
  '鐵塊':     { price: 0, ic: 'block', color: '#c8d0da', noSell: true },
  '銀塊':     { price: 0, ic: 'block', color: '#ffffff', noSell: true },
  '金塊':     { price: 0, ic: 'block', color: '#fff0a0', noSell: true },
  '鎬子':     { price: 0,  ic: 'pickaxe', color: '#b8b8b8', noSell: true },
  '使用中鎬子': { price: 0, ic: 'pickaxe', color: '#b8b8b8', noSell: true },
  '貝殼菇菇採集加成書': { price: 500, ic: 'book', color: '#c9824a', noSell: true, use: 'gatherBook' },
  '鑽石50兌換卡':     { price: 0,   ic: 'card', color: '#ffe27a', noSell: true, use: 'diamond50' },
  '神秘書本':         { price: 0,   ic: 'book', color: '#5a3a6f', noSell: true, use: 'mysteryBook' },
  '流浪商人召喚符':   { price: 1000, ic: 'rune', color: '#a07040', noSell: true, use: 'summonRune' },
  '釣魚釣到鑽石超級加成書': { price: 3000, ic: 'book', color: '#d49a3a', noSell: true, use: 'superDiaBook' },
  '胡椒':     { price: 60, ic: 'jar',     color: '#3a2f22' },
  '夜晚降臨藥': { price: 0, ic: 'potion',  color: '#8a5ad8', noSell: true, use: 'nightfall' }
};

const RECIPES = [
  { n: '炭烤魚',     ing: [{ any: 'fish' }, { name: '樹枝' }],                                    sat: 18, price: 45,  eff: '' },
  { n: '香煎魚排',   ing: [{ oneOf: ['黑鯛', '石斑'] }, { name: '樹枝' }],                        sat: 28, price: 90,  eff: '' },
  { n: '海鮮湯',     ing: [{ name: '蛤蜊' }, { oneOf: ['白蝦', '明蝦'] }, { name: '樹枝' }],       sat: 30, price: 80,  eff: '' },
  { n: '蛤蜊湯',     ing: [{ name: '蛤蜊', q: 2 }, { name: '樹枝' }],                             sat: 16, price: 35,  eff: '' },
  { n: '烤魷魚',     ing: [{ name: '魷魚' }, { name: '樹枝' }],                                   sat: 20, price: 55,  eff: '' },
  { n: '蒸花蟹',     ing: [{ name: '花蟹' }, { name: '樹枝' }],                                   sat: 24, price: 60,  eff: '' },
  { n: '蝦串燒',     ing: [{ name: '白蝦', q: 2 }, { name: '樹枝' }],                             sat: 18, price: 42,  eff: '' },
  { n: '野莓果醬',   ing: [{ name: '野莓', q: 3 }, { name: '樹枝' }],                             sat: 10, price: 40,  eff: '' },
  { n: '野莓椰奶凍', ing: [{ name: '野莓', q: 2 }, { name: '椰子' }],                             sat: 14, price: 65,  eff: '移動加速' },
  { n: '椰子水',     ing: [{ name: '椰子' }],                                                     sat: 8,  price: 20,  eff: '' },
  { n: '椰香烤魚',   ing: [{ any: 'fish' }, { name: '椰子' }],                                    sat: 24, price: 75,  eff: '' },
  { n: '夜光菇燉魚', ing: [{ name: '夜光菇' }, { any: 'fish' }],                                  sat: 32, price: 120, eff: '夜釣加成' },
  { n: '野莓烤魚',   ing: [{ name: '野莓', q: 2 }, { any: 'fish' }],                              sat: 22, price: 70,  eff: '' },
  { n: '海陸串燒',   ing: [{ any: 'fish' }, { oneOf: ['白蝦', '明蝦'] }, { name: '夜光菇' }],      sat: 34, price: 130, eff: '' },
  { n: '明蝦濃湯',   ing: [{ name: '明蝦' }, { name: '椰子' }, { name: '夜光菇' }],                sat: 36, price: 150, eff: '' },
  { n: '月夜魚湯',   ing: [{ oneOf: ['月魚', '燈籠魚'] }, { name: '夜光菇' }],                    sat: 45, price: 210, eff: '夜釣大幅加成' },
  { n: '船長燉鍋',   ing: [{ name: '石斑' }, { name: '石蟳' }, { name: '魷魚' }, { name: '夜光菇' }], sat: 55, price: 280, eff: '全效果' },
  { n: '島嶼拼盤',   ing: [{ oneOf: ['紅甘', '皇帶魚'] }, { name: '明蝦' }, { name: '野莓' }],      sat: 60, price: 340, eff: '全效果＋' },
  { n: '沙茶螃蟹',   ing: [{ oneOf: ['花蟹', '石蟳'] }, { name: '沙茶醬' }, { name: '樹枝' }],      sat: 34, price: 110, eff: '飽食維持' },
  { n: '胡椒蝦',     ing: [{ name: '胡椒' }, { oneOf: ['白蝦', '明蝦'] }],                       sat: 22, price: 95,  eff: '鑽石加成' },
  { n: '清炒蝦蝦',   ing: [{ oneOf: ['白蝦', '明蝦'] }, { name: '樹枝' }],                        sat: 28, price: 95,  eff: '採集加速' },
  { n: '清蒸魚',     ing: [{ any: 'fish' }, { name: '樹枝' }],                                    sat: 22, price: 70,  eff: '' }
];

/* ---------- 工具與倉庫 ---------- */
const TOOLS = {
  axe:    { name: '斧頭', lv: 1, max: 3, note: '砍樹樹枝 +1（Lv3 再 +1 木材）' },
  shovel: { name: '鏟子', lv: 1, max: 3, note: '每次挖蚯蚓 +1' },
  rod:    { name: '釣竿', lv: 1, max: 3, note: '稀有／傳說魚 +10%' },
  net:    { name: '撈網', lv: 1, max: 3, note: '每次採海鮮 +1' },
  basket: { name: '籃子', lv: 1, max: 3, note: '野莓／夜光菇 +1' }
};
const UPGRADE_COST = {
  axe:    [null, { '木材': 4 }, { '木材': 8, '發光貝殼': 3 }],
  shovel: [null, { '木材': 3, '樹枝': 6 }, { '木材': 6, '發光貝殼': 4 }],
  rod:    [null, { '木材': 4, '樹枝': 5 }, { '木材': 8, '發光貝殼': 6 }],
  net:    [null, { '木材': 3, '樹枝': 4 }, { '木材': 6, '發光貝殼': 4 }],
  basket: [null, { '樹枝': 8 }, { '木材': 4, '樹枝': 10 }]
};
let storeLv = 1;
const STORE_COST = [null, { '木材': 6 }, { '木材': 12 }, { '木材': 20 }];
const MINERAL_STORE_COST = [null, { '木材': 6 }, { '木材': 12 }, { '木材': 20 }];
const STORE_BASE = [null, 15, 20, 25, 30];
/* 倉庫格子：由 storeLv 決定，釣魚加成卡片 +10 額外獨立疊加（最高 40） */
function updateStoreSize() {
  const base = STORE_BASE[storeLv] || STORE_BASE[1];
  STORE_SIZE = base + ((typeof special !== 'undefined' && special.chestPlus10) ? 10 : 0);
}

function toolLv(k) { return TOOLS[k] ? TOOLS[k].lv : 1; }
function costText(c) { return Object.entries(c).map(([n, v]) => n + '×' + v).join('　'); }
function canPay(c) { return Object.entries(c).every(([n, v]) => bagCount(n) >= v); }
function pay(c) { Object.entries(c).forEach(([n, v]) => takeItem(n, v)); }

function upgradeTool(k) {
  const t = TOOLS[k];
  if (!t || t.lv >= t.max) return;
  const cost = UPGRADE_COST[k][t.lv];
  if (!cost || !canPay(cost)) return;
  pay(cost);
  t.lv++;
  setPrompt(t.name + ' 升到 Lv' + t.lv, 'good');
  sndCatch();
  renderCook();
  refreshPanels();
}
function upgradeStore() {
  if (storeLv > 3) return;
  const cost = STORE_COST[storeLv];
  if (!cost || !canPay(cost)) return;
  pay(cost);
  storeLv++;
  updateStoreSize();
  setPrompt('倉庫擴建到 ' + STORE_SIZE + ' 格', 'good');
  sndCatch();
  renderCook();
  refreshPanels();
}
function upgradeMineral() {
  if (mineralStoreLv > 3) return;
  const cost = MINERAL_STORE_COST[mineralStoreLv];
  if (!cost || !canPay(cost)) return;
  pay(cost);
  mineralStoreLv++;
  MINERAL_STORE_SIZE += 5;
  setPrompt('礦物倉庫擴建到 ' + MINERAL_STORE_SIZE + ' 格', 'good');
  sndCatch();
  renderCook();
  refreshPanels();
}

/* ---------- 料理效果（buff） ---------- */
const BUFF_TIME = (typeof DAY_SECONDS !== 'undefined') ? DAY_SECONDS : 120;   /* 1 個遊戲日 */
const EFFECT = {
  '移動加速':     { move: 1.35, label: '移動加速', desc: '移動速度 +35%（1 天）' },
  '夜釣加成':     { night: 1.25, label: '夜釣加成', desc: '夜釣稀有／傳說魚機率 +25%（1 天）' },
  '夜釣大幅加成': { night: 1.5,  label: '夜釣大幅', desc: '夜釣稀有／傳說魚機率 +50%（1 天）' },
  '採集加速':     { gather: 2,   label: '採集加速', desc: '採集數量 +2（1 天）' },
  '全效果':       { move: 1.35, gather: 2, night: 1.25, label: '全效果', desc: '移動 +35%／採集 +2／夜稀有 +25%（1 天）' },
  '全效果＋':     { move: 1.45, gather: 2, night: 1.5,  label: '全效果＋', desc: '移動 +45%／採集 +2／夜稀有 +50%（1 天）' },
  '飽食維持':     { sat: true, label: '飽食維持', desc: '飽食度不下降（3 天）' },
  '鑽石加成':     { dia: true, label: '鑽石 +3.33%', desc: '釣魚／挖礦 鑽石機率 +3.33%（3 天）' },
  '貝殼菇菇採集加成': { gatherMush: true, label: '貝菇採集 ×2', desc: '發光貝殼、夜光菇採集固定 +2（1 天）' },
  '釣魚釣到鑽石超級加成': { superDia: true, label: '鑽石 25%', desc: '釣魚釣到鑽石的機率提高到 25%（1 天）' }
};
const buffs = {};
let buffSec = 1;
/* 召喚符：召喚流浪商人的剩餘秒數（遊戲時間） */
let merchantSummonLeft = 0;
function summonMerchant() {
  const r = inventory['流浪商人召喚符'];
  if (!r) return;
  r.count--;
  if (r.count <= 0) delete inventory['流浪商人召喚符'];
  const daySec = (typeof DAY_SECONDS !== 'undefined') ? DAY_SECONDS : 120;
  merchantSummonLeft = daySec * (0.80 - 0.155); /* 跟流浪商人原本每次來訪的時長一樣 */
  setPrompt('流浪商人被召喚來了！', 'good');
  sndCatch();
  refreshPanels();
  if (typeof saveGame === 'function') saveGame();
}

function applyEffect(name) {
  const e = EFFECT[name];
  if (!e) return false;
  const left = BUFF_TIME;
  if (e.move) buffs.move = { mul: e.move, left: left, label: '移動 +' + Math.round((e.move - 1) * 100) + '%' };
  if (e.gather) buffs.gather = { n: e.gather, left: left, label: '採集 +' + e.gather };
  if (e.night) buffs.night = { mul: e.night, left: left, label: '夜釣 +' + Math.round((e.night - 1) * 100) + '%' };
  if (e.sat) {
    const daySec = (typeof DAY_SECONDS !== 'undefined') ? DAY_SECONDS : 120;
    buffs.sat = { left: 3 * daySec, label: '飽食維持' };
  }
  if (e.dia) {
    const daySec = (typeof DAY_SECONDS !== 'undefined') ? DAY_SECONDS : 120;
    buffs.dia = { left: 3 * daySec, label: '鑽石 +3.33%' };
  }
  if (e.gatherMush) {
    buffs.gatherMush = { left: BUFF_TIME, label: '貝菇採集 ×2' };
  }
  if (e.superDia) {
    buffs.superDia = { left: BUFF_TIME, label: '鑽石 25%' };
  }
  updateBuffHud();
  return true;
}

function updateBuffHud() {
  const row = document.getElementById('buffrow');
  if (!row) return;
  const parts = Object.keys(buffs).map(k => {
    const b = buffs[k];
    const s = Math.max(0, Math.round(b.left));
    return '<span class="buff">' + b.label + ' ' + Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2) + '</span>';
  });
  /* 永久加成卡片（只顯示採集率加成，不含倉庫／蚯蚓類） */
  if (typeof special !== 'undefined') {
    const perm = [
      ['shellSpawn', '貝殼出現率UP'],
      ['mushSpawn', '夜光菇出現率UP']
    ];
    for (let i = 0; i < perm.length; i++) {
      if (special[perm[i][0]]) parts.push('<span class="buff">' + perm[i][1] + '</span>');
    }
  }
  row.innerHTML = parts.join('');
}

function updateBuffs(dt) {
  let changed = false;
  for (const k in buffs) {
    buffs[k].left -= dt;
    if (buffs[k].left <= 0) { delete buffs[k]; changed = true; }
  }
  if (merchantSummonLeft > 0) {
    merchantSummonLeft = Math.max(0, merchantSummonLeft - dt);
    if (merchantSummonLeft <= 0) setPrompt('流浪商人離開了', '');
  }
  buffSec -= dt;
  if (buffSec <= 0) { buffSec = 1; changed = true; }
  if (changed) updateBuffHud();
}

function moveMul() { return buffs.move ? buffs.move.mul : 1; }
function gatherBonus() { return buffs.gather ? buffs.gather.n : 0; }
/* 鑽石加成單一份量：1/30 ≈ +3.33%；基準 10% + 兩份 = 1/6 */
const DIA_BONUS = 1 / 30;
/* 鑽石加成：特殊釣竿 +3.33%、胡椒蝦 +3.33%（可疊加） */
function diaBonus() {
  let b = 0;
  if (typeof special !== 'undefined' && special.diamondRod) b += DIA_BONUS;
  if (buffs.dia) b += DIA_BONUS;
  return b;
}
/* 釣魚鑽石機率：基準 10%；超級加成書直接拉到 25% */
function fishingDiaChance() {
  if (typeof buffs !== 'undefined' && buffs.superDia) return 0.25;
  return Math.min(1, 0.1 + diaBonus());
}
function nightRareMul() { return isDark() && buffs.night ? buffs.night.mul : 1; }
function rodRareMul() { return 1 + (toolLv('rod') - 1) * 0.10; }

const elsCook = document.getElementById('panel-cook');

function bagCount(name) {
  return (inventory[name] ? inventory[name].count : 0) + (storage[name] ? storage[name].count : 0);
}
function fishCount() {
  let n = 0;
  for (const f of FISH_TABLE) n += bagCount(f.name);
  return n;
}
function ingCount(ing) {
  if (ing.any === 'fish') return fishCount();
  if (ing.oneOf) return ing.oneOf.reduce((s, n) => s + bagCount(n), 0);
  return bagCount(ing.name);
}
function canCook(r) {
  return r.ing.every(i => ingCount(i) >= (i.q || 1));
}
function pickName(ing) {
  if (ing.oneOf) {
    const hit = ing.oneOf.find(n => bagCount(n) > 0);
    return hit || null;
  }
  if (ing.any === 'fish') {
    const names = FISH_TABLE.map(f => f.name).filter(n => bagCount(n) > 0);
    names.sort((a, b) => {
      const pa = FISH_TABLE.find(f => f.name === a).price;
      const pb = FISH_TABLE.find(f => f.name === b).price;
      return pa - pb;
    });
    return names[0] || null;
  }
  return ing.name;
}
function takeItem(name, q) {
  let need = q;
  for (const bag of [inventory, storage]) {
    const rec = bag[name];
    if (!rec) continue;
    const take = Math.min(rec.count, need);
    rec.count -= take;
    need -= take;
    if (rec.count <= 0) delete bag[name];
    if (need <= 0) break;
  }
}
function ingText(ing) {
  /* 顏色對比：材料夠＝深綠，材料不足＝紅色，一目了然 */
  if (ing.any === 'fish') {
    const n = fishCount();
    return '<span class="' + (n > 0 ? 'ingOk' : 'ingLack') + '">任一魚</span>';
  }
  if (ing.oneOf) {
    const ok = ing.oneOf.some(nm => bagCount(nm) > 0);
    return '<span class="' + (ok ? 'ingOk' : 'ingLack') + '">' + ing.oneOf.join('／') + '</span>';
  }
  const have = bagCount(ing.name);
  const need = ing.q || 1;
  const ok = have >= need;
  return '<span class="' + (ok ? 'ingOk' : 'ingLack') + '">' + ing.name +
    (ing.q > 1 ? ' ×' + ing.q : '') + '</span>';
}

function cook(r) {
  if (!r || !canCook(r)) return;
  for (const ing of r.ing) {
    const nm = pickName(ing);
    if (nm) takeItem(nm, ing.q || 1);
  }
  const ok = bagAdd(inventory, { name: r.n, price: r.price, ic: 'dish', sat: r.sat, eff: r.eff }, 0);
  if (!ok) {
    setPrompt('魚簍滿了，料理放不下', 'bad');
  } else {
    fish.flash = 1.8;
    setPrompt('煮好了：' + r.n + ' ×1', 'good');
    sndCatch();
    questDone('cook');
  }
  renderCook();
  refreshPanels();
}

function makeSauce() {
  const need = [{ name: '夜光菇' }, { name: '發光貝殼' }, { name: '椰子' }];
  if (!need.every(i => bagCount(i.name) > 0)) return;
  need.forEach(i => takeItem(i.name, 1));
  bagAdd(inventory, { name: '沙茶醬', price: MAT['沙茶醬'].price, ic: 'jar' }, 0);
  fish.flash = 1.8;
  setPrompt('做好沙茶醬了 ×1', 'good');
  sndCatch();
  renderCook();
  refreshPanels();
}

function makePepper() {
  const need = [{ name: '夜光菇' }, { name: '發光貝殼' }, { name: '椰子' }];
  if (!need.every(i => bagCount(i.name) > 0)) return;
  need.forEach(i => takeItem(i.name, 1));
  bagAdd(inventory, { name: '胡椒', price: MAT['胡椒'].price, ic: 'jar', color: MAT['胡椒'].color }, 0);
  fish.flash = 1.8;
  setPrompt('磨好胡椒了 ×1', 'good');
  sndCatch();
  renderCook();
  refreshPanels();
}

function renderCook() {
  document.getElementById('cookSat').textContent = Math.round(satiety);
  let html = '';
  for (const r of RECIPES) {
    const ok = canCook(r);
    html += '<div class="cookrow"><span class="nm">' + r.n + '</span>' +
      '<span class="ing">' + r.ing.map(ingText).join(' ＋ ') + (r.eff ? '　<span style="color:#c08a4a">' + (EFFECT[r.eff] ? EFFECT[r.eff].desc : r.eff) + '</span>' : '') + '</span>' +
      '<span class="sat">+' + r.sat + ' 飽</span>' +
      '<span class="pr">' + r.price + '</span>' +
      '<button data-r="' + r.n + '"' + (ok ? '' : ' disabled') + '>煮</button></div>';
  }
  const cl = document.getElementById('cookList');
  cl.innerHTML = html;
  cl.querySelectorAll('button[data-r]').forEach(b => {
    b.onclick = () => cook(RECIPES.find(r => r.n === b.dataset.r));
  });

  const sauceOK = bagCount('夜光菇') > 0 && bagCount('發光貝殼') > 0 && bagCount('椰子') > 0;
  const ce = document.getElementById('cookExtra');
  ce.innerHTML = '<div class="cookrow"><span class="nm">沙茶醬</span>' +
    '<span class="ing">夜光菇 ＋ 發光貝殼 ＋ 椰子</span>' +
    '<span class="sat">—</span><span class="pr">40</span>' +
    '<button id="mkSauce"' + (sauceOK ? '' : ' disabled') + '>做</button></div>' +
    '<div class="cookrow"><span class="nm">胡椒</span>' +
    '<span class="ing">夜光菇 ＋ 發光貝殼 ＋ 椰子</span>' +
    '<span class="sat">—</span><span class="pr">60</span>' +
    '<button id="mkPepper"' + (sauceOK ? '' : ' disabled') + '>做</button></div>';
  document.getElementById('mkSauce').onclick = makeSauce;
  document.getElementById('mkPepper').onclick = makePepper;

  let th = '';
  for (const k in TOOLS) {
    const t = TOOLS[k];
    const cost = t.lv < t.max ? UPGRADE_COST[k][t.lv] : null;
    const ok = cost && canPay(cost);
    th += '<div class="cookrow' + (cost ? '' : ' done') + '">' +
      '<span class="nm">' + t.name + '</span>' +
      '<span class="lv">Lv' + t.lv + '</span>' +
      '<span class="ing">' + t.note + '</span>' +
      '<span class="cost">' + (cost ? costText(cost) : '最高級') + '</span>' +
      '<button data-t="' + k + '"' + (ok ? '' : ' disabled') + '>升級</button></div>';
  }
  const sc = storeLv <= 3 ? STORE_COST[storeLv] : null;
  th += '<div class="cookrow' + (sc ? '' : ' done') + '">' +
    '<span class="nm">倉庫</span>' +
    '<span class="lv">' + STORE_SIZE + '格</span>' +
    '<span class="ing">每次擴建 +5 格</span>' +
    '<span class="cost">' + (sc ? costText(sc) : '最高級') + '</span>' +
    '<button id="upStore"' + (sc && canPay(sc) ? '' : ' disabled') + '>擴建</button></div>';
  const msc = mineralStoreLv <= 3 ? MINERAL_STORE_COST[mineralStoreLv] : null;
  th += '<div class="cookrow' + (msc ? '' : ' done') + '">' +
    '<span class="nm">礦物倉庫</span>' +
    '<span class="lv">' + MINERAL_STORE_SIZE + '格</span>' +
    '<span class="ing">每次擴建 +5 格</span>' +
    '<span class="cost">' + (msc ? costText(msc) : '最高級') + '</span>' +
    '<button id="upMineral"' + (msc && canPay(msc) ? '' : ' disabled') + '>擴建</button></div>';
  const tw = document.getElementById('cookTools');
  tw.innerHTML = th;
  tw.querySelectorAll('button[data-t]').forEach(b => {
    b.onclick = () => upgradeTool(b.dataset.t);
  });
  document.getElementById('upStore').onclick = upgradeStore;
  document.getElementById('upMineral').onclick = upgradeMineral;
}

/* ---------- 採集點模型 ---------- */
function bushMesh() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: lin(0x5d8f4c), roughness: 0.82 });
  const berryMat = new THREE.MeshStandardMaterial({
    color: lin(0xd8394f), emissive: lin(0x5e0f1c), emissiveIntensity: 0.35, roughness: 0.45
  });
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.46, 10, 8), mat);
    s.position.set(Math.cos(i * 1.7) * 0.36, 0.34 + (i % 2) * 0.17, Math.sin(i * 1.7) * 0.36);
    s.scale.setScalar(0.82 + (i % 3) * 0.13);
    s.castShadow = true;
    s.receiveShadow = true;
    g.add(s);
  }
  for (let i = 0; i < 12; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), berryMat);
    const ang = i * 2.399;
    const rr = 0.34 + (i % 3) * 0.09;
    b.position.set(
      Math.cos(ang) * rr,
      0.40 + (i % 4) * 0.13,
      Math.sin(ang) * rr
    );
    g.add(b);
  }
  return g;
}

function palmMesh() {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: lin(0x9a7448), roughness: 0.92 });
  const leafMat = new THREE.MeshStandardMaterial({ color: lin(0x1c4a22), roughness: 0.9 });
  const nutMat = new THREE.MeshStandardMaterial({ color: lin(0x6f5230), roughness: 0.7 });

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.31, 3.3, 9), trunkMat);
  trunk.position.y = 1.65;
  trunk.rotation.z = 0.07;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  g.add(trunk);

  // 樹冠：8 片下垂葉 + 5 片較短的立葉
  function frond(len, wid, droop, y, shade) {
    const arm = new THREE.Group();
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 9, 6), leafMat);
    leaf.scale.set(wid, 0.055, len);
    leaf.position.z = len * 0.92;
    leaf.rotation.x = droop;
    leaf.castShadow = true;
    arm.add(leaf);
    arm.position.y = y;
    arm.rotation.y = shade;
    return arm;
  }
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + 0.2;
    g.add(frond(1.02, 0.3, 0.34, 3.26, a));
  }
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2 + 0.9;
    g.add(frond(0.62, 0.24, -0.22, 3.34, a));
  }
  const nuts = [];
  for (let i = 0; i < 3; i++) {
    const nut = new THREE.Mesh(new THREE.SphereGeometry(0.16, 9, 7), nutMat);
    nut.position.set(Math.cos(i * 2.1) * 0.22, 3.02, Math.sin(i * 2.1) * 0.22);
    nut.castShadow = true;
    g.add(nut);
    nuts.push(nut);
  }
  g.userData.nuts = nuts;
  return g;
}

function mushroomMesh() {
  const g = new THREE.Group();
  const stemMat = new THREE.MeshStandardMaterial({ color: lin(0xf2ecdc), roughness: 0.8 });
  const capMat = new THREE.MeshStandardMaterial({
    color: lin(0x74d6a8), emissive: lin(0x2f9d76), emissiveIntensity: 0.9, roughness: 0.5
  });
  for (let i = 0; i < 3; i++) {
    const a = i * 2.2, rr = i === 0 ? 0 : 0.26;
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.26, 6), stemMat);
    s.position.set(Math.cos(a) * rr, 0.13, Math.sin(a) * rr);
    g.add(s);
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
    c.position.set(Math.cos(a) * rr, 0.26, Math.sin(a) * rr);
    c.scale.set(1, 0.7, 1);
    g.add(c);
  }
  return g;
}

function glowShellMesh() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: lin(0xcdf0e6), emissive: lin(0x63c8b4), emissiveIntensity: 0.85, roughness: 0.35
  });
  const s = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat);
  s.scale.set(1.25, 0.55, 1);
  g.add(s);
  return g;
}

/* ---------- 採集點註冊 ---------- */
const pickSpots = [];
/* ⚠ 陣列索引保存於存檔（save.js 存檔安全規則）：只准 append、不准 reorder／插入／刪除 */
let lastGather = -9999;

function registerPick(o) {
  const g = o.group;
  g.position.set(o.x, o.baseY, o.z);
  scene.add(g);
  const p = Object.assign({
    active: true, cd: 0, ph: Math.random() * 6.283, ring: null, bob: false,
    cooldown: 180, nightOnly: false, dawnRespawn: false
  }, o, { group: g });
  pickSpots.push(p);
  return p;
}

function addPick(kind, x, z, label, r, group, extra) {
  const baseY = groundHeightAt(x, z);
  return registerPick(Object.assign({
    kind: kind, x: x, z: z, r: r, label: label, group: group, baseY: baseY
  }, extra || {}));
}

function randomPickLocation() {
  for (let i = 0; i < 300; i++) {
    const a = Math.random() * Math.PI * 2;
    const rad = 4.2 + Math.random() * 13.0;
    const x = Math.cos(a) * rad;
    const z = Math.sin(a) * rad;
    if (typeof heightAt !== 'function' || heightAt(x, z) < 0.6) continue;
    if (Math.hypot(x - CABIN.x, z - CABIN.z) < 4.5) continue;
    if (Math.hypot(x - TROUGH_POS.x, z - TROUGH_POS.z) < 2.0) continue;
    if (typeof distToPath === 'function' && distToPath(x, z) < 1.5) continue;
    if (Math.hypot(x - 10, z - 5) < 2.0) continue;
    if (Math.hypot(x, z - 14) < 5.0) continue;
    if (Math.hypot(x, z - 6) < 3.4) continue;
    if (pickSpots.some(p => Math.hypot(p.x - x, p.z - z) < 1.6)) continue;
    return { x: x, z: z };
  }
  return null;
}

(function placeMaterials() {
  addPick('berry', -6.5, 5.2, '按 E 採野莓', 2.3, bushMesh(), {
    cooldown: 90, bob: true, give: [{ name: '野莓', min: 2, max: 3 }]
  });
  addPick('berry', 3.8, -8.4, '按 E 採野莓', 2.3, bushMesh(), {
    cooldown: 90, bob: true, give: [{ name: '野莓', min: 2, max: 3 }]
  });
  addPick('berry', -2.4, 10.2, '按 E 採野莓', 2.3, bushMesh(), {
    cooldown: 90, bob: true, give: [{ name: '野莓', min: 2, max: 3 }]
  });

  addPick('palm', 10.2, -6.0, '按 E 摘椰子', 2.6, palmMesh(), {
    cooldown: 120, give: [{ name: '椰子', min: 1, max: 1 }]
  });
  addPick('palm', -11.0, -0.6, '按 E 摘椰子', 2.6, palmMesh(), {
    cooldown: 120, give: [{ name: '椰子', min: 1, max: 1 }]
  });
  addPick('palm', 8.8, 6.4, '按 E 摘椰子', 2.6, palmMesh(), {
    cooldown: 120, give: [{ name: '椰子', min: 1, max: 1 }]
  });

  /* 夜光菇、發光貝殼 → 新遊戲隨機散布
     （避免小屋、蚯蚓槽、小徑、營火、碼頭，並與所有採集點保持距離） */
  (function scatterNightSpawns() {
    /* 與礦坑共用 island3d.mine.seed：同一局反覆開機骨牌一樣 */
    let seed = 0;
    try {
      const v = parseInt(localStorage.getItem('island3d.mine.seed') || '0', 10);
      if (!isNaN(v) && v > 0) seed = v >>> 0;
    } catch (e) {}
    if (!seed) {
      seed = (Math.random() * 0xffffffff) >>> 0;
      try { localStorage.setItem('island3d.mine.seed', String(seed)); } catch (e) {}
    }
    const seedRng = (function fork(s) {
      let a = s >>> 0;
      return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    })(seed ^ 0x9e3779b1);
    const spawn = (kind, label, mesh, give) => {
      for (let i = 0; i < 300; i++) {
        const a = seedRng() * Math.PI * 2;
        const rad = 4.2 + seedRng() * 13.0;
        const x = Math.cos(a) * rad;
        const z = Math.sin(a) * rad;
        if (heightAt(x, z) < 0.6) continue;
        if (Math.hypot(x - CABIN.x, z - CABIN.z) < 4.5) continue;
        if (Math.hypot(x - TROUGH_POS.x, z - TROUGH_POS.z) < 2.0) continue;
        if (distToPath(x, z) < 1.5) continue;
        /* 營火位置也避開（CAMP 在此函式之後才宣告） */
        if (Math.hypot(x - 10, z - 5) < 2.0) continue;
        if (Math.hypot(x, z - 14) < 5.0) continue;
        if (Math.hypot(x, z - 6) < 3.4) continue;
        /* 跟所有已存在的採集點保持距離<1.6 就排除 */
        if (pickSpots.some(p => Math.hypot(p.x - x, p.z - z) < 1.6)) continue;
        addPick(kind, x, z, label, 2.0, mesh, {
          nightOnly: true, dawnRespawn: true, give: [give]
        });
        return true;
      }
      return false;
    };
    const mk = [mushroomMesh, mushroomMesh, mushroomMesh, glowShellMesh, glowShellMesh, glowShellMesh];
    for (const mesh of mk) {
      const isMush = mesh === mushroomMesh;
      spawn(isMush ? 'mush' : 'shell', isMush ? '按 E 採夜光菇' : '按 E 撿發光貝殼', mesh(),
        isMush ? { name: '夜光菇', min: 1, max: 2 } : { name: '發光貝殼', min: 1, max: 1 });
    }
  })();
})();

/* ---------- 可砍的樹 ---------- */
const chopTrees = [];
const TREE_POS = [
  [-8.2, 3.4], [-4.6, -6.4], [0.8, 5.2], [11.6, 1.2],
  [-9.8, -3.2], [5.0, -8.0], [-1.6, 8.6], [12.2, -5.0]
];

function buildChopTrees(proto, positions) {
  const posList = positions || TREE_POS;
  posList.forEach(pos => {
    const g = proto.clone(true);
    g.traverse(o => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });
    const x = pos[0], z = pos[1];
    const _p = registerPick({
      kind: 'tree', x: x, z: z, r: 3.0, label: '按 E 砍樹',
      group: g, baseY: groundHeightAt(x, z), dawnRespawn: true,
      tile: tileKey(x, z)
    });
    chopTrees.push(_p);
    if (typeof DBG_TREES !== 'undefined') DBG_TREES.push(g);
  });
}

/* ---------- 耕地（已取消） ---------- */
const TILE = 2.2;
const tilled = new Set();
function tileKey(x, z) {
  return Math.round(x / TILE) + '_' + Math.round(z / TILE);
}
function tillHere() { /* 功能已取消 */ }
function isTilling() { return false; }
function updateTillAnim(dt) { /* no-op */ }

/* ---------- 營地火堆 ---------- */
const campGroup = new THREE.Group();
{
  const stoneMat = new THREE.MeshStandardMaterial({ color: lin(0x9aa0a3), roughness: 0.9 });
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2;
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.21, 0), stoneMat);
    s.position.set(Math.cos(a) * 0.8, 0.12, Math.sin(a) * 0.8);
    s.rotation.set(a, a * 1.7, 0);
    s.castShadow = true;
    s.receiveShadow = true;
    campGroup.add(s);
  }
  const logMat = new THREE.MeshStandardMaterial({ color: lin(0x6f4a2c), roughness: 0.9 });
  for (let i = 0; i < 4; i++) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 1.15, 6), logMat);
    l.rotation.z = Math.PI / 2 - 0.42;
    l.rotation.y = i * 1.57 + 0.3;
    l.position.y = 0.2;
    l.castShadow = true;
    campGroup.add(l);
  }
}

function flameTexture(inner) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 160;
  const g = c.getContext('2d');
  g.beginPath();
  g.moveTo(64, 6);
  g.bezierCurveTo(84, 48, 96, 80, 94, 110);
  g.bezierCurveTo(92, 138, 78, 152, 64, 152);
  g.bezierCurveTo(50, 152, 36, 138, 34, 110);
  g.bezierCurveTo(32, 80, 44, 48, 64, 6);
  g.closePath();
  const grd = g.createLinearGradient(0, 152, 0, 6);
  if (inner) {
    grd.addColorStop(0, 'rgba(255,206,104,0.92)');
    grd.addColorStop(0.35, 'rgba(255,228,150,0.96)');
    grd.addColorStop(0.72, 'rgba(255,198,96,0.55)');
    grd.addColorStop(1, 'rgba(255,190,80,0)');
  } else {
    grd.addColorStop(0, 'rgba(178,42,10,1)');
    grd.addColorStop(0.26, 'rgba(232,92,20,1)');
    grd.addColorStop(0.58, 'rgba(250,150,42,0.98)');
    grd.addColorStop(0.84, 'rgba(255,196,88,0.55)');
    grd.addColorStop(1, 'rgba(255,214,120,0)');
  }
  g.fillStyle = grd;
  g.fill();
  return new THREE.CanvasTexture(c);
}

const campFlame = new THREE.Group();
const flameGlow = new THREE.Sprite(new THREE.SpriteMaterial({
  map: (function () {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    grd.addColorStop(0, 'rgba(255,186,102,0.55)');
    grd.addColorStop(0.5, 'rgba(255,150,60,0.18)');
    grd.addColorStop(1, 'rgba(255,140,50,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })(),
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
}));
flameGlow.scale.set(2.2, 2.2, 1);
flameGlow.position.y = 0.5;
campFlame.add(flameGlow);
const flameOuter = new THREE.Sprite(new THREE.SpriteMaterial({
  map: flameTexture(false), transparent: true, depthWrite: false
}));
flameOuter.scale.set(1.45, 1.95, 1);
flameOuter.position.y = 0.9;
campFlame.add(flameOuter);
const flameInner = new THREE.Sprite(new THREE.SpriteMaterial({
  map: flameTexture(true), transparent: true, depthWrite: false
}));
flameInner.scale.set(0.78, 1.05, 1);
flameInner.position.y = 0.66;
campFlame.add(flameInner);
campGroup.add(campFlame);

const campLight = new THREE.PointLight(0xffa860, 0.7, 9, 2);
campLight.position.y = 0.9;
campGroup.add(campLight);
const CAMP = { x: 10, z: 5 };
campGroup.position.set(CAMP.x, groundHeightAt(CAMP.x, CAMP.z), CAMP.z);
scene.add(campGroup);
/* 營地火堆是實體，不能穿越 */
ROCK_COLLIDERS.push({ x: CAMP.x, z: CAMP.z, r: 0.95 });

/* ---------- 收集 ---------- */
function collectFrom(p) {
  if (typeof NET !== 'undefined' && NET.on) {
    NET.claim('pick', pickSpots.indexOf(p), function (ok) {
      if (!ok) { setPrompt('被朋友先採了！', 'bad'); return; }
      collectFromLocal(p);
    });
    return;
  }
  collectFromLocal(p);
}
function collectFromLocal(p) {
  /* 椰子樹：採椰子果實落下，樹變成無椰子的樹（可再砍） */
  if (p.kind === 'palm') {
    const parts = [];
    let full = false;
    /* 給椰子 */
    const it = { name: '椰子', min: 1, max: 1 };
    const m = MAT['椰子'];
    if (bagAdd(inventory, { name: '椰子', price: m.price, ic: m.ic, color: m.color }, 0)) {
      parts.push('椰子 ×1');
    } else { full = true; }
    if (!parts.length) {
      setPrompt('魚簍滿了，先清出空間', 'bad');
      return;
    }
    /* 椰子果實落下動畫 */
    const nuts = (p.group.userData && p.group.userData.nuts) || [];
    nuts.forEach((nut, i) => {
      const w = nut.getWorldPosition(new THREE.Vector3());
      const falling = nut.clone();
      falling.position.copy(w);
      scene.add(falling);
      const startY = w.y;
      const t0 = performance.now();
      const tick = () => {
        const u = Math.min(1, (performance.now() - t0) / 450);
        falling.position.y = startY - u * u * 1.6;
        falling.scale.setScalar(1 - u * 0.4);
        if (u < 1) requestAnimationFrame(tick);
        else scene.remove(falling);
      };
      requestAnimationFrame(tick);
      nut.visible = false;
    });
    /* 移除椰子，轉為可砍的樹 */
    p.kind = 'tree';
    p.label = '按 E 砍樹';
    p.give = [];
    p.cooldown = Infinity;
    p.active = true;
    p.collectT = -1;
    p.chopT = -1;
    p.group.visible = true;
    p.group.scale.set(1, 1, 1);
    p.group.position.y = p.baseY;
    p.group.rotation.z = 0;
    /* 椰子再生：在隨機地點生成新的椰子樹（冷卻後出現） */
    const palmLoc = randomPickLocation();
    if (palmLoc) {
      const newPalm = addPick('palm', palmLoc.x, palmLoc.z, '按 E 摘椰子', 2.6, palmMesh(), {
        cooldown: 120, give: [{ name: '椰子', min: 1, max: 1 }]
      });
      newPalm.active = false;
      const gmPalm = (typeof growthMultiplier === 'function') ? growthMultiplier() : 1;
      newPalm.cd = newPalm.cooldown / Math.max(0.1, gmPalm);
      newPalm.collectT = -1;
      newPalm.group.visible = false;
    }
    lastGather = performance.now();
    setPrompt('採到 ' + parts.join('、') + (full ? '（魚簍已滿）' : '') + '，椰子樹可砍', 'good');
    burstSplash(p.x, p.baseY + 0.5, p.z, 0.4);
    sndBite();
    if (satiety <= 0 && Math.random() < 0.3) faintNow();
    return;
  }
  const parts = [];
  let full = false;
  for (const it of p.give) {
    const bonus = (it.name === '野莓' || it.name === '夜光菇') ? (toolLv('basket') - 1) : 0;
    /* 貝殼菇菇採集加成書：發光貝殼／夜光菇採集固定 2 個 */
    if (buffs.gatherMush && (it.name === '發光貝殼' || it.name === '夜光菇')) {
      const n = 2;
      let got = 0;
      for (let i = 0; i < n; i++) {
        const m = MAT[it.name];
        if (bagAdd(inventory, { name: it.name, price: m.price, ic: m.ic, color: m.color }, 0)) got++;
        else { full = true; break; }
      }
      if (got) parts.push(it.name + ' ×' + got);
      continue;
    }
    const n = it.min + Math.floor(Math.random() * (it.max - it.min + 1)) + bonus + gatherBonus();
    let got = 0;
    for (let i = 0; i < n; i++) {
      const m = MAT[it.name];
      if (bagAdd(inventory, { name: it.name, price: m.price, ic: m.ic, color: m.color }, 0)) got++;
      else { full = true; break; }
    }
    if (got) parts.push(it.name + ' ×' + got);
  }
  if (!parts.length) {
    setPrompt('魚簍滿了，先清出空間', 'bad');
    return;
  }
  /* 野莓再生：採集後移到隨機地點重新生長 */
  if (p.kind === 'berry') {
    const berryLoc = randomPickLocation();
    if (berryLoc) {
      p.x = berryLoc.x;
      p.z = berryLoc.z;
      const berryY = groundHeightAt(berryLoc.x, berryLoc.z);
      p.baseY = berryY;
      p.group.position.set(berryLoc.x, berryY, berryLoc.z);
    }
  }
  p.active = false;
  const gm = (typeof growthMultiplier === 'function') ? growthMultiplier() : 1;
  p.cd = (p.dawnRespawn ? Infinity : p.cooldown) / Math.max(0.1, gm);
  p.collectT = 0;
  lastGather = performance.now();
  setPrompt('採到 ' + parts.join('、') + (full ? '（魚簍已滿）' : ''), 'good');
  burstSplash(p.x, p.baseY + 0.3, p.z, 0.4);
  sndBite();
  if (satiety <= 0 && Math.random() < 0.3) faintNow();
}

function chopTree(p) {
  if (typeof NET !== 'undefined' && NET.on) {
    NET.claim('pick', pickSpots.indexOf(p), function (ok) {
      if (!ok) { setPrompt('被朋友先砍了！', 'bad'); return; }
      chopTreeLocal(p);
    });
    return;
  }
  chopTreeLocal(p);
}
function chopTreeLocal(p) {
  if (!p.active) return;
  p.active = false;
  p.cd = Infinity;
  p.chopT = 0;
  p.group.userData.chopDir = Math.random() < 0.5 ? 1 : -1;
  const parts = [];
  const axe = toolLv('axe');
  const boost = (typeof special !== 'undefined' && special.axeBoost) ? 2 : 0;
  [['木材', 1 + (axe >= 3 ? 1 : 0) + boost], ['樹枝', 2 + (axe >= 2 ? 1 : 0) + boost]].forEach(([n, c]) => {
    const m = MAT[n];
    for (let i = 0; i < c; i++) bagAdd(inventory, { name: n, price: m.price, ic: m.ic, color: m.color }, 0);
    parts.push(n + ' ×' + c);
  });
  lastGather = performance.now();
  setPrompt('砍到 ' + parts.join('、'), 'good');
  burstSplash(p.x, p.baseY + 0.5, p.z, 0.55);
  sndBite();
  if (satiety <= 0 && Math.random() < 0.3) faintNow();
}

/* ---------- 飽食度與昏倒 ---------- */

function updateSatHud() {
  const v = Math.round(satiety);
  if (v === lastSatInt) return;
  lastSatInt = v;
  const fill = document.getElementById('satfill');
  fill.style.width = v + '%';
  fill.style.background = v < 25
    ? 'linear-gradient(90deg,#e07a5f,#e6a35c)'
    : 'linear-gradient(90deg,#8fc98a,#e0b463)';
}

const satBubble = (function () {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  const x = 10, y = 8, w = 236, h = 88, r = 26;
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + 118, y + h);
  g.lineTo(x + 100, y + h + 22);
  g.lineTo(x + 96, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
  g.fillStyle = 'rgba(255,250,240,.97)';
  g.fill();
  g.lineWidth = 7;
  g.strokeStyle = '#e6a35c';
  g.stroke();
  g.fillStyle = '#0d3a4a';
  g.font = 'bold 46px "Microsoft JhengHei",sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('太餓昏倒', x + w / 2, y + h / 2 + 2);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(c), transparent: true, depthTest: false
  }));
  s.scale.set(2.0, 1.0, 1);
  s.visible = false;
  scene.add(s);
  return s;
})();

function faintNow() {
  if (faintT > 0 || !heroRoot) return;
  faintT = 3;
  if (fish.state !== 'idle') endFishing('餓昏了…');
  heroSaved = { y: heroRoot.position.y, rx: heroRoot.rotation.x };
  heroRoot.rotation.x = -Math.PI / 2;
  heroRoot.position.y = heroSaved.y + 0.30;
  satBubble.visible = true;
  setPrompt('太餓昏倒…', 'bad');
  sndBite();
}

function updateFaint(dt) {
  if (faintT > 0) {
    faintT -= dt;
    if (faintT <= 0) {
      if (heroSaved) {
        heroRoot.rotation.x = heroSaved.rx;
        heroRoot.position.y = heroSaved.y;
      }
      satBubble.visible = false;
      setPrompt('爬起來了…先去吃點東西', 'bad');
    }
    return true;
  }
  if (satiety <= 0) {
    faintRoll -= dt;
    if (faintRoll <= 0) {
      faintRoll = 1.2;
      const busy = fish.state !== 'idle' || (performance.now() - lastGather) < 2000;
      if (busy && Math.random() < 0.4) faintNow();
    }
  }
  return false;
}

function updateSatiety(dt) {
  if (TEST_FULL_SATIETY) { satiety = 100; updateSatHud(); return; }
  if (buffs.sat) { updateSatHud(); return; }   /* 飽食維持效果：保留飽食度，不消耗 */
  if (satiety > 0) {
    satiety = Math.max(0, satiety - SAT_DRAIN * dt);
    updateSatHud();
  }
}

function eatDish(name) {
  const rec = inventory[name];
  if (!rec || !rec.sat) return false;
  satiety = Math.min(100, satiety + rec.sat);
  rec.count--;
  if (rec.count <= 0) delete inventory[name];
  updateSatHud();
  if (rec.eff) applyEffect(rec.eff);
  const effDesc = rec.eff ? (EFFECT[rec.eff] ? EFFECT[rec.eff].desc : rec.eff) : '';
  setPrompt('吃了 ' + name + '（飽食 +' + rec.sat + (effDesc ? '、' + effDesc : '') + '）', 'good');
  sndCatch();
  refreshPanels();
  return true;
}

/* ---------- 新的一天 ---------- */
function growthMultiplier() {
  const aliveTrees = pickSpots.filter(p => p.kind === 'tree' && p.active).length;
  const aliveBerry = pickSpots.filter(p => p.kind === 'berry' && p.active).length;
  if (aliveTrees < 10 && aliveBerry < 5) return 3;   // 生長大幅增加
  return 1 / 3;                                       // 生長減緩
}
function onNewDay() {
  const gm = growthMultiplier();
  for (const p of pickSpots) {
    if (!p.active && p.dawnRespawn) {
      if (p.kind === 'tree' && tilled.has(p.tile)) continue;
      /* 小屋左前方（料理區側）樹木生長機率降為 1/5 */
      let prob = gm >= 1 ? 1 : gm;
      /* 加成卡片：貝殼／夜光菇出現率提升 */
      if (typeof special !== 'undefined' && special.shellSpawn && p.kind === 'shell') prob = Math.min(1, prob * 2);
      if (typeof special !== 'undefined' && special.mushSpawn && p.kind === 'mush') prob = Math.min(1, prob * 2);
      if (p.kind === 'tree' && p.x < 5.8 - 1 && p.z > -1.6 + 1) {
        prob *= 1 / 5;
      }
      if (Math.random() > prob) continue;
      p.active = true;
      p.cd = 0;
      p.chopT = -1;
      p.collectT = -1;
      p.group.visible = true;
      p.group.rotation.z = 0;
      p.group.position.y = p.baseY;
      p.group.scale.set(1, 1, 1);
    }
  }
  if (typeof mineOnNewDay === 'function') mineOnNewDay();
}

/* ---------- 採集點更新 ---------- */
function updatePickSpots(dt) {
  const now = performance.now() / 1000;
  const dark = isDark();
  for (const p of pickSpots) {
    /* 已砍倒的樹保持隱藏，直到隔天重生 */
    if (p.kind === 'tree' && !p.active && (p.chopT === undefined || p.chopT < 0)) {
      p.group.visible = false;
      continue;
    }
    /* 已採集的莓果/採集點保持隱藏，直到重生 */
    if (p.kind !== 'tree' && !p.active && (p.collectT === undefined || p.collectT < 0)) {
      p.group.visible = false;
      continue;
    }
    /* 採集過渡動畫（縮小消失） */
    if (p.collectT !== undefined && p.collectT >= 0) {
      p.collectT += dt;
      const raw = Math.min(1, p.collectT / 0.5);
      /* 先輕微放大（被採摘的彈跳感），再縮小消失 */
      let s;
      if (raw < 0.2) {
        s = 1 + raw * 0.35;
      } else {
        const u = (raw - 0.2) / 0.8;
        const e = 1 - (1 - u) * (1 - u);
        s = 1.07 * (1 - e);
      }
      p.group.visible = true;
      p.group.scale.set(s, s, s);
      p.group.position.y = p.baseY + Math.sin(raw * Math.PI) * 0.15;
      p.group.rotation.y += dt * 2;
      if (raw >= 1) { p.group.visible = false; p.collectT = -1; }
      continue;
    }
    if (p.chopT !== undefined && p.chopT >= 0) {
      p.chopT += dt;
      const raw = Math.min(1, p.chopT / 0.8);
      /* ease-out: 快速倒下、尾段緩停 */
      const u = 1 - (1 - raw) * (1 - raw);
      p.group.visible = true;
      p.group.rotation.z = (p.group.userData.chopDir || 1) * u * 1.45;
      p.group.position.y = p.baseY - u * 0.25;
      const s = 1 - u * 0.55;
      p.group.scale.set(s, s, s);
      if (raw >= 1) { p.group.visible = false; p.chopT = -1; }
      continue;
    }
    if (!p.active && p.cd > 0 && p.cd !== Infinity) {
      p.cd -= dt;
      if (p.cd <= 0) {
        p.active = true;
        p.collectT = -1;
        p.group.visible = true;
        p.group.scale.set(1, 1, 1);
        p.group.position.y = p.baseY;
      }
    }
    if (p.animScale === undefined) p.animScale = (p.nightOnly ? (dark ? 1 : 0) : 1);
    const target = (p.active && (!p.nightOnly || dark)) ? 1 : 0;
    /* 夜行性植物：白天埋入土壤、夜晚鑽出，短動畫銜接 */
    const speed = (target > p.animScale) ? 8 : 6;
    p.animScale += (target - p.animScale) * Math.min(1, dt * speed);
    if (p.animScale < 0.001) p.animScale = 0;
    if (p.animScale > 0.999) p.animScale = 1;
    p.group.visible = p.animScale > 0.001;
    p.group.scale.setScalar(Math.max(0.001, p.animScale));
    /* 埋入土壤：縮小時往下沉 */
    const sink = (1 - p.animScale) * 0.55;
    p.group.position.y = p.baseY - sink + (p.bob && p.animScale > 0.01 ? Math.sin(now * 1.5 + p.ph) * 0.035 * p.animScale : 0);
  }
  const k = 0.90 + 0.09 * Math.sin(now * 8.4) + 0.05 * Math.sin(now * 15.7);
  campFlame.scale.set(1 + (1 - k) * 0.6, k, 1);
  campFlame.position.x = Math.sin(now * 5.1) * 0.035;
  campLight.intensity = 0.55 + 0.25 * k;
}

