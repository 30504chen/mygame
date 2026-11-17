/* main.js — 海島 3D Demo：island3d 的一部分 */
/* ============================================================
   輸入
   ============================================================ */
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (DIR_KEYS.includes(e.code) && !e.repeat) {
    const now = performance.now();
    if (_lastDirPress[e.code] && (now - _lastDirPress[e.code]) < 320) {
      _runKey = e.code;
      _doubleTapRun = true;
    }
    _lastDirPress[e.code] = now;
  }
  if (e.code === 'Space') {
    e.preventDefault();
    if (!e.repeat && !isDigging()) doAction();
  }
  if (e.code === 'KeyI' && !e.repeat) toggleInv();
  if (e.code === 'KeyB' && !e.repeat) toggleDex();
  if (e.code === 'KeyE' && !e.repeat) interact();
  /* 耕地功能已取消 */
  if (e.code === 'KeyM' && !e.repeat) toggleMute();
  if (e.code === 'KeyP' && !e.repeat) {
    const dp = document.getElementById('dbgpanel'); if (dp) dp.style.display = dp.style.display === 'none' ? 'block' : 'none';
    const st = document.getElementById('stats'); if (st) st.style.display = st.style.display === 'none' ? 'block' : 'none';
  }
  if (e.code === 'Escape') closePanels();
});
addEventListener('keyup', e => {
  keys[e.code] = false;
  if (DIR_KEYS.includes(e.code) && e.code === _runKey) {
    _runKey = null;
    _doubleTapRun = false;
  }
});
/* 連按兩下方向鍵啟動跑步（取代 Shift） */
const DIR_KEYS = ['KeyW','ArrowUp','KeyS','ArrowDown','KeyA','ArrowLeft','KeyD','ArrowRight'];
const _lastDirPress = {};
let _doubleTapRun = false;
let _runKey = null;
addEventListener('pointerdown', e => {
  if (e.button === 0 && !anyPanel() && !isDigging()) doAction();
});

const camFwd = new THREE.Vector3();
const camRight = new THREE.Vector3();
function updateBasis() {
  camFwd.set(-Math.cos(ISO_AZ), 0, -Math.sin(ISO_AZ)).normalize();
  /* 相機的右向量 = (sin(az), 0, -cos(az))；原本寫成負號會讓 A/D 左右相反 */
  camRight.set(Math.sin(ISO_AZ), 0, -Math.cos(ISO_AZ)).normalize();
}
updateBasis();

/* ============================================================
   主迴圈
   ============================================================ */
const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();
let frameNo = 0;
let _fpsFrames = 0, _fpsLast = performance.now(), _fpsValue = 0;
let _lowFpsStreak = 0;
function autoDegrade() {
  try { renderer.setPixelRatio(1); } catch (e) {}
  renderer.shadowMap.enabled = false;
  console.log('[AUTO-DEGRADE] shadows off, pixelRatio 1');
}

function tick() {
  const dt = FREEZE ? 0 : (FIXED_DT || Math.min(0.05, clock.getDelta()));
  if (dt > 0) advanceTime(dt);
  musicPhase(phaseAt(dayT).key);
  if (dt > 0) {
    saveAcc += dt;
    if (saveAcc >= 10) { saveAcc = 0; saveGame(); }
  }
  const fainted = updateFaint(dt);
  if (dt > 0) updateSatiety(dt);
  if (dt > 0) updateBuffs(dt);

  if (hero) {
    let ix = 0, iz = 0;
    if (!fainted && !isDigging()) {
      if (keys['KeyW'] || keys['ArrowUp']) iz += 1;
      if (keys['KeyS'] || keys['ArrowDown']) iz -= 1;
      if (keys['KeyA'] || keys['ArrowLeft']) ix -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) ix += 1;
    }

    const moving = (ix !== 0 || iz !== 0);
    if (moving && (fish.state === 'waiting' || fish.state === 'biting')) endFishing('收竿。');
    const run = _doubleTapRun && !!_runKey && !!keys[_runKey];
    const speed = (run ? 7.2 : 4.2) * moveMul();

    if (moving) {
      tmp.set(0, 0, 0)
        .addScaledVector(camFwd, iz)
        .addScaledVector(camRight, ix)
        .normalize();
      const nx = heroPos.x + tmp.x * speed * dt;
      const nz = heroPos.z + tmp.z * speed * dt;
      if (walkableAt(nx, nz)) { heroPos.x = nx; heroPos.z = nz; }
      const targetYaw = Math.atan2(tmp.x, tmp.z);
      let d = targetYaw - heroYaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      heroYaw += d * Math.min(1, dt * 12);
    } else {
      _doubleTapRun = false;
      _runKey = null;
    }

    const _island = (typeof AREA === 'undefined' || AREA === 'island');
    const ground = _island ? Math.max(0.05, groundHeightAt(heroPos.x, heroPos.z)) : groundHeightAt(heroPos.x, heroPos.z);
    if (Math.abs(ground - heroPos.y) > 0.3) heroPos.y = ground;
    else heroPos.y += (ground - heroPos.y) * Math.min(1, dt * 20);
    hero.position.copy(heroPos);
    hero.rotation.y = heroYaw;

    if (mixer) {
      if (!isDigging()) {
        if (moving) { playAction(actWalk); if (actWalk) actWalk.timeScale = run ? 1.55 : 1.1; }
        else playAction(actIdle);
      }
      mixer.update(dt);
      applyRodPose(dt, fish.state !== 'idle' && fish.state !== 'escaped');
    }

    camTarget.lerp(tmp2.set(heroPos.x, heroPos.y + 1.3, heroPos.z), Math.min(1, dt * 6));
    fish.shake = Math.max(0, fish.shake - dt * (fish.shakeDecay || 2.4));
    placeCamera();
    if (typeof AREA === 'undefined' || AREA === 'island') {
      updateFishing(dt);
      updateFishJump(dt);
      updateFlies(dt);
    }
    updateSpots(dt);
    updateDig(dt);
    if (typeof updateTrap === 'function') updateTrap(dt);
    if (typeof updateMine === 'function') updateMine(dt);
    /* 草塊：只在角色 25 單位內顯示 */
    if (window.DBG_MERGED) {
      for (let i = 0; i < window.DBG_MERGED.length; i++) {
        const m = window.DBG_MERGED[i];
        if (m.userData && m.userData.dbgType === 'grass') {
          const dx = m.userData.cx - heroPos.x;
          const dz = m.userData.cz - heroPos.z;
          m.visible = (dx * dx + dz * dz) <= 25 * 25;
        }
      }
    }

    const dbg = document.getElementById('dbg');
    if (dbg) {
      if (SHOW_DBG) dbg.textContent =
        'pos ' + heroPos.x.toFixed(2) + ', ' + heroPos.y.toFixed(2) + ', ' + heroPos.z.toFixed(2) +
        '  ground ' + groundHeightAt(heroPos.x, heroPos.z).toFixed(2) +
        '  dt ' + dt.toFixed(3) + '  fish ' + fish.state + '  calls ' + renderer.info.render.calls;
      else dbg.style.display = 'none';
    }
  }

  renderer.shadowMap.needsUpdate = (frameNo++ % 2 === 0);
  renderer.render(scene, camera);
  _fpsFrames++;
  const _now = performance.now();
  if (_now - _fpsLast >= 1000) {
    _fpsValue = Math.round(_fpsFrames * 1000 / (_now - _fpsLast));
    _fpsFrames = 0;
    _fpsLast = _now;
    // console.log('[FPS]', _fpsValue);
    if (_fpsValue > 0 && _fpsValue < 30) { _lowFpsStreak++; if (_lowFpsStreak >= 3) autoDegrade(); }
    else _lowFpsStreak = 0;
  }
  const _st = document.getElementById('stats');
  if (_st && renderer) {
    const r = renderer.info.render;
    const m = renderer.info.memory;
    _st.textContent = 'FPS ' + _fpsValue +
      '\\nCalls ' + r.calls +
      '\\nTris ' + r.triangles +
      '\\nTex ' + m.textures +
      '\\nGeo ' + m.geometries;
  }
  requestAnimationFrame(tick);
}

function onResize() {
  const w = HOST.clientWidth, h = HOST.clientHeight;
  renderer.setSize(w, h, false);
  const aspect = w / Math.max(1, h);
  camera.top = VIEW_H / 2;
  camera.bottom = -VIEW_H / 2;
  camera.left = -VIEW_H * aspect / 2;
  camera.right = VIEW_H * aspect / 2;
  camera.updateProjectionMatrix();
}
addEventListener('resize', onResize);
onResize();
placeCamera();
requestAnimationFrame(tick);

/* 效能除錯面板 */
(function setupDebugPanel() {
  function init() {
    if (!window.__island || !window.__island.ready) { setTimeout(init, 500); return; }
    const renderer = window.__island.renderer;
    const scene = window.__island.scene;
    /* 收集可切換物件 */
    const trees = [], grasses = [];
    scene.traverse(o => {
      if (!o.isMesh) return;
      if (o.userData && o.userData.dbgType === 'tree') trees.push(o);
    });
    /* 樹木標記 */
    scene.traverse(o => {
      if (o.isMesh && !o.userData.dbgType) {
        /* 依據幾何/材質名稱粗分：樹木 mesh 通常含 trunk/leaf；這裡用位置/大小 heuristic 跳過 */
      }
    });
    const shadowChk = document.getElementById('dbgShadow');
    const normalChk = document.getElementById('dbgNormal');
    const treesChk = document.getElementById('dbgTrees');
    const grassChk = document.getElementById('dbgGrass');
    const prSel = document.getElementById('dbgPR');
    const topBtn = document.getElementById('dbgTop10');
    const topOut = document.getElementById('dbgTop10Out');

    if (shadowChk) shadowChk.addEventListener('change', () => {
      renderer.shadowMap.enabled = shadowChk.checked;
      /* sun castShadow */
      scene.traverse(o => { if (o.isLight && o.castShadow !== undefined) o.castShadow = shadowChk.checked; });
    });
    if (normalChk) normalChk.addEventListener('change', () => {
      scene.traverse(o => {
        if (o.isMesh && o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach(m => {
            if (m.normalMap !== undefined) {
              if (m._origNormal === undefined) m._origNormal = m.normalMap;
              m.normalMap = normalChk.checked ? m._origNormal : null;
              m.needsUpdate = true;
            }
          });
        }
      });
    });
    if (treesChk) treesChk.addEventListener('change', () => {
      if (window.DBG_TREES) window.DBG_TREES.forEach(o => { o.visible = treesChk.checked; });
      /* 也切換 8 棵可砍樹 */
      scene.traverse(o => { if (o.isMesh && o.userData && o.userData.dbgChopTree) o.visible = treesChk.checked; });
    });
    if (grassChk) grassChk.addEventListener('change', () => {
      if (window.DBG_MERGED) window.DBG_MERGED.forEach(o => { o.visible = grassChk.checked; });
    });
    if (prSel) prSel.addEventListener('change', () => {
      renderer.setPixelRatio(parseFloat(prSel.value));
    });
    if (topBtn) topBtn.addEventListener('click', () => {
      const list = [];
      scene.traverse(o => {
        if (o.isMesh && o.geometry) {
          const g = o.geometry;
          const tris = g.index ? g.index.count / 3 : (g.attributes.position ? g.attributes.position.count / 3 : 0);
          list.push({ name: o.name || (o.material && o.material.name) || 'mesh', tris: Math.round(tris) });
        }
      });
      list.sort((a, b) => b.tris - a.tris);
      const top = list.slice(0, 10);
      if (topOut) topOut.textContent = top.map((t, i) => (i + 1) + '. ' + t.name + ' — ' + t.tris + ' tris').join('\\n');
    });
  }
  setTimeout(init, 1000);
})();

window.__island = {
  get ready() { return ready3d; },
  heightAt, scene, camera, renderer, heroPos,
  fish, action: doAction,
  jump() { return { t: jumpT, vis: jumpFish.g.visible, pos: jumpFish.g.position.toArray() }; },
  time() { return { t: dayT, phase: phaseAt(dayT).key, day: dayIndex, night: isDark() }; },
  setTime(t) { dayT = Math.min(0.999, Math.max(0, t)); applyLight(dayT); updateDial(); },
  interact: interact,
  bag: inventory, store: storage,
  sellPrice: sellPrice, move: moveStack, sell: sellStack,
  items() {
    return {
      gold: gold, bait: bait,
      inv: Object.keys(inventory), sto: Object.keys(storage),
      spots: spots.filter(s => s.active).length,
      worms: wormSpots.filter(w => w.active).length
    };
  },
  merchant() {
    return { loaded: !!merchant, vis: merchant ? merchant.visible : null, here: merchantHere() };
  },
  spotPos(i) { const s = spots[i]; return s ? [s.x, s.z, s.name] : null; },
  wormPos(i) { const w = wormSpots[i]; return w ? [w.x, w.z] : null; },
  pickPos(i) { const p = pickSpots[i]; return p ? [p.x, p.z, p.kind, p.active] : null; },
  pickCount() { return pickSpots.length; },
  camp: () => [CAMP.x, CAMP.z],
  cook: (name) => { const r = RECIPES.find(x => x.n === name); cook(r); },
  cookNames() { return RECIPES.filter(canCook).map(r => r.n); },
  eat: (name) => eatDish(name),
  sat() { return satiety; },
  setSat(v) { satiety = Math.max(0, Math.min(100, v)); updateSatHud(); },
  faint: () => faintNow(),
  faintT: () => faintT,
  till: () => {},
  tilled: () => [],
  newDay() { dayIndex++; onNewDay(); },
  tools: () => Object.keys(TOOLS).map(k => [TOOLS[k].name, TOOLS[k].lv]),
  up: (k) => upgradeTool(k),
  upStore: () => upgradeStore(),
  storeSize: () => STORE_SIZE,
  buffs: () => Object.keys(buffs).map(k => [k, Math.round(buffs[k].left)]),
  eff: (n) => applyEffect(n),
  give(name, n) {
    const m = MAT[name];
    const fish = FISH_TABLE.find(f => f.name === name);
    for (let i = 0; i < (n || 1); i++) {
      if (fish) invAdd(fish, 20);
      else if (m) bagAdd(inventory, { name: name, price: m.price, ic: m.ic, color: m.color }, 0);
    }
  },
  save() { saveGame(); },
  muted: () => isMuted(),
  toggleMute: () => toggleMute(),
  rodPose: (x, y, z) => tuneRodPose(x, y, z),
  dig: () => startDig(),
  digT: () => trough.t,
  trough: () => [trough.x, trough.z, trough.r],
  audio: () => ({ on: musicOn, key: musicKey, mute: muted, ctx: actx ? actx.state : null, notes: musicNotes, gain: musicGain ? Number(musicGain.gain.value.toFixed(3)) : null }),
  load: () => loadGame(),
  clearSave: () => clearSave(),
  quests: () => Object.assign({}, quests),
  cabin: () => [CABIN.x, CABIN.z, CABIN.r],
  setPose(x, z, yaw) {
    heroPos.set(x, groundHeightAt(x, z), z);
    if (yaw !== undefined) heroYaw = yaw;
    if (hero) { hero.position.copy(heroPos); hero.rotation.y = heroYaw; }
  },
  teleport(x, z) { heroPos.set(x, groundHeightAt(x, z), z); },
  area() { return (typeof AREA !== 'undefined') ? AREA : 'island'; },
  enterCabin: () => { if (typeof enterCabin === 'function') enterCabin(); },
  exitCabin: () => { if (typeof exitCabin === 'function') exitCabin(); },
  enterMine: () => { if (typeof enterMine === 'function') enterMine(); },
  exitMine: () => { if (typeof exitMine === 'function') exitMine(); },
  diamond() { return diamond; },
  setDiamond(v) { diamond = Math.max(0, v | 0); if (typeof updateDiamondHud === 'function') updateDiamondHud(); if (typeof refreshPanels === 'function') refreshPanels(); },
  mineNodes() { return (typeof mineNodes !== 'undefined') ? mineNodes.map(n => [n.name, n.wx, n.wz, n.active]) : []; },
  mineState() { return (typeof mineSaveState === 'function') ? mineSaveState() : null; },
  special() { return (typeof special !== 'undefined') ? Object.assign({}, special) : null; },
  setSpecial(k, v) { if (typeof special !== 'undefined' && special[k] !== undefined) { special[k] = !!v; if (typeof reapplySpecialVisuals === 'function') reapplySpecialVisuals(); if (typeof refreshPanels === 'function') refreshPanels(); } }
};
