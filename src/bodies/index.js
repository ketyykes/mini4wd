// 車殼目錄：所有車殼都裝在同一組安裝點上；質量、重心、外框由車殼幾何計算
import * as THREE from 'three';
import { skeletonBody } from './skeleton.js';
import { aeroWingBody } from './aeroWing.js';
import { pcBoxBody } from './pcBox.js';
import { homageBodiesA } from './homageA.js';
import { homageBodiesB } from './homageB.js';
import { griffinVaneBody } from './griffinVane.js';
import { zeppelinXtailBody } from './zeppelinXtail.js';

/** @typedef {import('./types').BodyDef} BodyDef */
/** @typedef {import('./types').BodyMassProps} BodyMassProps */

// 第四階段（iter-54）：全新 6 款致敬《爆走兄弟》風格車殼（A 組 tortoise-dome / marlin-sail / owl-hush、B 組 gazelle-leap / halo-orbit / dartfrog-hop，
// 分別註冊在 homageA.js / homageB.js）＋常見比賽車殼型式 3 款（skeleton / aero-wing / pc-box）。
// 第三階段的致敬款 wedge / beast / fork 已退役（程式碼保留在 git 歷史，設計說明在 shared/design/ 標註已退役）
/** @type {BodyDef[]} */
const bodies = [...homageBodiesA, ...homageBodiesB, skeletonBody, aeroWingBody, pcBoxBody, griffinVaneBody, zeppelinXtailBody];

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

/** @type {(obj: THREE.Object3D) => any} 物件自己或祖先標的實體件資訊（userData.solid） */
const solidOf = (obj) => {
  for (let o = obj; o; o = o.parent) {
    if (o.userData?.solid) {
      return o.userData.solid;
    }
  }
  return null;
};

/**
 * 封閉網格的體積與體積重心（iter-49）：先依共用頂點把三角形分成連通塊，每塊用散度定理算有號體積後取絕對值
 * （合併幾何裡個別零件的繞向不一定一致，分塊取絕對值可避免互相抵銷）
 * @type {(pts: Float64Array) => { vol: number, mx: number, my: number, mz: number }} pts：每 9 個數一個三角形（世界座標）
 */
const closedVolume = (pts) => {
  const nTri = pts.length / 9;
  /** @type {Map<string, number>} */
  const keyId = new Map();
  /** @type {number[]} 並查集 */
  const parent = [];
  /** @type {(i: number) => number} */
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const triV = new Int32Array(nTri * 3);
  for (let i = 0; i < nTri * 3; i++) {
    const k = `${Math.round(pts[3 * i] * 1e4)},${Math.round(pts[3 * i + 1] * 1e4)},${Math.round(pts[3 * i + 2] * 1e4)}`;
    let id = keyId.get(k);
    if (id === undefined) {
      id = parent.length;
      parent.push(id);
      keyId.set(k, id);
    }
    triV[i] = id;
  }
  for (let t = 0; t < nTri; t++) {
    const r0 = find(triV[3 * t]);
    for (let e = 1; e < 3; e++) {
      const r = find(triV[3 * t + e]);
      if (r !== r0) {
        parent[r] = r0;
      }
    }
  }
  /** @type {Map<number, number[]>} 連通塊 → [有號體積, mx, my, mz]（有號） */
  const comp = new Map();
  for (let t = 0; t < nTri; t++) {
    const o = 9 * t;
    const ax = pts[o];
    const ay = pts[o + 1];
    const az = pts[o + 2];
    const bx = pts[o + 3];
    const by = pts[o + 4];
    const bz = pts[o + 5];
    const cx = pts[o + 6];
    const cy = pts[o + 7];
    const cz = pts[o + 8];
    const v = (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
    const r = find(triV[3 * t]);
    let acc = comp.get(r);
    if (!acc) {
      acc = [0, 0, 0, 0];
      comp.set(r, acc);
    }
    // 四面體（原點, a, b, c）的重心 = (a + b + c) / 4
    acc[0] += v;
    acc[1] += (v * (ax + bx + cx)) / 4;
    acc[2] += (v * (ay + by + cy)) / 4;
    acc[3] += (v * (az + bz + cz)) / 4;
  }
  let vol = 0;
  let mx = 0;
  let my = 0;
  let mz = 0;
  for (const [v, x, y, z] of comp.values()) {
    const sg = v < 0 ? -1 : 1;
    vol += sg * v;
    mx += sg * x;
    my += sg * y;
    mz += sg * z;
  }
  return { vol, mx, my, mz };
};

/** @type {Map<string, BodyMassProps>} */
const cache = new Map();

/**
 * 車殼質量性質：結構殼三角形面積總和 × 壁厚 × 密度＋實體件（userData.solid）封閉體積 × 密度；重心 = 兩者質量加權；外框 = 整個車殼群組
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
  // 殼：mm² × mm = mm³；1 cm³ = 1000 mm³
  const shellMass = (area * body.wallThickness_mm * body.density_g_cm3) / 1000;
  const shellCom = area > 0 ? mom.clone().divideScalar(area) : new THREE.Vector3();
  // 實體件（iter-49，userData.solid）：封閉網格體積 × 密度（預設同車殼材料，可由 solid.density_g_cm3 指定）
  /** @type {Map<number, number[]>} 密度 → 該密度實體件的世界座標三角形 */
  const solidTris = new Map();
  g.traverse((o) => {
    if (!o.isMesh || isShell(o)) {
      return;
    }
    const sd = solidOf(o);
    if (!sd) {
      return;
    }
    const rho = sd.density_g_cm3 ?? body.density_g_cm3;
    let arr = solidTris.get(rho);
    if (!arr) {
      arr = [];
      solidTris.set(rho, arr);
    }
    const pos = o.geometry.attributes.position;
    const idx = o.geometry.index;
    const n = idx ? idx.count : pos.count;
    for (let i = 0; i < n; i++) {
      a.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(o.matrixWorld);
      arr.push(a.x, a.y, a.z);
    }
  });
  let solidMass = 0;
  let solidVol = 0;
  const solidMom = new THREE.Vector3();
  for (const [rho, arr] of solidTris) {
    const r = closedVolume(Float64Array.from(arr));
    const m = (r.vol * rho) / 1000;
    solidMass += m;
    solidVol += r.vol;
    if (r.vol > 0) {
      solidMom.add(new THREE.Vector3(r.mx, r.my, r.mz).multiplyScalar(m / r.vol));
    }
  }
  const mass_g = shellMass + solidMass;
  const com = mass_g > 0 ? shellCom.multiplyScalar(shellMass).add(solidMom).divideScalar(mass_g) : new THREE.Vector3();
  /** @type {BodyMassProps} */
  const props = {
    shellArea_mm2: area,
    mass_g,
    shellMass_g: shellMass,
    solidMass_g: solidMass,
    solidVolume_mm3: solidVol,
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
