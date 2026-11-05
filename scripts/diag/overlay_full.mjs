// 把模型車殼的特徵線（黃：中線、紅：近側前葉子板稜線、青：遠側輪廓）用 fit_ref_camera 擬合相機投影到參考照 ref side-high 上
// 直接比較同一相機下的高度差（推估：相機擬合 rms 4.3 px ≈ 0.75 mm）
// 用法：node scripts/diag/overlay_profile.mjs <輸出 png>
import { createServer } from 'vite';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const server = await createServer({ root, logLevel: 'error', server: { middlewareMode: true } });
const body = await server.ssrLoadModule('/src/bodyShell.js');

const TH = (25.75 * Math.PI) / 180;
const PH = (1 * Math.PI) / 180;
const D = 700;
const S = 1.5016;
const cam = new THREE.PerspectiveCamera(20, 1600 / 900, 1, 50000);
cam.position.set(D * Math.cos(TH) * Math.sin(PH), 12 + D * Math.sin(TH), -D * Math.cos(TH) * Math.cos(PH));
cam.lookAt(0, 12, 0);
cam.updateMatrixWorld();
const raw = (x, y, z) => {
  const p = new THREE.Vector3(x, y, z).project(cam);
  return [((p.x + 1) / 2) * 1600, ((1 - p.y) / 2) * 900];
};
const hf = raw(40, 13, -35);
const hr = raw(-40, 13, -35);
const ox = ((hf[0] + hr[0]) / 2) * S - (270 + 728) / 2;
const oy = ((hf[1] + hr[1]) / 2) * S - (452 + 453) / 2;
const project = (p) => {
  const [px, py] = raw(p.x, p.y, p.z);
  return [px * S - ox, py * S - oy];
};
const xs = [];
for (let x = 72; x >= -62; x -= 1) {
  xs.push(x);
}
const center = xs.map((x) => body.bodyPoint(x, 0, 1));
const ridgeNear = xs.map((x) => body.bodyPoint(x, 0.4, -1));
const cabXs = xs.filter((x) => x <= 15 && x >= -48);
const cabFar = cabXs.map((x) => body.cabinPoint(x, 0.3, 1));
const cabNear = cabXs.map((x) => body.cabinPoint(x, 0.86, -1));
const ridgeFar = xs.map((x) => body.bodyPoint(x, 0.4, 1));
// 遠側輪廓：每個 x 截面在畫面上最高（v 最小）的點，對應參考照遠側葉子板與背景的交界
const farSil = xs.map((x) => {
  let best = null;
  for (let k = 0; k <= 90; k++) {
    const p = body.bodyPoint(x, k / 100, 1);
    if (!best || project(p)[1] < project(best)[1]) {
      best = p;
    }
  }
  return best;
});
const ref = path.join(root, '../shared/reference/ref_chevalier-ma_side-high_tamiya.jpg');
const out = process.argv[2] ?? path.join(root, 'tmp/overlay_profile.png');
const args = [ref, '-strokewidth', '2'];
for (const [pts, color] of [[center, 'yellow'], [ridgeNear, 'red'], [farSil, 'cyan'], [cabFar, 'lime'], [cabNear, 'magenta']]) {
  args.push('-stroke', color, '-fill', 'none', '-draw', `polyline ${pts.map((q) => project(q).map((n) => n.toFixed(1)).join(',')).join(' ')}`);
}
args.push(out);
execFileSync('magick', args);
console.log('saved', out);
for (const x of [58, 50, 40, 32, 24, 16]) {
  const c = body.bodyPoint(x, 0, 1);
  const r = body.bodyPoint(x, 0.4, 1);
  console.log(`x=${x}: 中線 y=${c.y.toFixed(1)}（實際 x ${c.x.toFixed(1)}）、稜線 y=${r.y.toFixed(1)} z=${r.z.toFixed(1)}`);
}
await server.close();
