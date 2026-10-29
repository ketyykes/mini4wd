// B10 診斷：列出某些設定逐 slot 換裝後的違規（比對改動前後合法組合數）
import { test } from 'vitest';
import { assemble, loadConfig, SLOTS, OPTIONAL_SLOTS } from '../../src/assembly.js';
import { validateAssembly } from '../../src/regulation.js';
import { listParts } from '../../src/parts/index.js';
test('legal list', () => {
  for (const name of ['default', 'p5-taiwan', 'p7-demo', 'p7-parts', 'vz-demo', 'vz-tuned']) {
    const base = loadConfig(name);
    for (const slot of ['massDamper', 'brakeSponge', 'brakePlate', 'ballast', 'stabilizer', 'frontStay', 'rearStay', 'frontRollers', 'rearRollers', 'frontRollerAngle', 'rearRollerAngle']) {
      const ids = listParts(SLOTS[slot]).map((q) => q.id);
      if (OPTIONAL_SLOTS.includes(slot)) ids.push(null);
      for (const id of ids) {
        let v;
        try { v = validateAssembly(assemble({ ...base, [slot]: id })).violations; } catch (e) { v = [{ code: 'THROW' }]; }
        console.log(`LEGAL ${name} ${slot}=${id} ${v.map((x) => x.code).join(',') || 'OK'}`);
      }
    }
  }
});
