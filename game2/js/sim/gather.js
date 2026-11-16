/* gather.js — 海島 3D Demo：island3d 的一部分 */
/* ============================================================
   採集：海鮮與蚯蚓（靠近按 E）
   ============================================================ */
const SEAFOOD = [
  { name: '白蝦', price: 10, color: '#e8a08a', ic: 'shrimp' },
  { name: '明蝦', price: 26, color: '#f0b0a0', ic: 'shrimp' },
  { name: '花蟹', price: 18, color: '#d98a6a', ic: 'crab' },
  { name: '石蟳', price: 34, color: '#8a6a5a', ic: 'stonecrab' },
  { name: '魷魚', price: 24, color: '#e6c8bc', ic: 'squid' },
  { name: '蛤蜊', price: 8,  color: '#c8b8a0', ic: 'shell' }
];
const RESPAWN = 180;   // 秒（3 分鐘）

function shoreRadius(ang) {
  let lo = 3, hi = 24;
  for (let i = 0; i < 20; i++) {
    const m = (lo + hi) / 2;
    if (heightAt(Math.cos(ang) * m, Math.sin(ang) * m) > 0) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

function makeSeafoodMesh(ic, color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: lin(color), roughness: 0.55, metalness: 0.02 });
  if (ic === 'shrimp') {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), mat);
    body.scale.set(1.9, 0.8, 0.8);
    g.add(body);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 6), mat);
    tail.rotation.z = Math.PI / 2;
    tail.position.set(-0.32, 0.02, 0);
    g.add(tail);
  } else if (ic === 'crab') {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), mat);
    body.scale.set(1.15, 0.55, 1.0);
    g.add(body);
    for (const s of [-1, 1]) {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 5), mat);
      claw.rotation.z = s * 1.1;
      claw.position.set(s * 0.26, 0.02, 0.06);
      g.add(claw);
    }
  } else if (ic === 'shell') {
    const a = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    a.scale.set(1.3, 0.7, 1.0);
    g.add(a);
    const b = a.clone();
    b.rotation.z = Math.PI;
    b.position.y = 0.02;
    g.add(b);
  } else {
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.28, 6), mat);
    head.position.y = 0.15;
    g.add(head);
    for (let i = 0; i < 4; i++) {
      const tent = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.012, 0.22, 5), mat);
      tent.position.set(-0.09 + i * 0.06, -0.02, (i % 2 ? 0.05 : -0.05));
      g.add(tent);
    }
  }
  return g;
}

const spots = [];
/* ⚠ 陣列索引保存於存檔（save.js 13.3 規則 2）：只准 append、不准 reorder／插入／刪除 */
const wormSpots = [];   /* 蚯蚓已改為小屋前的蚯蚓槽（見 trough），空陣列保留給舊存檔相容。
                           ⚠ 陣列索引保存於存檔：不要重新塞入項目 */

function makeRing(colorHex, opacity) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.3, 0.4, 22),
    new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: opacity, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  return ring;
}

function addSpot(spec, ang, extra) {
  const sr = shoreRadius(ang);
  const r = sr + extra;
  const x = Math.cos(ang) * r, z = Math.sin(ang) * r;
  const h = heightAt(x, z);
  const g = new THREE.Group();
  g.add(makeSeafoodMesh(spec.ic, spec.color));
  const ring = makeRing(0xffffff, 0.45);
  g.add(ring);
  const baseY = h < 0 ? 0.10 : Math.max(0.06, h + 0.02);
  g.position.set(x, baseY, z);
  scene.add(g);
  spots.push({
    name: spec.name, color: spec.color, ic: spec.ic, price: spec.price,
    group: g, ring: ring, x: x, z: z, baseY: baseY,
    cd: 0, active: true, ph: Math.random() * 6.283, radius: 2.6
  });
}

(function placeGatherSpots() {
  const D = Math.PI / 180;
  /* 海鮮改由誘捕籠取得，不再有水面採集點 */
})();

/* ============================================================
   蚯蚓槽：小屋門前一個長方形木槽，裝泥土和蚯蚓
   按 E 後挖 1.5 秒，挖到 2–3 條（鏟子每級 +1），沒有冷卻
   ============================================================ */
const trough = {
  x: TROUGH_POS.x, z: TROUGH_POS.z, r: 2.9, dur: 1.5, t: -1,
  group: null, baseY: 0, worms: [],
  shovel: null, digClump: null
};

function buildTrough() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: lin(0x8a5e39), roughness: 0.88 });
  const woodD = new THREE.MeshStandardMaterial({ color: lin(0x6d492b), roughness: 0.9 });
  const soil = new THREE.MeshStandardMaterial({ color: lin(0x4a3322), roughness: 0.98 });
  const wormM = new THREE.MeshStandardMaterial({ color: lin(0xc07a6a), roughness: 0.7 });

  const W = 2.9, D = 1.1, H = 0.6, T = 0.13, LEG = 0.3;
  [[0, D / 2 - T / 2, W, T], [0, -D / 2 + T / 2, W, T]].forEach(([x, z, w, d]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), wood);
    m.position.set(x, LEG + H / 2, z);
    m.castShadow = false; m.receiveShadow = true;
    g.add(m);
  });
  [[W / 2 - T / 2, 0, T, D], [-W / 2 + T / 2, 0, T, D]].forEach(([x, z, w, d]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), woodD);
    m.position.set(x, LEG + H / 2, z);
    m.castShadow = false; m.receiveShadow = true;
    g.add(m);
  });
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, LEG, 0.16), woodD);
    leg.position.set(sx * (W / 2 - 0.24), LEG / 2, sz * (D / 2 - 0.2));
    leg.castShadow = false;
    g.add(leg);
  });

  const top = LEG + H;
  const dirt = new THREE.Mesh(new THREE.BoxGeometry(W - T * 2 - 0.02, 0.16, D - T * 2 - 0.02), soil);
  dirt.position.set(0, top - 0.12, 0);
  dirt.receiveShadow = true;
  g.add(dirt);

  for (let i = 0; i < 8; i++) {
    const clump = new THREE.Mesh(new THREE.SphereGeometry(0.08 + Math.random() * 0.05, 7, 5), soil);
    clump.position.set((Math.random() - 0.5) * (W - 0.7), top - 0.03, (Math.random() - 0.5) * (D - 0.5));
    clump.scale.y = 0.5;
    g.add(clump);
  }

  for (let i = 0; i < 6; i++) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.26, 6), wormM);
    w.position.set((Math.random() - 0.5) * (W - 0.9), top - 0.02, (Math.random() - 0.5) * (D - 0.55));
    w.rotation.z = Math.PI / 2;
    w.rotation.y = Math.random() * 3;
    w.userData.r0 = w.rotation.y;
    g.add(w);
    trough.worms.push(w);
  }

  /* 靠在槽邊的鏟子，提示這裡要用鏟子挖 */
  const metal = new THREE.MeshStandardMaterial({ color: lin(0xb9bec4), roughness: 0.45, metalness: 0.35 });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 1.05, 8), woodD);
  handle.position.set(0.15, LEG + 0.55, D / 2 + 0.2);
  handle.rotation.x = -0.3;
  handle.castShadow = true;
  g.add(handle);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, 0.07), metal);
  blade.position.set(0.15, 0.3, D / 2 + 0.35);
  blade.rotation.x = -0.3;
  blade.castShadow = true;
  g.add(blade);

  return g;
}

(function placeTrough() {
  const corners = [[-1.45, 0], [1.45, 0], [0, -0.55], [0, 0.55]];
  let low = 99;
  corners.forEach(([dx, dz]) => { low = Math.min(low, groundHeightAt(trough.x + dx, trough.z + dz)); });
  trough.baseY = low + 0.76;
  trough.group = buildTrough();
  trough.group.position.set(trough.x, trough.baseY, trough.z);
  scene.add(trough.group);
  BLOCKERS.push({ x: trough.x, z: trough.z, hx: 1.6, hz: 0.75 });
})();

function isDigging() { return trough.t >= 0 || (typeof miningBusy === 'function' && miningBusy()); }

function createShovelProp() {
  const g = new THREE.Group();
  const woodD = new THREE.MeshStandardMaterial({ color: lin(0x6d492b), roughness: 0.9 });
  const metal = new THREE.MeshStandardMaterial({ color: lin(0xb9bec4), roughness: 0.45, metalness: 0.35 });
  /* 手握在握把最末端，握把向下延伸，鏟頭在下方 */
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 8), woodD);
  handle.position.y = -0.45;
  handle.castShadow = true;
  g.add(handle);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.22), metal);
  blade.position.set(0, -0.95, 0.08);
  blade.castShadow = true;
  g.add(blade);
  return g;
}
function createDigClump() {
  const g = new THREE.Group();
  const soil = new THREE.MeshStandardMaterial({ color: lin(0x4a3322), roughness: 0.98 });
  const wormM = new THREE.MeshStandardMaterial({ color: lin(0xc07a6a), roughness: 0.7 });
  const dirt = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.2, 0.26), soil);
  dirt.position.y = 0.1;
  g.add(dirt);
  for (let i = 0; i < 3; i++) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 6), wormM);
    w.position.set((Math.random() - 0.5) * 0.2, 0.22, (Math.random() - 0.5) * 0.18);
    w.rotation.z = Math.PI / 2;
    g.add(w);
  }
  g.position.set(trough.x, trough.baseY + 0.3, trough.z);
  g.visible = false;
  scene.add(g);
  return g;
}
function startDig() {
  if (isDigging() || anyPanel() || fish.state !== 'idle' || faintT > 0) return;
  trough.t = 0;
  /* 挖起的泥土+蚯蚓 */
  if (!trough.digClump) trough.digClump = createDigClump();
  trough.digClump.visible = true;
  trough.digClump.position.set(trough.x, trough.baseY + 0.3, trough.z);
  trough.digClump.scale.set(1, 1, 1);
  if (actDig) {
    actDig.timeScale = 1.0;
    playAction(actDig, 0.12);
  }
  setPrompt('挖蚯蚓…', '');
}

function updateDig(dt) {
  if (trough.t < 0) return;
  trough.t += dt;
  trough.group.position.y = trough.baseY + Math.sin(trough.t * 17) * 0.012;
  /* 挖起的泥土+蚯蚓往上拋 */
  if (trough.digClump) {
    const u = Math.min(1, trough.t / 0.6);
    trough.digClump.visible = true;
    trough.digClump.position.y = trough.baseY + 0.3 + u * 0.9;
    trough.digClump.position.x = trough.x + Math.sin(u * Math.PI) * 0.15;
    trough.digClump.rotation.y += dt * 3;
    trough.digClump.scale.setScalar(1 - u * 0.4);
  }
  if (trough.t >= trough.dur) {
    trough.t = -1;
    trough.group.position.y = trough.baseY;
    if (trough.digClump) { trough.digClump.visible = false; }
    const got = 2 + Math.floor(Math.random() * 2) + (toolLv('shovel') - 1) + ((typeof special !== 'undefined' && special.wormsPlus1) ? 1 : 0);
    bait += got;
    updateBaitHud();
    setPrompt('挖到蚯蚓 ×' + got, 'good');
    burstSplash(trough.x, trough.baseY + 1.05, trough.z, 0.4);
    sndBite();
    playAction(actIdle, 0.2);
    if (satiety <= 0 && Math.random() < 0.3) faintNow();
  }
}

/* 倉庫功能已取消 */

/* ============================================================
   倉庫箱子：放在小屋前方空地（CAMP 附近），靠近按 E 開啟
   ============================================================ */
const STORAGE_CHEST = { x: 7.6, z: 4.3, r: 2.4 };
const storageChestGroup = (function () {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: lin(0x8a5e39), roughness: 0.8 });
  const woodD = new THREE.MeshStandardMaterial({ color: lin(0x6d492b), roughness: 0.9 });
  const metal = new THREE.MeshStandardMaterial({ color: lin(0xb9bec4), roughness: 0.4, metalness: 0.4 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.7), wood);
  body.position.y = 0.35;
  body.castShadow = true; body.receiveShadow = true;
  g.add(body);

  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.12, 0.75), woodD);
  lid.position.set(0, 0.76, 0);
  lid.castShadow = true;
  g.add(lid);

  const band = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.06, 0.72), metal);
  band.position.set(0, 0.35, 0);
  g.add(band);

  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.08), metal);
  lock.position.set(0, 0.45, 0.36);
  g.add(lock);

  const h = heightAt(STORAGE_CHEST.x, STORAGE_CHEST.z);
  g.position.set(STORAGE_CHEST.x, h, STORAGE_CHEST.z);
  scene.add(g);
  return g;
})();
/* 倉庫箱子是實體，不能穿越（碰撞盒比互動距離 2.4 小得多） */
BLOCKERS.push({ x: STORAGE_CHEST.x, z: STORAGE_CHEST.z, hx: 0.62, hz: 0.42 });

/* ============================================================
   誘捕籠：碼頭旁半沉水中的網子，每日產生漁獲
   ============================================================ */
const TRAP_POS = { x: 2.2, z: 16.0, r: 2.6 };
const trap = {
  cd: DAY_SECONDS,           // 距離下次產出的秒數
  batchCount: 0,             // 已累積批數
  maxBatch: 2,
  catch: {},                 // name -> count
  group: null
};
const TRAP_CANDIDATES = [
  { name: '花蟹', w: 1 }, { name: '石蟳', w: 0.6 },
  { name: '白蝦', w: 1.2 }, { name: '明蝦', w: 0.5 },
  { name: '魷魚', w: 0.9 }
];
function trapGenBatch() {
  const total = 5 + Math.floor(Math.random() * 2); // 5-6
  /* 一批 1～4 種：1種15%／2種40%／3種30%／4種15%（種類出場率均等，不含權重） */
  const roll = Math.random();
  const types = roll < 0.15 ? 1 : (roll < 0.55 ? 2 : (roll < 0.85 ? 3 : 4));
  /* 抽種類 */
  const pool = TRAP_CANDIDATES.slice().sort(() => Math.random() - 0.5).slice(0, types);
  const weights = pool.map(c => c.w);
  const wsum = weights.reduce((a, b) => a + b, 0);
  /* 每種保底 1，剩餘依權重比例分配 */
  const result = {};
  let remaining = total;
  pool.forEach(c => { result[c.name] = 1; remaining -= 1; });
  for (let i = 0; i < pool.length; i++) {
    if (remaining <= 0) break;
    const isLast = i === pool.length - 1;
    const bonus = isLast
      ? remaining
      : Math.min(remaining, Math.max(0, Math.round((total - types) * weights[i] / wsum)));
    result[pool[i].name] += bonus;
    remaining -= bonus;
  }
  if (remaining > 0) result[pool[0].name] += remaining;
  return result;
}
function buildTrap() {
  /* 傳統竹編魚簍：底寬上窄、漏斗狀口部、竹編紋理 */
  const g = new THREE.Group();
  const bamboo = new THREE.MeshStandardMaterial({ color: lin(0xc8a868), roughness: 0.85 });
  const bambooD = new THREE.MeshStandardMaterial({ color: lin(0x8a6a3a), roughness: 0.9 });
  const bambooRim = new THREE.MeshStandardMaterial({ color: lin(0x6b4a26), roughness: 0.7 });
  const soil = new THREE.MeshStandardMaterial({ color: lin(0x4a3322), roughness: 0.98 });
  const wormM = new THREE.MeshStandardMaterial({ color: lin(0xc07a6a), roughness: 0.7 });

  const H = 0.75;            /* 主體高度 */
  const rBot = 0.95;         /* 底部半徑（較寬） */
  const rTop = 0.55;         /* 肩部半徑（收窄） */
  const rNeck = 0.38;        /* 頸部半徑 */
  const neckH = 0.18;        /* 頸部高度 */
  const rimR = 0.46;         /* 口部半徑（漏斗狀微凹） */

  /* 主體：竹編腹部（錐形圓柱） */
  const body = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, H, 16, 1, true), bamboo);
  body.position.y = H / 2;
  body.castShadow = true; body.receiveShadow = true;
  g.add(body);

  /* 底部封底（竹編底） */
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(rBot, 16), bambooD);
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.y = 0.01;
  bottom.receiveShadow = true;
  g.add(bottom);

  /* 頸部（短頸） */
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(rNeck, rTop, neckH, 16, 1, true), bambooD);
  neck.position.y = H + neckH / 2;
  neck.castShadow = true; neck.receiveShadow = true;
  g.add(neck);

  /* 口部漏斗狀竹環（向內微凹） */
  const rim = new THREE.Mesh(new THREE.TorusGeometry(rimR, 0.06, 8, 24), bambooRim);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = H + neckH;
  rim.castShadow = true;
  g.add(rim);
  /* 口部內側漏斗（微凹） */
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(rimR - 0.04, rNeck, 0.12, 16, 1, true), bambooD);
  funnel.position.y = H + neckH - 0.06;
  funnel.castShadow = true;
  g.add(funnel);

  /* 水平編織紋理：多層竹編帶 */
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const r = rBot - (rBot - rTop) * t;
    const y = 0.08 + t * (H - 0.16);
    const band = new THREE.Mesh(new THREE.TorusGeometry(r, 0.025, 6, 24), bambooD);
    band.rotation.x = Math.PI / 2;
    band.position.y = y;
    band.castShadow = true;
    g.add(band);
  }
  /* 頸部編織帶 */
  const neckBand = new THREE.Mesh(new THREE.TorusGeometry(rNeck + 0.02, 0.03, 6, 20), bambooRim);
  neckBand.rotation.x = Math.PI / 2;
  neckBand.position.y = H + neckH - 0.02;
  neckBand.castShadow = true;
  g.add(neckBand);

  /* 垂直竹條（肋） */
  const ribCount = 8;
  for (let i = 0; i < ribCount; i++) {
    const a = (i / ribCount) * Math.PI * 2;
    const pts = [];
    for (let j = 0; j <= 6; j++) {
      const t = j / 6;
      const r = rBot - (rBot - rTop) * t;
      const y = t * H;
      pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(curve, 12, 0.018, 6, false);
    const rib = new THREE.Mesh(geo, bambooD);
    rib.castShadow = true;
    g.add(rib);
  }

  /* 兩側提帶支架（竹條延伸至頸部） */
  [-1, 1].forEach(s => {
    const a = s * Math.PI / 2;
    const pts = [
      new THREE.Vector3(Math.cos(a) * rBot * 0.92, 0.1, Math.sin(a) * rBot * 0.92),
      new THREE.Vector3(Math.cos(a) * rTop * 0.95, H - 0.05, Math.sin(a) * rTop * 0.95),
      new THREE.Vector3(Math.cos(a) * rNeck * 0.9, H + neckH - 0.05, Math.sin(a) * rNeck * 0.9)
    ];
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(curve, 8, 0.022, 6, false);
    const strap = new THREE.Mesh(geo, bambooRim);
    strap.castShadow = true;
    g.add(strap);
  });

  /* 內部泥土（半沉水露出） */
  const dirt = new THREE.Mesh(new THREE.CylinderGeometry(rTop - 0.08, rBot - 0.1, 0.12, 16), soil);
  dirt.position.y = H * 0.45;
  dirt.receiveShadow = true;
  g.add(dirt);
  for (let i = 0; i < 4; i++) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.18, 6), wormM);
    w.position.set((Math.random() - 0.5) * (rBot - 0.4) * 2, H * 0.5, (Math.random() - 0.5) * (rBot - 0.4) * 2);
    w.rotation.z = Math.PI / 2;
    g.add(w);
  }

  g.position.set(TRAP_POS.x, -0.15, TRAP_POS.z);
  scene.add(g);
  return g;
}
trap.group = buildTrap();

function autoDepositTrapBatch(batch) {
  const parts = [];
  for (const n in batch) {
    const rec = SEAFOOD.find(s => s.name === n);
    const price = rec ? rec.price : 10;
    const ic = rec ? rec.ic : 'shrimp';
    const color = rec ? rec.color : '#cccccc';
    let remaining = batch[n];
    while (remaining > 0) {
      if (bagAdd(storage, { name: n, price: price, ic: ic, color: color }, 0)) { remaining--; continue; }
      if (bagAdd(inventory, { name: n, price: price, ic: ic, color: color }, 0)) { remaining--; continue; }
      break;
    }
    const deposited = batch[n] - remaining;
    if (deposited > 0) parts.push(n + ' ×' + deposited);
    if (remaining > 0) trap.catch[n] = (trap.catch[n] || 0) + remaining;
  }
  if (parts.length) {
    setPrompt('自動陷阱收成：' + parts.join('、'), 'good');
    refreshPanels();
  }
}
function updateTrap(dt) {
  if (trap.batchCount >= trap.maxBatch) return;
  trap.cd -= dt;
  if (trap.cd <= 0) {
    const batch = trapGenBatch();
    if (typeof special !== 'undefined' && special.autoTrap) {
      autoDepositTrapBatch(batch);
    } else {
      for (const n in batch) trap.catch[n] = (trap.catch[n] || 0) + batch[n];
    }
    trap.batchCount++;
    trap.cd = DAY_SECONDS;
    burstSplash(trap.x, 0, trap.z, 0.3);
  }
}
function trapHasCatch() {
  return Object.keys(trap.catch).length > 0;
}
function retrieveTrap() {
  if (!trapHasCatch()) return;
  const parts = [];
  for (const n in trap.catch) {
    const rec = SEAFOOD.find(s => s.name === n);
    const price = rec ? rec.price : 10;
    const ic = rec ? rec.ic : 'shrimp';
    const color = rec ? rec.color : '#cccccc';
    for (let i = 0; i < trap.catch[n]; i++) {
      if (!bagAdd(inventory, { name: n, price: price, ic: ic, color: color }, 0)) break;
    }
    parts.push(n + ' ×' + trap.catch[n]);
  }
  trap.catch = {};
  trap.batchCount = 0;
  trap.cd = DAY_SECONDS;
  setPrompt('取出漁獲：' + parts.join('、'), 'good');
  sndBite();
}

/* 互動提示 E */
const eBadge = (function () {
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const g = c.getContext('2d');
  g.beginPath();
  g.arc(48, 48, 33, 0, Math.PI * 2);
  g.fillStyle = 'rgba(255,250,240,.96)';
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = '#2b5b6d';
  g.stroke();
  g.fillStyle = '#2b5b6d';
  g.font = 'bold 46px "Microsoft JhengHei",sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('E', 48, 50);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(c), transparent: true, depthTest: false
  }));
  s.scale.set(0.72, 0.72, 1);
  s.visible = false;
  scene.add(s);
  return s;
})();

function merchantHere() {
  if (typeof merchantSummonLeft !== 'undefined' && merchantSummonLeft > 0) return true;
  return ((dayIndex - 1) % 3 === 0) && dayT >= 0.155 && dayT <= 0.80;
}

function nearestThing() {
  if (typeof AREA !== 'undefined' && AREA !== 'island') {
    return (typeof areaNearestThing === 'function') ? areaNearestThing() : null;
  }
  if (typeof areaNearestThing === 'function') {
    const _a = areaNearestThing();
    if (_a) return _a;
  }
  let best = null, bestD = 1e9;
  for (const sp of spots) {
    if (!sp.active) continue;
    const d = Math.hypot(sp.x - heroPos.x, sp.z - heroPos.z);
    if (d < sp.radius && d < bestD) { bestD = d; best = { type: 'seafood', spot: sp, label: '按 E 採集' + sp.name }; }
  }
  for (const w of wormSpots) {
    if (!w.active) continue;
    const d = Math.hypot(w.x - heroPos.x, w.z - heroPos.z);
    if (d < w.radius && d < bestD) { bestD = d; best = { type: 'worm', spot: w, label: '按 E 挖蚯蚓' }; }
  }
  {
    const d = Math.hypot(trough.x - heroPos.x, trough.z - heroPos.z);
    if (d < trough.r && d < bestD) {
      bestD = d;
      best = { type: 'trough', spot: { group: trough.group }, label: '按 E 用鏟子挖蚯蚓' };
    }
  }
  if (merchant && merchant.visible) {
    const d = Math.hypot(merchant.position.x - heroPos.x, merchant.position.z - heroPos.z);
    if (d < 3.4 && d < bestD) { bestD = d; best = { type: 'merchant', label: '按 E 與商人交易' }; }
  }
  const dark = isDark();
  for (const p of pickSpots) {
    if (!p.active || (p.nightOnly && !dark)) continue;
    const d = Math.hypot(p.x - heroPos.x, p.z - heroPos.z);
    if (d < p.r && d < bestD) { bestD = d; best = { type: 'pick', spot: p, label: p.label }; }
  }
  {
    const d = Math.hypot(CAMP.x - heroPos.x, CAMP.z - heroPos.z);
    if (d < 2.9 && d < bestD) { bestD = d; best = { type: 'cook', label: '按 E 生火料理' }; }
  }
  {
    const d = Math.hypot(TRAP_POS.x - heroPos.x, TRAP_POS.z - heroPos.z);
    if (d < TRAP_POS.r && d < bestD) {
      bestD = d;
      best = { type: 'trap', label: trapHasCatch() ? '按 E 取出漁獲：' + Object.keys(trap.catch).map(n => n + ' ×' + trap.catch[n]).join('、') : '誘捕籠（等待中）' };
    }
  }
  {
    const d = Math.hypot(STORAGE_CHEST.x - heroPos.x, STORAGE_CHEST.z - heroPos.z);
    if (d < STORAGE_CHEST.r && d < bestD) { bestD = d; best = { type: 'storage', label: '按 E 開啟倉庫' }; }
  }
  return best;
}

function harvestSeafood(sp) {
  if (typeof NET !== 'undefined' && NET.on) {
    NET.claim('spot', spots.indexOf(sp), function (ok) {
      if (!ok) { setPrompt('被朋友先採了！', 'bad'); return; }
      harvestSeafoodLocal(sp);
    });
    return;
  }
  harvestSeafoodLocal(sp);
}
function harvestSeafoodLocal(sp) {
  const qty = 1 + (toolLv('net') - 1) + gatherBonus();
  let got = 0;
  for (let i = 0; i < qty; i++) {
    if (bagAdd(inventory, { name: sp.name, price: sp.price, color: sp.color, ic: sp.ic }, 0)) got++;
    else break;
  }
  if (!got) { setPrompt('魚簍滿了，先賣魚或放進倉庫', 'bad'); return; }
  sp.active = false;
  sp.cd = RESPAWN;
  sp.group.visible = false;
  setPrompt('採到 ' + sp.name + (got > 1 ? ' ×' + got : '') + '！', 'good');
  burstSplash(sp.x, Math.max(0.25, sp.baseY), sp.z, 0.45);
  sndBite();
  if (satiety <= 0 && Math.random() < 0.3) faintNow();
}

function interact() {
  const pSynth = document.getElementById('panel-synth');
  const pExch = document.getElementById('panel-exchange');
  const pMineral = document.getElementById('panel-mineral');
  const pBook = document.getElementById('panel-mysterybook');
  if (pSynth && pSynth.classList.contains('on')) { toggleSynth(); return; }
  if (pExch && pExch.classList.contains('on')) { toggleExchange(); return; }
  if (pMineral && pMineral.classList.contains('on')) { toggleMineral(); return; }
  if (pBook && pBook.classList.contains('on')) { closeMysteryBook(); return; }
  if (elsShop.classList.contains('on')) { toggleShop(); return; }
  if (elsCook.classList.contains('on')) { toggleCook(); return; }
  if (elsChest.classList.contains('on')) { toggleChest(); return; }
  if (anyPanel() || fish.state !== 'idle' || faintT > 0 || isDigging()) return;
  const t = nearestThing();
  if (!t) return;
  if (typeof areaInteract === 'function' && areaInteract(t)) return;
  if (t.type === 'merchant') toggleShop();
  else if (t.type === 'cook') toggleCook();
  else if (t.type === 'pick') {
    if (t.spot.kind === 'tree') chopTree(t.spot);
    else collectFrom(t.spot);
  }
  else if (t.type === 'seafood') harvestSeafood(t.spot);
  else if (t.type === 'trough') startDig();
  else if (t.type === 'trap') retrieveTrap();
  else if (t.type === 'storage') toggleChest();
}

function updateSpots(dt) {
  if (typeof AREA !== 'undefined' && AREA !== 'island') {
    const near = nearestThing();
    if (near && near.pos) { eBadge.visible = true; eBadge.position.copy(near.pos); }
    else eBadge.visible = false;
    if (typeof areaPrompt === 'function') areaPrompt(near);
    if (satBubble.visible) satBubble.position.set(heroPos.x, heroPos.y + 1.7, heroPos.z);
    return;
  }
  updatePickSpots(dt);
  const now = performance.now() / 1000;
  for (const sp of spots) {
    if (!sp.active) {
      sp.cd -= dt;
      if (sp.cd <= 0) { sp.active = true; sp.group.visible = true; }
      continue;
    }
    sp.group.position.y = sp.baseY + Math.sin(now * 1.6 + sp.ph) * 0.04;
    sp.ring.material.opacity = 0.30 + 0.22 * (0.5 + 0.5 * Math.sin(now * 2.2 + sp.ph));
    sp.ring.scale.setScalar(1 + 0.07 * Math.sin(now * 2.2 + sp.ph));
  }
  /* 蚯蚓槽：蚯蚓微微扭動 */
  if (trough.worms.length) {
    for (let i = 0; i < trough.worms.length; i++) {
      const w = trough.worms[i];
      w.rotation.y = w.userData.r0 + Math.sin(now * 1.6 + i * 1.7) * 0.22;
    }
  }
  if (merchant) merchant.visible = merchantHere();
  if (merchantMixer && merchant && merchant.visible) merchantMixer.update(dt);

  const near = nearestThing();
  if (near) {
    let p;
    if (near.type === 'merchant') p = merchant.position;
    else if (near.type === 'trap') p = trap.group.position;
    else if (near.spot) p = near.spot.group.position;
    else if (near.pos) p = near.pos;
    else p = campGroup.position;
    eBadge.visible = true;
    eBadge.position.set(p.x, p.y + (near.type === 'pick' && near.spot.kind === 'tree' ? 2.4 : 1.35), p.z);
  } else {
    eBadge.visible = false;
  }
  if (satBubble.visible) satBubble.position.set(heroPos.x, heroPos.y + 1.7, heroPos.z);
}

