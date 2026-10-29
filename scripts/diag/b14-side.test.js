// B14（iter-108）診斷：高速 VZ＋AR 側制振器，哪些車殼不會和側制振器干涉
import { test } from 'vitest';
import { assemble, loadConfig } from '../../src/assembly.js';
import { validateAssembly } from '../../src/regulation.js';
import { listBodies } from '../../src/bodies/index.js';

test('b14 side damper vs bodies', () => {
  const base = { ...loadConfig('vz-tuned'), massDamper: 'damper-ar-side' };
  for (const [cfg, damper] of [['default', 'damper-ar-side'], ['p5-taiwan', 'damper-ar-side'], ['p5-taiwan', 'damper-side-square-32']]) {
    const v = validateAssembly(assemble({ ...loadConfig(cfg), massDamper: damper, body: 'body-pc-box' })).violations;
    console.log('MA', cfg, damper, v.map((x) => `${x.code} ${(x.message ?? '').slice(0, 90)}`).join(' | ') || 'OK');
  }
  for (const damper of ['damper-square-8x8x14', 'damper-square-8x8x32', 'damper-side-square']) for (const body of ['body-pc-box', 'body-owl-hush']) {
    const v = validateAssembly(assemble({ ...base, massDamper: damper, body })).violations;
    console.log('VZ', damper, body, v.map((x) => `${x.code} ${(x.message ?? '').slice(0, 90)}`).join(' | ') || 'OK');
  }
  if (process.env.ALL_BODIES) for (const b of listBodies()) {
    const v = validateAssembly(assemble({ ...base, body: b.id })).violations;
    console.log(b.id, v.map((x) => `${x.code} ${(x.message ?? '').slice(0, 90)}`).join(' | ') || 'OK');
  }
});
