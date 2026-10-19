// 截圖頁：依 ?view= 參數擺放相機（side / top / front34 / bottom / track）
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { buildCarModel, buildTrackModel } from '../src/model.js';
import { buildCircuit } from '../src/track.js';

/**
 * 棚拍環境（取代 RoomEnvironment：它的多個小燈箱在車漆上反射成斑駁亮點）
 * 上亮下暗的漸層球＋頂部與側面兩塊大柔光箱，反射成平順的長條高光
 */
function buildStudioEnvironment() {
  const env = new THREE.Scene();
  const sky = new THREE.SphereGeometry(100, 48, 24);
  const col = [];
  const p = sky.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const h = p.getY(i) / 100;
    const v = h > 0 ? 0.22 + 0.25 * h : 0.22 + 0.16 * h;
    col.push(v * 0.95, v * 0.97, v);
  }
  sky.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  env.add(new THREE.Mesh(sky, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const box = (w, h, pos, look, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(...look);
    env.add(m);
  };
  box(120, 50, [0, 80, 0], [0, 0, 0], 3.0);
  box(80, 30, [70, 30, -60], [0, 0, 0], 2.0);
  box(60, 30, [-80, 20, 40], [0, 0, 0], 0.8);
  // iter-10：後側柔光箱（rear34 相機的鏡射方向，仰角約 24°，距離 90 須在半徑 100 的天空球內）——原本 rear34 的後甲板只反射到暗的天空漸層，
  // 只剩底漆層的寬高光，讀起來像半光澤；加這片讓清漆層在後甲板／後葉子板出現邊緣清楚的燈箱倒影
  box(45, 16, [65, 36, 51], [0, 0, 0], 2.2);
  return env;
}

/** 車底接觸陰影（徑向漸層貼圖的平面，模擬 AO） */
function buildContactShadow() {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 256;
  const ctx = cv.getContext('2d');
  const grd = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
  grd.addColorStop(0, 'rgba(0,0,0,0.8)');
  grd.addColorStop(0.55, 'rgba(0,0,0,0.45)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(cv);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(165, 95), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.05;
  return m;
}

/**
 * 深灰檯面（iter-07）：中央略亮、往外變暗的徑向漸層（模擬參考照的頂光落差），
 * 半霧面（roughness 0.5）讓棚拍柔光箱在檯面上反射成柔和光暈
 * @param {number} size 檯面邊長（mm）
 */
function buildTabletop(size) {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 512;
  const ctx = cv.getContext('2d');
  const grd = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
  grd.addColorStop(0, '#2a2b2e');
  grd.addColorStop(0.35, '#222326');
  grd.addColorStop(1, '#18191b');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 512, 512);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.5, metalness: 0.0, clearcoat: 0.3, clearcoatRoughness: 0.4, envMapIntensity: 0.35 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  return m;
}

const params = new URLSearchParams(location.search);
const view = params.get('view') ?? 'front34';
const width = 1600;
const height = 900;

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
// iter-07：2× 超取樣（內部 3200×1800 算圖，畫布以 CSS 1600×900 顯示，截圖時由瀏覽器縮小 → 降低鋸齒與 AO/陰影雜訊）
const SUPERSAMPLE = 2;
renderer.setPixelRatio(SUPERSAMPLE);
renderer.setSize(width, height);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
// iter-07：深灰檯面（ref_chevalier-ma_side-high / rear34 / wheel-detail 都是深灰檯面、上方柔光）
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const BG_COLOR = 0x4a4c50;
scene.background = new THREE.Color(BG_COLOR);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(buildStudioEnvironment(), 0.03).texture;

scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f99, 0.35));
const sun = new THREE.DirectionalLight(0xffffff, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.bias = -0.0005;
// iter-07：陰影邊緣柔化（PCF 取樣半徑，2× 超取樣後雜訊被平均）
sun.shadow.radius = 3;
scene.add(sun);
scene.add(sun.target);

const car = buildCarModel();
scene.add(car);

const camera = new THREE.PerspectiveCamera(20, width / height, 1, 50000);

/** @type {(r: number) => void} 設定陰影投射範圍 */
const setShadowBox = (r) => {
  const cam = sun.shadow.camera;
  cam.left = -r;
  cam.right = r;
  cam.top = r;
  cam.bottom = -r;
  cam.near = 1;
  cam.far = r * 8;
  cam.updateProjectionMatrix();
};

if (view === 'track') {
  const track = buildCircuit();
  scene.add(buildTrackModel(track));
  // 車子放在第一個彎道中段、中間車道
  const s = 2.35;
  const p = track.path.point(s, 0);
  car.position.set(p.x * 1000, 0.2, p.z * 1000);
  car.rotation.y = -p.theta;
  const ground = buildTabletop(8000);
  ground.position.set(car.position.x, -0.5, car.position.z);
  scene.add(ground);
  scene.fog = new THREE.Fog(BG_COLOR, 3000, 4500);
  const target = new THREE.Vector3(car.position.x, 20, car.position.z);
  const pose = track.path.pose(s);
  const back = new THREE.Vector3(-Math.cos(pose.theta), 0, -Math.sin(pose.theta));
  const side = new THREE.Vector3(Math.sin(pose.theta), 0, -Math.cos(pose.theta));
  camera.position.copy(target).addScaledVector(back, 650).addScaledVector(side, 700).add(new THREE.Vector3(0, 800, 0));
  camera.fov = 30;
  camera.lookAt(target);
  sun.position.set(target.x + 600, 1500, target.z + 400);
  sun.target.position.copy(target);
  setShadowBox(900);
  // iter-09：塑膠光澤補光（0.3，弱）：放在相機對面、相對垂直軸鏡射的方向，
  // 讓路面在車子附近出現一片柔和的鏡面反光（半光澤 ABS 的特徵），主光與投影方向不變
  const glint = new THREE.DirectionalLight(0xffffff, 0.3);
  const camOff = camera.position.clone().sub(target);
  glint.position.set(target.x - camOff.x, target.y + camOff.y, target.z - camOff.z);
  glint.target.position.copy(target);
  // 補光也投影：否則車底下的路面仍有鏡面反光，車子看起來浮在路面上
  glint.castShadow = true;
  glint.shadow.mapSize.set(4096, 4096);
  glint.shadow.bias = -0.0005;
  glint.shadow.radius = 3;
  for (const k of ['left', 'bottom']) {
    glint.shadow.camera[k] = -400;
  }
  for (const k of ['right', 'top']) {
    glint.shadow.camera[k] = 400;
  }
  glint.shadow.camera.near = 1;
  glint.shadow.camera.far = 6000;
  scene.add(glint);
  scene.add(glint.target);
} else {
  // 單車棚拍：淺色地面接收陰影
  const ground = buildTabletop(8000);
  if (view !== 'bottom') {
    scene.fog = new THREE.Fog(BG_COLOR, 480, 1900);
    scene.add(ground);
    scene.add(buildContactShadow());
  }
  const center = new THREE.Vector3(0, view === 'side' ? 18 : 12, 0);
  if (view === 'side') {
    camera.position.set(0, 18, -410);
  } else if (view === 'top') {
    camera.position.set(0, 400, 0.01);
    camera.up.set(0, 0, -1);
  } else if (view === 'bottom') {
    camera.position.set(-60, -330, -210);
    camera.up.set(0, 1, 0);
  } else if (view === 'rear') {
    // 正後方（檢查用）
    camera.position.set(-420, 60, 0.01);
  } else if (view === 'rear34') {
    // 後 3/4 視角（對照 ref_chevalier-ma_rear34：尾燈、車尾、後保桿與上層導輪架）
    camera.position.set(-270, 150, -215);
  } else {
    camera.position.set(250, 135, -235);
  }
  camera.lookAt(center);
  sun.position.set(-180, 520, 260);
  sun.target.position.set(0, 0, 0);
  setShadowBox(220);
  if (view === 'bottom') {
    const fill = new THREE.DirectionalLight(0xffffff, 2.6);
    fill.position.set(-100, -500, -300);
    scene.add(fill);
  }
}

// iter-07：後處理——GTAO 環境光遮蔽（車底、輪拱內、零件交界變暗）→ OutputPass（色調映射＋sRGB）
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(width * SUPERSAMPLE, height * SUPERSAMPLE, { type: THREE.HalfFloatType, samples: 4 }));
composer.setPixelRatio(SUPERSAMPLE);
composer.setSize(width, height);
composer.addPass(new RenderPass(scene, camera));
const gtao = new GTAOPass(scene, camera, width * SUPERSAMPLE, height * SUPERSAMPLE);
// 單位 mm：遮蔽半徑 7 mm（約輪胎半徑的一半），厚度 3 mm
gtao.updateGtaoMaterial({ radius: view === 'track' ? 20 : 10, distanceExponent: 1, thickness: 12, scale: 3, samples: 64, distanceFallOff: 0.5 });
gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 10, rings: 3, samples: 24 });
// 底面視角：齒輪窗內若完全遮蔽會看不清齒輪 → 降低 AO 強度
gtao.blendIntensity = view === 'bottom' ? 0.55 : 1.0;
if (params.get('ao') === '1') {
  // 除錯用：只輸出 AO
  gtao.output = GTAOPass.OUTPUT.Denoise;
}
composer.addPass(gtao);
composer.addPass(new OutputPass());
composer.render();
window.__ready = true;
