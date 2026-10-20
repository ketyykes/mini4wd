// Rapier 物理模擬：賽道（地板＋側牆方塊）、車體剛體（車體方塊＋導輪圓柱）、
// DynamicRayCastVehicleController 四輪，動力鏈由 powertrain.js 每步計算後以 engine force 施加
import RAPIER from '@dimforge/rapier3d-compat';
import { spec } from './spec.js';
import { Battery, longitudinalForce } from './powertrain.js';
import { assemble, loadConfig } from './assembly.js';

const MM = 0.001;

let initPromise = null;

/** 初始化 Rapier WASM（只做一次） */
export function initRapier() {
  if (!initPromise) {
    initPromise = RAPIER.init();
  }
  return initPromise;
}

/** 由 yaw（繞 y 軸）產生四元數 */
function yawQuat(yaw) {
  return { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) };
}

/** 四元數旋轉向量 */
function rotate(q, v) {
  const { x, y, z, w } = q;
  const ix = w * v.x + y * v.z - z * v.y;
  const iy = w * v.y + z * v.x - x * v.z;
  const iz = w * v.z + x * v.y - y * v.x;
  const iw = -x * v.x - y * v.y - z * v.z;
  return {
    x: ix * w + iw * -x + iy * -z - iz * -y,
    y: iy * w + iw * -y + iz * -x - ix * -z,
    z: iz * w + iw * -z + ix * -y - iy * -x,
  };
}

/**
 * 建立世界與賽道
 * @param {ReturnType<import('./track.js').buildCircuit>} track
 */
export function createWorld(track) {
  const world = new RAPIER.World({ x: 0, y: -spec.sim.gravity, z: 0 });
  world.timestep = spec.sim.dt_s;
  // lengthUnit 會連帶限制最大速度（0.01 時上限 4 m/s，見 ITERATION_LOG），取 0.1
  world.lengthUnit = 0.1;
  world.integrationParameters.numSolverIterations = spec.sim.numSolverIterations;
  // 允許穿透預設 0.5 mm（0.005 × lengthUnit），會吃掉 P06 一半的容許量，改小（見 config sim 說明）
  world.integrationParameters.normalizedAllowedLinearError = spec.sim.normalizedAllowedLinearError;

  const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const b = track.bounds;
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;
  const floor = world.createCollider(
    RAPIER.ColliderDesc.cuboid((b.maxX - b.minX) / 2 + 1, 0.01, (b.maxZ - b.minZ) / 2 + 1)
      .setTranslation(cx, -0.01, cz)
      .setFriction(0.3),
    ground,
  );

  const wallHandles = new Set();
  const flags = RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES;
  for (const m of track.wallMeshes) {
    const col = world.createCollider(
      RAPIER.ColliderDesc.trimesh(m.vertices, m.indices, flags).setFriction(spec.track.wallFriction),
      ground,
    );
    wallHandles.add(col.handle);
  }
  return { world, floor, wallHandles, track };
}

/**
 * 車體碰撞方塊（mm，車體座標）：車殼外框的長寬，底面 = 底盤離地高度，頂面 = 車殼頂 − 2 mm（同第一階段）
 * @type {(asm: any) => { hx: number, hy: number, hz: number, cx: number, cy: number }}
 */
export function bodyColliderBox(asm) {
  const b = asm.body.bbox_mm;
  const bottom = asm.groundClearance_mm;
  const top = b.max.y - 2;
  return {
    hx: (b.max.x - b.min.x) / 2,
    hy: (top - bottom) / 2,
    hz: Math.max(Math.abs(b.min.z), Math.abs(b.max.z)),
    cx: (b.max.x + b.min.x) / 2,
    cy: (top + bottom) / 2,
  };
}

/** @type {any} 預設組裝（沒有指定 assembly 時使用） */
let defaultAssembly = null;

/**
 * 建立車輛：質量、重心、導輪、輪胎、碰撞體全部取自組裝結果（asm）
 * @param {ReturnType<typeof createWorld>} env
 * @param {{ assembly?: any, s?: number, lane?: number, soc?: number, drain?: boolean, powered?: boolean }} opt
 */
export function createCar(env, opt = {}) {
  const { world, track } = env;
  if (!opt.assembly && !defaultAssembly) {
    defaultAssembly = assemble(loadConfig('default'));
  }
  const asm = opt.assembly ?? defaultAssembly;
  const P = asm.P;
  const s0 = opt.s ?? 0.15;
  const lane = opt.lane ?? 0;
  const start = track.path.point(s0, track.laneOffset(lane));
  const massKg = asm.mass_g / 1000;
  const com = { x: asm.com_mm.x * MM, y: asm.com_mm.y * MM, z: asm.com_mm.z * MM };

  // 慣性矩由零件組裝推導（assembly.js：零件質點＋底盤本體與車殼的外框方塊，iter-33）
  const inertia = asm.inertia_kgm2;

  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(start.x, 0.0005, start.z)
    .setRotation(yawQuat(-start.theta))
    .setAdditionalMassProperties(massKg, com, inertia, { x: 0, y: 0, z: 0, w: 1 })
    .setCcdEnabled(true)
    .setCanSleep(false);
  const chassis = world.createRigidBody(bodyDesc);

  const box = bodyColliderBox(asm);
  const bodyCol = world.createCollider(
    RAPIER.ColliderDesc.cuboid(box.hx * MM, box.hy * MM, box.hz * MM)
      .setTranslation(box.cx * MM, box.cy * MM, 0)
      .setDensity(0)
      .setFriction(0.3),
    chassis,
  );

  const rollerPart = asm.partsBySlot.rollers;
  const rollers = asm.layout.rollers.map((r) => {
    const col = world.createCollider(
      // 導輪碰撞體用球：圓柱對 trimesh 的接觸在 Rapier 中會卡住（見 ITERATION_LOG iter-00）
      RAPIER.ColliderDesc.ball(r.r * MM)
        .setTranslation(r.x * MM, r.y * MM, r.z * MM)
        .setDensity(0)
        .setFriction(rollerPart.wallFriction)
        .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
        .setRestitution(rollerPart.restitution),
      chassis,
    );
    return { ...r, collider: col };
  });

  // 自寫射線輪（raycast wheel）：Rapier 內建 DynamicRayCastVehicleController 的側向摩擦在
  // 小慣性矩（~1e-4 kg·m²）下幾乎失效（見 ITERATION_LOG iter-00），因此改為每步自行射線偵測地面，
  // 以彈簧-阻尼求法向力，並以滑移角 tanh 模型＋摩擦圓求輪胎力，用 addForceAtPoint 交給 Rapier 積分
  const wheelR = P.wheelRadius;
  const restLen = 0.003;
  const staticDefl = spec.sim.suspensionStaticDeflection_mm * MM;
  const wheelLoad = (massKg * P.gravity) / 4;
  const springK = wheelLoad / staticDefl;
  const damperC = 2 * spec.sim.suspensionDampingRatio * Math.sqrt(springK * (massKg / 4));
  const wheels = asm.layout.wheels.map((w) => ({
    ...w,
    hardpoint: { x: w.x * MM, y: wheelR + restLen - staticDefl, z: w.z * MM },
    contact: false,
    normalForce: 0,
    spin: 0,
  }));

  return {
    chassis,
    bodyCol,
    rollers,
    wheels,
    wheelParams: { wheelR, restLen, springK, damperC },
    massKg,
    asm,
    P,
    box,
    battery: new Battery(P, opt.soc ?? 1),
    drain: opt.drain ?? true,
    powered: opt.powered ?? true,
    last: { current: 0, terminalVoltage: 0, speed: 0 },
  };
}

/** 車體前進方向（世界座標） */
export function forwardAxis(car) {
  return rotate(car.chassis.rotation(), { x: 1, y: 0, z: 0 });
}

/** 車體上方向 */
export function upAxis(car) {
  return rotate(car.chassis.rotation(), { x: 0, y: 1, z: 0 });
}

/** 前進速度 m/s */
export function forwardSpeed(car) {
  const v = car.chassis.linvel();
  const f = forwardAxis(car);
  return v.x * f.x + v.y * f.y + v.z * f.z;
}

/** 車體局部點轉世界座標 */
export function localToWorld(car, p) {
  const r = rotate(car.chassis.rotation(), p);
  const t = car.chassis.translation();
  return { x: t.x + r.x, y: t.y + r.y, z: t.z + r.z };
}

/**
 * 推進一步：動力鏈 → 引擎力、空氣阻力 → 車輛控制器 → 物理引擎
 * @param {ReturnType<typeof createWorld>} env
 * @param {ReturnType<typeof createCar>} car
 */
export function stepCar(env, car) {
  const dt = spec.sim.dt_s;
  const v = forwardSpeed(car);
  const P = car.P;
  const lf = longitudinalForce(P, { speed: v, powered: car.powered, battery: car.battery });

  let net;
  if (car.powered) {
    net = lf.drive - Math.sign(v) * lf.resist;
  } else if (Math.abs(v) < 0.002) {
    // 滑行停止：不施加阻力，避免數值上反向加速
    net = 0;
  } else {
    net = -Math.sign(v) * lf.resist;
  }

  const body = car.chassis;
  body.resetForces(true);
  body.resetTorques(true);

  // 空氣阻力施加在車體重心
  const vel = body.linvel();
  const speed = Math.hypot(vel.x, vel.y, vel.z);
  if (speed > 1e-6) {
    const k = P.airDragK * speed;
    body.addForce({ x: -k * vel.x, y: -k * vel.y, z: -k * vel.z }, true);
  }

  const q = body.rotation();
  const fwd = rotate(q, { x: 1, y: 0, z: 0 });
  const up = rotate(q, { x: 0, y: 1, z: 0 });
  const side = rotate(q, { x: 0, y: 0, z: 1 });
  const { wheelR, restLen, springK, damperC } = car.wheelParams;
  const maxLen = restLen + wheelR;
  const mu = P.tireMu;
  const alphaSat = P.slipAngleSaturation;

  // 先求各輪法向力，縱向力依法向力比例分配（4WD 前後軸機械連結）
  let normalSum = 0;
  for (const w of car.wheels) {
    const hp = localToWorld(car, w.hardpoint);
    const ray = new RAPIER.Ray(hp, { x: -up.x, y: -up.y, z: -up.z });
    const hit = env.world.castRay(ray, maxLen, true, undefined, undefined, undefined, body);
    w.contact = false;
    w.normalForce = 0;
    if (!hit) {
      continue;
    }
    const dist = hit.timeOfImpact;
    const cp = { x: hp.x - up.x * dist, y: hp.y - up.y * dist, z: hp.z - up.z * dist };
    const vp = body.velocityAtPoint(cp);
    const vn = vp.x * up.x + vp.y * up.y + vp.z * up.z;
    const compression = maxLen - dist;
    w.normalForce = Math.max(0, springK * compression - damperC * vn);
    w.contact = true;
    w.cp = cp;
    w.vp = vp;
    normalSum += w.normalForce;
  }

  for (const w of car.wheels) {
    if (!w.contact) {
      continue;
    }
    const vLong = w.vp.x * fwd.x + w.vp.y * fwd.y + w.vp.z * fwd.z;
    const vLat = w.vp.x * side.x + w.vp.y * side.y + w.vp.z * side.z;
    const share = normalSum > 0 ? w.normalForce / normalSum : 0;
    let fx = net * share;
    // 側向力：滑移角 tanh 飽和模型（低速以 0.5 m/s 為下限避免數值僵硬）
    const alpha = Math.atan2(vLat, Math.max(Math.abs(vLong), 0.5));
    let fy = -mu * w.normalForce * Math.tanh(alpha / alphaSat);
    // 摩擦圓限制
    const limit = mu * w.normalForce;
    const total = Math.hypot(fx, fy);
    if (total > limit && total > 0) {
      fx *= limit / total;
      fy *= limit / total;
    }
    const fn = w.normalForce;
    body.addForceAtPoint(
      {
        x: up.x * fn + fwd.x * fx + side.x * fy,
        y: up.y * fn + fwd.y * fx + side.y * fy,
        z: up.z * fn + fwd.z * fx + side.z * fy,
      },
      w.cp,
      true,
    );
    w.spin += (vLong / wheelR) * dt;
  }

  env.world.step();
  if (spec.sim.wallPositionProjection) {
    projectRollersOutOfWalls(env, car);
  }

  if (car.powered && car.drain) {
    car.battery.drain(lf.current, dt);
  }
  car.last = { current: lf.current, terminalVoltage: lf.terminalVoltage, speed: v };
}

/**
 * 導輪不穿牆的位置投影（iter-34）：Rapier 的軟接觸在導輪高頻抖動（前後導輪交替貼牆、約 500 Hz）時
 * 會累積約 0.6–1.1 mm 的穩態穿透，而且對質量的極小變化很敏感（0.0002 g 就能讓峰值從 0.75 跳到 1.1 mm，見 ITERATION_LOG iter-34）。
 * 提高接觸剛度（contact_natural_frequency 30–10000 Hz）、求解迭代、縮小步長、關 CCD、恢復係數 0 都沒有改善。
 * 這裡在每步積分後做標準的位置投影（constraint stabilization）：導輪中心沿賽道橫向超過牆面 slop 時，
 * 把車體沿牆面法向推回 slop 以內（只改位置、不改速度；速度仍由 Rapier 的接觸求解處理）。牆是剛體，這只是補強不穿透約束。
 * 試過同時移除朝牆的線速度 → 導輪在彎道中反覆彈離牆面（貼牆比例 100% → 約 55%），不合實車，已放棄。
 * @param {ReturnType<typeof createWorld>} env
 * @param {ReturnType<typeof createCar>} car
 */
function projectRollersOutOfWalls(env, car) {
  const { track } = env;
  const slop = spec.sim.wallProjectionSlop_mm * MM;
  const half = track.dims.wallT / 2;
  const t = car.chassis.translation();
  const center = track.path.project(t.x, t.z);
  let worst = 0;
  let dir = 0;
  let sAt = center.s;
  for (const r of car.rollers) {
    const w = localToWorld(car, { x: r.x * MM, y: r.y * MM, z: r.z * MM });
    const pp = track.path.project(w.x, w.z);
    const lines = track.lineOffsetsAt(pp.s);
    let upper = Infinity;
    let lower = -Infinity;
    for (const d of lines) {
      if (d >= center.d) {
        upper = Math.min(upper, d);
      } else {
        lower = Math.max(lower, d);
      }
    }
    const rr = r.r * MM;
    const penUpper = pp.d + rr - (upper - half);
    const penLower = lower + half - (pp.d - rr);
    if (penUpper - slop > worst) {
      worst = penUpper - slop;
      dir = -1;
      sAt = pp.s;
    }
    if (penLower - slop > worst) {
      worst = penLower - slop;
      dir = 1;
      sAt = pp.s;
    }
  }
  if (worst <= 0) {
    return;
  }
  // 賽道橫向（d 增加方向）的單位向量
  const p0 = track.path.point(sAt, center.d);
  const p1 = track.path.point(sAt, center.d + 0.001);
  const nx = (p1.x - p0.x) / 0.001;
  const nz = (p1.z - p0.z) / 0.001;
  const nl = Math.hypot(nx, nz);
  const ux = (dir * nx) / nl;
  const uz = (dir * nz) / nl;
  const frac = spec.sim.wallProjectionFraction;
  car.chassis.setTranslation({ x: t.x + ux * worst * frac, y: t.y, z: t.z + uz * worst * frac }, true);
}

/**
 * 導輪與側牆的最小接觸距離（負值為穿透）；沒有接觸對時回傳 Infinity
 * @param {ReturnType<typeof createWorld>} env
 * @param {import('@dimforge/rapier3d-compat').Collider} collider
 */
export function minWallContactDist(env, collider) {
  let minDist = Infinity;
  env.world.contactPairsWith(collider, (other) => {
    if (!env.wallHandles.has(other.handle)) {
      return;
    }
    env.world.contactPair(collider, other, (manifold) => {
      for (let i = 0; i < manifold.numContacts(); i++) {
        minDist = Math.min(minDist, manifold.contactDist(i));
      }
    });
  });
  return minDist;
}

/**
 * 車體所有外緣點（車體方塊 8 角＋導輪最外緣）的世界座標
 * @param {ReturnType<typeof createCar>} car
 */
export function carExtremePoints(car) {
  const box = car.box;
  const pts = [];
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        pts.push(localToWorld(car, { x: (box.cx + sx * box.hx) * MM, y: (box.cy + sy * box.hy) * MM, z: sz * box.hz * MM }));
      }
    }
  }
  for (const r of car.rollers) {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      pts.push(localToWorld(car, { x: (r.x + Math.cos(a) * r.r) * MM, y: r.y * MM, z: (r.z + Math.sin(a) * r.r) * MM }));
    }
  }
  return pts;
}

/**
 * 車體相對所在車道通道的最大穿牆深度（m，正值為超出牆面）
 * 對每個外緣點：在該點的 s 處取牆線，以車體中心的 d 找出所在通道（上下相鄰兩條牆線），牆面 = 牆線 ∓ 牆厚/2
 */
export function wallPenetration(env, car) {
  const { track } = env;
  const t = car.chassis.translation();
  const c = track.path.project(t.x, t.z);
  const half = track.dims.wallT / 2;
  let pen = -Infinity;
  for (const p of carExtremePoints(car)) {
    const pp = track.path.project(p.x, p.z);
    const lines = track.lineOffsetsAt(pp.s);
    let upper = Infinity;
    let lower = -Infinity;
    for (const d of lines) {
      if (d >= c.d) {
        upper = Math.min(upper, d);
      } else {
        lower = Math.max(lower, d);
      }
    }
    pen = Math.max(pen, pp.d - (upper - half), lower + half - pp.d);
  }
  return pen;
}
