import { beforeAll, expect, test } from 'vitest';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { listBodies } from '../src/bodies/index.js';
import { bodyCollisionCells } from '../src/bodies/collision.js';
import { assemble, loadConfig } from '../src/assembly.js';
import { bodyColliderDesc, collisionExtremePoints, initRapier } from '../src/sim.js';
import { buildCircuit } from '../src/track.js';
import { sdf, solidGap, sweepZ } from '../src/parts/clearance.js';

beforeAll(initRapier);

test('P16_collision_patches 全車殼複合形狀可重複建立，碰撞質量不重複計入', () => {
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  try {
    for (const body of listBodies()) {
      const asm = assemble({ ...loadConfig('default'), body: body.id });
      const hulls = bodyCollisionCells(body);
      expect(hulls.length).toBeGreaterThan(1);
      for (let i = 0; i < 2; i++) {
        const collider = world.createCollider(bodyColliderDesc(asm));
        expect(collider.mass()).toBe(0);
        world.removeCollider(collider, false);
      }
      console.log(`[P16] ${body.id}: ${hulls.length} box patches`);
    }
  } finally { world.free(); }
});

test('P16_collision_empty_space 高尾翼不會把低鼻端到尾翼高度之間填成實心', () => {
  const body = {
    id: 'test-long-low-nose-high-tail', wallThickness_mm: 0.6,
    build() {
      const group = new THREE.Group();
      for (const [x, y, height] of [[-60, 25, 2], [60, 10, 2]]) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(10, height, 12));
        mesh.position.set(x, y, 0);
        mesh.userData.shell = true;
        group.add(mesh);
      }
      // Paint overlays must not turn into a structural obstruction.
      const decal = new THREE.Mesh(new THREE.BoxGeometry(140, 1, 20));
      decal.position.y = 23;
      group.add(decal);
      return group;
    },
  };
  const asm = {
    body: { def: body }, lift_mm: 0, structureClearance_mm: 2,
    chassisBox_mm: { min: { x: -5, y: 2, z: -5 }, max: { x: 5, y: 8, z: 5 } },
  };
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  try {
    const col = world.createCollider(bodyColliderDesc(asm));
    // Actual nose and tail material collide, but air over/under them doesn't.
    expect(col.containsPoint({ x: 0.06, y: 0.011, z: 0 })).toBe(true);
    expect(col.containsPoint({ x: -0.06, y: 0.026, z: 0 })).toBe(true);
    expect(col.containsPoint({ x: 0.06, y: 0.023, z: 0 })).toBe(false);
    expect(col.containsPoint({ x: -0.06, y: 0.005, z: 0 })).toBe(false);
    expect(col.containsPoint({ x: 0.03, y: 0.023, z: 0 })).toBe(false);
    const points = collisionExtremePoints(asm);
    // The penetration diagnostic must use collision material/proxy vertices,
    // not a nonexistent high nose corner from the previous single cuboid.
    expect(points.some((p) => p.x > 0.05 && p.y > 0.02)).toBe(false);
    for (const p of points) {
      const nearest = col.projectPoint(p, true).point;
      expect(Math.hypot(p.x - nearest.x, p.y - nearest.y, p.z - nearest.z)).toBeLessThan(1e-7);
    }
  } finally { world.free(); }
});

test('P18_slider_swept_volume 行程內部也會碰撞，凹板保留缺口，固定幾何不被修改', () => {
  const cylinder = { kind: 'cyl', axis: 'y', c: { x: 0, y: 0, z: 0 }, r: 1, halfLen: 1 };
  const swept = sweepZ(cylinder, 4);
  expect(sdf(swept, 0, 0, 0)).toBeLessThan(0); // Both endpoints alone miss here.
  expect(sdf(swept, 0, 0, 5)).toBeCloseTo(0, 10);
  expect(sdf(swept, 0, 0, 6)).toBeCloseTo(1, 10);
  expect(sdf(swept, 2, 0, 0)).toBeCloseTo(1, 10);
  const blocker = { kind: 'box', min: { x: -0.1, y: -0.1, z: 3.9 }, max: { x: 0.1, y: 0.1, z: 4.1 } };
  expect(solidGap(cylinder, blocker)).toBeGreaterThan(2);
  expect(solidGap(swept, blocker)).toBeLessThan(0);
  const plate = { kind: 'plate', y0: 0, y1: 1, outline: [[-4, -4], [4, -4], [4, 4], [2, 4], [2, -2], [-2, -2], [-2, 4], [-4, 4]] };
  const moved = sweepZ(plate, 1);
  expect(sdf(moved, 0, 0.5, 2)).toBeGreaterThan(0); // U-shaped opening survives.
  expect(sdf(moved, 3, 0.5, 4.5)).toBeLessThan(0);
  expect(plate.outline[0]).toEqual([-4, -4]);
});

test('P17_sponge_hard_stop 海綿保留可壓縮空間，壓到底後由真實煞車板承受下壓', () => {
  const asm = assemble({ ...loadConfig('default'), body: null, rearStay: 'stay-rear-frp', brakeSponge: 'sponge-1mm-strong' });
  const sp = asm.optional.sponge;
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.2);
  const minY = (body) => {
    const p = sp.plate.box;
    let result = Infinity;
    for (const x of [p.min.x, p.max.x]) for (const z of [p.min.z, p.max.z]) {
      const v = new THREE.Vector3(x / 1000, (p.min.y + asm.lift_mm) / 1000, z / 1000).applyQuaternion(q).add(new THREE.Vector3().copy(body.translation()));
      result = Math.min(result, v.y);
    }
    return result;
  };
  const landing = (backing) => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.timestep = 0.00025;
    world.lengthUnit = 0.1;
    world.integrationParameters.normalizedAllowedLinearError = 0.0002;
    try {
      world.createCollider(RAPIER.ColliderDesc.cuboid(1, 0.01, 1).setTranslation(0, -0.01, 0));
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 0.03, 0).setRotation(q).setAdditionalMass(0.15).lockRotations().setCcdEnabled(true));
      const col = world.createCollider(bodyColliderDesc(backing ? asm : { ...asm, optional: null }), body);
      const foamCenter = sp.spongeBox;
      // Test unrotated local geometry through the descriptor's own shape.
      expect(col.shape.containsPoint({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0, w: 1 }, { x: sp.pos.x / 1000, y: (foamCenter.min.y + foamCenter.max.y) / 2000, z: 0 })).toBe(false);
      body.addForce({ x: 0, y: -10, z: 0 }, true);
      let lowest = Infinity;
      for (let i = 0; i < 1600; i++) { world.step(); lowest = Math.min(lowest, minY(body)); }
      return lowest;
    } finally { world.free(); }
  };
  const hard = landing(true), missing = landing(false);
  console.log(`[P17] backing penetration: ${(-hard * 1000).toFixed(4)} mm; without backing: ${(-missing * 1000).toFixed(4)} mm`);
  // Rapier's rigid contacts are compliant. Under this sustained 10 N load,
  // require < half the thinnest foam thickness and >10x less penetration
  // than omitting the backing, rather than assuming mathematically rigid contact.
  expect(hard).toBeGreaterThan(-0.0005);
  expect(Math.abs(hard)).toBeLessThan(Math.abs(missing) / 10);
  expect(missing).toBeLessThan(-0.001);
});

test('P16_track_mesh_oriented 牆與路面網格封閉、繞向一致、法向朝外（三角網格 ORIENTED 旗標的前提）', () => {
  const track = buildCircuit();
  for (const m of [...track.wallMeshes, ...(track.roadMeshes ?? [])]) {
    const v = m.vertices, idx = m.indices;
    const key = (i) => `${v[3 * i].toFixed(6)},${v[3 * i + 1].toFixed(6)},${v[3 * i + 2].toFixed(6)}`;
    const directed = new Set();
    let volume = 0;
    for (let t = 0; t < idx.length; t += 3) {
      const [a, b, c] = [0, 1, 2].map((q) => new THREE.Vector3(v[3 * idx[t + q]], v[3 * idx[t + q] + 1], v[3 * idx[t + q] + 2]));
      volume += a.dot(b.clone().cross(c)) / 6;
      for (const [p, q] of [[0, 1], [1, 2], [2, 0]]) {
        const e = `${key(idx[t + p])}>${key(idx[t + q])}`;
        // 同方向的邊出現兩次 = 相鄰三角形繞向相反
        expect(directed.has(e)).toBe(false);
        directed.add(e);
      }
    }
    // 每條有向邊都有反向邊 = 封閉；有號體積 > 0 = 法向朝外
    for (const e of directed) {
      const [p, q] = e.split('>');
      expect(directed.has(`${q}>${p}`)).toBe(true);
    }
    expect(volume).toBeGreaterThan(0);
  }
});

