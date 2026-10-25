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
