/* hero.js — 海島 3D Demo：island3d 的一部分 */
/* ============================================================
   角色
   ============================================================ */
let hero = null, heroRoot = null, mixer = null, actWalk = null, actIdle = null, actDig = null, current = null;

/* 持竿姿勢：把右上臂從 A-pose 抬到胸前（KayKit 骨頭名：upperarmr / lowerarmr / handr） */
const ROD_POSE = { x: -0.2, y: -0.1, z: 0.6 };
const armRest = new THREE.Quaternion(), armTarget = new THREE.Quaternion();
const foreRest = new THREE.Quaternion(), foreTarget = new THREE.Quaternion();
const _qTmp = new THREE.Quaternion(), _eTmp = new THREE.Euler();

function tuneRodPose(x, y, z) {
  ROD_POSE.x = x; ROD_POSE.y = y; ROD_POSE.z = z;
  if (armBone) armTarget.copy(armRest).multiply(_qTmp.setFromEuler(_eTmp.set(x, y, z)));
}

/* 釣魚時把 blend 拉到 1、收竿後回到 0，讓動畫與姿勢互換 */
function applyRodPose(dt, on) {
  const k = Math.min(1, dt * 7);
  rodBlend += ((on ? 1 : 0) - rodBlend) * k;
  if (rodBlend < 0.004) rodBlend = 0;
  if (!rodBlend || !armBone) return;
  armBone.quaternion.copy(armRest).slerp(armTarget, rodBlend);
  if (foreBone) foreBone.quaternion.copy(foreRest).slerp(foreTarget, rodBlend);
}
const heroPos = new THREE.Vector3(0, 0, 6);
let heroYaw = Math.PI * 0.25;
let ready3d = false;

const FIXED_DT = (function () {
  const v = parseFloat(new URLSearchParams(location.search).get('fixdt'));
  return (v > 0 && v < 0.2) ? v : 0;
})();
const SHOW_DBG = new URLSearchParams(location.search).has('dbg');
const POSE = (function () {
  const v = new URLSearchParams(location.search).get('pose');
  if (!v) return null;
  const a = v.split(',').map(Number);
  return a.length >= 2 ? { x: a[0], z: a[1], yaw: a.length > 2 ? a[2] : 0 } : null;
})();
const FORCE_WAIT = parseFloat(new URLSearchParams(location.search).get('wait')) || 0;
const DEMO_STATE = new URLSearchParams(location.search).get('demo');
const FREEZE = new URLSearchParams(location.search).has('freeze');

const clock = new THREE.Clock();
const keys = {};
if (location.hash === '#walk') keys['KeyW'] = true;

function playAction(a, fade) {
  if (!a || current === a) return;
  const f = (fade === undefined) ? 0.22 : fade;
  a.reset();
  if (f > 0) a.fadeIn(f);
  a.play();
  if (current) { if (f > 0) current.fadeOut(f); else current.stop(); }
  current = a;
}

function hideLoader() {
  const el = document.getElementById('load');
  if (el) { el.style.display = 'none'; el.textContent = ''; }
}

function loadAnimations() {
  loader.load('./assets/Rig_Medium_General.glb', gg => {
    loader.load('./assets/Rig_Medium_MovementBasic.glb', gm => {
      const onlyRot = clip => {
        const c = clip.clone();
        c.tracks = c.tracks.filter(t => t.name.endsWith('.quaternion'));
        return c;
      };
      const clips = [...gg.animations, ...gm.animations];
      const idle = clips.find(c => c.name === 'Idle_A');
      const walk = clips.find(c => c.name === 'Walking_A');
      const dig = clips.find(c => c.name === 'PickUp');
      if (hero && idle && walk) {
        mixer = new THREE.AnimationMixer(heroRoot || hero);
        actIdle = mixer.clipAction(onlyRot(idle));
        actWalk = mixer.clipAction(onlyRot(walk));
        if (dig) {
          actDig = mixer.clipAction(onlyRot(dig));
          actDig.setLoop(THREE.LoopOnce, 1);
          actDig.clampWhenFinished = true;
        }
        playAction(actIdle, 0);
      }
    });
  });
}

loader.load('./assets/Rogue.glb', gltf => {
  const inner = gltf.scene;
  const box = new THREE.Box3().setFromObject(inner);
  inner.scale.setScalar(1.75 / Math.max(0.001, box.max.y - box.min.y));
  inner.updateMatrixWorld(true);
  const gb = new THREE.Box3().setFromObject(inner);
  inner.position.y = -gb.min.y;

  inner.traverse(o => {
    if (o.isMesh) {
      o.castShadow = false;
      o.receiveShadow = true;
      if (o.material) { o.material.metalness = 0.0; o.material.roughness = 0.8; }
    }
  });

  hero = new THREE.Group();
  hero.add(inner);
  hero.position.copy(heroPos);
  hero.rotation.y = heroYaw;
  scene.add(hero);
  heroRoot = inner;
  handBone = inner.getObjectByName('handr') || inner.getObjectByName('hand.r')
          || inner.getObjectByName('handslotr') || null;
  armBone = inner.getObjectByName('upperarmr') || null;
  foreBone = inner.getObjectByName('lowerarmr') || null;
  if (armBone) {
    armRest.copy(armBone.quaternion);
    armTarget.copy(armRest).multiply(_qTmp.setFromEuler(_eTmp.set(ROD_POSE.x, ROD_POSE.y, ROD_POSE.z)));
  }
  if (foreBone) { foreRest.copy(foreBone.quaternion); foreTarget.copy(foreRest); }
  if (POSE) {
    heroPos.set(POSE.x, groundHeightAt(POSE.x, POSE.z), POSE.z);
    heroYaw = POSE.yaw;
    camTarget.set(heroPos.x, heroPos.y + 1.3, heroPos.z);
    placeCamera();
  }
  heroPos.y = Math.max(0.05, groundHeightAt(heroPos.x, heroPos.z));
  hero.position.copy(heroPos);
  if (!new URLSearchParams(location.search).has('noanim')) loadAnimations();

  let pending = SPECIES.length;
  const done = () => {
    if (--pending === 0) {
      flushMerged();
      ready3d = true;
      loadGame();
      hideLoader();
      if (DEMO_STATE) {
        if (DEMO_STATE === 'inv' || DEMO_STATE === 'dex' || DEMO_STATE === 'shop') {
          [['沙丁魚', 18], ['沙丁魚', 16], ['黑鯛', 38], ['石斑', 62],
           ['竹筴魚', 22], ['紅甘', 118], ['花身雞魚', 21]].forEach(([n, sz]) => {
            const f = FISH_TABLE.find(x => x.name === n);
            if (f) invAdd(f, sz);
          });
          [['白蝦', 2], ['蛤蜊', 3], ['魷魚', 1]].forEach(([n, c]) => {
            const s = SEAFOOD.find(x => x.name === n);
            for (let i = 0; i < c; i++) bagAdd(inventory, s, 0);
          });
          gold = 240;
          if (DEMO_STATE === 'inv') toggleInv();
          else if (DEMO_STATE === 'dex') toggleDex();
          else toggleShop();
          return;
        }
        if (DEMO_STATE === 'cook' || DEMO_STATE === 'upgrade') {
          [['沙丁魚', 2], ['蛤蜊', 2], ['白蝦', 2], ['魷魚', 1]].forEach(([n, c]) => {
            const f = FISH_TABLE.find(x => x.name === n);
            const s = SEAFOOD.find(x => x.name === n);
            for (let i = 0; i < c; i++) {
              if (f) invAdd(f, 24);
              else if (s) bagAdd(inventory, s, 0);
            }
          });
          const mats = DEMO_STATE === 'upgrade'
            ? [['樹枝', 14], ['野莓', 3], ['椰子', 2], ['夜光菇', 1], ['發光貝殼', 6], ['木材', 14]]
            : [['樹枝', 6], ['野莓', 3], ['椰子', 2], ['夜光菇', 1], ['發光貝殼', 1], ['木材', 2]];
          mats.forEach(([n, c]) => {
            const m = MAT[n];
            for (let i = 0; i < c; i++) bagAdd(inventory, { name: n, price: m.price, ic: m.ic, color: m.color }, 0);
          });
          satiety = 62;
          updateSatHud();
          toggleCook();
          if (DEMO_STATE === 'upgrade') {
            applyEffect('全效果');
            setTimeout(() => {
              const b = document.querySelector('#panel-cook .pbody');
              if (b) b.scrollTop = b.scrollHeight;
            }, 400);
          }
          return;
        }
        if (DEMO_STATE === 'faint') {
          satiety = 0;
          updateSatHud();
          faintNow();
          return;
        }
        doAction();
        if (DEMO_STATE === 'waiting' || DEMO_STATE === 'biting') {
          fish.state = DEMO_STATE;
          fish.t = 0;
          fish.wait = 999;
          bobber.position.set(fish.bobberPos.x, DEMO_STATE === 'biting' ? -0.1 : 0.1, fish.bobberPos.z);
          if (DEMO_STATE === 'biting') {
            shakeScreen(4, 0.35);
            elBang.classList.add('on');
            setPrompt('現在！點一下拉竿', 'alert');
          } else {
            setPrompt('等待魚咬餌…', '');
          }
        } else if (DEMO_STATE === 'caught') {          bobber.position.set(fish.bobberPos.x, 0.1, fish.bobberPos.z);
          fish.state = 'biting';
          doAction();
          if (jumpT === 0) jumpT = 0.42;
          updateFishJump(0);
        }
      } else if (location.hash.indexOf('cast') >= 0) {
        doAction();
      }
    }
  };
  SPECIES.forEach(sp => {
    loader.load('./assets/nature/' + sp.file + '.gltf', g => {
      normalizeToHeight(g.scene, sp.target);
      scatter(sp, g.scene);
      done();
    }, undefined, err => {
      console.warn('load fail', sp.file, err);
      done();
    });
  });
}, undefined, err => {
  console.error('hero load fail', err);
  const el = document.getElementById('load');
  if (el) el.textContent = '角色模型載入失敗';
});

/* 流浪商人（每 3 天來訪一次，白天到黃昏待在碼頭口） */
let merchant = null, merchantMixer = null;
loader.load('./assets/Mage.glb', gltf => {
  const inner = gltf.scene;
  const box = new THREE.Box3().setFromObject(inner);
  inner.scale.setScalar(1.75 / Math.max(0.001, box.max.y - box.min.y));
  inner.updateMatrixWorld(true);
  const gb = new THREE.Box3().setFromObject(inner);
  inner.position.y = -gb.min.y;
  inner.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      if (o.material) { o.material.metalness = 0.0; o.material.roughness = 0.8; }
    }
  });
  merchant = new THREE.Group();
  merchant.add(inner);
  merchant.position.set(3.1, groundHeightAt(3.1, 11.2), 11.2);
  merchant.rotation.y = -2.1;
  merchant.visible = false;
  scene.add(merchant);

  if (gltf.animations && gltf.animations.length) {
    merchantMixer = new THREE.AnimationMixer(inner);
    const clip = gltf.animations.find(a => /Idle/i.test(a.name)) || gltf.animations[0];
    merchantMixer.clipAction(clip).play();
  }
}, undefined, err => console.warn('merchant load fail', err));

/* 可砍的樹：同一個模型複製 8 棵 */
loader.load('./assets/nature/CommonTree_1.gltf', g => {
  normalizeToHeight(g.scene, 5.2);
  buildChopTrees(g.scene);
}, undefined, err => console.warn('tree proto load fail', err));

