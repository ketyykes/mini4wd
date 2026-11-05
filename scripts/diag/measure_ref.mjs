// 以 fit_ref_camera.mjs 擬合出的相機（θ 25.75°、φ 1°、d 700 mm、rms 4.3 px）反推參考照 ref side-high 特徵點的 3D 位置
// （不用 θ 23°、d 410 mm 的未擬合相機：透視過強，近遠側導輪殘差達 25 px）
// 給定參考照像素 (u, v) 與假設的一個座標（z 或 y），解出另外兩個（推估：像素為目視量測，±2 px ≈ ±0.4 mm）
// 用法：node measure_ref.mjs '[["名稱", u, v, "z", -38]]'（"z" 表示固定 z 解 x,y；"y" 表示固定 y 解 x,z）
import * as THREE from 'three';

const TH = (25.75 * Math.PI) / 180;
const PH = (1 * Math.PI) / 180;
const D = 700;
const S = 1.5016;
const OX = 0;
const cam = new THREE.PerspectiveCamera(20, 1600 / 900, 1, 50000);
cam.position.set(D * Math.cos(TH) * Math.sin(PH), 12 + D * Math.sin(TH), -D * Math.cos(TH) * Math.cos(PH));
cam.lookAt(0, 12, 0);
cam.updateMatrixWorld();
const raw = (x, y, z) => {
  const p = new THREE.Vector3(x, y, z).project(cam);
  return [((p.x + 1) / 2) * 1600, ((1 - p.y) / 2) * 900];
};
// 平移量：以前後輪蓋中心的擬合結果回推（與 fit_ref_camera.mjs 一致）
const hf = raw(40, 13, -35);
const hr = raw(-40, 13, -35);
const ox = ((hf[0] + hr[0]) / 2) * S - (270 + 728) / 2 + OX;
const oy = ((hf[1] + hr[1]) / 2) * S - (452 + 453) / 2;
const project = (x, y, z) => {
  const [px, py] = raw(x, y, z);
  return [px * S - ox, py * S - oy];
};
const solve = (u, v, mode, fixed) => {
  let a = 0;
  let b = mode === 'z' ? 15 : 0;
  const P = (a1, b1) => (mode === 'z' ? project(a1, b1, fixed) : project(a1, fixed, b1));
  for (let i = 0; i < 80; i++) {
    const [pu, pv] = P(a, b);
    const [ua, va] = P(a + 0.01, b);
    const [ub, vb] = P(a, b + 0.01);
    const j11 = (ua - pu) / 0.01;
    const j21 = (va - pv) / 0.01;
    const j12 = (ub - pu) / 0.01;
    const j22 = (vb - pv) / 0.01;
    const det = j11 * j22 - j12 * j21;
    const eu = pu - u;
    const ev = pv - v;
    a -= (j22 * eu - j12 * ev) / det;
    b -= (-j21 * eu + j11 * ev) / det;
  }
  return [a, b];
};
console.log('檢查：前輪蓋 (40,13,-35) →', project(40, 13, -35).map((n) => n.toFixed(1)).join(','), '；前導輪近側 (71.5,14.5,-42) →', project(71.5, 14.5, -42).map((n) => n.toFixed(1)).join(','));
for (const [name, u, v, mode, fixed] of JSON.parse(process.argv[2])) {
  const [a, b] = solve(u, v, mode, fixed);
  if (mode === 'z') {
    console.log(`${name}: (${u},${v}) 固定 z=${fixed} → x=${a.toFixed(1)} y=${b.toFixed(1)} mm`);
  } else {
    console.log(`${name}: (${u},${v}) 固定 y=${fixed} → x=${a.toFixed(1)} z=${b.toFixed(1)} mm`);
  }
}
