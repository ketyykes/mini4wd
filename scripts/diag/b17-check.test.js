import { test } from 'vitest';
import { listBodies } from '../../src/bodies/index.js';
import { bodyIoU } from '../../src/bodies/silhouette.js';
import { assemble, loadConfig } from '../../src/assembly.js';
test('check', () => {
  const bodies = listBodies();
  const focus = ['body-griffin-vane', 'body-fastback-cabin', 'body-lowline-flat', 'body-zeppelin-xtail'];
  const rows = [];
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
    if (!focus.includes(bodies[i].id) && !focus.includes(bodies[j].id)) continue;
    const r = bodyIoU(bodies[i], bodies[j]);
    rows.push(`${r.top.toFixed(4)} top / ${r.side.toFixed(4)} side  ${bodies[i].id} × ${bodies[j].id}`);
  }
  rows.sort().reverse();
  console.log(rows.slice(0, 6).join('\n'));
  for (const w of [undefined, 'wheel-31-large']) for (const b of focus) {
    const c = { ...loadConfig('default'), body: b }; if (w) c.wheels = w;
    console.log(b, w || '26', assemble(c).mass_g.toFixed(2));
  }
});
