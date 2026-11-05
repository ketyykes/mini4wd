// B1：導輪軸跟著車體傾斜。圓柱導輪側傾 φ 時，朝牆的水平伸展 = r·cosφ + (h/2)·|sinφ|（較靠牆的那一緣），接觸點在那一緣上
import { test, expect, beforeAll } from 'vitest';
import { assemble, loadConfig } from '../src/assembly.js';
import { buildStraight } from '../src/track.js';
import * as sim from '../src/sim.js';

beforeAll(async () => {
  await sim.initRapier();
});

test('P17_roller_tilt 側傾導輪的牆面接觸：穿透 = r·cosφ + (h/2)·|sinφ| − 軸到牆距離；接觸點在靠牆那一緣；直立時接觸點在片中心高度', () => {
  const asm = assemble(loadConfig('default'));
  for (const deg of [0, 3, -3, 8, -8]) {
    const track = buildStraight(4);
    const env = sim.createWorld(track);
    const car = sim.createCar(env, { assembly: asm, s: 0.5, lane: 0, powered: false });
    env.world.step();
    car.chassis.setLinvel({ x: 0, y: 0, z: 0 }, true);
    car.chassis.setAngvel({ x: 0, y: 0, z: 0 }, true);
    const phi = (deg * Math.PI) / 180;
    // 繞前進軸（x）側傾：上方向 = (0, cosφ, sinφ)，φ > 0 時導輪頂往右牆（+z）傾
    car.chassis.setRotation({ x: Math.sin(phi / 2), y: 0, z: 0, w: Math.cos(phi / 2) }, true);
    const fr = car.rollers.find((r) => r.id === 'FR');
    const tier = fr.tiers[0];
    const r = tier.r / 1000;
    const hh = tier.h / 2000;
    const face = track.wallsAt(0)[0].d - track.dims.wallT / 2;
    const reach = r * Math.cos(phi) + hh * Math.abs(Math.sin(phi));
    const center = () => sim.localToWorld(car, { x: fr.x / 1000, y: (fr.y + tier.y) / 1000, z: fr.z / 1000 });
    // 把車往右移到靠牆那一緣剛好壓進牆面 0.3 mm
    const t = car.chassis.translation();
    const w0 = center();
    car.chassis.setTranslation({ x: t.x, y: t.y, z: t.z + (face - w0.z) - reach + 0.0003 }, true);
    const w = center();
    const c = sim.rollerWallContacts(env, car).find((q) => q.roller === 'FR' && q.tier === 0 && q.side === 1);
    expect(c, `${deg}°`).toBeDefined();
    expect(c.pen).toBeCloseTo(0.0003, 9);
    expect(c.n.y).toBe(0);
    expect(c.n.z).toBeCloseTo(-1, 9);
    // 接觸點：直立時在片中心高度；側傾時在靠牆那一緣（φ > 0 是頂緣，φ < 0 是底緣）
    const rim = Math.sign(phi);
    const yExpect = w.y + rim * hh * Math.cos(phi) - r * Math.sin(phi);
    expect(c.p.y, `${deg}°`).toBeCloseTo(deg === 0 ? w.y : yExpect, 9);
    // 舊的「軸鉛直」近似會差 r·(1 − cosφ) − (h/2)·|sinφ|
    const oldError = (r - reach) * 1000;
    console.log(`[P17 roller tilt] φ = ${deg}°：伸展 ${(reach * 1000).toFixed(4)} mm（鉛直近似 ${(r * 1000).toFixed(4)}，差 ${oldError.toFixed(4)} mm），接觸點高 ${((c.p.y - w.y) * 1000).toFixed(3)} mm（相對片中心）`);
  }
});

test('P17_split_dt 牆接觸（自訂共用求解）與地板／輪胎（Rapier）分步：步長減半後 2.5 s 行駛距離與貼牆比例的差 < 0.5%、< 1 個百分點（一階分步誤差已收斂）', async () => {
  const { buildCircuit } = await import('../src/track.js');
  const { spec } = await import('../src/spec.js');
  const dt0 = spec.sim.dt_s;
  try {
    for (const name of ['default', 'p7-demo']) {
      const asm = assemble(loadConfig(name));
      const res = [];
      for (const k of [1, 2]) {
        spec.sim.dt_s = dt0 / k;
        const track = buildCircuit();
        const env = sim.createWorld(track);
        const car = sim.createCar(env, { assembly: asm, s: 0.15, lane: 0 });
        const L = track.path.length;
        let last = 0.15;
        let dist = 0;
        let wall = 0;
        const n = Math.round(2.5 / spec.sim.dt_s);
        for (let i = 0; i < n; i++) {
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
          wall += +(sim.rollerWallContacts(env, car).length > 0);
        }
        res.push({ dist, wall: wall / n });
        env.world.free();
      }
      const rel = Math.abs(res[0].dist - res[1].dist) / res[1].dist;
      console.log(`[P17 split dt] ${name}：dt ${res[0].dist.toFixed(4)} m／dt/2 ${res[1].dist.toFixed(4)} m（差 ${(rel * 100).toFixed(3)}%），貼牆 ${(res[0].wall * 100).toFixed(1)}%／${(res[1].wall * 100).toFixed(1)}%`);
      expect(rel).toBeLessThan(0.005);
      expect(Math.abs(res[0].wall - res[1].wall)).toBeLessThan(0.01);
      expect(res[0].wall).toBeGreaterThan(0.3);
    }
  } finally {
    spec.sim.dt_s = dt0;
  }
}, 300000);
