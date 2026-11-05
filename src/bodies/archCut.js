// B15：切輪拱改裝。大徑輪磨到車殼時，玩家會把輪胎附近的殼面剪掉。
// 規則依據（shared/reference/BODY_RACE_RESEARCH.md 2.1、2.2）：公認規則（注1）允許改造車殼，只有「著しく小型化」可能被拒；
// ストッククラス 4.「ボディの加工は肉抜きおよびパーツに干渉する部分のカットのみ認められます」→ 切掉和輪胎干涉的部分是明文允許的加工。
// 切除區：每個輪胎圓柱（軸沿 z）往外加 ARCH_CUT_MARGIN_mm；切口留 0.5 mm 的裁切公差，間隙仍 ≥ 規則檢查的 1 mm。
import * as THREE from 'three';

/** @typedef {import('./types').BodyDef} BodyDef */
/** @typedef {{ x: number, y: number, z: number, r: number, width: number }} ArchWheel */

/** 切口與輪胎的距離（mm）：SPEC 1.14 間隙要求 1 mm＋剪刀裁切公差 0.5 mm（推估） */
export const ARCH_CUT_MARGIN_mm = 1.5;

/** 細分跨越切口的三角形，最多幾層（每層邊長減半） */
const MAX_DEPTH = 5;
/** 邊長小於這個值就不再細分（mm） */
const MIN_EDGE_mm = 0.25;

/**
 * 點在切除區內時回傳推到切口面上的位置；不在區內回傳 null
 * 切口面 = 輪胎外徑 + 間距的圓柱面，或輪胎側面 + 間距的平面，取移動距離較短的一側
 * @type {(p: THREE.Vector3, zones: ArchWheel[], margin: number) => THREE.Vector3 | null}
 */
const pushOut = (p, zones, margin) => {
  for (const w of zones) {
    const dx = p.x - w.x;
    const dy = p.y - w.y;
    const radial = Math.hypot(dx, dy);
    const along = p.z - w.z;
    const R = w.r + margin;
    const H = w.width / 2 + margin;
    if (radial >= R || Math.abs(along) >= H) {
      continue;
    }
    const out = p.clone();
    if (R - radial <= H - Math.abs(along)) {
      // 圓柱面：沿徑向推出（點剛好在軸上時往上推）
      const ux = radial > 1e-9 ? dx / radial : 0;
      const uy = radial > 1e-9 ? dy / radial : 1;
      out.x = w.x + ux * R;
      out.y = w.y + uy * R;
    } else {
      out.z = w.z + Math.sign(along || 1) * H;
    }
    return out;
  }
  return null;
};

/** @type {(p: THREE.Vector3, zones: ArchWheel[], margin: number) => boolean} */
const inside = (p, zones, margin) => pushOut(p, zones, margin) !== null;

/**
 * 薄殼／裝飾面：跨越切口的三角形遞迴細分，重心在區內的刪掉，留下的三角形把區內頂點推到切口面（切口邊緣貼齊輪拱）
 * 所有頂點屬性（法向、UV、頂點色）線性內插
 * @type {(geo: THREE.BufferGeometry, toRoot: THREE.Matrix4, zones: ArchWheel[], margin: number) => { geometry: THREE.BufferGeometry, removedArea_mm2: number }}
 */
const cutSurface = (geo, toRoot, zones, margin) => {
  const src = geo.index ? geo.toNonIndexed() : geo;
  const names = Object.keys(src.attributes);
  const fromRoot = toRoot.clone().invert();
  /** @type {Record<string, number[]>} */
  const out = Object.fromEntries(names.map((n) => [n, []]));
  /** @type {(i: number) => Record<string, number[]>} 第 i 個頂點的所有屬性 */
  const vertexOf = (i) => Object.fromEntries(names.map((n) => {
    const a = src.attributes[n];
    return [n, Array.from({ length: a.itemSize }, (_, k) => a.array[i * a.itemSize + k])];
  }));
  /** @type {(a: Record<string, number[]>, b: Record<string, number[]>) => Record<string, number[]>} */
  const mid = (a, b) => Object.fromEntries(names.map((n) => [n, a[n].map((x, k) => (x + b[n][k]) / 2)]));
  /** @type {(v: Record<string, number[]>) => THREE.Vector3} */
  const rootPos = (v) => new THREE.Vector3(...v.position).applyMatrix4(toRoot);
  let removedArea = 0;
  /** @type {(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => number} */
  const areaOf = (a, b, c) => new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).length() / 2;
  /** @type {(v: Record<string, number[]>[], depth: number) => void} */
  const visit = (v, depth) => {
    const p = v.map(rootPos);
    const m = [mid(v[0], v[1]), mid(v[1], v[2]), mid(v[2], v[0])];
    const pm = m.map(rootPos);
    const centroid = p[0].clone().add(p[1]).add(p[2]).divideScalar(3);
    const states = [...p, ...pm, centroid].map((q) => inside(q, zones, margin));
    const mixed = states.some((s) => s !== states[0]);
    const edge = Math.max(p[0].distanceTo(p[1]), p[1].distanceTo(p[2]), p[2].distanceTo(p[0]));
    if (mixed && depth < MAX_DEPTH && edge > MIN_EDGE_mm) {
      visit([v[0], m[0], m[2]], depth + 1);
      visit([m[0], v[1], m[1]], depth + 1);
      visit([m[2], m[1], v[2]], depth + 1);
      visit([m[0], m[1], m[2]], depth + 1);
      return;
    }
    if (inside(centroid, zones, margin)) {
      removedArea += areaOf(p[0], p[1], p[2]);
      return;
    }
    v.forEach((vert, k) => {
      const pushed = pushOut(p[k], zones, margin);
      for (const n of names) {
        if (n === 'position' && pushed) {
          out[n].push(...pushed.clone().applyMatrix4(fromRoot).toArray());
        } else {
          out[n].push(...vert[n]);
        }
      }
    });
  };
  // 多材質群組：逐群組處理，重建每個群組的頂點範圍（非索引幾何的群組範圍就是頂點範圍）
  const groups = src.groups.length > 0 ? src.groups : [{ start: 0, count: src.attributes.position.count, materialIndex: 0 }];
  /** @type {{ start: number, count: number, materialIndex: number }[]} */
  const newGroups = [];
  for (const grp of groups) {
    const start = out.position.length / 3;
    for (let t = grp.start / 3; t < (grp.start + grp.count) / 3; t++) {
      visit([vertexOf(3 * t), vertexOf(3 * t + 1), vertexOf(3 * t + 2)], 0);
    }
    newGroups.push({ start, count: out.position.length / 3 - start, materialIndex: grp.materialIndex ?? 0 });
  }
  const g = new THREE.BufferGeometry();
  if (src.groups.length > 0) {
    newGroups.forEach((grp) => g.addGroup(grp.start, grp.count, grp.materialIndex));
  }
  for (const n of names) {
    const a = src.attributes[n];
    g.setAttribute(n, new THREE.BufferAttribute(new (a.array.constructor)(out[n]), a.itemSize, a.normalized));
  }
  return { geometry: g, removedArea_mm2: removedArea };
};

/**
 * 實體件（封閉網格）：只把區內頂點推到切口面，不刪三角形 → 網格維持封閉，封閉體積積分（質量、慣性）自然扣掉切掉的部分
 * 整件都在區內時所有頂點落在切口面上，體積趨近 0
 * @type {(geo: THREE.BufferGeometry, toRoot: THREE.Matrix4, zones: ArchWheel[], margin: number) => THREE.BufferGeometry}
 */
const cutSolid = (geo, toRoot, zones, margin) => {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  const pos = g.attributes.position;
  const nrm = g.attributes.normal;
  const fromRoot = toRoot.clone().invert();
  const p = new THREE.Vector3();
  /** @type {boolean[]} */
  const moved = [];
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).applyMatrix4(toRoot);
    const pushed = pushOut(p, zones, margin);
    moved.push(!!pushed);
    if (pushed) {
      pushed.applyMatrix4(fromRoot);
      pos.setXYZ(i, pushed.x, pushed.y, pushed.z);
    }
  }
  // 被削到的三角形改用面法向（原本的平滑法向對應的是削之前的曲面，會出現皺褶反光）
  if (nrm) {
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    for (let t = 0; t < pos.count / 3; t++) {
      if (!moved[3 * t] && !moved[3 * t + 1] && !moved[3 * t + 2]) {
        continue;
      }
      a.fromBufferAttribute(pos, 3 * t);
      b.fromBufferAttribute(pos, 3 * t + 1);
      c.fromBufferAttribute(pos, 3 * t + 2);
      const n = b.sub(a).cross(c.sub(a));
      if (n.lengthSq() < 1e-20) {
        continue;
      }
      n.normalize();
      for (let k = 0; k < 3; k++) {
        nrm.setXYZ(3 * t + k, n.x, n.y, n.z);
      }
    }
  }
  return g;
};

/** @type {(obj: THREE.Object3D) => boolean} 物件自己或祖先標為實體件 */
const isSolid = (obj) => {
  for (let o = obj; o; o = o.parent) {
    if (o.userData?.solid) {
      return true;
    }
  }
  return false;
};

/** @type {Map<string, BodyDef>} 同一組切口只建一次（下游的質量、碰撞、輪廓快取以 id 或物件為鍵） */
const derived = new Map();

/**
 * 回傳切過輪拱的車殼定義（id = 原 id + '#arch-' + 切口參數）；所有下游計算（質量、慣性、碰撞方塊、正面投影、外觀）都從新的 build() 來
 * @type {(body: BodyDef, wheels: ArchWheel[], margin?: number) => BodyDef & { archCut: { baseId: string, margin_mm: number, wheels: ArchWheel[] } }}
 */
export const archCutBody = (body, wheels, margin = ARCH_CUT_MARGIN_mm) => {
  const key = `${body.id}#arch-${wheels.map((w) => [w.x, w.y, w.z, w.r, w.width].map((x) => +x.toFixed(3)).join(',')).join(';')}@${margin}`;
  const hit = derived.get(key);
  if (hit) {
    return /** @type {any} */ (hit);
  }
  /** @type {{ geometries: THREE.BufferGeometry[], removed: number } | null} */
  let cached = null;
  const def = {
    ...body,
    id: key,
    archCut: { baseId: body.id, margin_mm: margin, wheels },
    src: { ...body.src, archCut: `切輪拱（B15）：輪胎圓柱外加 ${margin} mm 以內的殼面剪掉、實體件削到切口面；依據公認規則（注1）與ストッククラス 4.「パーツに干渉する部分のカット」。間距 1.5 mm 為推估` },
    build: (/** @type {Record<string, unknown>} */ mats) => {
      const g = body.build(mats);
      g.updateMatrixWorld(true);
      /** @type {THREE.Mesh[]} */
      const meshes = [];
      g.traverse((o) => { if (/** @type {any} */ (o).isMesh) meshes.push(/** @type {THREE.Mesh} */ (o)); });
      // 切割只跟幾何有關（材質不影響）：第一次切完快取，之後的 build 只複製幾何（單次切割約 1 秒，網頁換件不能每次重算）
      if (!cached) {
        const rootInv = g.matrixWorld.clone().invert();
        let removed = 0;
        const geometries = meshes.map((mesh) => {
          const toRoot = rootInv.clone().multiply(mesh.matrixWorld);
          if (isSolid(mesh)) {
            return cutSolid(mesh.geometry, toRoot, wheels, margin);
          }
          const r = cutSurface(mesh.geometry, toRoot, wheels, margin);
          removed += r.removedArea_mm2;
          return r.geometry;
        });
        cached = { geometries, removed };
      }
      meshes.forEach((mesh, i) => { mesh.geometry = cached.geometries[i].clone(); });
      g.userData.archCut = { baseId: body.id, removedSurfaceArea_mm2: cached.removed };
      return g;
    },
  };
  derived.set(key, def);
  return def;
};
