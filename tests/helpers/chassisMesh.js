import * as THREE from 'three';
import { buildCarModel } from '../../src/model.js';
import { simplexSecond, zeroTensor, addTensor, centralTensor } from '../../src/massTensor.js';

/**
 * 由 3D 模型的 ABS 底盤本體網格（材質 abs-chassis-gunmetal）積分體積權重的質量分布（iter-96，B3）：
 * 回傳重心（底盤座標 mm）與「每 g 的中心慣性張量」（mm²）。網格有重疊、比實物厚，只當分布權重，總質量另用實測值。
 * @type {(asm: any) => { volume_mm3: number, com_mm: { x: number, y: number, z: number }, gyration_mm2: Record<string, number> }}
 */
export function chassisMeshDistribution(asm) {
  const car = buildCarModel(asm, { body: false });
  car.updateMatrixWorld(true);
  const chassis = car.getObjectByName('chassis');
  const inv = new THREE.Matrix4().copy(car.getObjectByName('sprung').matrixWorld).invert();
  let vol = 0;
  const mom = [0, 0, 0];
  const second = zeroTensor();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  chassis.traverse((o) => {
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
      const v = a.dot(b.clone().cross(c)) / 6;
      vol += v;
      for (let k = 0; k < 3; k++) mom[k] += (v * (a.getComponent(k) + b.getComponent(k) + c.getComponent(k))) / 4;
      addTensor(second, simplexSecond([[0, 0, 0], a.toArray(), b.toArray(), c.toArray()], v, 20));
    }
  });
  const com = { x: mom[0] / vol, y: mom[1] / vol, z: mom[2] / vol };
  const perMass = Object.fromEntries(Object.entries(second).map(([k, v]) => [k, v / vol]));
  return { volume_mm3: vol, com_mm: com, gyration_mm2: centralTensor(perMass, 1, com) };
}
