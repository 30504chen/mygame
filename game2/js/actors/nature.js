/* nature.js — 海島 3D Demo：island3d 的一部分 */
/* ============================================================
   自然素材
   ============================================================ */
const loader = new THREE.GLTFLoader();
const SPECIES = [
  { file: 'CommonTree_1',        target: 5.4,  n: 3,  minH: 1.2,  avoid: 6.5, grove: true },
  { file: 'CommonTree_3',        target: 4.2,  n: 2,  minH: 1.0,  avoid: 6.5, grove: true },
  { file: 'Grass_Common_Tall',   target: 0.65, n: 30, minH: 0.4,  avoid: 0 },
  { file: 'Grass_Wispy_Tall',    target: 0.55, n: 20, minH: 0.4,  avoid: 0 },
  { file: 'Flower_3_Group',      target: 0.6,  n: 10, minH: 0.45, avoid: 0 },
  { file: 'Flower_4_Group',      target: 0.6,  n: 8,  minH: 0.45, avoid: 0 },
  { file: 'Mushroom_Common',     target: 0.45, n: 2,  minH: 0.9,  avoid: 0 },
  { file: 'Rock_Medium_1',       target: 1.7,  n: 4,  minH: 0.3,  avoid: 0 },
  { file: 'Rock_Medium_3',       target: 1.3,  n: 4,  minH: 0.3,  avoid: 0 }
];

/* 以物種檔名當種子的亂數：不管 GLB 誰先載完，每次開島的植栽位置都一樣 */
function mkRng(seedStr) {
  let s = 2166136261;
  for (let i = 0; i < seedStr.length; i++) { s ^= seedStr.charCodeAt(i); s = Math.imul(s, 16777619) >>> 0; }
  return function () {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const rnd = (R, a, b) => a + R() * (b - a);

function normalizeToHeight(obj, target) {
  const box = new THREE.Box3().setFromObject(obj);
  const h = box.max.y - box.min.y;
  obj.scale.setScalar(target / Math.max(0.001, h));
  const box2 = new THREE.Box3().setFromObject(obj);
  obj.position.y = -box2.min.y;
}

const GROVES = [[-8, -7], [7, -8], [-10, 5], [10, 6], [1, 9]];
const ROCK_COLLIDERS = [];
const CHOP_TREE_POSITIONS = [];
const DBG_TREES = [];
const DBG_MERGED = [];

function scatter(sp, template) {
  const R = mkRng('island3d:' + sp.file);
  let placed = 0, tries = 0;
  while (placed < sp.n && tries < sp.n * 80) {
    tries++;
    let x, z;
    if (sp.grove) {
      const g = GROVES[Math.floor(R() * GROVES.length)];
      x = g[0] + (R() - 0.5) * 10;
      z = g[1] + (R() - 0.5) * 10;
    } else {
      const a = R() * Math.PI * 2;
      const r = Math.sqrt(R()) * (R_ISLAND * 0.94);
      x = Math.cos(a) * r; z = Math.sin(a) * r;
    }
    const h = heightAt(x, z);
    if (h < sp.minH) continue;
    if (distToPath(x, z) < (sp.grove ? 2.4 : 1.7)) continue;
    if (Math.hypot(x, z - 14) < 5.0) continue;
    if (Math.hypot(x, z - 6) < 3.4) continue;
    if (sp.avoid && Math.hypot(x, z - 6) < sp.avoid) continue;
    /* 小屋前庭留空（大樹 8.4、小東西 3.9），讓蚯蚓槽與門前保持通透 */
    if (Math.hypot(x - CABIN.x, z - CABIN.z) < (sp.avoid ? 8.4 : 3.9)) continue;
    /* 蚯蚓槽周圍也要留空 */
    if (Math.hypot(x - TROUGH_POS.x, z - TROUGH_POS.z) < (sp.avoid ? 5.0 : 2.3)) continue;
    /* 石頭不生成在小屋前方空地（門前廣場） */
    if (sp.file.indexOf('Rock') === 0 && x > CABIN.x - 5 && x < CABIN.x + 5 && z > CABIN.z - 0.5 && z < CABIN.z + 6) continue;

    const o = template.clone(true);
    o.position.set(x, h + 0.02, z);
    o.rotation.y = R() * Math.PI * 2;
    o.scale.multiplyScalar(sp.grove ? rnd(R, 0.85, 1.35) : rnd(R, 0.8, 1.2));
    const isTree = sp.file.indexOf('CommonTree') === 0;
    o.traverse(m => {
      if (m.isMesh) {
        /* 散布樹木不投射陰影，降低 draw cost */
        m.castShadow = isTree ? false : !!sp.avoid;
        m.receiveShadow = true;
      }
    });
    if (isTree) {
      /* 樹木獨立成可砍伐物件，不併入合併 mesh */
      if (typeof registerPick === 'function') {
        registerPick({
          kind: 'tree', x: x, z: z, r: 3.0, label: '按 E 砍樹',
          group: o, baseY: h + 0.02, dawnRespawn: true,
          tile: (typeof tileKey === 'function') ? tileKey(x, z) : null
        });
      } else {
        scene.add(o);
      }
      DBG_TREES.push(o);
    } else {
      const _type = sp.file.indexOf('Grass') === 0 ? 'grass' :
                    sp.file.indexOf('Flower') === 0 ? 'flower' :
                    sp.file.indexOf('Rock') === 0 ? 'rock' :
                    sp.file.indexOf('Mushroom') === 0 ? 'mushroom' : 'other';
      collectMerged(o, !!sp.avoid, _type);
    }
    if (sp.file.indexOf('Rock') === 0) {
      ROCK_COLLIDERS.push({ x: x, z: z, r: sp.target * 0.55 });
    }
    placed++;
  }
}

/* ============================================================
   靜態素材合併：把兩百多個散布物件併成少量 mesh（大幅減少 draw call）
   ============================================================ */
const mergeBatches = new Map();

function collectMerged(root, cast, type) {
  root.updateMatrixWorld(true);
  root.traverse(m => {
    if (!m.isMesh || !m.material || Array.isArray(m.material)) return;
    /* 空間分塊：約 10x10 單位一塊，讓視錐剔除生效 */
    const wp = new THREE.Vector3();
    m.getWorldPosition(wp);
    const cellX = Math.floor(wp.x / 10);
    const cellZ = Math.floor(wp.z / 10);
    const cell = cellX + '_' + cellZ;
    const key = m.material.uuid + '|' + (cast ? 1 : 0) + '|' + cell;
    let b = mergeBatches.get(key);
    if (!b) { b = { mat: m.material, cast, cell, type: type || 'other', list: [], roots: [], cx: (cellX + 0.5) * 10, cz: (cellZ + 0.5) * 10 }; mergeBatches.set(key, b); }
    b.list.push({ geo: m.geometry, mw: m.matrixWorld.clone() });
    b.roots.push(root);
  });
}

function mergeGeos(list) {
  const geos = list.map(({ geo, mw }) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(mw);
    return g;
  });
  const keys = Object.keys(geos[0].attributes);
  /* COLOR_0 等屬性可能是 Uint8/Uint16（normalized），要保留型別與 normalized 旗標 */
  const use = keys.filter(k => {
    const a0 = geos[0].attributes[k];
    return geos.every(g => {
      const a = g.attributes[k];
      return a && a.itemSize === a0.itemSize && a.array.constructor === a0.array.constructor;
    });
  });
  const total = geos.reduce((s, g) => s + g.attributes.position.count, 0);
  const out = new THREE.BufferGeometry();
  use.forEach(k => {
    const a0 = geos[0].attributes[k];
    const arr = new a0.array.constructor(total * a0.itemSize);
    let off = 0;
    geos.forEach(g => { arr.set(g.attributes[k].array, off); off += g.attributes[k].array.length; });
    out.setAttribute(k, new THREE.BufferAttribute(arr, a0.itemSize, a0.normalized));
  });
  out.computeBoundingSphere();
  return out;
}

function flushMerged() {
  let batches = 0, objects = 0;
  mergeBatches.forEach(b => {
    try {
      const geo = mergeGeos(b.list);
      const mesh = new THREE.Mesh(geo, b.mat);
      mesh.castShadow = b.cast;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      mesh.userData.dbgType = b.type;
       mesh.userData.cell = b.cell;
       mesh.userData.cx = b.cx;
       mesh.userData.cz = b.cz;
       scene.add(mesh); DBG_MERGED.push(mesh);
      batches++;
      objects += b.list.length;
    } catch (e) {
      /* 合併失敗就退回原本的物件 */
      b.roots.forEach(r => { if (!r.parent) scene.add(r); });
      console.warn('merge fallback', e);
    }
  });
  mergeBatches.clear();
  return { batches, objects };
}

