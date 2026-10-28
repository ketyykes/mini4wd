// B15 診斷：31 mm 輪的輪拱切除區內，各車殼被切到的是薄殼、實體件還是裝飾件
// npx vitest run --config scripts/diag/vitest.diag.config.js scripts/diag/b15-arch-zone.test.js --silent=false
import { test } from 'vitest';
import * as THREE from 'three';
import { listBodies, bodyMassProps } from '../../src/bodies/index.js';
import { assemble } from '../../src/assembly.js';
import { validateAssembly } from '../../src/regulation.js';
import def from '../../configs/default.json' with { type: 'json' };

const mats = new Proxy({}, { get: () => new THREE.MeshStandardMaterial() });
const tag = (o) => { for (let p = o; p; p = p.parent) { if (p.userData?.shell) return 'shell'; if (p.userData?.solid) return 'solid'; } return 'other'; };
test('zone', () => {
  for (const body of listBodies()) {
    const asm = assemble({ ...def, body: body.id, wheels: 'wheel-31-large' });
    const v = validateAssembly(asm);
    const bad = v.violations.some((x) => x.code === 'BODY_TIRE_CLEARANCE');
    const wheels = asm.partsBySlot.wheels;
    const R = wheels.diameter_mm / 2, W = wheels.width_mm;
    const ch = asm.partsBySlot.chassis;
    const cy = ch.refWheelDiameter_mm / 2, hx = ch.wheelbase_mm / 2, hz = ch.trackWidth_mm / 2;
    const margin = 2;
    const g = body.build(mats); g.updateMatrixWorld(true);
    const counts = { shell: 0, solid: 0, other: 0 }; const names = new Set();
    const a = new THREE.Vector3();
    g.traverse((o) => {
      if (!o.isMesh) return;
      const pos = o.geometry.attributes.position;
      let hit = 0;
      for (let i = 0; i < pos.count; i++) {
        a.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        for (const [x, z] of [[hx, -hz], [hx, hz], [-hx, -hz], [-hx, hz]]) {
          if (Math.hypot(a.x - x, a.y - cy) < R + margin && Math.abs(a.z - z) < W / 2 + margin) hit++;
        }
      }
      if (hit) { counts[tag(o)] += hit; names.add(`${tag(o)}:${o.name || o.parent?.name || '?'}`); }
    });
    console.log(body.id, bad ? 'FAIL' : 'ok', asm.fit.tire_mm.toFixed(2), JSON.stringify(counts), [...names].join(' '));
  }
});
