// Structural mesh -> local collision cells. Clipping before bounding keeps
// distant noses, wings and skirts from filling the whole body's bounding box.
import * as THREE from 'three';

// Keep short longitudinal slices for bridges. Wider transverse/vertical
// cells bound collider count so races can still advance interactively.
export const COLLISION_CELL_MM = [12, 32, 48];
const cache = new WeakMap();
const material = new THREE.MeshBasicMaterial();
const materials = new Proxy({}, { get: () => material });

const structural = (mesh) => {
  for (let o = mesh; o; o = o.parent) {
    if (o.userData?.shell) return 'shell';
    if (o.userData?.solid) return 'solid';
  }
  return null;
};

// Sutherland–Hodgman clipping of a 3D polygon against an axis plane.
const clip = (poly, axis, bound, sign) => {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const da = sign * (a[axis] - bound), db = sign * (b[axis] - bound);
    if (da >= -1e-9) out.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const t = da / (da - db);
      out.push(a.map((v, k) => v + t * (b[k] - v)));
    }
  }
  return out;
};

/** Patch point clouds in mm; shell patches include their wall thickness.
 * Each patch stays within one 12 × 32 × 48 mm cell (plus half wall thickness).
 * The simulator uses each patch's bounding box: local curvature and concavity
 * remain documented approximations, without filling the entire car's bounds.
 */
export function bodyCollisionCells(body) {
  if (cache.has(body)) return cache.get(body);
  const group = body.build(materials);
  group.updateMatrixWorld(true);
  const cells = new Map();
  const v = new THREE.Vector3();
  group.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const kind = structural(mesh);
    if (!kind) return; // Decals and painted overlays have no extra material.
    const p = mesh.geometry.attributes.position, idx = mesh.geometry.index;
    const n = idx?.count ?? p.count;
    for (let t = 0; t < n; t += 3) {
      const tri = [0, 1, 2].map((k) => v.fromBufferAttribute(p, idx ? idx.getX(t + k) : t + k).applyMatrix4(mesh.matrixWorld).toArray());
      const ab = new THREE.Vector3().fromArray(tri[1]).sub(new THREE.Vector3().fromArray(tri[0]));
      const ac = new THREE.Vector3().fromArray(tri[2]).sub(new THREE.Vector3().fromArray(tri[0]));
      const normal = ab.cross(ac);
      if (normal.lengthSq() < 1e-16) continue;
      // A zero-thickness solid surface still needs a full-dimensional hull.
      // 0.01 mm is numerical padding, not additional mass.
      normal.normalize().multiplyScalar(kind === 'shell' ? body.wallThickness_mm / 2 : 0.01);
      const delta = normal.toArray();
      const lo = [0, 1, 2].map((k) => Math.floor(Math.min(...tri.map((p) => p[k])) / COLLISION_CELL_MM[k]));
      const hi = [0, 1, 2].map((k) => Math.floor(Math.max(...tri.map((p) => p[k])) / COLLISION_CELL_MM[k]));
      for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) {
        const cell = [x, y, z];
        let poly = tri;
        for (let k = 0; k < 3 && poly.length; k++) {
          poly = clip(poly, k, cell[k] * COLLISION_CELL_MM[k], 1);
          poly = clip(poly, k, (cell[k] + 1) * COLLISION_CELL_MM[k], -1);
        }
        if (poly.length < 3) continue;
        const areaNormal = new THREE.Vector3();
        for (let i = 1; i + 1 < poly.length; i++) {
          const a = new THREE.Vector3().fromArray(poly[i]).sub(new THREE.Vector3().fromArray(poly[0]));
          const b = new THREE.Vector3().fromArray(poly[i + 1]).sub(new THREE.Vector3().fromArray(poly[0]));
          areaNormal.add(a.cross(b));
        }
        if (areaNormal.lengthSq() < 1e-12) continue; // Plane/edge-only cell intersections.
        const key = cell.join(',');
        let points = cells.get(key);
        if (!points) cells.set(key, points = new Map());
        for (const p of poly) for (const sign of [-1, 1]) {
          const q = p.map((a, k) => a + sign * delta[k]);
          points.set(q.map((a) => Math.round(a * 1e5)).join(','), q);
        }
      }
    }
  });
  const hulls = [...cells.values()].map((points) => Float32Array.from([...points.values()].flat()));
  cache.set(body, hulls);
  return hulls;
}
