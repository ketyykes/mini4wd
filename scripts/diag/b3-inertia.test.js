// B3 診斷：列出各 slot 對整車慣性（對整車重心，g·mm²）的貢獻，含零件自身張量
// pnpm exec vitest run --config scripts/diag/vitest.diag.config.js scripts/diag/b3-inertia.test.js --silent=false
import { test } from 'vitest';
import { assemble, loadConfig } from '../../src/assembly.js';
test('inertia breakdown', () => {
  const asm = assemble({ ...loadConfig('default') });
  const com = asm.com_mm;
  const rows = {};
  for (const q of asm.parts) {
    const d = { x: q.pos.x - com.x, y: q.pos.y - com.y, z: q.pos.z - com.z };
    const key = q.slot;
    rows[key] ??= { m: 0, xx: 0, yy: 0, zz: 0 };
    rows[key].m += q.mass_g;
    rows[key].xx += q.mass_g * (d.y ** 2 + d.z ** 2) + (q.inertia_gmm2?.xx ?? 0);
    rows[key].yy += q.mass_g * (d.x ** 2 + d.z ** 2) + (q.inertia_gmm2?.yy ?? 0);
    rows[key].zz += q.mass_g * (d.x ** 2 + d.y ** 2) + (q.inertia_gmm2?.zz ?? 0);
  }
  const T = asm.inertiaTensor_kgm2;
  console.log('total (g mm2)', (T.xx * 1e9).toFixed(0), (T.yy * 1e9).toFixed(0), (T.zz * 1e9).toFixed(0), 'mass', asm.mass_g.toFixed(2));
  for (const [k, r] of Object.entries(rows)) console.log(k.padEnd(14), r.m.toFixed(2).padStart(7), r.xx.toFixed(0).padStart(8), r.yy.toFixed(0).padStart(8), r.zz.toFixed(0).padStart(8));
});
