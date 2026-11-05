// 診斷：9-8 二段導輪前後組裝在換道橋下坡被牆面四邊形對角線內部邊的錯誤法向（落在牆面平面內）踢翻；印出速度突變步的接觸法向
// npx vitest run --config scripts/diag/vitest.diag.config.js scripts/diag/wall-ghost-98.test.js --silent=false
import { beforeAll, test } from 'vitest';
import { assemble, loadConfig } from '../../src/assembly.js';
import { buildCircuit } from '../../src/track.js';
import * as THREE from 'three';
import * as sim from '../../src/sim.js';
import { spec } from '../../src/spec.js';
beforeAll(sim.initRapier);
test('98', () => {
  const asm = assemble({ ...loadConfig('default'), frontRollers: 'roller-9-8-alu-double', rearRollers: 'roller-9-8-alu-double' });
  console.log('I', JSON.stringify(asm.inertia_kgm2), 'com', JSON.stringify(asm.com_mm));
  const track = buildCircuit();
  const env = sim.createWorld(track);
  const car = sim.createCar(env, { assembly: asm, s: 0.15, lane: 0 });
  let worst = { pen: 0 }, minUp = { up: 1 };
  for (let i = 0; i < Math.round(12 / env.world.timestep); i++) {
    sim.stepCar(env, car);
    const pen = sim.wallPenetration(env, car);
    const t = car.chassis.translation();
    const p = track.path.project(t.x, t.z);
    const up = sim.upAxis(car).y;
    if (pen * 1000 > worst.pen) worst = { pen: pen * 1000, i, t: i * env.world.timestep, s: p.s, d: p.d, y: t.y, up };
    if (up < minUp.up) minUp = { up, i, s: p.s, y: t.y };
    if (i === 25302 || i === 25303) {
      const sh = car.chassis.collider(0).shape;
      const t = car.chassis.translation(), r = car.chassis.rotation();
      // 本步結束後的狀態（下一步就是事件）
      console.log('DUMP', i, JSON.stringify({ t, r, lv: car.chassis.linvel(), av: car.chassis.angvel(), shapeType: sh.type, n: sh.shapes?.length }));
      if (sh.shapes) {
        const ct = car.chassis.collider(0).translation(), cr = car.chassis.collider(0).rotation();
        const q = new THREE.Quaternion(cr.x, cr.y, cr.z, cr.w);
        sh.shapes.forEach((ss, k) => {
          const p = new THREE.Vector3(sh.positions[k].x, sh.positions[k].y, sh.positions[k].z).applyQuaternion(q).add(new THREE.Vector3(ct.x, ct.y, ct.z));
          const near = Math.abs(p.z - 0.8375) < 0.02 && Math.abs(p.x - 0.553) < 0.03 && Math.abs(p.y - 0.11) < 0.03;
          if (near) console.log('SUB', k, JSON.stringify({ he: ss.halfExtents, p: { x: p.x, y: p.y, z: p.z }, q: { x: q.x, y: q.y, z: q.z, w: q.w } }));
        });
      }
    }
    { const av = car.chassis.angvel(), lv = car.chassis.linvel();
      if (i > 25000 && i < 25800) {
        const prev = car._prevAV ?? av, pl = car._prevLV ?? lv;
        const dw = Math.hypot(av.x - prev.x, av.y - prev.y, av.z - prev.z), dv = Math.hypot(lv.x - pl.x, lv.y - pl.y, lv.z - pl.z);
        if (dw > 2 || dv > 0.1) {
          const parts = [];
          for (let c = 0; c < car.chassis.numColliders(); c++) {
            const col = car.chassis.collider(c);
            env.world.contactPairsWith(col, (other) => env.world.contactPair(col, other, (m) => { if (m.numContacts() > 0) parts.push(`c${c}-${env.wallHandles.has(other.handle) ? 'WALL' : 'road'} n${JSON.stringify(m.normal(), (k, x) => typeof x === 'number' ? +x.toFixed(3) : x)} d${(m.contactDist(0) * 1000).toFixed(2)}`); }));
          }
          console.log('K', i, 'dw', dw.toFixed(2), 'dv', dv.toFixed(3), 'wN', car.wheels.map((w) => (w.normalForce ?? 0).toFixed(2)).join(','), 'rollerC', sim.rollerWallContacts(env, car).length, parts.join(' | ').slice(0, 500));
        }
      }
      car._prevAV = av; car._prevLV = lv; }
    if (false) {
      const parts = [];
      for (let c = 0; c < car.chassis.numColliders(); c++) {
        const col = car.chassis.collider(c);
        env.world.contactPairsWith(col, (other) => {
          env.world.contactPair(col, other, (m) => {
            let imp = 0, n = m.numContacts();
            for (let k = 0; k < n; k++) imp += m.contactImpulse(k);
            const nr = m.normal();
            if (n > 0 && Math.abs(nr.x) > 0.5) { for (let k = 0; k < n; k++) { const lp = m.localContactPoint1 ? m.localContactPoint1(k) : null; const tq = col.rotation(), tt = col.translation(); const qv = new THREE.Vector3(lp.x, lp.y, lp.z).applyQuaternion(new THREE.Quaternion(tq.x, tq.y, tq.z, tq.w)); const wp = { x: qv.x + tt.x, y: qv.y + tt.y, z: qv.z + tt.z }; const pp = wp ? track.path.project(wp.x, wp.z) : null; parts.push(`X wp=${JSON.stringify(wp)} s=${pp?.s.toFixed(4)} d=${pp?.d.toFixed(4)} other=${other.shape.type} road=${(track.roadHeight(pp.s, 'bridge')*1000).toFixed(1)}/${(track.roadHeight(pp.s, 'ground')*1000).toFixed(1)} car=${JSON.stringify(car.chassis.translation())} lp=${JSON.stringify(lp)} solver=${other.solverGroups?.()}`); } }
            if (false) parts.push(`c${c}(${col.shape.type},r${col.restitution().toFixed(2)})-h${other.handle}:n${n},imp${imp.toExponential(2)},d${m.contactDist(0).toExponential(2)},nrm${JSON.stringify(m.normal())}`);
          });
        });
      }
      console.log('P', i, 'vy', car.chassis.linvel().y.toFixed(3), 'wv', car.chassis.angvel().z.toFixed(2), 'wN', car.wheels.map((w) => (w.normalForce ?? 0).toFixed(2)).join(','), parts.join(' '));
    }
    if (false) {
      const lvl = sim.carLevel ? sim.carLevel(env, car) : '?';
      const rows = car.rollers.map((r) => {
        const w = sim.localToWorld ? sim.localToWorld(car, { x: r.x / 1000, y: r.y / 1000, z: r.z / 1000 }) : null;
        const pp = track.path.project(w.x, w.z);
        const top = (track.roadHeight ? track.roadHeight(pp.s, lvl) : 0) + (track.dims.wallH ?? spec.track.wallHeight_mm / 1000);
        return `${r.id}:y${(w.y * 1000).toFixed(1)} wt${(top * 1000).toFixed(1)} d${(pp.d * 1000).toFixed(1)}`;
      });
      console.log('S', i, 's', p.s.toFixed(3), 'up', up.toFixed(3), 'vy', car.chassis.linvel().y.toFixed(3), 'wN', car.wheels.map((w) => (w.normalForce ?? 0).toFixed(2)).join(','), 'lvl', lvl, 'road', (track.roadHeight(p.s, lvl) * 1000).toFixed(1), rows.join(' '), 'nC', sim.rollerWallContacts(env, car).length);
    }
    if (pen > 0.002 && i % 20 === 0) console.log('step', i, 's', p.s.toFixed(3), 'd', p.d.toFixed(4), 'y', t.y.toFixed(4), 'pen', (pen * 1000).toFixed(2), 'up', up.toFixed(3), 'v', JSON.stringify(car.chassis.linvel()));
  }
  console.log('worst', JSON.stringify(worst), 'minUp', JSON.stringify(minUp), 'L', track.path.length);
}, 600000);
