// 第二階段：零件組裝 / 規則 / 車殼相關驗證（P04、P08、P09、P11–P16，定義見 SPEC.md 第 2 部分）
// 容許誤差寫在本檔，不得為通過而放寬。
// 模組化 API（src/assembly.js、src/regulation.js、src/bodies/、src/parts/）用動態 import：
// 模組還沒實作時只有對應項目失敗，不影響 physics.test.js 的其他項目。
import { describe, test, expect, beforeAll } from 'vitest';
import * as THREE from 'three';

/** P16 逐款車殼產生測試用（測試定義時就要知道清單） */
const BODY_IDS = (await import('../src/bodies/index.js')).listBodies().map((b) => b.id);

/** @type {(x: number) => string} */
const f3 = (x) => x.toFixed(3);

/** SPEC 1.1 規則上限 / 下限 */
const RULE = { maxLength: 165, maxWidth: 105, maxHeight: 70, minMass: 90, minClearance: 1 };
/** SPEC 1.12 預設組裝總重預期範圍（合理性檢查） */
const MASS_RANGE = [105, 135];

let M = null;
let loadError = null;

/** 載入模組化 API；任何一個模組不存在都記錄錯誤 */
async function loadModular() {
  const assembly = await import('../src/assembly.js');
  const regulation = await import('../src/regulation.js');
  const bodies = await import('../src/bodies/index.js');
  const parts = await import('../src/parts/index.js');
  const sim = await import('../src/sim.js');
  const powertrain = await import('../src/powertrain.js');
  const track = await import('../src/track.js');
  const model = await import('../src/model.js');
  await sim.initRapier();
  return { ...assembly, ...regulation, ...bodies, ...parts, sim, powertrain, track, model };
}

/** 取得模組；載入失敗時讓呼叫的測試失敗並顯示原因 */
function api() {
  if (!M) {
    throw new Error(`模組化 API 尚未實作：${loadError?.message ?? '未知錯誤'}`);
  }
  return M;
}

/** 預設設定加上覆寫（slot 值可為零件 id 或 { base, ...覆寫欄位 }） */
function cfgWith(over = {}) {
  return { ...api().loadConfig('default'), ...over };
}

/**
 * 直線全速跑，回傳穩定極速（最後 0.5 s 平均）
 * @type {(asm: object, soc?: number, seconds?: number) => { vSteady: number }}
 */
function runStraightTopSpeed(asm, soc = 1, seconds = 7) {
  const { sim, track } = api();
  // 直線長度要夠跑完全程（iter-32：motor-high-rev 約 9 m/s × 7 s ≈ 62 m，原本 40 m 會衝出直線末端、量到掉落中的速度）
  const env = sim.createWorld(track.buildStraight(100));
  const car = sim.createCar(env, { assembly: asm, s: 0.2, lane: 0, soc, drain: false });
  const dt = env.world.timestep;
  const steps = Math.round(seconds / dt);
  const tail = Math.round(0.5 / dt);
  let sum = 0;
  for (let i = 0; i < steps; i++) {
    sim.stepCar(env, car);
    if (i >= steps - tail) {
      sum += sim.forwardSpeed(car);
    }
  }
  return { vSteady: sum / tail };
}

/**
 * 主賽道跑 laps 圈（從換道器前的內側線道出發），回傳 P06／P07／P10 需要的資料；
 * 每經過一次換道器記錄前後車道（第 k 次在 lc.start + kL 之前 / lc.end + kL 之後）
 * @type {(asm: object, laps?: number) => any}
 */
function runCircuitLap(asm, laps = 1) {
  const { sim, track: T } = api();
  const track = T.buildCircuit();
  const env = sim.createWorld(track);
  const s0 = 0.15;
  const car = sim.createCar(env, { assembly: asm, s: s0, lane: 0 });
  const L = track.path.length;
  const dt = env.world.timestep;
  let progress = 0;
  let lastS = s0;
  let maxPen = -Infinity;
  let minContactDist = Infinity;
  let minUp = 1;
  let maxY = -Infinity;
  let minY = Infinity;
  /** @type {(number | null)[]} */
  const laneBefore = Array(laps).fill(null);
  /** @type {(number | null)[]} */
  const laneAfter = Array(laps).fill(null);
  let maxH = -Infinity;
  let minH = Infinity;
  let bridgeSteps = 0;
  const lc = track.laneChanger;
  const maxSteps = Math.round(10 * laps / dt);
  let steps = 0;
  for (; steps < maxSteps && progress < laps * L + 0.05; steps++) {
    sim.stepCar(env, car);
    const t = car.chassis.translation();
    const c = track.path.project(t.x, t.z);
    let ds = c.s - lastS;
    if (ds < -L / 2) {
      ds += L;
    }
    if (ds > L / 2) {
      ds -= L;
    }
    progress += ds;
    lastS = c.s;
    maxPen = Math.max(maxPen, sim.wallPenetration(env, car));
    for (const r of car.rollers) {
      minContactDist = Math.min(minContactDist, sim.minWallContactDist(env, r.collider));
    }
    minContactDist = Math.min(minContactDist, sim.minWallContactDist(env, car.bodyCol));
    minUp = Math.min(minUp, sim.upAxis(car).y);
    minY = Math.min(minY, t.y);
    maxY = Math.max(maxY, t.y);
    // 離所在層路面的高度（換道器橋上以橋面為準）
    const h = sim.heightAboveRoad(env, car);
    maxH = Math.max(maxH, h);
    minH = Math.min(minH, h);
    if (sim.carLevel(env, car) === 'bridge') {
      bridgeSteps++;
    }
    const sAbs = s0 + progress;
    for (let k = 0; k < laps; k++) {
      if (laneBefore[k] === null && sAbs >= lc.start + k * L - 0.1) {
        laneBefore[k] = track.laneOf(c.d);
      }
      if (laneAfter[k] === null && sAbs >= lc.end + k * L + 0.25) {
        laneAfter[k] = track.laneOf(c.d);
      }
    }
  }
  return { track, lapLength: L, laps, progress, time: steps * dt, maxPen, contactPen: Math.max(0, -minContactDist), minUp, minY, maxY, minH, maxH, bridgeSteps, laneBefore, laneAfter };
}

/**
 * 直線斷電滑行距離
 * @type {(asm: object, v0: number) => number}
 */
function coastDistance(asm, v0) {
  const { sim, track } = api();
  const env = sim.createWorld(track.buildStraight(60));
  const car = sim.createCar(env, { assembly: asm, s: 0.3, lane: 0, powered: false });
  for (let i = 0; i < 100; i++) {
    sim.stepCar(env, car);
  }
  car.chassis.setLinvel({ x: v0, y: 0, z: 0 }, true);
  const x0 = car.chassis.translation().x;
  const maxSteps = Math.round(60 / env.world.timestep);
  for (let i = 0; i < maxSteps; i++) {
    sim.stepCar(env, car);
    if (sim.forwardSpeed(car) < 0.01) {
      break;
    }
  }
  return car.chassis.translation().x - x0;
}

/** 物件是否屬於某零件類別（自己或祖先的 userData.part） */
function partOf(obj) {
  let o = obj;
  while (o) {
    if (o.userData?.part) {
      return o.userData.part;
    }
    o = o.parent;
  }
  return null;
}

/** 走訪模型中所有 mesh 頂點（模型座標，mm） */
function forEachVertex(root, fn) {
  root.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) {
      return;
    }
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      fn(v, o);
    }
  });
}

/**
 * 點到有限圓柱的距離（外部為正、內部為負），mm
 * @param {THREE.Vector3} p
 * @param {{ x: number, y: number, z: number }} c 圓柱中心
 * @param {'y'|'z'} axis 圓柱軸
 * @param {number} r 半徑
 * @param {number} halfLen 半長
 */
function cylinderDistance(p, c, axis, r, halfLen) {
  let radial;
  let along;
  if (axis === 'z') {
    radial = Math.hypot(p.x - c.x, p.y - c.y);
    along = Math.abs(p.z - c.z);
  } else {
    radial = Math.hypot(p.x - c.x, p.z - c.z);
    along = Math.abs(p.y - c.y);
  }
  const dr = radial - r;
  const da = along - halfLen;
  if (dr <= 0 && da <= 0) {
    return Math.max(dr, da);
  }
  return Math.hypot(Math.max(dr, 0), Math.max(da, 0));
}

beforeAll(async () => {
  try {
    M = await loadModular();
  } catch (e) {
    loadError = e;
    console.log('[modular] 模組化 API 載入失敗：', e.message);
  }
});

describe('第二階段：零件組裝 / 規則 / 車殼（P04、P08、P09、P11–P16）', () => {
  test('P04_bearing_coast 只換組裝設定（bearing-620 → bushing-plastic），培林滑行距離 ≥ 塑膠軸承 × 1.2', () => {
    const { assemble } = api();
    const v0 = 3.0;
    const asmBearing = assemble(cfgWith({ bearings: 'bearing-620' }));
    const asmBushing = assemble(cfgWith({ bearings: 'bushing-plastic' }));
    const dBearing = coastDistance(asmBearing, v0);
    const dBushing = coastDistance(asmBushing, v0);
    const ratio = dBearing / dBushing;
    console.log(`[P04] 初速 ${v0} m/s：bearing-620 ${f3(dBearing)} m（${f3(asmBearing.mass_g)} g）, bushing-plastic ${f3(dBushing)} m（${f3(asmBushing.mass_g)} g）, 比值 ${ratio.toFixed(3)}`);
    expect(ratio).toBeGreaterThanOrEqual(1.2);
  }, 120000);

  test('P08_mass 每款車殼整車質量 ≥ 90 g 且在 105–135 g', () => {
    const { assemble, listBodies, sim, track } = api();
    const bodies = listBodies();
    expect(bodies.length).toBeGreaterThan(0);
    for (const b of bodies) {
      const asm = assemble(cfgWith({ body: b.id }));
      const env = sim.createWorld(track.buildStraight(2));
      const car = sim.createCar(env, { assembly: asm });
      // Rapier 在第一次 step 後才更新質量屬性
      env.world.step();
      const mass_g = car.chassis.mass() * 1000;
      console.log(`[P08] ${b.id}：物理剛體 ${mass_g.toFixed(2)} g（零件加總 ${asm.mass_g.toFixed(2)} g）`);
      expect(mass_g).toBeGreaterThanOrEqual(RULE.minMass);
      expect(mass_g).toBeGreaterThanOrEqual(MASS_RANGE[0]);
      expect(mass_g).toBeLessThanOrEqual(MASS_RANGE[1]);
    }
  });

  test('P09_dimensions 每款車殼由程式碼重新組裝後量測：外框 < 規則上限、離地 ≥ 1 mm', () => {
    const { assemble, listBodies, model } = api();
    for (const b of listBodies()) {
      const asm = assemble(cfgWith({ body: b.id }));
      const car = model.buildCarModel(asm);
      car.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(car);
      const size = box.getSize(new THREE.Vector3());
      // 離地高度：輪胎（userData.part = 'wheel'）以外所有頂點的最低 y
      let minY = Infinity;
      let wheelMinY = Infinity;
      forEachVertex(car, (v, o) => {
        if (partOf(o) === 'wheel') {
          wheelMinY = Math.min(wheelMinY, v.y);
        } else {
          minY = Math.min(minY, v.y);
        }
      });
      const clearance = minY - wheelMinY;
      console.log(`[P09] ${b.id}：長 ${size.x.toFixed(2)} × 寬 ${size.z.toFixed(2)} × 高 ${size.y.toFixed(2)} mm, 離地 ${clearance.toFixed(2)} mm（輪胎最低 y=${wheelMinY.toFixed(2)}）`);
      expect(Number.isFinite(wheelMinY)).toBe(true);
      expect(size.x).toBeLessThan(RULE.maxLength);
      expect(size.z).toBeLessThan(RULE.maxWidth);
      expect(size.y).toBeLessThan(RULE.maxHeight);
      expect(clearance).toBeGreaterThanOrEqual(RULE.minClearance);
    }
  });

  test('P11_regulation 預設組裝合法；8 種故意違規＋車殼干涉＋第三階段新零件的干涉 / 安裝相容性都被擋下且代碼正確', () => {
    const { assemble, validateAssembly } = api();
    const ok = validateAssembly(assemble(cfgWith()));
    console.log(`[P11] 預設組裝：ok=${ok.ok}, 違規 ${JSON.stringify(ok.violations.map((v) => v.code))}`);
    expect(ok.ok).toBe(true);
    expect(ok.violations).toHaveLength(0);

    const cases = [
      { code: 'LENGTH', over: { frontStay: { base: 'stay-front-standard', rollerX_mm: 85 } } },
      { code: 'WIDTH', over: { frontStay: { base: 'stay-front-standard', rollerZ_mm: 50 } } },
      { code: 'HEIGHT', over: { rearStay: { base: 'stay-rear-standard', upperRollerHeight_mm: 70 } } },
      // 過輕：底盤本體與電池組都換成很輕的版本（只改底盤會因其他零件合計仍 ≥ 90 g 而不構成違規）
      { code: 'MASS', over: { chassis: { base: 'chassis-midship', mass_g: 5 }, battery: { base: 'battery-aa-nimh-950', mass_g: 10 } } },
      // 36 mm 輪胎超出規則，同時一定會撞到車殼輪拱（輪拱依 26 mm 輪胎設計）→ 兩個代碼都要回報
      { code: 'TIRE_DIAMETER', codes: ['TIRE_DIAMETER', 'BODY_TIRE_CLEARANCE'], over: { wheels: { base: 'wheel-26-lowprofile', diameter_mm: 36 } } },
      // 31 mm 大徑輪胎本身合規，但會穿進車殼（2026-10-21 使用者要求：零件替換要符合物理，干涉要擋下）
      { code: 'BODY_TIRE_CLEARANCE', over: { wheels: 'wheel-31-large' } },
      { code: 'GROUND_CLEARANCE', over: { wheels: { base: 'wheel-26-lowprofile', diameter_mm: 23 } } },
      { code: 'DRIVE_4WD', over: { chassis: { base: 'chassis-midship', driveType: '2WD' } } },
      { code: 'GEAR_RATIO', over: { gear: { base: 'gear-3.5', ratio: 3.0 } } },
      // ---- 第三階段新零件（iter-46）：安裝相容性 ----
      // 4.2:1 是合法齒輪比，但只有單軸底盤有對應零件（SPEC 1.5）
      { code: 'GEAR_CHASSIS', over: { gear: 'gear-4.2' } },
      // 單軸馬達不能裝中置雙軸底盤（SPEC 1.1 [REG] Sec.4）
      { code: 'MOTOR_CLASS', over: { motor: 'motor-single-standard' } },
      // 後制振器需要導輪板的制振器座，塑膠標準後導輪架沒有
      { code: 'MOUNT_COMPAT', over: { massDamper: 'damper-rear-cylinder' } },
      // 碳纖寬後板（導輪中心 ±44.5）＋19 mm 導輪 → 全寬 108 mm
      { code: 'WIDTH', over: { rearStay: 'stay-rear-carbon-wide', rollers: 'roller-19' } },
      // ---- 第三階段新零件：實體干涉 ----
      // 雙層導輪（高 10 mm）裝在上下兩層的後導輪架 → 上下兩顆導輪互相穿透
      { code: 'ROLLER_ROLLER_CLEARANCE', over: { rollers: 'roller-13-12-double' } },
      // 後保桿下的配重與煞車海綿搶同一個位置
      { code: 'BALLAST_SPONGE_CLEARANCE', over: { brakeSponge: 'sponge-1mm-strong', ballast: 'ballast-hex-1g@rear' } },
      // 煞車座往前延伸到後輪下方（自訂導輪架）→ 海綿碰到輪胎
      { code: 'SPONGE_TIRE_CLEARANCE', over: { brakeSponge: 'sponge-2mm-strong', rearStay: { base: 'stay-rear-standard', brakeMount: { xMin_mm: 45, xMax_mm: 60, halfZ_mm: 30, y_mm: 5.4 } } } },
      // 中央配重疊到 40 mm 高 → 穿出車殼
      { code: 'BALLAST_BODY_CLEARANCE', over: { ballast: { base: 'ballast-square-3.6g', mount: 'center', thickness_mm: 40 } } },
      // 3 mm 海綿貼在 FRP 後導輪板（板底離地 3.9 mm）下 → 海綿底離地 0.9 mm
      { code: 'GROUND_CLEARANCE', over: { rearStay: 'stay-rear-frp', brakeSponge: 'sponge-3mm-mild' } },
      // ---- 第四階段新零件（iter-54）----
      // 疊兩片的加厚端子：規則禁止（Tamiya 規則 Sec.6-5 double-plated terminals）
      { code: 'TERMINAL_MOD', over: { switch: 'switch-double-terminal' } },
      // 31 mm 拱形胎與 31 mm 大徑胎同尺寸 → 穿進 body-aero-wing 的輪拱（車殼固定，預設車殼由主線調整）
      { code: 'BODY_TIRE_CLEARANCE', over: { wheels: 'wheel-31-arched', body: 'body-aero-wing' } },
      // 17 mm 穩定頭只能配 19 mm 前導輪；錐形導輪要鎖在 FRP / 碳纖導輪板
      { code: 'STABILIZER_ROLLER_SIZE', over: { stabilizer: 'stabilizer-head-17', body: null } },
      { code: 'ROLLER_TAPER_MOUNT', over: { rollers: 'roller-13-tapered', body: null } },
      // 17 mm 穩定頭（高 3 mm，在 19 mm 前導輪上方）碰到 body-aero-wing 的車頭
      { code: 'STABILIZER_BODY_CLEARANCE', over: { stabilizer: 'stabilizer-head-17', rollers: 'roller-19', body: 'body-aero-wing' } },
    ];
    for (const c of cases) {
      const res = validateAssembly(assemble(cfgWith(c.over)));
      const codes = res.violations.map((v) => v.code);
      console.log(`[P11] ${c.code}：ok=${res.ok}, 違規 ${JSON.stringify(codes)} — ${res.violations.map((v) => v.message).join('；')}`);
      expect(res.ok).toBe(false);
      expect(codes).toEqual(c.codes ?? [c.code]);
    }
  });

  test('P12_motor_swap 只換組裝設定成 motor-high-rev：模擬極速 > 預設，且與自身理論極速誤差 < 10%', () => {
    const { assemble, powertrain } = api();
    const asmStd = assemble(cfgWith());
    const asmHr = assemble(cfgWith({ motor: 'motor-high-rev' }));
    const std = runStraightTopSpeed(asmStd);
    const hr = runStraightTopSpeed(asmHr);
    const thHr = powertrain.theoreticalTopSpeed({ assembly: asmHr, soc: 1 });
    const err = Math.abs(hr.vSteady - thHr.vTheory) / thHr.vTheory;
    console.log(`[P12] 預設馬達模擬 ${f3(std.vSteady)} m/s；motor-high-rev：v0=${f3(thHr.v0)}, 理論 ${f3(thHr.vTheory)}, 模擬 ${f3(hr.vSteady)} m/s, 誤差 ${(err * 100).toFixed(2)}%`);
    expect(hr.vSteady).toBeGreaterThan(std.vSteady);
    expect(err).toBeLessThan(0.1);
  }, 120000);

  test('P13_gear_swap 只換組裝設定成 gear-4.0：理論與模擬極速都低於 3.5:1，且各自誤差 < 10%', () => {
    const { assemble, powertrain } = api();
    const asm35 = assemble(cfgWith({ gear: 'gear-3.5' }));
    const asm40 = assemble(cfgWith({ gear: 'gear-4.0' }));
    const th35 = powertrain.theoreticalTopSpeed({ assembly: asm35, soc: 1 });
    const th40 = powertrain.theoreticalTopSpeed({ assembly: asm40, soc: 1 });
    const sim35 = runStraightTopSpeed(asm35);
    const sim40 = runStraightTopSpeed(asm40);
    const err35 = Math.abs(sim35.vSteady - th35.vTheory) / th35.vTheory;
    const err40 = Math.abs(sim40.vSteady - th40.vTheory) / th40.vTheory;
    console.log(`[P13] 3.5:1 理論 ${f3(th35.vTheory)} / 模擬 ${f3(sim35.vSteady)}（${(err35 * 100).toFixed(2)}%）；4.0:1 理論 ${f3(th40.vTheory)} / 模擬 ${f3(sim40.vSteady)}（${(err40 * 100).toFixed(2)}%）`);
    expect(asm40.gearRatio).toBe(4.0);
    expect(th40.vTheory).toBeLessThan(th35.vTheory);
    expect(sim40.vSteady).toBeLessThan(sim35.vSteady);
    expect(err35).toBeLessThan(0.1);
    expect(err40).toBeLessThan(0.1);
  }, 120000);

  test('P14_mass_com_from_parts 質量 = 零件加總、重心 = 質量加權位置，且物理引擎實際使用這兩個值', () => {
    const { assemble, getPart, sim, track } = api();
    const asm = assemble(cfgWith());
    expect(asm.parts.length).toBeGreaterThanOrEqual(10);
    let sum = 0;
    const mom = { x: 0, y: 0, z: 0 };
    for (const p of asm.parts) {
      expect(p.mass_g).toBeGreaterThan(0);
      sum += p.mass_g;
      for (const k of ['x', 'y', 'z']) {
        mom[k] += p.mass_g * p.pos[k];
      }
    }
    const com = { x: mom.x / sum, y: mom.y / sum, z: mom.z / sum };
    console.log(`[P14] 零件 ${asm.parts.length} 個，加總 ${f3(sum)} g（組裝 ${f3(asm.mass_g)} g）；重心 (${f3(com.x)}, ${f3(com.y)}, ${f3(com.z)}) mm（組裝 (${f3(asm.com_mm.x)}, ${f3(asm.com_mm.y)}, ${f3(asm.com_mm.z)})）`);
    expect(Math.abs(sum - asm.mass_g)).toBeLessThan(0.1);
    for (const k of ['x', 'y', 'z']) {
      expect(Math.abs(com[k] - asm.com_mm[k])).toBeLessThan(0.1);
    }

    // 換零件時質量跟著零件資料變：26 mm → 31 mm 輪胎，質量差 = 4 × 單顆差
    const asm31 = assemble(cfgWith({ wheels: 'wheel-31-large' }));
    const dExpect = 4 * (getPart('wheel-31-large').mass_g - getPart('wheel-26-lowprofile').mass_g);
    console.log(`[P14] 換 31 mm 輪胎：質量 ${f3(asm.mass_g)} → ${f3(asm31.mass_g)} g（預期差 ${f3(dExpect)} g），重心高 ${f3(asm.com_mm.y)} → ${f3(asm31.com_mm.y)} mm`);
    expect(Math.abs(asm31.mass_g - asm.mass_g - dExpect)).toBeLessThan(0.1);
    expect(asm31.com_mm.y).toBeGreaterThan(asm.com_mm.y);

    // 第四階段新零件：電池（2 顆）、中空輪軸（2 支）、輕量輪框（4 顆）的質量差 = 件數 × 單件差；重心依零件位置移動
    for (const [slot, id, base, n] of [
      ['battery', 'battery-aa-nimh-2500', 'battery-aa-nimh-950', 1],
      ['axles', 'axle-hex-60-hollow', 'axle-hex-60', 2],
      ['wheels', 'wheel-26-lightweight', 'wheel-26-lowprofile', 4],
      ['switch', 'switch-double-terminal', 'switch-standard', 1],
    ]) {
      const a = assemble(cfgWith({ [slot]: id }));
      const d = n * (getPart(id).mass_g - getPart(base).mass_g);
      let sumA = 0;
      const momA = { x: 0, y: 0, z: 0 };
      for (const q of a.parts) {
        sumA += q.mass_g;
        for (const k of ['x', 'y', 'z']) {
          momA[k] += q.mass_g * q.pos[k];
        }
      }
      console.log(`[P14] ${slot}=${id}：質量 ${f3(asm.mass_g)} → ${f3(a.mass_g)} g（預期差 ${f3(d)} g）、重心 (${f3(a.com_mm.x)}, ${f3(a.com_mm.y)}, ${f3(a.com_mm.z)}) mm`);
      expect(Math.abs(a.mass_g - asm.mass_g - d)).toBeLessThan(0.1);
      expect(Math.abs(sumA - a.mass_g)).toBeLessThan(0.1);
      for (const k of ['x', 'y', 'z']) {
        expect(Math.abs(momA[k] / sumA - a.com_mm[k])).toBeLessThan(0.1);
      }
    }
    // 電池較重（在底盤低處兩側）→ 重心降低
    expect(assemble(cfgWith({ battery: 'battery-aa-nimh-2500' })).com_mm.y).toBeLessThan(asm.com_mm.y);

    // 物理引擎實際使用的值
    for (const a of [asm, asm31]) {
      const env = sim.createWorld(track.buildStraight(2));
      const car = sim.createCar(env, { assembly: a });
      env.world.step();
      const m = car.chassis.mass() * 1000;
      const lc = car.chassis.localCom();
      console.log(`[P14] 引擎：質量 ${f3(m)} g、重心 (${f3(lc.x * 1000)}, ${f3(lc.y * 1000)}, ${f3(lc.z * 1000)}) mm`);
      expect(Math.abs(m - a.mass_g)).toBeLessThan(0.1);
      expect(Math.abs(lc.x * 1000 - a.com_mm.x)).toBeLessThan(0.1);
      expect(Math.abs(lc.y * 1000 - a.com_mm.y)).toBeLessThan(0.1);
      expect(Math.abs(lc.z * 1000 - a.com_mm.z)).toBeLessThan(0.1);
    }
  });

  test('P15_body_swap ≥ 3 款車殼：對齊安裝點、底盤零件位置不變、與輪胎 / 導輪間隙 ≥ 1 mm', () => {
    const { assemble, listBodies, model } = api();
    const bodies = listBodies();
    console.log(`[P15] 車殼 ${bodies.length} 款：${bodies.map((b) => b.id).join(', ')}`);
    expect(bodies.length).toBeGreaterThanOrEqual(3);
    const base = assemble(cfgWith());
    const chassisParts = (a) => a.parts.filter((p) => p.category !== 'body').map((p) => ({ slot: p.slot, id: p.id, pos: p.pos }));
    for (const b of bodies) {
      const asm = assemble(cfgWith({ body: b.id }));
      // 1) 安裝點對齊
      expect(asm.chassisMounts.length).toBeGreaterThanOrEqual(2);
      for (const m of asm.chassisMounts) {
        const bm = asm.body.mounts.find((x) => x.id === m.id);
        expect(bm, `${b.id} 缺安裝點 ${m.id}`).toBeTruthy();
        const d = Math.hypot(bm.x - m.x, bm.y - m.y, bm.z - m.z);
        expect(d).toBeLessThan(0.01);
      }
      // 2) 底盤零件位置不變
      expect(chassisParts(asm)).toEqual(chassisParts(base));
      // 3) 車殼與輪胎、導輪間隙
      const car = model.buildCarModel(asm);
      const bodyGroup = car.getObjectByName('body');
      expect(bodyGroup, `${b.id} 模型中沒有名為 body 的群組`).toBeTruthy();
      let minWheel = Infinity;
      let minRoller = Infinity;
      forEachVertex(bodyGroup, (v) => {
        for (const w of asm.layout.wheels) {
          minWheel = Math.min(minWheel, cylinderDistance(v, w, 'z', w.r, w.width / 2));
        }
        for (const r of asm.layout.rollers) {
          minRoller = Math.min(minRoller, cylinderDistance(v, r, 'y', r.r, r.h / 2));
        }
      });
      console.log(`[P15] ${b.id}：車殼 ${f3(asm.body.mass_g)} g，與輪胎最小間隙 ${f3(minWheel)} mm、與導輪最小間隙 ${f3(minRoller)} mm`);
      expect(minWheel).toBeGreaterThanOrEqual(1);
      expect(minRoller).toBeGreaterThanOrEqual(1);
    }
  });

  // iter-50：原本一個測試依序跑完所有車殼（6 款 × 3 圈），高負載時整體超過逾時；改成每款車殼一個 P16_ 測試（判定條件完全相同，
  // 計分腳本要求 P16_ 開頭的測試全部通過才算 P16 通過），另外保留「至少 1 款車殼」的檢查
  test('P16_every_body_lap_count 車殼清單不為空', () => {
    expect(api().listBodies().length).toBeGreaterThan(0);
  });

  test.each(BODY_IDS)('P16_every_body_lap[%s] 跑完官方 3 圈（約 20 m，3 條車道各一圈，含彎道與 3 次換道器 / 立體橋），不穿牆、不飛出、未翻覆', (bodyId) => {
    const { assemble } = api();
    {
      const b = { id: bodyId };
      const lap = runCircuitLap(assemble(cfgWith({ body: b.id })), 3);
      const pen = Math.max(lap.maxPen, lap.contactPen);
      const lanes = lap.laneBefore.map((x, k) => `${x}→${lap.laneAfter[k]}`).join('、');
      console.log(`[P16] ${b.id}：進度 ${f3(lap.progress)} / ${f3(3 * lap.lapLength)} m, ${f3(lap.time)} s, 穿透 ${(pen * 1000).toFixed(3)} mm, 最小 up.y ${f3(lap.minUp)}, 離路面高度 ${(lap.minH * 1000).toFixed(2)}–${(lap.maxH * 1000).toFixed(2)} mm, 換道 ${lanes}, 橋上步數 ${lap.bridgeSteps}`);
      expect(lap.progress).toBeGreaterThanOrEqual(3 * lap.lapLength);
      expect(pen).toBeLessThanOrEqual(0.001);
      expect(lap.minUp).toBeGreaterThan(0.8);
      // 不飛出：車體原點離所在層路面 < 5 cm（地面層即 y < 0.05，同第二階段；橋上以橋面為準）
      expect(lap.maxH).toBeLessThan(0.05);
      expect(lap.minH).toBeGreaterThan(-0.005);
      for (let k = 0; k < 3; k++) {
        expect(lap.laneBefore[k]).not.toBeNull();
        expect(lap.laneAfter[k]).toBe(lap.track.nextLane(lap.laneBefore[k]));
      }
      // 3 圈內 3 條車道各跑一次，且外側車道那一圈確實走了立體橋
      expect(new Set(lap.laneBefore).size).toBe(3);
      expect(lap.bridgeSteps).toBeGreaterThan(0);
    }
  }, 300000);

  test('P16_no_body body: null（不裝車殼）：質量 / 重心 / 外框 / 規則只算底盤，模型與物理都能建立', () => {
    const { assemble, validateAssembly, model, sim, track: T } = api();
    const withBody = assemble(cfgWith());
    const bare = assemble(cfgWith({ body: null }));
    expect(bare.body).toBeNull();
    expect(bare.fit).toBeNull();
    // 質量 = 有車殼的組裝扣掉車殼質量；零件清單沒有車殼
    expect(bare.mass_g).toBeCloseTo(withBody.mass_g - withBody.body.mass_g, 6);
    expect(bare.parts.some((q) => q.slot === 'body')).toBe(false);
    const sum = bare.parts.reduce((acc, q) => acc + q.mass_g, 0);
    expect(bare.mass_g).toBeCloseTo(sum, 9);
    // 重心 = 底盤零件質量加權位置
    for (const k of ['x', 'y', 'z']) {
      const c = bare.parts.reduce((acc, q) => acc + q.mass_g * q.pos[k], 0) / sum;
      expect(bare.com_mm[k]).toBeCloseTo(c, 9);
    }
    // 外框不含車殼：不大於有車殼的外框
    expect(bare.bbox_mm.size.y).toBeLessThanOrEqual(withBody.bbox_mm.size.y + 1e-9);
    expect(bare.bbox_mm.size.x).toBeLessThanOrEqual(withBody.bbox_mm.size.x + 1e-9);
    // 規則檢查照常運作（不檢查車殼間隙）
    const res = validateAssembly(bare);
    const codes = res.violations.map((v) => v.code);
    console.log(`[P16 無車殼] 無車殼：${f3(bare.mass_g)} g（有車殼 ${f3(withBody.mass_g)} g），外框 ${f3(bare.bbox_mm.size.x)} × ${f3(bare.bbox_mm.size.z)} × ${f3(bare.bbox_mm.size.y)} mm，違規 ${codes.join(',') || '無'}`);
    expect(codes.some((c) => c.startsWith('BODY_'))).toBe(false);
    // 3D 模型：沒有車殼節點
    const m = model.buildCarModel(bare);
    expect(m.getObjectByName('body')).toBeUndefined();
    expect(m.getObjectByName('chassis')).toBeDefined();
    // 物理：能建車並在直線上前進
    const env = sim.createWorld(T.buildStraight(5));
    const car = sim.createCar(env, { assembly: bare, s: 0.2, lane: 0 });
    for (let i = 0; i < 2000; i++) {
      sim.stepCar(env, car);
    }
    expect(car.chassis.mass() * 1000).toBeCloseTo(bare.rigid.mass_g, 3);
    expect(sim.forwardSpeed(car)).toBeGreaterThan(0.5);
  });
});
