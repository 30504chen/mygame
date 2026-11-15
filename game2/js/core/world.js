/* world.js — 海島 3D Demo：island3d 的一部分 */
/* ============================================================
   地形
   ============================================================ */
const hash = (x, y) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

/* 不可穿越的方塊（小屋以外的立體物件，例如蚯蚓槽） */
const BLOCKERS = [];
/* 蚯蚓槽的位置：小屋前庭、門的左前方 */
const TROUGH_POS = { x: 4.0, z: 4.7 };
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}
function fbm(x, y) {
  let s = 0, amp = 0.5, f = 1;
  for (let i = 0; i < 4; i++) { s += vnoise(x * f, y * f) * amp; f *= 2.03; amp *= 0.5; }
  return s;
}
const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

const _heightCache = new Map();
function heightAt(x, z) {
  const kx = Math.round(x * 10), kz = Math.round(z * 10);
  const key = kx * 100000 + kz;
  const c = _heightCache.get(key);
  if (c !== undefined) return c;
  const t = Math.hypot(x, z) / R_ISLAND;
  const falloff = 1 - smoothstep(0.5, 1.0, t);
  let h = falloff * 3.0 - 0.6;
  h += (fbm(x * 0.085 + 11, z * 0.085 + 5) - 0.5) * 2.8 * falloff;
  h += Math.exp(-(((x + 7) ** 2) / 46 + ((z - 3) ** 2) / 40)) * 2.2;
  h -= Math.exp(-((x) ** 2) / 30 - ((z - 13) ** 2) / 22) * 0.5;
  _heightCache.set(key, h);
  if (_heightCache.size > 20000) _heightCache.clear();
  return h;
}

const C_SAND = new THREE.Color(0xf0dba6);
const C_SAND_WET = new THREE.Color(0xd9bd85);
const C_GRASS = new THREE.Color(0x6fae4a);
const C_GRASS_D = new THREE.Color(0x477f36);
const C_GRASS_L = new THREE.Color(0x9bd063);
const C_ROCK = new THREE.Color(0xa9a68f);
const C_DIRT = new THREE.Color(0xbf9668);

/* 碼頭 → 島內的泥土小徑 */
const PATH_PTS = [[0, 13.0], [0.6, 10.2], [-0.9, 7.4], [-1.2, 5.0], [0.6, 2.6], [3.4, 0.4]];

function distToPath(x, z) {
  let best = 1e9;
  for (let i = 0; i < PATH_PTS.length - 1; i++) {
    const ax = PATH_PTS[i][0], az = PATH_PTS[i][1];
    const bx = PATH_PTS[i + 1][0], bz = PATH_PTS[i + 1][1];
    const dx = bx - ax, dz = bz - az;
    const len2 = dx * dx + dz * dz;
    let t = ((x - ax) * dx + (z - az) * dz) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = ax + dx * t - x, pz = az + dz * t - z;
    best = Math.min(best, Math.hypot(px, pz));
  }
  return best;
}

function terrainColor(h, x, z, out) {
  const n = fbm(x * 0.35, z * 0.35);
  if (h < 0.04) out.copy(C_SAND_WET).lerp(C_SAND, smoothstep(-0.3, 0.04, h));
  else if (h < 0.38) out.copy(C_SAND);
  else {
    out.copy(C_GRASS).lerp(C_GRASS_L, n * 0.75);
    out.lerp(C_GRASS_D, smoothstep(0.6, 1.4, h) * 0.55);
    if (h > 3.4) out.lerp(C_ROCK, smoothstep(3.4, 4.4, h) * 0.6);
    out.lerp(C_SAND, 1 - smoothstep(0.38, 0.56, h));
    /* 小徑 */
    const dp = distToPath(x, z) + (fbm(x * 0.9, z * 0.9) - 0.5) * 0.35;
    if (dp < 1.05) out.lerp(C_DIRT, (1 - smoothstep(0.5, 1.05, dp)) * 0.8);
  }
  return out;
}

const tGeo = new THREE.PlaneGeometry(SIZE, SIZE, 75, 75);
tGeo.rotateX(-Math.PI / 2);
{
  const pos = tGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const col = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    terrainColor(h, x, z, col);
    col.convertSRGBToLinear();
    colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
  }
  tGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  tGeo.computeVertexNormals();
}
const terrain = new THREE.Mesh(tGeo, new THREE.MeshStandardMaterial({
  vertexColors: true, roughness: 0.98, metalness: 0.0
}));
terrain.receiveShadow = true;
scene.add(terrain);

/* 海水：依海底深度上色（淺灘→深海＋岸邊白沫） */
const waterMat = new THREE.MeshStandardMaterial({
  vertexColors: true, roughness: 0.08, metalness: 0.0,
  transparent: true, opacity: 0.96
});
const wGeo = new THREE.PlaneGeometry(90, 90, 30, 30);
wGeo.rotateX(-Math.PI / 2);
{
  const pos = wGeo.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const DEEP = new THREE.Color(0x0a5d90);
  const MID = new THREE.Color(0x1580b0);
  const SHALLOW = new THREE.Color(0x2f9cb6);
  const FOAM = new THREE.Color(0xdff4f6);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const depth = -heightAt(x, z);
    const n = fbm(x * 0.55 + 3, z * 0.55 + 7);
    let foam = (1 - smoothstep(0.015, 0.12, depth)) * (0.2 + 0.9 * n);
    foam = Math.min(1, foam) * 0.62;
    c.copy(SHALLOW).lerp(MID, smoothstep(0.3, 1.0, depth)).lerp(DEEP, smoothstep(1.0, 2.6, depth));
    c.lerp(FOAM, foam);
    c.convertSRGBToLinear();
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    pos.setY(i, 0);   /* 水面維持水平；深度只影響顏色 */
  }
  wGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
}
const water = new THREE.Mesh(wGeo, waterMat);
water.position.y = 0.04;
water.receiveShadow = false;   /* 水面不吃影子：黃昏低角度時樹影會在水上糊成大片 */
scene.add(water);

/* ============================================================
   碼頭
   ============================================================ */
const woodMat = new THREE.MeshStandardMaterial({ color: lin(0xa9784c), roughness: 0.85 });
const woodMat2 = new THREE.MeshStandardMaterial({ color: lin(0x7d5535), roughness: 0.9 });

function buildPier() {
  const g = new THREE.Group();
  const z0 = 12.6, z1 = 24.5, halfW = 1.7, deckY = 1.15;
  for (let z = z0; z < z1; z += 0.62) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2, 0.16, 0.52), woodMat);
    plank.position.set(0, deckY + Math.sin(z * 1.7) * 0.015, z);
    plank.rotation.y = Math.sin(z * 3.1) * 0.02;
    plank.castShadow = true; plank.receiveShadow = true;
    g.add(plank);
  }
  [-halfW + 0.15, halfW - 0.15].forEach(x => {
    for (let z = z0 + 0.4; z <= z1; z += 2.4) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.26, 3.6, 0.26), woodMat2);
      post.position.set(x, deckY - 1.7, z);
      post.castShadow = true;
      g.add(post);
    }
  });
  const barrelGeo = new THREE.CylinderGeometry(0.42, 0.36, 0.78, 14);
  const barrelMat = new THREE.MeshStandardMaterial({ color: lin(0xb4763f), roughness: 0.8 });
  [[-0.9, 21.6], [0.85, 22.4]].forEach(([x, z]) => {
    const b = new THREE.Mesh(barrelGeo, barrelMat);
    b.position.set(x, deckY + 0.47, z);
    b.castShadow = true; b.receiveShadow = true;
    g.add(b);
  });
  return g;
}
scene.add(buildPier());

/* ============================================================
   島中央的原木小屋（純場景，不能睡覺）
   ============================================================ */
const CABIN = { x: 5.8, z: -1.6, w: 5.2, d: 4.2, wallH: 2.5, r: 3.2 };

function buildCabin() {
  const g = new THREE.Group();
  const W = CABIN.w, D = CABIN.d, WH = CABIN.wallH;
  const cx = CABIN.x, cz = CABIN.z;

  let base = -99;
  [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2], [0, 0]].forEach(([dx, dz]) => {
    base = Math.max(base, heightAt(cx + dx, cz + dz));
  });
  base += 0.05;
  g.position.set(cx, base, cz);

  const stoneMat = new THREE.MeshStandardMaterial({ color: lin(0x9c988c), roughness: 0.96 });
  const logA = new THREE.MeshStandardMaterial({ color: lin(0x8a5e39), roughness: 0.9 });
  const logB = new THREE.MeshStandardMaterial({ color: lin(0x6d492b), roughness: 0.92 });
  const roofMat = new THREE.MeshStandardMaterial({ color: lin(0x4b3427), roughness: 0.9 });
  const doorMat = new THREE.MeshStandardMaterial({ color: lin(0x5b3c25), roughness: 0.85 });
  const frameMat = new THREE.MeshStandardMaterial({ color: lin(0xe6d7b8), roughness: 0.85 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: lin(0xbfe6f0), roughness: 0.2, emissive: lin(0x1f4c5a), emissiveIntensity: 0.4
  });

  /* 石基（比地面低，避免斜坡浮空） */
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, 1.6, D + 0.6), stoneMat);
  plinth.position.y = -0.72;
  plinth.castShadow = true; plinth.receiveShadow = true;
  g.add(plinth);

  /* 原木牆：6 層水平圓木 */
  const rows = 6, rad = 0.21, stepY = WH / rows;
  for (let i = 0; i < rows; i++) {
    const y = rad + i * stepY;
    [1, -1].forEach(s => {
      const front = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, W + 0.2, 10), i % 2 ? logA : logB);
      front.rotation.z = Math.PI / 2;
      front.position.set(0, y, s * D / 2);
      front.castShadow = true; front.receiveShadow = true;
      g.add(front);

      const side = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, D + 0.2, 10), i % 2 ? logB : logA);
      side.rotation.x = Math.PI / 2;
      side.position.set(s * W / 2, y + stepY / 2, 0);
      side.castShadow = true; side.receiveShadow = true;
      g.add(side);
    });
  }

  /* 角落立柱（讓接角有厚實感） */
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.31, WH + 0.55, 10), logB);
    c.position.set(sx * W / 2, (WH + 0.55) / 2, sz * D / 2);
    c.castShadow = true;
    g.add(c);
  });

  /* 閣樓三角（山牆） */
  const gableH = 1.5;
  const shp = new THREE.Shape();
  shp.moveTo(-D / 2, 0);
  shp.lineTo(D / 2, 0);
  shp.lineTo(0, gableH);
  shp.closePath();
  const attic = new THREE.Mesh(new THREE.ExtrudeGeometry(shp, { depth: W, bevelEnabled: false }), logB);
  attic.rotation.y = Math.PI / 2;
  attic.position.set(-W / 2, WH, 0);
  attic.castShadow = true; attic.receiveShadow = true;
  g.add(attic);

  /* 屋頂兩片斜面＋屋脊 */
  const eave = D / 2 + 0.55;
  const slope = Math.hypot(eave, gableH + 0.12);
  const th = Math.atan2(gableH + 0.12, eave);
  [1, -1].forEach(s => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(W + 1.1, 0.17, slope), roofMat);
    p.rotation.x = s * th;
    p.position.set(0, WH + (gableH + 0.16) / 2, s * eave / 2);
    p.castShadow = true; p.receiveShadow = true;
    g.add(p);
  });
  const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, W + 1.15, 8), roofMat);
  ridge.rotation.z = Math.PI / 2;
  ridge.position.y = WH + gableH + 0.14;
  ridge.castShadow = true;
  g.add(ridge);

  /* 門（朝 +z，面向小徑與出生點） */
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.0, 0.18), doorMat);
  door.position.set(0, 1.0, D / 2 + 0.31);
  door.castShadow = true;
  g.add(door);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6),
    new THREE.MeshStandardMaterial({ color: lin(0xd9b25a), roughness: 0.4, metalness: 0.3 }));
  knob.position.set(0.38, 1.0, D / 2 + 0.42);
  g.add(knob);

  /* 門兩側的窗 */
  [1, -1].forEach(s => {
    const fr = new THREE.Mesh(new THREE.BoxGeometry(1.16, 1.0, 0.1), frameMat);
    fr.position.set(s * 1.78, 1.62, D / 2 + 0.28);
    fr.castShadow = true;
    g.add(fr);
    const gl = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.72, 0.14), glassMat);
    gl.position.set(s * 1.78, 1.62, D / 2 + 0.34);
    g.add(gl);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.72, 0.16), frameMat);
    bar.position.set(s * 1.78, 1.62, D / 2 + 0.36);
    g.add(bar);
  });

  /* 門前石階 */
  const step = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.22, 0.9), stoneMat);
  step.position.set(0, -0.42, D / 2 + 0.72);
  step.castShadow = true; step.receiveShadow = true;
  g.add(step);

  /* 煙囪 */
  const chim = new THREE.Mesh(new THREE.BoxGeometry(0.72, 2.1, 0.72), stoneMat);
  chim.position.set(W / 2 - 1.1, WH + 0.95, -D / 4);
  chim.castShadow = true; chim.receiveShadow = true;
  g.add(chim);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.16, 0.92), stoneMat);
  cap.position.set(W / 2 - 1.1, WH + 2.05, -D / 4);
  g.add(cap);

  return g;
}
scene.add(buildCabin());

