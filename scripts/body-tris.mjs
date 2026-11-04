// 第九階段效能預算與風阻：每款車殼的三角面數（殼面 / 實體 / 裝飾）、碰撞格建立耗時、整車正面面積（模擬器風阻用的就是它）、車殼頂高與頂高 / 長度
// 用法：npx vite-node scripts/body-tris.mjs [body-id,...]   （不帶參數 = 全部車殼；最後印出中位數與預算）
import { listBodies, bodyMassProps } from '../src/bodies/index.js';
import { bodyCollisionCells } from '../src/bodies/collision.js';
import * as THREE from 'three';
import { assemble, loadConfig } from '../src/assembly.js';

/** @typedef {import('../src/bodies/types').BodyDef} BodyDef */
/** @typedef {{ id: string, shell: number, solid: number, deco: number, total: number, massMs: number, cellMs: number, frontal: number, topY: number, ratio: number }} TriRow */

/** @type {Record<string, THREE.Material>} 只要幾何：任何材質名稱都回傳同一個材質 */
const neutralMats = new Proxy({}, { get: () => new THREE.MeshStandardMaterial() });

/** @type {(obj: THREE.Object3D, key: string) => boolean} 物件自己或祖先有某個 userData 標記 */
const tagged = (obj, key) => {
  for (let o = obj; o; o = o.parent) {
    if (o.userData?.[key]) {
      return true;
    }
  }
  return false;
};

/** @type {string[]} */
const only = (process.argv[2] ?? '').split(',').filter(Boolean);

/** @type {(o: import('three').Mesh) => number} 單一網格的三角形數 */
const triCount = (o) => {
  const g = o.geometry;
  if (g.index) {
    return g.index.count / 3;
  }
  return g.attributes.position.count / 3;
};

/** @type {(body: BodyDef) => TriRow} */
const measure = (body) => {
  const g = body.build(neutralMats);
  let shell = 0;
  let solid = 0;
  let deco = 0;
  g.traverse((o) => {
    if (!o.isMesh) {
      return;
    }
    const n = triCount(o);
    if (tagged(o, 'solid')) {
      solid += n;
    } else if (tagged(o, 'shell')) {
      shell += n;
    } else {
      deco += n;
    }
  });
  const t0 = performance.now();
  bodyMassProps(body);
  const t1 = performance.now();
  bodyCollisionCells(body);
  const t2 = performance.now();
  const asm = assemble({ ...loadConfig('default'), body: body.id });
  const bb = bodyMassProps(body).bbox_mm;
  return {
    id: body.id, shell, solid, deco, total: shell + solid + deco, massMs: t1 - t0, cellMs: t2 - t1,
    frontal: asm.frontalArea_mm2, topY: bb.max.y, ratio: bb.max.y / (bb.max.x - bb.min.x),
  };
};

/** @type {TriRow[]} */
const rows = listBodies().filter((b) => only.length === 0 || only.includes(b.id)).map(measure);
console.log('| 車殼 | 殼面 | 實體 | 裝飾 | 合計 | 質量計算 ms | 碰撞格 ms | 整車正面面積 mm² | 車殼頂高 mm | 頂高 / 長度 |');
console.log('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
for (const r of rows) {
  console.log(`| ${r.id} | ${r.shell} | ${r.solid} | ${r.deco} | ${r.total} | ${r.massMs.toFixed(0)} | ${r.cellMs.toFixed(0)} | ${r.frontal.toFixed(0)} | ${r.topY.toFixed(1)} | ${r.ratio.toFixed(3)} |`);
}
if (only.length === 0) {
  /** @type {number[]} */
  const totals = rows.map((r) => r.total).sort((a, b) => a - b);
  const mid = totals.length % 2 ? totals[(totals.length - 1) / 2] : (totals[totals.length / 2 - 1] + totals[totals.length / 2]) / 2;
  console.log(`\n中位數 ${mid}；3 倍上限 ${mid * 3}；最大 ${totals[totals.length - 1]}`);
}
