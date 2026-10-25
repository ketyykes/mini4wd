// Rapier 物理模擬：賽道（地板＋側牆方塊）、車體剛體（車體方塊＋導輪圓柱）、
// DynamicRayCastVehicleController 四輪，動力鏈由 powertrain.js 每步計算後以 engine force 施加
import RAPIER from '@dimforge/rapier3d-compat';
import { spec } from './spec.js';
import { Battery, longitudinalForce } from './powertrain.js';
import { assemble, loadConfig } from './assembly.js';
import { bodyCollisionCells } from './bodies/collision.js';

const MM = 0.001;

// 碰撞群組（第七階段 iter-77，物理稽核 H1）：Rapier 的 collision groups = (成員 << 16) | 過濾，兩個碰撞體都在對方的過濾裡才會碰撞。
// 導輪與穩定零件的碰撞體只代表「碰牆的那一圈」：導輪用球近似（圓柱對 trimesh 會卡住，見 iter-00），球的垂直範圍（± 半徑）比實際導輪高度大很多，
// 19 mm 導輪的球底只離地 0.5 mm、配 24 mm 輪時球底低於地面 → 整台車架在導輪球上、四輪法向力 0（實車導輪不會碰地）。
// 所以導輪 / 穩定零件只和牆碰撞；地板、換道器路面、車體方塊照舊互相碰撞
const GROUP_GROUND = 0x0001;
const GROUP_WALL = 0x0002;
const GROUP_CAR = 0x0004;
const GROUP_ROLLER = 0x0008;
const ALL_GROUPS = 0xffff;
/** @type {(member: number, filter: number) => number} */
const collisionGroups = (member, filter) => ((member << 16) | filter) >>> 0;
/** 地板、路面：成員 GROUND，和所有群組碰撞（導輪那邊的過濾不含 GROUND，所以實際不碰導輪） */
const GROUND_GROUPS = collisionGroups(GROUP_GROUND, ALL_GROUPS);
/** 牆：成員 WALL，和所有群組碰撞 */
const WALL_GROUPS = collisionGroups(GROUP_WALL, ALL_GROUPS);
/** 車體方塊：成員 CAR */
const CAR_GROUPS = collisionGroups(GROUP_CAR, ALL_GROUPS);
/** 導輪、穩定零件：成員 ROLLER，只和牆碰撞 */
const ROLLER_GROUPS = collisionGroups(GROUP_ROLLER, GROUP_WALL);

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
      .setFriction(0.3)
      .setCollisionGroups(GROUND_GROUPS),
    ground,
  );

  const wallHandles = new Set();
  const flags = RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES;
  for (const m of track.wallMeshes) {
    const col = world.createCollider(
      RAPIER.ColliderDesc.trimesh(m.vertices, m.indices, flags).setFriction(spec.track.wallFriction).setCollisionGroups(WALL_GROUPS),
      ground,
    );
    wallHandles.add(col.handle);
  }
  // 路面（換道器的橋板與引道）：和地板一樣是路面，不列入牆（P06 只量牆）
  const roadHandles = new Set();
  for (const m of track.roadMeshes ?? []) {
    const col = world.createCollider(RAPIER.ColliderDesc.trimesh(m.vertices, m.indices, flags).setFriction(0.3).setCollisionGroups(GROUND_GROUPS), ground);
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
 * Legacy diagnostic envelope (mm), also used for the bare chassis core.
 * A car with a body collides through bodyColliderDesc's mesh-derived patches.
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

const hullShapeCache = new WeakMap();
/** One compound collider: chassis core plus mesh-derived box patches. */
export function bodyColliderDesc(asm) {
  const box = bodyColliderBox({ ...asm, body: null });
  const shapes = [new RAPIER.Cuboid(box.hx * MM, box.hy * MM, box.hz * MM)];
  const positions = [{ x: box.cx * MM, y: box.cy * MM, z: 0 }];
  const identity = { x: 0, y: 0, z: 0, w: 1 };
  // Once the foam is completely compressed, its real rigid backing plate
  // takes the contact. Do not fill the compressible foam with a rigid collider.
  const backing = asm.optional?.sponge?.plate?.box;
  if (backing) {
    const { min, max } = backing;
    shapes.push(new RAPIER.Cuboid((max.x - min.x) * MM / 2, (max.y - min.y) * MM / 2, (max.z - min.z) * MM / 2));
    positions.push({ x: (max.x + min.x) * MM / 2, y: ((max.y + min.y) / 2 + asm.lift_mm) * MM, z: (max.z + min.z) * MM / 2 });
  }
  if (asm.body) {
    const def = asm.body.def;
    let hulls = hullShapeCache.get(def);
    if (!hulls) {
      hulls = bodyCollisionCells(def).map((points) => {
        const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
        for (let i = 0; i < points.length; i++) { const k = i % 3; min[k] = Math.min(min[k], points[i]); max[k] = Math.max(max[k], points[i]); }
        const center = min.map((v, k) => (v + max[k]) / 2);
        // Analytic boxes keep CCD/races affordable. Each box bounds only this
        // clipped mesh patch, never the full car's length/height/width.
        const shape = new RAPIER.Cuboid(...min.map((v, k) => Math.max((max[k] - v) * MM / 2, 1e-8)));
        return { shape, position: { x: center[0] * MM, y: center[1] * MM, z: center[2] * MM } };
      });
      hullShapeCache.set(def, hulls);
    }
    for (const { shape, position } of hulls) {
      shapes.push(shape);
      positions.push({ ...position, y: position.y + asm.lift_mm * MM });
    }
  }
  return RAPIER.ColliderDesc.compound(shapes, positions, shapes.map(() => identity), RAPIER.CompoundFlags.FIX_INTERNAL_EDGES)
    .setDensity(0).setFriction(0.3).setCollisionGroups(CAR_GROUPS);
}

const extremesCache = new WeakMap();
/** Vertices of the convex envelope of the actual collision patches. These are
 * material/proxy points, not the empty corners of a car-wide bounding box. */
export function collisionExtremePoints(asm) {
  const box = bodyColliderBox({ ...asm, body: null });
  const points = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
    points.push({ x: (box.cx + x * box.hx) * MM, y: (box.cy + y * box.hy) * MM, z: z * box.hz * MM });
  }
  if (!asm.body) return points;
  const def = asm.body.def;
  let surface = extremesCache.get(def);
  if (!surface) {
    const clouds = bodyCollisionCells(def);
    const vertices = [];
    for (const p of clouds) {
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < p.length; i++) { const k = i % 3; min[k] = Math.min(min[k], p[i]); max[k] = Math.max(max[k], p[i]); }
      for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) vertices.push(x * MM, y * MM, z * MM);
    }
    const raw = RAPIER.ColliderDesc.convexHull(Float32Array.from(vertices)).shape.intoRaw();
    if (!raw) throw new Error(`Invalid collision envelope: ${def.id}`);
    surface = RAPIER.Shape.fromRawShape(raw).vertices;
    extremesCache.set(def, surface);
  }
  for (let i = 0; i < surface.length; i += 3) points.push({ x: surface[i], y: surface[i + 1] + asm.lift_mm * MM, z: surface[i + 2] });
  return points;
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

  // Full assembly tensor is diagonalized; the principal frame need not be
  // aligned with the body axes. Collider densities remain zero.
  const inertia = rigid.inertia_kgm2;

  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(start.x, 0.0005, start.z)
    .setRotation(yawQuat(-start.theta))
    .setAdditionalMassProperties(rigid.mass_g / 1000, com, inertia, rigid.inertiaFrame ?? { x: 0, y: 0, z: 0, w: 1 })
    .setCcdEnabled(true)
    .setCanSleep(false);
  const chassis = world.createRigidBody(bodyDesc);

  const bodyCol = world.createCollider(
    bodyColliderDesc(asm),
    chassis,
  );

  // 滑動保桿（第五階段 iter-61）：滑動板＋前導輪（＋穩定零件）是獨立剛體，用 prismatic joint 連到車體，只能沿車體 z（左右）滑動，
  // 行程上下限 ±stroke 為 joint 的硬止擋；彈簧（含預壓）與阻尼由 sliderSpringImpulse 每步施加（作用力與反作用力，見該函式）。
  // 前導輪的碰撞體掛在滑動板剛體上，所以牆對前導輪的力只能經過彈簧（或行程端點止擋）傳到車體；牆面接觸衝量見 sliderContactImpulses
  // iter-64：推廣到前、後各自可有一個滑動板（前後都裝時是兩個獨立剛體，各自一個 prismatic joint 與彈簧）；後導輪掛在後滑動板上
  /** @type {import('./parts/types').PlacedSlider[]} */
  const placedSliders = asm.sliders ?? (asm.slider ? [asm.slider] : []);
  const sliders = placedSliders.map((sl) => createSlider(world, chassis, sl, start));
  const slider = sliders.find((sl) => sl.slot === 'frontStay') ?? null;

  const rollers = asm.layout.rollers.map((r) => {
    // iter-56：前後導輪分開選，每顆導輪依自己的 slot（frontRollers / rearRollers）取零件資料（摩擦、恢復係數、錐形輪廓）
    const rollerPart = asm.partsBySlot[r.slot];
    // 這顆導輪所在的滑動板（前導輪 → 前滑動板、後導輪 → 後滑動板；沒有就是 null = 固定在車體）
    const mountSlider = sliders.find((sl) => sl.rollerSlot === r.slot) ?? null;
    const onSlider = mountSlider !== null;
    // 碰撞體掛的剛體與座標原點：滑動板上的導輪掛在滑動板剛體（原點 = 滑動部分質心），其餘掛在車體
    const parent = onSlider ? mountSlider.body : chassis;
    const o = onSlider ? mountSlider.anchor : { x: 0, y: 0, z: 0 };
    // 導輪碰撞體用球：圓柱對 trimesh 的接觸在 Rapier 中會卡住（見 ITERATION_LOG iter-00）
    // 雙層導輪每一片接觸面各一顆球（單層導輪 tiers 只有 1 片、y = 0，和第二階段相同）
    const tiers = r.tiers ?? [{ y: 0, r: r.r, h: r.h }];
    const colliders = tiers.map((t) =>
      world.createCollider(
        RAPIER.ColliderDesc.ball(t.r * MM)
          .setTranslation(r.x * MM - o.x, (r.y + t.y) * MM - o.y, r.z * MM - o.z)
          .setDensity(0)
          // 第七階段（iter-76）：雙層導輪每一片可有自己的摩擦 / 恢復係數（例如 15418 上層橡膠環），沒有時用零件層級的值
          .setFriction(t.wallFriction ?? rollerPart.wallFriction)
          .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
          .setRestitution(t.restitution ?? rollerPart.restitution)
          // iter-85（稽核 L5）：牆的恢復係數是 0，Rapier 預設 Average 會把零件的 e 砍半；改 Max → 實際 e = 零件資料的值
          .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max)
          .setCollisionGroups(ROLLER_GROUPS),
        parent,
      ),
    );
    // collider：最大那片（與牆接觸的主要接觸面），給 P05 等量測用
    const main = tiers.reduce((bi, t, i) => (t.r > tiers[bi].r ? i : bi), 0);
    // 錐形導輪（第四階段）：接觸幾何（上段圓柱＋下段截錐）給 rollerWallContacts 用；一般導輪 taper = null（整顆是圓柱）
    return { ...r, collider: colliders[main], colliders, taper: rollerPart.taper ?? null, onSlider, slider: mountSlider };
  });

  // 穩定零件（第四階段）：前導輪上方的 POM 圓柱（不轉動），用 Rapier 圓柱碰撞體掛在車體上。
  // 接觸力完全由碰撞偵測決定：只有圓柱實際碰到牆面 / 牆頂（或任何其他碰撞體）時才有力；直立行駛時它在導輪外緣內側、離牆有間隙，沒有任何力
  const stabilizers = (asm.optional?.stabilizers ?? []).map((st) => {
    const lift = asm.lift_mm;
    // 穩定零件和前導輪同一支螺絲：裝滑動保桿時跟著滑動板一起滑動（掛在滑動板剛體上）
    const onSlider = !!slider;
    const o = onSlider ? slider.anchor : { x: 0, y: 0, z: 0 };
    const collider = world.createCollider(
      RAPIER.ColliderDesc.cylinder((st.h / 2) * MM, st.r * MM)
        .setTranslation(st.pos.x * MM - o.x, (st.pos.y + lift) * MM - o.y, st.pos.z * MM - o.z)
        .setDensity(0)
        .setFriction(st.part.wallFriction)
        .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
        .setRestitution(st.part.restitution)
        .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max)
        .setCollisionGroups(ROLLER_GROUPS),
      onSlider ? slider.body : chassis,
    );
    // 局部座標（m）：圓柱軸的上下端點與半徑，給 stabilizerWallContacts 用；mu = 對牆滑動摩擦（不轉動）
    const c = { x: st.pos.x * MM, y: (st.pos.y + lift) * MM, z: st.pos.z * MM };
    const axisPts = [-1, 1].map((k) => ({ x: c.x, y: c.y + k * (st.h / 2) * MM, z: c.z }));
    return { label: st.label, collider, axisPts, r: st.r * MM, mu: st.part.wallFriction, contact: false, normalForce: 0, contactSteps: 0, onSlider, slider: onSlider ? slider : null };
  });

  // 制振器（第三階段）：獨立剛體＋prismatic joint（沿車體 y 軸上下滑動，行程上下限為硬止點），
  // 下止點是有彈性的座墊（單邊接觸：只能往上推、不能往下拉，見 damperForces）
  const dampers = (asm.movable ?? []).map((d) => {
    if (d.pivot) {
      return createSwingDamper(world, chassis, d, start);
    }
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
    // slider = 前滑動板（相容 iter-61 的欄位）、rearSlider = 後滑動板、sliders = 全部（前在前）
    slider,
    rearSlider: sliders.find((sl) => sl.slot === 'rearStay') ?? null,
    sliders,
    sponge,
    stabilizers,
    wheels,
    wheelParams: { wheelR, restLen, springK, damperC },
    massKg,
    asm,
    P,
    box: bodyColliderBox(asm), // Diagnostic envelope only; collisions use bodyCol.
    extremePoints: collisionExtremePoints(asm),
    // 傳動系轉動狀態（第四階段）：omega = 輪子角速度（rad/s，4 輪與齒輪、馬達機械連結成一個自由度），J = 換算到輪軸的等效轉動慣量
    // 第七階段（iter-79）單向輪：oneWay = true 時 omega = 輪子角速度（J_w = 4 顆輪），omegaD = 傳動系（馬達＋齒輪＋輪軸，J_d = J − J_w）角速度，
    // 兩者經單向離合連接（見 stepCar）；engaged = 本步離合是否咬合
    spin: { omega: 0, J: P.spinInertia, oneWay: P.oneWayClutch, omegaD: 0, Jd: P.spinInertia - P.spinInertiaWheels, Jw: P.spinInertiaWheels, engaged: true },
    battery: new Battery(P, opt.soc ?? 1),
    drain: opt.drain ?? true,
    powered: opt.powered ?? true,
    // normalSum 初值 = 車重（車子放在地面上），之後每步由射線輪的法向力合計更新（物理稽核 L3）
    last: { current: 0, terminalVoltage: 0, speed: 0, normalSum: P.massTotal * P.gravity },
  };
}

/**
 * 建立滑動保桿的滑動剛體（iter-61）：質量、質心、慣性取自組裝（asm.slider）；prismatic joint 只留車體 z 方向的平移，
 * joint 行程上下限 ±stroke 是硬止擋。彈簧常數 k、預壓 F0、中央擋塊剛性 k_seat = F0 / δ_seat、阻尼係數 c = 2ζ√(k·m)
 * @type {(world: any, chassis: any, sl: import('./parts/types').PlacedSlider, start: { x: number, z: number, theta: number }) => any}
 */
function createSlider(world, chassis, sl, start) {
  const m = sl.mass_g / 1000;
  // 車體局部座標（m）：滑動部分質心在行程中央時的位置 = joint 在車體上的錨點
  const anchor = { x: sl.com_mm.x * MM, y: sl.com_mm.y * MM, z: sl.com_mm.z * MM };
  const rq = yawQuat(-start.theta);
  const wp = rotate(rq, anchor);
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(start.x + wp.x, 0.0005 + wp.y, start.z + wp.z)
      .setRotation(rq)
      .setAdditionalMassProperties(m, { x: 0, y: 0, z: 0 }, sl.inertia_kgm2, sl.inertiaFrame ?? { x: 0, y: 0, z: 0, w: 1 })
      .setCcdEnabled(true)
      .setCanSleep(false),
  );
  const jd = RAPIER.JointData.prismatic(anchor, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
  jd.limitsEnabled = true;
  const stroke = sl.stroke_mm * MM;
  jd.limits = [-stroke, stroke];
  const joint = world.createImpulseJoint(jd, chassis, body, true);
  // 滑動板上的導輪碰撞體和車體碰撞方塊互相重疊（導輪在車體外框內），兩者以 joint 相連，不做碰撞
  joint.setContactsEnabled(false);
  const k = sl.springK_N_per_mm * 1000;
  const F0 = sl.preload_N;
  const seatDefl = sl.seatDeflection_mm * MM;
  return {
    slot: sl.slot ?? 'frontStay',
    rollerSlot: sl.rollerSlot ?? 'frontRollers',
    body,
    joint,
    anchor,
    mass: m,
    stroke,
    k,
    F0,
    seatDefl,
    kSeat: F0 > 0 ? F0 / seatDefl : 0,
    c: 2 * sl.dampingRatio * Math.sqrt(k * m),
    // 量測用：本步彈簧＋阻尼合力（N，作用在滑動板上，沿車體 z）、累計阻尼耗能（J）
    force: 0,
    dampingWork: 0,
  };
}

/**
 * 滑動保桿的彈簧力（不含阻尼，N，作用在滑動板上，沿車體 z）：F(u) = −[k·u + sign(u)·min(F0, k_seat·|u|)]
 * 預壓 F0 由中央擋塊承受：|u| ≤ δ_seat 時擋塊彈性變形、力由 0 線性升到 F0；之後彈簧 k 再接著壓縮。F 只是 u 的函數（保守力），位能見 sliderSpringEnergy
 * @type {(sl: any, u: number) => number}
 */
function sliderSpringForce(sl, u) {
  const seat = Math.min(sl.F0, sl.kSeat * Math.abs(u));
  return -(sl.k * u + Math.sign(u) * seat);
}

/**
 * 滑動保桿的彈簧位能（J）：V(u) = ½·k·u² + （|u| ≤ δ：½·k_seat·u²；否則 F0·|u| − ½·F0·δ）
 * @type {(sl: any, u: number) => number}
 */
function sliderSpringEnergy(sl, u) {
  const a = Math.abs(u);
  const seat = a <= sl.seatDefl ? 0.5 * sl.kSeat * a * a : sl.F0 * a - 0.5 * sl.F0 * sl.seatDefl;
  return 0.5 * sl.k * u * u + seat;
}

/**
 * 滑動板相對車體的位移 u（m，沿車體 z，0 = 行程中央）與相對速度 u'（m/s）；sl 省略時為前滑動板（car.slider）
 * @type {(car: any, sl?: any) => { u: number, uDot: number }}
 */
function sliderRelative(car, sl = car.slider) {
  const side = rotate(car.chassis.rotation(), { x: 0, y: 0, z: 1 });
  const anchorW = localToWorld(car, sl.anchor);
  const t = sl.body.translation();
  const u = (t.x - anchorW.x) * side.x + (t.y - anchorW.y) * side.y + (t.z - anchorW.z) * side.z;
  const vs = sl.body.linvel();
  const va = car.chassis.velocityAtPoint(anchorW);
  const uDot = (vs.x - va.x) * side.x + (vs.y - va.y) * side.y + (vs.z - va.z) * side.z;
  return { u, uDot };
}

/**
 * 滑動保桿目前狀態（量測 / 測試用）：位移、相對速度、彈簧位能、本步作用力、累計阻尼耗能；沒有滑動保桿時回傳 null
 * sl 省略時為前滑動板（car.slider，iter-61 的用法）；後滑動板傳 car.rearSlider（iter-64）
 * @type {(car: any, sl?: any) => { u: number, uDot: number, springEnergy: number, force: number, dampingWork: number } | null}
 */
export function sliderState(car, sl = car.slider) {
  if (!sl) {
    return null;
  }
  const { u, uDot } = sliderRelative(car, sl);
  return { u, uDot, springEnergy: sliderSpringEnergy(sl, u), force: sl.force, dampingWork: sl.dampingWork };
}

/**
 * 滑動保桿的彈簧＋阻尼（每步）：F = F_spring(u) − c·u'，等反內衝量的廣義力只有滑動欄 F·dt，
 * 透過整個有關節系統的 M^-1 Q 更新車體與全部滑板；總動量與角動量不變，也立刻保留共同角速度。
 * 時間積分為線性化的後退 Euler（隱式）：力取「下一步的位移與速度」u + dt·u'₊、u'₊（彈簧以目前位置的局部剛性 k_eff 線性化），
 * u'₊ = u' + K·J，K = 7 自由度質量矩陣反矩陣的滑動項（含車體反衝），解出
 *   J = dt·[F_s(u) − (c + k_eff·dt)·u'] / (1 + dt·K·(c + k_eff·dt))。
 * 後退 Euler 對線性彈簧–阻尼是耗散的（每步總能量不增加；半隱式 Euler 在中央擋塊的高剛性下會讓能量來回振盪、單步可能增加），下一步 Rapier 用 u'₊ 更新位置。
 * 放在 world.step() 之後、牆面接觸衝量之前：滑動板只有約 6 g，若把彈簧力交給 Rapier 在積分中施加，
 * 彈簧在一步內把滑動板往牆推的速度（F/m·dt ≈ 0.08 m/s）只會被 Rapier 的軟接觸部分抵消，前導輪會慢慢壓進牆（實測一圈 2 mm）；
 * 先加彈簧衝量、再解接觸衝量，接觸衝量就會把朝牆速度消掉（非彈性），下一步積分時導輪不再往牆裡移動
 * iter-64：前後各有滑動板時逐一施加（index = 在 car.sliders 的位置，對應廣義座標 6 + index）；每一個衝量各自是後退 Euler，總能量仍不增加
 * @type {(car: any, sl: any, index: number, system: ReturnType<typeof sliderSystem>) => void}
 */
function sliderSpringImpulse(car, sl, index, system) {
  const { Minv, rs } = system;
  const dt = spec.sim.dt_s;
  const side = rotate(car.chassis.rotation(), { x: 0, y: 0, z: 1 });
  const { u, uDot } = sliderRelative(car, sl);
  // 局部剛性：主彈簧 k，加上在中央擋塊變形範圍內（|u| < δ）的擋塊剛性
  const kEff = sl.k + (Math.abs(u) < sl.seatDefl ? sl.kSeat : 0);
  // 這個滑動自由度的有效反質量（含車體與另一塊滑動板的反衝）
  const K = Minv[6 + index][6 + index];
  const cEff = sl.c + kEff * dt;
  const J = (dt * (sliderSpringForce(sl, u) - cEff * uDot)) / (1 + dt * K * cEff);
  const uDotNext = uDot + K * J;
  sl.force = J / dt;
  // 阻尼耗能（量測用）：阻尼力 −c·u'₊ 在這一步做的負功
  sl.dampingWork += sl.c * uDotNext * uDotNext * dt;
  // Apply M^-1 Q to the constrained system. Applying the two raw-body impulses
  // alone changes the chassis angular velocity without the boards' rotation,
  // violating their joint until the next Rapier step (and pushing past stops).
  const dq = Minv.map((row) => row[6 + index] * J);
  const addVelocity = (body, dv, dw) => {
    const v = body.linvel(), w = body.angvel();
    body.setLinvel({ x: v.x + dv.x, y: v.y + dv.y, z: v.z + dv.z }, true);
    body.setAngvel({ x: w.x + dw.x, y: w.y + dw.y, z: w.z + dw.z }, true);
  };
  const dv = { x: dq[0], y: dq[1], z: dq[2] }, dw = { x: dq[3], y: dq[4], z: dq[5] };
  addVelocity(car.chassis, dv, dw);
  car.sliders.forEach((board, k) => {
    const r = rs[k], du = dq[6 + k];
    addVelocity(board.body, {
      x: dv.x + dw.y * r.z - dw.z * r.y + du * side.x,
      y: dv.y + dw.z * r.x - dw.x * r.z + du * side.y,
      z: dv.z + dw.x * r.y - dw.y * r.x + du * side.z,
    }, dw);
  });
}

/** Internal spring impulses, respecting all slider joints immediately. */
export function applySliderSpringImpulses(car) {
  if (car.sliders.length === 0) return;
  const system = sliderSystem(car);
  car.sliders.forEach((sl, i) => sliderSpringImpulse(car, sl, i, system));
}

/**
 * 裝在車上的點（車體局部座標，m）轉世界座標：裝在滑動板 sl 上時加上該滑動板目前的位移（沿車體 z）；sl = null 表示固定在車體
 * @type {(car: any, p: { x: number, y: number, z: number }, sl: any) => { x: number, y: number, z: number }}
 */
function mountedToWorld(car, p, sl) {
  if (!sl) {
    return localToWorld(car, p);
  }
  const { u } = sliderRelative(car, sl);
  return localToWorld(car, { x: p.x, y: p.y, z: p.z + u });
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
  // 傳動系轉動慣量（第四階段 iter-54）：馬達、齒輪、輪子是一個轉動自由度 ω（輪子角速度），等效轉動慣量 J（parts/inertia.js）。
  // 動力鏈的扭力先作用在這個轉動件上：J·dω/dt = (F_q − F_x)·r，F_q = 準靜態的輪上淨推力（馬達扭力 × 齒輪比 × 效率 − 損失）/ r，
  // F_x = 輪胎實際傳給車體的縱向力（受摩擦圓限制）。純滾動時 v = ω·r，消去 F_x 得 (m + J/r²)·dv/dt = F_q + F_外力，
  // 也就是縱向運動的等效質量多了 J/r²（輕量輪框 / 中空軸 → J 變小 → 起步加速變快；穩態極速 F_q = 阻力時不受 J 影響）。
  // 實作：每步先把 F_q 當作 F_x 施加在接地點（摩擦圓限制內），積分後再用「純滾動約束衝量」把車速與 ω·r 拉齊（見 rollingConstraintImpulse），
  // 約束衝量是完全非彈性的（只會讓動能減少或不變），所以斷電滑行時「車體平移＋車體轉動＋傳動系轉動」的總動能單調不增
  const spin = car.spin;
  const wheelSpeed = spin.omega * P.wheelRadius;
  // 馬達轉速由傳動系轉速決定（不是車體速度）：騰空時輪子可以空轉到無載轉速，落地時再由約束衝量和車速拉齊
  // 單向輪：馬達轉速取傳動系 omegaD（輪子可以比傳動系轉得快）
  const driveSpeed = spin.oneWay ? spin.omegaD * P.wheelRadius : wheelSpeed;
  // 物理稽核 L3（iter-87）：滾阻與輪軸軸承阻力用上一步的 4 輪法向力合計（本步的法向力要等射線輪算完才知道，
  // 而縱向力要先決定才能分配到各輪；差一步 = 1/240 s，騰空時為 0、落地時跟著法向力變大）
  const lf = longitudinalForce(P, { speed: driveSpeed, powered: car.powered, battery: car.battery, normalLoad: car.last.normalSum });

  let net;
  if (spin.oneWay) {
    net = oneWayDrivetrainStep(car, lf, dt);
  } else if (car.powered) {
    net = lf.drive - Math.sign(wheelSpeed) * lf.resist;
  } else if (Math.abs(wheelSpeed) < 0.002) {
    // 滑行停止：不施加阻力，避免數值上反向加速
    net = 0;
  } else {
    net = -Math.sign(wheelSpeed) * lf.resist;
  }

  const body = car.chassis;
  body.resetForces(true);
  body.resetTorques(true);
  for (const d of car.dampers ?? []) {
    d.body.resetForces(true);
    d.body.resetTorques(true);
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
  // 實際傳到車體的縱向力合計（F_x）與縱向摩擦的剩餘容量（往前 / 往後，給純滾動約束衝量用）
  let appliedLong = 0;
  let spareFwd = 0;
  let spareBack = 0;
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
    appliedLong += fx;
    // 摩擦圓扣掉側向力後的縱向上限 L；本步縱向總摩擦力 fx + Π/dt 必須在 [−L, L] 內
    const longLimit = Math.sqrt(Math.max(0, limit * limit - fy * fy));
    spareFwd += Math.max(0, longLimit - fx);
    spareBack += Math.max(0, longLimit + fx);
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

  // 傳動系：沒傳到車體的那部分扭力（摩擦圓限制、騰空）讓 ω 改變；F_q 全部傳到車體時 ω 在這裡不變，由約束衝量處理
  if (spin.oneWay) {
    // 單向輪：net 只有輪胎滾動阻力，沒傳到車體的部分（騰空）作用在輪子 J_w；之後檢查離合
    if (spin.Jw > 0) {
      spin.omega += ((net - appliedLong) * P.wheelRadius * dt) / spin.Jw;
    }
    oneWayClutchEngage(spin);
  } else if (spin.J > 0) {
    spin.omega += ((net - appliedLong) * P.wheelRadius * dt) / spin.J;
  }

  if (car.sponge) {
    spongeForces(env, car, { up, fwd, side });
  }
  for (const d of car.dampers ?? []) {
    if (d.swing) {
      swingDamperForces(car, d, up);
    } else {
      damperForces(car, d, up);
    }
  }

  env.world.step();
  // 滑動保桿（iter-61）：彈簧＋阻尼以衝量形式在積分後、牆面接觸衝量之前施加（見 sliderSpringImpulse 說明）
  // iter-64：前後各一塊時逐一施加（質量矩陣只和位置有關，一步內共用）
  applySliderSpringImpulses(car);
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

  rollingConstraintImpulse(car, spareFwd * dt, spareBack * dt);

  if (car.powered && car.drain) {
    car.battery.drain(lf.current, dt);
  }
  car.last = { current: lf.current, terminalVoltage: lf.terminalVoltage, motorVoltage: lf.motorVoltage, speed: v, wheelSpeed, normalSum };
}

/**
 * 純滾動約束衝量（第四階段）：車體前進速度 v 與傳動系輪面速度 ω·r 之間的完全非彈性耦合。
 * 兩者只透過輪胎接地點的摩擦力互相作用：沿車體前進方向對車體施加衝量 Π、對傳動系施加反向扭力衝量 −Π·r，
 * 使 v + Π/m = (ω − Π·r/J)·r → Π = (ω·r − v) / (1/m + r²/J)。
 * 摩擦限制：本步接地點的縱向摩擦衝量合計（每步輪胎力 F_x·dt ＋ Π）不得超過 ±μ·N·dt（扣掉側向力的摩擦圓），
 * 所以 Π 夾在 [−spareBack, spareFwd]；超過時輪胎打滑、v ≠ ω·r（例如高扭力馬達起步：F_q > μN，車體以 μN 加速、傳動系空轉加速，
 * 打滑方向反過來時摩擦力也反向）。
 * 這是兩物體的完全非彈性碰撞（夾限後仍是同號、較小的衝量），動能變化 ≤ 0。沒有輪子接地時（容量 0）不耦合
 * @type {(car: any, spareFwd: number, spareBack: number) => void}
 */
function rollingConstraintImpulse(car, spareFwd, spareBack) {
  const spin = car.spin;
  if (!(spin.J > 0) || (spareFwd <= 0 && spareBack <= 0)) {
    return;
  }
  const body = car.chassis;
  const r = car.P.wheelRadius;
  const fwd = forwardAxis(car);
  const v = forwardSpeed(car);
  // 單向輪：離合咬合時輪子＋傳動系一起（J），脫開時只有輪子（J_w）。
  // 咬合但約束衝量 < 0（車比輪面快：下坡、著地，地面要把輪子轉快）→ 輪子超越傳動系、離合脫開 → 只帶動輪子
  let J = spin.J;
  let withDrivetrain = !spin.oneWay;
  if (spin.oneWay) {
    withDrivetrain = spin.engaged && spin.omega * r - v > 0;
    J = withDrivetrain ? spin.J : spin.Jw;
    if (!(J > 0)) {
      return;
    }
  }
  const k = body.invMass() + (r * r) / J;
  let impulse = (spin.omega * r - v) / k;
  impulse = Math.max(-spareBack, Math.min(spareFwd, impulse));
  if (impulse === 0) {
    return;
  }
  // 衝量作用在車體質心（只改前進速度，不另外產生俯仰；接地點力造成的俯仰已由每步的輪胎力處理）
  body.applyImpulse({ x: fwd.x * impulse, y: fwd.y * impulse, z: fwd.z * impulse }, true);
  spin.omega -= (impulse * r) / J;
  if (spin.oneWay && withDrivetrain) {
    spin.omegaD = spin.omega;
  }
}

/**
 * 單向輪（第七階段 iter-79，官方 15443 / 95628「左右のタイヤの回転差を吸収」）的傳動系一步：
 * 傳動系（馬達＋齒輪＋輪軸，J_d）承受馬達驅動力與傳動系阻力（輪軸軸承摩擦、斷電時的馬達拖曳）；
 * 輪子（J_w）只承受輪胎滾動阻力，回傳值 = 施加在接地點的縱向力（只有滾阻）。驅動力經離合（oneWayClutchEngage）
 * 合併後由純滾動約束衝量傳到車體。阻力不會讓角速度反向（夾到 0）
 * @type {(car: any, lf: { drive: number, resist: number }, dt: number) => number}
 */
function oneWayDrivetrainStep(car, lf, dt) {
  const P = car.P;
  const spin = car.spin;
  const r = P.wheelRadius;
  const rolling = lf.rolling;
  const drivetrainResist = lf.resist - rolling;
  if (spin.Jd > 0) {
    const drive = car.powered ? lf.drive : 0;
    const wD0 = spin.omegaD;
    spin.omegaD += ((drive - Math.sign(wD0) * drivetrainResist) * r * dt) / spin.Jd;
    if (!car.powered && wD0 !== 0 && Math.sign(spin.omegaD) !== Math.sign(wD0)) {
      spin.omegaD = 0;
    }
  }
  const wheelSpeed = spin.omega * r;
  if (Math.abs(wheelSpeed) < 0.002) {
    return 0;
  }
  return -Math.sign(wheelSpeed) * rolling;
}

/**
 * 單向離合：傳動系比輪子快（ω_d > ω_w）時咬合——兩者以角動量守恆合併成同一角速度（完全非彈性，動能只減不增）；
 * 輪子比傳動系快時脫開（輪子空轉超越，不傳力）。空轉阻力官方無資料 → 0（推估，PARTS_RESEARCH AT 節第 1 點）
 * @type {(spin: any) => void}
 */
function oneWayClutchEngage(spin) {
  if (spin.omegaD >= spin.omega) {
    const w = (spin.Jd * spin.omegaD + spin.Jw * spin.omega) / (spin.Jd + spin.Jw);
    spin.omega = w;
    spin.omegaD = w;
    spin.engaged = true;
  } else {
    spin.engaged = false;
  }
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
 * 擺動式制振器（第七階段 iter-75，球頭連桿）：配重＋擺臂一個剛體，以 revolute joint 繞支點的車體 z 軸轉動（其餘自由度鎖住）。
 * 往上擺的上限 = maxAngle（硬止點）；往下由座墊（單邊接觸）撐住，座墊最多壓縮約 1 mm 後是硬止點。
 * 初始姿態：座墊在自重下壓縮 δ 的平衡角 φ0 = −δ / 支點到配重中心的水平距離（繞支點旋轉整個剛體）
 * @type {(world: any, chassis: any, d: any, start: { x: number, z: number, theta: number }) => any}
 */
function createSwingDamper(world, chassis, d, start) {
  const m = d.mass_g / 1000;
  const g = spec.sim.gravity;
  const MMv = (/** @type {{ x: number, y: number, z: number }} */ v) => ({ x: v.x * MM, y: v.y * MM, z: v.z * MM });
  const pivot = MMv(d.pivot);
  const com = MMv(d.pos);
  const seat = MMv(d.seatPos);
  const lever = seat.x - pivot.x;
  // 座墊剛性：配重重力在座墊處的等效負載（力矩平衡：W·(com 到支點的水平距離) = F_seat·lever）
  const seatLoad = (m * g * (com.x - pivot.x)) / lever;
  const seatK = seatLoad / (d.seatDeflection_mm * MM);
  // 座墊阻尼比相對「座墊處的等效質量」 I_pivot / lever²
  const Ip = d.inertia_kgm2.z + m * ((com.x - pivot.x) ** 2 + (com.y - pivot.y) ** 2);
  const mEff = Ip / (lever * lever);
  const seatC = 2 * d.seatDampingRatio * Math.sqrt(seatK * mEff);
  const phi0 = -(d.seatDeflection_mm * MM) / lever;
  const rz = { x: 0, y: 0, z: Math.sin(phi0 / 2), w: Math.cos(phi0 / 2) };
  const rel = rotate(rz, { x: com.x - pivot.x, y: com.y - pivot.y, z: com.z - pivot.z });
  const local = { x: pivot.x + rel.x, y: pivot.y + rel.y, z: pivot.z + rel.z };
  const rq = yawQuat(-start.theta);
  const wp = rotate(rq, local);
  // 車體旋轉 rq 再乘上繞車體 z 軸的 φ0
  const q = {
    w: rq.w * rz.w - rq.x * rz.x - rq.y * rz.y - rq.z * rz.z,
    x: rq.w * rz.x + rq.x * rz.w + rq.y * rz.z - rq.z * rz.y,
    y: rq.w * rz.y - rq.x * rz.z + rq.y * rz.w + rq.z * rz.x,
    z: rq.w * rz.z + rq.x * rz.y - rq.y * rz.x + rq.z * rz.w,
  };
  const I = d.inertia_kgm2;
  const rb = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(start.x + wp.x, 0.0005 + wp.y, start.z + wp.z)
      .setRotation(q)
      .setAdditionalMassProperties(m, { x: 0, y: 0, z: 0 }, { x: I.x, y: I.y, z: I.z }, { x: 0, y: 0, z: 0, w: 1 })
      .setCcdEnabled(true)
      .setCanSleep(false),
  );
  // 支點在擺動剛體自身座標（φ = 0 時）的位置
  const pivotOnBody = { x: pivot.x - com.x, y: pivot.y - com.y, z: pivot.z - com.z };
  const jd = RAPIER.JointData.revolute(pivot, pivotOnBody, { x: 0, y: 0, z: 1 });
  const joint = world.createImpulseJoint(jd, chassis, rb, true);
  // 下限：座墊最多壓縮約 1 mm（之後是硬止點）；上限：maxAngle。
  // Rapier 0.21 的 JointData.revolute 不會帶入 limits 欄位（只有 prismatic 會），要在建立後用 setLimits 設定
  joint.setLimits(-(1 * MM) / lever, d.maxAngle_rad);
  return {
    body: rb,
    joint,
    swing: true,
    anchor: seat,
    seatOnBody: { x: seat.x - com.x, y: seat.y - com.y, z: seat.z - com.z },
    pivot,
    mass: m,
    seatK,
    seatC,
    pivotC: d.pivotFriction_Nmspr,
    label: d.label,
  };
}

/**
 * 擺動式制振器的座墊與支點摩擦（第七階段 iter-75）：
 * - 座墊：配重中心（擺動剛體上的點）相對它在車體上的靜止位置沿車體 up 的位移 rel < 0 時被壓縮，F = k·(−rel) − c·rel'（≥ 0，只能往上推）；
 *   作用力施加在擺動剛體的座墊點，反作用力施加在車體的**同一個世界座標點**（牛頓第三定律，力矩也相等相反 → 角動量守恆）。
 * - 支點黏滯摩擦：τ = −c_p·(ω_擺 − ω_車)·ẑ，相等相反地施加在兩個剛體（只消耗相對轉動的能量）
 * @type {(car: any, d: any, up: any) => void}
 */
function swingDamperForces(car, d, up) {
  const anchorW = localToWorld(car, d.anchor);
  const t = d.body.translation();
  const off = rotate(d.body.rotation(), d.seatOnBody);
  const pW = { x: t.x + off.x, y: t.y + off.y, z: t.z + off.z };
  const rel = (pW.x - anchorW.x) * up.x + (pW.y - anchorW.y) * up.y + (pW.z - anchorW.z) * up.z;
  const vd = d.body.velocityAtPoint(pW);
  const va = car.chassis.velocityAtPoint(pW);
  const relV = (vd.x - va.x) * up.x + (vd.y - va.y) * up.y + (vd.z - va.z) * up.z;
  if (rel < 0) {
    const f = Math.max(0, d.seatK * -rel - d.seatC * relV);
    d.body.addForceAtPoint({ x: up.x * f, y: up.y * f, z: up.z * f }, pW, true);
    car.chassis.addForceAtPoint({ x: -up.x * f, y: -up.y * f, z: -up.z * f }, pW, true);
  }
  const axis = rotate(car.chassis.rotation(), { x: 0, y: 0, z: 1 });
  const wb = d.body.angvel();
  const wc = car.chassis.angvel();
  const wrel = (wb.x - wc.x) * axis.x + (wb.y - wc.y) * axis.y + (wb.z - wc.z) * axis.z;
  const tau = -d.pivotC * wrel;
  d.body.addTorque({ x: axis.x * tau, y: axis.y * tau, z: axis.z * tau }, true);
  car.chassis.addTorque({ x: -axis.x * tau, y: -axis.y * tau, z: -axis.z * tau }, true);
}

/**
 * 擺動式制振器相對車體的擺角（rad，往上為正）：由座墊點相對靜止位置的高度差與力臂換算（小角度）
 * @type {(car: any, d: any) => number}
 */
export function swingAngle(car, d) {
  const anchorW = localToWorld(car, d.anchor);
  const t = d.body.translation();
  const off = rotate(d.body.rotation(), d.seatOnBody);
  const up = rotate(car.chassis.rotation(), { x: 0, y: 1, z: 0 });
  const rel = (t.x + off.x - anchorW.x) * up.x + (t.y + off.y - anchorW.y) * up.y + (t.z + off.z - anchorW.z) * up.z;
  return Math.asin(Math.max(-1, Math.min(1, rel / (d.anchor.x - d.pivot.x))));
}

/**
 * 整車動能（J）：車體剛體（平移＋轉動）＋制振器剛體＋滑動保桿的滑動剛體（iter-61）＋傳動系轉動動能 ½·J·ω²（第四階段：輪子、輪軸、齒輪、馬達電樞，換算到輪軸）
 * @type {(car: any) => number}
 */
function rigidBodyKineticEnergy(b) {
  const v = b.linvel();
  const w = b.angvel();
  const q = b.rotation();
  const bodyW = rotate({ x: -q.x, y: -q.y, z: -q.z, w: q.w }, w);
  const f = b.principalInertiaLocalFrame();
  const wl = rotate({ x: -f.x, y: -f.y, z: -f.z, w: f.w }, bodyW);
  const I = b.principalInertia();
  return 0.5 * b.mass() * (v.x * v.x + v.y * v.y + v.z * v.z) + 0.5 * (I.x * wl.x * wl.x + I.y * wl.y * wl.y + I.z * wl.z * wl.z);
}

export function carKineticEnergy(car) {
  let e = rigidBodyKineticEnergy(car.chassis);
  for (const d of car.dampers ?? []) {
    e += rigidBodyKineticEnergy(d.body);
  }
  // 滑動保桿的滑動剛體（iter-61）：平移＋轉動動能（轉動與車體同步，joint 鎖住相對轉動）；彈簧位能不在這裡（見 sliderState）
  // iter-64：前後滑動板各自計入
  for (const sl of car.sliders ?? []) {
    e += rigidBodyKineticEnergy(sl.body);
  }
  if (car.spin?.oneWay) {
    // 單向輪：輪子與傳動系分開算
    e += 0.5 * car.spin.Jw * car.spin.omega * car.spin.omega + 0.5 * car.spin.Jd * car.spin.omegaD * car.spin.omegaD;
  } else if (car.spin) {
    e += 0.5 * car.spin.J * car.spin.omega * car.spin.omega;
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
    const w = mountedToWorld(car, { x: r.x * MM, y: r.y * MM, z: r.z * MM }, r.slider);
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
 * 導輪與牆的接觸點（世界座標）：接觸法向 n（由牆指向車道）、接觸點 p、沿法向的穿透深度 pen
 * 第四階段起由導輪的「縱斷面輪廓」推導（導輪軸視為鉛直）：
 *   輪廓 = 上段圓柱（半徑 R、高 h_c）＋下段截錐（半徑 R → R_b、高 h_k）；一般導輪 h_k = 0（整顆圓柱）。
 *   牆是「鉛直牆面＋水平牆頂」，牆頂高 Y_w = 路面高 + 牆高。
 *   (1) 牆頂高於圓柱段底緣：圓柱段碰牆面，法向水平（與第三階段相同）
 *   (2) 牆頂落在錐形段高度內：碰到的是牆頂邊緣（一條水平線）對錐面，該高度的錐面半徑 r(Y_w) 與牆面重疊 δ；
 *       最小分離方向是錐面法向：與水平夾 β = atan((R − R_b)/h_k)，法向 = cosβ·(水平推回車道) + sinβ·(向上)，穿透 = δ·cosβ
 *       → 錐形導輪騎上牆頂時產生「推回車道＋上抬」分力（[T95436]「コース内へ復帰しやすい」）
 *   (3) 整顆導輪在牆頂之上：沒有接觸
 * @type {(env: ReturnType<typeof createWorld>, car: ReturnType<typeof createCar>) => { n: { x: number, y: number, z: number }, p: { x: number, y: number, z: number }, pen: number, roller: string }[]}
 */
export function rollerWallContacts(env, car) {
  const { track } = env;
  const t = car.chassis.translation();
  const center = track.path.project(t.x, t.z);
  const level = carLevel(env, car);
  const wallH = track.dims.wallH ?? spec.track.wallHeight_mm * MM;
  const out = [];
  for (const r of car.rollers) {
    const w = mountedToWorld(car, { x: r.x * MM, y: r.y * MM, z: r.z * MM }, r.slider);
    const pp = track.path.project(w.x, w.z);
    const ch = channelAt(track, pp.s, center.d, level);
    const pose = track.path.pose(pp.s);
    const T = { x: Math.cos(pose.theta), z: Math.sin(pose.theta) };
    const N = { x: -Math.sin(pose.theta), z: Math.cos(pose.theta) };
    const rr = r.r * MM;
    // 導輪輪廓（世界 y）：頂面、圓柱段底緣、錐形段底面半徑
    const top = w.y + (r.h / 2) * MM;
    const hc = (r.taper ? r.taper.cylinderHeight_mm : r.h) * MM;
    const hk = r.taper ? r.taper.coneHeight_mm * MM : 0;
    const rb = r.taper ? (r.taper.bottomDiameter_mm / 2) * MM : rr;
    const yCyl = top - hc;
    const yBot = yCyl - hk;
    const wallTop = (track.roadHeight ? track.roadHeight(pp.s, level) : 0) + wallH;
    if (wallTop <= yBot) {
      continue;
    }
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
      // 導輪軸到牆面的水平距離
      const gap = side * (face - pp.d) * cos;
      if (wallTop >= yCyl || hk <= 0) {
        const pen = rr - gap;
        if (pen <= 0) {
          continue;
        }
        out.push({ n: { x: nx, y: 0, z: nz }, p: { x: w.x - nx * rr, y: w.y, z: w.z - nz * rr }, pen, roller: r.id, onSlider: !!r.onSlider, slider: r.slider });
        continue;
      }
      // 牆頂邊緣碰錐面
      const re = rb + ((rr - rb) * (wallTop - yBot)) / hk;
      const overlap = re - gap;
      if (overlap <= 0) {
        continue;
      }
      const beta = Math.atan2(rr - rb, hk);
      const cb = Math.cos(beta);
      const sb = Math.sin(beta);
      out.push({
        n: { x: nx * cb, y: sb, z: nz * cb },
        p: { x: w.x - nx * re, y: wallTop, z: w.z - nz * re },
        pen: overlap * cb,
        roller: r.id,
        onSlider: !!r.onSlider,
        slider: r.slider,
      });
    }
  }
  return out;
}

/**
 * 穩定零件與牆的接觸（第四階段）：穩定零件是不轉動的 POM 圓柱（軸 = 車體上方向）。
 * 取圓柱軸的上下兩個端點（世界座標），各視為半徑 r 的水平圓盤：
 *   - 端點低於牆頂、圓盤越過牆面（r − 到牆面的水平距離 > 0）→ 牆面接觸，法向水平（由牆指向車道）
 *   - 端點高於牆頂、但下端點低於牆頂且水平位置已在牆頂上方 → 牆頂接觸，法向向上（穿透 = 牆頂 − 下端點，取水平 / 垂直中較小者）
 * 直立行駛時穩定零件外緣在導輪外緣內側，這裡不會產生任何接觸（P17_stabilizer 驗證）
 * @type {(env: ReturnType<typeof createWorld>, car: ReturnType<typeof createCar>) => { n: { x: number, y: number, z: number }, p: { x: number, y: number, z: number }, pen: number, mu: number, stab: any }[]}
 */
export function stabilizerWallContacts(env, car) {
  const { track } = env;
  const t = car.chassis.translation();
  const center = track.path.project(t.x, t.z);
  const level = carLevel(env, car);
  const wallH = track.dims.wallH ?? spec.track.wallHeight_mm * MM;
  const out = [];
  for (const st of car.stabilizers ?? []) {
    const [bot, top] = st.axisPts.map((q) => mountedToWorld(car, q, st.slider));
    for (const w of [bot, top]) {
      const pp = track.path.project(w.x, w.z);
      const ch = channelAt(track, pp.s, center.d, level);
      const pose = track.path.pose(pp.s);
      const T = { x: Math.cos(pose.theta), z: Math.sin(pose.theta) };
      const N = { x: -Math.sin(pose.theta), z: Math.cos(pose.theta) };
      const wallTop = (track.roadHeight ? track.roadHeight(pp.s, level) : 0) + wallH;
      for (const side of [1, -1]) {
        const k = side > 0 ? ch.slopeU : ch.slopeL;
        const face = side > 0 ? ch.faceU : ch.faceL;
        if (!Number.isFinite(face)) {
          continue;
        }
        const cos = 1 / Math.sqrt(1 + k * k);
        const nx = side * (k * T.x - N.x) * cos;
        const nz = side * (k * T.z - N.z) * cos;
        const penH = st.r - side * (face - pp.d) * cos;
        if (penH <= 0) {
          continue;
        }
        if (w.y < wallTop) {
          // 端點在牆頂以下：碰牆面；若同時在牆頂附近（下端點），取較小的分離方向（水平 or 往上離開牆頂）
          const penV = w === bot ? wallTop - bot.y : Infinity;
          if (penV < penH && top.y >= wallTop) {
            out.push({ n: { x: 0, y: 1, z: 0 }, p: { x: w.x - nx * st.r, y: w.y, z: w.z - nz * st.r }, pen: penV, mu: st.mu, stab: st });
          } else {
            out.push({ n: { x: nx, y: 0, z: nz }, p: { x: w.x - nx * st.r, y: w.y, z: w.z - nz * st.r }, pen: penH, mu: st.mu, stab: st });
          }
        }
      }
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
export function wallContactImpulses(env, car) {
  const slop = spec.sim.wallProjectionSlop_mm * MM;
  // 第四階段：穩定零件的牆面 / 牆頂接觸也在這裡處理（法向非彈性衝量＋滑動摩擦；導輪會轉動，切向不加摩擦，同第三階段）
  const stabContacts = car.stabilizers?.length ? stabilizerWallContacts(env, car) : [];
  for (const st of car.stabilizers ?? []) {
    st.contact = stabContacts.some((c) => c.stab === st);
    st.normalForce = 0;
    if (st.contact) {
      st.contactSteps++;
    }
  }
  const contacts = [...rollerWallContacts(env, car).filter((c) => c.pen > slop), ...stabContacts];
  const approachingStop = car.sliders.some((sl) => {
    const { u, uDot } = sliderRelative(car, sl);
    return Math.abs(u + spec.sim.dt_s * uDot) >= sl.stroke;
  });
  if (contacts.length === 0 && !approachingStop) {
    return;
  }
  // 滑動保桿（iter-61）：車體＋滑動板是 7 自由度系統，接觸衝量改在廣義座標求解（見 sliderContactImpulses）
  // iter-64：前後各一塊滑動板時為 6 + 2 = 8 自由度
  if (car.sliders.length > 0) {
    sliderContactImpulses(car, contacts);
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
  // 穩定零件的滑動摩擦（庫侖）：切向衝量 ≤ μ·J_n，且不超過讓接觸點切向速度歸零所需的量（不會反向加速，只消耗動能）
  const dt = spec.sim.dt_s;
  for (const c of contacts) {
    if (!c.stab) {
      continue;
    }
    c.stab.normalForce += c.acc / dt;
    if (!(c.acc > 0) || !(c.mu > 0)) {
      continue;
    }
    const v = body.velocityAtPoint(c.p);
    const vn = v.x * c.n.x + v.y * c.n.y + v.z * c.n.z;
    const vt = { x: v.x - vn * c.n.x, y: v.y - vn * c.n.y, z: v.z - vn * c.n.z };
    const vtLen = Math.hypot(vt.x, vt.y, vt.z);
    if (vtLen < 1e-9) {
      continue;
    }
    const td = { x: vt.x / vtLen, y: vt.y / vtLen, z: vt.z / vtLen };
    const rc = { x: c.p.x - com.x, y: c.p.y - com.y, z: c.p.z - com.z };
    const rt = cross(rc, td);
    const irt = mulI(rt);
    const Kt = invM + rt.x * irt.x + rt.y * irt.y + rt.z * irt.z;
    const jt = Math.min(c.mu * c.acc, vtLen / Kt);
    body.applyImpulseAtPoint({ x: -td.x * jt, y: -td.y * jt, z: -td.z * jt }, c.p, true);
  }
}

/** @type {(a: number[][]) => number[][]} 方陣反矩陣（Gauss–Jordan，部分樞軸） */
function invertMatrix(a) {
  const n = a.length;
  const m = a.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) {
      if (Math.abs(m[r][c]) > Math.abs(m[piv][c])) {
        piv = r;
      }
    }
    [m[c], m[piv]] = [m[piv], m[c]];
    const d = m[c][c];
    for (let k = 0; k < 2 * n; k++) {
      m[c][k] /= d;
    }
    for (let r = 0; r < n; r++) {
      if (r === c || m[r][c] === 0) {
        continue;
      }
      const f = m[r][c];
      for (let k = 0; k < 2 * n; k++) {
        m[r][k] -= f * m[c][k];
      }
    }
  }
  return m.map((row) => row.slice(n));
}

/** @type {(s: { m11: number, m12: number, m13: number, m22: number, m23: number, m33: number }) => number[][]} Rapier 對稱 3×3 矩陣 → 陣列 */
const sdp3 = (s) => [
  [s.m11, s.m12, s.m13],
  [s.m12, s.m22, s.m23],
  [s.m13, s.m23, s.m33],
];

/**
 * 車體＋滑動板的 (6 + n) 自由度質量矩陣反矩陣（見 sliderContactImpulses 說明；n = 滑動板數，iter-61 只有前方 n = 1，iter-64 前後都裝時 n = 2）：
 * side = 車體 z 軸（世界座標）、c_c = 車體質心、rs[k] = 第 k 塊滑動板質心 − 車體質心
 * @type {(car: any) => { s: { x: number, y: number, z: number }, cc: { x: number, y: number, z: number }, rs: { x: number, y: number, z: number }[], Minv: number[][] }}
 */
function sliderSystem(car) {
  const body = car.chassis;
  const n = car.sliders.length;
  const dof = 6 + n;
  const s = rotate(body.rotation(), { x: 0, y: 0, z: 1 });
  const cc = body.worldCom();
  const mc = body.mass();
  const Ic = invertMatrix(sdp3(body.effectiveWorldInvInertia()));
  /** @type {number[][]} */
  const M = Array.from({ length: dof }, () => new Array(dof).fill(0));
  for (let i = 0; i < 3; i++) {
    M[i][i] += mc;
    for (let j = 0; j < 3; j++) {
      M[3 + i][3 + j] += Ic[i][j];
    }
  }
  /** @type {{ x: number, y: number, z: number }[]} */
  const rs = [];
  car.sliders.forEach((sl, k) => {
    const sb = sl.body;
    const cs = sb.worldCom();
    const r = { x: cs.x - cc.x, y: cs.y - cc.y, z: cs.z - cc.z };
    rs.push(r);
    const ms = sb.mass();
    const Is = invertMatrix(sdp3(sb.effectiveWorldInvInertia()));
    // 滑動板和車體同角速度：轉動慣量直接加到車體的轉動自由度
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        M[3 + i][3 + j] += Is[i][j];
      }
    }
    // A：q' → 滑動板質心速度（3 × dof）= [I₃, −[r]×, 只有自己的滑動欄 = side]
    /** @type {number[][]} */
    const A = [
      [1, 0, 0, 0, r.z, -r.y],
      [0, 1, 0, -r.z, 0, r.x],
      [0, 0, 1, r.y, -r.x, 0],
    ].map((row, i) => {
      const ext = [...row, ...new Array(n).fill(0)];
      ext[6 + k] = [s.x, s.y, s.z][i];
      return ext;
    });
    for (let i = 0; i < dof; i++) {
      for (let j = 0; j < dof; j++) {
        M[i][j] += ms * (A[0][i] * A[0][j] + A[1][i] * A[1][j] + A[2][i] * A[2][j]);
      }
    }
  });
  return { s, cc, rs, Minv: invertMatrix(M) };
}

/**
 * 滑動保桿的牆面接觸衝量（iter-61）：車體（6 自由度）＋滑動板相對車體沿車體 z（side）的滑動 u（1 自由度）＝ 7 自由度系統。
 * 廣義速度 q' = (V, Ω, u')：V、Ω = 車體質心速度與角速度，u' = 滑動速度；滑動板質心速度 = V + Ω×r + u'·side（r = 滑動板質心 − 車體質心），角速度 = Ω。
 * 動能 T = ½·m_c·V² + ½·Ωᵀ(I_c + I_s)Ω + ½·m_s·|V + Ω×r + u'·side|² = ½·q'ᵀ·M·q'（M 為 7×7 質量矩陣）。
 * 接觸點 p 沿方向 d 的速度 = j·q'，j = (d, (p − c_c)×d, 滑動板上的點才有 d·side)；單位衝量的廣義速度變化 = M⁻¹·jᵀ，有效反質量 K = j·M⁻¹·jᵀ。
 * 和 wallContactImpulses 相同的非彈性衝量（J = −v_n / K，累積 ≥ 0，Gauss–Seidel）與穩定零件的庫侖摩擦，只是改在 7 自由度上求解：
 * 牆對前導輪的衝量沿 side 的分量只改變滑動速度 u'（之後由彈簧 / 行程止擋傳到車體），垂直分量經 joint 直接作用在整體。
 * 滑動板靠在行程端點時，止擋也當成單邊約束一起解。恢復係數 0 → 系統動能不增加。最後把 q' 寫回兩個 Rapier 剛體（滑動板速度和車體一致，符合 joint 約束）
 * iter-64：推廣到 n 塊滑動板（前、後各一）：q' = (V, Ω, u'₀, …, u'ₙ₋₁)，每塊滑動板各一個滑動欄；接觸點只在自己那塊滑動板的欄有 d·side，
 * 後導輪碰牆的側向衝量因此只改變後滑動板的 u'，再經後彈簧 / 止擋傳到車體。n = 1 時與 iter-61 的 7 自由度完全相同
 * @type {(car: any, contacts: any[]) => void}
 */
function sliderContactImpulses(car, contacts) {
  const body = car.chassis;
  const n = car.sliders.length;
  const dof = 6 + n;
  const { s, cc, rs, Minv } = sliderSystem(car);
  // 目前的廣義速度
  const V = body.linvel();
  const W = body.angvel();
  const q = [V.x, V.y, V.z, W.x, W.y, W.z];
  car.sliders.forEach((sl, k) => {
    const r = rs[k];
    const vs = sl.body.linvel();
    const vsRigid = { x: V.x + W.y * r.z - W.z * r.y, y: V.y + W.z * r.x - W.x * r.z, z: V.z + W.x * r.y - W.y * r.x };
    q.push((vs.x - vsRigid.x) * s.x + (vs.y - vsRigid.y) * s.y + (vs.z - vsRigid.z) * s.z);
  });

  /** @type {(c: any) => number} 接觸點所在滑動板的索引（導輪、穩定零件；固定在車體 = −1） */
  const sliderIndex = (c) => {
    const sl = c.slider ?? c.stab?.slider ?? null;
    return sl ? car.sliders.indexOf(sl) : -1;
  };
  /** @type {(d: any, p: any, k: number) => number[]} 接觸點沿 d 的速度 Jacobian（1 × dof；k = 所在滑動板索引） */
  const jacobian = (d, p, k) => {
    const rho = { x: p.x - cc.x, y: p.y - cc.y, z: p.z - cc.z };
    const rx = { x: rho.y * d.z - rho.z * d.y, y: rho.z * d.x - rho.x * d.z, z: rho.x * d.y - rho.y * d.x };
    const j = [d.x, d.y, d.z, rx.x, rx.y, rx.z, ...new Array(n).fill(0)];
    if (k >= 0) {
      j[6 + k] = d.x * s.x + d.y * s.y + d.z * s.z;
    }
    return j;
  };
  /** @type {(j: number[]) => number[]} M⁻¹·jᵀ */
  const response = (j) => Minv.map((row) => row.reduce((acc, v, k) => acc + v * j[k], 0));
  /** @type {(a: number[], b: number[]) => number} */
  const dotQ = (a, b) => a.reduce((acc, v, k) => acc + v * b[k], 0);
  /** @type {(p: any, k: number) => { x: number, y: number, z: number }} 接觸點速度向量（k = 所在滑動板索引，−1 = 車體） */
  const pointVel = (p, k) => {
    const rho = { x: p.x - cc.x, y: p.y - cc.y, z: p.z - cc.z };
    const u = k >= 0 ? q[6 + k] : 0;
    return {
      x: q[0] + q[4] * rho.z - q[5] * rho.y + u * s.x,
      y: q[1] + q[5] * rho.x - q[3] * rho.z + u * s.y,
      z: q[2] + q[3] * rho.y - q[4] * rho.x + u * s.z,
    };
  };

  for (const c of contacts) {
    c.slid = sliderIndex(c);
    c.j = jacobian(c.n, c.p, c.slid);
    c.w = response(c.j);
    c.K = dotQ(c.j, c.w);
    c.acc = 0;
  }
  // 行程端點硬止擋（滑動板靠在止擋上時）：單邊約束「不再往止擋外滑」，與牆面接觸一起解，
  // 牆把導輪推向止擋的衝量才會在同一步經止擋傳到車體（否則要等下一步 Rapier 的 joint 限位）；每塊滑動板各自判斷
  /** @type {any[]} */
  const stops = [];
  car.sliders.forEach((sl, k) => {
    const { u } = sliderRelative(car, sl);
    // Speculative unilateral limits: keep the next integration inside the
    // travel, rather than waiting until a light board has crossed its stop.
    // target <= 0 only removes approaching velocity; no position projection
    // or penetration-recovery energy is added here.
    for (const sign of [-1, 1]) {
      const j = new Array(dof).fill(0);
      j[6 + k] = -sign;
      const w = response(j);
      const target = -Math.max(0, sl.stroke - sign * u) / spec.sim.dt_s;
      stops.push({ j, w, K: dotQ(j, w), acc: 0, target });
    }
  });
  const rows = [...contacts, ...stops];
  let changed = false;
  const iters = spec.sim.wallImpulseIterations ?? 4;
  for (let it = 0; it < iters; it++) {
    for (const c of rows) {
      const vn = dotQ(c.j, q);
      const next = Math.max(0, c.acc + ((c.target ?? 0) - vn) / c.K);
      const dj = next - c.acc;
      c.acc = next;
      if (dj !== 0) {
        changed = true;
        for (let k = 0; k < dof; k++) {
          q[k] += c.w[k] * dj;
        }
      }
    }
  }
  // 穩定零件的滑動摩擦（庫侖，同 wallContactImpulses）
  const dt = spec.sim.dt_s;
  for (const c of contacts) {
    if (!c.stab) {
      continue;
    }
    c.stab.normalForce += c.acc / dt;
    if (!(c.acc > 0) || !(c.mu > 0)) {
      continue;
    }
    const v = pointVel(c.p, c.slid);
    const vn = v.x * c.n.x + v.y * c.n.y + v.z * c.n.z;
    const vt = { x: v.x - vn * c.n.x, y: v.y - vn * c.n.y, z: v.z - vn * c.n.z };
    const vtLen = Math.hypot(vt.x, vt.y, vt.z);
    if (vtLen < 1e-9) {
      continue;
    }
    const td = { x: vt.x / vtLen, y: vt.y / vtLen, z: vt.z / vtLen };
    const jtRow = jacobian(td, c.p, c.slid);
    const wt = response(jtRow);
    const Kt = dotQ(jtRow, wt);
    const jt = Math.min(c.mu * c.acc, vtLen / Kt);
    changed = true;
    for (let k = 0; k < dof; k++) {
      q[k] -= wt[k] * jt;
    }
  }
  if (!changed) {
    return;
  }
  const Vn = { x: q[0], y: q[1], z: q[2] };
  const Wn = { x: q[3], y: q[4], z: q[5] };
  body.setLinvel(Vn, true);
  body.setAngvel(Wn, true);
  car.sliders.forEach((sl, k) => {
    const r = rs[k];
    sl.body.setLinvel(
      {
        x: Vn.x + Wn.y * r.z - Wn.z * r.y + q[6 + k] * s.x,
        y: Vn.y + Wn.z * r.x - Wn.x * r.z + q[6 + k] * s.y,
        z: Vn.z + Wn.x * r.y - Wn.y * r.x + q[6 + k] * s.z,
      },
      true,
    );
    sl.body.setAngvel(Wn, true);
  });
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
 * Collision proxy envelope vertices + mounted rollers' rims, in world space.
 * @param {ReturnType<typeof createCar>} car
 */
export function carExtremePoints(car) {
  const pts = car.extremePoints.map((p) => localToWorld(car, p));
  for (const r of car.rollers) {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      pts.push(mountedToWorld(car, { x: (r.x + Math.cos(a) * r.r) * MM, y: r.y * MM, z: (r.z + Math.sin(a) * r.r) * MM }, r.slider));
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
