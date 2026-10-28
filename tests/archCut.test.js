// B15（iter-100）：切輪拱改裝（config.bodyArchCut）
import { test, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { assemble, loadConfig } from '../src/assembly.js';
import { validateAssembly } from '../src/regulation.js';
import { listBodies, bodyMassProps } from '../src/bodies/index.js';
import { ARCH_CUT_MARGIN_mm } from '../src/bodies/archCut.js';
import { buildCircuit } from '../src/track.js';
import * as sim from '../src/sim.js';

beforeAll(async () => {
  await sim.initRapier();
});

/** @type {(over: Record<string, any>) => Record<string, any>} */
const cfg = (over) => ({ ...loadConfig('default'), ...over });
const neutral = new Proxy({}, { get: () => new THREE.MeshStandardMaterial() });

test('P18_arch_cut 19 款車殼 × 31 mm 輪：切輪拱後輪胎間隙 ≥ 1.5 mm、沒有車殼輪胎干涉；不切時原本不合法的仍被擋下', () => {
  let fixed = 0;
  for (const body of listBodies()) {
    const plain = assemble(cfg({ body: body.id, wheels: 'wheel-31-large' }));
    const cut = assemble(cfg({ body: body.id, wheels: 'wheel-31-large', bodyArchCut: true }));
    const plainCodes = validateAssembly(plain).violations.map((v) => v.code);
    const cutCodes = validateAssembly(cut).violations.map((v) => v.code);
    expect(cut.body.archCut.baseId).toBe(body.id);
    expect(cut.fit.tire_mm, body.id).toBeGreaterThanOrEqual(ARCH_CUT_MARGIN_mm - 1e-3);
    expect(cutCodes, body.id).not.toContain('BODY_TIRE_CLEARANCE');
    // 切輪拱只解決輪胎干涉，其他規則結果不變
    expect(cutCodes, body.id).toEqual(plainCodes.filter((c) => c !== 'BODY_TIRE_CLEARANCE'));
    if (plainCodes.includes('BODY_TIRE_CLEARANCE')) {
      fixed++;
      expect(validateAssembly(plain).violations.find((v) => v.code === 'BODY_TIRE_CLEARANCE').message).toContain('切輪拱');
    }
  }
  console.log(`[P18 arch cut] 31 mm 輪原本被擋 ${fixed} 款，切輪拱後全部通過`);
  expect(fixed).toBe(9);
});

test('P14_arch_cut 切掉的質量：只會減少、薄殼質量 = 剩下面積 × 壁厚 × 密度、重心與質量一致、正面面積不增；切口外的殼面不動', () => {
  for (const id of ['body-aero-wing', 'body-marlin-sail', 'body-skeleton', 'body-gazelle-leap']) {
    const plain = assemble(cfg({ body: id, wheels: 'wheel-31-large' }));
    const cut = assemble(cfg({ body: id, wheels: 'wheel-31-large', bodyArchCut: true }));
    const a = bodyMassProps(plain.body.def);
    const b = bodyMassProps(cut.body.def);
    expect(b.mass_g).toBeLessThanOrEqual(a.mass_g + 1e-9);
    expect(b.shellArea_mm2).toBeLessThanOrEqual(a.shellArea_mm2 + 1e-6);
    expect(b.solidVolume_mm3).toBeLessThanOrEqual(a.solidVolume_mm3 + 1e-3);
    const d = plain.body.def;
    expect(b.shellMass_g).toBeCloseTo(b.shellArea_mm2 * d.wallThickness_mm * d.density_g_cm3 / 1000, 9);
    expect(cut.body.archCut.removedMass_g).toBeCloseTo(a.mass_g - b.mass_g, 9);
    expect(cut.mass_g).toBeCloseTo(plain.mass_g - cut.body.archCut.removedMass_g, 6);
    expect(cut.frontalArea_mm2).toBeLessThanOrEqual(plain.frontalArea_mm2 + 1e-6);
    // 離輪胎遠的部分（車頂最高點、車長）不受影響
    expect(b.bbox_mm.max.y).toBeCloseTo(a.bbox_mm.max.y, 6);
    expect(b.bbox_mm.max.x - b.bbox_mm.min.x).toBeCloseTo(a.bbox_mm.max.x - a.bbox_mm.min.x, 6);
    console.log(`[P14 arch cut] ${id}：${a.mass_g.toFixed(3)} → ${b.mass_g.toFixed(3)} g，正面 ${plain.frontalArea_mm2.toFixed(0)} → ${cut.frontalArea_mm2.toFixed(0)} mm²`);
  }
  // 已經有餘裕的車殼：沒有任何東西在切口內 → 質量不變
  const lowline = assemble(cfg({ body: 'body-lowline-flat', wheels: 'wheel-31-large', bodyArchCut: true }));
  expect(lowline.body.archCut.removedMass_g).toBeCloseTo(0, 6);
  // 同一組切口重複 build：幾何相同（快取），外觀與質量計算看到同一份網格
  const def = assemble(cfg({ body: 'body-aero-wing', wheels: 'wheel-31-large', bodyArchCut: true })).body.def;
  const count = (g) => { let n = 0; g.traverse((o) => { if (o.isMesh) n += o.geometry.attributes.position.count; }); return n; };
  expect(count(def.build(neutral))).toBe(count(def.build(neutral)));
});

test('P17_arch_cut_laps 切輪拱 aero-wing＋31 mm 輪跑完官方 3 圈：不穿牆、不翻車', () => {
  const asm = assemble(cfg({ body: 'body-aero-wing', wheels: 'wheel-31-large', bodyArchCut: true }));
  expect(validateAssembly(asm).ok).toBe(true);
  const track = buildCircuit();
  const env = sim.createWorld(track);
  const car = sim.createCar(env, { assembly: asm, s: 0.15, lane: 0 });
  const L = track.path.length;
  let last = 0.15;
  let dist = 0;
  let maxPen = 0;
  let minUp = 1;
  for (let i = 0; i < Math.round(12 / env.world.timestep) && dist < 3 * L; i++) {
    sim.stepCar(env, car);
    const t = car.chassis.translation();
    const c = track.path.project(t.x, t.z);
    let ds = c.s - last;
    if (ds < -L / 2) {
      ds += L;
    }
    if (ds > L / 2) {
      ds -= L;
    }
    dist += ds;
    last = c.s;
    maxPen = Math.max(maxPen, sim.wallPenetration(env, car));
    minUp = Math.min(minUp, sim.upAxis(car).y);
  }
  console.log(`[P17 arch cut] 3 圈 ${dist.toFixed(3)} / ${(3 * L).toFixed(3)} m，最大穿牆 ${(maxPen * 1000).toFixed(3)} mm、最小 up.y ${minUp.toFixed(3)}`);
  expect(dist).toBeGreaterThanOrEqual(3 * L);
  expect(maxPen).toBeLessThanOrEqual(0.001);
  expect(minUp).toBeGreaterThan(0.8);
}, 300000);
