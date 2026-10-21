// 車殼目錄：所有車殼都裝在同一組安裝點上；質量、重心、外框由車殼幾何計算
import * as THREE from 'three';
import { wedgeBody } from './wedge.js';
import { skeletonBody } from './skeleton.js';
import { aeroWingBody } from './aeroWing.js';
import { beastBody } from './beast.js';
import { forkBody } from './fork.js';
import { pcBoxBody } from './pcBox.js';

/** @typedef {import('./types').BodyDef} BodyDef */
/** @typedef {import('./types').BodyMassProps} BodyMassProps */

// 六款原創車殼（iter-46）：致敬《爆走兄弟》風格 3 款（wedge / beast / fork）＋常見比賽車殼型式 3 款（skeleton / aero-wing / pc-box）
/** @type {BodyDef[]} */
const bodies = [wedgeBody, beastBody, forkBody, skeletonBody, aeroWingBody, pcBoxBody];

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
  // 所有車殼頂點（底盤座標），給組裝時檢查和輪胎 / 導輪的間隙（bodyClearance）
  /** @type {number[]} */
  const verts = [];
  g.traverse((o) => {
    if (!o.isMesh) {
      return;
    }
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      a.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      verts.push(a.x, a.y, a.z);
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
    vertices: new Float32Array(verts),
  };
  cache.set(body.id, props);
  return props;
};

/**
 * 點到有限圓柱的距離（外部為正、內部為負），mm
 * @type {(px: number, py: number, pz: number, c: { x: number, y: number, z: number }, axis: 'y'|'z', r: number, halfLen: number) => number}
 */
const cylinderDistance = (px, py, pz, c, axis, r, halfLen) => {
  let radial;
  let along;
  if (axis === 'z') {
    radial = Math.hypot(px - c.x, py - c.y);
    along = Math.abs(pz - c.z);
  } else {
    radial = Math.hypot(px - c.x, pz - c.z);
    along = Math.abs(py - c.y);
  }
  const dr = radial - r;
  const da = along - halfLen;
  if (dr <= 0 && da <= 0) {
    return Math.max(dr, da);
  }
  return Math.hypot(Math.max(dr, 0), Math.max(da, 0));
};

/** @type {Map<string, { tire_mm: number, roller_mm: number }>} */
const clearanceCache = new Map();

/**
 * 車殼與輪胎、導輪的最小間隙（底盤座標，mm）：車殼所有頂點到輪胎圓柱（軸沿 z）與導輪圓柱（軸沿 y）的最短距離
 * 用來在換輪胎 / 導輪時檢查車殼是否干涉（規則檢查器回傳警告，SPEC 1.14 要求 ≥ 1 mm）
 * @type {(body: BodyDef, wheels: { x: number, y: number, z: number, r: number, width: number }[], rollers: { x: number, y: number, z: number, r: number, h: number }[]) => { tire_mm: number, roller_mm: number }}
 */
export const bodyClearance = (body, wheels, rollers) => {
  const key = JSON.stringify([body.id, wheels, rollers]);
  const hit = clearanceCache.get(key);
  if (hit) {
    return hit;
  }
  const v = bodyMassProps(body).vertices;
  let tire = Infinity;
  let roller = Infinity;
  for (let i = 0; i < v.length; i += 3) {
    for (const w of wheels) {
      tire = Math.min(tire, cylinderDistance(v[i], v[i + 1], v[i + 2], w, 'z', w.r, w.width / 2));
    }
    for (const r of rollers) {
      roller = Math.min(roller, cylinderDistance(v[i], v[i + 1], v[i + 2], r, 'y', r.r, r.h / 2));
    }
  }
  const result = { tire_mm: tire, roller_mm: roller };
  clearanceCache.set(key, result);
  return result;
};
