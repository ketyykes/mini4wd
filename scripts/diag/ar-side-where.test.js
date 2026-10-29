// AR 側制振器 × 車殼：干涉發生在哪裡（iter-111）。列出制振器掃掠外框，以及落在外框內的車殼頂點的 y／|z| 範圍
import { test } from 'vitest';
import { assemble, loadConfig } from '../../src/assembly.js';
import { listBodies, bodyMassProps } from '../../src/bodies/index.js';

test('ar-side where', () => {
  for (const base of ['default', 'vz-demo']) {
    const asm = assemble({ ...loadConfig(base), massDamper: 'damper-ar-side', body: null });
    const d = asm.optional.dampers.find((q) => q.seat.z > 0);
    console.log('DAMPER', base, JSON.stringify(d?.swept ?? d?.seat ?? Object.keys(asm)));
    for (const b of listBodies()) {
      const v = bodyMassProps(b).vertices;
      const box = d.swept;
      let n = 0, yMin = 1e9, yMax = -1e9, zMin = 1e9, zMax = -1e9;
      for (let i = 0; i < v.length; i += 3) {
        const [x, y, z] = [v[i], v[i + 1], Math.abs(v[i + 2])];
        if (Math.hypot(x - box.c.x, z - box.c.z) < box.r && Math.abs(y - box.c.y) < box.halfLen) {
          n++; yMin = Math.min(yMin, y); yMax = Math.max(yMax, y); zMin = Math.min(zMin, z); zMax = Math.max(zMax, z);
        }
      }
      console.log(`WHERE ${base} ${b.id}: 頂點 ${n}${n ? `，y ${yMin.toFixed(1)}–${yMax.toFixed(1)}、|z| ${zMin.toFixed(1)}–${zMax.toFixed(1)}` : ''}`);
    }
  }
});
