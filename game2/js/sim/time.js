/* time.js — 海島 3D Demo：island3d 的一部分 */
/* ============================================================
   時間流動：現實 2 分鐘＝遊戲一天（設計規格第 228 行）
   時段比例：清晨 3／白天 5／中午 2／下午 4／黃昏 2／夜晚 4（規格第 34 行）
   ============================================================ */
const QS = new URLSearchParams(location.search);
const DAY_SECONDS = Math.max(8, parseFloat(QS.get('daylen') || '120'));

const PHASES = [
  { key: 'dawn',  name: '清晨', share: 3, ring: '#f0c396' },
  { key: 'day',   name: '白天', share: 5, ring: '#9fd8f2' },
  { key: 'noon',  name: '中午', share: 2, ring: '#ffe9a0' },
  { key: 'after', name: '下午', share: 4, ring: '#f2c183' },
  { key: 'dusk',  name: '黃昏', share: 2, ring: '#e0906e' },
  { key: 'night', name: '夜晚', share: 4, ring: '#40567e' }
];
(() => {
  const tot = PHASES.reduce((s, p) => s + p.share, 0);
  let acc = 0;
  PHASES.forEach(p => {
    p.start = acc / tot; acc += p.share; p.end = acc / tot;
    p.mid = (p.start + p.end) * 0.5;
  });
})();

/* 每個時段中點的光線；白天沿用原本定案的光感 */
const PAL = [
  { sun: 0xffb387, sunI: 0.95, hs: 0xd2c4e4, hg: 0x6a6a58, hi: 0.44, fog: 0xe8dbe6,
    sky: ['#6888bd', '#c0c3d8', '#f7d8c2'], el: 25, az: -20, fn: 56, ff: 178, fl: 0 },
  { sun: 0xffe9c2, sunI: 1.42, hs: 0xd8ecff, hg: 0x8a9a5e, hi: 0.52, fog: 0xd8eef8,
    sky: ['#9ed6f0', '#c8e9f7', '#e9f7f8'], el: 51, az: 55, fn: 150, ff: 265, fl: 0 },
  { sun: 0xfff6e0, sunI: 1.55, hs: 0xe4f2ff, hg: 0x94a868, hi: 0.55, fog: 0xdff2fa,
    sky: ['#86cdf2', '#bfe7fb', '#f2fbfd'], el: 78, az: 120, fn: 165, ff: 285, fl: 0 },
  { sun: 0xffe2b0, sunI: 1.36, hs: 0xd8e6f6, hg: 0x8fa05c, hi: 0.50, fog: 0xe2eadf,
    sky: ['#9ecbe8', '#d8e5ec', '#f7ecd8'], el: 55, az: 175, fn: 140, ff: 255, fl: 0 },
  { sun: 0xffa15c, sunI: 1.10, hs: 0xffcfae, hg: 0x7a5f45, hi: 0.42, fog: 0xf4c8a4,
    sky: ['#5f4f80', '#dd8264', '#ffc488'], el: 27, az: 230, fn: 78, ff: 210, fl: 0.25 },
  { sun: 0x9ab4e8, sunI: 0.32, hs: 0x2a4a78, hg: 0x131a2a, hi: 0.24, fog: 0x1e2c44,
    sky: ['#12203a', '#233a5c', '#3d5573'], el: 62, az: 320, fn: 66, ff: 205, fl: 1 }
];
PAL.forEach(p => {
  p.cSun = new THREE.Color(p.sun);
  p.cHs = new THREE.Color(p.hs);
  p.cHg = new THREE.Color(p.hg);
  p.cFog = new THREE.Color(p.fog);
  p.cSky = p.sky.map(h => new THREE.Color(h));
});

/* 全畫面色調層（multiply）：讓清晨／黃昏／夜晚一眼看得出來 */
const GRADES = [
  { c: '#ffd0b4', a: 0.34 },
  { c: '#ffffff', a: 0.00 },
  { c: '#ffffff', a: 0.00 },
  { c: '#ffe0bd', a: 0.16 },
  { c: '#ffab74', a: 0.46 },
  { c: '#93a9d6', a: 0.40 }
].map(g => ({ c: new THREE.Color(g.c), a: g.a }));
const _gradeEl = document.getElementById('grade');

const _skyEl = document.getElementById('scene');
const _starsEl = document.getElementById('stars');
const _cA = new THREE.Color(), _cB = new THREE.Color();
const _skyStops = ['#9ed6f0', '#c8e9f7', '#e9f7f8'];
let nightAmt = 0;      // 0＝白天、1＝深夜（螢火蟲與星空用）

let dayT = 0;          // 0–1（一天進度）
let dayIndex = 1;      // 第幾天

function phaseAt(t) {
  for (const p of PHASES) if (t >= p.start && t < p.end) return p;
  return PHASES[PHASES.length - 1];
}

function applyLight(t) {
  if (typeof AREA !== 'undefined' && AREA !== 'island' && typeof applyAreaAtmosphere === 'function') {
    applyAreaAtmosphere();
    return;
  }
  let i = PHASES.length - 1;
  for (let k = 0; k < PHASES.length; k++) {
    if (t < PHASES[k].mid) { i = k - 1; break; }
  }
  if (i < 0) i = PHASES.length - 1;
  const j = (i + 1) % PHASES.length;
  const t0 = PHASES[i].mid;
  const t1 = (j === 0 ? PHASES[0].mid + 1 : PHASES[j].mid);
  const tt = t < t0 ? t + 1 : t;
  const raw = Math.min(1, Math.max(0, (tt - t0) / (t1 - t0)));
  const s = raw * raw * (3 - 2 * raw);
  const A = PAL[i], B = PAL[j];

  sun.color.copy(A.cSun).lerp(B.cSun, s);
  sun.intensity = A.sunI + (B.sunI - A.sunI) * s;
  hemi.color.copy(A.cHs).lerp(B.cHs, s);
  hemi.groundColor.copy(A.cHg).lerp(B.cHg, s);
  hemi.intensity = A.hi + (B.hi - A.hi) * s;
  scene.fog.color.copy(A.cFog).lerp(B.cFog, s);

  const el = (A.el + (B.el - A.el) * s) * Math.PI / 180;
  const az = (A.az + (B.az - A.az) * s) * Math.PI / 180;
  const R = 38;
  sun.position.set(
    Math.cos(el) * Math.sin(az) * R,
    Math.max(5, Math.sin(el) * R),
    Math.cos(el) * Math.cos(az) * R
  );

  for (let k = 0; k < 3; k++) {
    _cA.copy(A.cSky[k]).lerp(B.cSky[k], s);
    _skyStops[k] = '#' + _cA.getHexString();
  }
  _skyEl.style.background =
    'linear-gradient(180deg,' + _skyStops[0] + ' 0%,' + _skyStops[1] + ' 46%,' + _skyStops[2] + ' 100%)';

  _cB.copy(GRADES[i].c).lerp(GRADES[j].c, s);
  _gradeEl.style.background = '#' + _cB.getHexString();
  _gradeEl.style.opacity = (GRADES[i].a + (GRADES[j].a - GRADES[i].a) * s).toFixed(3);

  nightAmt = A.fl + (B.fl - A.fl) * s;
  scene.fog.near = A.fn + (B.fn - A.fn) * s;
  scene.fog.far = A.ff + (B.ff - A.ff) * s;
  if (_starsEl) _starsEl.style.opacity = nightAmt.toFixed(3);
}

/* 日晷 */
const dialArcs = document.getElementById('dialArcs');
const dialEl = document.getElementById('dial');
const dialDisc = document.getElementById('dialDisc');
const dialDot = document.getElementById('dialDot');
const dialName = document.getElementById('dialName');
const dialSub = document.getElementById('dialSub');

function polar(r, deg) {
  const a = (deg - 90) * Math.PI / 180;
  return [Math.cos(a) * r, Math.sin(a) * r];
}
function arcSeg(r, a0, a1) {
  const p0 = polar(r, a0), p1 = polar(r, a1);
  const large = (a1 - a0) > 180 ? 1 : 0;
  return 'M' + p0[0].toFixed(2) + ' ' + p0[1].toFixed(2) +
    ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2);
}
(function buildDial() {
  let html = '<circle r="50" fill="none" stroke="#e8dbc0" stroke-width="15"/>';
  const simple = [
    { name: '白天', start: PHASES[0].start, end: PHASES[4].start, ring: '#9fd8f2' },
    { name: '黃昏', start: PHASES[4].start, end: PHASES[5].start, ring: '#e0906e' },
    { name: '夜晚', start: PHASES[5].start, end: 1, ring: '#40567e' }
  ];
  simple.forEach(p => {
    html += '<path d="' + arcSeg(50, p.start * 360, p.end * 360) +
      '" fill="none" stroke="' + p.ring + '" stroke-width="13" stroke-linecap="butt"/>';
  });
  dialArcs.innerHTML = html;
})();

function updateDial() {
  const p = phaseAt(dayT);
  const night = p.key === 'night';
  const simpleName = (p.key === 'dusk') ? '黃昏' : (p.key === 'night' ? '夜晚' : '白天');
  dialName.textContent = simpleName;
  dialSub.textContent = '第 ' + dayIndex + ' 天';
  const pt = polar(50, dayT * 360);
  dialDot.setAttribute('cx', (60 + pt[0]).toFixed(2));
  dialDot.setAttribute('cy', (60 + pt[1]).toFixed(2));
  dialEl.classList.toggle('night', night);
  dialDisc.setAttribute('fill', night ? '#1d2c45' : '#fffaf0');
  dialDisc.setAttribute('stroke', night ? '#41567a' : '#e6d5b6');
  dialName.setAttribute('fill', night ? '#dfe9fb' : '#2b5b6d');
  dialSub.setAttribute('fill', night ? '#8fa4c6' : '#8aa3ad');
  dialDot.setAttribute('stroke', night ? '#dfe9fb' : '#2b5b6d');
  dialDot.setAttribute('fill', night ? '#1d2c45' : '#fffaf0');
}

/* 起始時間：傍晚？清晨（規格第 110 行：第 1 天清晨） */
(function initTime() {
  const ph = QS.get('phase');
  const legacyNight = QS.get('night') === '1';
  const t = QS.get('t');
  if (t !== null && !isNaN(parseFloat(t))) dayT = Math.min(0.999, Math.max(0, parseFloat(t)));
  else if (ph) {
    const hit = PHASES.find(x => x.key === ph);
    if (hit) dayT = hit.mid;
  } else if (legacyNight) dayT = PHASES[5].mid;
  else dayT = PHASES[0].mid;   // 開場：第 1 天清晨
})();

applyLight(dayT);
updateDial();

function advanceTime(dt) {
  if (typeof NET !== 'undefined' && NET.on) return;   /* 連線時由伺服器廣播時間 */
  const prev = dayT;
  dayT += dt / DAY_SECONDS;
  if (dayT >= 1) {
    dayT -= 1;
    dayIndex++;
    onNewDay();
  }
  if (Math.abs(dayT - prev) > 0.0008 || dayT < prev) {
    applyLight(dayT);
    updateDial();
  }
}

function isDark() {
  return phaseAt(dayT).key === 'night';
}

const UP = new THREE.Vector3(0, 1, 0);
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const rodTip = new THREE.Vector3();

const rod = new THREE.Mesh(
  new THREE.CylinderGeometry(0.018, 0.042, 1, 8),
  new THREE.MeshStandardMaterial({ color: lin(0x7a4f2f), roughness: 0.65 })
);
rod.visible = false;
rod.castShadow = true;
scene.add(rod);

const bobber = new THREE.Group();
{
  const white = new THREE.Mesh(new THREE.SphereGeometry(0.125, 14, 12),
    new THREE.MeshStandardMaterial({ color: lin(0xf6f3ea), roughness: 0.55 }));
  const red = new THREE.Mesh(new THREE.SphereGeometry(0.127, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: lin(0xd6402e), roughness: 0.45 }));
  bobber.add(white, red);
  bobber.visible = false;
  scene.add(bobber);
}

const ripple = new THREE.Mesh(
  new THREE.RingGeometry(0.16, 0.2, 28),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
);
ripple.rotation.x = -Math.PI / 2;
ripple.visible = false;
scene.add(ripple);

/* 上魚水花粒子 */
const SP_COUNT = 30;
const spGeo = new THREE.BufferGeometry();
spGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SP_COUNT * 3), 3));
const spMat = new THREE.PointsMaterial({
  color: 0xffffff, size: 0.16, transparent: true, opacity: 0.95,
  depthWrite: false, sizeAttenuation: true
});
const splash = new THREE.Points(spGeo, spMat);
splash.visible = false;
scene.add(splash);
const spVel = new Float32Array(SP_COUNT * 3);
let spLife = 0;

/* 上魚演出：3D 魚跳出水面 */
const FISH_MODEL_MAP = {
  '沙丁魚': 'Perch', '花身雞魚': 'Perch', '臭肚魚': 'Perch', '虱目魚': 'Carp',
  '黑鯛': 'Perch', '龍占': 'Rainbow_Trout', '鸚哥魚': 'Carp', '剝皮魚': 'Perch',
  '石斑': 'Tuna', '鬼頭刀': 'Barracuda', '飛魚': 'Rainbow_Trout', '紅甘': 'Tuna',
  '竹筴魚': 'Perch', '白帶魚': 'Barracuda', '大眼鯛': 'Perch', '石狗公': 'Catfish',
  '海鰻': 'Barracuda', '錢鰻': 'Barracuda', '皮刀魚': 'Rainbow_Trout', '黑喉': 'Perch',
  '燈籠魚': 'Perch', '赤宗': 'Salmon', '月魚': 'Carp', '皇帶魚': 'Barracuda'
};

function createProceduralJumpFish() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: lin(0x8fb9d8), roughness: 0.32, metalness: 0.12 });
  const bellyMat = new THREE.MeshStandardMaterial({ color: lin(0xf4f7f8), roughness: 0.5 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: lin(0x18242c), roughness: 0.4 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), bodyMat);
  body.scale.set(1.75, 0.88, 0.62);
  g.add(body);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.185, 14, 10), bellyMat);
  belly.scale.set(1.55, 0.52, 0.6);
  belly.position.set(0.02, -0.07, 0);
  g.add(belly);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.26, 6), bodyMat);
  tail.rotation.z = Math.PI / 2;
  tail.position.set(-0.4, 0, 0);
  g.add(tail);

  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.16, 5), bodyMat);
  dorsal.position.set(-0.02, 0.17, 0);
  g.add(dorsal);

  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), eyeMat);
  eyeL.position.set(0.27, 0.045, 0.1);
  g.add(eyeL);
  const eyeR = eyeL.clone();
  eyeR.position.z = -0.1;
  g.add(eyeR);

  g.scale.setScalar(1.5);
  g.visible = false;
  scene.add(g);
  return { g, bodyMat, tail, dorsal, body, belly, procedural: true };
}
const proceduralJumpFish = createProceduralJumpFish();

/* 預載低模魚 GLB（延後載入，避免與初始地形/模型搶頻寬） */
const jumpFishModels = {};
function loadFishModels() {
  ['Barracuda','Carp','Catfish','Clownfish','Perch','Rainbow_Trout','Salmon','Tuna'].forEach(function (name) {
    loader.load('./assets/fish/' + name + '.glb', function (gltf) {
      const s = gltf.scene;
      const box = new THREE.Box3().setFromObject(s);
      const h = box.max.y - box.min.y;
      s.scale.setScalar(1.0 / Math.max(0.001, h));
      s.updateMatrixWorld(true);
      const box2 = new THREE.Box3().setFromObject(s);
      s.position.y = -box2.min.y;
      const c = box2.getCenter(new THREE.Vector3());
      s.position.x -= c.x;
      s.position.z -= c.z;
      jumpFishModels[name] = s;
    }, undefined, function (err) { console.warn('fish model load fail', name, err); });
  });
}
setTimeout(loadFishModels, 4000);

let jumpFish = proceduralJumpFish;

let jumpT = -1;
const jumpState = { x: 0, z: 0, dx: 0, dz: 0, yaw: 0 };

function startFishJump(x, z, rarityColor, rarity, fishName) {
  /* 移除上一尾跳魚 */
  if (jumpFish && jumpFish.g && jumpFish.g.parent) {
    jumpFish.g.parent.remove(jumpFish.g);
  }
  const r = rarity || '常見';
  const cfgScale = { '常見': 1.6, '少見': 2.0, '稀有': 2.4, '傳說': 3.0 }[r] || 2.0;

  const modelName = FISH_MODEL_MAP[fishName || (fish.fish && fish.fish.name)] || 'Perch';
  const template = jumpFishModels[modelName];
  let g;
  if (template) {
    g = template.clone(true);
    g.scale.setScalar(cfgScale * 0.55);
  } else {
    const pf = createProceduralJumpFish();
    g = pf.g;
    pf.bodyMat.color.copy(new THREE.Color(rarityColor)).convertSRGBToLinear();
    g.scale.setScalar(cfgScale * 0.9);
  }
  g.visible = true;
  scene.add(g);
  jumpFish = { g: g, procedural: !template };

  jumpState.x = x; jumpState.z = z;
  const dx = x - heroPos.x, dz = z - heroPos.z;
  const len = Math.max(0.001, Math.hypot(dx, dz));
  jumpState.dx = -dx / len; jumpState.dz = -dz / len;
  jumpState.yaw = Math.atan2(heroPos.x - x, heroPos.z - z);
  jumpT = 0;
  jumpFish.g.visible = true;
  burstSplash(x, 0.12, z, 0.85);
  sndSplash();
}

function updateFishJump(dt) {
  if (jumpT < 0) return;
  jumpT += dt;
  const dur = 1.0;
  const u = Math.min(1, jumpT / dur);
  const h = Math.sin(Math.PI * u) * 1.55;
  jumpFish.g.position.set(
    jumpState.x + jumpState.dx * 0.55 * u,
    0.06 + h,
    jumpState.z + jumpState.dz * 0.55 * u
  );
  jumpFish.g.rotation.y = jumpState.yaw + Math.sin(u * Math.PI * 5) * 0.3;
  jumpFish.g.rotation.z = Math.cos(Math.PI * u) * 0.55;
  if (u >= 1) {
    jumpT = -1;
    jumpFish.g.visible = false;
    burstSplash(jumpFish.g.position.x, 0.12, jumpFish.g.position.z, 0.7);
    sndSplash();
  }
}

function burstSplash(x, y, z, power) {
  const p = spGeo.attributes.position;
  for (let i = 0; i < SP_COUNT; i++) {
    p.setXYZ(i, x, y, z);
    const a = Math.random() * Math.PI * 2;
    const s = (0.6 + Math.random() * 1.1) * power;
    spVel[i * 3] = Math.cos(a) * s;
    spVel[i * 3 + 1] = 1.6 + Math.random() * 1.7 * power;
    spVel[i * 3 + 2] = Math.sin(a) * s;
  }
  p.needsUpdate = true;
  splash.visible = true;
  spMat.opacity = 0.95;
  spLife = 0.75;
}

function updateSplash(dt) {
  if (spLife <= 0) { splash.visible = false; return; }
  spLife -= dt;
  const p = spGeo.attributes.position;
  for (let i = 0; i < SP_COUNT; i++) {
    spVel[i * 3 + 1] -= 9.2 * dt;
    p.setXYZ(i,
      p.getX(i) + spVel[i * 3] * dt,
      p.getY(i) + spVel[i * 3 + 1] * dt,
      p.getZ(i) + spVel[i * 3 + 2] * dt);
  }
  p.needsUpdate = true;
  spMat.opacity = Math.max(0, spLife / 0.75) * 0.95;
  if (spLife <= 0) splash.visible = false;
}

/* 合成音效（WebAudio，無外部檔案） */
let actx = null;
let audioArmed = false;
addEventListener('pointerdown', () => { audioArmed = true; ensureMusic(); }, true);
addEventListener('keydown', () => { audioArmed = true; ensureMusic(); }, true);
function ac() {
  if (!audioArmed) return null;
  if (!actx) {
    try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; }
  }
  if (actx && actx.state === 'suspended') actx.resume();
  return actx;
}
let masterGain = null, muted = false;
function outNode(a) {
  if (!masterGain) {
    masterGain = a.createGain();
    masterGain.gain.value = muted ? 0 : 1;
    masterGain.connect(a.destination);
  }
  return masterGain;
}
function toggleMute() {
  muted = !muted;
  if (masterGain) masterGain.gain.value = muted ? 0 : 1;
  const tag = document.getElementById('muteTag');
  if (tag) tag.classList.toggle('on', muted);
  setPrompt(muted ? '音效：關' : '音效：開', '');
}
function isMuted() { return muted; }

/* ---------- BGM（三段舒緩鋼琴）與海浪環境音 ---------- */
let musicGain = null, musicKey = 'day', musicOn = false, musicNext = 0, musicBar = 0, seaSrc = null, musicNotes = 0;

const CHORDS = {
  day:   [[0, 4, 7, 11], [9, 12, 16, 19], [5, 9, 12, 16], [7, 11, 14, 17]],
  dusk:  [[5, 9, 12, 16], [4, 7, 11, 14], [2, 5, 9, 12], [0, 4, 7, 11]],
  night: [[9, 12, 16, 19], [5, 9, 12, 16], [0, 4, 7, 11], [4, 7, 11, 14]]
};
const MUSIC_SEG = {
  day:   { bar: 3.4, vol: 0.115, bass: 0.15 },
  dusk:  { bar: 4.6, vol: 0.105, bass: 0.14 },
  night: { bar: 6.2, vol: 0.090, bass: 0.13 }
};

function midiFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

function musicOut(a) {
  if (!musicGain) {
    musicGain = a.createGain();
    musicGain.gain.value = 0.0001;
    musicGain.connect(outNode(a));
  }
  return musicGain;
}

function piano(freq, t, dur, vol) {
  const a = ac(); if (!a) return;
  const bus = musicOut(a);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(bus);
  const o1 = a.createOscillator(); o1.type = 'triangle'; o1.frequency.value = freq;
  const o2 = a.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2.001;
  const g2 = a.createGain(); g2.gain.value = 0.22;
  o1.connect(g); o2.connect(g2); g2.connect(g);
  o1.start(t); o1.stop(t + dur + 0.06);
  o2.start(t); o2.stop(t + dur + 0.06);
  musicNotes++;
}

function seaStart() {
  const a = ac(); if (!a || seaSrc) return;
  const len = Math.floor(a.sampleRate * 3);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    last = last * 0.985 + (Math.random() * 2 - 1) * 0.015;
    d[i] = last * 3.4;
  }
  const src = a.createBufferSource(); src.buffer = buf; src.loop = true;
  const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 0.4;
  const g = a.createGain(); g.gain.value = 0.085;
  const lfo = a.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.08;
  const lg = a.createGain(); lg.gain.value = 0.04;
  lfo.connect(lg); lg.connect(g.gain);
  src.connect(lp); lp.connect(g); g.connect(outNode(a));
  src.start(); lfo.start();
  seaSrc = src;
}

function ensureMusic() {
  const a = ac(); if (!a) return;
  musicOut(a); seaStart();
  if (musicOn) return;
  musicOn = true;
  musicNext = a.currentTime + 0.25;
  musicBar = 0;
  musicGain.gain.setValueAtTime(0.0001, a.currentTime);
  musicGain.gain.linearRampToValueAtTime(0.35, a.currentTime + 1.8);
}

function musicPhase(phase) {
  const k = phase === 'night' ? 'night' : (phase === 'dusk' ? 'dusk' : 'day');
  if (k === musicKey) return;
  musicKey = k;
  musicBar = 0;
  const a = actx;
  if (a && musicOn && musicGain) {
    musicGain.gain.cancelScheduledValues(a.currentTime);
    musicGain.gain.setValueAtTime(Math.max(0.0001, musicGain.gain.value), a.currentTime);
    musicGain.gain.linearRampToValueAtTime(0.0001, a.currentTime + 0.45);
    musicNext = 0;
    setTimeout(() => {
      const b = ac(); if (!b || !musicGain) return;
      musicNext = b.currentTime + 0.15;
      musicGain.gain.linearRampToValueAtTime(0.35, b.currentTime + 1.2);
    }, 520);
  }
}

function musicSchedule() {
  if (!musicOn) return;
  const a = ac(); if (!a) return;
  const seg = MUSIC_SEG[musicKey] || MUSIC_SEG.day;
  const now = a.currentTime;
  if (musicNext < now) musicNext = now + 0.12;
  while (musicNext < now + 0.6) {
    const t = musicNext;
    const ch = CHORDS[musicKey][musicBar % 4];
    piano(midiFreq(ch[0] + 36), t, 2.6, seg.bass);          /* 低音根音 */
    for (let i = 0; i < 4; i++) {
      piano(midiFreq(ch[i] + 72), t + i * seg.bar / 4, 1.5, seg.vol);
    }
    piano(midiFreq(ch[2] + 84), t + seg.bar * 0.5, 1.9, seg.vol * 0.45);
    musicBar++;
    musicNext += seg.bar;
  }
}
setInterval(musicSchedule, 250);

function tone(f0, f1, dur, type, gain) {
  const a = ac(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(f0, a.currentTime);
  o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), a.currentTime + dur);
  g.gain.setValueAtTime(0.0001, a.currentTime);
  g.gain.exponentialRampToValueAtTime(gain || 0.12, a.currentTime + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g); g.connect(outNode(a));
  o.start(); o.stop(a.currentTime + dur + 0.02);
}
function noise(dur, gain, freq, q) {
  const a = ac(); if (!a) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource(); src.buffer = buf;
  const bp = a.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = freq || 900; bp.Q.value = q || 0.9;
  const g = a.createGain();
  g.gain.setValueAtTime(gain || 0.18, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  src.connect(bp); bp.connect(g); g.connect(outNode(a));
  src.start();
}
function sndCast() { noise(0.22, 0.10, 1500, 0.8); tone(520, 260, 0.18, 'sine', 0.05); }
function sndSplash() { noise(0.34, 0.16, 700, 0.7); tone(180, 90, 0.22, 'sine', 0.07); }
function sndBite() { tone(1180, 1180, 0.09, 'triangle', 0.14); tone(1560, 1560, 0.12, 'sine', 0.10); }
function sndCatch() {
  tone(523, 523, 0.12, 'triangle', 0.10);
  setTimeout(() => tone(659, 659, 0.12, 'triangle', 0.10), 90);
  setTimeout(() => tone(784, 784, 0.20, 'triangle', 0.11), 180);
}

const LINE_N = 14;
const lineGeo = new THREE.BufferGeometry();
lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(LINE_N * 3), 3));
const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({
  color: 0xf4f8fa, transparent: true, opacity: 0.9
}));
line.visible = false;
scene.add(line);

let handBone = null;
let armBone = null, foreBone = null, rodBlend = 0;

const fish = {
  state: 'idle',            // idle | casting | waiting | biting | caught | escaped
  t: 0, wait: 0,
  bobberPos: new THREE.Vector3(),
  castFrom: new THREE.Vector3(),
  fish: null, shake: 0, shakeDecay: 2.4, flash: 0
};

/* 上魚震動：以螢幕像素為單位，再換算成正交相機的世界位移 */
const SHAKE_RARITY = { '常見': [8, 0.5], '少見': [14, 0.7], '稀有': [22, 1.0], '傳說': [36, 2.0] };
function haptic(ms) {
  try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms); } catch (e) { }
}
function shakeScreen(px, dur) {
  const wpp = VIEW_H / Math.max(240, window.innerHeight);
  fish.shake = px * wpp;
  fish.shakeDecay = fish.shake / Math.max(0.06, dur);
}

const RARITY_CLASS = { '常見': 'r0', '少見': 'r1', '稀有': 'r2', '傳說': 'r3' };

const elPrompt = document.getElementById('prompt');
const elBang = document.getElementById('bang');
const elCard = document.getElementById('card');

function setPrompt(text, cls) {
  elPrompt.textContent = text;
  elPrompt.className = cls || '';
}

function placeCyl(mesh, a, b) {
  _v3.subVectors(b, a);
  const len = _v3.length();
  mesh.position.copy(a).addScaledVector(_v3, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, _v3.normalize());
  mesh.scale.set(1, len, 1);
}

function invFull() {
  return Object.keys(inventory).length >= INV_SIZE;
}

function canCast() {
  const dx = Math.sin(heroYaw), dz = Math.cos(heroYaw);
  const cx = heroPos.x + dx * 4.2, cz = heroPos.z + dz * 4.2;
  return heightAt(cx, cz) < -0.25;
}

/* 釣魚加成卡片（與傳說魚同一機率入選） */
const CARD_TABLE = [
  { name: '發光貝殼出現加成卡片', desc: '發光貝殼出現率提升', fx: 'shellSpawn', isCard: true, color: '#bfe8e0' },
  { name: '夜光菇出現加成卡片', desc: '夜光菇出現率提升', fx: 'mushSpawn', isCard: true, color: '#7fd8b0' },
  { name: '倉庫格子加10格卡片', desc: '倉庫 +10 格', fx: 'chestPlus10', isCard: true, color: '#a9803f' },
  { name: '每次挖蚯蚓數量加1卡片', desc: '每次挖蚯蚓數量 +1', fx: 'wormsPlus1', isCard: true, color: '#c07a6a' },
  { name: '獲得鉆石50個卡片', desc: '獲得 鑽石×50', fx: 'diamond50', isCard: true, color: '#ffd700' },
];

function doAction() {
  if (faintT > 0) return;
  if (typeof AREA !== 'undefined' && AREA !== 'island') return;
  if (fish.state === 'idle') {
    if (invFull()) {
      fish.flash = 1.2;
      setPrompt('魚簍滿了（20 格），請先清空再釣', 'bad');
      return;
    }
    if (!canCast()) {
      fish.flash = 1.2;
      setPrompt('要站在岸邊或碼頭、面向水面才能拋竿', 'bad');
      return;
    }
    if (bait <= 0) {
      fish.flash = 1.2;
      setPrompt('沒有蚯蚓了，去小屋前的蚯蚓槽挖', 'bad');
      return;
    }
    bait--;
    updateBaitHud();
    const dx = Math.sin(heroYaw), dz = Math.cos(heroYaw);
    fish.bobberPos.set(heroPos.x + dx * 4.2, 0.1, heroPos.z + dz * 4.2);
    if (handBone) {
      handBone.getWorldPosition(_v1);
      fish.castFrom.set(_v1.x + dx * 0.35, _v1.y + 0.5, _v1.z + dz * 0.35);
    } else {
      fish.castFrom.set(heroPos.x + dx * 0.3, heroPos.y + 1.5, heroPos.z + dz * 0.3);
    }
    fish.state = 'casting';
    fish.t = 0;
    bobber.position.copy(fish.castFrom);
    bobber.visible = true;
    line.visible = true;
    rod.visible = true;
    elBang.classList.remove('on');
    elCard.classList.remove('on', 'r0', 'r1', 'r2', 'r3');
    setPrompt('拋竿…', '');
    sndCast();
    haptic(30);
    questDone('cast');
  } else if (fish.state === 'waiting') {
    /* 提早收竿 */
    endFishing('收竿。');
    haptic(20);
  } else if (fish.state === 'caught') {
    /* 點擊跳過漁獲卡片 */
    endFishing('點一下拋竿');
    haptic(20);
  } else if (fish.state === 'biting') {
    /* 鑽石與魚二選一：鑽石 1/10 起算，特殊釣竿／鑽石加成料理可疊加 */
    const diaChance = Math.min(1, fishingDiaChance());
    const diamondGot = Math.random() < diaChance;
    fish.state = 'caught';
    fish.t = 0;
    elBang.classList.remove('on');
    bobber.visible = false;
    line.visible = false;
    if (diamondGot) {
      diamond++;
      const invD = document.getElementById('invDiamond'); if (invD) invD.textContent = diamond;
      const shopD = document.getElementById('shopDiamond'); if (shopD) shopD.textContent = diamond;
      const chestD = document.getElementById('chestDiamond'); if (chestD) chestD.textContent = diamond;
      fish.fish = { name: '鑽石', rarity: '傳說', price: 0, size: 0, weight: '0' };
      elCard.querySelector('.n').textContent = '鑽石';
      elCard.querySelector('.m').innerHTML = '閃閃發光的鑽石';
      elCard.querySelector('.r').textContent = '💎 鑽石 ×1';
      elCard.className = 'on r1';
      setPrompt('鑽石！點一下繼續', 'good');
      sndCatch();
      haptic(160);
      burstSplash(fish.bobberPos.x, 0.12, fish.bobberPos.z, 0.5);
      return;
    }
    /* 上魚（白天／夜晚各自一張魚種表；含未釣到的加成卡） */
    const pool = FISH_TABLE.filter(f => isDark() ? f.time === 'night' : f.time === 'day');
    const rareMul = rodRareMul() * nightRareMul();
    const ws = pool.map(f => RARITY[f.rarity].w * ((f.rarity === '稀有' || f.rarity === '傳說') ? rareMul : 1));
    const availableCards = (typeof special !== 'undefined')
      ? CARD_TABLE.filter(c => !special[c.fx])
      : CARD_TABLE.slice();
    const cardWS = availableCards.map(() => RARITY['傳說'].w * rareMul);
    const combinedPool = pool.concat(availableCards);
    const combinedWs = ws.concat(cardWS);
    const total = combinedWs.reduce((s, w) => s + w, 0);
    let r = Math.random() * total, pick = combinedPool[0];
    for (let i = 0; i < combinedPool.length; i++) { r -= combinedWs[i]; if (r <= 0) { pick = combinedPool[i]; break; } }
    if (pick.isCard) {
      fish.fish = { name: pick.name, rarity: '傳說', price: 0, size: 0, weight: '0' };
      fish.state = 'caught';
      fish.t = 0;
      bobber.visible = false;
      line.visible = false;
      elCard.querySelector('.n').textContent = pick.name;
      elCard.querySelector('.m').innerHTML = '釣魚加成卡片　永久效果';
      elCard.querySelector('.r').textContent = pick.desc;
      elCard.className = 'on r3';
      applyCard(pick);
      setPrompt('釣到卡片：' + pick.name + '　點一下繼續', 'good');
      sndCatch();
      haptic(160);
      return;
    }
    const rr = RARITY[pick.rarity];
    const size = Math.round(rr.size[0] + Math.random() * (rr.size[1] - rr.size[0]));
    const weight = (size * size * size / 50000).toFixed(2);
    fish.fish = { name: pick.name, rarity: pick.rarity, price: pick.price, size, weight };
    const sk = SHAKE_RARITY[pick.rarity] || SHAKE_RARITY['常見'];
    shakeScreen(sk[0], sk[1]);

    elCard.querySelector('.n').textContent = pick.name;
    elCard.querySelector('.m').innerHTML = size + ' cm　約 ' + weight + ' kg';
    elCard.querySelector('.r').textContent = pick.rarity + '　' + pick.price + ' 金';
    elCard.className = 'on ' + (RARITY_CLASS[pick.rarity] || 'r0');
    setPrompt('上魚！' + pick.name + '　點一下繼續', 'good');

    invAdd(pick, size);

    startFishJump(fish.bobberPos.x, fish.bobberPos.z, RARITY[pick.rarity].color, pick.rarity, pick.name);
    sndCatch();
    haptic(100 + sk[0] * 2);
  }
}

function applyCard(pick) {
  if (pick.fx === 'shellSpawn') { special.shellSpawn = true; setPrompt('卡片生效：發光貝殼出現率提升（永久）', 'good'); }
  else if (pick.fx === 'mushSpawn') { special.mushSpawn = true; setPrompt('卡片生效：夜光菇出現率提升（永久）', 'good'); }
  else if (pick.fx === 'chestPlus10') { special.chestPlus10 = true; if (typeof updateStoreSize === 'function') updateStoreSize(); setPrompt('卡片生效：倉庫 +10 格（永久）', 'good'); }
  else if (pick.fx === 'wormsPlus1') { special.wormsPlus1 = true; setPrompt('卡片生效：每次挖蚯蚓數量 +1（永久）', 'good'); }
  else if (pick.fx === 'diamond50') {
    bagAdd(inventory, { name: '鑽石50兌換卡', price: 0, ic: 'card', color: '#ffe27a', use: 'diamond50' }, 0);
    setPrompt('釣到 鑽石50兌換卡！', 'good');
  }
  if (typeof updateBuffHud === 'function') updateBuffHud();
  if (typeof refreshPanels === 'function') refreshPanels();
  if (typeof saveGame === 'function') saveGame();
}

function endFishing(msg) {
  fish.state = 'idle';
  fish.t = 0;
  bobber.visible = false;
  line.visible = false;
  rod.visible = false;
  elBang.classList.remove('on');
  elCard.classList.remove('on', 'r0', 'r1', 'r2', 'r3');
  setPrompt(msg || '點一下拋竿', '');
}

function updateFishing(dt) {
  if (faintT > 0) return;
  if (fish.state === 'idle') {
    if (fish.flash > 0) {
      fish.flash -= dt;
    } else {
      const near = nearestThing();
      if (near) setPrompt(near.label, '');
      else if (bait <= 0) setPrompt('沒有蚯蚓了，去小屋前的蚯蚓槽挖', 'bad');
      else setPrompt(canCast() ? '點一下拋竿（蚯蚓 ' + bait + '）' : '走到岸邊或碼頭、面向水面', '');
    }
    updateSplash(dt);
    return;
  }

  const dx = Math.sin(heroYaw), dz = Math.cos(heroYaw);

  /* 釣竿：從右手延伸到前方 */
  if (handBone) {
    handBone.getWorldPosition(_v1);
    _v2.set(_v1.x + dx * 1.35, _v1.y + 1.05, _v1.z + dz * 1.35);
    rodTip.copy(_v2);
    placeCyl(rod, _v1, _v2);
  } else {
    rodTip.set(heroPos.x + dx * 1.35, heroPos.y + 1.6, heroPos.z + dz * 1.35);
    rod.position.set(heroPos.x, heroPos.y + 1.0, heroPos.z);
  }

  if (fish.state === 'casting') {
    fish.t += dt;
    const u = Math.min(1, fish.t / 0.42);
    const bx = fish.castFrom.x + (fish.bobberPos.x - fish.castFrom.x) * u;
    const bz = fish.castFrom.z + (fish.bobberPos.z - fish.castFrom.z) * u;
    const by = fish.castFrom.y + (0.1 - fish.castFrom.y) * u + Math.sin(Math.PI * u) * 1.15;
    bobber.position.set(bx, by, bz);
    if (u >= 1) {
      fish.state = 'waiting';
      fish.t = 0;
      fish.wait = FORCE_WAIT > 0 ? FORCE_WAIT : (1.2 + Math.random() * 2.8);
      burstSplash(fish.bobberPos.x, 0.12, fish.bobberPos.z, 0.6);
      sndSplash();
      setPrompt('等待魚咬餌…', '');
    }
  } else if (fish.state === 'waiting') {
    fish.t += dt;
    const bob = Math.sin(performance.now() * 0.004) * 0.02;
    bobber.position.set(fish.bobberPos.x, 0.1 + bob, fish.bobberPos.z);
    if (fish.t >= fish.wait) {
      fish.state = 'biting';
      fish.t = 0;
      shakeScreen(8, 0.5);
      elBang.classList.add('on');
      sndBite();
      haptic(120);
      setPrompt('現在！點一下拉竿', 'alert');
    }
  } else if (fish.state === 'biting') {
    fish.t += dt;
    bobber.position.set(fish.bobberPos.x,
      -0.1 + Math.sin(performance.now() * 0.03) * 0.03, fish.bobberPos.z);
    if (fish.t > 1.5) {
      fish.state = 'escaped';
      fish.t = 0;
      elBang.classList.remove('on');
      bobber.visible = false;
      line.visible = false;
      setPrompt('跑掉了…', 'bad');
      haptic(200);
    }
  } else if (fish.state === 'caught' || fish.state === 'escaped') {
    fish.t += dt;
    if (fish.t > 1.0) endFishing('點一下拋竿');
  }

  /* 水波紋 */
  if (fish.state === 'waiting' || fish.state === 'biting') {
    ripple.visible = true;
    ripple.position.set(fish.bobberPos.x, 0.06, fish.bobberPos.z);
    const rp = (performance.now() % 1800) / 1800;
    const rs = 0.7 + rp * 1.9;
    ripple.scale.set(rs, rs, rs);
    ripple.material.opacity = (1 - rp) * 0.42;
  } else {
    ripple.visible = false;
  }

  /* 釣線：帶垂墜 */
  const pts = lineGeo.attributes.position;
  for (let i = 0; i < LINE_N; i++) {
    const t = i / (LINE_N - 1);
    const x = rodTip.x + (bobber.position.x - rodTip.x) * t;
    const z = rodTip.z + (bobber.position.z - rodTip.z) * t;
    const y = rodTip.y + (bobber.position.y - rodTip.y) * t - Math.sin(Math.PI * t) * 0.42;
    pts.setXYZ(i, x, y, z);
  }
  pts.needsUpdate = true;

  /* ！的位置 */
  if (fish.state === 'biting') {
    _v1.copy(bobber.position).project(camera);
    elBang.style.left = ((_v1.x * 0.5 + 0.5) * window.innerWidth) + 'px';
    elBang.style.top = ((-_v1.y * 0.5 + 0.5) * window.innerHeight - 52) + 'px';
  }

  updateSplash(dt);
}

/* ============================================================
   星空（少量亮星，只在天色暗時透出）
   ============================================================ */
(function buildStars() {
  const el = document.getElementById('stars');
  let html = '';
  for (let i = 0; i < 40; i++) {
    const s = (1.6 + Math.random() * 2.2).toFixed(1);
    /* 自訂螢火蟲感：每個星星各自的漂浮軌跡與節奏（CSS 變數） */
    const dx1 = (Math.random() * 26 - 13).toFixed(1);
    const dy1 = (Math.random() * 14 - 7).toFixed(1);
    const dx2 = (Math.random() * 36 - 18).toFixed(1);
    const dy2 = (Math.random() * 22 - 11).toFixed(1);
    const dx3 = (Math.random() * 34 - 17).toFixed(1);
    const dy3 = (Math.random() * 18 - 9).toFixed(1);
    const dur = (3.0 + Math.random() * 2.2).toFixed(2);
    const fdur = (13 + Math.random() * 11).toFixed(2);
    const twdelay = (Math.random() * 3.4).toFixed(2);
    const floatdelay = (Math.random() * 20).toFixed(2);
    html += '<i style="left:' + (Math.random() * 98 + 1).toFixed(1) +
      '%;top:' + (Math.random() * 46 + 1).toFixed(1) +
      '%;width:' + s + 'px;height:' + s + 'px;' +
      '--dx1:' + dx1 + 'px;--dy1:' + dy1 + 'px;' +
      '--dx2:' + dx2 + 'px;--dy2:' + dy2 + 'px;' +
      '--dx3:' + dx3 + 'px;--dy3:' + dy3 + 'px;' +
      '--twdur:' + dur + 's;--floatdur:' + fdur + 's;' +
      '--twdelay:-' + twdelay + 's;--floatdelay:-' + floatdelay + 's"></i>';
  }
  el.innerHTML = html;
})();

/* ============================================================
   夜晚螢火蟲
   ============================================================ */
const FLY_COUNT = 64;
const flyGeo = new THREE.BufferGeometry();
const flyPosArr = new Float32Array(FLY_COUNT * 3);
const flyColArr = new Float32Array(FLY_COUNT * 3);
const flyBase = [];
(function spawnFlies() {
  let guard = 0;
  while (flyBase.length < FLY_COUNT && guard++ < 4000) {
    const a = Math.random() * Math.PI * 2;
    const r = 3 + Math.random() * 17;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const h = heightAt(x, z);
    if (h > 0.55) {
      flyBase.push({
        x, z, y: h + 0.6 + Math.random() * 2.4,
        ph: Math.random() * Math.PI * 2,
        sp: 0.7 + Math.random() * 0.9
      });
    }
  }
  for (let i = 0; i < flyBase.length; i++) {
    const b = flyBase[i];
    flyPosArr[i * 3] = b.x;
    flyPosArr[i * 3 + 1] = b.y;
    flyPosArr[i * 3 + 2] = b.z;
  }
  flyGeo.setAttribute('position', new THREE.BufferAttribute(flyPosArr, 3));
  flyGeo.setAttribute('color', new THREE.BufferAttribute(flyColArr, 3));
})();

const flyMat = new THREE.PointsMaterial({
  size: 0.34, transparent: true, depthWrite: false,
  blending: THREE.AdditiveBlending, vertexColors: true, sizeAttenuation: true,
  map: (function () {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,205,1)');
    grd.addColorStop(0.3, 'rgba(240,255,135,.85)');
    grd.addColorStop(1, 'rgba(230,245,90,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })()
});
const flies = new THREE.Points(flyGeo, flyMat);
flies.frustumCulled = false;
flies.visible = false;
scene.add(flies);

let flyTime = 0;
function updateFlies(dt) {
  const amt = nightAmt;
  if (amt <= 0.02) {
    if (flies.visible) flies.visible = false;
    return;
  }
  flies.visible = true;
  flyTime += dt;
  for (let i = 0; i < flyBase.length; i++) {
    const b = flyBase[i];
    const t = flyTime * b.sp + b.ph;
    flyPosArr[i * 3] = b.x + Math.sin(t * 0.7) * 1.0;
    flyPosArr[i * 3 + 1] = b.y + Math.sin(t * 1.3) * 0.35;
    flyPosArr[i * 3 + 2] = b.z + Math.cos(t * 0.62) * 1.0;
    const blink = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2.6));
    const v = blink * Math.min(1, amt * 1.15);
    flyColArr[i * 3] = v;
    flyColArr[i * 3 + 1] = v * 0.98;
    flyColArr[i * 3 + 2] = v * 0.42;
  }
  flyGeo.attributes.position.needsUpdate = true;
  flyGeo.attributes.color.needsUpdate = true;
}

