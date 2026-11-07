// 車殼快速自檢：質量、外框、間隙、規則檢查（26 / 31 mm 輪）、和其他所有車殼的輪廓 IoU、致敬款（phase 4）的型式差異
// 用法：pnpm dlx vite-node scripts/body-check.mjs <body-id>[,<body-id>...]
import { listBodies, getBody, bodyMassProps } from '../src/bodies/index.js';
import { bodyIoU } from '../src/bodies/silhouette.js';
import { assemble, loadConfig } from '../src/assembly.js';
import { validateAssembly } from '../src/regulation.js';

/** @type {number} 與 tests/bodies.test.js 相同的 IoU 門檻 */
const IOU_MAX = 0.85;
/** @type {string[]} */
const ids = (process.argv[2] ?? '').split(',').filter(Boolean);
if (ids.length === 0) {
  console.log('用法：pnpm dlx vite-node scripts/body-check.mjs <body-id>[,<body-id>...]');
  process.exit(1);
}

/** @type {(b: import('../src/bodies/types').BodyDef) => { height: number, length: number }} */
const dimsOf = (b) => {
  const bb = bodyMassProps(b).bbox_mm;
  return { height: bb.max.y, length: bb.max.x - bb.min.x };
};

for (const id of ids) {
  const body = getBody(id);
  const mp = bodyMassProps(body);
  const bb = mp.bbox_mm;
  console.log(`\n=== ${id}（${body.name}）style=${body.style} phase=${body.phase} roof=${body.roof} wing=${body.wing}`);
  console.log(`車殼質量 ${mp.mass_g.toFixed(2)} g（殼 ${mp.shellMass_g.toFixed(2)}＋實體 ${mp.solidMass_g.toFixed(2)}）；外框 x ${bb.min.x.toFixed(1)}~${bb.max.x.toFixed(1)}、y ${bb.min.y.toFixed(1)}~${bb.max.y.toFixed(1)}、z ±${Math.max(-bb.min.z, bb.max.z).toFixed(1)}`);
  for (const wheels of ['wheel-26-lowprofile', 'wheel-31-large']) {
    const asm = assemble({ ...loadConfig('default'), body: id, wheels });
    const v = validateAssembly(asm);
    const viol = v.ok ? '合法' : `不合法：${v.violations.map((x) => `${x.code}（${x.message ?? ''}）`).join('；')}`;
    console.log(`[${wheels}] 整車 ${asm.mass_g.toFixed(2)} g；外框 ${asm.bbox_mm.size.x.toFixed(1)}×${asm.bbox_mm.size.z.toFixed(1)}×${asm.bbox_mm.size.y.toFixed(1)} mm；間隙 輪胎 ${asm.fit.tire_mm.toFixed(2)} / 導輪 ${asm.fit.roller_mm?.toFixed?.(2)} mm；${viol}`);
  }
  for (const other of listBodies()) {
    if (other.id === id) {
      continue;
    }
    const r = bodyIoU(body, other);
    const flag = r.side >= IOU_MAX || r.top >= IOU_MAX ? '  ← 超過門檻' : '';
    console.log(`IoU × ${other.id}：側視 ${r.side.toFixed(3)}、俯視 ${r.top.toFixed(3)}${flag}`);
  }
  if (body.style === 'homage' && body.phase === 4) {
    const da = dimsOf(body);
    for (const other of listBodies().filter((b) => b.style === 'homage' && b.phase === 4 && b.id !== id)) {
      const db = dimsOf(other);
      /** @type {string[]} */
      const diffs = [];
      if (Math.abs(da.height - db.height) >= 3) {
        diffs.push('車高');
      }
      if (Math.abs(da.length - db.length) >= 5) {
        diffs.push('長度');
      }
      if (body.roof && other.roof && body.roof !== other.roof) {
        diffs.push('車頂');
      }
      if (body.wing && other.wing && body.wing !== other.wing) {
        diffs.push('尾翼');
      }
      console.log(`型式差異 × ${other.id}：${diffs.join('、') || '（無）'}${diffs.length < 2 ? '  ← 不足 2 項' : ''}`);
    }
  }
}
