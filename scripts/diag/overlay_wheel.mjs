// 把輪胎外側面圓（26 mm）與車殼輪拱開口邊（bodyPoint u = 1）用擬合相機投影到 ref side-high，
// 量「輪胎露出高度」：輪胎頂點到輪拱邊的像素差（推估：相機擬合 rms 4.3 px ≈ 0.75 mm）
// 用法：node scripts/diag/overlay_wheel.mjs <輸出 png>
import { createServer } from 'vite';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const server = await createServer({ root, logLevel: 'error', server: { middlewareMode: true } });
const body = await server.ssrLoadModule('/src/bodyShell.js');
const { spec } = await server.ssrLoadModule('/src/spec.js');

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
const R = spec.tire.diameter_mm / 2;
const zOut = -(spec.chassis.trackWidth_mm / 2 + spec.tire.width_mm / 2);
const ax = spec.chassis.wheelbase_mm / 2;
const lines = [];
const report = [];
for (const cx of [ax, -ax]) {
  const circ = [];
  for (let k = 0; k <= 72; k++) {
    const a = (k / 72) * Math.PI * 2;
    circ.push({ x: cx + R * Math.cos(a), y: R + R * Math.sin(a), z: zOut });
  }
  lines.push([circ, 'yellow']);
  const lip = [];
  const top = [];
  for (let x = cx + 16; x >= cx - 16; x -= 0.25) {
    lip.push(body.bodyPoint(x, 1, -1));
  }
  lines.push([lip, 'red']);
  // 畫面上車殼在輪心正上方最低可見的 v：輪拱邊（u 0.7…1）中 v 最大的點
  let lipV = -1;
  for (let k = 70; k <= 100; k++) {
    lipV = Math.max(lipV, project(body.bodyPoint(cx, k / 100, -1))[1]);
  }
  // 唇邊圓珠（bodyShell.js buildArchLips：開口邊往上、往內偏移 ARCH_LIP_IN，半徑 ARCH_LIP_R）的截面圓
  const e = body.bodyPoint(cx, 1, -1);
  for (let k = 0; k < 36; k++) {
    const a = (k / 36) * Math.PI * 2;
    const q = { x: cx, y: e.y + body.ARCH_LIP_IN + body.ARCH_LIP_R * Math.sin(a), z: e.z + body.ARCH_LIP_IN + body.ARCH_LIP_R * Math.cos(a) };
    lipV = Math.max(lipV, project(q)[1]);
  }
  const tireTopV = project({ x: cx, y: 2 * R, z: zOut })[1];
  const tireBotV = project({ x: cx, y: 0, z: zOut })[1];
  report.push(`${cx > 0 ? '前' : '後'}輪：輪胎頂 v=${tireTopV.toFixed(0)}、底 v=${tireBotV.toFixed(0)}、輪拱邊（輪心正上方）v=${lipV.toFixed(0)} → 上緣被遮 ${(lipV - tireTopV).toFixed(0)} px（輪胎直徑 ${(tireBotV - tireTopV).toFixed(0)} px）`);
}
const ref = path.join(root, '../shared/reference/ref_chevalier-ma_side-high_tamiya.jpg');
const out = process.argv[2] ?? path.join(root, 'tmp/overlay_wheel.png');
const args = [ref, '-strokewidth', '2'];
for (const [pts, color] of lines) {
  args.push('-stroke', color, '-fill', 'none', '-draw', `polyline ${pts.map((q) => project(q).map((n) => n.toFixed(1)).join(',')).join(' ')}`);
}
args.push(out);
execFileSync('magick', args);
console.log('saved', out);
console.log(report.join('\n'));
await server.close();
