// Three.js 程序化模型：中置雙軸馬達底盤的 1/32 迷你四驅車（底盤＋可換車殼）＋賽道
// 單位 mm；車體座標 x 向前、y 向上、z 向右，原點在前後軸中點的地面上
// 第二階段：所有尺寸來自組裝結果（assembly.js 的 asm.spec，由零件資料組成）與 carLayout.js（與物理共用）
import * as THREE from 'three';
import { spec as globalSpec } from './spec.js';
import { rollerLayout, wheelLayout, componentLayout } from './carLayout.js';
import { assemble, loadConfig } from './assembly.js';
import { getPart } from './parts/index.js';

/** 車殼卡榫與開關位置（底盤座標，取自底盤零件資料） */
const BODY_MOUNTS = getPart('chassis-midship').bodyMounts;
const SWITCH_POS = getPart('chassis-midship').switchPos_mm;

/**
 * 建模期間使用的整車規格（buildCarModel 開頭設為 asm.spec；建模是同步的，模組內的函式共用這一份）
 * @type {any}
 */
let spec = null;

/** 橡膠表面雜訊貼圖（DataTexture，Node 測試環境也能建立；用固定種子的 LCG，結果可重現） */
function rubberNoiseTexture() {
  const w = 256;
  const h = 32;
  const data = new Uint8Array(w * h * 4);
  let seed = 12345;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  for (let k = 0; k < w * h; k++) {
    const v = Math.round(150 + 105 * rand());
    data[k * 4] = v;
    data[k * 4 + 1] = v;
    data[k * 4 + 2] = v;
    data[k * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/**
 * 輪胎側壁材質（iter-07）：1024² canvas，以 RingGeometry 的平面 UV 對應（中心 = 貼圖中心，貼圖半邊 = 外半徑）。
 * 內容：放射狀細肋紋（內外兩圈）＋沿圓周的凸起字樣；同一張灰階圖當 bumpMap
 * 字樣為通用尺寸標示（iter-32 起不放廠商名稱）
 */
function tireSidewallMaterial() {
  // Node（vitest）沒有 DOM：只回傳素色材質，P09 外框量測用的幾何不變
  if (typeof document === 'undefined') {
    return new THREE.MeshStandardMaterial({ color: 0x1e1e20, roughness: 0.9 });
  }
  const size = 1024;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext('2d');
  const c = size / 2;
  // 外半徑對應 c；內半徑比例 = rr / wallOuter
  const R = spec.tire.diameter_mm / 2;
  const rr = spec.tire.rimDiameter_mm / 2;
  const wallOuter = rr + 0.55 * (R - rr);
  const rIn = (rr / wallOuter) * c;
  ctx.fillStyle = '#1e1e20';
  ctx.fillRect(0, 0, size, size);
  // 內圈與外圈細肋紋（放射短線）
  ctx.strokeStyle = '#2f2f33';
  ctx.lineWidth = 3;
  const ribs = 180;
  for (let i = 0; i < ribs; i++) {
    const a = (i / ribs) * Math.PI * 2;
    for (const [r0, r1] of [[rIn + 4, rIn + 22], [c - 26, c - 6]]) {
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0);
      ctx.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1);
      ctx.stroke();
    }
  }
  // 兩條細環線分隔肋紋與字樣帶
  ctx.lineWidth = 2;
  for (const r of [rIn + 26, c - 30]) {
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  // 沿圓周字樣（兩組對稱）：字底朝內、由外側看為正向
  const rText = (rIn + 26 + c - 30) / 2;
  ctx.fillStyle = '#46464c';
  ctx.font = 'bold 34px Arial, Helvetica, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // iter-32：側壁字樣改成通用尺寸標示（不放任何廠商名稱），依輪胎零件尺寸產生
  const label = `${spec.tire.diameter_mm}mm  LOW PROFILE  ${spec.tire.width_mm}mm`;
  for (const start of [-Math.PI / 2, Math.PI / 2]) {
    const step = 0.052;
    const a0 = start - ((label.length - 1) * step) / 2;
    for (let i = 0; i < label.length; i++) {
      const a = a0 + i * step;
      ctx.save();
      ctx.translate(c + Math.cos(a) * rText, c + Math.sin(a) * rText);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillText(label[i], 0, 0);
      ctx.restore();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const bump = new THREE.CanvasTexture(cv);
  bump.anisotropy = 8;
  return new THREE.MeshStandardMaterial({ map: tex, bumpMap: bump, bumpScale: 1.2, roughness: 0.9, metalness: 0.0, envMapIntensity: 0.6, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
}

/** 建立材質集合 */
function makeMaterials() {
  return {
    // iter-06：黑塑膠與橡膠胎粗糙度區分——底盤 ABS 半光（roughness 0.4＋薄清漆，邊緣有亮線），
    // 深色內層件平光（0.75），輪胎橡膠全霧（0.96，見 tire）
    chassis: new THREE.MeshPhysicalMaterial({ color: 0x34373d, roughness: 0.4, metalness: 0.05, clearcoat: 0.3, clearcoatRoughness: 0.35 }),
    chassisDark: new THREE.MeshStandardMaterial({ color: 0x212226, roughness: 0.75, metalness: 0.0 }),
    body: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.35, clearcoat: 1.0, clearcoatRoughness: 0.08 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x15181d, roughness: 0.05, metalness: 0.2, clearcoat: 1.0 }),
    // iter-03：輪胎橡膠粗糙感（程序化雜訊 bump＋roughness 貼圖），顏色由死黑提亮到深炭灰
    tire: new THREE.MeshStandardMaterial({ color: 0x232325, roughness: 0.96, metalness: 0.0, bumpMap: rubberNoiseTexture(), bumpScale: 0.6, roughnessMap: rubberNoiseTexture(), envMapIntensity: 0.6 }),
    tireTread: new THREE.MeshStandardMaterial({ color: 0x161617, roughness: 0.97, metalness: 0.0 }),
    // 輪框：ref_chevalier-ma_wheel-detail 為淺灰緞面塑膠（帶些許金屬粉），不是鍍鉻
    rim: new THREE.MeshPhysicalMaterial({ color: 0xa4a9b0, roughness: 0.42, metalness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.3 }),
    // iter-07：輪輻金屬灰漸層——頂點色依半徑由輪轂（深槍灰）→ 輪框（亮銀灰），金屬度提高（ref_chevalier-ma_wheel-detail 輪輻內側較暗）
    rimSpoke: new THREE.MeshPhysicalMaterial({ color: 0xb4b9c0, vertexColors: true, roughness: 0.34, metalness: 0.7, clearcoat: 0.35, clearcoatRoughness: 0.3 }),
    // iter-07：輪框內筒（輪輻後方）深灰，增加輪框層次
    rimBarrel: new THREE.MeshStandardMaterial({ color: 0x4a4e55, roughness: 0.5, metalness: 0.6 }),
    // iter-07：輪胎外側壁（程序化貼圖：細肋紋＋凸起字樣，同一張圖兼作 bump）
    tireWall: tireSidewallMaterial(),
    // iter-10：罐身改亮銀髮絲面（roughness 0.25 → 0.34）——0.25 時底面平面反射到深色檯面，罐身讀成深灰
    motorCan: new THREE.MeshStandardMaterial({ color: 0xd4d8de, roughness: 0.34, metalness: 0.85 }),
    motorCap: new THREE.MeshStandardMaterial({ color: 0xe8e2d0, roughness: 0.6 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.3, metalness: 0.95 }),
    pinion: new THREE.MeshStandardMaterial({ color: 0x8a4fd0, roughness: 0.5 }),
    counter: new THREE.MeshStandardMaterial({ color: 0x8be03a, roughness: 0.5 }),
    spur: new THREE.MeshStandardMaterial({ color: 0xf08aa0, roughness: 0.5 }),
    battery: new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.4, metalness: 0.3 }),
    copper: new THREE.MeshStandardMaterial({ color: 0xc8874a, roughness: 0.3, metalness: 0.9 }),
    // iter-06：導輪改槍灰色半光塑膠（ref_ma-chassis），與底盤黑塑膠區分
    roller: new THREE.MeshPhysicalMaterial({ color: 0x4a4e55, roughness: 0.34, metalness: 0.25, clearcoat: 0.4, clearcoatRoughness: 0.25, side: THREE.DoubleSide }),
    // iter-14：導輪本體改黑色塑膠（ref side-high／front34／ma-chassis 素組為黑色塑膠導輪；reviewer「導輪雙層灰色視覺份量重」）；
    //   尺寸 13 mm 為 SPEC 不改。只換導輪本體，電池艙倒角條等沿用 roller 的部件不動
    rollerBody: new THREE.MeshPhysicalMaterial({ color: 0x0e0f12, roughness: 0.38, metalness: 0.0, clearcoat: 0.35, clearcoatRoughness: 0.3, side: THREE.DoubleSide }),
    screw: new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.25, metalness: 1.0 }),
    light: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x99aabb, emissiveIntensity: 0.3, roughness: 0.2 }),
  };
}

/** 以俯視輪廓擠出板件（shape 在 x-z 平面，y 方向厚度） */
function extrudeXZ(points, thickness, material, holes = []) {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const h of holes) {
    shape.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))));
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 12 });
  // ExtrudeGeometry 沿 +z 擠出：轉成沿 +y
  geo.rotateX(-Math.PI / 2);
  return new THREE.Mesh(geo, material);
}

/** 圓角矩形俯視輪廓 */
function roundedRect(cx, cz, lx, lz, r, seg = 6) {
  const pts = [];
  const hx = lx / 2 - r;
  const hz = lz / 2 - r;
  const corners = [
    [hx, hz, 0],
    [-hx, hz, Math.PI / 2],
    [-hx, -hz, Math.PI],
    [hx, -hz, (3 * Math.PI) / 2],
  ];
  for (const [x, z, a0] of corners) {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * (Math.PI / 2);
      pts.push([cx + x + Math.cos(a) * r, cz + z + Math.sin(a) * r]);
    }
  }
  return pts;
}

/** 輪子：low profile 輪胎（Lathe）＋ Y 字幅輪框 */
function buildWheel(mats, side) {
  const g = new THREE.Group();
  const R = spec.tire.diameter_mm / 2;
  const w = spec.tire.width_mm;
  const rr = spec.tire.rimDiameter_mm / 2;
  // 輪胎截面（繞 y 軸旋轉後再轉到 z 軸）
  const prof = [];
  const n = 72;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const y = -w / 2 + t * w;
    // 胎面略帶圓角（胎肩）＋三條圓周溝槽（橡膠胎紋，深 0.3 mm）
    const edge = Math.min(t, 1 - t);
    let r = rr + (R - rr) * Math.min(1, 0.55 + edge * 4.5);
    for (const tc of [0.3, 0.5, 0.7]) {
      r -= 0.3 * Math.exp(-(((t - tc) / 0.022) ** 2));
    }
    prof.push(new THREE.Vector2(r, y));
  }
  prof.push(new THREE.Vector2(rr, w / 2));
  prof.unshift(new THREE.Vector2(rr, -w / 2));
  const tireGeo = new THREE.LatheGeometry(prof, 64);
  tireGeo.rotateX(Math.PI / 2);
  g.add(new THREE.Mesh(tireGeo, mats.tire));

  // 輪框：外圈＋5 組 Y 字幅條
  const rimRing = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, w * 0.9, 40, 1, true), mats.rimBarrel);
  rimRing.rotation.x = Math.PI / 2;
  g.add(rimRing);
  const face = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 1.6, 20), mats.rim);
  hub.rotation.x = Math.PI / 2;
  face.add(hub);
  // 中央圓頂輪轂蓋
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.3, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mats.rim);
  dome.rotation.x = side * Math.PI / 2;
  dome.scale.set(1, 0.6, 1);
  dome.position.z = side * 0.8;
  face.add(dome);
  // iter-03：彎曲 Y 字分岔輪輻（ref_chevalier-ma_wheel-detail：5 組輻條，每組在中段分岔成兩支往同一方向彎曲的臂）
  // 每支臂沿二次曲線中心線取樣、左右各偏移半寬，組成多邊形後擠出 1.2 mm
  /** @type {(p0: number[], p1: number[], p2: number[], w0: number, w1: number) => THREE.Mesh} 彎曲臂（二次 Bézier 中心線，寬度 w0 → w1） */
  const curvedArm = (p0, p1, p2, w0, w1) => {
    const n = 12;
    const left = [];
    const right = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0];
      const y = (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1];
      const dx = 2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]);
      const dy = 2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
      const L = Math.hypot(dx, dy);
      const hw = (w0 + (w1 - w0) * t) / 2;
      left.push(new THREE.Vector2(x - (dy / L) * hw, y + (dx / L) * hw));
      right.push(new THREE.Vector2(x + (dy / L) * hw, y - (dx / L) * hw));
    }
    const shape = new THREE.Shape([...left, ...right.reverse()]);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 1.2, bevelEnabled: false, curveSegments: 4 });
    geo.translate(0, 0, -0.6);
    // 頂點色：半徑 2 mm（輪轂）0.55 → 輪框內緣 1.0
    const pos = geo.attributes.position;
    const col = [];
    for (let i = 0; i < pos.count; i++) {
      const k = Math.min(1, Math.max(0, (Math.hypot(pos.getX(i), pos.getY(i)) - 2) / (rr - 2.5)));
      const v = 0.55 + 0.45 * k;
      col.push(v, v, v);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return new THREE.Mesh(geo, mats.rimSpoke);
  };
  const rimIn = rr - 0.5;
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    const spoke = new THREE.Group();
    // 主幹（輪轂 → 分岔點）
    spoke.add(curvedArm([2.2, 0], [3.6, 0.15 * side], [4.9, 0.35 * side], 2.3, 1.9));
    // 兩支分岔臂：同向彎曲（twist），外端在輪框內緣
    for (const sgn of [-1, 1]) {
      const ang = sgn * 0.36 + 0.16 * side;
      spoke.add(curvedArm([4.7, 0.35 * side], [6.9, sgn * 1.0 + 0.9 * side], [Math.cos(ang) * rimIn, Math.sin(ang) * rimIn], 1.25, 1.0));
    }
    spoke.rotation.z = a;
    face.add(spoke);
  }
  // 輪框外緣凸緣（面向外側的金屬唇邊）
  const flange = new THREE.Mesh(new THREE.TorusGeometry(rr - 0.35, 0.45, 8, 40), mats.rim);
  flange.position.z = side * 0.6;
  face.add(flange);
  face.position.z = side * (w * 0.32);
  g.add(face);
  // iter-07：外側壁貼片（胎壁平面 r = rr … rr + 0.55 (R − rr)，略浮 0.06 mm）
  const wallOuter = rr + 0.55 * (R - rr);
  const wall = new THREE.Mesh(new THREE.RingGeometry(rr + 0.05, wallOuter - 0.05, 96, 1), mats.tireWall);
  wall.position.z = side * (w / 2 + 0.06);
  wall.rotation.y = side > 0 ? 0 : Math.PI;
  wall.userData.wallOuter = wallOuter;
  g.add(wall);
  const back = new THREE.Mesh(new THREE.CircleGeometry(rr, 32), mats.chassisDark);
  back.position.z = -side * (w * 0.2);
  back.rotation.y = side > 0 ? 0 : Math.PI;
  g.add(back);
  return g;
}

/**
 * 俯視為長條的臂板（兩點之間、寬 w、厚 th），沿中心線開 nHoles 個圓孔（iter-05）
 * @type {(x0: number, z0: number, x1: number, z1: number, w: number, th: number, y: number, nHoles: number, mat: THREE.Material) => THREE.Mesh}
 */
const armPlate = (x0, z0, x1, z1, w, th, y, nHoles, mat) => {
  const L = Math.hypot(x1 - x0, z1 - z0);
  const nx = (-(z1 - z0) / L) * (w / 2);
  const nz = ((x1 - x0) / L) * (w / 2);
  const outline = [
    [x0 + nx, z0 + nz],
    [x1 + nx, z1 + nz],
    [x1 - nx, z1 - nz],
    [x0 - nx, z0 - nz],
  ];
  const holes = [];
  for (let k = 0; k < nHoles; k++) {
    const f = 0.28 + (0.44 * k) / Math.max(1, nHoles - 1);
    holes.push(circlePts(x0 + (x1 - x0) * f, z0 + (z1 - z0) * f, Math.min(1.25, w * 0.2), 14));
  }
  const m = extrudeXZ(outline, th, mat, holes);
  m.position.y = y;
  return m;
};

/**
 * 兩個 3D 點之間的方樑（斜臂用）
 * @type {(a: THREE.Vector3, b: THREE.Vector3, w: number, h: number, mat: THREE.Material) => THREE.Mesh}
 */
const beam3d = (a, b, w, h, mat) => {
  const dir = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.BoxGeometry(dir.length(), h, w), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.normalize());
  return m;
};

/**
 * 十字頭螺絲頭（半球扁頭＋十字槽），頭頂朝 +y
 * @type {(mats: ReturnType<typeof makeMaterials>, x: number, y: number, z: number, r: number) => THREE.Group}
 */
const screwHead = (mats, x, y, z, r) => {
  const s = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), mats.screw);
  head.scale.y = 0.45;
  s.add(head);
  for (const rot of [0, Math.PI / 2]) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(r * 1.3, 0.3, r * 0.22), mats.chassisDark);
    slot.position.y = r * 0.42;
    slot.rotation.y = rot;
    s.add(slot);
  }
  s.position.set(x, y, z);
  return s;
};

/**
 * 後方上層導輪架（iter-05 重做；ref rear34 / ma-chassis）：
 * 中央板（長圓孔＋2 顆螺絲）＋兩支斜伸到上層導輪的臂（減重孔、兩側立起邊框）＋導輪座凸台，
 * 中央以開孔立板連到下層保桿，兩側各 2 支斜臂（I 字斷面）由下層導輪臂斜上撐到上層臂
 * @type {(mats: ReturnType<typeof makeMaterials>, rx: number, rz: number, yLow: number, yUp: number) => THREE.Group}
 */
const buildRearStay = (mats, rx, rz, yLow, yUp) => {
  const g = new THREE.Group();
  const th = 2.0;
  const mat = mats.chassis;
  // 中央板
  const center = extrudeXZ(roundedRect(-66.5, 0, 13, 26, 3), th, mat, [
    roundedRect(-66.5, 0, 4.5, 10, 2),
    circlePts(-66.5, -9, 1.0, 12),
    circlePts(-66.5, 9, 1.0, 12),
  ]);
  center.position.y = yUp;
  g.add(center);
  for (const sz of [-1, 1]) {
    g.add(screwHead(mats, -66.5, yUp + th, sz * 9, 1.7));
    // 斜伸臂（中央板 → 上層導輪）
    const x0 = -63;
    const z0 = sz * 10;
    const x1 = -rx;
    const z1 = sz * rz;
    g.add(armPlate(x0, z0, x1, z1, 6, th, yUp, 2, mat));
    const L = Math.hypot(x1 - x0, z1 - z0);
    const nx = -(z1 - z0) / L;
    const nz = (x1 - x0) / L;
    for (const off of [-2.5, 2.5]) {
      const a = new THREE.Vector3(x0 + nx * off, yUp + th + 0.6, z0 + nz * off);
      const b = new THREE.Vector3(x1 + nx * off, yUp + th + 0.6, z1 + nz * off);
      g.add(beam3d(a, b, 1.0, 1.2, mat));
    }
    // 上層導輪座凸台
    const boss = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.3, th + 0.8, 24), mat);
    boss.position.set(x1, yUp + (th + 0.8) / 2 - 0.4, z1);
    g.add(boss);
    // 斜臂：下層導輪臂（靠導輪處與中段）斜上撐到上層臂
    for (const f of [0.45, 0.8]) {
      const lx = -54 + (-rx + 54) * f;
      const lz = sz * (16 + (rz - 16) * f);
      const ux = x0 + (x1 - x0) * (f + 0.08);
      const uz = z0 + (z1 - z0) * (f + 0.08);
      g.add(beam3d(new THREE.Vector3(lx, yLow, lz), new THREE.Vector3(ux, yUp + 0.2, uz), 1.4, 1.8, mat));
    }
  }
  // 中央開孔立板（下層保桿橋接板 → 上層中央板）
  const wallShape = new THREE.Shape([
    new THREE.Vector2(-12, yLow - 0.2),
    new THREE.Vector2(12, yLow - 0.2),
    new THREE.Vector2(10, yUp + 0.2),
    new THREE.Vector2(-10, yUp + 0.2),
  ]);
  const mid = (yLow + yUp) / 2;
  for (const hz of [-6, 6]) {
    wallShape.holes.push(new THREE.Path(circlePts(hz, mid, 1.3, 14).map(([a, b]) => new THREE.Vector2(a, b))));
  }
  const wallGeo = new THREE.ExtrudeGeometry(wallShape, { depth: 1.8, bevelEnabled: false, curveSegments: 12 });
  // 形狀在 (z, y) 平面：擠出方向（局部 z）轉到 x
  wallGeo.rotateY(Math.PI / 2);
  const wall = new THREE.Mesh(wallGeo, mat);
  wall.position.x = -rx + 1;
  g.add(wall);
  return g;
};

/** 以 x-y 平面輪廓擠出板件（沿 +z 方向厚度） */
function extrudeXY(points, thickness, material, holes = []) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) {
    shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 12 });
  return new THREE.Mesh(geo, material);
}

/** 圓形輪廓點列（逆時針） */
function circlePts(cx, cy, r, n = 16) {
  return Array.from({ length: n }, (_, k) => [cx + r * Math.cos((k / n) * Math.PI * 2), cy + r * Math.sin((k / n) * Math.PI * 2)]);
}

/**
 * 正齒輪：梯形齒＋中心軸孔＋輪轂（擠出方向沿局部 z，中心在原點）
 * @param {number} radius 齒頂半徑
 * @param {number} teeth 齒數
 * @param {number} width 齒寬
 * @param {THREE.Material} material
 */
function gear(radius, teeth, width, material) {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  const root = radius - Math.max(0.5, radius * 0.11);
  const n = teeth;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const p = Math.PI * 2 / n;
    // 齒根 → 齒側 → 齒頂（寬約 35% 節距）→ 齒側 → 齒根
    const pts = [
      [root, a],
      [radius, a + p * 0.18],
      [radius, a + p * 0.48],
      [root, a + p * 0.66],
    ];
    for (const [r, ang] of pts) {
      const x = Math.cos(ang) * r;
      const y = Math.sin(ang) * r;
      if (i === 0 && r === root && ang === a) {
        shape.moveTo(x, y);
      } else {
        shape.lineTo(x, y);
      }
    }
  }
  shape.closePath();
  shape.holes.push(new THREE.Path(circlePts(0, 0, 1.0, 12).reverse().map(([x, y]) => new THREE.Vector2(x, y))));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
  geo.translate(0, 0, -width / 2);
  g.add(new THREE.Mesh(geo, material));
  // 輪轂（兩側凸出）
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(2.2, radius * 0.45), Math.min(2.2, radius * 0.45), width + 1.0, 18, 1, true), material);
  hub.rotation.x = Math.PI / 2;
  g.add(hub);
  return g;
}

/** 冠狀齒（中間齒輪大齒的端面齒，齒朝 +z），回傳一圈小齒塊 */
function crownTeeth(radius, teeth, depth, material) {
  const g = new THREE.Group();
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(1.1, (Math.PI * 2 * radius) / teeth * 0.5, depth), material);
    tooth.position.set(Math.cos(a) * (radius - 0.55), Math.sin(a) * (radius - 0.55), depth / 2);
    tooth.rotation.z = a;
    g.add(tooth);
  }
  return g;
}

/**
 * MA 齒輪列配置（依 ref_ma-chassis_tamiya.jpg：馬達軸兩端紫色小齒輪 → 綠色中間齒輪 → 粉紅輪軸齒輪）
 * 中間齒輪軸與輪軸平行（沿 z）；中間齒輪大齒為冠狀齒，與馬達軸上的小齒輪直角嚙合；
 * 中間齒輪小齒與輪軸齒輪嚙合，中心距 = 5.6 + 7.5 mm（config/spec.json drivetrain 節圓半徑）
 */
function gearTrainLayout() {
  const d = spec.drivetrain;
  const motorY = componentLayout(spec).motor.y;
  // 底盤座標：輪軸高度 = 參考輪半徑（實際輪徑造成的升降由 buildCarModel 的 lift 處理）
  const axleY = spec.chassis.refWheelDiameter_mm / 2;
  const hw = spec.chassis.wheelbase_mm / 2;
  const centerDist = d.counterSmallPitchRadius_mm + d.spurPitchRadius_mm;
  const counterX = hw - Math.sqrt(centerDist * centerDist - (axleY - motorY) ** 2);
  return {
    motorY,
    axleY,
    counterX,
    counterY: motorY,
    pinionX: counterX - d.counterLargePitchRadius_mm,
    crownZ: -d.pinionPitchRadius_mm,
  };
}

/**
 * 導輪（iter-06 重做；ref_ma-chassis：槍灰色導輪，上下輪緣凸出、中段內縮，頂面內凹看得到培林）：
 * Lathe 截面＝上下輪緣（含倒角）＋中段腰身＋頂底面內凹環；培林分外環（鋼，凸起）／黑色密封蓋（內凹）／內環（鋼）三層；
 * 導輪與臂之間有墊片間隙，頂部墊片＋十字頭螺絲，底部六角螺帽。物理接觸半徑不變（r.r）
 * @type {(mats: ReturnType<typeof makeMaterials>, r: { x: number, y: number, z: number, r: number, h: number }) => THREE.Group}
 */
const buildRoller = (mats, r) => {
  const g = new THREE.Group();
  const R = r.r;
  const H = r.h / 2;
  const recessR = R - 1.1;
  const brgR = 3.7;
  const recessDepth = 0.7;
  // 截面由頂面內緣 → 外緣 → 底面內緣（r, y）
  /** @type {number[][]} */
  const prof = [
    [brgR, H - recessDepth],
    [recessR, H - recessDepth],
    [recessR, H],
    [R - 0.35, H],
    [R, H - 0.35],
    [R, H - 1.05],
    [R - 0.55, H - 1.45],
    [R - 0.55, -H + 1.45],
    [R, -H + 1.05],
    [R, -H + 0.35],
    [R - 0.35, -H],
    [recessR, -H],
    [recessR, -H + recessDepth],
    [brgR, -H + recessDepth],
  ];
  const bodyGeo = new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a, b)).reverse(), 48);
  const body = new THREE.Mesh(bodyGeo, mats.rollerBody);
  g.add(body);
  for (const sy of [-1, 1]) {
    const faceRot = sy > 0 ? -Math.PI / 2 : Math.PI / 2;
    const floorY = sy * (H - recessDepth);
    // 培林外環：凸出內凹底面 0.45 mm 的鋼環（含外側壁）
    const outerWall = new THREE.Mesh(new THREE.CylinderGeometry(brgR, brgR, 0.45, 32, 1, true), mats.steel);
    outerWall.position.y = floorY + sy * 0.225;
    g.add(outerWall);
    const outer = new THREE.Mesh(new THREE.RingGeometry(2.95, brgR, 32), mats.steel);
    outer.rotation.x = faceRot;
    outer.position.y = floorY + sy * 0.45;
    g.add(outer);
    // 黑色密封蓋（比外環低 0.25 mm）＋內側壁
    const sealWall = new THREE.Mesh(new THREE.CylinderGeometry(2.95, 2.95, 0.25, 32, 1, true), mats.steel);
    sealWall.position.y = floorY + sy * 0.325;
    g.add(sealWall);
    const seal = new THREE.Mesh(new THREE.RingGeometry(1.95, 2.95, 32), mats.chassisDark);
    seal.rotation.x = faceRot;
    seal.position.y = floorY + sy * 0.2;
    g.add(seal);
    // 內環（與密封蓋同高再凸 0.15 mm）
    const innerWall = new THREE.Mesh(new THREE.CylinderGeometry(1.95, 1.95, 0.15, 24, 1, true), mats.steel);
    innerWall.position.y = floorY + sy * 0.275;
    g.add(innerWall);
    const inner = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.95, 24), mats.steel);
    inner.rotation.x = faceRot;
    inner.position.y = floorY + sy * 0.35;
    g.add(inner);
  }
  // 頂部墊片（離開導輪頂面 0.2 mm）＋十字頭螺絲
  const washer = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.4, 24), mats.steel);
  washer.position.y = H - recessDepth + 0.9;
  g.add(washer);
  const head = new THREE.Mesh(new THREE.SphereGeometry(2.0, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), mats.screw);
  head.scale.y = 0.5;
  head.position.y = H - recessDepth + 1.1;
  g.add(head);
  for (const rot of [0, Math.PI / 2]) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.5, 0.42), mats.chassisDark);
    slot.position.y = H - recessDepth + 2.0;
    slot.rotation.y = rot;
    g.add(slot);
  }
  // 底部墊片（導輪與臂板之間的間隙）＋六角螺帽＋螺絲尾端
  const spacer = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 0.9, 20), mats.steel);
  spacer.position.y = -H + recessDepth - 0.75;
  g.add(spacer);
  const nut = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 1.4, 6), mats.steel);
  nut.position.y = -H - 0.75;
  g.add(nut);
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.0, 10), mats.steel);
  tail.position.y = -H - 1.8;
  g.add(tail);
  g.position.set(r.x, r.y, r.z);
  return g;
};

/** 底盤：MA 一體式底盤、前後保桿、導輪架、雙軸馬達、齒輪列、電池、輪軸 */
function buildChassis(mats) {
  const g = new THREE.Group();
  const c = spec.chassis;
  const comp = componentLayout(spec);
  const gt = gearTrainLayout();
  const y0 = c.groundClearance_mm;
  const t = c.plateThickness_mm;
  const hw = c.wheelbase_mm / 2;
  const axleY = gt.axleY;

  // ---- 底板（MA 一體式底盤底面）----
  // 中央馬達窗、前後齒輪窗（從底面看得到馬達外殼、齒輪、輪軸）、兩側電池蓋開口、保桿側小孔
  // 所有底面細節都在底板下緣 y0（離地 2.2 mm，SPEC 1.2）之上，不影響離地高度
  const gearWin = (sx) => roundedRect(sx * (gt.counterX + 3), -3.5, 32, 19, 3);
  const openings = [
    // iter-10：馬達窗加寬到 27 × 21 mm（z 向涵蓋 130 罐身全寬 20.1 mm），從底面看到完整的罐身＋端蓋
    roundedRect(0, 0, 27, 21, 3),
    gearWin(-1),
    gearWin(1),
    roundedRect(0, 19, 48, 12, 2.5),
    roundedRect(0, -19, 48, 12, 2.5),
  ];
  // iter-06：前後段與齒輪箱旁的減重開孔（ref MA 底面多層：開孔後方看得到內層深色板）
  for (const sx of [-1, 1]) {
    openings.push(roundedRect(sx * 53.5, 0, 7, 9, 1.5));
    for (const sz of [-1, 1]) {
      openings.push([[sx * 50, sz * 7.5], [sx * 57.5, sz * 7.5], [sx * 57.5, sz * 19.5], [sx * 50, sz * 21]]);
    }
    openings.push(roundedRect(sx * 33, 15.5, 15, 5.5, 1.8));
    openings.push(roundedRect(sx * 34, -19.5, 13, 4.5, 1.5));
  }
  // 外形：馬達／電池段最寬（±29），前後輪之間縮到 ±24.5（輪胎內側 25.25 mm，避免與輪胎重疊）
  const outline = [[61, -22], [61, 22], [58, 24.5], [26, 24.5], [24, 29], [-24, 29], [-26, 24.5], [-58, 24.5], [-61, 22], [-61, -22], [-58, -24.5], [-26, -24.5], [-24, -29], [24, -29], [26, -24.5], [58, -24.5]];
  // iter-09：電池端子窗（電池蓋兩端，看得到銅片端子）
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      openings.push(roundedRect(sx * 25.9, sz * 19, 2.2, 6.4, 0.8));
    }
  }
  // iter-09：底板底面抬高 BOTTOM_RIB_H，底面改由「外緣框＋弧形肋條」構成最低面（仍在 y0 = 離地 2.2 mm，SPEC 1.2），
  // 肋條之間的板面內凹 → 底面讀起來是射出成型的肋格，而不是平板切方孔（reviewer iter-07/08 底盤項）
  const BOTTOM_RIB_H = 0.6;
  const plate = extrudeXZ(outline, t - BOTTOM_RIB_H, mats.chassis, openings);
  plate.position.y = y0 + BOTTOM_RIB_H;
  g.add(plate);
  {
    // 外緣框：外形輪廓往內 1.3 mm 的環（推估：MA 底面外緣有一圈加厚邊）
    const inset = [[59.7, -21.4], [59.7, 21.4], [57.5, 23.2], [25.2, 23.2], [23.2, 27.7], [-23.2, 27.7], [-25.2, 23.2], [-57.5, 23.2], [-59.7, 21.4], [-59.7, -21.4], [-57.5, -23.2], [-25.2, -23.2], [-23.2, -27.7], [23.2, -27.7], [25.2, -23.2], [57.5, -23.2]];
    const rim = extrudeXZ(outline, BOTTOM_RIB_H, mats.chassis, [inset]);
    rim.position.y = y0;
    g.add(rim);
    // 弧形肋條：前後段各兩道同心弧（弧頂朝保桿），跨過前後段減重孔時成為橋接肋
    /** @type {(cx: number, r: number, w: number, a0: number, a1: number) => THREE.Mesh} 俯視圓弧帶狀肋條 */
    const arcRib = (cx, r, w, a0, a1) => {
      const n = 28;
      const outer = [];
      const inner = [];
      for (let k = 0; k <= n; k++) {
        const a = a0 + ((a1 - a0) * k) / n;
        outer.push([cx + Math.cos(a) * (r + w / 2), Math.sin(a) * (r + w / 2)]);
        inner.push([cx + Math.cos(a) * (r - w / 2), Math.sin(a) * (r - w / 2)]);
      }
      const m = extrudeXZ([...outer, ...inner.reverse()], BOTTOM_RIB_H, mats.chassis);
      m.position.y = y0;
      return m;
    };
    for (const sx of [-1, 1]) {
      const base = sx > 0 ? 0 : Math.PI;
      for (const [r, span] of [[27, 0.66], [32.5, 0.5]]) {
        g.add(arcRib(sx * 24, r, 1.1, base - span, base + span));
      }
    }
    // 中央縱向肋（前後段之間，避開開孔，只在保桿根部）
    for (const sx of [-1, 1]) {
      const spine = new THREE.Mesh(new THREE.BoxGeometry(10, BOTTOM_RIB_H, 1.1), mats.chassis);
      spine.position.set(sx * 55.5, y0 + BOTTOM_RIB_H / 2, 0);
      g.add(spine);
    }
  }
  // iter-06：內層深色板（開孔上方 0.3 mm，從底面看成第二層），前後段與齒輪箱兩側各一片
  for (const sx of [-1, 1]) {
    const innerFront = extrudeXZ(roundedRect(sx * 54, 0, 11, 44, 2), 0.8, mats.chassisDark);
    innerFront.position.y = y0 + t + 0.3;
    g.add(innerFront);
    for (const [cx, cz, lx, lz] of [[33, 15.5, 18, 8], [34, -19.5, 16, 7]]) {
      const innerSide = extrudeXZ(roundedRect(sx * cx, cz, lx, lz, 2), 0.8, mats.chassisDark);
      innerSide.position.y = y0 + t + 0.3;
      g.add(innerSide);
    }
  }
  // 底板上方的補強肋（窗與窗之間的橫向肋、兩側縱向側框），從開口與側面都看得到
  for (const sx of [-1, 1]) {
    for (const dx of [15.5, 49]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.6, dx > 30 ? 46 : 50), mats.chassis);
      rib.position.set(sx * dx, y0 + t + 1.3, 0);
      g.add(rib);
    }
  }
  // 側框：底板外緣的立壁＋外側三角補強肋
  for (const sz of [-1, 1]) {
    // 側框頂到 y = 19.5 mm，從側面輪拱縫隙看不到中間齒輪頂部
    const railH = 19.5 - (y0 + t);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(100, railH, 1.8), mats.chassis);
    rail.position.set(0, y0 + t + railH / 2, sz * 23.6);
    g.add(rail);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(100, 1.2, 3.2), mats.chassis);
    lip.position.set(0, 19.0, sz * 23.0);
    g.add(lip);
    for (let k = -2; k <= 2; k++) {
      const gus = extrudeXY([[0, 0], [2.6, 0], [0, 8]], 1.0, mats.chassis);
      gus.rotation.y = sz > 0 ? -Math.PI / 2 : Math.PI / 2;
      gus.position.set(k * 11 + (sz > 0 ? 0.5 : -0.5), y0 + t, sz * 24.5);
      g.add(gus);
    }
  }
  // iter-09：電池蓋重做（ref MA 底面：獨立分件的電池蓋，周圍有凸緣、一端是弧形指扣肋與卡榫，兩端看得到銅片端子）
  for (const sz of [-1, 1]) {
    const cover = extrudeXZ(roundedRect(0, sz * 19, 47.4, 11.4, 2.3), 0.85, mats.chassisDark);
    cover.position.y = y0 + 0.2;
    g.add(cover);
    // 凸緣（電池蓋外圈）
    const lip = extrudeXZ(roundedRect(0, sz * 19, 47.4, 11.4, 2.3), 0.2, mats.chassis, [roundedRect(0, sz * 19, 45.6, 9.6, 1.6)]);
    lip.position.y = y0 + 0.02;
    g.add(lip);
    // 指扣：4 道同心弧形肋（弧頂朝電池蓋尾端）
    for (let k = 0; k < 4; k++) {
      const r = 3.2 + k * 1.15;
      const pts = [];
      const n = 16;
      for (let i = 0; i <= n; i++) {
        const a = Math.PI - 1.0 + (2.0 * i) / n;
        pts.push([-14.5 + Math.cos(a) * (r + 0.3), sz * 19 + Math.sin(a) * (r + 0.3)]);
      }
      for (let i = n; i >= 0; i--) {
        const a = Math.PI - 1.0 + (2.0 * i) / n;
        pts.push([-14.5 + Math.cos(a) * (r - 0.3), sz * 19 + Math.sin(a) * (r - 0.3)]);
      }
      const rib = extrudeXZ(pts, 0.18, mats.chassis);
      rib.position.y = y0 + 0.02;
      g.add(rib);
    }
    // 卡榫（電池蓋尾端的舌片＋凹口）
    const latch = extrudeXZ(roundedRect(-21.6, sz * 19, 3.2, 5.6, 1.2), 0.2, mats.chassis);
    latch.position.y = y0 + 0.02;
    g.add(latch);
    const notch = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 3.4), mats.chassisDark);
    notch.position.set(-21.6, y0 + 0.0, sz * 19);
    g.add(notch);
    // 電池方向標記（凸起的 + 與 −）
    for (const [mx, plus] of [[10, true], [17, false]]) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.45), mats.chassis);
      h.position.set(mx, y0 + 0.14, sz * 19);
      g.add(h);
      if (plus) {
        const v = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 2.2), mats.chassis);
        v.position.set(mx, y0 + 0.14, sz * 19);
        g.add(v);
      }
    }
    // 端子：端子窗內的銅片（電池兩端）＋窗內深色底
    for (const sx of [-1, 1]) {
      const term = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.35, 5.0), mats.copper);
      term.position.set(sx * 25.9, y0 + 1.0, sz * 19);
      g.add(term);
      const dimple = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.3, 12), mats.copper);
      dimple.position.set(sx * 25.9, y0 + 0.75, sz * 19);
      g.add(dimple);
    }
  }
  // iter-10：拿掉 iter-09 的馬達蓋（兩條散熱槽露出罐身，reviewer 說像兩根電池）；
  // 改成開放的馬達窗，窗兩端（z 向）各一顆固定螺絲，罐身與端蓋本體見下方「雙軸馬達」
  for (const sz of [-1, 1]) {
    g.add(screwHead(mats, 0, y0 + 0.5, sz * 12.0, 0.9).rotateX(Math.PI));
  }
  // ---- 齒輪箱蓋（iter-03；iter-06 改成大檢視窗）----
  // iter-06：reviewer「齒輪只見兩小窗綠色」→ 齒輪箱底蓋改為外框＋大開口（不再用煙燻片），
  // 從底面依序看得到紫色小齒輪 → 綠色中間齒輪 → 粉紅輪軸齒輪與輪軸；開口周圍有凸起的窗框（第二層）與固定螺絲
  for (const sx of [-1, 1]) {
    const cx = sx * (gt.counterX + 3);
    const winCx = sx * 30.25;
    const winCz = -4.5;
    const winHole = roundedRect(winCx, winCz, 27.5, 14, 2.5);
    const cover = extrudeXZ(roundedRect(cx, -3.5, 32.6, 19.6, 3), 1.2, mats.chassisDark, [winHole]);
    cover.position.y = y0 + 0.05;
    g.add(cover);
    // 窗框（比底蓋高一層的細框，從底面看是一圈內縮的邊）
    const frame = extrudeXZ(roundedRect(winCx, winCz, 29.5, 16, 3), 0.9, mats.chassis, [winHole]);
    frame.position.y = y0 + 1.25;
    g.add(frame);
    // 固定螺絲（四角）
    for (const [dx, dz] of [[-15, -8.6], [15, -8.6], [-15, 8.6], [15, 8.6]]) {
      const sc = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.5, 14), mats.screw);
      sc.position.set(cx + dx, y0 + 0.25, -3.5 + dz);
      g.add(sc);
      const slot = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.2, 0.33), mats.chassisDark);
      slot.position.set(cx + dx, y0 + 0.02, -3.5 + dz);
      g.add(slot);
    }
    // 近側齒輪箱側壁
    const x0w = sx * 15;
    const x1w = sx * (hw + 6);
    const wallPts = [[x0w, y0 + t], [x0w, 17], [sx * 22, 20], [sx * (hw - 2), 20], [x1w, 17], [x1w, y0 + t]];
    const wallN = extrudeXY(sx > 0 ? wallPts : wallPts.slice().reverse(), 1.4, mats.chassis);
    wallN.position.z = -13.4;
    g.add(wallN);
  }
  // ---- 側裙（iter-03）：電池段兩側的底盤側裙，從側面看得到底盤有厚度而不是薄板 ----
  for (const sz of [-1, 1]) {
    const skirtPts = [[-23, 29], [23, 29], [21, 35.5], [-21, 35.5]].map(([x, z]) => [x, sz * z]);
    const skirt = extrudeXZ(sz > 0 ? skirtPts : skirtPts.slice().reverse(), 2.8, mats.chassis, [
      roundedRect(-12, sz * 32.2, 8, 3, 1.2),
      roundedRect(0, sz * 32.2, 8, 3, 1.2),
      roundedRect(12, sz * 32.2, 8, 3, 1.2),
    ].map((h) => (sz > 0 ? h : h.slice().reverse())));
    skirt.position.y = y0 + 0.3;
    g.add(skirt);
    // iter-09：電池艙側壁（側視可見的底盤厚度；reviewer「側面只是一條細黑邊」）：
    // x-y 輪廓板，兩端沿輪胎外 2.5 mm 的圓弧內凹（MA 側面在前後輪處是弧形缺口），高到車殼底緣內側；
    // 板面有 3 個內凹窗（深色底）＋窗間立肋＋上緣倒角條，讀起來是有厚度的成型件而非細線
    // iter-12：車殼下緣 6.4 → 8.6 mm（ref side-high：車門下方露出一整條黑色底盤側裙）→ 側壁頂 6.9 → 9.4 mm，窗與倒角條跟著上移
    const topY = 9.4;
    const wheelY = c.refWheelDiameter_mm / 2;
    const arcR = wheelY + 2.5;
    const prof = [];
    const nA = 10;
    // 右端（+x）由下往上沿前輪圓弧，左端（−x）由上往下沿後輪圓弧
    for (let k = 0; k <= nA; k++) {
      const y = y0 + ((topY - y0) * k) / nA;
      prof.push([hw - Math.sqrt(arcR * arcR - (y - wheelY) ** 2), y]);
    }
    for (let k = nA; k >= 0; k--) {
      const y = y0 + ((topY - y0) * k) / nA;
      prof.push([-hw + Math.sqrt(arcR * arcR - (y - wheelY) ** 2), y]);
    }
    const winY = y0 + 3.0;
    const winHoles = [-13, 0, 13].map((wx) => roundedRect(wx, winY, 9, 3.0, 1.0));
    const wallZ = sz > 0 ? 35.0 : -36.2;
    const sideWall = extrudeXY(prof, 1.2, mats.chassis, winHoles);
    sideWall.position.z = wallZ;
    g.add(sideWall);
    // 內凹窗底（深色，往內 0.8 mm）
    for (const wx of [-13, 0, 13]) {
      const back = extrudeXY(roundedRect(wx, winY, 9.4, 3.4, 1.1), 0.3, mats.chassisDark);
      back.position.z = sz > 0 ? 34.6 : -34.9;
      g.add(back);
    }
    // 窗間立肋（凸出 0.3 mm）
    for (const rx of [-6.5, 6.5]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.8, topY - y0 - 0.6, 0.3), mats.chassis);
      rib.position.set(rx, (topY + y0) / 2 - 0.3, sz * 36.35);
      g.add(rib);
    }
    // 上緣倒角條（略亮，接受頂光形成細高光線）
    const chamferY = 7.4;
    const chamfer = new THREE.Mesh(new THREE.BoxGeometry(2 * (hw - Math.sqrt(arcR * arcR - (chamferY - wheelY) ** 2)), 0.6, 0.5), mats.roller);
    chamfer.position.set(0, chamferY, sz * 36.3);
    chamfer.rotation.x = sz * 0.6;
    g.add(chamfer);
    // iter-12：側邊支撐塊（ref side-high：車門下方、兩輪之間偏後的黑色方塊，頂面有 2 個孔）
    // 位置由擬合相機量測（推估 ±1 mm）：x −10 … −20、頂面 y ≈ 7、外側面 z ≈ ∓38；底到底盤最低面 y0
    const blockTop = 7.6;
    const block = new THREE.Mesh(new THREE.BoxGeometry(10, blockTop - y0, 5.8), mats.chassis);
    block.position.set(-15, (blockTop + y0) / 2, sz * 35.9);
    g.add(block);
    for (const hx of [-12.4, -17.6]) {
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.12, 20), mats.chassisDark);
      hole.position.set(hx, blockTop + 0.02, sz * 36.4);
      g.add(hole);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.18, 8, 24), mats.roller);
      rim.rotation.x = Math.PI / 2;
      rim.position.set(hx, blockTop + 0.05, sz * 36.4);
      g.add(rim);
    }
  }
  // iter-33：拿掉 iter-31 以前蓋住馬達與電池的整塊頂板（reviewer：「中央一整塊平板、看不到馬達」；ref_ma-chassis 上方看得到馬達與齒輪）
  // 改成：兩側電池艙頂蓋（帶補強肋）＋馬達上方的框形齒輪蓋（gear-cover 零件，開窗看得到罐身）＋車殼卡榫柱＋開關
  const cellTop = comp.battery.y + comp.battery.dia / 2;
  for (const sz of [-1, 1]) {
    const zc = sz * Math.abs(comp.battery.zs[0]);
    const tub = extrudeXZ(roundedRect(0, zc, 50, 14.6, 3), 1.1, mats.chassis);
    tub.position.y = cellTop + 0.25;
    g.add(tub);
    // 頂蓋上的 4 道橫向補強肋與外緣立邊
    for (let k = 0; k < 4; k++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.8, 11.6), mats.chassis);
      rib.position.set(-15 + k * 10, cellTop + 1.35 + 0.4, zc);
      g.add(rib);
    }
    const lip = new THREE.Mesh(new THREE.BoxGeometry(48, 1.6, 1.0), mats.chassis);
    lip.position.set(0, cellTop + 1.35 + 0.8, zc + sz * 6.8);
    g.add(lip);
  }
  // 框形齒輪蓋：罩住馬達上方，中央開窗露出罐身與端蓋，兩端往下接到齒輪箱側壁
  const motorTop = comp.motor.y + comp.motor.flat / 2;
  const coverHole = roundedRect(0, 0, 21, 15.4, 2.2);
  const gearCover = extrudeXZ(roundedRect(0, 0, 30, 23, 3), 1.2, mats.chassis, [coverHole]);
  gearCover.position.y = motorTop + 0.6;
  g.add(gearCover);
  for (const sx of [-1, 1]) {
    // 齒輪蓋兩端的卡扣舌片
    const tab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.4, 9), mats.chassis);
    tab.position.set(sx * 15.6, motorTop - 0.2, 0);
    g.add(tab);
    g.add(screwHead(mats, sx * 12.4, motorTop + 1.8, 9.2 * sx, 1.1));
  }
  // 車殼卡榫柱（chassis-midship.bodyMounts）：立柱＋頂端卡榫孔座，車殼的吊耳扣在這裡
  for (const mnt of BODY_MOUNTS) {
    const h = mnt.y - (y0 + t);
    const post = new THREE.Mesh(new THREE.BoxGeometry(3.2, h, 6.4), mats.chassis);
    post.position.set(mnt.x, y0 + t + h / 2, mnt.z);
    g.add(post);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 7.2, 16), mats.chassis);
    head.rotation.x = Math.PI / 2;
    head.position.set(mnt.x, mnt.y, mnt.z);
    g.add(head);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 7.6, 12), mats.steel);
    pin.rotation.x = Math.PI / 2;
    pin.position.set(mnt.x, mnt.y, mnt.z);
    g.add(pin);
  }
  // 電源開關（switch 零件）：左側電池艙後端的滑動開關座＋撥桿
  const sw = SWITCH_POS;
  const swBase = new THREE.Mesh(new THREE.BoxGeometry(7, 2.2, 5), mats.chassisDark);
  swBase.position.set(sw.x, sw.y - 1.1, sw.z);
  g.add(swBase);
  const swKnob = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 3), mats.motorCap);
  swKnob.position.set(sw.x + 1.4, sw.y + 0.6, sw.z);
  g.add(swKnob);
  // 齒輪箱：外側壁（x-y 平面板，支撐中間齒輪軸與輪軸）＋頂蓋，底面保持開口
  for (const sx of [-1, 1]) {
    const x0 = sx * 15;
    const x1 = sx * (hw + 6);
    const wallPts = [[x0, y0 + t], [x0, 17], [sx * 22, 20], [sx * (hw - 2), 20], [x1, 17], [x1, y0 + t]];
    const ordered = sx > 0 ? wallPts : wallPts.slice().reverse();
    const holes = [circlePts(sx * gt.counterX, gt.counterY, 1.3, 12), circlePts(sx * hw, axleY, 1.3, 12)];
    // 只留遠側（+z）壁當背景；近側（−z，齒輪所在側）不封，讓底面開口看得到齒輪
    for (const wz of [5.2]) {
      const wall = extrudeXY(ordered, 1.4, mats.chassis, holes.map((h) => (sx > 0 ? h : h.slice().reverse())));
      wall.position.z = wz;
      g.add(wall);
    }
    // 輪軸支座（側框上的軸承座）
    for (const sz of [-1, 1]) {
      const boss = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 3.0, 20), mats.chassis);
      boss.rotation.x = Math.PI / 2;
      boss.position.set(sx * hw, axleY, sz * 23.4);
      g.add(boss);
      const brg = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 2.9, 3.2, 20), mats.steel);
      brg.rotation.x = Math.PI / 2;
      brg.position.set(sx * hw, axleY, sz * 23.4);
      g.add(brg);
      const below = new THREE.Mesh(new THREE.BoxGeometry(7.2, axleY - (y0 + t), 3.0), mats.chassis);
      below.position.set(sx * hw, (axleY + y0 + t) / 2, sz * 23.4);
      g.add(below);
    }
  }

  // ---- 前後保桿：MA 立體保桿（iter-03，依 ref_ma-chassis / front34 / rear34）----
  // 中央橋接板＋兩支斜伸到導輪座的臂；臂與橋接板外緣有立起的邊框（厚度），臂下方有三角斜撐連回底盤，
  // 兩臂之間有 X 形補強，導輪座為圓柱凸台
  const rx = comp.rollerX;
  const rz = c.frontRollerZ_mm;
  const bumperY = c.rollerCenterHeight_mm - 4.6;
  const bt = 2.4;
  /** @type {(x0: number, z0: number, x1: number, z1: number, w: number, h: number, y: number) => THREE.Mesh} 兩點之間的方樑 */
  const beam = (x0, z0, x1, z1, w, h, y) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, h, w), mats.chassis);
    m.position.set((x0 + x1) / 2, y + h / 2, (z0 + z1) / 2);
    m.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    return m;
  };
  for (const sx of [-1, 1]) {
    // 中央橋接板（底盤前端 → 導輪臂根部）
    const bridge = [
      [sx * 50, -22],
      [sx * 62, -20],
      [sx * (rx + 3), -9],
      [sx * (rx + 3), 9],
      [sx * 62, 20],
      [sx * 50, 22],
    ];
    // iter-06：橋接板改成「上蓋＋下方鏤空肋層」（MA 保桿底面是三角形肋格，頂面為平整上蓋）：
    // 下層 1.4 mm 開三角形／長圓口袋，上層 1.0 mm 上蓋封住 → 底面看是鏤空骨架、不會透出背景；
    // 上蓋外緣加立起的邊框樑、中央 2 顆十字螺絲（與後方上層導輪架同等的細節）
    /** @type {number[][][]} */
    const pockets = [
      roundedRect(sx * 57.5, 0, 8, 9, 1.5),
      roundedRect(sx * 68.5, 0, 6, 8, 1.5),
    ];
    for (const sz of [-1, 1]) {
      pockets.push([[sx * 52.5, sz * 19.2], [sx * 60.5, sz * 17.2], [sx * 52.5, sz * 6.5]]);
      pockets.push([[sx * 63.5, sz * 15.8], [sx * 71.5, sz * 8.6], [sx * 63.5, sz * 6.2]]);
      pockets.push([[sx * 54.5, sz * 5.2], [sx * 61.8, sz * 5.2], [sx * 61.8, sz * 15.5]]);
    }
    const ribLayer = extrudeXZ(bridge, 1.4, mats.chassis, pockets);
    ribLayer.position.y = bumperY;
    g.add(ribLayer);
    // iter-33：上蓋開安裝孔（reviewer：「保桿是薄平板，缺真車整排的安裝孔」；ref_ma-chassis 保桿上有中央一排＋兩側成對的圓孔）
    /** @type {number[][][]} */
    const lidHoles = [];
    for (const hx of [55.5, 61.5, 67.5]) {
      lidHoles.push(circlePts(sx * hx, 0, 1.1, 14));
    }
    for (const sz of [-1, 1]) {
      lidHoles.push(circlePts(sx * 54, sz * 13.5, 1.0, 14));
      lidHoles.push(circlePts(sx * 59.5, sz * 9.5, 1.0, 14));
    }
    const skin = extrudeXZ(bridge, bt - 1.4, mats.chassisDark, lidHoles);
    skin.position.y = bumperY + 1.4;
    g.add(skin);
    // 上蓋外緣邊框樑（沿橋接板斜邊）
    for (const sz of [-1, 1]) {
      g.add(beam(sx * 62, sz * 19.6, sx * (rx + 2.6), sz * 8.8, 1.1, 1.1, bumperY + bt));
    }
    for (const sz of [-1, 1]) {
      g.add(screwHead(mats, sx * 58, bumperY + bt, sz * 6, 1.5));
    }
    // 橋接板前緣立起的厚邊（保桿正面）
    g.add(beam(sx * (rx + 2.4), -9, sx * (rx + 2.4), 9, 1.4, 4.2, bumperY));
    for (const sz of [-1, 1]) {
      // 導輪臂：底板＋兩側立起的邊框（I 字斷面，臂厚約 5 mm）
      const ax0 = sx * 54;
      const az0 = sz * 16;
      const ax1 = sx * rx;
      const az1 = sz * rz;
      // iter-05：導輪臂底板改為擠出板件並開 2 個減重孔（reviewer「保桿缺螺絲孔」；ref ma-chassis：臂上一排圓孔）
      g.add(armPlate(ax0, az0, ax1, az1, 6.5, bt, bumperY, 3, mats.chassis));
      const dirX = ax1 - ax0;
      const dirZ = az1 - az0;
      const L = Math.hypot(dirX, dirZ);
      const nx = -dirZ / L;
      const nz = dirX / L;
      for (const off of [-2.6, 2.6]) {
        g.add(beam(ax0 + nx * off, az0 + nz * off, ax1 + nx * off, az1 + nz * off, 1.2, 2.2, bumperY + bt));
      }
      // 導輪座（圓柱凸台，導輪下方）
      const boss = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, bt + 1.0, 24), mats.chassis);
      boss.position.set(ax1, bumperY + (bt + 1.0) / 2 - 0.5, az1);
      g.add(boss);
      // 三角斜撐：臂中段下方往後下方連回底盤側框（從側面與前 3/4 視角看得到）
      const mx = ax0 + dirX * 0.45;
      const mz = az0 + dirZ * 0.45;
      const strut = beam(sx * 44, sz * 22.5, mx, mz, 1.6, 1.6, 0);
      strut.position.y = (y0 + t + bumperY) / 2 + 0.4;
      strut.rotation.z = sx * Math.atan2(bumperY - (y0 + t), Math.hypot(mx - sx * 44, mz - sz * 22.5)) * 0.9;
      g.add(strut);
      const web = extrudeXY([[0, 0], [10, 0], [10, 3.2], [0, 1]], 1.2, mats.chassis);
      web.position.set(sx > 0 ? 50 : -60, bumperY - 2.2, sz * 21.5 - 0.6);
      g.add(web);
    }
    // 兩臂之間的 X 形補強（俯視可見）
    for (const sz of [-1, 1]) {
      g.add(beam(sx * 56, sz * 14, sx * (rx - 4), -sz * 8, 1.4, 1.6, bumperY + bt));
    }
  }
  g.add(buildRearStay(mats, rx, rz, bumperY + bt, c.rearUpperRollerHeight_mm - 4.4));
  for (const r of rollerLayout(spec)) {
    g.add(buildRoller(mats, r));
  }

  // ---- 雙軸馬達（置中、軸向沿 x，130 型外殼平面朝上下）----
  // iter-10：罐身改為真正的 130 型截面（圓 ∩ 上下平面，原本是縮放圓柱＝橢圓，從底面看像圓柱電池），
  // 擠出時帶小倒角（罐口捲邊）；端蓋米白、截面略小；兩端有軸承座凸台，軸從兩端伸出（ref_ma-chassis_tamiya.jpg）
  const m = comp.motor;
  /** @type {(r: number, f: number, len: number, mat: THREE.Material, bevel: number) => THREE.Mesh} 130 型截面（圓 ∩ |y| ≤ f/2）沿 x 擠出 */
  const motorSection = (r, f, len, mat, bevel) => {
    const pts = [];
    for (let k = 0; k < 72; k++) {
      const a = (k / 72) * Math.PI * 2;
      const p = [r * Math.cos(a), Math.max(-f / 2, Math.min(f / 2, r * Math.sin(a)))];
      const last = pts[pts.length - 1];
      if (!last || Math.abs(last[0] - p[0]) > 1e-6 || Math.abs(last[1] - p[1]) > 1e-6) {
        pts.push(p);
      }
    }
    const shape = new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(u, v)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: len - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 12 });
    geo.translate(0, 0, -(len - 2 * bevel) / 2);
    geo.rotateY(Math.PI / 2);
    return new THREE.Mesh(geo, mat);
  };
  const canLen = m.length - 6;
  const can = motorSection(m.dia / 2 - 0.4, m.flat - 0.8, canLen, mats.motorCan, 0.4);
  can.position.set(m.x + 3, m.y, m.z);
  g.add(can);
  // 罐身端面軸承座凸台（銀）＋端蓋軸承座凸台（米白）
  const canBoss = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.0, 1.2, 28), mats.motorCan);
  canBoss.rotation.z = Math.PI / 2;
  canBoss.position.set(m.x + m.length / 2 + 0.5, m.y, m.z);
  g.add(canBoss);
  const capMesh = motorSection(m.dia / 2 - 0.6, m.flat - 1.4, 6, mats.motorCap, 0.3);
  capMesh.position.set(m.x - m.length / 2 + 3, m.y, m.z);
  g.add(capMesh);
  const capBoss = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 1.2, 28), mats.motorCap);
  capBoss.rotation.z = Math.PI / 2;
  capBoss.position.set(m.x - m.length / 2 - 0.5, m.y, m.z);
  g.add(capBoss);
  // 端蓋底面的碳刷座凸塊（米白，兩塊）
  for (const dz of [-4.2, 4.2]) {
    const bump = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.8, 2.6), mats.motorCap);
    bump.position.set(m.x - m.length / 2 + 3, m.y - (m.flat - 1.4) / 2 - 0.3, dz);
    g.add(bump);
  }
  // 馬達端子（銅片）
  for (const dz of [-5, 5]) {
    const term = new THREE.Mesh(new THREE.BoxGeometry(1.2, 4, 2), mats.copper);
    term.position.set(m.x - m.length / 2 + 0.2, m.y + 4, dz);
    g.add(term);
  }
  const shaftLen = 2 * (gt.pinionX + 3);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, shaftLen, 12), mats.steel);
  shaft.rotation.z = Math.PI / 2;
  shaft.position.set(0, m.y, m.z);
  g.add(shaft);

  // ---- 齒輪列（顏色依 ref_ma-chassis_tamiya.jpg：小齒輪紫、中間齒輪綠、輪軸齒輪粉紅）----
  const d = spec.drivetrain;
  for (const sx of [-1, 1]) {
    // 小齒輪（壓在馬達軸兩端，軸向沿 x）
    const pin = gear(d.pinionPitchRadius_mm + 0.35, 8, 4, mats.pinion);
    pin.rotation.y = Math.PI / 2;
    pin.position.set(sx * gt.pinionX, m.y, m.z);
    g.add(pin);
    // 中間齒輪：大齒（冠狀齒面朝 +z，與小齒輪直角嚙合）＋小齒（與輪軸齒輪嚙合），軸沿 z
    const counter = new THREE.Group();
    const big = gear(d.counterLargePitchRadius_mm + 0.4, 20, 1.4, mats.counter);
    big.position.z = gt.crownZ - 0.7 - 1.0;
    counter.add(big);
    const crown = crownTeeth(d.counterLargePitchRadius_mm + 0.4, 20, 1.0, mats.counter);
    crown.position.z = gt.crownZ - 1.0;
    counter.add(crown);
    const small = gear(d.counterSmallPitchRadius_mm + 0.35, 15, 3.0, mats.counter);
    small.position.z = gt.crownZ - 2.4 - 1.5;
    counter.add(small);
    const cshaft = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 19, 10), mats.steel);
    cshaft.rotation.x = Math.PI / 2;
    cshaft.position.z = -3.6;
    counter.add(cshaft);
    counter.position.set(sx * gt.counterX, gt.counterY, 0);
    g.add(counter);
    // 輪軸齒輪（粉紅，固定在輪軸上，與中間齒輪小齒同一平面）
    const spur = gear(d.spurPitchRadius_mm + 0.4, 22, 3.0, mats.spur);
    spur.position.set(sx * hw, axleY, gt.crownZ - 2.4 - 1.5);
    g.add(spur);
  }

  // ---- 電池（兩顆 AA，置於馬達兩側；藏在電池蓋內）----
  const b = comp.battery;
  for (const z of b.zs) {
    const cell = new THREE.Mesh(new THREE.CylinderGeometry(b.dia / 2, b.dia / 2, b.length, 28), mats.battery);
    cell.rotation.z = Math.PI / 2;
    cell.position.set(b.x, b.y, z);
    g.add(cell);
  }

  // ---- 輪軸（2 mm 鋼軸，貫穿左右輪）----
  for (const w of wheelLayout(spec).filter((q) => q.z > 0)) {
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, c.trackWidth_mm + 4, 12), mats.steel);
    axle.rotation.x = Math.PI / 2;
    axle.position.set(w.x, w.y, 0);
    g.add(axle);
  }
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

/**
 * 建立整台車（底盤、輪胎、車殼）。底盤座標的所有東西放在 sprung 群組，整組升降 asm.lift_mm（換輪徑時）
 * @type {(asm?: any, opt?: { body?: boolean }) => THREE.Group} 單位 mm；asm 省略時用預設組裝；opt.body = false 不裝車殼
 */
export function buildCarModel(asm = assemble(loadConfig('default')), opt = {}) {
  spec = asm.spec;
  const mats = makeMaterials();
  const car = new THREE.Group();
  car.name = 'mini4wd';
  car.userData.assembly = { config: asm.config, mass_g: asm.mass_g, com_mm: asm.com_mm };
  const sprung = new THREE.Group();
  sprung.name = 'sprung';
  sprung.position.y = asm.lift_mm;
  car.add(sprung);
  const chassis = buildChassis(mats);
  chassis.name = 'chassis';
  sprung.add(chassis);
  for (const w of wheelLayout(spec)) {
    const side = w.z > 0 ? 1 : -1;
    const wheel = buildWheel(mats, side);
    wheel.name = `wheel-${w.id}`;
    wheel.userData.part = 'wheel';
    wheel.position.set(w.x, w.y, w.z);
    wheel.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
      }
    });
    sprung.add(wheel);
  }
  if (opt.body !== false) {
    const body = asm.body.def.build(mats);
    body.name = 'body';
    body.userData.part = 'body';
    body.userData.bodyId = asm.body.id;
    sprung.add(body);
  }
  return car;
}

/**
 * 非索引牆面幾何：每兩個相鄰三角形（lineToMesh 依序推入的同一個四邊形）取兩者 6 頂點中心的賽道顏色，
 * 四邊形整塊單色 → 色塊交界是四邊形邊界上的硬邊，不再於三角形內內插出漸層（iter-06）
 * @type {(geo: THREE.BufferGeometry, colorAt: (x: number, z: number) => THREE.Color) => void}
 */
const flatColorPerQuad = (geo, colorAt) => {
  const p = geo.attributes.position;
  const c = geo.attributes.color;
  for (let i = 0; i + 5 < p.count; i += 6) {
    let cx = 0;
    let cz = 0;
    for (let j = 0; j < 6; j++) {
      cx += p.getX(i + j) / 6;
      cz += p.getZ(i + j) / 6;
    }
    // 位置已換成 mm，colorAt 輸入單位 m
    const col = colorAt(cx / 1000, cz / 1000);
    for (let j = 0; j < 6; j++) {
      c.setXYZ(i + j, col.r, col.g, col.b);
    }
  }
  c.needsUpdate = true;
};

/**
 * iter-09：賽道塑膠表面的程序化細節（物件座標 mm；不需 UV）
 * @param {THREE.MeshPhysicalMaterial} mat
 */
function applyPlasticGrain(mat) {
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGrainPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGrainPos = position;');
    const noiseFns = `
      varying vec3 vGrainPos;
      float grainHash(vec3 c) { return fract(sin(dot(c, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float grainNoise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float n000 = grainHash(i), n100 = grainHash(i + vec3(1, 0, 0)), n010 = grainHash(i + vec3(0, 1, 0)), n110 = grainHash(i + vec3(1, 1, 0));
        float n001 = grainHash(i + vec3(0, 0, 1)), n101 = grainHash(i + vec3(1, 0, 1)), n011 = grainHash(i + vec3(0, 1, 1)), n111 = grainHash(i + vec3(1, 1, 1));
        return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y), mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
      }`;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + noiseFns)
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        {
          float mottle = 0.75 * grainNoise(vGrainPos / 24.0) + 0.25 * grainNoise(vGrainPos / 7.0);
          roughnessFactor = clamp(roughnessFactor * (0.8 + 0.45 * mottle), 0.05, 1.0);
        }`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          vec3 gc = floor(vGrainPos / 0.3);
          float g = grainHash(gc);
          diffuseColor.rgb *= 0.97 + 0.06 * g;
          vec3 jit = vec3(grainHash(gc + 17.0), grainHash(gc + 41.0), grainHash(gc + 73.0)) - 0.5;
          normal = normalize(normal + 0.05 * jit);
        }`,
      );
  };
  mat.customProgramCacheKey = () => 'plasticGrain';
}

/**
 * 建立賽道模型（牆面直接使用物理同一份三角網格）
 * @param {ReturnType<import('./track.js').buildCircuit>} track
 * @returns {THREE.Group} 單位 mm
 */
export function buildTrackModel(track) {
  const g = new THREE.Group();
  // 配色依 JCJC 實品（ref_jcjc-track_curve-set_tamiya.jpg）：彎道每 45° 一片，紅／藍交錯；直線段為灰色；全部為霧面塑膠
  const red = new THREE.Color(0xa01510);
  const blue = new THREE.Color(0x15288a);
  const gray = new THREE.Color(0x8f9399);
  const arcStarts = track.path.segments.filter((sg) => sg.type === 'arc').map((sg) => sg.s0);
  /** @type {(x: number, z: number) => THREE.Color} 依賽道位置取塑膠件顏色（輸入單位 m） */
  const colorAt = (x, z) => {
    const pr = track.path.project(x, z);
    if (pr.seg.type !== 'arc') {
      return gray;
    }
    const arcIdx = Math.max(0, arcStarts.indexOf(pr.seg.s0));
    const piece = Math.min(3, Math.floor(((pr.s - pr.seg.s0) / pr.seg.len) * 4));
    return (arcIdx * 4 + piece) % 2 === 0 ? red : blue;
  };
  // iter-09：塑膠質感（reviewer「賽道平面單色、無塑膠質感」）——半光澤 ABS：
  //   roughness 0.62 → 0.34 基準＋大尺度（約 24 mm）粗糙度斑駁（射出成型件表面光澤不均）、
  //   細顆粒（0.3 mm）顏色 ±3% 噪點與極低強度法線擾動（霧面細紋），再加一層低強度清漆讓燈箱在路面上反射成柔和光帶
  // iter-10：壓下紅色車道遠端的過曝泛粉白——specularIntensity 1 → 0.5、clearcoat 0.6 → 0.35、envMapIntensity 1.8 → 1.2
  //   （遠端掠射角的燈箱反射疊在飽和紅上變粉白；只調 envMap／clearcoat 時幾乎沒改善，主因是底層 F0 鏡面）
  const plasticMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.34, metalness: 0.0, specularIntensity: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.2, envMapIntensity: 1.2, side: THREE.DoubleSide });
  applyPlasticGrain(plasticMat);
  for (const m of track.wallMeshes) {
    const geo = new THREE.BufferGeometry();
    const v = new Float32Array(m.vertices.length);
    const col = new Float32Array(m.vertices.length);
    for (let i = 0; i < v.length; i += 3) {
      v[i] = m.vertices[i] * 1000;
      v[i + 1] = m.vertices[i + 1] * 1000;
      v[i + 2] = m.vertices[i + 2] * 1000;
      const c = colorAt(m.vertices[i], m.vertices[i + 2]);
      col[i] = c.r;
      col[i + 1] = c.g;
      col[i + 2] = c.b;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(v, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(new THREE.BufferAttribute(m.indices, 1));
    // 拆成不共用頂點，牆面／頂面各自用面法向，避免平滑法向讓牆看起來像圓管
    const flat = geo.toNonIndexed();
    flat.computeVertexNormals();
    flatColorPerQuad(flat, colorAt);
    const mesh = new THREE.Mesh(flat, plasticMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
  }
  // 路面：沿中心線鋪設的帶狀網格（灰色 ABS）
  // iter-06：修賽道接縫顏色漸層（reviewer）——取樣點加入每個片件交界的 s（彎道每 45° 一片、直線段兩端），
  // 每一段帶狀四邊形取「段中點」單一顏色（不共用頂點），色塊交界剛好落在片件接縫上、不再頂點內插出紫色漸層；
  // 交界處再鋪一條 1.2 mm 深色接縫（JCJC 片件之間的縫）
  const P = track.dims.pitch;
  const halfW = 1.5 * P + 0.02;
  /** @type {number[]} */
  const seamS = [];
  for (const sg of track.path.segments) {
    seamS.push(sg.s0);
    if (sg.type === 'arc') {
      for (let k = 1; k < 4; k++) {
        seamS.push(sg.s0 + (sg.len * k) / 4);
      }
    }
  }
  const n = Math.ceil(track.path.length / 0.02);
  /** @type {number[]} */
  const sList = Array.from({ length: n + 1 }, (_, i) => (track.path.length * i) / n);
  for (const ss of seamS) {
    if (ss > 0 && ss < track.path.length) {
      sList.push(ss);
    }
  }
  sList.sort((p, q) => p - q);
  const pos = [];
  const floorCol = [];
  for (let i = 0; i + 1 < sList.length; i++) {
    const sa = sList[i];
    const sb = sList[i + 1];
    if (sb - sa < 1e-6) {
      continue;
    }
    const a0 = track.path.point(sa, halfW);
    const b0 = track.path.point(sa, -halfW);
    const a1 = track.path.point(sb, halfW);
    const b1 = track.path.point(sb, -halfW);
    const mid = track.path.point((sa + sb) / 2, 0);
    const fc = colorAt(mid.x, mid.z);
    for (const q of [a0, a1, b0, b0, a1, b1]) {
      pos.push(q.x * 1000, 0, q.z * 1000);
      floorCol.push(fc.r, fc.g, fc.b);
    }
  }
  const floorGeo = new THREE.BufferGeometry();
  floorGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  floorGeo.setAttribute('color', new THREE.Float32BufferAttribute(floorCol, 3));
  floorGeo.computeVertexNormals();
  const floor = new THREE.Mesh(floorGeo, plasticMat);
  floor.receiveShadow = true;
  floor.position.y = 0.2;
  g.add(floor);
  // 片件接縫（深色細縫，橫跨路面）
  const seamPos = [];
  const seamHalf = 0.0006;
  for (const s0 of seamS) {
    const q0 = track.path.point(Math.max(0, s0 - seamHalf), halfW);
    const q1 = track.path.point(Math.max(0, s0 - seamHalf), -halfW);
    const q2 = track.path.point(s0 + seamHalf, halfW);
    const q3 = track.path.point(s0 + seamHalf, -halfW);
    for (const q of [q0, q2, q1, q1, q2, q3]) {
      seamPos.push(q.x * 1000, 0.25, q.z * 1000);
    }
  }
  const seamGeo = new THREE.BufferGeometry();
  seamGeo.setAttribute('position', new THREE.Float32BufferAttribute(seamPos, 3));
  seamGeo.computeVertexNormals();
  g.add(new THREE.Mesh(seamGeo, new THREE.MeshStandardMaterial({ color: 0x1a1b1f, roughness: 0.9, side: THREE.DoubleSide })));

  // 換道立體橋（iter-00 只做外觀）：外側線道爬升、越過其他車道後落到內側線道
  if (track.laneChanger) {
    const lc = track.laneChanger;
    const hBridge = globalSpec.track.bridgeHeight_mm;
    const segN = 40;
    const deckPos = [];
    const deckIdx = [];
    const s0 = lc.start - 0.45;
    const s1 = lc.end + 0.45;
    for (let i = 0; i <= segN; i++) {
      const u = i / segN;
      const s = s0 + (s1 - s0) * u;
      const lift = Math.min(1, Math.min(u, 1 - u) / 0.3);
      const y = hBridge * (lift * lift * (3 - 2 * lift));
      const d = -P + 2 * P * (0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, (u - 0.3) / 0.4))));
      const a = track.path.point(s, d + 0.0575);
      const b = track.path.point(s, d - 0.0575);
      deckPos.push(a.x * 1000, y, a.z * 1000, b.x * 1000, y, b.z * 1000);
      if (i < segN) {
        const k = i * 2;
        deckIdx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
      }
    }
    const deckGeo = new THREE.BufferGeometry();
    deckGeo.setAttribute('position', new THREE.Float32BufferAttribute(deckPos, 3));
    deckGeo.setIndex(deckIdx);
    deckGeo.computeVertexNormals();
    const deck = new THREE.Mesh(deckGeo, new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.6, side: THREE.DoubleSide }));
    deck.castShadow = true;
    g.add(deck);
  }
  return g;
}
