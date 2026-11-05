// B10 診斷：所有附件實體 vs 底盤 3D 網格（與質量分布同一份 ABS 本體網格）的穿透。
// 網格三角形以 ≤ 0.7 mm 間距取樣表面點，用各附件實體的有號距離（負值 = 底盤表面點在附件內）。
import { test, beforeAll } from 'vitest';
import * as THREE from 'three';
import { assemble, loadConfig, SLOTS, OPTIONAL_SLOTS } from '../../src/assembly.js';
import { validateAssembly } from '../../src/regulation.js';
import { listParts } from '../../src/parts/index.js';
import { verticesGap, sdf } from '../../src/parts/clearance.js';
import { buildCarModel } from '../../src/model.js';
import { initRapier } from '../../src/sim.js';

beforeAll(async () => { await initRapier(); });

/** @type {Map<string, Float32Array>} */
const meshCache = new Map();
/** @type {(asm: any) => Float32Array} 底盤本體網格表面取樣點（底盤座標 mm） */
function chassisSamples(asm) {
  const car = buildCarModel(asm, { body: false });
  car.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(car.getObjectByName('sprung').matrixWorld).invert();
  const out = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), p = new THREE.Vector3();
  car.getObjectByName('chassis').traverse((o) => {
    if (!o.isMesh) return;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    if (mat.name !== 'abs-chassis-gunmetal') return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
    const pos = g.attributes.position;
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    for (let i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i).applyMatrix4(m);
      b.fromBufferAttribute(pos, i + 1).applyMatrix4(m);
      c.fromBufferAttribute(pos, i + 2).applyMatrix4(m);
      const n = Math.max(1, Math.ceil(Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)) / 0.7));
      for (let u = 0; u <= n; u++) for (let v = 0; v <= n - u; v++) {
        p.copy(a).multiplyScalar((n - u - v) / n).addScaledVector(b, u / n).addScaledVector(c, v / n);
        out.push(p.x, p.y, p.z);
      }
    }
  });
  return Float32Array.from(out);
}

test('b10 attachments vs chassis mesh', () => {
  const configs = (process.env.B10_CONFIGS ?? 'default,p5-taiwan,p7-demo,p7-parts,vz-demo,vz-tuned').split(',');
  const slots = ['massDamper', 'brakeSponge', 'brakePlate', 'ballast', 'stabilizer', 'frontStay', 'rearStay', 'frontRollers', 'rearRollers', 'frontRollerAngle', 'rearRollerAngle'];
  /** @type {Map<string, { gap: number, where: string }>} */
  const worst = new Map();
  let checked = 0;
  for (const name of configs) {
    const base = loadConfig(name);
    for (const slot of slots) {
      const ids = listParts(SLOTS[slot]).map((q) => q.id);
      if (OPTIONAL_SLOTS.includes(slot)) ids.push(null);
      for (const id of ids) {
        const cfg = { ...base, [slot]: id };
        let asm;
        try { asm = assemble(cfg); } catch { continue; }
        if (validateAssembly(asm).violations.length) continue;
        checked++;
        const ch = asm.partsBySlot.chassis.id;
        const key = JSON.stringify([ch, asm.partsBySlot.frontStay?.id, asm.partsBySlot.rearStay?.id, asm.spec.chassis.bumperCut ?? null]);
        if (!meshCache.has(key)) meshCache.set(key, chassisSamples(asm));
        const pts = meshCache.get(key);
        for (const s of asm.optional.solids) {
          if (s.mountingHardware) continue;
          const g = verticesGap(pts, s.solid);
          const k = `${ch}|${s.group}|${s.slot}|${s.label}|${slot === s.slot ? id : '(base)'}`;
          const cur = worst.get(k);
          if (!cur || g < cur.gap) {
            // 最深的穿透點位置（mm）
            let best = Infinity, at = null;
            if (g < 0) for (let i = 0; i < pts.length; i += 3) { const d = sdf(s.solid, pts[i], pts[i + 1], pts[i + 2]); if (d < best) { best = d; at = [pts[i], pts[i + 1], pts[i + 2]].map((v) => v.toFixed(1)).join(','); } }
            worst.set(k, { gap: g, where: `${name} ${slot}=${id} deepest@(${at}) solid=${JSON.stringify(s.solid).slice(0, 160)}` });
          }
        }
      }
    }
  }
  console.log(`checked ${checked} legal assemblies, ${meshCache.size} chassis meshes`);
  const rows = [...worst.entries()].filter(([, v]) => v.gap < 0.0).sort((x, y) => x[1].gap - y[1].gap);
  for (const [k, v] of rows) console.log(`PEN ${v.gap.toFixed(3)} mm  ${k}  @ ${v.where}`);
  console.log(`penetrating combos: ${rows.length}`);
});
