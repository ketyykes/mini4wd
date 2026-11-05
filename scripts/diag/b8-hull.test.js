// B8 診斷：Rapier 0.21 凸多面體對刀口 / 球的接觸法向偏離斜面，旋轉方塊與解析值一致（AR 斜面架碰撞體因此用旋轉方塊）。
// npx vitest run --config scripts/diag/vitest.diag.config.js scripts/diag/b8-hull.test.js --silent=false
import { test } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
test('hull', async () => {
  await RAPIER.init();
  for (const [mode, knife] of [['rotbox', 'edge'], ['rotbox', 'ball'], ['hull', 'ray']]) {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.timestep = 0.00025;
    const t = Math.tan(20 * Math.PI / 180);
    // 斜面：x 從 -3 到 0，底面 y = 0 → 3t，頂面 y = 1.5（mm）
    const pts = [];
    for (const z of [-5, 5]) pts.push(-3, 0, z, -3, 1.5, z, 0, 3 * t, z, 0, 1.5, z);
    const mm = pts.map((v) => v / 1000);
    const rb = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 0.01, 0).setAdditionalMassProperties(0.1, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }, { x: 0, y: 0, z: 0, w: 1 }));
    const shape = mode === 'hull' ? RAPIER.ColliderDesc.convexHull(Float32Array.from(mm)).shape : new RAPIER.Cuboid(0.0015, 0.00075, 0.005);
    if (mode === 'rotbox') {
      // 底面中心 (-1.5, 1.5t)，沿 20° 斜面；厚 0.4 mm
      const h = 0.0002, L = 0.0015 / Math.cos(20 * Math.PI / 180);
      const ang = 20 * Math.PI / 180;
      const c = { x: -0.0015 - Math.sin(ang) * h, y: 1.5 * t / 1000 + Math.cos(ang) * h, z: 0 };
      world.createCollider(RAPIER.ColliderDesc.compound([new RAPIER.Cuboid(L, h, 0.005)], [c], [{ x: 0, y: 0, z: Math.sin(ang / 2), w: Math.cos(ang / 2) }]).setDensity(0).setFriction(0), rb);
    }
    else if (mode === 'hull') world.createCollider(RAPIER.ColliderDesc.compound([shape], [{ x: 0, y: 0, z: 0 }], [{ x: 0, y: 0, z: 0, w: 1 }]).setDensity(0).setFriction(0), rb);
    const a = 0.00025;
    // 刀口在 x = -1.5 mm，該處斜面底 y = 1.5t mm
    const top = 0.01 + 1.5 * t / 1000 - 0.002;
    const kd = knife === 'edge' ? RAPIER.ColliderDesc.cuboid(a, a, 0.003).setRotation({ x: 0, y: 0, z: Math.sin(Math.PI / 8), w: Math.cos(Math.PI / 8) }).setTranslation(-0.0015, top - a * Math.SQRT2, 0)
      : knife === 'ball' ? RAPIER.ColliderDesc.ball(a).setTranslation(-0.0015, top - a, 0)
      : RAPIER.ColliderDesc.capsule(0.003, a).setRotation({ x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 }).setTranslation(-0.0015, top - a, 0);
    if (knife === 'ray') {
      world.step();
      const hit = world.castRayAndGetNormal(new RAPIER.Ray({ x: -0.0015, y: 0.005, z: 0 }, { x: 0, y: 1, z: 0 }), 0.01, true);
      console.log('ray hit', hit && JSON.stringify({ toi: hit.timeOfImpact, n: hit.normal }), 'verts', JSON.stringify(Array.from(shape.vertices ?? [])));
      continue;
    }
    const kc = world.createCollider(kd.setFriction(0));
    let v0 = null;
    for (let i = 0; i < 400; i++) {
      const vb = rb.linvel();
      world.step();
      const v = rb.linvel();
      if (!v0 && v.y - vb.y + 9.81 * 0.00025 > 1e-5) v0 = { ...vb, i };
      if (v0 && i <= v0.i + 3) world.contactPairsWith(kc, (other) => world.contactPair(kc, other, (m, f) => { if (m.numContacts()) console.log('  step', i, 'flipped', f, 'n', JSON.stringify(m.normal()), 'ln1', JSON.stringify(m.localNormal1()), 'ln2', JSON.stringify(m.localNormal2()), 'dist', m.contactDist(0), 'imp', m.contactImpulse(0)); }));
      if (v0 && i === v0.i + 3) { console.log(mode, knife, 'Jx/Jy', ((v.x - v0.x) / (v.y - v0.y + 9.81 * 0.00025 * 4)).toFixed(4), '-tan20', (-t).toFixed(4)); break; }
    }
  }
});
