import { test } from 'vitest';
import { assemble, loadConfig } from '../../src/assembly.js';
import { validateAssembly } from '../../src/regulation.js';
test('legal', () => {
  for (const n of ['p7-demo', 'p5-taiwan']) {
    const a = assemble(loadConfig(n));
    console.log(n, validateAssembly(a).ok, a.mass_g.toFixed(2), a.layout.rollers.map((r) => `${r.id}:${r.thrust_deg}`).join(' '));
  }
  const bad = assemble({ ...loadConfig('default'), frontRollerAngle: 'roller-angle-plate-2' });
  console.log('default+plate', JSON.stringify(validateAssembly(bad).violations.map((v) => v.code)));
});
