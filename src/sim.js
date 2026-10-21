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
  // 路面（換道器的橋板與引道）：和地板一樣是路面，不列入牆（P06 只量牆）
  const roadHandles = new Set();
  for (const m of track.roadMeshes ?? []) {
    const col = world.createCollider(RAPIER.ColliderDesc.trimesh(m.vertices, m.indices, flags).setFriction(0.3), ground);
    roadHandles.add(col.handle);
  }
  return { world, floor, wallHandles, roadHandles, track };
}

/**
 * 車子目前所在的層（'ground' 地面 / 'bridge' 換道器橋上）：以車體原點（輪胎接地面中央）判斷，
 * 從橋下通過的車算地面層。牆的量測與位置投影只看同一層的牆（橋下的車不會被算成穿過橋上的牆）
 * @type {(env: ReturnType<typeof createWorld>, car: ReturnType<typeof createCar>) => 'ground' | 'bridge'}
 */
export function carLevel(env, car) {
  const { track } = env;
  if (!track.levelAt) {
    return 'ground';
  }
  const t = car.chassis.translation();
  return track.levelAt(t.x, t.y, t.z);
}

/**
 * 車體原點離所在層路面的高度（m）：地面層 = y，橋上 = y − 橋面高。判斷「飛出 / 跳起」用
 * @type {(env: ReturnType<typeof createWorld>, car: ReturnType<typeof createCar>) => number}
 */
export function heightAboveRoad(env, car) {
  const { track } = env;
  const t = car.chassis.translation();
  if (!track.roadHeight) {
    return t.y;
  }
  const c = track.path.project(t.x, t.z);
  return t.y - track.roadHeight(c.s, carLevel(env, car));
}

/**
 * 某點所在通道（車體中心 d 的上下相鄰兩道牆）：回傳牆線偏移與橫向斜率
 * @type {(track: any, s: number, centerD: number, level: 'ground' | 'bridge') => { upper: number, lower: number, slopeU: number, slopeL: number, faceU: number, faceL: number }}
 */
function channelAt(track, s, centerD, level) {
  const half = track.dims.wallT / 2;
  const walls = track.wallsAt ? track.wallsAt(s, level) : track.lineOffsetsAt(s).map((d) => ({ d, slope: 0, half }));
  let upper = Infinity;
  let lower = -Infinity;
  let slopeU = 0;
  let slopeL = 0;
  let halfU = half;
  let halfL = half;
  // 橋上只有一條車道（兩道橋牆）：直接取這兩道牆。斜向段的牆斜率達 0.7，
  // 若用車體中心的 d 去比對車頭 / 車尾處的牆線，會因牆線沿 s 平移而選錯通道
  if (walls.length === 2 && walls[0].bridge && walls[1].bridge) {
    const [u, l] = walls;
    return { upper: u.d, lower: l.d, slopeU: u.slope, slopeL: l.slope, faceU: u.d - u.half, faceL: l.d + l.half };
  }
  for (const w of walls) {
    if (w.d >= centerD) {
      if (w.d < upper) {
        upper = w.d;
        slopeU = w.slope;
        halfU = w.half ?? half;
      }
    } else if (w.d > lower) {
      lower = w.d;
      slopeL = w.slope;
      halfL = w.half ?? half;
    }
  }
  // 牆面（朝車道那一面）沿 d 的位置
  return { upper, lower, slopeU, slopeL, faceU: upper - halfU, faceL: lower + halfL };
}

/**
 * 車體碰撞方塊（mm，車體座標）：車殼外框的長寬，底面 = 底盤離地高度，頂面 = 車殼頂 − 2 mm（同第一階段）；沒裝車殼時用底盤本體外框
 * @type {(asm: any) => { hx: number, hy: number, hz: number, cx: number, cy: number }}
 */
export function bodyColliderBox(asm) {
  // 沒裝車殼（asm.body = null）時用底盤本體外框
  const b = asm.body?.bbox_mm ?? asm.chassisBox_mm;
  // 底面 = 底盤 / 車殼 / 導輪的最低點（不含煞車海綿、配重等掛在下方的選配零件：海綿另有接觸模型，見 spongeForces）
  const bottom = asm.structureClearance_mm ?? asm.groundClearance_mm;
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
  // 車體剛體 = 整車扣掉可上下滑動的制振器（制振器另建剛體，用 prismatic joint 連到車體）；沒有制振器時 rigid = 整車
  const rigid = asm.rigid ?? { mass_g: asm.mass_g, com_mm: asm.com_mm, inertia_kgm2: asm.inertia_kgm2 };
  const com = { x: rigid.com_mm.x * MM, y: rigid.com_mm.y * MM, z: rigid.com_mm.z * MM };

  // 慣性矩由零件組裝推導（assembly.js：零件質點＋底盤本體與車殼的外框方塊，iter-33）
  const inertia = rigid.inertia_kgm2;

  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(start.x, 0.0005, start.z)
    .setRotation(yawQuat(-start.theta))
    .setAdditionalMassProperties(rigid.mass_g / 1000, com, inertia, { x: 0, y: 0, z: 0, w: 1 })
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
    // 導輪碰撞體用球：圓柱對 trimesh 的接觸在 Rapier 中會卡住（見 ITERATION_LOG iter-00）
    // 雙層導輪每一片接觸面各一顆球（單層導輪 tiers 只有 1 片、y = 0，和第二階段相同）
    const tiers = r.tiers ?? [{ y: 0, r: r.r, h: r.h }];
    const colliders = tiers.map((t) =>
      world.createCollider(
        RAPIER.ColliderDesc.ball(t.r * MM)
          .setTranslation(r.x * MM, (r.y + t.y) * MM, r.z * MM)
          .setDensity(0)
          .setFriction(rollerPart.wallFriction)
          .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
          .setRestitution(rollerPart.restitution),
        chassis,
      ),
    );
    // collider：最大那片（與牆接觸的主要接觸面），給 P05 等量測用
    const main = tiers.reduce((bi, t, i) => (t.r > tiers[bi].r ? i : bi), 0);
    return { ...r, collider: colliders[main], colliders };
  });

  // 制振器（第三階段）：獨立剛體＋prismatic joint（沿車體 y 軸上下滑動，行程上下限為硬止點），
  // 下止點是有彈性的座墊（單邊接觸：只能往上推、不能往下拉，見 damperForces）
  const dampers = (asm.movable ?? []).map((d) => {
    const m = d.mass_g / 1000;
    const g = spec.sim.gravity;
    const seatK = (m * g) / (d.seatDeflection_mm * MM);
    const seatC = 2 * d.seatDampingRatio * Math.sqrt(seatK * m);
    const anchor = { x: d.pos.x * MM, y: d.pos.y * MM, z: d.pos.z * MM };
    // 初始位置：座墊在自重下壓縮 δ 的平衡點
    const local = { x: anchor.x, y: anchor.y - d.seatDeflection_mm * MM, z: anchor.z };
    const rq = yawQuat(-start.theta);
    const wp = rotate(rq, local);
    const rb = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(start.x + wp.x, 0.0005 + wp.y, start.z + wp.z)
        .setRotation(rq)
        // 自身慣性：小圓柱 / 方塊（數值很小；prismatic joint 鎖住轉動，不影響結果）
        .setAdditionalMassProperties(m, { x: 0, y: 0, z: 0 }, { x: 1e-9, y: 1e-9, z: 1e-9 }, { x: 0, y: 0, z: 0, w: 1 })
        .setCcdEnabled(true)
        .setCanSleep(false),
    );
    const jd = RAPIER.JointData.prismatic(anchor, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
    jd.limitsEnabled = true;
    // 下限：座墊最多壓縮 1 mm（之後是硬止點）；上限：行程
    jd.limits = [-1 * MM, d.stroke_mm * MM];
    const joint = world.createImpulseJoint(jd, chassis, rb, true);
    return { body: rb, joint, anchor, mass: m, seatK, seatC, slideC: d.slideFriction_Nspm, label: d.label };
  });

  // 煞車海綿（第三階段）：海綿底面的接觸點（車體座標，m）；接觸剛性 k = E·A / t，只在射線碰到地面 / 坡道時產生力
  const sp = asm.optional?.sponge;
  let sponge = null;
  if (sp) {
    const b = sp.solid;
    const lift = asm.lift_mm;
    const y = (b.min.y + lift) * MM;
    /** @type {{ x: number, y: number, z: number }[]} 底面 4 角＋中心，各分擔 1/5 面積 */
    const pts = [
      { x: b.min.x, z: b.min.z },
      { x: b.min.x, z: b.max.z },
      { x: b.max.x, z: b.min.z },
      { x: b.max.x, z: b.max.z },
      { x: (b.min.x + b.max.x) / 2, z: 0 },
    ].map((q) => ({ x: q.x * MM, y, z: q.z * MM }));
    const part = sp.part;
    const k = (part.compressiveModulus_Pa * sp.area_mm2 * MM * MM) / (part.thickness_mm * MM);
    const c = 2 * part.contactDampingRatio * Math.sqrt(k * massKg);
    sponge = { pts, k, c, mu: part.frictionCoeff, thickness: part.thickness_mm * MM, contact: false, normalForce: 0, frictionWork: 0 };
  }

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
    dampers,
    sponge,
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
  for (const d of car.dampers ?? []) {
    d.body.resetForces(true);
  }

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

  if (car.sponge) {
    spongeForces(env, car, { up, fwd, side });
  }
  for (const d of car.dampers ?? []) {
    damperForces(car, d, up);
  }

  env.world.step();
  // 導輪–牆接觸的補強（iter-49）：預設 'impulse' = 速度層級的非彈性碰撞衝量（wallContactImpulses，動量一致）；
  // 'position' = iter-34 的位置投影（只改位置、不改動量，保留作比較）；'none' = 只用 Rapier 的軟接觸。
  // config 的 wallPositionProjection 已由 wallContactMode 取代（iter-49）
  const mode = spec.sim.wallContactMode ?? 'impulse';
  if (mode === 'impulse' || mode === 'impulse+position') {
    wallContactImpulses(env, car);
  }
  if (mode === 'position' || mode === 'impulse+position') {
    projectRollersOutOfWalls(env, car);
  }

  if (car.powered && car.drain) {
    car.battery.drain(lf.current, dt);
  }
  car.last = { current: lf.current, terminalVoltage: lf.terminalVoltage, speed: v };
}

/**
 * 煞車海綿接觸力（第三階段）：海綿底面每個接觸點沿車體 −up 打射線，射線起點在海綿底面上方 PROBE；
 * 命中距離 < PROBE 代表海綿被地面 / 坡道壓縮 δ = PROBE − 距離（最多到海綿厚度）。
 * 法向力 = k·δ − c·v_n（≥ 0，單邊接觸），摩擦力 = μ·N，方向與接觸點切向速度相反（低速以 0.05 m/s 正則化避免反向）。
 * 沒碰到地面時完全沒有力（平地上海綿底面離地 > 0 時不影響極速）
 * @type {(env: any, car: any, axes: { up: any, fwd: any, side: any }) => void}
 */
function spongeForces(env, car, { up }) {
  const sp = car.sponge;
  const body = car.chassis;
  const PROBE = 0.004;
  const n = sp.pts.length;
  sp.contact = false;
  sp.normalForce = 0;
  for (const lp of sp.pts) {
    const p = localToWorld(car, lp);
    const origin = { x: p.x + up.x * PROBE, y: p.y + up.y * PROBE, z: p.z + up.z * PROBE };
    const ray = new RAPIER.Ray(origin, { x: -up.x, y: -up.y, z: -up.z });
    const hit = env.world.castRayAndGetNormal(ray, PROBE + sp.thickness, true, undefined, undefined, undefined, body);
    if (!hit || hit.timeOfImpact >= PROBE) {
      continue;
    }
    const delta = Math.min(PROBE - hit.timeOfImpact, sp.thickness);
    const nrm = hit.normal;
    const cp = { x: origin.x - up.x * hit.timeOfImpact, y: origin.y - up.y * hit.timeOfImpact, z: origin.z - up.z * hit.timeOfImpact };
    const v = body.velocityAtPoint(cp);
    const vn = v.x * nrm.x + v.y * nrm.y + v.z * nrm.z;
    const fn = Math.max(0, (sp.k / n) * delta - (sp.c / n) * vn);
    if (fn <= 0) {
      continue;
    }
    const vt = { x: v.x - vn * nrm.x, y: v.y - vn * nrm.y, z: v.z - vn * nrm.z };
    const vtLen = Math.hypot(vt.x, vt.y, vt.z);
    const ft = (sp.mu * fn) / Math.max(vtLen, 0.05);
    body.addForceAtPoint(
      { x: nrm.x * fn - vt.x * ft, y: nrm.y * fn - vt.y * ft, z: nrm.z * fn - vt.z * ft },
      cp,
      true,
    );
    sp.contact = true;
    sp.normalForce += fn;
    sp.frictionWork += ft * vtLen * vtLen * spec.sim.dt_s;
  }
}

/**
 * 制振器座墊與滑動摩擦（第三階段）：rel = 制振器相對安裝點沿車體 up 的位移（0 = 座墊剛好接觸、未壓縮）。
 * rel < 0 時座墊被壓縮：F = k·(−rel) − c·rel'（≥ 0，只能把制振器往上推）；另有沿螺絲軸的黏滯摩擦 −c_s·rel'。
 * 反作用力施加在車體的安裝點（牛頓第三定律），行程上下限由 prismatic joint 的硬止點處理
 * @type {(car: any, d: any, up: any) => void}
 */
function damperForces(car, d, up) {
  const anchorW = localToWorld(car, d.anchor);
  const t = d.body.translation();
  const rel = (t.x - anchorW.x) * up.x + (t.y - anchorW.y) * up.y + (t.z - anchorW.z) * up.z;
  const vd = d.body.linvel();
  const va = car.chassis.velocityAtPoint(anchorW);
  const relV = (vd.x - va.x) * up.x + (vd.y - va.y) * up.y + (vd.z - va.z) * up.z;
  let f = -d.slideC * relV;
  if (rel < 0) {
    f += Math.max(0, d.seatK * -rel - d.seatC * relV);
  }
  d.body.addForce({ x: up.x * f, y: up.y * f, z: up.z * f }, true);
  car.chassis.addForceAtPoint({ x: -up.x * f, y: -up.y * f, z: -up.z * f }, anchorW, true);
}

/**
 * 整車動能（J）：車體剛體（平移＋轉動）＋制振器剛體。輪胎轉動慣量在本模型中忽略（射線輪）
 * @type {(car: any) => number}
 */
export function carKineticEnergy(car) {
  const b = car.chassis;
  const v = b.linvel();
  const w = b.angvel();
  // 角速度轉到車體座標（慣性主軸與車體座標對齊，assembly.js 忽略慣性積）
  const q = b.rotation();
  const wl = rotate({ x: -q.x, y: -q.y, z: -q.z, w: q.w }, w);
  const I = b.principalInertia();
  let e = 0.5 * b.mass() * (v.x * v.x + v.y * v.y + v.z * v.z) + 0.5 * (I.x * wl.x * wl.x + I.y * wl.y * wl.y + I.z * wl.z * wl.z);
  for (const d of car.dampers ?? []) {
    const u = d.body.linvel();
    e += 0.5 * d.body.mass() * (u.x * u.x + u.y * u.y + u.z * u.z);
  }
  return e;
}

/**
 * 導輪不穿牆的位置投影（iter-34；iter-49 起預設改用 wallContactImpulses，這個只在 wallContactMode = 'position' 時使用）：Rapier 的軟接觸在導輪高頻抖動（前後導輪交替貼牆、約 500 Hz）時
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
  const t = car.chassis.translation();
  const center = track.path.project(t.x, t.z);
  const level = carLevel(env, car);
  let worst = 0;
  let dir = 0;
  let sAt = center.s;
  for (const r of car.rollers) {
    const w = localToWorld(car, { x: r.x * MM, y: r.y * MM, z: r.z * MM });
    const pp = track.path.project(w.x, w.z);
    const ch = channelAt(track, pp.s, center.d, level);
    // 斜向牆（換道段）上，球沿賽道橫向的伸展 = r / cosα = r·√(1 + 斜率²)
    const rU = r.r * MM * Math.sqrt(1 + ch.slopeU * ch.slopeU);
    const rL = r.r * MM * Math.sqrt(1 + ch.slopeL * ch.slopeL);
    const penUpper = pp.d + rU - ch.faceU;
    const penLower = ch.faceL - (pp.d - rL);
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
 * 導輪與牆的接觸點（世界座標）：牆面法向 n（水平、由牆指向車道）、接觸點 p（導輪球面最深入牆的點）、垂直牆面的穿透深度 pen
 * @type {(env: ReturnType<typeof createWorld>, car: ReturnType<typeof createCar>) => { n: { x: number, y: number, z: number }, p: { x: number, y: number, z: number }, pen: number }[]}
 */
function rollerWallContacts(env, car) {
  const { track } = env;
  const t = car.chassis.translation();
  const center = track.path.project(t.x, t.z);
  const level = carLevel(env, car);
  const out = [];
  for (const r of car.rollers) {
    const w = localToWorld(car, { x: r.x * MM, y: r.y * MM, z: r.z * MM });
    const pp = track.path.project(w.x, w.z);
    const ch = channelAt(track, pp.s, center.d, level);
    const pose = track.path.pose(pp.s);
    const T = { x: Math.cos(pose.theta), z: Math.sin(pose.theta) };
    const N = { x: -Math.sin(pose.theta), z: Math.cos(pose.theta) };
    const rr = r.r * MM;
    for (const side of [1, -1]) {
      const k = side > 0 ? ch.slopeU : ch.slopeL;
      const face = side > 0 ? ch.faceU : ch.faceL;
      if (!Number.isFinite(face)) {
        continue;
      }
      const cos = 1 / Math.sqrt(1 + k * k);
      // 上側牆（d 較大）：法向 = (k·T − N)·cos；下側牆：(N − k·T)·cos
      const nx = side * (k * T.x - N.x) * cos;
      const nz = side * (k * T.z - N.z) * cos;
      const pen = rr - side * (face - pp.d) * cos;
      if (pen <= 0) {
        continue;
      }
      out.push({ n: { x: nx, y: 0, z: nz }, p: { x: w.x - nx * rr, y: w.y, z: w.z - nz * rr }, pen });
    }
  }
  return out;
}

/**
 * 導輪撞牆的速度層級約束（非彈性碰撞衝量，iter-49 取代 iter-34 的位置投影）：
 * 問題：Rapier 的軟接觸（soft constraint）在彎道持續側向力下，導輪會被壓進牆 0.6–1.1 mm 的穩態穿透（見 projectRollersOutOfWalls 說明）。
 * 做法：導輪穿入牆面超過 slop、且接觸點朝牆移動時，
 * 在接觸點沿牆面法向施加衝量 J = −v_n / K（K = 1/m + (r×n)·I⁻¹(r×n)），使接觸點法向速度變 0。
 * 衝量同時改變車體的線動量與角動量（牆的反作用力，牛頓第三定律），恢復係數 0、不增加動能。
 * 多個導輪同時接觸時用循序衝量（Gauss–Seidel，累積衝量 ≥ 0）。只改速度、不直接改位置：穿透由 Rapier 自身的接觸偏壓逐步修回。
 * 結果（iter-49）：預設車一圈最大穿透 0.06 mm（幾何）/ 0.13 mm（接觸），6 款車殼 3 圈 ≤ 0.15 mm，彎道貼牆比例 ≈ 99%（未出現 iter-34 「整車移除朝牆速度」時的彈離）。
 * @type {(env: ReturnType<typeof createWorld>, car: ReturnType<typeof createCar>) => void}
 */
function wallContactImpulses(env, car) {
  const slop = spec.sim.wallProjectionSlop_mm * MM;
  const contacts = rollerWallContacts(env, car).filter((c) => c.pen > slop);
  if (contacts.length === 0) {
    return;
  }
  const body = car.chassis;
  const invM = body.invMass();
  const Iinv = body.effectiveWorldInvInertia();
  const com = body.worldCom();
  /** @type {(v: { x: number, y: number, z: number }) => { x: number, y: number, z: number }} */
  const mulI = (v) => ({
    x: Iinv.m11 * v.x + Iinv.m12 * v.y + Iinv.m13 * v.z,
    y: Iinv.m12 * v.x + Iinv.m22 * v.y + Iinv.m23 * v.z,
    z: Iinv.m13 * v.x + Iinv.m23 * v.y + Iinv.m33 * v.z,
  });
  /** @type {(a: any, b: any) => { x: number, y: number, z: number }} */
  const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
  for (const c of contacts) {
    const rc = { x: c.p.x - com.x, y: c.p.y - com.y, z: c.p.z - com.z };
    const rn = cross(rc, c.n);
    const irn = mulI(rn);
    c.K = invM + rn.x * irn.x + rn.y * irn.y + rn.z * irn.z;
    c.acc = 0;
  }
  const iters = spec.sim.wallImpulseIterations ?? 4;
  for (let it = 0; it < iters; it++) {
    for (const c of contacts) {
      const v = body.velocityAtPoint(c.p);
      const vn = v.x * c.n.x + v.y * c.n.y + v.z * c.n.z;
      const next = Math.max(0, c.acc - vn / c.K);
      const dj = next - c.acc;
      c.acc = next;
      if (dj !== 0) {
        body.applyImpulseAtPoint({ x: c.n.x * dj, y: c.n.y * dj, z: c.n.z * dj }, c.p, true);
      }
    }
  }
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
 * 對每個外緣點：在該點的 s 處取車子所在層的牆線，以車體中心的 d 找出所在通道（上下相鄰兩條牆線），牆面 = 牆線 ∓ 牆厚/2
 */
export function wallPenetration(env, car) {
  const { track } = env;
  const t = car.chassis.translation();
  const c = track.path.project(t.x, t.z);
  // 只看車子所在那一層的牆（橋下通過的車不算橋上的牆，橋上的車不算下層的牆）；
  // 穿透沿賽道橫向量（斜向牆時比垂直牆面的距離大 1/cosα 倍，偏嚴格）
  const level = carLevel(env, car);
  let pen = -Infinity;
  for (const p of carExtremePoints(car)) {
    const pp = track.path.project(p.x, p.z);
    const ch = channelAt(track, pp.s, c.d, level);
    pen = Math.max(pen, pp.d - ch.faceU, ch.faceL - pp.d);
  }
  return pen;
}
