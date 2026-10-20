// 車殼目錄：所有車殼都裝在同一組安裝點上；質量、重心、外框由車殼幾何計算
import * as THREE from 'three';
import { legacyBody } from './legacy.js';

/** @typedef {import('./types').BodyDef} BodyDef */
/** @typedef {import('./types').BodyMassProps} BodyMassProps */

/** @type {BodyDef[]} */
const bodies = [legacyBody];

/** @type {() => BodyDef[]} */
export const listBodies = () => bodies.slice();

/** @type {(id: string) => BodyDef} */
export const getBody = (id) => {
  const b = bodies.find((x) => x.id === id);
  if (!b) {
    throw new Error(`未知的車殼 id：${id}`);
  }
  return b;
};

/** 算質量時用的中性材質：任何材質名稱都回傳同一個材質（只需要幾何） */
const neutralMat = new THREE.MeshStandardMaterial();
const neutralMats = new Proxy({}, { get: () => neutralMat });

/** @type {(obj: THREE.Object3D) => boolean} 物件自己或祖先標為結構殼 */
const isShell = (obj) => {
  for (let o = obj; o; o = o.parent) {
    if (o.userData?.shell) {
      return true;
    }
  }
  return false;
};

/** @type {Map<string, BodyMassProps>} */
const cache = new Map();

/**
 * 車殼質量性質：結構殼三角形面積總和 × 壁厚 × 密度；重心 = 面積加權三角形中心；外框 = 整個車殼群組
 * @type {(body: BodyDef) => BodyMassProps}
 */
export const bodyMassProps = (body) => {
  const hit = cache.get(body.id);
  if (hit) {
    return hit;
  }
  const g = body.build(neutralMats);
  g.updateMatrixWorld(true);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  let area = 0;
  const mom = new THREE.Vector3();
  g.traverse((o) => {
    if (!o.isMesh || !isShell(o)) {
      return;
    }
    const pos = o.geometry.attributes.position;
    const idx = o.geometry.index;
    const nTri = idx ? idx.count / 3 : pos.count / 3;
    for (let t = 0; t < nTri; t++) {
      const i0 = idx ? idx.getX(3 * t) : 3 * t;
      const i1 = idx ? idx.getX(3 * t + 1) : 3 * t + 1;
      const i2 = idx ? idx.getX(3 * t + 2) : 3 * t + 2;
      a.fromBufferAttribute(pos, i0).applyMatrix4(o.matrixWorld);
      b.fromBufferAttribute(pos, i1).applyMatrix4(o.matrixWorld);
      c.fromBufferAttribute(pos, i2).applyMatrix4(o.matrixWorld);
      const s = ab.subVectors(b, a).cross(ac.subVectors(c, a)).length() / 2;
      area += s;
      mom.addScaledVector(a.add(b).add(c), s / 3);
    }
  });
  const box = new THREE.Box3().setFromObject(g);
  // mm² × mm = mm³；1 cm³ = 1000 mm³
  const mass_g = (area * body.wallThickness_mm * body.density_g_cm3) / 1000;
  const com = area > 0 ? mom.divideScalar(area) : new THREE.Vector3();
  /** @type {BodyMassProps} */
  const props = {
    shellArea_mm2: area,
    mass_g,
    com_mm: { x: com.x, y: com.y, z: com.z },
    bbox_mm: { min: { x: box.min.x, y: box.min.y, z: box.min.z }, max: { x: box.max.x, y: box.max.y, z: box.max.z } },
  };
  cache.set(body.id, props);
  return props;
};
