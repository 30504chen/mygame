/* mine-scene.js — 礦坑與小屋內部場景 */
/* ============================================================ */

/* 區域狀態 */
var AREA = 'island';
var mineFlash = 0;

const MINE_ORIGIN = new THREE.Vector3(200, 0, 0);
const CABIN_ORIGIN = new THREE.Vector3(400, 0, 0);
const MINE_N = 20;
const MINE_STEP = 0.3;
const MINE_MAX_DEPTH = 16;
const MINE_BOTTOM = -5.2;

/* 礦物位置種子：新遊戲隨機產生，存檔／同場遊戲期間保持不變（否則礦坑格子會錯位） */
const MINE_SEED_KEY = 'island3d.mine.seed';
let mineSeed = 0;
(function initMineSeed() {
  try {
    const v = parseInt(localStorage.getItem(MINE_SEED_KEY) || '0', 10);
    if (!isNaN(v) && v > 0) { mineSeed = v >>> 0; return; }
  } catch (e) {}
  mineSeed = (Math.random() * 0xffffffff) >>> 0;
  try { localStorage.setItem(MINE_SEED_KEY, String(mineSeed)); } catch (e) {}
})();

const MINE_TYPES = [
  { name: '石碎屑', n: 12, color: '#a9a68f', glow: 0.0 },
  { name: '銅碎屑', n: 10, color: '#c07a3a', glow: 0.18 },
  { name: '鐵碎屑', n: 8,  color: '#8b949e', glow: 0.10 },
  { name: '銀碎屑', n: 6,  color: '#d8e0e8', glow: 0.35 },
  { name: '金碎屑', n: 4,  color: '#ffd24a', glow: 0.65 }
];

const mineCells = [];
const mineNodes = [];
const mineGroup = new THREE.Group();
const cabinGroup = new THREE.Group();
const areaFlames = [];
let mineFloorMesh = null;
let mineDust = null;
let exchangeOrb = null;
const _cellDummy = new THREE.Object3D();

/* 小屋入口（島上） */
const CABIN_DOOR = { x: CABIN.x, z: CABIN.z + CABIN.d / 2 + 0.9, r: 1.55 };

/* 材質 */
const MINE_MAT = {
  rock: new THREE.MeshStandardMaterial({ color: lin(0x4b4239), roughness: 0.98 }),
  rockD: new THREE.MeshStandardMaterial({ color: lin(0x332d27), roughness: 0.99 }),
  wood: new THREE.MeshStandardMaterial({ color: lin(0x6e4a2c), roughness: 0.9 }),
  woodD: new THREE.MeshStandardMaterial({ color: lin(0x4f3320), roughness: 0.92 }),
  metal: new THREE.MeshStandardMaterial({ color: lin(0x8a8378), roughness: 0.55, metalness: 0.35 }),
  stone: new THREE.MeshStandardMaterial({ color: lin(0x8a857c), roughness: 0.96 }),
  dark: new THREE.MeshStandardMaterial({ color: lin(0x14100d), roughness: 1 })
};

const mineCrystalMats = {};
for (const _t of MINE_TYPES) {
  if (_t.name === '石碎屑') continue;
  mineCrystalMats[_t.name] = new THREE.MeshStandardMaterial({
    color: lin(_t.color), emissive: lin(_t.color), emissiveIntensity: _t.glow,
    roughness: 0.28, metalness: 0.25
  });
}

/* 火焰紋理（共用） */
const FLAME_TEX_OUT = flameTexture(false);
const FLAME_TEX_IN = flameTexture(true);

/* ---------- 工具 ---------- */
function mineRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function setLayer(obj, layer) {
  obj.traverse(o => { o.layers.set(layer); });
}

function mkBox(parent, w, h, d, mat, x, y, z, ry) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (ry) m.rotation.y = ry;
  m.castShadow = false; m.receiveShadow = false;
  parent.add(m);
  return m;
}

function mkCyl(parent, rTop, rBot, h, mat, x, y, z, seg) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg || 10), mat);
  m.position.set(x, y, z);
  m.castShadow = false; m.receiveShadow = false;
  parent.add(m);
  return m;
}

function makeSign(text, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
  g.strokeStyle = '#2a1a0e'; g.lineWidth = 8; g.strokeRect(6, 6, 500, 116);
  g.fillStyle = fg; g.font = 'bold 64px "Microsoft JhengHei",sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  s.scale.set(3.2, 0.8, 1);
  return s;
}

function makeFlame(w, h) {
  const g = new THREE.Group();
  const outer = new THREE.Sprite(new THREE.SpriteMaterial({
    map: FLAME_TEX_OUT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  }));
  outer.scale.set(w, h, 1);
  g.add(outer);
  const inner = new THREE.Sprite(new THREE.SpriteMaterial({
    map: FLAME_TEX_IN, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  }));
  inner.scale.set(w * 0.55, h * 0.6, 1);
  inner.position.y = -h * 0.08;
  g.add(inner);
  return g;
}

function addTorch(parent, x, y, z) {
  mkBox(parent, 0.12, 1.1, 0.12, MINE_MAT.wood, x, y - 0.55, z);
  const f = makeFlame(0.55, 0.9);
  f.position.set(x, y + 0.12, z);
  parent.add(f);
  areaFlames.push({ g: f, baseY: y + 0.12, ph: Math.random() * 6.28 });
  const light = new THREE.PointLight(0xffa04a, 0.95, 13, 2);
  light.position.set(x, y + 0.2, z);
  parent.add(light);
}

/* ---------- 礦物節點 ---------- */
function makeNodeGroup(type, rng) {
  const g = new THREE.Group();
  const rockParts = [];
  const rockCount = 3 + Math.floor(rng() * 2);
  for (let i = 0; i < rockCount; i++) {
    const r = 0.18 + rng() * 0.18;
    const geo = new THREE.DodecahedronGeometry(r, 0);
    const p = new THREE.Vector3((rng() - 0.5) * 0.55, r * 0.7 + rng() * 0.08, (rng() - 0.5) * 0.55);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rng() * 3, rng() * 3, rng() * 3));
    const s = new THREE.Vector3(1, 0.75 + rng() * 0.5, 1);
    const mw = new THREE.Matrix4().compose(p, q, s);
    rockParts.push({ geo: geo, mw: mw });
  }
  if (rockParts.length) {
    const rockGeo = mergeGeos(rockParts);
    const rockMesh = new THREE.Mesh(rockGeo, MINE_MAT.rock);
    g.add(rockMesh);
  }
  if (type.name !== '石碎屑') {
    const crystalParts = [];
    const count = 4 + Math.floor(rng() * 3);
    for (let i = 0; i < count; i++) {
      const r = 0.10 + rng() * 0.07;
      const geo = new THREE.OctahedronGeometry(r, 0);
      const ang = (i / count) * Math.PI * 2 + rng() * 0.6;
      const rr = 0.10 + rng() * 0.22;
      const p = new THREE.Vector3(Math.cos(ang) * rr, 0.26 + rng() * 0.16, Math.sin(ang) * rr);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler((rng() - 0.5) * 0.7, rng() * 3, (rng() - 0.5) * 0.7));
      const s = new THREE.Vector3(1, 1.8 + rng() * 1.2, 1);
      const mw = new THREE.Matrix4().compose(p, q, s);
      crystalParts.push({ geo: geo, mw: mw });
    }
    const mat = mineCrystalMats[type.name];
    const crystalGeo = mergeGeos(crystalParts);
    const crystalMesh = new THREE.Mesh(crystalGeo, mat);
    g.add(crystalMesh);
  }
  const ring = makeRing(new THREE.Color(type.color).getHex(), 0.26);
  ring.scale.setScalar(0.85);
  g.add(ring);
  g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return { group: g, ring: ring };
}

function placeMineNode(n) {
  const h = mineCellHeight(n.cellIndex);
  n.baseY = h + 0.02;
  n.group.position.set(n.lx, n.baseY, n.lz);
  n.badge.set(n.wx, h + 1.12, n.wz);
}

function buildMineNodes() {
  const rng = mineRng(mineSeed || 1);
  const cells = [];
  for (let cz = 2; cz <= 17; cz++) {
    for (let cx = 2; cx <= 17; cx++) {
      if (cx === 9 || cx === 10) continue;
      if (cz >= 14 && cx >= 7 && cx <= 12) continue;
      cells.push({ cx: cx, cz: cz });
    }
  }
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = cells[i]; cells[i] = cells[j]; cells[j] = t;
  }
  const total = MINE_TYPES.reduce((s, t) => s + t.n, 0);
  const chosen = cells.slice(0, total);
  const ex = 9.5, ez = 18;
  chosen.sort((a, b) => (Math.hypot(a.cx - ex, a.cz - ez) - Math.hypot(b.cx - ex, b.cz - ez)));
  let idx = 0;
  for (const t of MINE_TYPES) {
    for (let k = 0; k < t.n; k++) {
      const c = chosen[idx++];
      if (!c) break;
      const lx = -MINE_N / 2 + c.cx + 0.5;
      const lz = -MINE_N / 2 + c.cz + 0.5;
      const cellIndex = c.cz * MINE_N + c.cx;
      const built = makeNodeGroup(t, mineRng((0x9001 + idx * 7919) ^ mineSeed));
      const node = {
        name: t.name, type: t, cx: c.cx, cz: c.cz, cellIndex: cellIndex,
        lx: lx, lz: lz, wx: MINE_ORIGIN.x + lx, wz: MINE_ORIGIN.z + lz,
        group: built.group, active: true, baseY: 0.02,
        badge: new THREE.Vector3(MINE_ORIGIN.x + lx, 1.12, MINE_ORIGIN.z + lz),
        ring: built.ring
      };
      built.group.position.set(lx, 0.02, lz);
      mineGroup.add(built.group);
      placeMineNode(node);
      mineNodes.push(node);
    }
  }
}

/* ---------- 地形 ---------- */
function mineCellHeight(index) {
  const c = mineCells[index];
  return c ? -c.depth * MINE_STEP : 0;
}

function updateMineCellMatrix(index) {
  const c = mineCells[index];
  if (!c || !mineFloorMesh) return;
  const h = -c.depth * MINE_STEP;
  _cellDummy.position.set(c.lx, (h + MINE_BOTTOM) / 2, c.lz);
  _cellDummy.scale.set(1, h - MINE_BOTTOM, 1);
  _cellDummy.rotation.set(0, 0, 0);
  _cellDummy.updateMatrix();
  mineFloorMesh.setMatrixAt(index, _cellDummy.matrix);
  mineFloorMesh.instanceMatrix.needsUpdate = true;
}

function mineDigCell(index) {
  const c = mineCells[index];
  if (!c) return 0;
  if (c.depth < MINE_MAX_DEPTH) {
    c.depth++;
    updateMineCellMatrix(index);
  }
  for (const n of mineNodes) {
    if (n.cellIndex === index && n.active) placeMineNode(n);
  }
  return c.depth;
}

function buildMineFloor() {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.98, metalness: 0 });
  const mesh = new THREE.InstancedMesh(geo, mat, MINE_N * MINE_N);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const col = new THREE.Color();
  for (let cz = 0; cz < MINE_N; cz++) {
    for (let cx = 0; cx < MINE_N; cx++) {
      const i = cz * MINE_N + cx;
      const lx = -MINE_N / 2 + cx + 0.5;
      const lz = -MINE_N / 2 + cz + 0.5;
      const n = hash(cx * 1.7 + 3, cz * 2.1 + 7);
      col.setHSL(0.075, 0.12, 0.22 + n * 0.05).convertSRGBToLinear();
      mesh.setColorAt(i, col);
      mineCells.push({ depth: 0, lx: lx, lz: lz });
      _cellDummy.position.set(lx, (0 + MINE_BOTTOM) / 2, lz);
      _cellDummy.scale.set(1, 0 - MINE_BOTTOM, 1);
      _cellDummy.rotation.set(0, 0, 0);
      _cellDummy.updateMatrix();
      mesh.setMatrixAt(i, _cellDummy.matrix);
    }
  }
  mesh.instanceColor.needsUpdate = true;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = false; mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mineGroup.add(mesh);
  mineFloorMesh = mesh;
}

function buildMineBase() {
  const bedrock = new THREE.Mesh(new THREE.PlaneGeometry(42, 42),
    new THREE.MeshStandardMaterial({ color: lin(0x1b1815), roughness: 1 }));
  bedrock.rotation.x = -Math.PI / 2;
  bedrock.position.y = MINE_BOTTOM - 0.05;
  mineGroup.add(bedrock);
}

/* ---------- 礦坑牆體 ---------- */
function buildMineWalls() {
  const rock = MINE_MAT.rock;
  const rockD = MINE_MAT.rockD;
  const wood = MINE_MAT.wood;
  const woodD = MINE_MAT.woodD;
  const metal = MINE_MAT.metal;

  mkBox(mineGroup, 22, 6.5, 0.8, rock, 0, 3.25, -10.4);
  mkBox(mineGroup, 0.8, 6.5, 22, rock, -10.4, 3.25, 0);

  const rr = mineRng(0xabc123 ^ mineSeed);
  for (let i = 0; i < 18; i++) {
    const x = -9.8 + i * 1.15;
    const y = 0.35 + rr() * 2.8;
    const z = -10.0 + (rr() - 0.5) * 0.3;
    const s = 0.35 + rr() * 0.55;
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rr() < 0.5 ? rock : rockD);
    m.position.set(x, y, z);
    m.rotation.set(rr() * 3, rr() * 3, rr() * 3);
    m.scale.set(1, 0.7 + rr() * 0.8, 1);
    mineGroup.add(m);
  }
  for (let i = 0; i < 14; i++) {
    const z = -9.8 + i * 1.4;
    const y = 0.35 + rr() * 2.6;
    const x = -10.0 + (rr() - 0.5) * 0.3;
    const s = 0.35 + rr() * 0.55;
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rr() < 0.5 ? rock : rockD);
    m.position.set(x, y, z);
    m.rotation.set(rr() * 3, rr() * 3, rr() * 3);
    m.scale.set(0.7 + rr() * 0.8, 1, 1);
    mineGroup.add(m);
  }

  for (const x of [-8, -4, 0, 4, 8]) mkBox(mineGroup, 0.34, 4.4, 0.34, wood, x, 2.2, -9.95);
  mkBox(mineGroup, 20, 0.38, 0.38, woodD, 0, 4.3, -9.95);
  for (const sx of [-1, 1]) {
    const b = mkBox(mineGroup, 0.26, 3.4, 0.26, wood, sx * 7.0, 2.3, -9.9);
    b.rotation.z = sx * 0.45;
  }

  mkBox(mineGroup, 0.4, 0.38, 20.4, rockD, 10.2, 0.19, 0);
  mkBox(mineGroup, 20.4, 0.38, 0.4, rockD, 0, 0.19, 10.2);

  mkBox(mineGroup, 0.32, 3.2, 0.32, wood, -1.3, 1.6, 9.8);
  mkBox(mineGroup, 0.32, 3.2, 0.32, wood, 1.3, 1.6, 9.8);
  mkBox(mineGroup, 3.0, 0.34, 0.36, woodD, 0, 3.25, 9.8);
  mkBox(mineGroup, 2.4, 0.14, 0.5, rockD, 0, 0.07, 9.55);
  mkBox(mineGroup, 2.4, 0.14, 0.5, rockD, 0, 0.21, 9.85);
  mkBox(mineGroup, 2.4, 0.14, 0.5, rockD, 0, 0.35, 10.15);

  for (let z = -6; z <= 8; z += 1.2) mkBox(mineGroup, 1.5, 0.09, 0.22, woodD, 0, 0.05, z);
  mkBox(mineGroup, 0.08, 0.08, 15.5, metal, -0.45, 0.15, 1.0);
  mkBox(mineGroup, 0.08, 0.08, 15.5, metal, 0.45, 0.15, 1.0);

  const cart = new THREE.Group();
  cart.position.set(0, 0, -3.2);
  mkBox(cart, 1.3, 0.7, 0.9, metal, 0, 0.55, 0);
  mkBox(cart, 1.4, 0.1, 1.0, woodD, 0, 0.95, 0);
  for (const sx of [-0.55, 0.55]) for (const sz of [-0.32, 0.32]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 10), woodD);
    w.rotation.z = Math.PI / 2;
    w.position.set(sx, 0.22, sz);
    cart.add(w);
  }
  const rr2 = mineRng(0x2222 ^ mineSeed);
  for (let i = 0; i < 4; i++) {
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16 + rr2() * 0.12, 0), rock);
    r.position.set((rr2() - 0.5) * 0.7, 0.95 + rr2() * 0.12, (rr2() - 0.5) * 0.5);
    cart.add(r);
  }
  mineGroup.add(cart);

  for (const p of [[-9.6, -4], [-9.6, 4], [4, -9.6], [-4, -9.6]]) {
    const m = mushroomMesh();
    m.scale.setScalar(1.35);
    m.position.set(p[0], 0.04, p[1]);
    mineGroup.add(m);
  }

  addTorch(mineGroup, -8, 2.75, -9.55);
  addTorch(mineGroup, 0, 2.75, -9.55);
  addTorch(mineGroup, 8, 2.75, -9.55);
  addTorch(mineGroup, -9.55, 2.55, 3.0);

  const exitSign = makeSign('出口', '#2a1a0e', '#f2d8a8');
  exitSign.scale.set(2.2, 0.55, 1);
  exitSign.position.set(0, 3.7, 9.55);
  mineGroup.add(exitSign);

  mineGroup.add(new THREE.AmbientLight(0x7a6650, 0.85));
  const fill = new THREE.DirectionalLight(0x9fb4d8, 0.42);
  fill.position.set(-6, 12, 8);
  mineGroup.add(fill);
  mineGroup.add(fill.target);
}

/* ---------- 小屋內部 ---------- */
function buildCabinInterior() {
  const wood = new THREE.MeshStandardMaterial({ color: lin(0x8a5a34), roughness: 0.9 });
  const woodD = new THREE.MeshStandardMaterial({ color: lin(0x5f3b22), roughness: 0.92 });
  const woodL = new THREE.MeshStandardMaterial({ color: lin(0xa8784a), roughness: 0.88 });
  const plaster = new THREE.MeshStandardMaterial({ color: lin(0xd8c4a0), roughness: 0.95 });
  const stone = new THREE.MeshStandardMaterial({ color: lin(0x8a857c), roughness: 0.96 });
  const dark = new THREE.MeshStandardMaterial({ color: lin(0x14100d), roughness: 1 });
  const fabricR = new THREE.MeshStandardMaterial({ color: lin(0x8a3a32), roughness: 0.9 });
  const fabricC = new THREE.MeshStandardMaterial({ color: lin(0xe8dcc4), roughness: 0.92 });
  const metal = new THREE.MeshStandardMaterial({ color: lin(0x8a8378), roughness: 0.55, metalness: 0.35 });

  mkBox(cabinGroup, 16, 0.3, 10, woodD, 0, -0.16, 0);
  for (let i = 0; i < 12; i++) {
    const z = -4.5 + i * 0.82;
    mkBox(cabinGroup, 15.8, 0.06, 0.76, (i % 2 ? wood : woodL), 0, -0.03, z);
  }

  mkBox(cabinGroup, 16.4, 3.4, 0.35, plaster, 0, 1.7, -5.15);
  mkBox(cabinGroup, 0.35, 3.4, 10.4, plaster, -8.15, 1.7, 0);

  for (const x of [-8, -4, 0, 4, 8]) mkBox(cabinGroup, 0.22, 3.4, 0.18, woodD, x, 1.7, -4.92);
  mkBox(cabinGroup, 16.2, 0.18, 0.18, woodD, 0, 0.35, -4.92);
  mkBox(cabinGroup, 16.2, 0.18, 0.18, woodD, 0, 3.0, -4.92);
  for (const z of [-5, -2.5, 0, 2.5, 5]) mkBox(cabinGroup, 0.18, 3.4, 0.22, woodD, -7.92, 1.7, z);
  mkBox(cabinGroup, 16.0, 0.9, 0.1, wood, 0, 0.45, -4.9);

  mkBox(cabinGroup, 0.3, 3.4, 0.3, woodD, 8.0, 1.7, -5.0);
  for (const z of [-1.5, 0.5, 2.5, 4.5]) mkBox(cabinGroup, 0.2, 0.8, 0.2, woodD, 8.0, 0.4, z);
  mkBox(cabinGroup, 0.14, 0.12, 6.4, woodD, 8.0, 0.8, 1.6);

  mkBox(cabinGroup, 6.5, 0.12, 0.14, woodD, -4.75, 0.8, 5.0);
  mkBox(cabinGroup, 6.5, 0.12, 0.14, woodD, 4.75, 0.8, 5.0);
  for (const x of [-7.8, -1.3, 1.3, 7.8]) mkBox(cabinGroup, 0.22, 0.9, 0.22, woodD, x, 0.45, 5.0);
  mkBox(cabinGroup, 0.26, 2.7, 0.26, woodD, -0.9, 1.35, 4.95);
  mkBox(cabinGroup, 0.26, 2.7, 0.26, woodD, 0.9, 1.35, 4.95);
  mkBox(cabinGroup, 2.1, 0.28, 0.3, woodD, 0, 2.72, 4.95);
  const door = mkBox(cabinGroup, 0.12, 2.3, 1.6, wood, 0.95, 1.15, 4.2);
  door.rotation.y = -0.7;

  const glassMat = new THREE.MeshStandardMaterial({ color: lin(0x9fd6e8), emissive: lin(0x2a5a6a), emissiveIntensity: 0.4, roughness: 0.2 });
  mkBox(cabinGroup, 1.4, 1.2, 0.12, woodD, 2.0, 1.9, -4.9);
  mkBox(cabinGroup, 1.1, 0.9, 0.06, glassMat, 2.0, 1.9, -4.86);

  /* 礦坑入口 */
  mkBox(cabinGroup, 2.6, 2.6, 0.2, dark, -5, 1.3, -4.92);
  mkBox(cabinGroup, 0.28, 3.0, 0.28, woodD, -6.4, 1.5, -4.78);
  mkBox(cabinGroup, 0.28, 3.0, 0.28, woodD, -3.6, 1.5, -4.78);
  mkBox(cabinGroup, 3.1, 0.3, 0.3, woodD, -5, 3.0, -4.78);
  for (let i = 0; i < 3; i++) mkBox(cabinGroup, 2.0, 0.08, 0.4, stone, -5, 0.04 + i * 0.04, -4.4 + i * 0.35);
  mkBox(cabinGroup, 0.06, 0.08, 2.4, metal, -5.45, 0.12, -3.3);
  mkBox(cabinGroup, 0.06, 0.08, 2.4, metal, -4.55, 0.12, -3.3);
  for (let z = -4.3; z < -2.2; z += 0.6) mkBox(cabinGroup, 1.3, 0.06, 0.18, woodD, -5, 0.05, z);

  const lant = new THREE.PointLight(0xffb066, 0.7, 7, 2);
  lant.position.set(-6.3, 2.2, -4.6);
  cabinGroup.add(lant);
  mkBox(cabinGroup, 0.18, 0.3, 0.18, metal, -6.3, 2.2, -4.6);

  const signMine = makeSign('礦坑入口', '#2a1a0e', '#f2d8a8');
  signMine.position.set(-5, 3.25, -4.85);
  cabinGroup.add(signMine);

  /* 休息區 */
  const rug = new THREE.Mesh(new THREE.CircleGeometry(2.1, 32), fabricR);
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(3.8, 0.02, -1.4);
  cabinGroup.add(rug);
  const rugRing = new THREE.Mesh(new THREE.RingGeometry(1.9, 2.1, 32),
    new THREE.MeshStandardMaterial({ color: lin(0xc08a52), roughness: 0.9, side: THREE.DoubleSide }));
  rugRing.rotation.x = -Math.PI / 2;
  rugRing.position.set(3.8, 0.035, -1.4);
  cabinGroup.add(rugRing);

  const bx = 4.8, bz = -3.6;
  mkBox(cabinGroup, 2.4, 0.5, 1.5, woodD, bx, 0.25, bz);
  mkBox(cabinGroup, 2.2, 0.28, 1.3, fabricC, bx, 0.62, bz);
  mkBox(cabinGroup, 1.5, 0.12, 1.32, fabricR, bx - 0.35, 0.78, bz);
  mkBox(cabinGroup, 0.62, 0.18, 0.9, fabricC, bx + 0.72, 0.82, bz);
  mkBox(cabinGroup, 0.18, 1.3, 1.5, woodD, bx + 1.2, 0.65, bz);

  const tx = 2.0, tz = 0.2;
  mkBox(cabinGroup, 1.4, 0.12, 0.9, woodL, tx, 0.74, tz);
  for (const dx of [-0.55, 0.55]) for (const dz of [-0.3, 0.3]) {
    mkBox(cabinGroup, 0.12, 0.74, 0.12, woodD, tx + dx, 0.37, tz + dz);
  }
  for (const sx of [1.2, 2.8]) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.24, 0.12, 12), wood);
    st.position.set(sx, 0.46, tz + 0.75);
    cabinGroup.add(st);
    mkBox(cabinGroup, 0.1, 0.46, 0.1, woodD, sx, 0.23, tz + 0.75);
  }
  mkBox(cabinGroup, 0.1, 0.22, 0.1, fabricC, tx, 0.91, tz);
  const candle = new THREE.PointLight(0xffc070, 0.5, 4, 2);
  candle.position.set(tx, 1.1, tz);
  cabinGroup.add(candle);

  const fx = 6.9, fz = -4.35;
  mkBox(cabinGroup, 2.6, 0.2, 1.2, stone, fx, 0.1, fz + 0.2);
  mkBox(cabinGroup, 0.55, 2.2, 0.8, stone, fx - 1.0, 1.1, fz);
  mkBox(cabinGroup, 0.55, 2.2, 0.8, stone, fx + 1.0, 1.1, fz);
  mkBox(cabinGroup, 2.55, 0.5, 0.8, stone, fx, 2.2, fz);
  mkBox(cabinGroup, 1.35, 1.45, 0.45, dark, fx, 0.8, fz - 0.08);
  for (let i = 0; i < 3; i++) {
    const l = mkBox(cabinGroup, 0.7, 0.14, 0.14, woodD, fx + (i - 1) * 0.18, 0.28 + (i % 2) * 0.06, fz + 0.15);
    l.rotation.y = i * 0.6;
  }
  const fire = makeFlame(1.1, 1.6);
  fire.position.set(fx, 0.55, fz + 0.25);
  cabinGroup.add(fire);
  areaFlames.push({ g: fire, baseY: 0.55, ph: 1.7 });
  const fireLight = new THREE.PointLight(0xff8a3c, 1.15, 9, 2);
  fireLight.position.set(fx, 1.0, fz + 0.4);
  cabinGroup.add(fireLight);

  const signRest = makeSign('休息區', '#2a1a0e', '#f6dfb0');
  signRest.scale.set(2.6, 0.65, 1);
  signRest.position.set(4.1, 3.05, -4.85);
  cabinGroup.add(signRest);

  /* ---------- 合成台 ---------- */
  const bench = new THREE.Group();
  bench.position.set(-6.75, 0, 1.8);
  /* 桌檯 */
  mkBox(bench, 1.9, 0.18, 0.9, woodL, 0, 0.78, 0);
  for (const dx of [-0.78, 0.78]) for (const dz of [-0.32, 0.32]) {
    mkBox(bench, 0.15, 0.78, 0.15, woodD, dx, 0.39, dz);
  }
  /* 鐵砧 */
  mkBox(bench, 0.58, 0.26, 0.34, metal, -0.52, 0.93, 0);
  mkBox(bench, 0.72, 0.09, 0.4, metal, -0.52, 0.88, 0);
  /* 榔頭 */
  const hammer = mkBox(bench, 0.14, 0.14, 0.42, woodD, 0.32, 0.92, 0.12);
  hammer.rotation.z = 0.45;
  mkBox(bench, 0.24, 0.2, 0.18, metal, 0.18, 1.02, 0.28);
  /* 桌上散落的礦石碎塊 */
  const rr3 = mineRng(0x5eed ^ mineSeed);
  for (let i = 0; i < 6; i++) {
    const s = 0.09 + rr3() * 0.07;
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0),
      new THREE.MeshStandardMaterial({ color: lin([0xa9a68f, 0xc07a3a, 0x8b949e, 0xd8e0e8, 0xffd24a][i % 5]), roughness: 0.7, metalness: 0.2 }));
    m.position.set(-0.15 + (rr3() - 0.5) * 0.8, 0.92, (rr3() - 0.5) * 0.55);
    m.rotation.set(rr3() * 3, rr3() * 3, rr3() * 3);
    bench.add(m);
  }
  /* 工作檯底下的櫃子 */
  mkBox(bench, 0.6, 0.55, 0.75, woodD, -0.48, 0.30, 0);
  cabinGroup.add(bench);
  const signBench = makeSign('合成台', '#2a1a0e', '#f2d8a8');
  signBench.scale.set(2.3, 0.58, 1);
  signBench.position.set(-6.75, 2.85, 1.8);
  cabinGroup.add(signBench);

  /* ---------- 交換機 ---------- */
  const ex = new THREE.Group();
  ex.position.set(6.75, 0, 2.6);
  mkBox(ex, 0.95, 1.15, 0.95, stone, 0, 0.575, 0);
  mkBox(ex, 1.15, 0.12, 1.15, metal, 0, 1.2, 0);
  mkBox(ex, 0.7, 0.16, 0.7, metal, 0, 0.08, 0);
  exchangeOrb = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.44),
    new THREE.MeshStandardMaterial({ color: lin(0xffd24a), emissive: lin(0xa8841c), emissiveIntensity: 0.65, roughness: 0.3, metalness: 0.6 }));
  exchangeOrb.position.y = 1.75;
  ex.add(exchangeOrb);
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2;
    const corner = mkBox(ex, 0.16, 0.55, 0.16, stone, Math.cos(a) * 0.62, 0.275, Math.sin(a) * 0.62);
  }
  const exLight = new THREE.PointLight(0xffc860, 0.95, 6, 2);
  exLight.position.set(0, 2.0, 0);
  ex.add(exLight);
  cabinGroup.add(ex);
  const signEx = makeSign('交換機', '#2a1a0e', '#f2d8a8');
  signEx.scale.set(2.3, 0.58, 1);
  signEx.position.set(6.75, 2.85, 2.6);
  cabinGroup.add(signEx);

  /* ---------- 礦物倉庫 ---------- */
  const mChest = new THREE.Group();
  mChest.position.set(7.2, 0, -0.8);
  const chestWood = new THREE.MeshStandardMaterial({ color: lin(0x8a5e39), roughness: 0.8 });
  const chestWoodD = new THREE.MeshStandardMaterial({ color: lin(0x6d492b), roughness: 0.9 });
  const chestMetal = new THREE.MeshStandardMaterial({ color: lin(0xb9bec4), roughness: 0.4, metalness: 0.4 });
  const mBody = mkBox(mChest, 1.1, 0.7, 0.7, chestWood, 0, 0.35, 0);
  mBody.castShadow = true; mBody.receiveShadow = true;
  mkBox(mChest, 1.15, 0.12, 0.75, chestWoodD, 0, 0.76, 0);
  mkBox(mChest, 1.12, 0.06, 0.72, chestMetal, 0, 0.35, 0);
  mkBox(mChest, 0.12, 0.16, 0.08, chestMetal, 0, 0.45, 0.36);
  const mChestSign = makeSign('礦物倉庫', '#2a1a0e', '#f2d8a8');
  mChestSign.scale.set(2.4, 0.58, 1);
  mChestSign.position.set(7.2, 1.75, -0.8);
  cabinGroup.add(mChest);
  cabinGroup.add(mChestSign);

  cabinGroup.add(new THREE.AmbientLight(0xffe4c0, 0.78));
  const dl = new THREE.DirectionalLight(0xffd8a8, 0.55);
  dl.position.set(6, 10, 8);
  cabinGroup.add(dl);
  cabinGroup.add(dl.target);
}

/* ---------- 區域切換 ---------- */
function applyAreaAtmosphere() {
  if (AREA === 'island') return;
  const mine = AREA === 'mine';
  scene.fog.color.set(mine ? 0x0a0908 : 0x1a110b);
  /* 相機固定距目標 90，霧距要比這大，否則整個場景被霧吃掉 */
  scene.fog.near = mine ? 55 : 45;
  scene.fog.far = mine ? 170 : 140;
  const g = document.getElementById('grade');
  if (g) {
    g.style.background = mine ? '#050607' : '#1a0f09';
    g.style.opacity = mine ? '0.30' : '0.12';
  }
}

function applyArea(area) {
  AREA = area;
  document.body.classList.toggle('area-mine', area === 'mine');
  document.body.classList.toggle('area-cabin', area === 'cabin');
  camera.layers.set(area === 'mine' ? 1 : area === 'cabin' ? 2 : 0);
  if (hero) hero.traverse(o => { o.layers.enable(1); o.layers.enable(2); });
  const tag = document.getElementById('areaTag');
  if (tag) {
    tag.textContent = area === 'mine' ? '礦坑' : (area === 'cabin' ? '小屋內部' : '');
    tag.classList.toggle('on', area !== 'island');
  }
  if (area === 'island') {
    if (typeof applyLight === 'function') applyLight(dayT);
  } else {
    applyAreaAtmosphere();
  }
  if (area !== 'island' && typeof fish !== 'undefined' && fish.state !== 'idle') endFishing('收竿。');
}

function areaGroundHeightAt(x, z) {
  if (AREA === 'mine') {
    const lx = x - MINE_ORIGIN.x;
    const lz = z - MINE_ORIGIN.z;
    const cx = Math.floor(lx + MINE_N / 2);
    const cz = Math.floor(lz + MINE_N / 2);
    if (cx < 0 || cx >= MINE_N || cz < 0 || cz >= MINE_N) return 0;
    return mineCellHeight(cz * MINE_N + cx);
  }
  return 0;
}

function areaWalkableAt(x, z) {
  if (AREA === 'mine') {
    const lx = x - MINE_ORIGIN.x, lz = z - MINE_ORIGIN.z;
    return lx > -9.4 && lx < 9.4 && lz > -9.4 && lz < 9.4;
  }
  const lx = x - CABIN_ORIGIN.x, lz = z - CABIN_ORIGIN.z;
  if (lx <= -7.4 || lx >= 7.4 || lz <= -4.4 || lz >= 4.4) return false;
  /* 小屋內實體家具：不能穿越 */
  for (const b of CABIN_BLOCKERS) {
    if (Math.abs(lx - b.x) < b.hx && Math.abs(lz - b.z) < b.hz) return false;
  }
  for (const b of CABIN_BLOCKER_CIRCLES) {
    if (Math.hypot(lx - b.x, lz - b.z) < b.r) return false;
  }
  return true;
}

const AREA_BADGE = new THREE.Vector3();
/* 小屋內實體家具碰撞（局部座標） */
const CABIN_BLOCKERS = [
  { x: 2.0, z: 0.2, hx: 0.75, hz: 0.5 },     /* 桌子 */
  { x: 4.8, z: -3.6, hx: 1.25, hz: 0.8 },    /* 床 */
  { x: 6.9, z: -4.35, hx: 1.35, hz: 0.75 },  /* 壁爐 */
  { x: -6.75, z: 1.8, hx: 1.02, hz: 0.55 },   /* 合成台 */
  { x: 7.2, z: -0.8, hx: 0.68, hz: 0.45 }     /* 礦物倉庫 */
];
const CABIN_BLOCKER_CIRCLES = [
  { x: 1.2, z: 0.95, r: 0.33 },             /* 板凳 */
  { x: 2.8, z: 0.95, r: 0.33 },             /* 板凳 */
  { x: 6.75, z: 2.6, r: 0.78 }              /* 交換機 */
];

function areaNearestThing() {
  if (AREA === 'island') {
    const d = Math.hypot(heroPos.x - CABIN_DOOR.x, heroPos.z - CABIN_DOOR.z);
    if (d < CABIN_DOOR.r) {
      AREA_BADGE.set(CABIN_DOOR.x, groundHeightAt(CABIN_DOOR.x, CABIN_DOOR.z) + 1.9, CABIN_DOOR.z);
      return { type: 'cabin-door', label: '按 E 進入小屋', pos: AREA_BADGE };
    }
    return null;
  }
  if (AREA === 'cabin') {
    const wbX = CABIN_ORIGIN.x - 6.75, wbZ = CABIN_ORIGIN.z + 1.8;
    if (Math.hypot(heroPos.x - wbX, heroPos.z - wbZ) < 1.9) {
      AREA_BADGE.set(wbX, 2.1, wbZ);
      return { type: 'workbench', label: '按 E 使用合成台', pos: AREA_BADGE };
    }
    const exX = CABIN_ORIGIN.x + 6.75, exZ = CABIN_ORIGIN.z + 2.6;
    if (Math.hypot(heroPos.x - exX, heroPos.z - exZ) < 1.9) {
      AREA_BADGE.set(exX, 2.3, exZ);
      return { type: 'exchange', label: '按 E 使用交換機', pos: AREA_BADGE };
    }
    const mcX = CABIN_ORIGIN.x + 7.2, mcZ = CABIN_ORIGIN.z - 0.8;
    if (Math.hypot(heroPos.x - mcX, heroPos.z - mcZ) < 1.95) {
      AREA_BADGE.set(mcX, 1.55, mcZ);
      return { type: 'mineral-chest', label: '按 E 使用礦物倉庫', pos: AREA_BADGE };
    }
    const ex = CABIN_ORIGIN.x, ez = CABIN_ORIGIN.z + 4.25;
    if (Math.hypot(heroPos.x - ex, heroPos.z - ez) < 1.55) {
      AREA_BADGE.set(ex, 1.9, ez);
      return { type: 'cabin-exit', label: '按 E 離開小屋', pos: AREA_BADGE };
    }
    const mx = CABIN_ORIGIN.x - 5, mz = CABIN_ORIGIN.z - 3.8;
    if (Math.hypot(heroPos.x - mx, heroPos.z - mz) < 2.0) {
      AREA_BADGE.set(mx, 2.2, mz);
      return { type: 'mine-entrance', label: '按 E 進入礦坑', pos: AREA_BADGE };
    }
    return null;
  }
  if (AREA === 'mine') {
    const ex = MINE_ORIGIN.x, ez = MINE_ORIGIN.z + 9.1;
    if (Math.hypot(heroPos.x - ex, heroPos.z - ez) < 1.5) {
      AREA_BADGE.set(ex, 2.2, ez);
      return { type: 'mine-exit', label: '按 E 離開礦坑', pos: AREA_BADGE };
    }
    let best = null, bestD = 1e9;
    for (const n of mineNodes) {
      if (!n.active) continue;
      const d = Math.hypot(n.wx - heroPos.x, n.wz - heroPos.z);
      if (d < 1.85 && d < bestD) { bestD = d; best = n; }
    }
    if (best) {
      AREA_BADGE.copy(best.badge);
      const has = (typeof hasPickaxe === 'function') && hasPickaxe();
      return { type: 'mine-node', node: best, label: has ? ('按 E 挖 ' + best.name) : ('需要鎬子才能挖 ' + best.name), pos: AREA_BADGE };
    }
    return null;
  }
  return null;
}

function areaInteract(t) {
  if (!t) return false;
  if (t.type === 'cabin-door') { enterCabin(); return true; }
  if (t.type === 'cabin-exit') { exitCabin(); return true; }
  if (t.type === 'mine-entrance') { enterMine(); return true; }
  if (t.type === 'mine-exit') { exitMine(); return true; }
  if (t.type === 'workbench') { if (typeof toggleSynth === 'function') toggleSynth(); return true; }
  if (t.type === 'exchange') { if (typeof toggleExchange === 'function') toggleExchange(); return true; }
  if (t.type === 'mineral-chest') { if (typeof toggleMineral === 'function') toggleMineral(); return true; }
  if (t.type === 'mine-node' && typeof startMining === 'function') { startMining(t.node); return true; }
  return false;
}

function areaPrompt(near) {
  if (mineFlash > 0) return;
  if (near) { setPrompt(near.label, ''); return; }
  if (AREA === 'mine') setPrompt('按 E 挖礦（需要鎬子）　WASD 走動', '');
  else if (AREA === 'cabin') setPrompt('左邊礦坑入口與合成台，右邊休息區、交換機、礦物倉庫', '');
}

function syncCameraToHero() {
  camTarget.set(heroPos.x, heroPos.y + 1.3, heroPos.z);
  placeCamera();
}

function switchArea(area, x, z, yaw) {
  if (typeof isDigging === 'function' && isDigging()) return;
  const fade = document.getElementById('areaFade');
  if (fade) { fade.style.transition = 'none'; fade.style.opacity = '1'; }
  applyArea(area);
  heroPos.set(x, areaGroundHeightAt(x, z), z);
  heroYaw = yaw;
  if (hero) { hero.position.copy(heroPos); hero.rotation.y = heroYaw; }
  syncCameraToHero();
  if (fade) requestAnimationFrame(() => { fade.style.transition = 'opacity .42s ease'; fade.style.opacity = '0'; });
  if (typeof playAction === 'function' && typeof actIdle !== 'undefined' && actIdle) playAction(actIdle, 0.2);
}

function enterCabin() { switchArea('cabin', CABIN_ORIGIN.x, CABIN_ORIGIN.z + 2.4, Math.PI); }
function exitCabin() { switchArea('island', CABIN.x, CABIN.z + CABIN.d / 2 + 1.9, 0); }
function enterMine() { switchArea('mine', MINE_ORIGIN.x, MINE_ORIGIN.z + 7.2, Math.PI); }
function exitMine() { switchArea('cabin', CABIN_ORIGIN.x - 5, CABIN_ORIGIN.z - 2.4, 0); }

/* ---------- 存檔 ---------- */
function mineSaveState() {
  return {
    cells: mineCells.map(c => c.depth),
    nodes: mineNodes.map(n => (n.active ? 1 : 0))
  };
}

function mineRestoreState(st) {
  if (!st) return;
  if (Array.isArray(st.cells)) {
    for (let i = 0; i < mineCells.length && i < st.cells.length; i++) {
      mineCells[i].depth = Math.max(0, Math.min(MINE_MAX_DEPTH, st.cells[i] | 0));
      updateMineCellMatrix(i);
    }
  }
  if (Array.isArray(st.nodes)) {
    for (let i = 0; i < mineNodes.length && i < st.nodes.length; i++) {
      const n = mineNodes[i];
      n.active = !!st.nodes[i];
      n.group.visible = n.active;
      n.group.scale.setScalar(1);
      if (n.active) placeMineNode(n);
    }
  }
}

function restoreArea(area, mineState) {
  if (mineState) mineRestoreState(mineState);
  applyArea(area === 'mine' || area === 'cabin' ? area : 'island');
}

function mineOnNewDay() {
  for (const n of mineNodes) {
    n.active = true;
    n.group.visible = true;
    n.group.scale.setScalar(1);
    placeMineNode(n);
  }
}

/* ---------- 更新 ---------- */
function updateMine(dt) {
  const t = performance.now() / 1000;
  for (const f of areaFlames) {
    const k = 0.92 + 0.08 * Math.sin(t * 7.5 + f.ph) + 0.04 * Math.sin(t * 13.7 + f.ph * 1.7);
    f.g.scale.set(1 + (1 - k) * 0.5, k, 1);
    f.g.position.y = f.baseY + Math.sin(t * 5.3 + f.ph) * 0.035;
  }
  if (mineDust) { mineDust.rotation.y += dt * 0.008; mineDust.position.y = Math.sin(t * 0.25) * 0.15; }
  if (exchangeOrb) {
    exchangeOrb.rotation.y += dt * 0.75;
    exchangeOrb.rotation.x += dt * 0.35;
    exchangeOrb.position.y = 1.75 + Math.sin(t * 2.3) * 0.08;
  }
  for (const n of mineNodes) {
    if (!n.active || !n.ring) continue;
    const p = 0.5 + 0.5 * Math.sin(t * 2.2 + n.wx * 0.7 + n.wz * 0.9);
    n.ring.material.opacity = 0.14 + p * 0.14;
    n.ring.scale.setScalar(0.8 + p * 0.1);
  }
  if (mineFlash > 0) mineFlash = Math.max(0, mineFlash - dt);
  if (typeof updateMining === 'function') updateMining(dt);
}

/* ---------- 建立 ---------- */
function buildMineDust() {
  const count = 70;
  const pos = new Float32Array(count * 3);
  const rr = mineRng(0x77aa ^ mineSeed);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rr() - 0.5) * 18;
    pos[i * 3 + 1] = 0.4 + rr() * 4;
    pos[i * 3 + 2] = (rr() - 0.5) * 18;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xd8c0a0, size: 0.06, transparent: true, opacity: 0.35, depthWrite: false });
  mineDust = new THREE.Points(geo, mat);
  mineDust.frustumCulled = false;
  mineGroup.add(mineDust);
}

mineGroup.position.copy(MINE_ORIGIN);
cabinGroup.position.copy(CABIN_ORIGIN);

buildMineBase();
buildMineFloor();
buildMineWalls();
buildMineNodes();
buildMineDust();
buildCabinInterior();

setLayer(mineGroup, 1);
setLayer(cabinGroup, 2);

scene.add(mineGroup);
scene.add(cabinGroup);

if (typeof eBadge !== 'undefined') { eBadge.layers.enable(1); eBadge.layers.enable(2); }
if (typeof satBubble !== 'undefined') { satBubble.layers.enable(1); satBubble.layers.enable(2); }