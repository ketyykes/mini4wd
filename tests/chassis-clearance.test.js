import { test, expect } from 'vitest';
import { assemble, loadConfig } from '../src/assembly.js';
import { validateAssembly } from '../src/regulation.js';
import { chassisSideGeometry, chassisSideSolids } from '../src/parts/chassisGeom.js';
import { solidGap, sdf, solidBox } from '../src/parts/clearance.js';
import { buildCarModel } from '../src/model.js';
import * as THREE from 'three';

// MA 側制振器座是外掛式（側板底面齊底盤底面 y 2.2、配重中心 z ±44，見 chassis.js src.sideDamperMount；查證紀錄：ITERATION_LOG iter-111）；
// 「側裙頂面＋6 mm 墊管」的座位用 chassis 覆寫檢查：墊管不足時配重被底盤實體擋下
test('P18_side_mount 缺墊管的配重被底盤實體擋下，正確安裝的全行程保留間隙', () => {
  for (const id of ['damper-side-square', 'damper-side-square-32', 'damper-square-8x8x14', 'damper-square-8x8x32', 'damper-ar-side']) {
    const config = { ...loadConfig('default'), body: null, massDamper: id };
    const valid = assemble(config);
    expect(validateAssembly(valid).ok, id).toBe(true);
    for (const d of valid.optional.dampers) {
      expect(d.seat.y).toBeCloseTo(2.2 + 1.5 + 1, 9);
      expect(solidBox(d.swept).min.y).toBeCloseTo(d.seat.y - 1, 9);
      expect(solidBox(d.swept).min.y).toBeCloseTo(d.adapter.plate.max.y, 9);
      expect(solidBox(d.swept).max.y).toBeCloseTo(d.seat.y + d.part.height_mm + d.part.stroke_mm, 9);
      for (const ch of chassisSideSolids(valid.partsBySlot.chassis)) expect(solidGap(d.swept, ch.solid), ch.label).toBeGreaterThanOrEqual(1);
    }
    for (const height of [0, 3]) {
      const invalid = assemble({ ...config, chassis: { base: 'chassis-midship', sideDamperMount: { x_mm: 0, z_mm: 33 } }, massDamper: { base: id, mountSpacer_mm: height } });
      expect(validateAssembly(invalid).violations.map(v => v.code), `${id}, spacer=${height}`).toContain('DAMPER_CHASSIS_CLEARANCE');
    }
  }
});

test('P18_side_holes 側裙與側壁保留真實孔洞，不把外框填滿', () => {
  const asm = assemble(loadConfig('default'));
  const s = chassisSideGeometry(asm.partsBySlot.chassis)[1];
  expect(sdf(s.skirt, 0, 4, 32.2)).toBeGreaterThan(1);
  expect(sdf(s.skirt, 6, 4, 32.2)).toBeLessThan(0);
  expect(sdf(s.wall, 0, s.winY, 35.6)).toBeGreaterThan(1);
  expect(sdf(s.wall, 6.5, s.winY, 35.6)).toBeLessThan(0);
  const pointBox = (x, y, z) => ({ kind: 'box', min: { x: x - 0.1, y: y - 0.1, z: z - 0.1 }, max: { x: x + 0.1, y: y + 0.1, z: z + 0.1 } });
  expect(solidGap(pointBox(0, 4, 32.2), s.skirt)).toBeGreaterThan(1);
  expect(solidGap(pointBox(6, 4, 32.2), s.skirt)).toBeLessThan(0);
  expect(solidGap(pointBox(0, s.winY, 35.6), s.wall)).toBeGreaterThan(1);
  expect(solidGap(pointBox(6.5, s.winY, 35.6), s.wall)).toBeLessThan(0);
});

test('P14_side_geometry 外觀與干涉使用相同側裙、側壁、支撐塊及托板位置；硬體固定質量守恆', () => {
  const config = { ...loadConfig('default'), body: null, massDamper: 'damper-side-square-32', wheels: 'wheel-31-lowfriction' };
  const asm = assemble(config), model = buildCarModel(asm);
  model.updateMatrixWorld(true);
  const check = (mesh, solid) => {
    expect(mesh).toBeTruthy();
    const b = new THREE.Box3().setFromObject(mesh), expected = solidBox(solid);
    for (const axis of ['x', 'y', 'z']) {
      const lift = axis === 'y' ? asm.lift_mm : 0;
      expect(b.min[axis]).toBeCloseTo(expected.min[axis] + lift, 4);
      expect(b.max[axis]).toBeCloseTo(expected.max[axis] + lift, 4);
    }
  };
  for (const s of chassisSideGeometry(asm.partsBySlot.chassis)) for (const [key, name] of [['skirt', 'skirt'], ['wall', 'wall'], ['block', 'block']]) {
    check(model.getObjectByName(`chassis-side-${name}-${s.sign}`), s[key]);
  }
  const plates = [], spacers = [];
  model.traverse(o => { if (o.name === 'side-damper-mount-plate') plates.push(o); if (o.name === 'side-damper-mount-spacer') spacers.push(o); });
  // 外掛式側座：側板 19 mm 長、從側壁外側 z 36.4 伸到配重外緣 44＋3.25，不用墊管（查證紀錄：ITERATION_LOG iter-111）
  expect(plates).toHaveLength(2); expect(spacers).toHaveLength(0);
  asm.optional.dampers.forEach((d, i) => check(plates[i], d.adapter.plate));
  const fixed = 2 * (19 * (44 + 3.25 - 36.4) * 1.5 * 1.85 / 1000 + 19 * 6 * 1 * 0.12 / 1000);
  expect(asm.optional.damperBrackets.reduce((m, p) => m + p.mass_g, 0)).toBeCloseTo(fixed, 9);
  const bare = assemble({ ...config, massDamper: null });
  const locked = assemble({ ...config, massDamper: { base: 'damper-side-square-32', locked: true } });
  expect(asm.mass_g - bare.mass_g).toBeCloseTo(16.6 + fixed, 9);
  expect(asm.mass_g).toBeCloseTo(locked.mass_g, 9);
  expect(asm.movable.reduce((m, p) => m + p.mass_g, 0)).toBeCloseTo(16.6, 9);
  model.traverse(o => { o.geometry?.dispose(); });
});
