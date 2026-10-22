// 第三階段：新零件的物理效果（P17）與干涉 / 安裝相容性（P18），定義見 SPEC.md 第 2 部分與 GOAL.md「驗證標準」
// 容許誤差寫在本檔並附理由，不得為通過而放寬。
// 所有替換只透過組裝設定（configs/*.json 或 slot 覆寫），模擬與規則檢查都用 src/ 的同一套程式（網頁也用這一套）。
import { describe, test, expect, beforeAll } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { assemble, loadConfig, listConfigs, SLOTS, OPTIONAL_SLOTS } from '../src/assembly.js';
import { validateAssembly } from '../src/regulation.js';
import { listParts } from '../src/parts/index.js';
import { listBodies, bodyMassProps } from '../src/bodies/index.js';
import { theoreticalTopSpeed, longitudinalForce, motorOperatingPoint, batteryResistanceAt, Battery } from '../src/powertrain.js';
import * as powertrainApi from '../src/powertrain.js';
import { spec } from '../src/spec.js';
import { buildStraight, buildCircuit } from '../src/track.js';
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

  test('P17_brake_plate_carbon 碳纖大面積煞車架（台灣買得到）：海綿貼片面積大 → 接觸剛性 k = E·A/t 大；平地仍不接觸、極速不變；下坡坡底同樣接觸、摩擦做負功，坡底後速度不高於 FRP 架', () => {
    const frp = assemble(cfg({}, 'race-frp'));
    const carbon = assemble(cfg({ brakePlate: 'brake-plate-carbon' }, 'race-frp'));
    expect(validateAssembly(frp).ok).toBe(true);
    expect(validateAssembly(carbon).ok).toBe(true);
    const sf = frp.optional.sponge;
    const sc = carbon.optional.sponge;
    // 質量 = 面積 × 厚度 × 密度（煞車架與海綿都由同一份貼片尺寸推導）
    const plateMass = (s, bp) => ((s.length_mm + 2 * bp.margin_mm) * (s.width_mm + 2 * bp.margin_mm) * bp.thickness_mm * bp.density_g_cm3) / 1000;
    console.log(`[P17] 煞車架：FRP 貼片 ${sf.area_mm2} mm²、架 ${sf.plate.mass_g.toFixed(3)} g；碳纖 貼片 ${sc.area_mm2} mm²、架 ${sc.plate.mass_g.toFixed(3)} g；離地 ${f3(frp.groundClearance_mm)} / ${f3(carbon.groundClearance_mm)} mm`);
    expect(sc.area_mm2).toBeGreaterThan(sf.area_mm2);
    expect(Math.abs(sc.plate.mass_g - plateMass(sc, carbon.partsBySlot.brakePlate))).toBeLessThan(1e-9);
    expect(Math.abs(sf.plate.mass_g - plateMass(sf, frp.partsBySlot.brakePlate))).toBeLessThan(1e-9);
    // 煞車架只改面積不改高度 → 離地相同
    expect(carbon.groundClearance_mm).toBeCloseTo(frp.groundClearance_mm, 9);
    // 平地：不接觸，極速差只來自質量（< 0.5 g），容許 0.5%（同 P17_brake_sponge）
    const fa = flatTopSpeed(carbon, 5);
    const fb = flatTopSpeed(frp, 5);
    const rel = Math.abs(fa.vSteady - fb.vSteady) / fb.vSteady;
    console.log(`[P17] 平地 5 s：碳纖 ${f3(fa.vSteady)}（接觸 ${fa.spongeContactSteps} 步）、FRP ${f3(fb.vSteady)} m/s，差 ${(rel * 100).toFixed(3)}%`);
    expect(fa.spongeContactSteps).toBe(0);
    expect(rel).toBeLessThan(0.005);
    // 下坡：兩者都接觸、摩擦都做負功
    const ra = rampRun(carbon, 2.5);
    const rb = rampRun(frp, 2.5);
    console.log(`[P17] 下坡 5°、初速 2.5 m/s：碳纖 坡底後 ${f3(ra.vAfter)} m/s（接觸 ${ra.spongeSteps} 步、摩擦功 ${(ra.spongeWork * 1000).toFixed(2)} mJ）、FRP ${f3(rb.vAfter)} m/s（${rb.spongeSteps} 步、${(rb.spongeWork * 1000).toFixed(2)} mJ）`);
    expect(ra.spongeSteps).toBeGreaterThan(0);
    expect(ra.spongeWork).toBeGreaterThan(0);
    expect(ra.minUp).toBeGreaterThan(0.8);
    // 接觸剛性較大 → 同樣的壓入量法向力較大 → 摩擦功較多、坡底後速度不高於 FRP（差異很小，PARTS_RESEARCH AE 節已預期）
    expect(ra.spongeWork).toBeGreaterThan(rb.spongeWork);
    expect(ra.vAfter).toBeLessThanOrEqual(rb.vAfter);
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

  test('P17_roller_ring 第五階段導輪（台灣買得到）：橡膠環 μ 大 → 過彎減速較多；塑膠環 μ 小 → 過彎較快；直線不碰牆時與摩擦無關；17 mm 外框介於 13 / 19 mm', () => {
    // 主賽道從換道器前出發跑 4 s：記錄彎道平均速度與前進距離（導輪只在彎道貼牆，切向摩擦力 = Rapier 接觸摩擦 min(導輪 μ, 牆 μ) × 法向力）
    /** @type {(over: Record<string, any>) => { arcV: number, dist: number }} */
    const corner = (over) => {
      const asm = assemble(cfg(over));
      expect(validateAssembly(asm).ok, JSON.stringify(over)).toBe(true);
      const track = buildCircuit();
      const env = sim.createWorld(track);
      const car = sim.createCar(env, { assembly: asm, s: 0.15, lane: 0 });
      const L = track.path.length;
      let lastS = 0.15;
      let dist = 0;
      let arcV = 0;
      let arcN = 0;
      const n = Math.round(4 / env.world.timestep);
      for (let i = 0; i < n; i++) {
        sim.stepCar(env, car);
        const t = car.chassis.translation();
        const c = track.path.project(t.x, t.z);
        let ds = c.s - lastS;
        if (ds < -L / 2) {
          ds += L;
        }
        dist += ds;
        lastS = c.s;
        if (c.seg.type === 'arc') {
          arcV += sim.forwardSpeed(car);
          arcN++;
        }
      }
      return { arcV: arcV / arcN, dist };
    };
    const alu = corner({ rollers: 'roller-19' });
    const rubber = corner({ rollers: 'roller-19-rubber' });
    const plastic = corner({ rollers: 'roller-19-plastic-ring' });
    // 對照：同一顆導輪（質量、尺寸相同）只把 μ 換成鋁導輪的 0.05 → 證明差異來自牆面摩擦，不是質量
    const rubberMu05 = corner({ rollers: { base: 'roller-19-rubber', wallFriction: 0.05 } });
    const plasticMu05 = corner({ rollers: { base: 'roller-19-plastic-ring', wallFriction: 0.05 } });
    console.log(`[P17] 4 s 前進距離 / 彎道平均速度：塑膠環 ${f3(plastic.dist)} m / ${f3(plastic.arcV)}、鋁 19 ${f3(alu.dist)} / ${f3(alu.arcV)}、橡膠環 ${f3(rubber.dist)} / ${f3(rubber.arcV)}；對照 μ=0.05：橡膠環款 ${f3(rubberMu05.dist)} / ${f3(rubberMu05.arcV)}、塑膠環款 ${f3(plasticMu05.dist)} / ${f3(plasticMu05.arcV)}`);
    expect(plastic.arcV).toBeGreaterThan(alu.arcV);
    expect(alu.arcV).toBeGreaterThan(rubber.arcV);
    expect(plastic.dist).toBeGreaterThan(alu.dist);
    expect(alu.dist).toBeGreaterThan(rubber.dist);
    expect(rubber.arcV).toBeLessThan(rubberMu05.arcV);
    expect(plastic.arcV).toBeGreaterThan(plasticMu05.arcV);

    // 直線（不碰牆）：摩擦不同、其他相同的兩台車極速相同（接觸類零件只在實際接觸時受力）
    const straightRubber = flatTopSpeed(assemble(cfg({ rollers: 'roller-19-rubber' })), 4);
    const straightMu05 = flatTopSpeed(assemble(cfg({ rollers: { base: 'roller-19-rubber', wallFriction: 0.05 } })), 4);
    const dv = Math.abs(straightRubber.vSteady - straightMu05.vSteady) / straightMu05.vSteady;
    console.log(`[P17] 直線極速：橡膠環 ${f3(straightRubber.vSteady)}、同款 μ=0.05 ${f3(straightMu05.vSteady)} m/s（差 ${(dv * 100).toFixed(4)}%）`);
    // 容許 0.1%：同一份組裝只差導輪 μ，直線不碰牆 → 理論上完全相同，只留浮點誤差的空間
    expect(dv).toBeLessThan(0.001);

    // 17 mm 全鋁：外框寬介於 13 mm 與 19 mm 之間（同一孔位、半徑差）；17 mm 穩定頭只能配 19 mm 前導輪
    const w = (over) => assemble(cfg(over)).bbox_mm.size.z;
    console.log(`[P17] 全寬：13 mm ${f3(w({}))}、17 mm ${f3(w({ rollers: 'roller-17-alu' }))}、19 mm ${f3(w({ rollers: 'roller-19' }))} mm`);
    expect(w({ rollers: 'roller-17-alu' })).toBeGreaterThan(w({}));
    expect(w({ rollers: 'roller-17-alu' })).toBeLessThan(w({ rollers: 'roller-19' }));
  }, 180000);

  test('P17_phase5_motor_tire_damper 第五階段（台灣買得到）：Rev-Tuned 2 PRO 高轉速低扭力；31 mm 低摩擦胎直線同標準 31 mm、過彎側滑損失較小；MA 側制振器組只有配重會滑動', () => {
    // 不裝 iter-55 會變動的致敬車殼：用比賽型 pc-box（31 mm 輪合法）
    const base = { body: 'body-pc-box' };
    /** @type {(over: Record<string, any>) => any} */
    const A = (over) => {
      const asm = assemble(cfg({ ...base, ...over }));
      expect(validateAssembly(asm).ok, JSON.stringify(over)).toBe(true);
      return asm;
    };
    const std = A({});
    const rev = A({ motor: 'motor-rev' });
    const hr = A({ motor: 'motor-high-rev' });
    const th = (asm) => theoreticalTopSpeed({ assembly: asm }).vTheory;
    const v03 = (asm) => launch(asm, 0.3).vEnd;
    console.log(`[P17] 馬達：理論極速 標準 ${f3(th(std))} / Rev ${f3(th(rev))} / 高轉速 ${f3(th(hr))} m/s；0.3 s 起步 標準 ${f3(v03(std))} / Rev ${f3(v03(rev))} / 高轉速 ${f3(v03(hr))} m/s`);
    // 無載轉速高 → 理論極速遠高於標準馬達；堵轉扭力（3.50 mN·m）比高轉速型（5.3 mN·m）低 → 起步比高轉速型慢
    expect(th(rev)).toBeGreaterThan(th(std) * 1.5);
    expect(v03(rev)).toBeLessThan(v03(hr));

    // 31 mm 低摩擦胎 vs 標準 31 mm：直徑、質量相同 → 理論極速相同、直線極速相同；只差 μ（0.4 vs 0.7）
    const w31 = A({ wheels: 'wheel-31-large' });
    const w31lf = A({ wheels: 'wheel-31-lowfriction' });
    expect(Math.abs(w31lf.mass_g - w31.mass_g)).toBeLessThan(1e-9);
    const s31 = flatTopSpeed(w31, 4).vSteady;
    const s31lf = flatTopSpeed(w31lf, 4).vSteady;
    // 主賽道 4 s：彎道中輪胎側滑的摩擦損失 ∝ μ → 低摩擦胎前進較遠
    /** @type {(asm: any) => number} */
    const dist4 = (asm) => {
      const track = buildCircuit();
      const env = sim.createWorld(track);
      const car = sim.createCar(env, { assembly: asm, s: 0.15, lane: 0 });
      const L = track.path.length;
      let last = 0.15;
      let d = 0;
      for (let i = 0; i < Math.round(4 / env.world.timestep); i++) {
        sim.stepCar(env, car);
        const t = car.chassis.translation();
        const c = track.path.project(t.x, t.z);
        let ds = c.s - last;
        if (ds < -L / 2) {
          ds += L;
        }
        d += ds;
        last = c.s;
      }
      return d;
    };
    const d31 = dist4(w31);
    const d31lf = dist4(w31lf);
    console.log(`[P17] 31 mm：直線極速 標準 ${f3(s31)} / 低摩擦 ${f3(s31lf)} m/s；主賽道 4 s 前進 標準 ${f3(d31)} / 低摩擦 ${f3(d31lf)} m`);
    // 容許 0.5%：直線上兩者只差 μ，輪胎未打滑時與 μ 無關
    expect(Math.abs(s31lf - s31) / s31).toBeLessThan(0.005);
    expect(d31lf).toBeGreaterThan(d31);

    // MA 側制振器組：總質量多 2 ×（8.3 黃銅＋0.9 FRP 側板）；可滑動的只有 2 顆黃銅（側板鎖在底盤）
    const noD = assemble(cfg({ body: null }));
    const d32 = assemble(cfg({ body: null, massDamper: 'damper-side-square-32' }));
    const movable = d32.movable.reduce((sum, m) => sum + m.mass_g, 0);
    console.log(`[P17] 側制振器組：總重 ${f3(noD.mass_g)} → ${f3(d32.mass_g)} g，可滑動 ${f3(movable)} g（${d32.movable.length} 顆）`);
    expect(Math.abs(d32.mass_g - noD.mass_g - 2 * (8.3 + 0.9))).toBeLessThan(1e-6);
    expect(d32.movable.length).toBe(2);
    expect(Math.abs(movable - 2 * 8.3)).toBeLessThan(1e-9);
  }, 240000);

  test('P17_counter_shaft 中間齒輪軸（台灣買得到）：塑膠軸承時 含氟塗層軸 / 中間齒輪培林組 → 中間齒輪損失變小、極速較高、斷電滑行減速較少；輪軸用培林時含氟軸沒有作用；9 / 11 mm 培林導輪外框較窄且能正常過彎', () => {
    const { counterGearLossFraction } = powertrainApi;
    /** @type {(over: Record<string, any>) => any} */
    const A = (over) => {
      const asm = assemble(cfg(over));
      expect(validateAssembly(asm).ok, JSON.stringify(over)).toBe(true);
      return asm;
    };
    const bush = A({ bearings: 'bushing-plastic' });
    const bushPtfe = A({ bearings: 'bushing-plastic', counterShaft: 'gear-shaft-ptfe' });
    const bushCb = A({ bearings: 'bushing-plastic', counterShaft: 'counter-bearing-520' });
    const ball = A({});
    const ballPtfe = A({ counterShaft: 'gear-shaft-ptfe' });
    const kc = (asm) => counterGearLossFraction(asm.P);
    const th = (asm) => theoreticalTopSpeed({ assembly: asm }).vTheory;
    console.log(`[P17] 中間齒輪損失 k_c：塑膠軸承 標準軸 ${kc(bush).toFixed(4)} / 含氟軸 ${kc(bushPtfe).toFixed(4)} / 培林組 ${kc(bushCb).toFixed(4)}；滾珠培林 標準 ${kc(ball).toFixed(4)} / 含氟 ${kc(ballPtfe).toFixed(4)}；理論極速 ${f3(th(bush))} / ${f3(th(bushPtfe))} / ${f3(th(bushCb))} m/s`);
    expect(kc(bushPtfe)).toBeLessThan(kc(bush));
    expect(kc(bushCb)).toBeLessThan(kc(bushPtfe));
    expect(th(bushPtfe)).toBeGreaterThan(th(bush));
    expect(th(bushCb)).toBeGreaterThan(th(bushPtfe));
    // 輪軸用滾珠培林時中間齒輪也是培林（套件 bearing-620 含 520）：含氟軸不和軸承滑動 → 完全沒有差別
    expect(kc(ballPtfe)).toBe(kc(ball));
    expect(th(ballPtfe)).toBe(th(ball));
    // 質量：培林組的 520 培林（0.2 g ×2）取代塑膠中間齒輪軸承（0.1 g ×2）
    expect(Math.abs(bushCb.mass_g - bush.mass_g - 2 * (0.2 - 0.1))).toBeLessThan(1e-9);

    // 模擬：直線全速 3 s 後斷電 1 s，損失小的減速少
    /** @type {(asm: any) => { v0: number, dv: number }} */
    const coast = (asm) => {
      const env = sim.createWorld(buildStraight(100));
      const car = sim.createCar(env, { assembly: asm, s: 0.2, lane: 0, drain: false });
      const dt = env.world.timestep;
      for (let i = 0; i < 3 / dt; i++) {
        sim.stepCar(env, car);
      }
      const v0 = sim.forwardSpeed(car);
      car.powered = false;
      for (let i = 0; i < 1 / dt; i++) {
        sim.stepCar(env, car);
      }
      return { v0, dv: v0 - sim.forwardSpeed(car) };
    };
    const cBush = coast(bush);
    const cPtfe = coast(bushPtfe);
    const cCb = coast(bushCb);
    console.log(`[P17] 塑膠軸承：3 s 車速 標準軸 ${f3(cBush.v0)} / 含氟軸 ${f3(cPtfe.v0)} / 培林組 ${f3(cCb.v0)} m/s；斷電 1 s 減速 ${f3(cBush.dv)} / ${f3(cPtfe.dv)} / ${f3(cCb.dv)} m/s`);
    expect(cPtfe.v0).toBeGreaterThan(cBush.v0);
    expect(cCb.v0).toBeGreaterThan(cPtfe.v0);
    expect(cPtfe.dv).toBeLessThan(cBush.dv);
    expect(cCb.dv).toBeLessThan(cPtfe.dv);

    // 9 / 11 mm 培林導輪：外框寬 9 < 11 < 13 mm；主賽道 4 s 不穿牆（≤ 1 mm，同 P06）、不翻車
    const w = (over) => A(over).bbox_mm.size.z;
    console.log(`[P17] 全寬：9 mm ${f3(w({ rollers: 'roller-9-bearing' }))}、11 mm ${f3(w({ rollers: 'roller-11-bearing' }))}、13 mm ${f3(w({}))} mm`);
    expect(w({ rollers: 'roller-9-bearing' })).toBeLessThan(w({ rollers: 'roller-11-bearing' }));
    expect(w({ rollers: 'roller-11-bearing' })).toBeLessThan(w({}));
    for (const id of ['roller-9-bearing', 'roller-11-bearing']) {
      const track = buildCircuit();
      const env = sim.createWorld(track);
      const car = sim.createCar(env, { assembly: A({ rollers: id }), s: 0.15, lane: 0 });
      let maxPen = 0;
      let minUp = 1;
      for (let i = 0; i < Math.round(4 / env.world.timestep); i++) {
        sim.stepCar(env, car);
        maxPen = Math.max(maxPen, sim.wallPenetration(env, car));
        minUp = Math.min(minUp, sim.upAxis(car).y);
      }
      console.log(`[P17] ${id} 主賽道 4 s：最大穿牆 ${(maxPen * 1000).toFixed(3)} mm、最小 up.y ${f3(minUp)}`);
      expect(maxPen).toBeLessThanOrEqual(0.001);
      expect(minUp).toBeGreaterThan(0.8);
    }
  }, 240000);

  test('P17_mass_damper 制振器可上下滑動 → 落地後垂直彈跳衰減較快（對照：同一顆鎖死當固定配重）', () => {
    for (const [name, over] of [
      ['後制振器', { rearStay: 'stay-rear-frp', massDamper: 'damper-rear-cylinder' }],
      ['側制振器', { massDamper: 'damper-side-square' }],
      // 第五階段（iter-58）：MA 側制振器組 6×6×32 mm（FRP 側板固定在底盤，只有黃銅方塊滑動）；不裝車殼（側制振器與多數車殼干涉，見 P18）
      ['MA 側制振器組 32 mm', { massDamper: 'damper-side-square-32', body: null }],
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
// P17（第四階段 iter-54）：傳動系轉動慣量、新馬達、電池、輪胎 / 輪框、低電阻端子、中空輪軸
// ---------------------------------------------------------------------------

/**
 * 解析對照：沿直線的一維縱向運動 (m + J/r²)·dv/dt = F_q(v) − 空氣阻力，F_q 用與模擬相同的 longitudinalForce（同一套動力鏈程式），
 * 以 RK4 積分到 t 秒（電池不放電，同 launch()）。J = 0 時就是第三階段的準靜態模型
 * @type {(asm: any, seconds: number, J: number) => number}
 */
function launchTheory(asm, seconds, J) {
  const P = asm.P;
  const battery = new Battery(P, 1);
  const mEff = P.massTotal + J / (P.wheelRadius * P.wheelRadius);
  /** @type {(v: number) => number} */
  const acc = (v) => {
    const lf = longitudinalForce(P, { speed: v, powered: true, battery });
    return (lf.drive - (v > 0 ? lf.resist : 0) - P.airDragK * v * v) / mEff;
  };
  const h = 0.0005;
  let v = 0;
  for (let t = 0; t < seconds - 1e-12; t += h) {
    const k1 = acc(v);
    const k2 = acc(v + (h / 2) * k1);
    const k3 = acc(v + (h / 2) * k2);
    const k4 = acc(v + h * k3);
    v += (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
  }
  return v;
}

describe('P17 第四階段零件的物理效果（只透過組裝設定替換）', () => {
  test('P17_spin_inertia 傳動系轉動慣量：J_eq = Σ I·n²（電樞 × 齒輪比²），起步速度符合 (m + J/r²) 的解析解；滑行中傳動系的轉動動能 = ½Jω²、ω·r ≈ v', () => {
    const asm = assemble(cfg());
    const sp = asm.spec.spin;
    const r = asm.P.wheelRadius;
    const sum = Object.values(sp.reflected_gmm2).reduce((a, b) => a + b, 0);
    console.log(`[P17] J_eq 組成（g·mm²，換算到輪軸）：${JSON.stringify(Object.fromEntries(Object.entries(sp.reflected_gmm2).map(([k, v]) => [k, Number(v.toFixed(1))])))}；合計 ${sp.total_gmm2.toFixed(1)} g·mm² → 等效質量 J/r² = ${f3(sp.equivalentMass_g)} g（整車 ${f3(asm.mass_g)} g）`);
    expect(sp.total_gmm2).toBeCloseTo(sum, 9);
    expect(asm.P.spinInertia).toBeCloseTo(sp.total_gmm2 * 1e-9, 15);
    expect(sp.equivalentMass_g).toBeCloseTo(sp.total_gmm2 / (r * 1000) ** 2, 9);
    // 電樞慣量經齒輪比放大 G²：4.0:1 的馬達項 / 3.5:1 的馬達項 = (4.0 / 3.5)²
    const a40 = assemble(cfg({ gear: 'gear-4.0' }));
    expect(a40.spec.spin.reflected_gmm2.motor / sp.reflected_gmm2.motor).toBeCloseTo((4.0 / 3.5) ** 2, 9);

    // 起步 0.3 s：模擬速度與 (m + J/r²) 的解析解比較（容許 3%：射線輪的接地彈簧與前後輪載重轉移造成的差異，第三階段 P01 量到 < 1%）；
    // 並且要比 J = 0 的解析解更接近模擬（確認轉動慣量確實進入模擬，不是只算了數字）
    const T = 0.3;
    const simV = launch(asm, T).vEnd;
    const thJ = launchTheory(asm, T, asm.P.spinInertia);
    const th0 = launchTheory(asm, T, 0);
    const errJ = Math.abs(simV - thJ) / thJ;
    console.log(`[P17] 起步 ${T} s：模擬 ${f3(simV)} m/s；解析（含 J）${f3(thJ)}（誤差 ${(errJ * 100).toFixed(2)}%），解析（J = 0）${f3(th0)} m/s`);
    expect(errJ).toBeLessThan(0.03);
    expect(Math.abs(simV - thJ)).toBeLessThan(Math.abs(simV - th0));
    expect(th0).toBeGreaterThan(thJ);

    // 滑行：傳動系角速度跟著車速（純滾動），轉動動能 = ½·J·ω² > 0
    const env = sim.createWorld(buildStraight(30));
    const car = sim.createCar(env, { assembly: asm, s: 0.2, lane: 0, drain: false });
    for (let i = 0; i < 0.5 / env.world.timestep; i++) {
      sim.stepCar(env, car);
    }
    car.powered = false;
    for (let i = 0; i < 0.1 / env.world.timestep; i++) {
      sim.stepCar(env, car);
    }
    const v = sim.forwardSpeed(car);
    const wr = car.spin.omega * r;
    const eRot = 0.5 * car.spin.J * car.spin.omega ** 2;
    console.log(`[P17] 斷電 0.1 s 後：車速 ${f3(v)} m/s、傳動系輪面速度 ω·r ${f3(wr)} m/s、轉動動能 ${(eRot * 1000).toFixed(3)} mJ（總動能 ${(sim.carKineticEnergy(car) * 1000).toFixed(3)} mJ）`);
    expect(Math.abs(wr - v) / v).toBeLessThan(0.01);
    expect(eRot).toBeGreaterThan(0);
  }, 120000);

  test('P17_traction_limit 驅動力超過輪胎摩擦（極速型馬達）時：起步打滑（傳動系輪面速度 > 車速），車速不會超過理論極速（傳動慣量模型不得產生多餘的推力）', () => {
    const asm = assemble(cfg({ motor: 'motor-sprint', body: null }));
    const th = theoreticalTopSpeed({ assembly: asm, soc: 1 }).vTheory;
    const env = sim.createWorld(buildStraight(100));
    const car = sim.createCar(env, { assembly: asm, s: 0.2, lane: 0, drain: false });
    const dt = env.world.timestep;
    let vMax = 0;
    let slipMax = 0;
    for (let i = 0; i < 5 / dt; i++) {
      sim.stepCar(env, car);
      const v = sim.forwardSpeed(car);
      vMax = Math.max(vMax, v);
      if (i < 0.2 / dt) {
        slipMax = Math.max(slipMax, car.spin.omega * asm.P.wheelRadius - v);
      }
    }
    const vEnd = sim.forwardSpeed(car);
    console.log(`[P17] 極速型馬達（無車殼）：理論極速 ${f3(th)} m/s，5 s 內最高車速 ${f3(vMax)}、5 s 時 ${f3(vEnd)} m/s；起步 0.2 s 內最大打滑 ω·r − v = ${f3(slipMax)} m/s`);
    expect(slipMax).toBeGreaterThan(0.05);
    // 容許 2%：與 P01 同樣的射線輪 / 載重轉移差異（P01 量到 < 1%）
    expect(vMax).toBeLessThan(th * 1.02);
  }, 120000);

  test('P17_light_rotating 輕量鏤空輪框 / 中空輪軸 → J_eq 與質量變小、起步加速度變大、極速基本不變；海綿胎 → μ 高、輪子慣量小、滾阻大', () => {
    const base = assemble(cfg());
    const vBase = launch(base, 0.3).vEnd;
    const thBase = theoreticalTopSpeed({ assembly: base, soc: 1 }).vTheory;
    for (const over of [{ wheels: 'wheel-26-lightweight' }, { axles: 'axle-hex-60-hollow' }]) {
      const asm = assemble(cfg(over));
      expect(validateAssembly(asm).ok).toBe(true);
      const v = launch(asm, 0.3).vEnd;
      const th = theoreticalTopSpeed({ assembly: asm, soc: 1 }).vTheory;
      const dTop = Math.abs(th - thBase) / thBase;
      console.log(`[P17] ${JSON.stringify(over)}：質量 ${f3(base.mass_g)} → ${f3(asm.mass_g)} g，J_eq ${base.spec.spin.total_gmm2.toFixed(1)} → ${asm.spec.spin.total_gmm2.toFixed(1)} g·mm²；0.3 s 平均加速度 ${f3(vBase / 0.3)} → ${f3(v / 0.3)} m/s²（+${(((v - vBase) / vBase) * 100).toFixed(2)}%）；理論極速 ${f3(thBase)} → ${f3(th)} m/s（差 ${(dTop * 100).toFixed(3)}%）`);
      expect(asm.mass_g).toBeLessThan(base.mass_g);
      expect(asm.spec.spin.total_gmm2).toBeLessThanOrEqual(base.spec.spin.total_gmm2);
      expect(v).toBeGreaterThan(vBase);
      // 極速只因質量變輕使滾動 / 軸承阻力略降（< 0.5%），轉動慣量不影響穩態極速
      expect(dTop).toBeLessThan(0.005);
    }
    // 輕量輪框：同一顆輪胎，只有輪框腹板鏤空 → 單顆輪子慣量變小
    const lw = assemble(cfg({ wheels: 'wheel-26-lightweight' }));
    expect(lw.spec.spin.perItem_gmm2.wheel).toBeLessThan(base.spec.spin.perItem_gmm2.wheel);
    // 海綿胎：μ 高、滾阻大、輪子慣量小（輕）
    const sp = assemble(cfg({ wheels: 'wheel-24-sponge' }));
    expect(validateAssembly(sp).ok).toBe(true);
    console.log(`[P17] 海綿胎：μ ${base.P.tireMu} → ${sp.P.tireMu}、C_rr ${base.P.crr} → ${sp.P.crr}、單顆輪子慣量 ${base.spec.spin.perItem_gmm2.wheel.toFixed(1)} → ${sp.spec.spin.perItem_gmm2.wheel.toFixed(1)} g·mm²`);
    expect(sp.P.tireMu).toBeGreaterThan(base.P.tireMu);
    expect(sp.P.crr).toBeGreaterThan(base.P.crr);
    expect(sp.spec.spin.perItem_gmm2.wheel).toBeLessThan(base.spec.spin.perItem_gmm2.wheel);
    // 超硬胎 / 拱形胎：μ 低於標準胎；拱形胎滾阻小
    expect(assemble(cfg({ wheels: 'wheel-26-superhard' })).P.tireMu).toBeLessThan(base.P.tireMu);
    expect(assemble(cfg({ wheels: 'wheel-31-arched' })).P.crr).toBeLessThan(base.P.crr);
  }, 120000);

  test('P17_new_motors 原子型 / 高衝刺型 / 極速型（iter-54 依玩家實測修正）的特性與方向', () => {
    const th = (id) => theoreticalTopSpeed({ assembly: assemble(cfg({ motor: id })), soc: 1 });
    const rpm = (id) => (assemble(cfg({ motor: id })).P.omega0Rated * 60) / (2 * Math.PI);
    const ids = ['motor-standard', 'motor-atomic', 'motor-torque', 'motor-high-rev', 'motor-hyper', 'motor-sprint'];
    const res = Object.fromEntries(ids.map((id) => [id, th(id).vTheory]));
    console.log(`[P17] 馬達 6 級：無載 rpm ${ids.map((id) => `${id} ${Math.round(rpm(id))}`).join('、')}；理論極速 ${ids.map((id) => `${id} ${f3(res[id])}`).join('、')} m/s`);
    for (const id of ids) {
      expect(validateAssembly(assemble(cfg({ motor: id }))).ok).toBe(true);
    }
    // 極速型無載轉速 = 玩家實測約 31,000 rpm（[TOYZ2] 3.0 V 穩壓 30,442–31,492）
    expect(Math.abs(rpm('motor-sprint') - 31000)).toBeLessThan(500);
    expect(res['motor-hyper']).toBeGreaterThan(res['motor-high-rev']);
    expect(res['motor-sprint']).toBeGreaterThan(res['motor-hyper']);
    expect(res['motor-atomic']).toBeGreaterThan(res['motor-standard']);
    // 原子型堵轉扭力（6.37 mN·m）> 普通馬達 → 起步較快
    const s = launch(assemble(cfg()), 0.15).vEnd;
    const a = launch(assemble(cfg({ motor: 'motor-atomic' })), 0.15).vEnd;
    console.log(`[P17] 起步 0.15 s：普通 ${f3(s)}、原子型 ${f3(a)} m/s`);
    expect(a).toBeGreaterThan(s);
  }, 120000);

  test('P17_battery 鹼性 vs NiMH：開路電壓高但內阻大 → 小電流端電壓較高、大電流較低；鹼性內阻隨放電上升；高容量 NiMH 較重 → 起步較慢', () => {
    const ni = assemble(cfg());
    const al = assemble(cfg({ battery: 'battery-aa-alkaline' }));
    const hi = assemble(cfg({ battery: 'battery-aa-nimh-2500' }));
    for (const a of [al, hi]) {
      expect(validateAssembly(a).violations.map((v) => v.code)).not.toContain('BATTERY');
    }
    const bNi = new Battery(ni.P, 1);
    const bAl = new Battery(al.P, 1);
    /** 端電壓 = OCV − I·R_b（同一個電流下比較） */
    const vt = (asm, b, I) => b.ocv() - I * batteryResistanceAt(asm.P, b.soc);
    console.log(`[P17] 開路：NiMH ${f3(bNi.ocv())} V、鹼性 ${f3(bAl.ocv())} V；內阻（2 顆）NiMH ${f3(batteryResistanceAt(ni.P, 1))} Ω、鹼性 滿 ${f3(batteryResistanceAt(al.P, 1))} / SOC 20% ${f3(batteryResistanceAt(al.P, 0.2))} Ω；0.3 A 端電壓 NiMH ${f3(vt(ni, bNi, 0.3))} / 鹼性 ${f3(vt(al, bAl, 0.3))} V；2.5 A 端電壓 NiMH ${f3(vt(ni, bNi, 2.5))} / 鹼性 ${f3(vt(al, bAl, 2.5))} V`);
    expect(bAl.ocv()).toBeGreaterThan(bNi.ocv());
    expect(batteryResistanceAt(al.P, 1)).toBeGreaterThan(batteryResistanceAt(ni.P, 1));
    expect(vt(al, bAl, 0.3)).toBeGreaterThan(vt(ni, bNi, 0.3));
    expect(vt(al, bAl, 2.5)).toBeLessThan(vt(ni, bNi, 2.5));
    expect(batteryResistanceAt(al.P, 0.2)).toBeGreaterThan(batteryResistanceAt(al.P, 1));
    // 馬達堵轉（ω = 0，電流最大）時，鹼性的電池端電壓掉得比 NiMH 多
    const opNi = motorOperatingPoint(ni.P, bNi.ocv(), 0, batteryResistanceAt(ni.P, 1));
    const opAl = motorOperatingPoint(al.P, bAl.ocv(), 0, batteryResistanceAt(al.P, 1));
    expect(bAl.ocv() - opAl.terminalVoltage).toBeGreaterThan(bNi.ocv() - opNi.terminalVoltage);
    // 高容量 NiMH：容量大，但每顆 30 g（+22 g）、內阻 50 mΩ → 起步較慢
    expect(hi.P.capacity_C).toBeGreaterThan(ni.P.capacity_C);
    expect(hi.mass_g - ni.mass_g).toBeCloseTo(22, 6);
    const vNi = launch(ni, 0.3).vEnd;
    const vHi = launch(hi, 0.3).vEnd;
    console.log(`[P17] 起步 0.3 s：NiMH 950 ${f3(vNi)}、NiMH 2500 ${f3(vHi)} m/s`);
    expect(vHi).toBeLessThan(vNi);
  }, 120000);

  test('P17_terminal 低電阻（鍍金）端子 → 迴路電阻降低、馬達端電壓與極速提高；疊加端子違規', () => {
    const std = assemble(cfg());
    const gold = assemble(cfg({ switch: 'switch-gold-terminal' }));
    expect(validateAssembly(gold).ok).toBe(true);
    expect(gold.P.circuitResistance).toBeLessThan(std.P.circuitResistance);
    // 同一轉速（同車速）下比較：迴路電阻較低 → 電流較大、馬達端電壓較高
    const omega = 1000;
    const opS = motorOperatingPoint(std.P, 2.8, omega);
    const opG = motorOperatingPoint(gold.P, 2.8, omega);
    const thS = theoreticalTopSpeed({ assembly: std, soc: 1 }).vTheory;
    const thG = theoreticalTopSpeed({ assembly: gold, soc: 1 }).vTheory;
    const simS = flatTopSpeed(std, 5).vSteady;
    const simG = flatTopSpeed(gold, 5).vSteady;
    console.log(`[P17] 迴路電阻 ${(std.P.circuitResistance * 1000).toFixed(1)} → ${(gold.P.circuitResistance * 1000).toFixed(1)} mΩ；ω = ${omega} rad/s 馬達端電壓 ${f3(opS.motorVoltage)} → ${f3(opG.motorVoltage)} V；理論極速 ${f3(thS)} → ${f3(thG)}、模擬 ${f3(simS)} → ${f3(simG)} m/s`);
    expect(opG.motorVoltage).toBeGreaterThan(opS.motorVoltage);
    expect(opG.current).toBeGreaterThan(opS.current);
    expect(thG).toBeGreaterThan(thS);
    expect(simG).toBeGreaterThan(simS);
    const dbl = validateAssembly(assemble(cfg({ switch: 'switch-double-terminal' })));
    expect(dbl.violations.map((v) => v.code)).toEqual(['TERMINAL_MOD']);
  }, 120000);
});

/**
 * 側傾貼牆測試（第四階段穩定零件）：直線賽道上把車體繞前進軸（x）往右牆（+z）側傾 rollDeg、車頭往牆偏 5°（像彎道中前導輪先貼牆，後導輪離牆約 12 mm），
 * 抬高到右側車輪剛好不陷入地面，橫向擺到「導輪 / 穩定零件最外緣」離牆面 0.3 mm，再給 0.3 m/s 的朝牆速度，跑 30 ms（斷電）。
 * 回傳穩定零件的接觸步數與最大法向力、導輪是否碰牆
 * @type {(asm: any, rollDeg: number) => { stabSteps: number, stabMaxN: number, rollerHit: boolean }}
 */
function rollIntoWall(asm, rollDeg) {
  const track = buildStraight(4);
  const env = sim.createWorld(track);
  const car = sim.createCar(env, { assembly: asm, s: 0.5, lane: 0, powered: false });
  const a = (rollDeg * Math.PI) / 180;
  // 先側傾（繞車體 x）再偏航（繞世界 y，−5° = 車頭朝 +z）：q = q_yaw ⊗ q_roll
  const psi = (-5 * Math.PI) / 180;
  const [sx, cx, sy, cy] = [Math.sin(a / 2), Math.cos(a / 2), Math.sin(psi / 2), Math.cos(psi / 2)];
  const q = { x: cy * sx, y: cx * sy, z: -sy * sx, w: cy * cx };
  car.chassis.setRotation(q, true);
  const halfTrack = asm.spec.chassis.trackWidth_mm / 2 + asm.partsBySlot.wheels.width_mm / 2;
  const t0 = car.chassis.translation();
  car.chassis.setTranslation({ x: t0.x, y: (halfTrack * Math.sin(a) + 0.5) / 1000, z: 0 }, true);
  // 最外緣（世界 z）：導輪圓盤與穩定零件圓柱（側傾後外緣 = 中心 z + r·cos + (h/2)·sin）
  /** @type {(c: { x: number, y: number, z: number }, r: number, h: number) => number} */
  const outer = (c, r, h) => sim.localToWorld(car, { x: c.x / 1000, y: c.y / 1000, z: c.z / 1000 }).z + ((r * Math.cos(a) + (h / 2) * Math.sin(a)) / 1000);
  const rollerOuter = Math.max(...car.rollers.map((r) => outer(r, r.r, r.h)));
  const lift = asm.lift_mm;
  const stabOuter = Math.max(-Infinity, ...(asm.optional.stabilizers ?? []).map((st) => outer({ ...st.pos, y: st.pos.y + lift }, st.r, st.h)));
  const face = track.wallsAt(0)[0].d - track.dims.wallT / 2;
  const shift = face - 0.0003 - Math.max(rollerOuter, stabOuter);
  const t1 = car.chassis.translation();
  car.chassis.setTranslation({ x: t1.x, y: t1.y, z: t1.z + shift }, true);
  car.chassis.setLinvel({ x: 0, y: 0, z: 0.3 }, true);
  let stabSteps = 0;
  let stabMaxN = 0;
  let rollerHit = false;
  for (let i = 0; i < 0.03 / env.world.timestep; i++) {
    sim.stepCar(env, car);
    for (const st of car.stabilizers) {
      if (st.contact) {
        stabSteps++;
        stabMaxN = Math.max(stabMaxN, st.normalForce);
      }
    }
    if (car.rollers.some((r) => sim.minWallContactDist(env, r.collider) <= 0.0005)) {
      rollerHit = true;
    }
  }
  return { stabSteps, stabMaxN, rollerHit };
}

describe('P17 第四階段接觸零件（穩定零件、錐形導輪）', () => {
  test('P17_stabilizer 穩定柱 / 穩定頭：平地直線沒有接觸力、極速不變；車身側傾碰牆時才有接觸力', () => {
    for (const [name, over] of [
      // 不裝車殼（body: null）：只驗證穩定零件本身的接觸（車殼清單 / 預設車殼由主線調整；穩定頭與車殼的干涉見 P18_known_cases）
      ['穩定柱 φ8', { stabilizer: 'stabilizer-tube-8', body: null }],
      ['17 mm 穩定頭＋19 mm 導輪', { stabilizer: 'stabilizer-head-17', rollers: 'roller-19', body: null }],
    ]) {
      const withS = assemble(cfg(over));
      const noS = assemble(cfg({ ...over, stabilizer: null }));
      expect(validateAssembly(withS).ok, JSON.stringify(validateAssembly(withS).violations)).toBe(true);
      // (1) 平地全速 5 s：穩定零件整段沒有接觸；極速差只來自穩定零件質量（≈ 2 g，阻力 ∝ 質量 → < 0.5%）
      const env = sim.createWorld(buildStraight(100));
      const car = sim.createCar(env, { assembly: withS, s: 0.2, lane: 0, drain: false });
      const dt = env.world.timestep;
      const n = Math.round(5 / dt);
      const tail = Math.round(0.5 / dt);
      let sum = 0;
      let contacts = 0;
      for (let i = 0; i < n; i++) {
        sim.stepCar(env, car);
        contacts += car.stabilizers.filter((st) => st.contact).length;
        if (i >= n - tail) {
          sum += sim.forwardSpeed(car);
        }
      }
      const vS = sum / tail;
      const vN = flatTopSpeed(noS, 5).vSteady;
      const rel = Math.abs(vS - vN) / vN;
      // (2) 側傾 20° 貼牆：穩定零件外緣越過導輪外緣 → 碰牆、有法向力；(3) 不側傾：只有導輪碰牆，穩定零件沒有力
      const tilted = rollIntoWall(withS, 20);
      const upright = rollIntoWall(withS, 0);
      console.log(`[P17] ${name}：平地 5 s 接觸 ${contacts} 步，極速 有 ${f3(vS)} / 無 ${f3(vN)} m/s（差 ${(rel * 100).toFixed(3)}%）；側傾 20° 貼牆 接觸 ${tilted.stabSteps} 步、最大法向力 ${f3(tilted.stabMaxN)} N；直立貼牆 接觸 ${upright.stabSteps} 步（導輪碰牆 ${upright.rollerHit}）`);
      expect(contacts).toBe(0);
      expect(rel).toBeLessThan(0.005);
      expect(tilted.stabSteps).toBeGreaterThan(0);
      expect(tilted.stabMaxN).toBeGreaterThan(0);
      expect(upright.stabSteps).toBe(0);
      expect(upright.rollerHit).toBe(true);
    }
  }, 180000);

  test('P17_tapered_roller 錐形導輪：牆面接觸法向水平；騎上牆頂時接觸法向帶向上分量（≈ sin 34°），撞擊衝量讓車體向上；同姿勢的圓柱導輪沒有垂直分量', () => {
    const tapered = assemble(cfg({ rollers: 'roller-13-tapered', body: null }, 'race-frp'));
    const plain = assemble(cfg({ rollers: 'roller-13-alu', body: null }, 'race-frp'));
    expect(validateAssembly(tapered).ok, JSON.stringify(validateAssembly(tapered).violations)).toBe(true);
    const taper = tapered.partsBySlot.frontRollers.taper;
    const betaExpect = Math.atan2((13 - taper.bottomDiameter_mm) / 2, taper.coneHeight_mm);
    /**
     * 擺姿勢：直立、右前導輪（FR）中心橫向離牆面 = 錐形段在牆頂高度的半徑 − 0.3 mm；高度讓牆頂落在 FR 錐形段中間；朝牆速度 0.2 m/s
     * @type {(asm: any, onTop: boolean) => { contacts: any[], dvy: number }}
     */
    const pose = (asm, onTop) => {
      const track = buildStraight(4);
      const env = sim.createWorld(track);
      const car = sim.createCar(env, { assembly: asm, s: 0.5, lane: 0, powered: false });
      // 先走一步讓 Rapier 套用組裝的質量與慣性（createCar 的 additional mass properties 在第一次 step 才生效）
      env.world.step();
      car.chassis.setLinvel({ x: 0, y: 0, z: 0 }, true);
      car.chassis.setAngvel({ x: 0, y: 0, z: 0 }, true);
      const fr = car.rollers.find((r) => r.id === 'FR');
      const wallTop = track.dims.wallH;
      const face = track.wallsAt(0)[0].d - track.dims.wallT / 2;
      // 錐形段中間的高度（相對導輪中心）：頂面往下 h_c + h_k/2；圓柱導輪用同一個高度比較
      const yMidCone = (fr.h / 2 - taper.cylinderHeight_mm - taper.coneHeight_mm / 2) / 1000;
      const rAtMid = (taper.bottomDiameter_mm / 2 + (13 / 2 - taper.bottomDiameter_mm / 2) / 2) / 1000;
      const t = car.chassis.translation();
      // onTop：牆頂在錐形段中間；否則（對照）：車在地面、碰牆面（牆頂遠高於導輪）
      const y = onTop ? wallTop - (fr.y / 1000 + yMidCone) : t.y;
      const reach = onTop ? rAtMid : fr.r / 1000;
      car.chassis.setTranslation({ x: t.x, y, z: face - fr.z / 1000 - reach + 0.0003 }, true);
      car.chassis.setLinvel({ x: 0, y: 0, z: 0.2 }, true);
      const contacts = sim.rollerWallContacts(env, car).filter((c) => c.roller === 'FR');
      const vy0 = car.chassis.linvel().y;
      sim.wallContactImpulses(env, car);
      return { contacts, dvy: car.chassis.linvel().y - vy0 };
    };
    const tTop = pose(tapered, true);
    const tFace = pose(tapered, false);
    const pTop = pose(plain, true);
    const n = tTop.contacts[0]?.n;
    console.log(`[P17] 錐形導輪騎牆頂：接觸 ${tTop.contacts.length} 個，法向 (${f3(n?.x ?? NaN)}, ${f3(n?.y ?? NaN)}, ${f3(n?.z ?? NaN)})，向上分量 ${f3(n?.y ?? NaN)}（幾何 sin β = ${f3(Math.sin(betaExpect))}，β = ${((betaExpect * 180) / Math.PI).toFixed(1)}°），撞擊後車體 Δv_y ${(tTop.dvy * 1000).toFixed(2)} mm/s；碰牆面 法向 y ${f3(tFace.contacts[0]?.n.y ?? NaN)}、Δv_y ${(tFace.dvy * 1000).toFixed(3)} mm/s；圓柱導輪同姿勢 法向 y ${f3(pTop.contacts[0]?.n.y ?? NaN)}、Δv_y ${(pTop.dvy * 1000).toFixed(3)} mm/s`);
    expect(tTop.contacts.length).toBeGreaterThan(0);
    expect(n.y).toBeCloseTo(Math.sin(betaExpect), 6);
    // 水平分量把導輪推回車道（−z，離開右牆）
    expect(n.z).toBeLessThan(0);
    expect(tTop.dvy).toBeGreaterThan(0);
    // 牆面接觸（一般行駛）：法向水平，不產生垂直分力
    expect(tFace.contacts.length).toBeGreaterThan(0);
    expect(tFace.contacts[0].n.y).toBe(0);
    // 圓柱導輪在同樣高度：牆頂邊緣碰的是圓柱面 → 法向水平
    expect(pTop.contacts.length).toBeGreaterThan(0);
    expect(pTop.contacts[0].n.y).toBe(0);
    expect(Math.abs(pTop.dvy)).toBeLessThan(Math.abs(tTop.dvy) * 0.05);
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
const ORDER = ['ballast', 'damper', 'sponge', 'stabilizer', 'stay', 'roller', 'tire'];
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
  // 第四階段：穩定零件（前導輪上方的圓柱）
  for (const st of asm.optional.stabilizers ?? []) {
    items.push({ group: 'stabilizer', solid: st.solid });
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
      // ---- 第四階段（iter-54）----
      { over: { switch: 'switch-double-terminal' }, codes: ['TERMINAL_MOD'] },
      { over: { rearStay: 'stay-rear-frp', wheels: 'wheel-31-arched' }, contains: 'STAY_TIRE_CLEARANCE' },
      { over: { stabilizer: 'stabilizer-head-17', body: null }, codes: ['STABILIZER_ROLLER_SIZE'] },
      { over: { rollers: 'roller-13-tapered', body: null }, codes: ['ROLLER_TAPER_MOUNT'] },
      { over: { stabilizer: 'stabilizer-head-17', rollers: 'roller-19', body: 'body-aero-wing' }, codes: ['STABILIZER_BODY_CLEARANCE'] },
      // ---- 第五階段（iter-56）：前後導輪分開選 ----
      { over: { frontRollers: 'roller-19-tapered', rearRollers: 'roller-13-alu', frontStay: 'stay-front-frp', rearStay: 'stay-rear-frp' }, codes: ['LENGTH'] },
      { over: { frontRollers: 'roller-19-tapered', rearRollers: 'roller-13-alu' }, codes: ['ROLLER_TAPER_MOUNT'] },
      { over: { rearRollers: 'roller-13-tapered', frontStay: 'stay-front-frp' }, codes: ['ROLLER_TAPER_MOUNT'] },
      { over: { rearRollers: 'roller-13-12-double' }, codes: ['ROLLER_ROLLER_CLEARANCE'] },
      { over: { rearStay: 'stay-rear-carbon-wide', rearRollers: 'roller-19' }, codes: ['WIDTH'] },
      { over: { stabilizer: 'stabilizer-head-17', frontRollers: 'roller-13', rearRollers: 'roller-19', body: null }, codes: ['STABILIZER_ROLLER_SIZE'] },
      // 舊欄位 rollers 視為前後同款
      { over: { rollers: 'roller-19-tapered' }, codes: ['ROLLER_TAPER_MOUNT'] },
      // ---- 第五階段（iter-57）：台灣買得到的導輪 ----
      { over: { stabilizer: 'stabilizer-head-17', frontRollers: 'roller-17-alu', body: null }, codes: ['STABILIZER_ROLLER_SIZE'] },
      { over: { rearStay: 'stay-rear-carbon-wide', rearRollers: 'roller-19-rubber' }, codes: ['WIDTH'] },
      // ---- 第五階段（iter-58）----
      // 側制振器加長到 60 mm（自訂）→ 伸進前 / 後輪的輪胎外側禁裝區（官方 Sec.3 腳註）且碰到輪胎
      { over: { massDamper: { base: 'damper-side-square-32', length_mm: 60 }, body: null }, codes: ['SIDE_PART_TIRE_ZONE', 'DAMPER_TIRE_CLEARANCE'] },
      // 32 mm 側制振器比 14 mm 長 → 碰到 aero-wing 車殼側裙（14 mm 款合法，見下方合法對照）
      { over: { massDamper: 'damper-side-square-32', body: 'body-aero-wing' }, codes: ['DAMPER_BODY_CLEARANCE'] },
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
    for (const over of [{ rollers: 'roller-13-12-double', rearStay: 'stay-rear-carbon-wide' }, { rearStay: 'stay-rear-frp', massDamper: 'damper-rear-cylinder' }, { stabilizer: 'stabilizer-head-17', rollers: 'roller-19', body: null }, { rollers: 'roller-13-tapered', frontStay: 'stay-front-frp', rearStay: 'stay-rear-frp', body: null }, { frontRollers: 'roller-19-tapered', rearRollers: 'roller-13-alu', frontStay: 'stay-front-frp' }, { frontRollers: 'roller-13-12-double' }, { rearStay: 'stay-rear-carbon-wide', frontRollers: 'roller-19' }, { massDamper: 'damper-side-square', body: 'body-aero-wing' }, { massDamper: 'damper-side-square-32', body: 'body-pc-box' }, { wheels: 'wheel-31-lowfriction', body: 'body-pc-box' }, { motor: 'motor-rev' }]) {
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
