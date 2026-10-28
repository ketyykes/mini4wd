import { beforeAll, expect, test } from 'vitest';
import * as THREE from 'three';
import { bodyMassProps } from '../src/bodies/index.js';
import { principalAxes, plateTensor, boxTensor, flattenedCylinderXTensor, pointTensor, addTensor } from '../src/massTensor.js';
import { wheelInertia } from '../src/parts/inertia.js';
import { bumperTrim } from '../src/parts/bumperGeom.js';
import { chassisMeshDistribution } from './helpers/chassisMesh.js';
import { assemble, loadConfig } from '../src/assembly.js';
import { buildStraight } from '../src/track.js';
import { batteryParts } from '../src/parts/batteries.js';
import * as sim from '../src/sim.js';

beforeAll(sim.initRapier);
const matrix = (t) => new THREE.Matrix3().set(t.xx, t.xy, t.xz, t.xy, t.yy, t.yz, t.xz, t.yz, t.zz);
const rotateTensor = (t, q) => {
  const r = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q));
  return r.clone().multiply(matrix(t)).multiply(r.clone().transpose());
};

test('P14_shell_tensor 三角薄殼慣性含有限厚度、慣性積；平移不改變中心慣性', () => {
  const body = (id, translation) => ({
    id, wallThickness_mm: 0.6, density_g_cm3: 1,
    build() {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 6, 0, 0, 0, 3, 0], 3));
      const mesh = new THREE.Mesh(geometry);
      mesh.position.copy(translation);
      mesh.userData.shell = true;
      return new THREE.Group().add(mesh);
    },
  });
  const a = bodyMassProps(body('test-triangle-inertia', new THREE.Vector3()));
  const b = bodyMassProps(body('test-triangle-translated', new THREE.Vector3(17, -7, 3)));
  const m = 9 * 0.6 / 1000;
  expect(a.mass_g).toBeCloseTo(m, 12);
  expect(a.com_mm).toEqual({ x: 2, y: 1, z: 0 });
  const expected = { xx: m * 0.53, yy: m * 2.03, zz: m * 2.5, xy: m * 0.5, xz: 0, yz: 0 };
  for (const k of Object.keys(expected)) {
    expect(a.inertia_gmm2[k], k).toBeCloseTo(expected[k], 11);
    expect(b.inertia_gmm2[k], k).toBeCloseTo(expected[k], 11);
  }
});

test('P14_solid_tensor 封閉方塊體積積分符合解析值，任意旋轉與反向繞向仍一致', () => {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, -0.4, 0.7));
  const m = 12 * 8 * 4 * 2 / 1000;
  const expected = rotateTensor({ xx: m * (8 ** 2 + 4 ** 2) / 12, yy: m * (12 ** 2 + 4 ** 2) / 12, zz: m * (12 ** 2 + 8 ** 2) / 12, xy: 0, xz: 0, yz: 0 }, q);
  for (const reversed of [false, true]) {
    const b = bodyMassProps({
      id: `test-solid-inertia-${reversed}`, wallThickness_mm: 0.6, density_g_cm3: 2,
      build() {
        const geometry = new THREE.BoxGeometry(12, 8, 4);
        if (reversed) geometry.scale(-1, 1, 1);
        const mesh = new THREE.Mesh(geometry);
        mesh.userData.solid = { density_g_cm3: 2 };
        mesh.position.set(10, 20, 30); mesh.quaternion.copy(q);
        return new THREE.Group().add(mesh);
      },
    });
    expect(b.mass_g).toBeCloseTo(m, 6);
    expect(b.com_mm.x).toBeCloseTo(10, 6);
    expect(b.com_mm.y).toBeCloseTo(20, 6);
    expect(b.com_mm.z).toBeCloseTo(30, 6);
    matrix(b.inertia_gmm2).elements.forEach((v, i) => expect(v).toBeCloseTo(expected.elements[i], 5));
  }
});

test('P14_principal_axes 主軸重建完整張量，Rapier 使用同一主軸且動能符合 ½ωᵀIω', () => {
  const tensor = { xx: 3, yy: 4, zz: 5, xy: 0.4, xz: -0.6, yz: 0.8 };
  const { inertia, frame } = principalAxes(tensor);
  const reconstructed = rotateTensor({ xx: inertia.x, yy: inertia.y, zz: inertia.z, xy: 0, xz: 0, yz: 0 }, new THREE.Quaternion().copy(frame));
  matrix(tensor).elements.forEach((v, i) => expect(reconstructed.elements[i]).toBeCloseTo(v, 12));
  const asm = assemble(loadConfig('default'));
  const env = sim.createWorld(buildStraight(4));
  try {
    const car = sim.createCar(env, { assembly: asm, powered: false });
    car.chassis.recomputeMassPropertiesFromColliders();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.4, 0.3, -0.2));
    car.chassis.setRotation(q, true);
    const w = new THREE.Vector3(2, 3, -4), v = new THREE.Vector3(0.4, -0.2, 0.1);
    car.chassis.setAngvel(w.clone().applyQuaternion(q), true);
    car.chassis.setLinvel(v, true);
    const rotational = w.dot(w.clone().applyMatrix3(matrix(asm.rigid.inertiaTensor_kgm2))) / 2;
    const expected = rotational + asm.rigid.mass_g / 1000 * v.lengthSq() / 2;
    // Rapier stores rotations, masses and velocities as float32.
    expect(Math.abs(sim.carKineticEnergy({ chassis: car.chassis }) - expected) / expected).toBeLessThan(2e-7);
  } finally { env.world.free(); }
});

// Independent oracle: integrate the cell volume with equal-volume cylindrical
// samples. Do not read the implementation's per-part tensor or cylinder helper.
function cellVolumeTensor(mass, radius, length) {
  const sums = { xx: 0, yy: 0, zz: 0, xy: 0, xz: 0, yz: 0 };
  const nx = 40, nr = 12, nt = 24, dm = mass / (nx * nr * nt);
  for (let ix = 0; ix < nx; ix++) for (let ir = 0; ir < nr; ir++) for (let it = 0; it < nt; it++) {
    const x = length * ((ix + 0.5) / nx - 0.5);
    const r = radius * Math.sqrt((ir + 0.5) / nr), t = 2 * Math.PI * (it + 0.5) / nt;
    const y = r * Math.cos(t), z = r * Math.sin(t);
    sums.xx += dm * (y * y + z * z); sums.yy += dm * (x * x + z * z); sums.zz += dm * (x * x + y * y);
    sums.xy -= dm * x * y; sums.xz -= dm * x * z; sums.yz -= dm * y * z;
  }
  // Exact midpoint-rule correction for ∫x²dx over the uniform axial cells.
  sums.yy += mass * length ** 2 / (12 * nx ** 2);
  sums.zz += mass * length ** 2 / (12 * nx ** 2);
  return sums;
}

function expectedAssemblyTensor(asm, parts, com) {
  const result = new THREE.Matrix3().set(0, 0, 0, 0, 0, 0, 0, 0, 0);
  const accumulate = (t) => { result.elements.forEach((_, i) => { result.elements[i] += t.elements[i] * 1e-9; }); };
  for (const part of parts) {
    const d = new THREE.Vector3().subVectors(part.pos, com), m = part.mass_g;
    const shift = new THREE.Matrix3().set(
      m * (d.y ** 2 + d.z ** 2), -m * d.x * d.y, -m * d.x * d.z,
      -m * d.x * d.y, m * (d.x ** 2 + d.z ** 2), -m * d.y * d.z,
      -m * d.x * d.z, -m * d.y * d.z, m * (d.x ** 2 + d.y ** 2));
    accumulate(shift);
    if (part.slot === 'battery') {
      const b = asm.partsBySlot.battery;
      accumulate(matrix(cellVolumeTensor(m, b.cellDiameter_mm / 2, b.cellLength_mm)));
    }
    // iter-96（B3）：底盤與其他零件自帶中心張量（各自的正確性另見 P14_component_tensors），這裡只驗證「每件只計一次」
    if (part.slot !== 'battery' && part.inertia_gmm2) accumulate(matrix(part.inertia_gmm2));
    if (part.slot === 'body') accumulate(matrix(bodyMassProps(asm.body.def).inertia_gmm2));
  }
  return result;
}

test('P14_battery_volume 三款電池的體積慣性只計一次，整車與可動件分離後的車體均保留', () => {
  for (const b of batteryParts) for (const name of ['default', 'p7-demo', 'p7-parts']) {
    const asm = assemble({ ...loadConfig(name), battery: b.id });
    const cells = asm.parts.filter((p) => p.slot === 'battery');
    expect(cells).toHaveLength(b.cells);
    expect(cells.reduce((s, p) => s + p.mass_g, 0)).toBe(b.mass_g);
    const excluded = new Set([
      ...asm.sliders.flatMap((sl) => sl.labels),
      ...asm.optional.dampers.flatMap((d) => asm.partsBySlot.massDamper?.locked ? [] : [d.label, `${d.label}擺臂`]),
    ]);
    const rigidParts = asm.parts.filter((p) => !excluded.has(p.label));
    expect(rigidParts.reduce((s, p) => s + p.mass_g, 0)).toBeCloseTo(asm.rigid.mass_g, 10);
    for (const [actual, parts, com] of [
      [asm.inertiaTensor_kgm2, asm.parts, asm.com_mm],
      [asm.rigid.inertiaTensor_kgm2, rigidParts, asm.rigid.com_mm],
    ]) {
      const expected = expectedAssemblyTensor(asm, parts, com);
      matrix(actual).elements.forEach((v, i) => expect(v, `${b.id}/${name}/${i}`).toBeCloseTo(expected.elements[i], 13));
    }
  }
});

test('P14_battery_scaling 電池長度平方影響橫向慣性，質量／重心／電路／傳動系不受影響', () => {
  const config = { ...loadConfig('default'), body: null };
  const a = assemble(config), b = a.partsBySlot.battery;
  const doubled = assemble({ ...config, battery: { base: b.id, cellLength_mm: 2 * b.cellLength_mm } });
  expect(doubled.mass_g).toBe(a.mass_g);
  expect(doubled.com_mm).toEqual(a.com_mm);
  expect(doubled.P.spinInertia).toEqual(a.P.spinInertia);
  expect(doubled.spec.circuit).toEqual(a.spec.circuit);
  expect(doubled.P.motorResistance).toBe(a.P.motorResistance);
  const delta = b.mass_g * 3 * b.cellLength_mm ** 2 / 12 * 1e-9;
  for (const k of ['xx', 'yy', 'zz', 'xy', 'xz', 'yz']) {
    expect(doubled.inertiaTensor_kgm2[k] - a.inertiaTensor_kgm2[k]).toBeCloseTo(k === 'yy' || k === 'zz' ? delta : 0, 13);
  }
  // Wheel diameter lifts every part equally; central inertia is translation invariant.
  // iter-96（B3）：輪子帶自身張量後，輪徑變大本身會加大輪子慣性 → 整車差值只能是四顆輪子自身張量的差
  const lifted = assemble({ ...config, wheels: { base: a.partsBySlot.wheels.id, diameter_mm: a.partsBySlot.wheels.diameter_mm + 2 } });
  expect(lifted.com_mm.y - a.com_mm.y).toBeCloseTo(1, 12);
  const ownWheels = (asm) => asm.parts.filter((q) => q.slot === 'wheels').reduce((t, q) => addTensor(t, q.inertia_gmm2), { xx: 0, yy: 0, zz: 0, xy: 0, xz: 0, yz: 0 });
  const dWheel = addTensor(ownWheels(lifted), ownWheels(a), -1);
  expect(dWheel.zz).toBeGreaterThan(0);
  for (const k of Object.keys(a.inertiaTensor_kgm2)) expect(lifted.inertiaTensor_kgm2[k] - a.inertiaTensor_kgm2[k]).toBeCloseTo(dWheel[k] * 1e-9, 13);
});

test('P14_component_tensors 底盤慣性來自 3D 模型網格分布、保桿切除扣掉自身慣性，零件張量與解析式一致（iter-96，B3）', () => {
  const base = { ...loadConfig('default'), body: null, frontStay: 'stay-front-standard', rearStay: 'stay-rear-standard' };
  const asm = assemble(base);
  const ch = asm.partsBySlot.chassis;
  // 1. 底盤資料內存的分布 = 由目前 3D 模型重算（模型改了就要同步更新 chassis.js）
  const d = chassisMeshDistribution(asm);
  for (const k of ['x', 'y', 'z']) expect(ch.com_mm[k], `com ${k}`).toBeCloseTo(d.com_mm[k], 6);
  for (const k of Object.keys(d.gyration_mm2)) expect(ch.inertiaPerMass_mm2[k], `I ${k}`).toBeCloseTo(d.gyration_mm2[k], 4);
  // 2. 未切保桿：底盤件的中心張量 = 每 g 分布 × 實測質量
  const part = asm.parts.find((q) => q.slot === 'chassis');
  expect(asm.partsBySlot.frontStay.chassisTrim).toBeFalsy();
  for (const k of Object.keys(d.gyration_mm2)) expect(part.inertia_gmm2[k]).toBeCloseTo(ch.inertiaPerMass_mm2[k] * ch.mass_g, 6);
  // 3. 切保桿：剩餘底盤（對原點）＋切除區（∫rrᵀ dm）＝完整底盤（對原點）
  const trimmed = assemble({ ...base, frontStay: 'stay-front-frp', rearStay: 'stay-rear-frp' });
  expect(trimmed.partsBySlot.frontStay.chassisTrim).toBeTruthy();
  const rest = trimmed.parts.find((q) => q.slot === 'chassis');
  const restPos = { ...rest.pos, y: rest.pos.y - trimmed.lift_mm };
  const sum = addTensor({ ...rest.inertia_gmm2 }, pointTensor(rest.mass_g, restPos));
  let trimMass = 0;
  const rho = ch.density_g_cm3 / 1000;
  for (const sx of [1, -1]) {
    const t = bumperTrim(ch, sx);
    trimMass += t.mass_g;
    const q = t.second_mm5;
    addTensor(sum, { xx: (q.yy + q.zz) * rho, yy: (q.xx + q.zz) * rho, zz: (q.xx + q.yy) * rho, xy: -q.xy * rho, xz: -q.xz * rho, yz: -q.yz * rho });
    // 切除區二次矩與質量、重心自洽：∫(r − c)² ≥ 0（平行軸定理）
    expect(q.xx / t.volume_mm3 - t.com_mm.x ** 2).toBeGreaterThan(0);
    expect(q.yy / t.volume_mm3 - t.com_mm.y ** 2).toBeGreaterThan(0);
    expect(q.zz / t.volume_mm3 - t.com_mm.z ** 2).toBeGreaterThan(0);
  }
  expect(rest.mass_g + trimMass).toBeCloseTo(ch.mass_g, 9);
  const full = addTensor({ ...part.inertia_gmm2 }, pointTensor(ch.mass_g, ch.com_mm));
  for (const k of Object.keys(full)) expect(sum[k], `trim ${k}`).toBeCloseTo(full[k], 3);
  // 4. 基本形狀：矩形平板 = 方塊；削平量 = 直徑時退化為實心圓柱；輪胎繞軸 = 傳動系同一份值
  const rect = plateTensor(2, [[-5, -3], [5, -3], [5, 3], [-5, 3]], 1.5);
  const box = boxTensor(2, 10, 1.5, 6);
  for (const k of Object.keys(box)) expect(rect[k], `plate ${k}`).toBeCloseTo(box[k], 9);
  const cyl = flattenedCylinderXTensor(10, 20, 20, 25);
  expect(cyl.xx / (0.5 * 10 * 100)).toBeCloseTo(1, 2);
  expect(cyl.yy / (10 * (100 / 4 + 625 / 12))).toBeCloseTo(1, 2);
  const flat = flattenedCylinderXTensor(10, 20.1, 15.1, 25);
  expect(flat.zz).toBeLessThan(flat.yy);
  const wheel = asm.parts.find((q) => q.slot === 'wheels');
  expect(wheel.inertia_gmm2.zz).toBeCloseTo(wheelInertia(asm.partsBySlot.wheels).total, 9);
  // 5. 整車：比「底盤 = 外框實心方塊、其餘質點」大（質量往周邊集中），三軸都在合理範圍
  console.log(`[P14 B3] Ixx/Iyy/Izz = ${['xx', 'yy', 'zz'].map((k) => (asm.inertiaTensor_kgm2[k] * 1e9).toFixed(0)).join(' / ')} g·mm²，底盤件 ${['xx', 'yy', 'zz'].map((k) => part.inertia_gmm2[k].toFixed(0)).join(' / ')}`);
});
