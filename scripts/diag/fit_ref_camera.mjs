// 用已知 3D 特徵點（導輪螺絲頂、輪蓋中心）擬合參考照 ref side-high 的相機（仰角、方位、距離）
// 對每組 (θ, φ, d) 以線性最小平方解縮放 s 與平移 (ox, oy)，取殘差最小者（推估：特徵點像素為目視量測，±2 px）
import * as THREE from 'three';

// [名稱, x, y, z, 參考照 u, v]（3D 為本模型座標：導輪 x ±71.5、z ±42；頂端高度為推估）
const PTS = [
  ['前導輪近側螺絲頂', 71.5, 14.5, -42, 90, 467],
  ['前導輪遠側螺絲頂', 71.5, 14.5, 42, 117, 265],
  ['後上導輪近側螺絲頂', -71.5, 22.25, -42, 921, 425],
  ['後上導輪遠側螺絲頂', -71.5, 22.25, 42, 864, 230],
  ['前輪蓋中心', 40, 13, -35, 270, 452],
  ['後輪蓋中心', -40, 13, -35, 728, 453],
];
const project = (theta, phi, d, x, y, z) => {
  const cam = new THREE.PerspectiveCamera(20, 1600 / 900, 1, 50000);
  const t = (theta * Math.PI) / 180;
  const p = (phi * Math.PI) / 180;
  cam.position.set(d * Math.cos(t) * Math.sin(p), 12 + d * Math.sin(t), -d * Math.cos(t) * Math.cos(p));
  cam.lookAt(0, 12, 0);
  cam.updateMatrixWorld();
  const v = new THREE.Vector3(x, y, z).project(cam);
  return [((v.x + 1) / 2) * 1600, ((1 - v.y) / 2) * 900];
};
const fit = (theta, phi, d) => {
  const P = PTS.map(([, x, y, z]) => project(theta, phi, d, x, y, z));
  // 解 s, ox, oy：u = s·px − ox，v = s·py − oy
  const n = P.length;
  const mpx = P.reduce((a, q) => a + q[0], 0) / n;
  const mpy = P.reduce((a, q) => a + q[1], 0) / n;
  const mu = PTS.reduce((a, q) => a + q[4], 0) / n;
  const mv = PTS.reduce((a, q) => a + q[5], 0) / n;
  let num = 0;
  let den = 0;
  P.forEach((q, i) => {
    num += (q[0] - mpx) * (PTS[i][4] - mu) + (q[1] - mpy) * (PTS[i][5] - mv);
    den += (q[0] - mpx) ** 2 + (q[1] - mpy) ** 2;
  });
  const s = num / den;
  const ox = s * mpx - mu;
  const oy = s * mpy - mv;
  let err = 0;
  const res = P.map((q, i) => {
    const du = s * q[0] - ox - PTS[i][4];
    const dv = s * q[1] - oy - PTS[i][5];
    err += du * du + dv * dv;
    return [du, dv];
  });
  return { theta, phi, d, s, ox, oy, rms: Math.sqrt(err / n), res };
};
let best = null;
for (let theta = 16; theta <= 36; theta += 0.25) {
  for (let phi = -12; phi <= 12; phi += 0.25) {
    for (let d = 400; d <= 3000; d += 25) {
      const r = fit(theta, phi, d);
      if (!best || r.rms < best.rms) best = r;
    }
  }
}
console.log(`最佳：θ=${best.theta}° φ=${best.phi}° d=${best.d} mm（fov 20）s=${best.s.toFixed(4)} rms=${best.rms.toFixed(2)} px`);
best.res.forEach(([du, dv], i) => console.log(`  ${PTS[i][0]} 殘差 (${du.toFixed(1)}, ${dv.toFixed(1)})`));
const cur = fit(23, 0, 410);
console.log(`iter-11 相機（θ=23 φ=0 d=410）rms=${cur.rms.toFixed(2)} px`);
cur.res.forEach(([du, dv], i) => console.log(`  ${PTS[i][0]} 殘差 (${du.toFixed(1)}, ${dv.toFixed(1)})`));
// 換算：web/main.js 的 sidehigh（同 θ/φ/d、fov 11.2°）截圖像素 r → 參考照像素：ref = S·r − O
{
  const b = fit(25.75, 1, 700);
  const k = Math.tan((10 * Math.PI) / 180) / Math.tan((5.6 * Math.PI) / 180);
  const S = b.s / k;
  const OX = b.ox - b.s * 800 * (1 - 1 / k);
  const OY = b.oy - b.s * 450 * (1 - 1 / k);
  console.log(`sidehigh(fov 11.2) → 參考照：S=${S.toFixed(4)} OX=${OX.toFixed(1)} OY=${OY.toFixed(1)}`);
}
