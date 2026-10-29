// B14 診斷：既有設定仍合法、VZ 組裝的質量與違規（只印出，不斷言）
import { test } from 'vitest';
import { assemble, loadConfig } from '../../src/assembly.js';
import { validateAssembly } from '../../src/regulation.js';

test('b14 check', () => {
  for (const n of ['default', 'p7-demo', 'p5-taiwan', 'p7-parts', 'speed', 'technical', 'light', 'race-frp', 'carbon-damper', 'p4-tech']) {
    const a = assemble(loadConfig(n));
    const v = validateAssembly(a);
    console.log(n, v.ok, v.violations.map((x) => x.code).join(','), a.mass_g.toFixed(3));
  }
  const vz = { ...loadConfig('default'), chassis: 'chassis-vz', motor: 'motor-single-standard', gear: 'gear-ss-3.5', frontRollers: 'roller-14', rearRollers: 'roller-14', rearStay: 'stay-rear-vz', batteryCover: 'battery-cover-vz', gearCover: 'gear-cover-vz', ...(globalThis.VZ_OVER ?? {}) };
  for (const body of [null, 'body-owl-hush', 'body-trail-canopy', 'body-pc-box']) {
    const a = assemble({ ...vz, body });
    const v = validateAssembly(a);
    console.log('vz', body, v.ok, v.violations.map((x) => `${x.code}: ${x.message}`).join(' | '), 'mass', a.mass_g.toFixed(2), 'com', JSON.stringify(a.com_mm, (k, x) => (typeof x === 'number' ? Number(x.toFixed(2)) : x)), 'bbox', JSON.stringify(a.bbox_mm.size, (k, x) => (typeof x === 'number' ? Number(x.toFixed(1)) : x)), 'gc', a.groundClearance_mm.toFixed(2));
  }
  const a = assemble({ ...vz, body: null });
  console.log(a.parts.map((q) => `${q.label} ${q.mass_g.toFixed(2)} @(${q.pos.x.toFixed(1)},${q.pos.y.toFixed(1)},${q.pos.z.toFixed(1)})`).join('\n'));
  console.log('spin', JSON.stringify(a.spec.spin.reflected_gmm2));
});
