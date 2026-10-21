// 第三階段：新零件的物理效果（P17）與干涉 / 安裝相容性（P18），定義見 SPEC.md 第 2 部分與 GOAL.md「驗證標準」
// 容許誤差寫在本檔並附理由，不得為通過而放寬。
// 所有替換只透過組裝設定（configs/*.json 或 slot 覆寫），模擬與規則檢查都用 src/ 的同一套程式（網頁也用這一套）。
import { describe, test, expect, beforeAll } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { assemble, loadConfig, listConfigs, SLOTS, OPTIONAL_SLOTS } from '../src/assembly.js';
import { validateAssembly } from '../src/regulation.js';
import { listParts } from '../src/parts/index.js';
import { listBodies, bodyMassProps } from '../src/bodies/index.js';
import { theoreticalTopSpeed } from '../src/powertrain.js';
import { buildStraight } from '../src/track.js';
import * as sim from '../src/sim.js';

/** @type {(x: number) => string} */
const f3 = (x) => x.toFixed(3);

/** @type {(over?: Record<string, any>, base?: string) => Record<string, any>} 組裝設定＋覆寫 */
const cfg = (over = {}, base = 'default') => ({ ...loadConfig(base), ...over });

beforeAll(async () => {
  await sim.initRapier();
});

// ---------------------------------------------------------------------------
// 模擬輔助
// ---------------------------------------------------------------------------

/**
 * 從靜止全速起步 seconds 秒，回傳速度歷程（每步）與最後速度
 * @type {(asm: any, seconds: number) => { v: number[], vEnd: number }}
 */
function launch(asm, seconds) {
  const env = sim.createWorld(buildStraight(100));
  const car = sim.createCar(env, { assembly: asm, s: 0.2, lane: 0, drain: false });
  const n = Math.round(seconds / env.world.timestep);
  const v = [];
  for (let i = 0; i < n; i++) {
    sim.stepCar(env, car);
    v.push(sim.forwardSpeed(car));
  }
  return { v, vEnd: v[v.length - 1], car };
}

/**
 * 直線上全速跑，回傳最後 0.5 s 的平均速度與整段煞車海綿是否碰過地面
 * @type {(asm: any, seconds: number) => { vSteady: number, spongeContactSteps: number }}
 */
function flatTopSpeed(asm, seconds) {
  const env = sim.createWorld(buildStraight(100));
  const car = sim.createCar(env, { assembly: asm, s: 0.2, lane: 0, drain: false });
  const dt = env.world.timestep;
  const n = Math.round(seconds / dt);
  const tail = Math.round(0.5 / dt);
  let sum = 0;
  let contact = 0;
  for (let i = 0; i < n; i++) {
    sim.stepCar(env, car);
    if (car.sponge?.contact) {
      contact++;
    }
    if (i >= n - tail) {
      sum += sim.forwardSpeed(car);
    }
  }
  return { vSteady: sum / tail, spongeContactSteps: contact };
}

/**
 * 下坡賽道（測試專用的幾何）：高 H 的平台 → 傾角 θ 的下坡 → 平地。車從平台上以初速 v0 斷電滑行，
 * 經過坡頂（會小跳躍、落在坡面）與坡底（凹折處，車尾懸伸會靠近坡面），量測坡底之後的速度
 * @type {(asm: any, v0: number) => { vAfter: number, spongeSteps: number, spongeWork: number, minUp: number }}
 */
function rampRun(asm, v0) {
  const env = sim.createWorld(buildStraight(4));
  const H = 0.03;
  const theta = (5 * Math.PI) / 180;
  const xc = 0.8;
  const xv = xc + H / Math.tan(theta);
  const hw = 0.055;
  const ground = env.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  // 平台（ABS 賽道同樣的地面摩擦 0.3，與 sim.createWorld 的地板相同）
  env.world.createCollider(RAPIER.ColliderDesc.cuboid((xc + 0.6) / 2, H / 2, hw).setTranslation((xc - 0.6) / 2, H / 2, 0).setFriction(0.3), ground);
  // 坡面：薄板繞 z 軸轉 −θ，頂面通過 (xc, H) 與 (xv, 0)
  const L = Math.hypot(xv - xc, H);
  const th = 0.004;
  const nx = Math.sin(theta);
  const ny = Math.cos(theta);
  env.world.createCollider(
    RAPIER.ColliderDesc.cuboid(L / 2, th / 2, hw)
      .setTranslation((xc + xv) / 2 - (nx * th) / 2, H / 2 - (ny * th) / 2, 0)
      .setRotation({ x: 0, y: 0, z: Math.sin(-theta / 2), w: Math.cos(-theta / 2) })
      .setFriction(0.3),
    ground,
  );
  const car = sim.createCar(env, { assembly: asm, s: 0.2, lane: 0, powered: false });
  for (const b of [car.chassis, ...car.dampers.map((d) => d.body)]) {
    const t = b.translation();
    b.setTranslation({ x: t.x, y: t.y + H, z: t.z }, true);
  }
  const dt = env.world.timestep;
  // 先讓車在平台上靜置落定 0.05 s，再給初速
  for (let i = 0; i < 0.05 / dt; i++) {
    sim.stepCar(env, car);
  }
  for (const b of [car.chassis, ...car.dampers.map((d) => d.body)]) {
    b.setLinvel({ x: v0, y: 0, z: 0 }, true);
  }
  let spongeSteps = 0;
  let minUp = 1;
  let vAfter = NaN;
  for (let i = 0; i < 3 / dt; i++) {
    sim.stepCar(env, car);
    if (car.sponge?.contact) {
      spongeSteps++;
    }
    minUp = Math.min(minUp, sim.upAxis(car).y);
    if (car.chassis.translation().x > xv + 0.3) {
      vAfter = car.chassis.linvel().x;
      break;
    }
  }
  return { vAfter, spongeSteps, spongeWork: car.sponge?.frictionWork ?? 0, minUp };
}

/**
 * 從高度 h（mm）水平落下（斷電、無水平速度），量測落地後車體的垂直彈跳：
 * 落地 15 ms 後車體原點的最高點（彈起高度）、四輪全部離地的累計時間（彈跳滯空）、落地 20 ms 後 |v_y| 的積分
 * @type {(asm: any, h_mm: number) => { rebound_mm: number, air_ms: number, sumVy_mm: number }}
 */
function dropTest(asm, h_mm) {
  const env = sim.createWorld(buildStraight(4));
  const car = sim.createCar(env, { assembly: asm, s: 0.5, lane: 0, powered: false });
  for (const b of [car.chassis, ...car.dampers.map((d) => d.body)]) {
    const t = b.translation();
    b.setTranslation({ x: t.x, y: t.y + h_mm / 1000, z: t.z }, true);
  }
  const dt = env.world.timestep;
  let landed = -1;
  let peak = -Infinity;
  let air = 0;
  let sumVy = 0;
  for (let i = 0; i < 0.4 / dt; i++) {
    sim.stepCar(env, car);
    const touching = car.wheels.some((w) => w.contact);
    if (landed < 0 && touching) {
      landed = i;
    }
    if (landed < 0) {
      continue;
    }
    if (!touching) {
      air += dt;
    }
    if (i > landed + 0.015 / dt) {
      peak = Math.max(peak, car.chassis.translation().y);
    }
    if (i > landed + 0.02 / dt) {
      sumVy += Math.abs(car.chassis.linvel().y) * dt;
    }
  }
  return { rebound_mm: peak * 1000, air_ms: air * 1000, sumVy_mm: sumVy * 1000 };
}

// ---------------------------------------------------------------------------
// P17：新零件的物理效果
// ---------------------------------------------------------------------------

describe('P17 新零件的物理效果（只透過組裝設定替換）', () => {
  test('P17_ballast 加配重 → 質量增加、重心往安裝點移動、起步加速度變小', () => {
    const base = assemble(cfg());
    const vBase = launch(base, 0.4);
    for (const mount of ['front', 'center', 'rear']) {
      const asm = assemble(cfg({ ballast: `ballast-hex-1g@${mount}` }));
      expect(validateAssembly(asm).ok).toBe(true);
      const run = launch(asm, 0.4);
      // 起步 0–0.4 s 的平均加速度（同一套積分器、同一步長，差異只來自質量與重心）
      const aBase = vBase.vEnd / 0.4;
      const a = run.vEnd / 0.4;
      console.log(`[P17] 配重 @${mount}：質量 ${f3(base.mass_g)} → ${f3(asm.mass_g)} g，重心 x ${f3(base.com_mm.x)} → ${f3(asm.com_mm.x)} mm，y ${f3(base.com_mm.y)} → ${f3(asm.com_mm.y)}；0.4 s 平均加速度 ${f3(aBase)} → ${f3(a)} m/s²`);
      expect(asm.mass_g - base.mass_g).toBeCloseTo(1.0, 6);
      expect(a).toBeLessThan(aBase);
      if (mount === 'front') {
        expect(asm.com_mm.x).toBeGreaterThan(base.com_mm.x);
      } else if (mount === 'rear') {
        expect(asm.com_mm.x).toBeLessThan(base.com_mm.x);
      } else {
        // 中央配重在齒輪蓋頂面（比整車重心高）→ 重心升高
        expect(asm.com_mm.y).toBeGreaterThan(base.com_mm.y);
      }
    }
  }, 120000);

  test('P17_brake_sponge 煞車海綿：平地不接觸、極速不變；下坡坡底接觸地面、減速較多', () => {
    const withSponge = assemble(cfg({}, 'race-frp'));
    const noSponge = assemble(cfg({ brakeSponge: null }, 'race-frp'));
    expect(validateAssembly(withSponge).ok).toBe(true);
    expect(validateAssembly(noSponge).ok).toBe(true);
    // (1) 平地全速：海綿底面離地 > 0，整段沒有接觸；極速差只來自海綿自身質量（< 0.05 g），容許 0.5%
    const fa = flatTopSpeed(withSponge, 5);
    const fb = flatTopSpeed(noSponge, 5);
    const rel = Math.abs(fa.vSteady - fb.vSteady) / fb.vSteady;
    console.log(`[P17] 平地 5 s：有海綿 ${f3(fa.vSteady)} m/s（接觸 ${fa.spongeContactSteps} 步，海綿底離地 ${f3(withSponge.groundClearance_mm)} mm）、無海綿 ${f3(fb.vSteady)} m/s，差 ${(rel * 100).toFixed(3)}%`);
    expect(fa.spongeContactSteps).toBe(0);
    expect(rel).toBeLessThan(0.005);
    // (2) 5° 下坡：坡底凹折處車尾懸伸靠近坡面 → 海綿接觸、摩擦做負功 → 坡底後速度較低
    const ra = rampRun(withSponge, 2.5);
    const rb = rampRun(noSponge, 2.5);
    console.log(`[P17] 下坡 5°、初速 2.5 m/s：有海綿 坡底後 ${f3(ra.vAfter)} m/s（接觸 ${ra.spongeSteps} 步、摩擦功 ${(ra.spongeWork * 1000).toFixed(2)} mJ）、無海綿 ${f3(rb.vAfter)} m/s`);
    expect(ra.spongeSteps).toBeGreaterThan(0);
    expect(ra.spongeWork).toBeGreaterThan(0);
    expect(rb.spongeSteps).toBe(0);
    expect(ra.vAfter).toBeLessThan(rb.vAfter);
    expect(ra.minUp).toBeGreaterThan(0.8);
  }, 180000);

  test('P17_roller19 19 mm 導輪 → 外框變寬、導輪接觸點外移（模擬碰撞體同一份資料）', () => {
    const a13 = assemble(cfg());
    const a19 = assemble(cfg({ rollers: 'roller-19' }));
    const outer = (asm) => Math.max(...asm.layout.rollers.map((r) => Math.abs(r.z) + r.r));
    console.log(`[P17] 外框寬 13 mm ${f3(a13.bbox_mm.size.z)} → 19 mm ${f3(a19.bbox_mm.size.z)} mm；導輪最外緣 ${f3(outer(a13))} → ${f3(outer(a19))} mm`);
    expect(a19.bbox_mm.size.z).toBeGreaterThan(a13.bbox_mm.size.z);
    expect(outer(a19)).toBeGreaterThan(outer(a13));
    // 物理碰撞體：導輪球的最外緣（車體座標）
    for (const [asm, expectOuter] of [[a13, outer(a13)], [a19, outer(a19)]]) {
      const env = sim.createWorld(buildStraight(2));
      const car = sim.createCar(env, { assembly: asm });
      const o = Math.max(...car.rollers.map((r) => Math.abs(r.collider.translation().z) + r.collider.shape.radius)) * 1000;
      expect(Math.abs(o - expectOuter)).toBeLessThan(1e-3);
    }
    // 寬導輪板＋19 mm 導輪超過 105 mm，規則檢查器擋下
    const tooWide = validateAssembly(assemble(cfg({ rearStay: 'stay-rear-carbon-wide', rollers: 'roller-19' })));
    expect(tooWide.violations.map((v) => v.code)).toContain('WIDTH');
  });

  test('P17_mass_damper 制振器可上下滑動 → 落地後垂直彈跳衰減較快（對照：同一顆鎖死當固定配重）', () => {
    for (const [name, over] of [
      ['後制振器', { rearStay: 'stay-rear-frp', massDamper: 'damper-rear-cylinder' }],
      ['側制振器', { massDamper: 'damper-side-square' }],
    ]) {
      const free = assemble(cfg(over));
      // 對照組：同一顆制振器用螺帽鎖死（locked，PARTS_RESEARCH H 節：官方說明可當固定配重）——質量、位置完全相同，只差能不能滑動
      const locked = assemble(cfg({ ...over, massDamper: { base: over.massDamper, locked: true } }));
      expect(free.mass_g).toBeCloseTo(locked.mass_g, 9);
      expect(free.movable.length).toBeGreaterThan(0);
      expect(locked.movable.length).toBe(0);
      // 物理引擎：車體剛體＋制振器剛體的質量合計 = 組裝質量（P14 的延伸）
      const env = sim.createWorld(buildStraight(2));
      const car = sim.createCar(env, { assembly: free });
      env.world.step();
      const m = (car.chassis.mass() + car.dampers.reduce((s, d) => s + d.body.mass(), 0)) * 1000;
      expect(Math.abs(m - free.mass_g)).toBeLessThan(0.1);
      // 100 mm 落下（約換道器橋面 80 mm 的高度，SPEC 1.10）
      const df = dropTest(free, 100);
      const dl = dropTest(locked, 100);
      console.log(`[P17] ${name} 100 mm 落下：可滑動 彈起 ${f3(df.rebound_mm)} mm、滯空 ${df.air_ms.toFixed(1)} ms、Σ|v_y| ${f3(df.sumVy_mm)} mm；鎖死 彈起 ${f3(dl.rebound_mm)} mm、滯空 ${dl.air_ms.toFixed(1)} ms、Σ|v_y| ${f3(dl.sumVy_mm)} mm`);
      expect(df.rebound_mm).toBeLessThan(dl.rebound_mm);
      expect(df.air_ms).toBeLessThanOrEqual(dl.air_ms);
      expect(df.sumVy_mm).toBeLessThan(dl.sumVy_mm);
    }
  }, 120000);

  test('P17_coast_energy 斷電滑行時整車動能單調不增（含制振器、煞車海綿的組裝）', () => {
    // 容許值：相鄰兩步動能增加量 ≤ 1e-7 J（約初始動能 0.4 J 的 2.5×10⁻⁷）。
    // 理由：射線輪的彈簧（靜態壓縮 0.3 mm）與制振器座墊在滑行中有微小的上下振動，位能與動能互換造成的數值起伏在 1e-8 J 等級；
    // 真的「自己加速」（例如阻力方向錯誤）會是每步 1e-4 J 以上，遠大於此值
    const TOL_J = 1e-7;
    for (const name of ['default', 'race-frp', 'carbon-damper']) {
      const asm = assemble(loadConfig(name));
      const env = sim.createWorld(buildStraight(60));
      const car = sim.createCar(env, { assembly: asm, s: 0.3, lane: 0, powered: false });
      const dt = env.world.timestep;
      // 先靜置落定，再給初速 2.5 m/s（全部剛體同速）
      for (let i = 0; i < 0.1 / dt; i++) {
        sim.stepCar(env, car);
      }
      for (const b of [car.chassis, ...car.dampers.map((d) => d.body)]) {
        b.setLinvel({ x: 2.5, y: 0, z: 0 }, true);
      }
      let prev = sim.carKineticEnergy(car);
      const e0 = prev;
      let maxRise = 0;
      for (let i = 0; i < 3 / dt; i++) {
        sim.stepCar(env, car);
        const e = sim.carKineticEnergy(car);
        maxRise = Math.max(maxRise, e - prev);
        prev = e;
      }
      console.log(`[P17] ${name} 斷電滑行 3 s：動能 ${f3(e0)} → ${prev.toExponential(3)} J，相鄰步最大增加 ${maxRise.toExponential(2)} J`);
      expect(prev).toBeLessThan(e0);
      expect(maxRise).toBeLessThanOrEqual(TOL_J);
    }
  }, 180000);

  test('P17_motor_gear_tire 馬達 / 齒輪 / 輪胎替換的變化方向符合物理', () => {
    const th = (over) => theoreticalTopSpeed({ assembly: assemble(cfg(over)), soc: 1 }).vTheory;
    const vStd = th({});
    const vHr = th({ motor: 'motor-high-rev' });
    const vSprint = th({ motor: 'motor-sprint' });
    const v35 = th({ gear: 'gear-3.5' });
    const v37 = th({ gear: 'gear-3.7' });
    const v40 = th({ gear: 'gear-4.0' });
    const v24 = th({ wheels: 'wheel-24-narrow' });
    console.log(`[P17] 理論極速：普通 ${f3(vStd)}、高轉速 ${f3(vHr)}、極速型 ${f3(vSprint)} m/s；齒輪 3.5 ${f3(v35)}、3.7 ${f3(v37)}、4.0 ${f3(v40)}；24 mm 胎 ${f3(v24)}`);
    expect(vSprint).toBeGreaterThan(vHr);
    expect(vHr).toBeGreaterThan(vStd);
    expect(v37).toBeLessThan(v35);
    expect(v37).toBeGreaterThan(v40);
    expect(v24).toBeLessThan(vStd);
    // 扭力型馬達堵轉扭力較大 → 起步 0.15 s 的速度較高
    const s = launch(assemble(cfg()), 0.15).vEnd;
    const t = launch(assemble(cfg({ motor: 'motor-torque' })), 0.15).vEnd;
    console.log(`[P17] 起步 0.15 s：普通馬達 ${f3(s)} m/s、扭力型 ${f3(t)} m/s`);
    expect(t).toBeGreaterThan(s);
    // 低摩擦胎：μ 由零件資料傳到物理參數
    expect(assemble(cfg({ wheels: 'wheel-26-lowfriction' })).P.tireMu).toBeLessThan(assemble(cfg()).P.tireMu);
  }, 120000);
});

// ---------------------------------------------------------------------------
// P18：干涉與安裝相容性
// ---------------------------------------------------------------------------

/**
 * 獨立檢查的取樣與模糊帶：測試自己用 0.25 mm 立方格取樣零件體積（誤差 ≤ 0.22 mm，半對角線），
 * 再以 26 個方向、距離 d 的探針判斷「離對方 ≤ d」（方向離散造成的低估 ≤ 11%）。
 * 「明確干涉」= 有格點在 HIT_D = 0.75 mm 內（保證實際間隙 < 1 mm）；
 * 「明確不干涉」= 沒有格點在 CLEAR_D = 1.4 mm 內（保證實際間隙 ≥ 1.4 × 0.89 − 0.22 ≈ 1.03 mm）；
 * 其餘為模糊帶，不比對（記錄數量）。帶外的組合，規則檢查器必須和獨立檢查一致
 */
const GRID = 0.25;
const HIT_D = 0.75;
const CLEAR_D = 1.4;

/** @type {(s: any) => { min: any, max: any }} 測試自己的外框計算 */
function boxOf(s) {
  if (s.kind === 'box') {
    return s;
  }
  if (s.kind === 'cyl') {
    const h = { x: s.r, y: s.r, z: s.r };
    h[s.axis] = s.halfLen;
    return { min: { x: s.c.x - h.x, y: s.c.y - h.y, z: s.c.z - h.z }, max: { x: s.c.x + h.x, y: s.c.y + h.y, z: s.c.z + h.z } };
  }
  const xs = s.outline.map((p) => p[0]);
  const zs = s.outline.map((p) => p[1]);
  return { min: { x: Math.min(...xs), y: s.y0, z: Math.min(...zs) }, max: { x: Math.max(...xs), y: s.y1, z: Math.max(...zs) } };
}

/** @type {(x: number, z: number, poly: number[][]) => boolean} */
function inPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** @type {(x: number, y: number, z: number, s: any) => boolean} 點在實體內 */
function inside(x, y, z, s) {
  if (s.kind === 'box') {
    return x >= s.min.x && x <= s.max.x && y >= s.min.y && y <= s.max.y && z >= s.min.z && z <= s.max.z;
  }
  if (s.kind === 'cyl') {
    const [a, b, c] = s.axis === 'z' ? [x - s.c.x, y - s.c.y, z - s.c.z] : [x - s.c.x, z - s.c.z, y - s.c.y];
    return a * a + b * b <= s.r * s.r && Math.abs(c) <= s.halfLen;
  }
  return y >= s.y0 && y <= s.y1 && inPoly(x, z, s.outline);
}

/** @type {(x: number, y: number, z: number, s: any, d: number) => boolean} 點離實體是否 ≤ d（近似，見 HIT_D / CLEAR_D 說明） */
function nearWithin(x, y, z, s, d) {
  // 點與實體的距離 ≤ d ⟺ 以點為中心、半徑 d 的球與實體相交；用球面＋球心 26 個方向取樣（測試用的保守近似，誤差由 HIT_D / CLEAR_D 吸收）
  if (inside(x, y, z, s)) {
    return true;
  }
  for (const dx of [-1, 0, 1]) {
    for (const dy of [-1, 0, 1]) {
      for (const dz of [-1, 0, 1]) {
        const n = Math.hypot(dx, dy, dz);
        if (n === 0) {
          continue;
        }
        if (inside(x + (dx / n) * d, y + (dy / n) * d, z + (dz / n) * d, s)) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * 獨立檢查兩實體是否「間隙 < d」：在 A 的體積內以 GRID 格點取樣（只取 B 外框外擴 d 的範圍），任一點與 B 的距離 ≤ d 就算
 * @type {(A: any, B: any, d: number) => boolean}
 */
function closerThan(A, B, d) {
  const a = boxOf(A);
  const b = boxOf(B);
  const lo = { x: Math.max(a.min.x, b.min.x - d), y: Math.max(a.min.y, b.min.y - d), z: Math.max(a.min.z, b.min.z - d) };
  const hi = { x: Math.min(a.max.x, b.max.x + d), y: Math.min(a.max.y, b.max.y + d), z: Math.min(a.max.z, b.max.z + d) };
  if (lo.x > hi.x || lo.y > hi.y || lo.z > hi.z) {
    return false;
  }
  for (let x = lo.x; x <= hi.x + 1e-9; x += GRID) {
    for (let y = lo.y; y <= hi.y + 1e-9; y += GRID) {
      for (let z = lo.z; z <= hi.z + 1e-9; z += GRID) {
        if (inside(x, y, z, A) && nearWithin(x, y, z, B, d)) {
          return true;
        }
      }
    }
  }
  return false;
}

/** @type {Map<string, 'hit' | 'clear' | 'band'>} */
const oracleCache = new Map();

/**
 * 獨立檢查的判定：明確干涉（間隙 < 1）、明確不干涉（間隙 ≥ 1.03）、或在模糊帶內
 * @type {(A: any, B: any) => 'hit' | 'clear' | 'band'}
 */
function oracle(A, B) {
  const key = JSON.stringify([A, B]);
  const hit = oracleCache.get(key);
  if (hit) {
    return hit;
  }
  let r;
  if (closerThan(A, B, HIT_D) || closerThan(B, A, HIT_D)) {
    r = 'hit';
  } else if (closerThan(A, B, CLEAR_D) || closerThan(B, A, CLEAR_D)) {
    r = 'band';
  } else {
    r = 'clear';
  }
  oracleCache.set(key, r);
  return r;
}

/** 測試端的群組順序與不檢查的安裝關係（照 SPEC / EXTENDING 的定義重寫一份，不 import 實作） */
const ORDER = ['ballast', 'damper', 'sponge', 'stay', 'roller', 'tire'];
const MOUNTED = new Set(['sponge|stay', 'ballast|stay', 'damper|stay']);

/**
 * 由組裝結果的零件實體（asm.layout、asm.optional、導輪板外形）獨立算出應有的干涉代碼
 * @type {(asm: any) => { expected: Set<string>, ambiguous: Set<string> }}
 */
function expectedClearanceCodes(asm) {
  const lift = asm.lift_mm;
  /** @type {{ group: string, solid: any }[]} */
  const items = [];
  for (const w of asm.layout.wheels) {
    items.push({ group: 'tire', solid: { kind: 'cyl', axis: 'z', c: { x: w.x, y: w.y - lift, z: w.z }, r: w.r, halfLen: w.width / 2 } });
  }
  for (const r of asm.layout.rollers) {
    items.push({ group: 'roller', solid: { kind: 'cyl', axis: 'y', c: { x: r.x, y: r.y - lift, z: r.z }, r: r.r, halfLen: r.h / 2 } });
  }
  for (const slot of ['frontStay', 'rearStay']) {
    const pl = asm.partsBySlot[slot].plate;
    if (pl) {
      items.push({ group: 'stay', solid: { kind: 'plate', outline: pl.outline, y0: pl.y_mm, y1: pl.y_mm + pl.thickness_mm } });
    }
  }
  for (const d of asm.optional.dampers) {
    items.push({ group: 'damper', solid: d.swept });
  }
  if (asm.optional.sponge) {
    items.push({ group: 'sponge', solid: asm.optional.sponge.solid });
  }
  if (asm.optional.ballast) {
    items.push({ group: 'ballast', solid: asm.optional.ballast.solid });
  }
  const expected = new Set();
  const ambiguous = new Set();
  /** @type {(code: string, verdict: string) => void} */
  const add = (code, verdict) => {
    if (verdict === 'hit') {
      expected.add(code);
    } else if (verdict === 'band') {
      ambiguous.add(code);
    }
  };
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const A = items[i];
      const B = items[j];
      if (A.group === B.group && A.group !== 'roller') {
        continue;
      }
      if (MOUNTED.has(`${A.group}|${B.group}`) || MOUNTED.has(`${B.group}|${A.group}`)) {
        continue;
      }
      const [P, Q] = ORDER.indexOf(A.group) <= ORDER.indexOf(B.group) ? [A, B] : [B, A];
      add(`${P.group.toUpperCase()}_${Q.group.toUpperCase()}_CLEARANCE`, oracle(P.solid, Q.solid));
    }
  }
  // 零件與車殼：車殼頂點落在零件外擴 1 mm 內就算干涉（頂點來自 bodies/index.js 的車殼網格）
  const verts = bodyMassProps(asm.body.def).vertices;
  for (const it of items.filter((q) => !['tire', 'roller'].includes(q.group))) {
    const key = JSON.stringify([asm.body.id, it.solid]);
    let v = oracleCache.get(key);
    if (!v) {
      const b = boxOf(it.solid);
      v = 'clear';
      for (let k = 0; k < verts.length; k += 3) {
        const x = verts[k];
        const y = verts[k + 1];
        const z = verts[k + 2];
        if (x < b.min.x - 1.5 || x > b.max.x + 1.5 || y < b.min.y - 1.5 || y > b.max.y + 1.5 || z < b.min.z - 1.5 || z > b.max.z + 1.5) {
          continue;
        }
        if (nearWithin(x, y, z, it.solid, HIT_D)) {
          v = 'hit';
          break;
        }
        if (nearWithin(x, y, z, it.solid, CLEAR_D)) {
          v = 'band';
        }
      }
      oracleCache.set(key, v);
    }
    add(`${it.group.toUpperCase()}_BODY_CLEARANCE`, v);
  }
  return { expected, ambiguous };
}

/**
 * 測試端獨立寫的安裝相容性規則（由零件資料判斷，不呼叫實作）：
 * 齒輪 compat.chassisLayouts、零件 compat.requires vs 底盤 / 導輪架 features、配重安裝點、單軸馬達
 * @type {(asm: any) => Set<string>}
 */
function expectedCompatCodes(asm) {
  const p = asm.partsBySlot;
  const codes = new Set();
  if (p.gear.compat?.chassisLayouts && !p.gear.compat.chassisLayouts.includes(p.chassis.motorLayout)) {
    codes.add('GEAR_CHASSIS');
  }
  const feats = new Set([...(p.chassis.features ?? []), ...(p.frontStay.features ?? []), ...(p.rearStay.features ?? [])]);
  for (const part of Object.values(p)) {
    if ((part?.compat?.requires ?? []).some((f) => !feats.has(f))) {
      codes.add('MOUNT_COMPAT');
    }
  }
  if (p.ballast && !p.ballast.mountPoints.includes(p.ballast.mount)) {
    codes.add('MOUNT_COMPAT');
  }
  if ((p.motor.shaft === 'dual') !== (p.chassis.motorLayout === 'dual-shaft')) {
    codes.add('MOTOR_CLASS');
  }
  return codes;
}

/** 每個 slot 的所有選項（零件 id、配重安裝點變化、選配 slot 的 null、車殼） */
function slotOptions() {
  /** @type {Record<string, any[]>} */
  const opts = {};
  for (const [slot, category] of Object.entries(SLOTS)) {
    const parts = listParts(category);
    /** @type {any[]} */
    const values = [];
    for (const part of parts) {
      if (part.mountPoints) {
        for (const m of part.mountPoints) {
          values.push(`${part.id}@${m}`);
        }
      } else {
        values.push(part.id);
      }
    }
    if (OPTIONAL_SLOTS.includes(slot)) {
      values.push(null);
    }
    if (values.length > 1) {
      opts[slot] = values;
    }
  }
  opts.body = listBodies().map((b) => b.id);
  return opts;
}

const CLEARANCE_RE = /_CLEARANCE$/;
const COMPAT_CODES = new Set(['GEAR_CHASSIS', 'MOUNT_COMPAT', 'MOTOR_CLASS']);

describe('P18 干涉與安裝相容性', () => {
  test('P18_configs 所有 configs/*.json 都合法（含第三階段示範設定）', () => {
    const names = listConfigs();
    expect(names).toEqual(expect.arrayContaining(['default', 'race-frp', 'carbon-damper']));
    for (const n of names) {
      const res = validateAssembly(assemble(loadConfig(n)));
      console.log(`[P18] config ${n}：ok=${res.ok} ${JSON.stringify(res.violations.map((v) => v.code))}`);
      expect(res.ok, `${n}: ${res.violations.map((v) => v.message).join('；')}`).toBe(true);
    }
  });

  test('P18_known_cases 指定的干涉 / 裝不上組合回傳正確代碼', () => {
    const cases = [
      { over: { gear: 'gear-4.2' }, codes: ['GEAR_CHASSIS'] },
      { over: { motor: 'motor-single-standard' }, codes: ['MOTOR_CLASS'] },
      { over: { massDamper: 'damper-rear-cylinder' }, codes: ['MOUNT_COMPAT'] },
      { over: { ballast: 'ballast-hex-1g@roof' }, codes: ['MOUNT_COMPAT'] },
      { over: { rearStay: 'stay-rear-carbon-wide', rollers: 'roller-19' }, codes: ['WIDTH'] },
      { over: { rollers: 'roller-13-12-double' }, codes: ['ROLLER_ROLLER_CLEARANCE'] },
      { over: { brakeSponge: 'sponge-1mm-strong', ballast: 'ballast-hex-1g@rear' }, codes: ['BALLAST_SPONGE_CLEARANCE'] },
      { over: { rearStay: 'stay-rear-frp', brakeSponge: 'sponge-3mm-mild' }, codes: ['GROUND_CLEARANCE'] },
      { over: { ballast: 'ballast-square-3.6g@front' }, codes: ['GROUND_CLEARANCE'] },
      { over: { rearStay: 'stay-rear-frp', frontStay: 'stay-front-frp', rollers: 'roller-19', massDamper: 'damper-rear-cylinder' }, codes: ['LENGTH'] },
      // FRP 後導輪板的臂靠近後輪：換 31 mm 大徑輪會碰到（車殼是否也干涉依車殼輪拱而定，只要求包含 STAY_TIRE_CLEARANCE）
      { over: { rearStay: 'stay-rear-frp', wheels: 'wheel-31-large' }, contains: 'STAY_TIRE_CLEARANCE' },
    ];
    for (const c of cases) {
      const res = validateAssembly(assemble(cfg(c.over)));
      const codes = res.violations.map((v) => v.code);
      console.log(`[P18] ${JSON.stringify(c.over)} → ${JSON.stringify(codes)}`);
      expect(res.ok).toBe(false);
      if (c.contains) {
        expect(codes).toContain(c.contains);
      } else {
        expect(codes).toEqual(c.codes);
      }
    }
    // 合法的對照：雙層導輪＋單層的碳纖寬後板、FRP 後板＋後制振器
    for (const over of [{ rollers: 'roller-13-12-double', rearStay: 'stay-rear-carbon-wide' }, { rearStay: 'stay-rear-frp', massDamper: 'damper-rear-cylinder' }]) {
      const res = validateAssembly(assemble(cfg(over)));
      expect(res.ok, JSON.stringify(res.violations)).toBe(true);
    }
  });

  test('P18_pairwise 所有零件槽的替代款兩兩組合：干涉 / 相容性代碼和獨立檢查一致，有問題的組合一律擋下', () => {
    const opts = slotOptions();
    const slots = Object.keys(opts);
    const base = loadConfig('default');
    let total = 0;
    let blocked = 0;
    let skippedBand = 0;
    const seenCodes = new Set();
    /** @type {string[]} */
    const mismatches = [];
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        for (const vi of opts[slots[i]]) {
          for (const vj of opts[slots[j]]) {
            const config = { ...base, [slots[i]]: vi, [slots[j]]: vj };
            const asm = assemble(config);
            const res = validateAssembly(asm);
            total++;
            const got = res.violations.map((v) => v.code);
            got.forEach((c) => seenCodes.add(c));
            const gotClear = new Set(got.filter((c) => CLEARANCE_RE.test(c) && !c.startsWith('BODY_') && c !== 'GROUND_CLEARANCE'));
            const gotCompat = new Set(got.filter((c) => COMPAT_CODES.has(c)));
            const { expected, ambiguous } = expectedClearanceCodes(asm);
            skippedBand += ambiguous.size;
            const label = `${slots[i]}=${vi}, ${slots[j]}=${vj}`;
            for (const c of expected) {
              if (!gotClear.has(c)) {
                mismatches.push(`${label}：應有 ${c}，規則檢查器沒有回報`);
              }
            }
            for (const c of gotClear) {
              if (!expected.has(c) && !ambiguous.has(c)) {
                mismatches.push(`${label}：規則檢查器回報 ${c}，獨立檢查認為間隙 ≥ 1.03 mm`);
              }
            }
            const expCompat = expectedCompatCodes(asm);
            if ([...expCompat].sort().join() !== [...gotCompat].sort().join()) {
              mismatches.push(`${label}：相容性代碼 ${JSON.stringify([...gotCompat])}，應為 ${JSON.stringify([...expCompat])}`);
            }
            if (expected.size > 0 || expCompat.size > 0) {
              blocked++;
              if (res.ok) {
                mismatches.push(`${label}：有干涉 / 裝不上，但 ok = true`);
              }
            }
          }
        }
      }
    }
    console.log(`[P18] 兩兩組合 ${total} 組（slot：${slots.map((s) => `${s}×${opts[s].length}`).join('、')}），獨立檢查判定有干涉 / 裝不上 ${blocked} 組，模糊帶略過 ${skippedBand} 項；出現過的代碼 ${[...seenCodes].sort().join('、')}`);
    if (mismatches.length > 0) {
      console.log(mismatches.slice(0, 30).join('\n'));
    }
    expect(mismatches).toEqual([]);
    // 至少涵蓋這些干涉 / 相容性代碼（GOAL：導輪架–輪胎、導輪–導輪、制振器 / 配重–車殼、煞車海綿、齒輪 / 馬達 / 安裝點）
    for (const c of ['STAY_TIRE_CLEARANCE', 'ROLLER_ROLLER_CLEARANCE', 'DAMPER_BODY_CLEARANCE', 'BALLAST_BODY_CLEARANCE', 'BALLAST_SPONGE_CLEARANCE', 'GEAR_CHASSIS', 'MOTOR_CLASS', 'MOUNT_COMPAT']) {
      expect(seenCodes.has(c), `兩兩組合中沒有出現 ${c}`).toBe(true);
    }
  }, 600000);
});
