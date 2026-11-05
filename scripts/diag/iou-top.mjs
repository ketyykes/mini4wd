// 列出全部車殼兩兩輪廓 IoU 最高的幾對（檢查用）
import { listBodies } from '../../src/bodies/index.js';
import { bodyIoU } from '../../src/bodies/silhouette.js';
const bodies = listBodies();
/** @type {{ a: string, b: string, side: number, top: number }[]} */
const rows = [];
for (let i = 0; i < bodies.length; i++) {
  for (let j = i + 1; j < bodies.length; j++) {
    const r = bodyIoU(bodies[i], bodies[j]);
    rows.push({ a: bodies[i].id, b: bodies[j].id, side: r.side, top: r.top });
  }
}
rows.sort((p, q) => Math.max(q.side, q.top) - Math.max(p.side, p.top));
for (const r of rows.slice(0, Number(process.argv[2] ?? 8))) {
  console.log(`${r.a} × ${r.b}：側視 ${r.side.toFixed(4)}、俯視 ${r.top.toFixed(4)}`);
}
