// 截圖頁：依 ?view= 參數擺放相機（side / top / front34 / bottom / track）
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildCarModel, buildTrackModel } from '../src/model.js';
import { buildCircuit } from '../src/track.js';

const params = new URLSearchParams(location.search);
const view = params.get('view') ?? 'front34';
const width = 1600;
const height = 900;

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(width, height);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9ebee);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f99, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.bias = -0.0005;
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
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(20000, 20000), new THREE.MeshStandardMaterial({ color: 0xd9dbe0, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.5;
  ground.receiveShadow = true;
  scene.add(ground);
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
} else {
  // 單車棚拍：淺色地面接收陰影
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.ShadowMaterial({ opacity: 0.22 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  if (view !== 'bottom') {
    scene.add(ground);
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
  } else {
    camera.position.set(250, 135, -235);
  }
  camera.lookAt(center);
  sun.position.set(220, 600, -320);
  sun.target.position.set(0, 0, 0);
  setShadowBox(220);
  if (view === 'bottom') {
    const fill = new THREE.DirectionalLight(0xffffff, 1.6);
    fill.position.set(-100, -500, -300);
    scene.add(fill);
  }
}

renderer.render(scene, camera);
window.__ready = true;
