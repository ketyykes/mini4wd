// 換件頁的 3D 場景：棚拍光、檯面、OrbitControls、車輛模型替換、賽道模式的跟車相機
// 單位 mm（與 src/model.js 相同，y 向上、車頭朝 +x）；物理模擬的 m 由呼叫端換算
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildTrackModel } from '../src/model.js';

const BG_COLOR = 0x2a2c31;

/**
 * 棚拍環境（同 web/main.js 的作法）：上亮下暗漸層球＋大柔光箱，讓車漆反射成平順長條高光
 * @type {() => THREE.Scene}
 */
const buildStudioEnvironment = () => {
  const env = new THREE.Scene();
  const sky = new THREE.SphereGeometry(100, 48, 24);
  /** @type {number[]} */
  const col = [];
  const p = sky.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const h = p.getY(i) / 100;
    let v = 0.22 + 0.16 * h;
    if (h > 0) {
      v = 0.22 + 0.25 * h;
    }
    col.push(v * 0.95, v * 0.97, v);
  }
  sky.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  env.add(new THREE.Mesh(sky, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  /** @type {(w: number, h: number, pos: [number, number, number], k: number) => void} */
  const box = (w, h, pos, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  box(120, 50, [0, 80, 0], 3.0);
  box(80, 30, [70, 30, -60], 2.0);
  box(60, 30, [-80, 20, 40], 0.8);
  box(45, 16, [65, 36, 51], 2.2);
  return env;
};

/**
 * 深灰檯面（中央略亮的徑向漸層）
 * @type {(size: number) => THREE.Mesh}
 */
const buildTabletop = (size) => {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 512;
  const ctx = /** @type {CanvasRenderingContext2D} */ (cv.getContext('2d'));
  const grd = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
  grd.addColorStop(0, '#2c2e32');
  grd.addColorStop(0.35, '#232428');
  grd.addColorStop(1, '#18191c');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 512, 512);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.5, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.4, envMapIntensity: 0.35 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  return m;
};

/**
 * 車底接觸陰影（徑向漸層平面，模擬 AO）
 * @type {() => THREE.Mesh}
 */
const buildContactShadow = () => {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 256;
  const ctx = /** @type {CanvasRenderingContext2D} */ (cv.getContext('2d'));
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
};

/**
 * 重心標記：一律畫在最上層（不被車殼遮住）的小球＋垂直落地線
 * @type {() => THREE.Group}
 */
const buildComMarker = () => {
  const g = new THREE.Group();
  g.name = 'com-marker';
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(2.6, 20, 12),
    new THREE.MeshBasicMaterial({ color: 0xffd23f, depthTest: false, transparent: true, opacity: 0.95 }),
  );
  ball.renderOrder = 10;
  g.add(ball);
  const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -1, 0)]);
  const line = new THREE.Line(lineGeo, new THREE.LineDashedMaterial({ color: 0xffd23f, dashSize: 2, gapSize: 2, depthTest: false, transparent: true, opacity: 0.8 }));
  line.name = 'drop';
  line.renderOrder = 10;
  g.add(line);
  return g;
};

/** @type {(o: THREE.Object3D) => void} 釋放車輛模型的幾何、材質與貼圖（車殼的幾何與材質由 src/bodies 快取共用，不釋放） */
const disposeCar = (o) => {
  /** @type {Set<THREE.Material>} */
  const mats = new Set();
  o.traverse((c) => {
    if (!(c instanceof THREE.Mesh) || isBodyMesh(c)) {
      return;
    }
    c.geometry?.dispose();
    for (const m of Array.isArray(c.material) ? c.material : [c.material]) {
      mats.add(m);
    }
  });
  for (const m of mats) {
    for (const v of Object.values(m)) {
      if (v instanceof THREE.Texture) {
        v.dispose();
      }
    }
    m.dispose();
  }
};

/** @type {(o: THREE.Object3D) => boolean} 物件屬於車殼群組（幾何為快取，共用） */
const isBodyMesh = (o) => {
  for (let p = o; p; p = p.parent) {
    if (p.name === 'body') {
      return true;
    }
  }
  return false;
};

/**
 * 建立換件頁場景
 * @type {(container: HTMLElement) => ReturnType<typeof createSceneImpl>}
 */
export const createGarageScene = (container) => createSceneImpl(container);

/** @param {HTMLElement} container */
function createSceneImpl(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-label', '3D 車輛檢視（可拖曳旋轉、滾輪縮放）');
  renderer.domElement.setAttribute('role', 'img');
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG_COLOR);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(buildStudioEnvironment(), 0.03).texture;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f99, 0.35));

  const sun = new THREE.DirectionalLight(0xffffff, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005;
  sun.shadow.radius = 3;
  scene.add(sun);
  scene.add(sun.target);

  /** @type {(r: number) => void} 設定陰影投射範圍（mm） */
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

  // ---- 車庫（棚拍檯面）----
  const garageGroup = new THREE.Group();
  garageGroup.add(buildTabletop(8000));
  garageGroup.add(buildContactShadow());
  scene.add(garageGroup);

  // ---- 賽道（第一次上賽道時才建立）----
  /** @type {THREE.Group | null} */
  let raceGroup = null;

  const camera = new THREE.PerspectiveCamera(30, 1, 1, 50000);
  camera.position.set(240, 150, -260);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 18, 0);
  controls.enableDamping = true;
  controls.minDistance = 120;
  controls.maxDistance = 1400;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.update();

  /** @type {THREE.Group | null} */
  let car = null;
  const comMarker = buildComMarker();
  scene.add(comMarker);

  /** @type {'garage' | 'race'} */
  let mode = 'garage';
  let chaseYaw = 0;
  let chaseInit = false;

  const applyGarageLighting = () => {
    sun.intensity = 2.6;
    sun.position.set(-180, 520, 260);
    sun.target.position.set(0, 0, 0);
    setShadowBox(220);
    scene.fog = new THREE.Fog(BG_COLOR, 700, 2600);
  };
  applyGarageLighting();

  const resize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === 0 || h === 0) {
      return;
    }
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(container);
  resize();

  /**
   * 換上新的車輛模型（舊模型移除並釋放幾何）
   * @type {(model: THREE.Group, com_mm: { x: number, y: number, z: number }) => void}
   */
  const setCar = (model, com_mm) => {
    if (car) {
      scene.remove(car);
      disposeCar(car);
    }
    car = model;
    car.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    scene.add(car);
    comMarker.position.set(com_mm.x, com_mm.y, com_mm.z);
    const drop = /** @type {THREE.Line} */ (comMarker.getObjectByName('drop'));
    drop.scale.y = Math.max(0.01, com_mm.y);
    drop.computeLineDistances();
  };

  /** @type {(visible: boolean) => void} */
  const setComVisible = (visible) => {
    comMarker.visible = visible && mode === 'garage';
    comMarker.userData.wanted = visible;
  };
  comMarker.userData.wanted = true;

  /**
   * 切到賽道模式：顯示賽道模型（第一次呼叫時建立）
   * @type {(track: any) => void}
   */
  const enterRace = (track) => {
    mode = 'race';
    if (!raceGroup) {
      raceGroup = new THREE.Group();
      const tm = buildTrackModel(track);
      tm.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.receiveShadow = true;
          o.castShadow = true;
        }
      });
      raceGroup.add(tm);
      const b = track.bounds;
      const ground = buildTabletop(9000);
      ground.position.set(((b.minX + b.maxX) / 2) * 1000, -0.5, ((b.minZ + b.maxZ) / 2) * 1000);
      raceGroup.add(ground);
      scene.add(raceGroup);
    }
    raceGroup.visible = true;
    garageGroup.visible = false;
    comMarker.visible = false;
    controls.enabled = false;
    scene.fog = new THREE.Fog(BG_COLOR, 2500, 6000);
    // 賽道灰色直線段在棚拍主光下會過曝，賽道模式主光調弱
    sun.intensity = 1.5;
    setShadowBox(450);
    chaseInit = false;
  };

  /** 回到車庫模式：車放回原點、相機回到展示視角 */
  const exitRace = () => {
    mode = 'garage';
    if (raceGroup) {
      raceGroup.visible = false;
    }
    garageGroup.visible = true;
    comMarker.visible = Boolean(comMarker.userData.wanted);
    if (car) {
      car.position.set(0, 0, 0);
      car.quaternion.identity();
    }
    controls.enabled = true;
    camera.position.set(240, 150, -260);
    controls.target.set(0, 18, 0);
    controls.update();
    applyGarageLighting();
  };

  /**
   * 賽道模式每幀更新車輛姿態與跟車相機
   * @type {(pos_m: { x: number, y: number, z: number }, rot: { x: number, y: number, z: number, w: number }, dtReal: number) => void}
   */
  const updateRacePose = (pos_m, rot, dtReal) => {
    if (!car) {
      return;
    }
    car.position.set(pos_m.x * 1000, pos_m.y * 1000, pos_m.z * 1000);
    car.quaternion.set(rot.x, rot.y, rot.z, rot.w);
    const fwd = new THREE.Vector3(1, 0, 0).applyQuaternion(car.quaternion);
    const yaw = Math.atan2(fwd.z, fwd.x);
    if (!chaseInit) {
      chaseYaw = yaw;
      chaseInit = true;
    }
    // 只平滑相機方位角（時間常數約 0.15 s）：位置緊跟車子，彎道時相機慢慢繞到車後
    let dyaw = yaw - chaseYaw;
    dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    chaseYaw += dyaw * (1 - Math.exp(-dtReal / 0.15));
    const dir = new THREE.Vector3(Math.cos(chaseYaw), 0, Math.sin(chaseYaw));
    const target = car.position.clone().add(new THREE.Vector3(0, 20, 0)).addScaledVector(dir, 220);
    camera.position.copy(car.position).addScaledVector(dir, -620).add(new THREE.Vector3(0, 330, 0));
    camera.lookAt(target);
    sun.position.set(car.position.x - 180, 1200, car.position.z + 260);
    sun.target.position.copy(car.position);
  };

  /** @type {() => void} 畫一幀 */
  const render = () => {
    if (mode === 'garage') {
      controls.update();
    }
    renderer.render(scene, camera);
  };

  return { renderer, scene, camera, controls, setCar, setComVisible, enterRace, exitRace, updateRacePose, render };
}
