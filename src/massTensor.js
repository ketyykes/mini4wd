import * as THREE from 'three';

// Symmetric inertia tensor, in the same units as mass * length².
export const zeroTensor = () => ({ xx: 0, yy: 0, zz: 0, xy: 0, xz: 0, yz: 0 });
export const addTensor = (target, source, scale = 1) => {
  for (const k of Object.keys(target)) target[k] += source[k] * scale;
  return target;
};
export const pointTensor = (m, p) => ({
  xx: m * (p.y ** 2 + p.z ** 2), yy: m * (p.x ** 2 + p.z ** 2), zz: m * (p.x ** 2 + p.y ** 2),
  xy: -m * p.x * p.y, xz: -m * p.x * p.z, yz: -m * p.y * p.z,
});

/** Uniform solid cylinder about its center, with its length along body x.
 * Inputs may use g/mm (output g·mm²) or kg/m (output kg·m²).
 * This estimates the distribution inside the outer envelope, not cell internals. */
export function cylinderXTensor(mass, radius, length) {
  if (![mass, radius, length].every((v) => Number.isFinite(v) && v > 0)) {
    throw new Error('Cylinder mass, radius and length must be positive and finite');
  }
  const transverse = mass * (3 * radius ** 2 + length ** 2) / 12;
  return { xx: mass * radius ** 2 / 2, yy: transverse, zz: transverse, xy: 0, xz: 0, yz: 0 };
}

/** 均質方塊對自身中心（邊長 lx, ly, lz 沿車體 x, y, z）。單位同 cylinderXTensor */
export const boxTensor = (m, lx, ly, lz) => ({
  xx: (m * (ly ** 2 + lz ** 2)) / 12, yy: (m * (lx ** 2 + lz ** 2)) / 12, zz: (m * (lx ** 2 + ly ** 2)) / 12, xy: 0, xz: 0, yz: 0,
});

/**
 * 軸對稱件（軸沿 axis）：已知繞軸慣量 axial，橫向 = axial / 2 + m·len² / 12（軸對稱分布 ∫x² = ∫y² = axial / 2，沿軸均勻分布）
 * @type {(m: number, axial: number, len: number, axis: 'x' | 'y' | 'z') => Record<string, number>}
 */
export function axisymmetricTensor(m, axial, len, axis) {
  const tr = axial / 2 + (m * len ** 2) / 12;
  return { xx: axis === 'x' ? axial : tr, yy: axis === 'y' ? axial : tr, zz: axis === 'z' ? axial : tr, xy: 0, xz: 0, yz: 0 };
}

const flatCylCache = new Map();
/**
 * 兩側削平的圓柱（130 型馬達外殼：直徑 dia、上下削平到 flat，沿 x 長 length）的均質中心張量。
 * 截面 ⟨y²⟩、⟨z²⟩ 以 0.02 mm 格點數值積分（快取）
 * @type {(m: number, dia: number, flat: number, length: number) => Record<string, number>}
 */
export function flattenedCylinderXTensor(m, dia, flat, length) {
  const key = `${dia}|${flat}`;
  let mo = flatCylCache.get(key);
  if (!mo) {
    const r = dia / 2;
    const h = 0.02;
    let n = 0, yy = 0, zz = 0;
    for (let y = -flat / 2 + h / 2; y < flat / 2; y += h) {
      for (let z = -r + h / 2; z < r; z += h) {
        if (y * y + z * z <= r * r) { n++; yy += y * y; zz += z * z; }
      }
    }
    mo = { y2: yy / n, z2: zz / n };
    flatCylCache.set(key, mo);
  }
  const x2 = length ** 2 / 12;
  return { xx: m * (mo.y2 + mo.z2), yy: m * (x2 + mo.z2), zz: m * (x2 + mo.y2), xy: 0, xz: 0, yz: 0 };
}

/**
 * 均質平板（俯視多邊形 outline [[x, z], …]、厚 t 沿 y）對自身重心的張量：多邊形面積二次矩（格林公式）＋厚度項
 * @type {(m: number, outline: number[][], t: number) => Record<string, number>}
 */
export function plateTensor(m, outline, t) {
  let A = 0, cx = 0, cz = 0, ixx = 0, izz = 0, ixz = 0;
  for (let i = 0; i < outline.length; i++) {
    const [x0, z0] = outline[i];
    const [x1, z1] = outline[(i + 1) % outline.length];
    const cr = x0 * z1 - x1 * z0;
    A += cr / 2;
    cx += ((x0 + x1) * cr) / 6;
    cz += ((z0 + z1) * cr) / 6;
    ixx += ((x0 * x0 + x0 * x1 + x1 * x1) * cr) / 12;
    izz += ((z0 * z0 + z0 * z1 + z1 * z1) * cr) / 12;
    ixz += ((x0 * z1 + 2 * x0 * z0 + 2 * x1 * z1 + x1 * z0) * cr) / 24;
  }
  cx /= A; cz /= A;
  // 面積平均（對重心）
  const x2 = ixx / A - cx * cx, z2 = izz / A - cz * cz, xz = ixz / A - cx * cz;
  const y2 = t ** 2 / 12;
  return { xx: m * (y2 + z2), yy: m * (x2 + z2), zz: m * (x2 + y2), xy: 0, xz: -m * xz, yz: 0 };
}

/** Convert raw second moments ∫rrᵀ dm into inertia about the center of mass. */
export function centralTensor(second, mass, com) {
  const out = {
    xx: second.yy + second.zz, yy: second.xx + second.zz, zz: second.xx + second.yy,
    xy: -second.xy, xz: -second.xz, yz: -second.yz,
  };
  return addTensor(out, pointTensor(mass, com), -1);
}

/** ∫rrᵀ over a triangle (denominator 12) or origin tetrahedron (20).
 * weight is area or signed volume; density is applied by the caller. */
export function simplexSecond(vertices, weight, denominator) {
  const sum = [0, 0, 0];
  for (const v of vertices) for (let k = 0; k < 3; k++) sum[k] += v[k];
  const out = zeroTensor();
  for (const [name, i, j] of [['xx', 0, 0], ['yy', 1, 1], ['zz', 2, 2], ['xy', 0, 1], ['xz', 0, 2], ['yz', 1, 2]]) {
    out[name] = weight / denominator * (sum[i] * sum[j] + vertices.reduce((s, v) => s + v[i] * v[j], 0));
  }
  return out;
}

/** Jacobi diagonalization. Columns of V are the principal axes in body space. */
export function principalAxes(tensor) {
  const a = [[tensor.xx, tensor.xy, tensor.xz], [tensor.xy, tensor.yy, tensor.yz], [tensor.xz, tensor.yz, tensor.zz]];
  const v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const scale = Math.max(...a.map((r, i) => Math.abs(r[i])));
  for (let iter = 0; iter < 32; iter++) {
    let p = 0, q = 1;
    for (const [i, j] of [[0, 2], [1, 2]]) if (Math.abs(a[i][j]) > Math.abs(a[p][q])) { p = i; q = j; }
    if (Math.abs(a[p][q]) <= scale * 1e-14) break;
    const tau = (a[q][q] - a[p][p]) / (2 * a[p][q]);
    const t = (tau >= 0 ? 1 : -1) / (Math.abs(tau) + Math.sqrt(1 + tau * tau));
    const c = 1 / Math.sqrt(1 + t * t), s = t * c;
    const apq = a[p][q];
    a[p][p] -= t * apq; a[q][q] += t * apq;
    a[p][q] = a[q][p] = 0;
    for (let k = 0; k < 3; k++) {
      if (k !== p && k !== q) {
        const kp = a[k][p], kq = a[k][q];
        a[k][p] = a[p][k] = c * kp - s * kq;
        a[k][q] = a[q][k] = s * kp + c * kq;
      }
      const vp = v[k][p], vq = v[k][q];
      v[k][p] = c * vp - s * vq; v[k][q] = s * vp + c * vq;
    }
  }
  const matrix = new THREE.Matrix4().makeBasis(...[0, 1, 2].map((j) => new THREE.Vector3(v[0][j], v[1][j], v[2][j])));
  const q = new THREE.Quaternion().setFromRotationMatrix(matrix).normalize();
  const inertia = { x: a[0][0], y: a[1][1], z: a[2][2] };
  if (!Object.values(inertia).every((x) => x > 0 && Number.isFinite(x))) throw new Error('Invalid inertia tensor');
  return { inertia, frame: { x: q.x, y: q.y, z: q.z, w: q.w } };
}
