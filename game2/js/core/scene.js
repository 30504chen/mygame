/* scene.js — 海島 3D Demo：island3d 的一部分 */
/* ============================================================
   基本設定
   ============================================================ */
const HOST = document.getElementById('scene');
const R_ISLAND = 19;
const SIZE = 46;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
const LOW_Q = new URLSearchParams(location.search).has('low');
renderer.setPixelRatio(LOW_Q ? 1 : Math.min(1.5, window.devicePixelRatio || 1));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = LOW_Q ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
/* 影子每 2 幀才重算（見 main.js），靜態場景省一半 shadow pass */
renderer.shadowMap.autoUpdate = false;
HOST.appendChild(renderer.domElement);

const lin = hex => new THREE.Color(hex).convertSRGBToLinear();

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xd8eef8, 150, 265);

/* 等角正交相機 */
const VIEW_H = (function () {
  const p = new URLSearchParams(location.search).get('vh');
  const v = p ? parseFloat(p) : 17;
  return (v && v > 2) ? v : 17;
})();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);
const ISO_AZ = Math.PI / 4;
const ISO_EL = Math.atan(1 / Math.SQRT2);
const CAM_DIST = 90;
const camTarget = new THREE.Vector3(0, 1.4, 4);

function placeCamera() {
  const sh = (typeof fish !== 'undefined' && fish) ? fish.shake : 0;
  const ox = sh ? (Math.random() - 0.5) * sh : 0;
  const oy = sh ? (Math.random() - 0.5) * sh : 0;
  camera.position.set(
    camTarget.x + CAM_DIST * Math.cos(ISO_EL) * Math.cos(ISO_AZ) + ox,
    camTarget.y + CAM_DIST * Math.sin(ISO_EL) + oy,
    camTarget.z + CAM_DIST * Math.cos(ISO_EL) * Math.sin(ISO_AZ)
  );
  camera.lookAt(camTarget);
}

/* ============================================================
   光線
   ============================================================ */
const hemi = new THREE.HemisphereLight(0xd8ecff, 0x8a9a5e, 0.52);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffe9c2, 1.42);
sun.position.set(20, 30, 14);
sun.castShadow = true;
sun.shadow.mapSize.set(LOW_Q ? 512 : 1024, LOW_Q ? 512 : 1024);
const sc = sun.shadow.camera;
sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 90;
sc.updateProjectionMatrix();
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.02;
scene.add(sun);

const bounce = new THREE.DirectionalLight(0xa8d8ff, 0.22);
bounce.position.set(-16, 8, -12);
scene.add(bounce);

