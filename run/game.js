(() => {
'use strict';

/* =========================================================
   Death Line — 像素跑酷
   480x270 內部解析度 / 16px 磚塊 / 岩漿洞穴
   ========================================================= */

const VIEW_W = 480, VIEW_H = 270, TILE = 16, ROWS = 17;
const WORLD_W = 13200, COLS = Math.ceil(WORLD_W / TILE);
const GROUND_Y = 224, LAVA_Y = 244;
const CN_FONT = '"Microsoft JhengHei","PingFang TC","Noto Sans TC",sans-serif';
const EN_FONT = 'monospace';

const clamp = (v, a, b) => (v < a ? a : (v > b ? b : v));
const sign = v => (v < 0 ? -1 : (v > 0 ? 1 : 0));
const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const midi = n => 440 * Math.pow(2, (n - 69) / 12);

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return m + ':' + sec.toFixed(1).padStart(4, '0');
}

/* =========================================================
   音效與音樂（Web Audio 即時合成）
   ========================================================= */

const TRACKS = {
  title: {
    bpm: 96,
    bass: [33, null, null, null, 33, null, null, null, 31, null, null, null, 31, null, null, null,
           29, null, null, null, 29, null, null, null, 28, null, null, null, 28, null, null, null],
    lead: [57, null, 60, null, 64, null, 60, null, 55, null, 59, null, 62, null, 59, null,
           53, null, 57, null, 60, null, 57, null, 52, null, 55, null, 59, null, 55, null]
  },
  game: {
    bpm: 168,
    bass: [45, null, 45, null, 45, null, 45, null, 43, null, 43, null, 43, null, 43, null,
           41, null, 41, null, 41, null, 41, null, 40, null, 40, null, 40, null, 40, null],
    lead: [69, 72, 76, 72, 69, 72, 76, 79, 67, 71, 74, 71, 67, 71, 74, 77,
           65, 69, 72, 69, 65, 69, 72, 76, 64, 68, 71, 68, 64, 68, 71, 75]
  }
};

const Sound = {
  ac: null,
  master: null,
  muted: false,
  timer: null,
  track: null,
  step: 0,
  next: 0,
  noiseBuf: null,

  init() {
    if (this.ac) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ac = new AC();
    this.master = this.ac.createGain();
    this.master.gain.value = this.muted ? 0 : 0.32;
    this.master.connect(this.ac.destination);
    const len = Math.floor(this.ac.sampleRate * 0.25);
    this.noiseBuf = this.ac.createBuffer(1, len, this.ac.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  },

  resume() {
    if (this.ac && this.ac.state === 'suspended') this.ac.resume();
  },

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.32;
  },

  tone(freq, dur, type, vol, when, slideTo) {
    if (!this.ac) return;
    const t = this.ac.currentTime + (when || 0);
    const o = this.ac.createOscillator();
    const g = this.ac.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(Math.max(20, freq), t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.03);
  },

  noise(dur, vol, when, cutoff) {
    if (!this.ac || !this.noiseBuf) return;
    const t = this.ac.currentTime + (when || 0);
    const s = this.ac.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ac.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = cutoff || 2200;
    const g = this.ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t); s.stop(t + dur + 0.02);
  },

  sfx(name) {
    if (!this.ac) return;
    switch (name) {
      case 'jump': this.tone(300, 0.12, 'square', 0.18, 0, 560); break;
      case 'djump': this.tone(440, 0.14, 'square', 0.18, 0, 880); break;
      case 'coin': this.tone(1046, 0.06, 'square', 0.13); this.tone(1568, 0.09, 'square', 0.12, 0.055); break;
      case 'death': this.tone(340, 0.45, 'sawtooth', 0.22, 0, 55); this.noise(0.35, 0.22, 0, 700); break;
      case 'clear': [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.18, 'square', 0.16, i * 0.1)); break;
      case 'menu': this.tone(620, 0.045, 'square', 0.09); break;
      case 'select': this.tone(880, 0.09, 'square', 0.14); break;
      case 'land': this.noise(0.06, 0.08, 0, 500); break;
      case 'crumble': this.noise(0.16, 0.14, 0, 320); break;
      case 'mute': this.tone(440, 0.08, 'triangle', 0.12); break;
    }
  },

  startMusic(name) {
    this.init();
    if (!this.ac) return;
    if (this.track === name && this.timer) return;
    this.stopMusic();
    this.track = name;
    this.step = 0;
    this.next = this.ac.currentTime + 0.08;
    this.timer = setInterval(() => this.schedule(), 25);
    this.schedule();
  },

  stopMusic() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.track = null;
  },

  schedule() {
    if (!this.ac || !this.track) return;
    const tr = TRACKS[this.track];
    const stepDur = 60 / tr.bpm / 2;
    if (this.next < this.ac.currentTime - 0.5) this.next = this.ac.currentTime + 0.05;
    while (this.next < this.ac.currentTime + 0.15) {
      const i = this.step % 32;
      const when = this.next - this.ac.currentTime;
      const b = tr.bass[i];
      if (b != null) this.tone(midi(b), stepDur * 0.92, 'triangle', 0.2, when);
      const l = tr.lead[i];
      if (l != null) this.tone(midi(l), stepDur * 0.78, 'square', 0.085, when);
      if (i % 2 === 0) this.noise(0.03, 0.035, when, 4200);
      this.next += stepDur;
      this.step++;
    }
  }
};

/* =========================================================
   輸入
   ========================================================= */

const KEYMAP = {
  ArrowLeft: ['left'], KeyA: ['left'],
  ArrowRight: ['right'], KeyD: ['right'],
  ArrowUp: ['jump', 'up'], Space: ['jump'],
  ArrowDown: ['crouch', 'down'], KeyS: ['crouch'],
  Escape: ['pause'], Enter: ['enter'], NumpadEnter: ['enter'],
  KeyR: ['restart'], KeyM: ['mute'], KeyC: ['clear']
};

const Input = {
  down: {},
  pressed: {},
  lastTap: { left: 0, right: 0 },
  sprintDir: 0,

  isDown(a) { return !!this.down[a]; },

  init() {
    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      const el = document.activeElement;
      if (el && el.id === 'nameInput') return;
      const actions = KEYMAP[e.code];
      if (!actions) return;
      if (actions.some(a => a === 'left' || a === 'right' || a === 'jump' || a === 'crouch' || a === 'pause' || a === 'restart')) {
        e.preventDefault();
      }
      Sound.init();
      Sound.resume();
      if (!Sound.track) Sound.startMusic(Game.state === 'play' ? 'game' : 'title');
      for (const a of actions) {
        if (!this.down[a]) this.pressed[a] = true;
        this.down[a] = true;
      }
      for (const a of actions) {
        if (a === 'left' || a === 'right') {
          const now = performance.now();
          if (now - this.lastTap[a] < 280) this.sprintDir = a === 'right' ? 1 : -1;
          this.lastTap[a] = now;
        }
      }
    });

    window.addEventListener('keyup', e => {
      const actions = KEYMAP[e.code];
      if (!actions) return;
      for (const a of actions) {
        this.down[a] = false;
        if ((a === 'left' && this.sprintDir === -1) || (a === 'right' && this.sprintDir === 1)) this.sprintDir = 0;
      }
    });

    window.addEventListener('blur', () => {
      this.down = {};
      this.sprintDir = 0;
    });
  }
};

/* =========================================================
   本機排行榜
   ========================================================= */

const cmpEntry = (a, b) => (b.score - a.score) || (a.time - b.time) || (a.deaths - b.deaths);

const Store = {
  KEY: 'deathline_scores_v1',

  load() {
    try {
      const v = JSON.parse(localStorage.getItem(this.KEY));
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  },

  save(l) {
    try { localStorage.setItem(this.KEY, JSON.stringify(l)); } catch (e) {}
  },

  add(e) {
    let l = this.load();
    const old = l.find(x => x.name === e.name);
    if (old && (old.score > e.score || (old.score === e.score && old.time <= e.time))) {
      return { list: l, index: -1 };
    }
    l = l.filter(x => x.name !== e.name);
    l.push(e);
    l.sort(cmpEntry);
    l = l.slice(0, 10);
    this.save(l);
    return { list: l, index: l.findIndex(x => x.ts === e.ts) };
  },

  clear() {
    try { localStorage.removeItem(this.KEY); } catch (e) {}
  },

  best() {
    const l = this.load();
    if (!l.length) return null;
    return {
      score: Math.max(...l.map(x => x.score)),
      coins: Math.max(...l.map(x => x.coins)),
      time: Math.min(...l.map(x => x.time)),
      deaths: Math.min(...l.map(x => x.deaths))
    };
  }
};

/* =========================================================
   關卡生成（固定地形 + 突襲區段）
   ========================================================= */

function generateLevel() {
  const grid = new Uint8Array(COLS * ROWS);
  const set = (c, r, v) => {
    if (c >= 0 && c < COLS && r >= 0 && r < ROWS) grid[r * COLS + c] = v;
  };

  for (let c = 0; c < COLS; c++) { set(c, 14, 1); set(c, 15, 1); }

  const rng = mulberry32(0x5EED11);
  const pits = [];
  let px = 700;
  while (px < WORLD_W - 900) {
    const wt = 2 + Math.floor(rng() * 4);
    pits.push({ x: px, w: wt * TILE });
    const c0 = Math.floor(px / TILE);
    const c1 = Math.ceil((px + wt * TILE) / TILE);
    for (let c = c0; c < c1; c++) { set(c, 14, 0); set(c, 15, 0); }
    px += wt * TILE + 400 + Math.floor(rng() * 240);
  }

  for (let c = Math.floor((WORLD_W - 620) / TILE); c < COLS; c++) { set(c, 14, 1); set(c, 15, 1); }

  const localGround = x => {
    const c = Math.floor(x / TILE);
    return c >= 0 && c < COLS && grid[14 * COLS + c] === 1;
  };
  const nearPit = (x, pad) => pits.some(p => x > p.x - pad && x < p.x + p.w + pad);

  for (let i = 2; i < pits.length; i += 3) {
    const p = pits[i], w = 3 + (i % 2);
    const sc = Math.floor((p.x - 16) / TILE);
    for (let k = 0; k < w; k++) set(sc + k, 11, 2);
  }
  for (let i = 5; i < pits.length; i += 5) {
    const p = pits[i], w = 2 + (i % 2);
    const sc = Math.floor((p.x + p.w + 16) / TILE);
    for (let k = 0; k < w; k++) set(sc + k, 9, 2);
  }

  const spikes = [];
  let sx = 760;
  while (sx < WORLD_W - 1000) {
    if (localGround(sx) && localGround(sx + 24) && !nearPit(sx, 64)) {
      const n = 1 + (Math.floor(sx / TILE) % 2);
      spikes.push({ x: sx, y: GROUND_Y - 8, w: n * TILE });
    }
    sx += 380 + Math.floor(rng() * 320);
  }

  const crumbles = [];
  for (let i = 1; i < pits.length; i += 2) {
    if (i % 3 === 2) continue;
    const p = pits[i];
    if (p.w >= 48) crumbles.push({ x: p.x + 8, y: GROUND_Y - 48, w: p.w - 16, state: 0, timer: 0, vy: 0 });
  }

  const movers = [];
  for (let i = 4; i < pits.length; i += 4) {
    if (i % 3 === 2) continue;
    const p = pits[i];
    const x0 = p.x - 32;
    movers.push({
      x: x0, y: GROUND_Y - 28, w: 48, h: 8,
      x1: p.x - 72, x2: p.x + p.w + 24,
      dir: 1, speed: 30, timer: 0.5, prevX: x0
    });
  }

  const coins = [];
  const wide = [...pits].sort((a, b) => b.w - a.w);
  for (let i = 0; i < 3; i++) {
    const p = wide[i];
    if (!p) continue;
    for (let k = 0; k < 5; k++) {
      coins.push({
        x: p.x - 6 + (p.w + 12) * k / 4,
        y: GROUND_Y - 62 - Math.sin(k / 4 * Math.PI) * 10,
        taken: false, phase: k * 0.7
      });
    }
  }

  let safeCount = 0, cx = 300;
  while (safeCount < 45 && cx < WORLD_W - 700) {
    if (localGround(cx) && localGround(cx + 34) && !nearPit(cx, 56) &&
        !spikes.some(s => cx > s.x - 44 && cx < s.x + s.w + 44)) {
      for (let k = 0; k < 3; k++) {
        coins.push({ x: cx + k * 18, y: GROUND_Y - 16, taken: false, phase: k * 0.5 });
      }
      safeCount += 3;
    }
    cx += 300;
  }
  cx = 300;
  while (safeCount < 45 && cx < WORLD_W - 700) {
    if (localGround(cx) && !nearPit(cx, 48) &&
        !spikes.some(s => cx > s.x - 40 && cx < s.x + s.w + 40)) {
      for (let k = 0; k < 3 && safeCount < 45; k++) {
        coins.push({ x: cx + k * 18, y: GROUND_Y - 16, taken: false, phase: k * 0.5 });
        safeCount++;
      }
    }
    cx += 140;
  }

  const sectionTypes = [
    ['spike', 'coal', 'spike', 'crumble'],
    ['spike', 'coal', 'spike', 'coal'],
    ['lava', 'spike', 'lava', 'coal'],
    ['coal', 'sweeper', 'spike', 'coal'],
    ['sweeper', 'lava', 'coal', 'spike'],
    ['sweeper', 'spike', 'lava', 'coal']
  ];
  const ambushes = [];
  const starts = [0, 2200, 4400, 6600, 8800, 11000];
  const offs = [440, 880, 1320, 1760];
  for (let s = 0; s < 6; s++) {
    for (let k = 0; k < 4; k++) {
      ambushes.push({ x: starts[s] + offs[k], type: sectionTypes[s][k], used: false });
    }
  }

  return {
    grid, pits, spikes, crumbles, movers, coins, ambushes,
    door: { x: WORLD_W - 280, y: GROUND_Y - 48, w: 32, h: 48 },
    totalCoins: coins.length
  };
}

/* =========================================================
   遊戲狀態
   ========================================================= */

const Game = {
  state: 'title',
  stateT: 0,
  bgT: 0,
  menu: 0,
  pauseMenu: 0,
  boardMenu: 0,
  boardFrom: 'title',
  boardConfirm: false,
  boardList: [],
  newIndex: -1,
  best: null,
  level: null,
  player: null,
  camX: 0,
  runTime: 0,
  started: false,
  coins: 0,
  deaths: 0,
  shake: 0,
  fade: 0,
  particles: [],
  traps: [],
  coals: [],
  sweepers: [],
  deadT: 0,
  clearT: 0,
  result: null,
  dustT: 0
};

function solidTile(c, r) {
  const g = Game.level.grid;
  return c >= 0 && c < COLS && r >= 0 && r < ROWS && g[r * COLS + c] === 1;
}

function platformTile(c, r) {
  const g = Game.level.grid;
  return c >= 0 && c < COLS && r >= 0 && r < ROWS && g[r * COLS + c] === 2;
}

function groundAt(x) {
  return solidTile(Math.floor(x / TILE), 14);
}

function safeGroundSpot(x, pad) {
  const near = px => Game.level.pits.some(p => px > p.x - pad && px < p.x + p.w + pad);
  for (const off of [0, 16, -16, 32, -32, 48, -48, 64, -64, 80, -80, 96, -96]) {
    const nx = x + off;
    if (groundAt(nx) && groundAt(nx + 12) && !near(nx)) return nx;
  }
  return null;
}

function makePlayer() {
  return {
    x: 64, y: GROUND_Y - 16, w: 12, h: 16,
    vx: 0, vy: 0, face: 1, onGround: false,
    jumpsUsed: 0, coyote: 0, jumpBuffer: 0,
    crouch: false, animT: 0
  };
}

function startRun() {
  Game.deaths = 0;
  resetAttempt();
}

function resetAttempt() {
  Game.level = generateLevel();
  Game.player = makePlayer();
  Game.camX = 0;
  Game.runTime = 0;
  Game.started = false;
  Game.coins = 0;
  Game.particles = [];
  Game.traps = [];
  Game.coals = [];
  Game.sweepers = [];
  Game.shake = 0;
  Game.fade = 0;
  Game.deadT = 0;
  Game.clearT = 0;
  Game.dustT = 0;
  Game.state = 'play';
  Game.stateT = 0;
  Sound.startMusic('game');
}

function die() {
  if (Game.state !== 'play') return;
  Game.deaths++;
  Game.state = 'dead';
  Game.deadT = 0;
  Game.shake = 10;
  const p = Game.player;
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2;
  const colors = ['#ff5a2a', '#ffb347', '#ffe08a', '#c9d2e2', '#8b94aa'];
  for (let i = 0; i < 34; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 40 + Math.random() * 150;
    Game.particles.push({
      x: cx, y: cy,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 40,
      life: 0.5 + Math.random() * 0.6,
      max: 1.1,
      color: colors[i % colors.length],
      size: 1 + (i % 3),
      grav: 380
    });
  }
  Sound.sfx('death');
  Sound.stopMusic();
}

function showResult() {
  const total = Game.level.totalCoins;
  const score = Game.coins * 100 + (Game.coins >= total ? 1000 : 0);
  Game.result = { score, coins: Game.coins, total, time: Game.runTime, deaths: Game.deaths };
  Game.state = 'result';
  Game.stateT = 0;
  Game.fade = 1;
  Sound.stopMusic();
}

function showNameOverlay() {
  const overlay = document.getElementById('nameOverlay');
  const el = document.getElementById('nameInput');
  overlay.classList.remove('hidden');
  el.value = '';
  setTimeout(() => el.focus(), 30);
}

function hideNameOverlay() {
  document.getElementById('nameOverlay').classList.add('hidden');
  document.getElementById('nameInput').blur();
}

function submitName() {
  const el = document.getElementById('nameInput');
  let name = (el.value || '').trim().slice(0, 8);
  if (!name) name = '無名騎士';
  const r = Game.result;
  const entry = { name, score: r.score, coins: r.coins, time: r.time, deaths: r.deaths, ts: Date.now() };
  const res = Store.add(entry);
  Game.boardList = res.list;
  Game.newIndex = res.index;
  Game.best = Store.best();
  hideNameOverlay();
  Game.state = 'boardResult';
  Game.boardMenu = 0;
  Game.stateT = 0;
}

/* =========================================================
   更新
   ========================================================= */

function update(dt) {
  Game.stateT += dt;
  Game.bgT += dt;

  if (Input.pressed.mute) {
    Sound.toggleMute();
    Sound.sfx('mute');
  }

  switch (Game.state) {
    case 'title': updateTitle(); break;
    case 'help':
      if (Input.pressed.pause || Input.pressed.enter) Game.state = 'title';
      break;
    case 'board': updateBoard(false); break;
    case 'play': updatePlay(dt); break;
    case 'pause': updatePause(); break;
    case 'dead': updateDead(dt); break;
    case 'clear': updateClear(dt); break;
    case 'result':
      if (Input.pressed.enter) {
        Game.state = 'name';
        showNameOverlay();
      }
      break;
    case 'boardResult': updateBoard(true); break;
  }

  Game.shake = Math.max(0, Game.shake - dt * 34);
  if (Game.state !== 'clear' && Game.state !== 'result' && Game.state !== 'name' && Game.state !== 'boardResult') {
    Game.fade = Math.max(0, Game.fade - dt * 3);
  }
}

function updateTitle() {
  if (Input.pressed.up) { Game.menu = (Game.menu + 2) % 3; Sound.sfx('menu'); }
  if (Input.pressed.down) { Game.menu = (Game.menu + 1) % 3; Sound.sfx('menu'); }
  if (Input.pressed.enter) {
    Sound.sfx('select');
    if (Game.menu === 0) startRun();
    else if (Game.menu === 1) { Game.state = 'help'; Game.stateT = 0; }
    else {
      Game.state = 'board';
      Game.boardFrom = 'title';
      Game.boardConfirm = false;
      Game.boardList = Store.load();
      Game.stateT = 0;
    }
  }
}

function updatePause() {
  if (Input.pressed.pause) {
    Game.state = 'play';
    Sound.startMusic('game');
    return;
  }
  if (Input.pressed.up) { Game.pauseMenu = (Game.pauseMenu + 2) % 3; Sound.sfx('menu'); }
  if (Input.pressed.down) { Game.pauseMenu = (Game.pauseMenu + 1) % 3; Sound.sfx('menu'); }
  if (Input.pressed.enter) {
    Sound.sfx('select');
    if (Game.pauseMenu === 0) {
      Game.state = 'play';
      Sound.startMusic('game');
    } else if (Game.pauseMenu === 1) {
      resetAttempt();
    } else {
      Game.state = 'title';
      Sound.startMusic('title');
    }
  }
}

function updateDead(dt) {
  Game.deadT += dt;
  updateParticles(dt);
  if (Game.deadT > 0.85) resetAttempt();
}

function updateClear(dt) {
  Game.clearT += dt;
  const p = Game.player;
  const door = Game.level.door;
  const targetX = door.x + door.w / 2 - p.w / 2;
  if (p.x < targetX) {
    p.x = Math.min(targetX, p.x + 55 * dt);
    p.vx = 55;
  } else {
    p.vx = 0;
  }
  p.animT += dt;
  Game.camX = Math.max(Game.camX, clamp(p.x - 160, 0, WORLD_W - VIEW_W));
  Game.fade = clamp(Game.clearT / 1.35, 0, 1);
  updateParticles(dt);
  if (Game.clearT > 1.55) showResult();
}

function updateBoard(resultMode) {
  if (Input.pressed.clear) {
    if (!Game.boardConfirm) {
      Game.boardConfirm = true;
      Sound.sfx('menu');
    } else {
      Store.clear();
      Game.boardList = [];
      Game.boardConfirm = false;
      Game.best = null;
      Sound.sfx('select');
    }
    return;
  }
  if (Input.pressed.pause) {
    if (Game.boardConfirm) { Game.boardConfirm = false; return; }
    Game.state = 'title';
    Sound.startMusic('title');
    return;
  }
  if (resultMode) {
    if (Input.pressed.up || Input.pressed.down) {
      Game.boardMenu = (Game.boardMenu + 1) % 2;
      Sound.sfx('menu');
    }
    if (Input.pressed.enter) {
      Sound.sfx('select');
      if (Game.boardMenu === 0) startRun();
      else { Game.state = 'title'; Sound.startMusic('title'); }
    }
  } else {
    if (Input.pressed.enter) {
      Game.state = 'title';
      Sound.startMusic('title');
    }
  }
}

function updatePlay(dt) {
  if (Input.pressed.pause) {
    Game.state = 'pause';
    Game.pauseMenu = 0;
    Sound.stopMusic();
    return;
  }
  if (Input.pressed.restart) {
    resetAttempt();
    return;
  }

  updateMovers(dt);
  updatePlayer(dt);
  if (Game.state !== 'play') { updateParticles(dt); return; }
  carryMovers(dt);
  if (Game.state !== 'play') { updateParticles(dt); return; }
  updateCrumbles(dt);
  updateTraps(dt);
  updateCoals(dt);
  if (Game.state !== 'play') { updateParticles(dt); return; }
  updateSweepers(dt);
  if (Game.state !== 'play') { updateParticles(dt); return; }
  updateCoins(dt);
  checkAmbushes();
  checkHazards();
  updateCamera(dt);
  updateParticles(dt);
  ambientDust(dt);
}

function updateMovers(dt) {
  for (const m of Game.level.movers) {
    m.prevX = m.x;
    m.timer -= dt;
    if (m.timer <= 0) {
      m.timer = 0.7 + Math.random() * 1.2;
      m.speed = 15 + Math.random() * 55;
    }
    m.x += m.dir * m.speed * dt;
    if (m.x < m.x1) { m.x = m.x1; m.dir = 1; }
    if (m.x > m.x2) { m.x = m.x2; m.dir = -1; }
  }
}

function canStand(p) {
  const ny = p.y - (16 - 9);
  const c0 = Math.floor(p.x / TILE);
  const c1 = Math.floor((p.x + p.w - 0.01) / TILE);
  const r0 = Math.floor(ny / TILE);
  const r1 = Math.floor((ny + 16 - 0.01) / TILE);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (solidTile(c, r)) return false;
    }
  }
  return true;
}

function updatePlayer(dt) {
  const p = Game.player;

  if (!Game.started && (Input.isDown('left') || Input.isDown('right') || Input.pressed.jump || Input.isDown('crouch'))) {
    Game.started = true;
  }
  if (Game.started) Game.runTime += dt;

  const left = Input.isDown('left');
  const right = Input.isDown('right');
  const dir = (right ? 1 : 0) - (left ? 1 : 0);
  const wantCrouch = Input.isDown('crouch') && p.onGround;

  if (wantCrouch && !p.crouch) {
    p.crouch = true;
    p.y += p.h - 9;
    p.h = 9;
  } else if (!wantCrouch && p.crouch) {
    if (canStand(p)) {
      p.crouch = false;
      p.y -= 16 - 9;
      p.h = 16;
    }
  }

  const sprinting = dir !== 0 && Input.sprintDir === dir;
  let maxSpd = sprinting ? 176 : 110;
  if (p.crouch) maxSpd = 38;

  if (dir !== 0) {
    p.face = dir;
    const acc = p.onGround ? 1000 : 620;
    p.vx += dir * acc * dt;
    if (p.vx * dir > maxSpd) p.vx = dir * maxSpd;
    if (p.vx * dir < 0) p.vx += dir * 1600 * dt;
  } else {
    const fr = (p.onGround ? 1400 : 260) * dt;
    if (Math.abs(p.vx) <= fr) p.vx = 0;
    else p.vx -= sign(p.vx) * fr;
  }

  if (Input.pressed.jump) p.jumpBuffer = 0.1;
  p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
  p.coyote = Math.max(0, p.coyote - dt);

  if (p.jumpBuffer > 0) {
    if (p.onGround || p.coyote > 0) {
      p.vy = -300;
      p.onGround = false;
      p.coyote = 0;
      p.jumpBuffer = 0;
      p.jumpsUsed = 1;
      Sound.sfx('jump');
      spawnDust(p.x + p.w / 2, p.y + p.h, 5);
    } else if (p.jumpsUsed < 2) {
      p.vy = -300;
      p.jumpsUsed = 2;
      p.jumpBuffer = 0;
      Sound.sfx('djump');
      for (let i = 0; i < 8; i++) {
        Game.particles.push({
          x: p.x + p.w / 2 + (Math.random() - 0.5) * 10,
          y: p.y + p.h - 2,
          vx: (Math.random() - 0.5) * 70,
          vy: 20 + Math.random() * 50,
          life: 0.3 + Math.random() * 0.2,
          max: 0.5,
          color: i % 2 ? '#eef3ff' : '#8b94aa',
          size: 1,
          grav: 120
        });
      }
    }
  }

  p.vy = Math.min(p.vy + 900 * dt, 560);
  p.animT += dt;

  const wasGround = p.onGround;
  movePlayer(p, dt);
  collideCrumbles(p, dt);

  if (wasGround && !p.onGround && p.vy >= 0) p.coyote = 0.1;
  if (p.onGround) p.jumpsUsed = 0;
}

function movePlayer(p, dt) {
  p.x += p.vx * dt;
  if (p.x < 0) { p.x = 0; p.vx = 0; }
  if (p.x + p.w > WORLD_W) { p.x = WORLD_W - p.w; p.vx = 0; }

  let c0 = Math.floor(p.x / TILE);
  let c1 = Math.floor((p.x + p.w - 0.01) / TILE);
  let r0 = Math.floor(p.y / TILE);
  let r1 = Math.floor((p.y + p.h - 0.01) / TILE);

  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (solidTile(c, r)) {
        if (p.vx > 0) { p.x = c * TILE - p.w; p.vx = 0; }
        else if (p.vx < 0) { p.x = (c + 1) * TILE; p.vx = 0; }
      }
    }
  }

  p.y += p.vy * dt;
  p.onGround = false;

  c0 = Math.floor(p.x / TILE);
  c1 = Math.floor((p.x + p.w - 0.01) / TILE);
  r0 = Math.floor(p.y / TILE);
  r1 = Math.floor((p.y + p.h - 0.01) / TILE);

  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (solidTile(c, r)) {
        if (p.vy > 0) { p.y = r * TILE - p.h; p.vy = 0; p.onGround = true; }
        else if (p.vy < 0) { p.y = (r + 1) * TILE; p.vy = 0; }
      }
    }
  }

  if (p.vy >= 0) {
    const pc0 = Math.floor(p.x / TILE);
    const pc1 = Math.floor((p.x + p.w - 0.01) / TILE);
    for (let c = pc0; c <= pc1; c++) {
      for (let r = 0; r < ROWS; r++) {
        if (!platformTile(c, r)) continue;
        const top = r * TILE;
        const feet = p.y + p.h;
        if (feet >= top && feet <= top + 10) {
          p.y = top - p.h;
          p.vy = 0;
          p.onGround = true;
          p.jumpsUsed = 0;
        }
      }
    }
  }

  if (p.x < Game.camX + 4) {
    p.x = Game.camX + 4;
    if (p.vx < 0) p.vx = 0;
  }
}

function collideCrumbles(p, dt) {
  if (p.vy < 0) return;
  for (const c of Game.level.crumbles) {
    if (c.state > 1) continue;
    if (p.x + p.w > c.x && p.x < c.x + c.w) {
      const feet = p.y + p.h;
      if (feet >= c.y && feet <= c.y + 10) {
        p.y = c.y - p.h;
        p.vy = 0;
        p.onGround = true;
        p.jumpsUsed = 0;
      }
    }
  }
}

function carryMovers(dt) {
  const p = Game.player;
  for (const m of Game.level.movers) {
    const overlapX = p.x + p.w > m.x && p.x < m.x + m.w;
    const feet = p.y + p.h;
    if (overlapX && p.vy >= 0 && feet >= m.y - 2 && feet <= m.y + 9) {
      p.x += m.x - m.prevX;
      p.y = m.y - p.h;
      p.vy = 0;
      p.onGround = true;
      p.jumpsUsed = 0;
    } else if (hit(p, { x: m.x, y: m.y, w: m.w, h: m.h })) {
      die();
      return;
    }
  }
}

function updateCrumbles(dt) {
  const p = Game.player;
  for (const c of Game.level.crumbles) {
    if (c.state === 0) {
      const cx = p.x + p.w / 2;
      const cc = c.x + c.w / 2;
      if (Math.abs(cx - cc) < 34 && p.y + p.h > c.y - 6) {
        c.state = 1;
        c.timer = 0.45;
        Sound.sfx('crumble');
        Game.shake = Math.max(Game.shake, 2);
      }
    } else if (c.state === 1) {
      c.timer -= dt;
      if (c.timer <= 0) {
        c.state = 2;
        c.vy = 0;
        for (let i = 0; i < 6; i++) {
          Game.particles.push({
            x: c.x + Math.random() * c.w,
            y: c.y,
            vx: (Math.random() - 0.5) * 60,
            vy: -20 - Math.random() * 40,
            life: 0.6,
            max: 0.6,
            color: '#7a4432',
            size: 2,
            grav: 400
          });
        }
      }
    } else if (c.state === 2) {
      c.vy += 600 * dt;
      c.y += c.vy * dt;
      if (c.y > 320) c.state = 3;
    }
  }
}

function updateTraps(dt) {
  for (let i = Game.traps.length - 1; i >= 0; i--) {
    const t = Game.traps[i];
    t.t += dt;
    if (t.kind === 'spike' && t.t > 1.25) Game.traps.splice(i, 1);
    if (t.kind === 'lava' && t.t > 1.1) Game.traps.splice(i, 1);
  }
}

function updateCoals(dt) {
  for (let i = Game.coals.length - 1; i >= 0; i--) {
    const c = Game.coals[i];
    c.t += dt;
    c.x += c.dir * c.speed * dt;
    const aheadX = c.x + (c.dir > 0 ? c.w : 0);
    if (c.x < 0 || c.x > WORLD_W || !groundAt(aheadX)) {
      Game.coals.splice(i, 1);
      continue;
    }
    if (hit(Game.player, c)) { die(); return; }
  }
}

function updateSweepers(dt) {
  for (let i = Game.sweepers.length - 1; i >= 0; i--) {
    const s = Game.sweepers[i];
    s.t += dt;
    if (s.phase === 0) {
      s.y -= 45 * dt;
      if (s.y <= 200) { s.y = 200; s.phase = 1; s.t = 0; }
    } else if (s.phase === 1) {
      s.x += s.dir * 55 * dt;
      if (s.x > s.baseX + 90) { s.x = s.baseX + 90; s.dir = -1; }
      if (s.x < s.baseX - 90) { s.x = s.baseX - 90; s.dir = 1; }
      if (s.t > 3.2) { s.phase = 2; s.t = 0; }
    } else {
      s.y += 60 * dt;
      if (s.y > 285) { Game.sweepers.splice(i, 1); continue; }
    }
    if (hit(Game.player, { x: s.x, y: s.y, w: s.w, h: s.h + 5 })) { die(); return; }
  }
}

function updateCoins(dt) {
  const p = Game.player;
  const pcx = p.x + p.w / 2;
  const pcy = p.y + p.h / 2;
  for (const c of Game.level.coins) {
    if (c.taken) continue;
    if (Math.abs(c.x - pcx) < 12 && Math.abs(c.y - pcy) < 14) {
      c.taken = true;
      Game.coins++;
      Sound.sfx('coin');
      for (let i = 0; i < 5; i++) {
        Game.particles.push({
          x: c.x,
          y: c.y,
          vx: (Math.random() - 0.5) * 70,
          vy: -30 - Math.random() * 60,
          life: 0.35 + Math.random() * 0.25,
          max: 0.6,
          color: i % 2 ? '#ffe08a' : '#fff4c0',
          size: 1,
          grav: 160
        });
      }
    }
  }
}

function checkAmbushes() {
  const p = Game.player;
  const cx = p.x + p.w / 2;
  for (const a of Game.level.ambushes) {
    if (a.used || cx <= a.x) continue;
    a.used = true;
    if (cx - a.x > 260) continue;
    triggerAmbush(a);
  }
}

function triggerAmbush(a) {
  const p = Game.player;
  const predX = clamp(p.x + p.w / 2 + p.vx * 0.6, 24, WORLD_W - 24);
  const g = groundAt(predX);
  const sx = Math.floor(predX / TILE) * TILE;

  if (a.type === 'spike') {
    const spot = safeGroundSpot(sx, 24);
    if (spot != null) Game.traps.push({ kind: 'spike', x: spot, y: GROUND_Y, t: 0 });
    else Game.traps.push({ kind: 'lava', x: sx, y: LAVA_Y, t: 0 });
  } else if (a.type === 'lava') {
    const spot = safeGroundSpot(sx, 24);
    if (spot != null) Game.traps.push({ kind: 'lava', x: spot, y: GROUND_Y, t: 0 });
    else Game.traps.push({ kind: 'lava', x: sx, y: LAVA_Y, t: 0 });
  } else if (a.type === 'coal') {
    spawnCoalNear(predX);
  } else if (a.type === 'sweeper') {
    const base = clamp(predX + (p.face >= 0 ? 50 : -50), 60, WORLD_W - 120);
    Game.sweepers.push({
      x: base - 28, y: LAVA_Y, w: 56, h: 8,
      baseX: base - 28, dir: 1, phase: 0, t: 0
    });
  } else if (a.type === 'crumble') {
    let best = null, bd = 1e9;
    for (const c of Game.level.crumbles) {
      const d = Math.abs((c.x + c.w / 2) - predX);
      if (d < bd) { bd = d; best = c; }
    }
    if (best && bd < 150 && best.state === 0) {
      best.state = 1;
      best.timer = 0.32;
      Sound.sfx('crumble');
    } else {
      const spot = safeGroundSpot(sx, 24);
      if (spot != null) Game.traps.push({ kind: 'spike', x: spot, y: GROUND_Y, t: 0 });
    }
  }
  Game.shake = Math.max(Game.shake, 3);
}

function spawnCoalNear(predX) {
  const p = Game.player;
  const ahead = p.face >= 0 ? 1 : -1;
  let x = predX + ahead * 140;
  if (!groundAt(x) || !groundAt(x + 10)) x = predX - ahead * 140;
  if (!groundAt(x) || !groundAt(x + 10)) return;
  if (Math.abs(x - p.x) < 48) return;
  Game.coals.push({
    x, y: GROUND_Y - 10, w: 10, h: 10,
    dir: x > p.x ? -1 : 1, speed: 77, t: 0
  });
}

function checkHazards() {
  const p = Game.player;
  for (const s of Game.level.spikes) {
    if (hit(p, { x: s.x + 2, y: s.y + 2, w: s.w - 4, h: 6 })) { die(); return; }
  }
  for (const t of Game.traps) {
    if (t.kind === 'spike') {
      if (t.t > 0.05 && t.t < 1.05 && hit(p, { x: t.x, y: GROUND_Y - 8, w: 16, h: 8 })) { die(); return; }
    } else if (t.kind === 'lava') {
      const h = Math.min(44, t.t * 130);
      if (h > 4 && hit(p, { x: t.x, y: t.y - h, w: 16, h })) { die(); return; }
    }
  }
  if (p.y + p.h > LAVA_Y + 1) { die(); return; }
  if (p.y > 320) { die(); return; }
  if (hit(p, Game.level.door)) triggerClear();
}

function triggerClear() {
  if (Game.state !== 'play') return;
  Game.state = 'clear';
  Game.clearT = 0;
  Game.shake = 4;
  Sound.sfx('clear');
  Sound.stopMusic();
  const p = Game.player;
  p.vx = 0;
  p.vy = 0;
  p.crouch = false;
  p.h = 16;
  p.y = GROUND_Y - 16;
  p.onGround = true;
  p.face = 1;
  const d = Game.level.door;
  for (let i = 0; i < 20; i++) {
    Game.particles.push({
      x: d.x + 16 + (Math.random() - 0.5) * 20,
      y: d.y + 20 + Math.random() * 24,
      vx: (Math.random() - 0.5) * 60,
      vy: -40 - Math.random() * 80,
      life: 0.6 + Math.random() * 0.6,
      max: 1.2,
      color: i % 2 ? '#ffe08a' : '#ffb347',
      size: 1 + (i % 2),
      grav: 60
    });
  }
}

function updateCamera(dt) {
  const target = clamp(Game.player.x - 160, 0, WORLD_W - VIEW_W);
  if (target > Game.camX) {
    Game.camX += (target - Game.camX) * Math.min(1, dt * 12);
  }
}

function updateParticles(dt) {
  for (let i = Game.particles.length - 1; i >= 0; i--) {
    const p = Game.particles[i];
    p.life -= dt;
    if (p.life <= 0) { Game.particles.splice(i, 1); continue; }
    p.vy += (p.grav || 0) * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}

function spawnDust(x, y, n) {
  for (let i = 0; i < n; i++) {
    Game.particles.push({
      x: x + (Math.random() - 0.5) * 6,
      y: y - Math.random() * 3,
      vx: -30 - Math.random() * 40,
      vy: -10 - Math.random() * 30,
      life: 0.25 + Math.random() * 0.25,
      max: 0.5,
      color: '#a08070',
      size: 1 + (i % 2),
      grav: 120
    });
  }
}

function ambientDust(dt) {
  Game.dustT -= dt;
  const p = Game.player;
  if (p.onGround && Math.abs(p.vx) > 70 && Game.dustT <= 0) {
    Game.dustT = Math.abs(p.vx) > 140 ? 0.045 : 0.09;
    spawnDust(p.x + p.w / 2 - p.face * 4, p.y + p.h - 1, 1);
  }
}

/* =========================================================
   繪圖工具
   ========================================================= */

function txt(s, x, y, size, color, align, font) {
  ctx.font = 'bold ' + size + 'px ' + (font || CN_FONT);
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillText(s, x + 1, y + 1);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

function panel(x, y, w, h) {
  ctx.fillStyle = '#120a0c';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#6e3a2a';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.strokeStyle = '#c9825a';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
}

function tri(x1, y1, x2, y2, x3, y3, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.closePath();
  ctx.fill();
}

function drawSlab(x, y, w, h, base, top) {
  x = Math.round(x);
  y = Math.round(y);
  ctx.fillStyle = '#2a1310';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = base;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  if (top) {
    ctx.fillStyle = '#7a4432';
    ctx.fillRect(x + 1, y + 1, w - 2, 2);
  }
  ctx.fillStyle = '#1c0b09';
  ctx.fillRect(x + 1, y + h - 2, w - 2, 1);
}

/* =========================================================
   畫面總入口
   ========================================================= */

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);

  if (Game.state === 'title' || Game.state === 'help' || Game.state === 'board') {
    drawTitleScene();
    if (Game.state === 'help') drawHelp();
    if (Game.state === 'board') drawBoard(false);
  } else {
    drawWorld();
    if (Game.state === 'pause') drawPause();
    if (Game.state === 'dead') drawDead();
    if (Game.state === 'result' || Game.state === 'name') drawResult();
    if (Game.state === 'boardResult') drawBoard(true);
  }
}

/* =========================================================
   背景 / 岩漿 / 地形
   ========================================================= */

function drawBackground(cam) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, '#160a0e');
  g.addColorStop(0.55, '#221016');
  g.addColorStop(1, '#2a1216');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  const fx = cam * 0.16;
  for (let x = -16; x < VIEW_W + 16; x += 8) {
    const k = Math.floor((x + fx) / 8);
    const h = 42 + hash2(k, 3) * 82;
    ctx.fillStyle = '#261218';
    ctx.fillRect(x, LAVA_Y - h, 8, h);
  }

  const fx2 = cam * 0.3;
  for (let x = -16; x < VIEW_W + 16; x += 16) {
    const k = Math.floor((x + fx2) / 16);
    const h = 22 + hash2(k, 9) * 96;
    ctx.fillStyle = '#331820';
    ctx.fillRect(x, LAVA_Y - h, 16, h);
  }

  const mx = cam * 0.45;
  for (let x = -16; x < VIEW_W + 16; x += 16) {
    const k = Math.floor((x + mx) / 16);
    const h = 8 + hash2(k, 17) * 44;
    tri(x, 0, x + 16, 0, x + 8, h, '#3a1c22');
    tri(x + 5, 0, x + 11, 0, x + 8, h * 0.62, '#2a1318');
  }

  const tx = -((cam * 0.45) % 220);
  for (let i = 0; i < 4; i++) {
    const x = tx + i * 220 + 80;
    const fy = 86 + hash2(i, 5) * 36;
    ctx.fillStyle = '#4a2a1a';
    ctx.fillRect(Math.round(x) - 2, Math.round(fy), 4, 10);
    const fl = Math.sin(Game.bgT * 9 + i * 1.7) * 1.5;
    const rg = ctx.createRadialGradient(x, fy - 4, 1, x, fy - 4, 28);
    rg.addColorStop(0, 'rgba(255,190,80,0.45)');
    rg.addColorStop(0.45, 'rgba(255,110,30,0.14)');
    rg.addColorStop(1, 'rgba(255,80,20,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(x - 28, fy - 32, 56, 56);
    ctx.fillStyle = '#ffb347';
    ctx.fillRect(Math.round(x) - 1, Math.round(fy - 6 + fl), 3, 6);
    ctx.fillStyle = '#ffe08a';
    ctx.fillRect(Math.round(x), Math.round(fy - 4 + fl), 1, 3);
  }
}

function drawLava(cam, t) {
  const g = ctx.createLinearGradient(0, LAVA_Y, 0, VIEW_H);
  g.addColorStop(0, '#ff9a2a');
  g.addColorStop(0.35, '#e0431a');
  g.addColorStop(1, '#6e1206');
  ctx.fillStyle = g;
  ctx.fillRect(0, LAVA_Y, VIEW_W, VIEW_H - LAVA_Y);

  ctx.fillStyle = '#ffd05a';
  for (let x = 0; x < VIEW_W; x += 4) {
    const wx = x + cam;
    const yy = LAVA_Y + Math.sin(wx * 0.04 + t * 3) * 2 + Math.sin(wx * 0.013 - t * 1.7) * 1.5;
    ctx.fillRect(x, Math.round(yy), 4, 2);
  }

  for (let i = 0; i < 16; i++) {
    const bx = ((i * 137.5 - cam * 0.9) % VIEW_W + VIEW_W) % VIEW_W;
    const ph = (t * 0.7 + i * 0.37) % 1;
    const by = LAVA_Y + 6 + ph * 16;
    const r = 1 + (i % 3);
    ctx.fillStyle = 'rgba(255,220,120,' + ((1 - ph) * 0.8).toFixed(2) + ')';
    ctx.fillRect(Math.round(bx), Math.round(by), r, r);
  }

  const gg = ctx.createLinearGradient(0, LAVA_Y - 56, 0, LAVA_Y);
  gg.addColorStop(0, 'rgba(255,90,20,0)');
  gg.addColorStop(1, 'rgba(255,120,30,0.3)');
  ctx.fillStyle = gg;
  ctx.fillRect(0, LAVA_Y - 56, VIEW_W, 56);
}

function drawTile(c, r, cam, topMoss) {
  const x = c * TILE - cam;
  if (x < -TILE || x > VIEW_W) return;
  const y = r * TILE;
  const h = hash2(c, r);

  ctx.fillStyle = '#3a1b16';
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = '#5a2c22';
  ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
  ctx.fillStyle = '#6e3a2a';
  ctx.fillRect(x + 1, y + 1, TILE - 2, 3);
  ctx.fillStyle = '#2c130f';
  ctx.fillRect(x, y + TILE - 3, TILE, 3);

  ctx.fillStyle = '#3a1a14';
  if (h < 0.35) { ctx.fillRect(x + 4, y + 6, 1, 5); ctx.fillRect(x + 5, y + 11, 3, 1); }
  if (h > 0.72) { ctx.fillRect(x + 11, y + 4, 1, 6); ctx.fillRect(x + 8, y + 9, 3, 1); }

  ctx.fillStyle = '#7a4432';
  if (h > 0.45 && h < 0.6) ctx.fillRect(x + 9, y + 7, 2, 2);
  if (h > 0.85) ctx.fillRect(x + 3, y + 4, 2, 1);

  if (topMoss) {
    ctx.fillStyle = '#5f7a38';
    ctx.fillRect(x, y, TILE, 3);
    ctx.fillStyle = '#7a9448';
    ctx.fillRect(x, y, TILE, 1);
    ctx.fillStyle = '#4a5f2c';
    for (let i = 0; i < TILE; i += 4) {
      if (hash2(c * 7 + i, r) > 0.5) ctx.fillRect(x + i, y + 3, 2, 1);
    }
  }
}

function drawTiles(cam) {
  const c0 = Math.floor(cam / TILE) - 1;
  const c1 = c0 + Math.ceil(VIEW_W / TILE) + 2;
  for (let c = c0; c <= c1; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (solidTile(c, r)) drawTile(c, r, cam, r > 0 && !solidTile(c, r - 1));
    }
  }
}

function drawPlatforms(cam) {
  const c0 = Math.floor(cam / TILE) - 1;
  const c1 = c0 + Math.ceil(VIEW_W / TILE) + 2;
  for (let r = 0; r < ROWS; r++) {
    let run = -1;
    for (let c = c0; c <= c1 + 1; c++) {
      const isP = platformTile(c, r);
      if (isP && run < 0) run = c;
      if (!isP && run >= 0) {
        const x = run * TILE - cam;
        const w = (c - run) * TILE;
        drawSlab(x, r * TILE, w, 8, '#5a2c22', true);
        ctx.fillStyle = '#3a1a14';
        for (let i = 6; i < w - 4; i += 12) {
          ctx.fillRect(Math.round(x + i), r * TILE + 2, 1, 5);
          if (i % 24 === 6) ctx.fillRect(Math.round(x + i), r * TILE + 3, 4, 1);
        }
        run = -1;
      }
    }
  }
}

/* =========================================================
   關卡物件
   ========================================================= */

function drawCrumbles(cam) {
  for (const c of Game.level.crumbles) {
    if (c.state === 3) continue;
    let x = c.x - cam;
    if (x < -90 || x > VIEW_W + 90) continue;
    let y = c.y;
    if (c.state === 1) { x += (Math.random() - 0.5) * 3; y += (Math.random() - 0.5) * 2; }
    drawSlab(x, y, c.w, 8, '#5a2c22', true);
    ctx.fillStyle = '#3a1a14';
    for (let i = 6; i < c.w - 4; i += 12) {
      ctx.fillRect(Math.round(x + i), Math.round(y + 2), 1, 5);
      if (i % 24 === 6) ctx.fillRect(Math.round(x + i), Math.round(y + 3), 4, 1);
    }
  }
}

function drawMovers(cam) {
  for (const m of Game.level.movers) {
    const x = m.x - cam;
    if (x < -70 || x > VIEW_W + 70) continue;
    drawSlab(x, m.y, m.w, m.h, '#4a2a30', true);
    ctx.fillStyle = '#2a1518';
    ctx.fillRect(Math.round(x), Math.round(m.y + m.h - 2), m.w, 2);
    ctx.fillStyle = '#ff7a2a';
    ctx.fillRect(Math.round(x + 2), Math.round(m.y + m.h), m.w - 4, 1);
  }
}

function drawSpikes(cam) {
  for (const s of Game.level.spikes) {
    const x = s.x - cam;
    if (x < -40 || x > VIEW_W + 40) continue;
    for (let i = 0; i < s.w; i += 8) {
      tri(x + i, GROUND_Y, x + i + 4, GROUND_Y - 8, x + i + 8, GROUND_Y, '#2b2b33');
      tri(x + i + 2, GROUND_Y, x + i + 4, GROUND_Y - 6, x + i + 6, GROUND_Y, '#c9d2e2');
      tri(x + i + 3, GROUND_Y, x + i + 4, GROUND_Y - 4, x + i + 5, GROUND_Y, '#eef3ff');
    }
  }
}

function drawCoin(x, y, t, phase) {
  const sp = Math.abs(Math.cos(t * 3 + phase));
  const w = Math.max(2, 2 + sp * 6);
  const rw = Math.round(w);

  const g = ctx.createRadialGradient(x, y, 1, x, y, 10);
  g.addColorStop(0, 'rgba(255,210,90,0.35)');
  g.addColorStop(1, 'rgba(255,180,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - 10, y - 10, 20, 20);

  ctx.fillStyle = '#a86a10';
  ctx.fillRect(Math.round(x - w / 2) - 1, Math.round(y - 5) - 1, rw + 2, 12);
  ctx.fillStyle = '#ffd75e';
  ctx.fillRect(Math.round(x - w / 2), Math.round(y - 5), rw, 10);
  ctx.fillStyle = '#fff4c0';
  ctx.fillRect(Math.round(x - w / 2) + 1, Math.round(y - 4), Math.max(1, rw - 3), 2);
  if (rw > 3) {
    ctx.fillStyle = '#d89a20';
    ctx.fillRect(Math.round(x - w / 2) + 1, Math.round(y + 1), Math.max(1, rw - 3), 2);
  }
}

function drawCoins(cam) {
  for (const c of Game.level.coins) {
    if (c.taken) continue;
    const x = c.x - cam;
    if (x < -20 || x > VIEW_W + 20) continue;
    drawCoin(x, c.y, Game.bgT, c.phase);
  }
}

function drawDoor(cam) {
  const d = Game.level.door;
  const x = d.x - cam;
  if (x < -90 || x > VIEW_W + 90) return;

  const g = ctx.createRadialGradient(x + 16, d.y + 24, 2, x + 16, d.y + 24, 46);
  g.addColorStop(0, 'rgba(255,210,110,0.55)');
  g.addColorStop(1, 'rgba(255,160,50,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - 30, d.y - 20, 92, 90);

  ctx.fillStyle = '#2a1518';
  ctx.fillRect(x - 2, d.y - 2, 36, 52);
  ctx.fillStyle = '#5a2c22';
  ctx.fillRect(x, d.y, 32, 48);
  ctx.fillStyle = '#1a0b08';
  ctx.fillRect(x + 6, d.y + 8, 20, 40);

  const lg = ctx.createLinearGradient(0, d.y + 8, 0, d.y + 48);
  lg.addColorStop(0, '#ffe08a');
  lg.addColorStop(0.6, '#ffb347');
  lg.addColorStop(1, '#ff6a20');
  ctx.fillStyle = lg;
  ctx.fillRect(x + 8, d.y + 10, 16, 38);

  ctx.fillStyle = '#5a2c22';
  ctx.fillRect(x + 2, d.y - 4, 28, 6);
  ctx.fillRect(x + 6, d.y - 8, 20, 4);

  ctx.fillStyle = 'rgba(255,255,220,' + (0.4 + Math.sin(Game.bgT * 3) * 0.2).toFixed(2) + ')';
  ctx.fillRect(x + 11, d.y + 18, 2, 2);
  ctx.fillRect(x + 17, d.y + 26, 2, 2);
  ctx.fillRect(x + 13, d.y + 34, 2, 2);
}

function drawTraps(cam) {
  for (const t of Game.traps) {
    if (t.kind === 'spike') {
      const rise = Math.min(1, t.t / 0.08);
      const x = t.x - cam;
      for (let i = 0; i < 2; i++) {
        const h = 8 * rise;
        tri(x + i * 8, GROUND_Y, x + i * 8 + 4, GROUND_Y - h, x + i * 8 + 8, GROUND_Y, '#ff8a3a');
        tri(x + i * 8 + 2, GROUND_Y, x + i * 8 + 4, GROUND_Y - h * 0.6, x + i * 8 + 6, GROUND_Y, '#ffe08a');
      }
    } else if (t.kind === 'lava') {
      const h = Math.min(44, t.t * 130);
      const x = t.x - cam;
      const g = ctx.createLinearGradient(0, t.y - h, 0, t.y);
      g.addColorStop(0, '#ffe08a');
      g.addColorStop(0.4, '#ff9a2a');
      g.addColorStop(1, '#d8301e');
      ctx.fillStyle = 'rgba(255,120,30,0.22)';
      ctx.fillRect(x - 6, t.y - h, 28, h);
      ctx.fillStyle = g;
      ctx.fillRect(x, t.y - h, 16, h);
    }
  }
}

function drawCoal(x, y, t) {
  const cx = Math.round(x + 5);
  const cy = Math.round(y + 5);

  const rg = ctx.createRadialGradient(cx, cy, 2, cx, cy, 13);
  rg.addColorStop(0, 'rgba(255,90,30,0.35)');
  rg.addColorStop(1, 'rgba(255,90,30,0)');
  ctx.fillStyle = rg;
  ctx.fillRect(cx - 13, cy - 13, 26, 26);

  tri(cx - 8, cy, cx - 2, cy - 3, cx - 2, cy + 3, '#20202a');
  tri(cx + 8, cy, cx + 2, cy - 3, cx + 2, cy + 3, '#20202a');
  tri(cx, cy - 8, cx - 3, cy - 2, cx + 3, cy - 2, '#20202a');
  tri(cx, cy + 8, cx - 3, cy + 2, cx + 3, cy + 2, '#20202a');

  ctx.fillStyle = '#14141a';
  ctx.fillRect(cx - 4, cy - 5, 8, 10);
  ctx.fillRect(cx - 5, cy - 4, 10, 8);
  ctx.fillRect(cx - 3, cy - 6, 6, 12);

  ctx.fillStyle = '#2a2a34';
  ctx.fillRect(cx - 4, cy - 4, 2, 2);

  ctx.fillStyle = '#ff6a20';
  ctx.fillRect(cx - 1, cy - 2, 1, 3);
  ctx.fillRect(cx + 2, cy + 1, 1, 2);

  ctx.fillStyle = '#ff3a1a';
  ctx.fillRect(cx - 3, cy - 2, 2, 2);
  ctx.fillRect(cx + 1, cy - 2, 2, 2);
  ctx.fillStyle = '#ffd0a0';
  ctx.fillRect(cx - 3, cy - 2, 1, 1);
  ctx.fillRect(cx + 1, cy - 2, 1, 1);
}

function drawCoals(cam) {
  for (const c of Game.coals) {
    const x = c.x - cam;
    if (x < -30 || x > VIEW_W + 30) continue;
    drawCoal(x, c.y, Game.bgT);
  }
}

function drawSweepers(cam) {
  for (const s of Game.sweepers) {
    const x = s.x - cam;
    if (x < -90 || x > VIEW_W + 90) continue;
    drawSlab(x, s.y, s.w, s.h, '#3a2030', true);
    ctx.fillStyle = '#ff5a2a';
    ctx.fillRect(Math.round(x + 2), Math.round(s.y + s.h - 1), s.w - 4, 1);
    for (let i = 4; i < s.w - 4; i += 8) {
      tri(x + i, s.y + s.h, x + i + 4, s.y + s.h + 5, x + i + 8, s.y + s.h, '#c9d2e2');
    }
  }
}

/* =========================================================
   角色
   ========================================================= */

function drawKnight(x, y, o) {
  const t = o.t || 0;
  ctx.save();
  if ((o.face || 1) < 0) {
    ctx.translate(Math.round(x) + 12, Math.round(y));
    ctx.scale(-1, 1);
  } else {
    ctx.translate(Math.round(x), Math.round(y));
  }

  const P = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(a, b, w, h); };
  const D = '#1b1220', S = '#c9d2e2', SD = '#8b94aa', SL = '#eef3ff';
  const R = '#d8333a', RD = '#8f1c22', RL = '#ff6b62', C = '#5ce8d8';

  if (o.crouch) {
    P(8, 1, 4, 7, RD);
    P(7, 2, 3, 6, R);
    P(2, 7, 8, 2, D);
    P(1, 2, 8, 6, SD);
    P(2, 2, 7, 4, S);
    P(2, 2, 6, 1, SL);
    P(2, 0, 7, 3, S);
    P(3, 0, 5, 1, SL);
    P(3, 1, 5, 1, D);
    P(4, 1, 4, 1, C);
    P(0, 3, 2, 4, SD);
    P(10, 3, 2, 4, SD);
  } else {
    const sway = Math.sin(t * 6);
    P(8, 3 + sway, 4, 10, RD);
    P(7, 3 + sway, 4, 9, R);
    P(8, 4 + sway, 2, 7, RL);

    let l1 = 0, l2 = 0;
    if (o.air) { l1 = 1; l2 = -1; }
    else if (o.run) {
      const ph = Math.sin(t * 16);
      l1 = ph > 0 ? 0 : 2;
      l2 = ph > 0 ? 2 : 0;
    }
    P(3, 12 + l1, 3, 4, D);
    P(6, 12 + l2, 3, 4, D);
    P(2, 15 + l1, 4, 1, SD);
    P(6, 15 + l2, 4, 1, SD);

    P(1, 6, 10, 7, SD);
    P(2, 6, 8, 6, S);
    P(3, 6, 6, 1, SL);
    P(4, 8, 4, 5, R);
    P(5, 9, 2, 3, RL);

    P(0, 7, 2, 4, SD);
    P(10, 7, 2, 4, SD);
    P(0, 10, 2, 1, S);
    P(10, 10, 2, 1, S);

    P(2, 0, 8, 7, S);
    P(3, 0, 6, 2, SL);
    P(2, 4, 8, 1, SD);
    P(2, 6, 8, 1, D);

    P(3, 2, 6, 3, D);
    P(4, 2, 4, 1, C);
    P(4, 4, 3, 1, '#2f8f86');

    P(1, 0, 3, 2, R);
    P(0, 0, 2, 1, RL);
  }

  ctx.restore();
}

function drawPlayer(cam) {
  const p = Game.player;
  const running = p.onGround && Math.abs(p.vx) > 20;
  const bob = running ? Math.floor(Math.sin(p.animT * 18)) : 0;
  drawKnight(p.x - cam, p.y + bob, {
    t: Game.bgT,
    face: p.face,
    crouch: p.crouch,
    run: running,
    air: !p.onGround
  });
}

function drawParticles(cam) {
  for (const p of Game.particles) {
    const a = clamp(p.life / p.max, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x - cam), Math.round(p.y), p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

/* =========================================================
   標題 / 說明 / 排行榜
   ========================================================= */

function drawTitleScene() {
  const cam = Game.bgT * 22;
  drawBackground(cam);
  drawLava(cam, Game.bgT);

  const c0 = Math.floor(cam / TILE) - 1;
  for (let c = c0; c < c0 + 33; c++) {
    drawTile(c, 14, cam, true);
    drawTile(c, 15, cam, false);
  }

  for (let i = 0; i < 4; i++) {
    drawCoin(330 + i * 18, 152 + Math.sin(Game.bgT * 2 + i * 0.8) * 5, Game.bgT, i * 0.6);
  }
  drawCoal(400 + Math.sin(Game.bgT * 0.7) * 20, GROUND_Y - 10, Game.bgT);

  ctx.save();
  ctx.translate(42, GROUND_Y - 32);
  ctx.scale(2, 2);
  drawKnight(0, 0, { t: Game.bgT, face: 1, crouch: false, run: false, air: false });
  ctx.restore();

  drawLogo();

  const items = ['開始遊戲', '操作說明', '排行榜'];
  for (let i = 0; i < items.length; i++) {
    const sel = i === Game.menu;
    const y = 106 + i * 20;
    if (sel) {
      ctx.fillStyle = 'rgba(255,180,70,0.08)';
      ctx.fillRect(VIEW_W / 2 - 80, y - 3, 160, 18);
      txt('▶', VIEW_W / 2 - 64, y + 1, 11, '#ffd75e');
    }
    txt(items[i], VIEW_W / 2, y, sel ? 13 : 11, sel ? '#ffd75e' : '#d9b8a8', 'center');
  }

  panel(118, 164, 244, 58);
  txt('最佳紀錄', 130, 168, 9, '#ffb347');
  const b = Game.best;
  if (b) {
    txt('最高分 ' + b.score, 130, 181, 9, '#ffe6c0');
    txt('最多金幣 ' + b.coins, 250, 181, 9, '#ffe6c0');
    txt('最快 ' + fmtTime(b.time), 130, 194, 9, '#ffe6c0');
    txt('最少死亡 ' + b.deaths, 250, 194, 9, '#ffe6c0');
    txt('M 靜音 · 排行榜收錄前 10 名', VIEW_W / 2, 208, 8, '#a08070', 'center');
  } else {
    txt('尚無紀錄，等你來挑戰', VIEW_W / 2, 184, 10, '#c9a08a', 'center');
    txt('1 命通關 · 60 枚金幣 · 無預警突襲', VIEW_W / 2, 202, 8, '#a08070', 'center');
  }
}

function drawLogo() {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 36px monospace';
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#2a0a08';
  ctx.strokeText('DEATH LINE', VIEW_W / 2, 52);

  const g = ctx.createLinearGradient(0, 28, 0, 76);
  g.addColorStop(0, '#ffe89a');
  g.addColorStop(0.5, '#ffb347');
  g.addColorStop(1, '#d8301e');
  ctx.fillStyle = g;
  ctx.fillText('DEATH LINE', VIEW_W / 2, 52);

  ctx.font = 'bold 11px ' + CN_FONT;
  ctx.fillStyle = '#e8b090';
  ctx.fillText('像 素 跑 酷 · 岩 漿 洞 穴', VIEW_W / 2, 79);
  ctx.restore();
}

function drawHelp() {
  ctx.fillStyle = 'rgba(5,2,3,0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  panel(44, 22, 392, 226);
  txt('操作說明', VIEW_W / 2, 30, 14, '#ffd75e', 'center');

  const lines = [
    'A / D 或 ← / →   左右移動',
    '空白 或 ↑        跳躍（可二段跳）',
    'S 或 ↓           蹲下（按住）',
    '雙擊 A / D 後按住  加速跑',
    'Esc 暫停　R 重新開始　M 靜音',
    '◆ 尖刺、岩漿、巡邏煤球碰到即死',
    '◆ 煤球只從平台邊緣走入，不能踩',
    '◆ 裂石靠近就崩，不會重生',
    '◆ 頭頂平台升起時蹲下可通過',
    '◆ 突襲完全無預警，系統會預測',
    '　你 0.6 秒後的落點',
    '◆ 1 命通關，死亡從關卡開頭重來',
    '◆ 全關 60 金幣，15 枚是危險誘餌'
  ];

  let y = 54;
  for (const s of lines) {
    txt(s, 62, y, 9, s.startsWith('◆') ? '#ffb347' : '#e8d0c0');
    y += 13.5;
  }

  txt('Enter / Esc 返回', VIEW_W / 2, 232, 8, '#a08070', 'center');
}

function drawBoard(resultMode) {
  ctx.fillStyle = 'rgba(5,2,3,0.78)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  panel(28, 18, 424, 238);
  txt('排行榜', VIEW_W / 2, 26, 15, '#ffd75e', 'center');

  const list = Game.boardList || [];
  txt('#', 44, 48, 8, '#a08070', 'left', EN_FONT);
  txt('名字', 66, 48, 8, '#a08070');
  txt('分數', 262, 48, 8, '#a08070', 'right', EN_FONT);
  txt('時間', 326, 48, 8, '#a08070', 'right', EN_FONT);
  txt('死亡', 404, 48, 8, '#a08070', 'right');

  if (!list.length) {
    txt('尚無紀錄', VIEW_W / 2, 120, 11, '#c9a08a', 'center');
  } else {
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      const y = 64 + i * 14;
      const isNew = resultMode && i === Game.newIndex;
      const col = isNew ? '#ffd75e' : (i % 2 ? '#e8d0c0' : '#d9b8a8');
      txt(String(i + 1), 44, y, 9, col, 'left', EN_FONT);
      txt(e.name, 66, y, 9, col);
      txt(String(e.score), 262, y, 9, col, 'right', EN_FONT);
      txt(fmtTime(e.time), 326, y, 9, col, 'right', EN_FONT);
      txt(String(e.deaths), 404, y, 9, col, 'right', EN_FONT);
      if (isNew) txt('NEW', 444, y, 7, '#ffb347', 'right', EN_FONT);
    }
  }

  if (resultMode) {
    const y = 212;
    const sel0 = Game.boardMenu === 0;
    const sel1 = Game.boardMenu === 1;
    txt((sel0 ? '▶ ' : '　') + '再玩一次', VIEW_W / 2 - 72, y, 10, sel0 ? '#ffd75e' : '#a08070', 'center');
    txt((sel1 ? '▶ ' : '　') + '回標題', VIEW_W / 2 + 72, y, 10, sel1 ? '#ffd75e' : '#a08070', 'center');
  } else {
    txt('Enter / Esc 返回', VIEW_W / 2, 222, 9, '#a08070', 'center');
  }

  if (Game.boardConfirm) {
    txt('再按 C 確認清除所有紀錄', VIEW_W / 2, 240, 9, '#ff6b62', 'center');
  } else {
    txt('C 清除紀錄', VIEW_W / 2, 240, 8, '#6e5a52', 'center');
  }
}

/* =========================================================
   遊戲畫面 / HUD / 覆蓋層
   ========================================================= */

function drawWorld() {
  const cam = Game.camX;
  ctx.save();
  if (Game.shake > 0.2) {
    const s = Game.shake * 0.55;
    ctx.translate((Math.random() * 2 - 1) * s, (Math.random() * 2 - 1) * s);
  }

  drawBackground(cam);
  drawLava(cam, Game.bgT);
  drawTiles(cam);
  drawPlatforms(cam);
  drawCrumbles(cam);
  drawMovers(cam);
  drawSpikes(cam);
  drawCoins(cam);
  drawDoor(cam);
  drawTraps(cam);
  drawCoals(cam);
  drawSweepers(cam);
  if (Game.state !== 'dead') drawPlayer(cam);
  drawParticles(cam);
  ctx.restore();

  if (Game.state !== 'dead' && Game.state !== 'result' && Game.state !== 'name' && Game.state !== 'boardResult') {
    drawHUD();
  }

  if (Game.state === 'clear' || Game.state === 'result' || Game.state === 'name' || Game.state === 'boardResult') {
    const a = Game.state === 'clear' ? Game.fade : 1;
    ctx.fillStyle = 'rgba(5,2,3,' + a.toFixed(3) + ')';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

function drawHUD() {
  drawCoin(18, 22, Game.bgT, 0);
  txt(Game.coins + '/' + Game.level.totalCoins, 30, 15, 10, '#ffe08a');
  txt(fmtTime(Game.runTime), 14, 34, 10, '#e8d0c0');
  txt('死亡 ' + Game.deaths, VIEW_W - 14, 15, 9, '#c9a08a', 'right');
}

function drawPause() {
  ctx.fillStyle = 'rgba(5,2,3,0.68)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  panel(150, 78, 180, 116);
  txt('暫停', VIEW_W / 2, 88, 16, '#ffd75e', 'center');

  const items = ['繼續遊戲', '重新開始', '回標題'];
  for (let i = 0; i < items.length; i++) {
    const sel = i === Game.pauseMenu;
    const y = 116 + i * 20;
    txt((sel ? '▶ ' : '　') + items[i], VIEW_W / 2, y, sel ? 11 : 10, sel ? '#ffd75e' : '#c9a08a', 'center');
  }
  txt('Esc 繼續', VIEW_W / 2, 178, 8, '#a08070', 'center');
}

function drawDead() {
  const a = Math.max(0, 1 - Game.deadT * 2.5);
  ctx.fillStyle = 'rgba(120,10,10,' + (a * 0.35).toFixed(3) + ')';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  txt('死 亡', VIEW_W / 2, 112, 26, '#ff5a3a', 'center');
  txt('死亡次數 ' + Game.deaths, VIEW_W / 2, 146, 10, '#ffb347', 'center');
}

function drawResult() {
  ctx.fillStyle = 'rgba(5,2,3,0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  panel(90, 42, 300, 186);
  txt('通 關', VIEW_W / 2, 52, 20, '#ffd75e', 'center');

  const r = Game.result;
  if (!r) return;

  const rows = [
    ['金幣', r.coins + ' / ' + r.total],
    ['用時', fmtTime(r.time)],
    ['死亡次數', String(r.deaths)]
  ];
  let y = 86;
  for (const row of rows) {
    txt(row[0], 116, y, 10, '#c9a08a');
    txt(row[1], 364, y, 10, '#ffe6c0', 'right');
    y += 20;
  }

  txt('分 數', 116, y + 8, 11, '#c9a08a');
  txt(String(r.score), 364, y, 24, '#ffd75e', 'right', EN_FONT);
  txt('按 Enter 留下名字', VIEW_W / 2, 202, 9, '#c9a08a', 'center');
}

/* =========================================================
   初始化 / 主迴圈
   ========================================================= */

let last = performance.now();

function loop(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  update(dt);
  draw();
  Input.pressed = {};
  requestAnimationFrame(loop);
}

function init() {
  Input.init();
  Game.best = Store.best();

  const nameInput = document.getElementById('nameInput');
  nameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitName();
    }
  });
  document.getElementById('nameSubmit').addEventListener('click', submitName);

  window.addEventListener('pointerdown', () => {
    Sound.init();
    Sound.resume();
    if (!Sound.track) Sound.startMusic(Game.state === 'play' ? 'game' : 'title');
  });

  requestAnimationFrame(loop);
}

init();
})();
