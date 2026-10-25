import { beforeAll, expect, test } from 'vitest';
import * as THREE from 'three';
import { bodyMassProps } from '../src/bodies/index.js';
import { principalAxes } from '../src/massTensor.js';
import { assemble, loadConfig } from '../src/assembly.js';
import { buildStraight } from '../src/track.js';
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
