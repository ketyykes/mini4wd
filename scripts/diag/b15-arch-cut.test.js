// B15 診斷：19 款車殼 × 31 mm 輪，切輪拱前後的輪胎間隙、質量、規則結果
import { test } from 'vitest';
import { listBodies } from '../../src/bodies/index.js';
import { assemble } from '../../src/assembly.js';
import { validateAssembly } from '../../src/regulation.js';
import def from '../../configs/default.json' with { type: 'json' };
test('cut', () => {
  for (const body of listBodies()) {
    const t0 = performance.now();
    const a = assemble({ ...def, body: body.id, wheels: 'wheel-31-large' });
    const b = assemble({ ...def, body: body.id, wheels: 'wheel-31-large', bodyArchCut: true });
    const codes = (x) => validateAssembly(x).violations.map((v) => v.code).join(',') || 'ok';
    console.log(body.id.padEnd(26), `tire ${a.fit.tire_mm.toFixed(2)} → ${b.fit.tire_mm.toFixed(2)}`, `body ${a.body.mass_g.toFixed(2)} → ${b.body.mass_g.toFixed(2)} g (−${b.body.archCut.removedMass_g.toFixed(2)})`, `area ${a.frontalArea_mm2.toFixed(0)} → ${b.frontalArea_mm2.toFixed(0)}`, codes(a), '→', codes(b), `${(performance.now() - t0).toFixed(0)} ms`);
  }
});
