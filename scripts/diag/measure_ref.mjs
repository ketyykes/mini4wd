// iter-11：以「與 sidehigh 截圖相同的相機」反推參考照 ref side-high 上特徵點的 3D 高度
// 前提（推估）：參考照相機 ≈ 仰角 23°、距離 410 mm、fov 20° 的透視相機；以前後輪心對齊（縮放 0.848、平移）
// 給定參考照像素 (u, v) 與假設的橫向位置 z（mm），解出車體座標 x 與高度 y（mm）
import * as THREE from 'three';

const deg = (Number(process.env.THETA ?? 23) * Math.PI) / 180;
const cam = new THREE.PerspectiveCamera(20, 1600 / 900, 1, 50000);
cam.position.set(0, 12 + 410 * Math.sin(deg), -410 * Math.cos(deg));
cam.lookAt(new THREE.Vector3(0, 12, 0));
cam.updateMatrixWorld();
cam.updateProjectionMatrix();
/** @type {(x: number, y: number, z: number) => [number, number]} 3D → 截圖像素（1600×900） */
const raw = (x, y, z) => {
  const p = new THREE.Vector3(x, y, z).project(cam);
  return [((p.x + 1) / 2) * 1600, ((1 - p.y) / 2) * 900];
};
// 以輪蓋外側（z = −36）的前後輪心對齊參考照輪心 (270,457)、(728,453)，求縮放與平移
const hf = raw(40, 13, -36);
const hr = raw(-40, 13, -36);
const S = (728 - 270) / (hr[0] - hf[0]);
const OX = hf[0] * S - 270;
const OY = ((hf[1] + hr[1]) / 2) * S - 455;
/** @type {(x: number, y: number, z: number) => [number, number]} 3D → 參考照像素 */
const project = (x, y, z) => {
  const [px, py] = raw(x, y, z);
  return [px * S - OX, py * S - OY];
};
/** @type {(u: number, v: number, z: number) => [number, number]} 參考照像素 + 假設 z → (x, y)，牛頓迭代 */
const solve = (u, v, z) => {
  let x = 0;
  let y = 20;
  for (let i = 0; i < 50; i++) {
    const [pu, pv] = project(x, y, z);
    const [ux] = project(x + 0.01, y, z);
    const [, vy] = project(x, y + 0.01, z);
    x -= (pu - u) / ((ux - pu) / 0.01);
    y -= (pv - v) / ((vy - pv) / 0.01);
  }
  return [x, y];
};
console.log('檢查：前輪心 (40,13,-29.75) →', project(40, 13, -29.75).map((n) => n.toFixed(1)).join(','), '；後輪心 (-40,13,-29.75) →', project(-40, 13, -29.75).map((n) => n.toFixed(1)).join(','));
const pts = JSON.parse(process.argv[2]);
for (const [name, u, v, z] of pts) {
  const [x, y] = solve(u, v, z);
  console.log(`${name}: 像素 (${u},${v}) 假設 z=${z} → x=${x.toFixed(1)} mm, y=${y.toFixed(1)} mm`);
}
