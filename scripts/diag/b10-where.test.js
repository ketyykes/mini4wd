// B10 診斷：列出包含指定點的底盤網格（找穿透點是哪個結構）
import { test, beforeAll } from 'vitest';
import * as THREE from 'three';
import { assemble, loadConfig } from '../../src/assembly.js';
import { buildCarModel } from '../../src/model.js';
import { initRapier } from '../../src/sim.js';
beforeAll(async () => { await initRapier(); });
test('where', () => {
  for (const [cfg, over, pt] of JSON.parse(process.env.B10_WHERE)) {
    const car = buildCarModel(assemble({ ...loadConfig(cfg), ...over }), { body: false });
    car.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(car.getObjectByName('sprung').matrixWorld).invert();
    car.getObjectByName('chassis').traverse((o) => {
      if (!o.isMesh) return;
      const mat = Array.isArray(o.material) ? o.material[0] : o.material;
      if (mat.name !== 'abs-chassis-gunmetal') return;
      o.geometry.computeBoundingBox();
      const b = o.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      if (b.expandByScalar(0.3).containsPoint(new THREE.Vector3(...pt))) console.log(cfg, pt, o.name || '(unnamed)', o.parent?.name || '', o.geometry.type, JSON.stringify(o.geometry.parameters ?? {}).slice(0, 120), b.min.toArray().map((v) => v.toFixed(1)), b.max.toArray().map((v) => v.toFixed(1)));
    });
  }
});
