// Three.js 程序化模型：Chevalier（MA 底盤）風格 1/32 迷你四驅車＋賽道
// 單位 mm；車體座標 x 向前、y 向上、z 向右，原點在前後軸中點的地面上
// 所有尺寸來自 config/spec.json 與 carLayout.js（與物理共用）
import * as THREE from 'three';
import { spec } from './spec.js';
import { rollerLayout, wheelLayout, componentLayout } from './carLayout.js';
import { buildChevalierBody } from './bodyShell.js';

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

/** 建立材質集合 */
function makeMaterials() {
  return {
    // iter-04：黑色塑膠分平光／半光（ref front34 / rear34：底盤本體偏霧面，保桿與導輪是帶反光的半光黑）
    chassis: new THREE.MeshStandardMaterial({ color: 0x34373d, roughness: 0.78, metalness: 0.0 }),
    chassisDark: new THREE.MeshStandardMaterial({ color: 0x202125, roughness: 0.88, metalness: 0.0 }),
    bumper: new THREE.MeshPhysicalMaterial({ color: 0x1c1d21, roughness: 0.42, metalness: 0.0, clearcoat: 0.55, clearcoatRoughness: 0.25 }),
    body: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.35, clearcoat: 1.0, clearcoatRoughness: 0.08 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x15181d, roughness: 0.05, metalness: 0.2, clearcoat: 1.0 }),
    // iter-03：輪胎橡膠粗糙感（程序化雜訊 bump＋roughness 貼圖），顏色由死黑提亮到深炭灰
    tire: new THREE.MeshStandardMaterial({ color: 0x2b2b2e, roughness: 0.92, metalness: 0.0, bumpMap: rubberNoiseTexture(), bumpScale: 0.6, roughnessMap: rubberNoiseTexture() }),
    tireTread: new THREE.MeshStandardMaterial({ color: 0x161617, roughness: 0.97, metalness: 0.0 }),
    // 輪框：ref_chevalier-ma_wheel-detail 為淺灰緞面塑膠（帶些許金屬粉），不是鍍鉻
    rim: new THREE.MeshPhysicalMaterial({ color: 0xa4a9b0, roughness: 0.42, metalness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.3 }),
    motorCan: new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: 0.25, metalness: 0.9 }),
    motorCap: new THREE.MeshStandardMaterial({ color: 0xe8e2d0, roughness: 0.6 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.3, metalness: 0.95 }),
    pinion: new THREE.MeshStandardMaterial({ color: 0x8a4fd0, roughness: 0.5 }),
    counter: new THREE.MeshStandardMaterial({ color: 0x8be03a, roughness: 0.5 }),
    spur: new THREE.MeshStandardMaterial({ color: 0xf08aa0, roughness: 0.5 }),
    battery: new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.4, metalness: 0.3 }),
    copper: new THREE.MeshStandardMaterial({ color: 0xc8874a, roughness: 0.3, metalness: 0.9 }),
    roller: new THREE.MeshPhysicalMaterial({ color: 0x17181b, roughness: 0.3, metalness: 0.0, clearcoat: 0.7, clearcoatRoughness: 0.15 }),
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
  const rimRing = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, w * 0.9, 40, 1, true), mats.rim);
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
    return new THREE.Mesh(geo, mats.rim);
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
  const back = new THREE.Mesh(new THREE.CircleGeometry(rr, 32), mats.chassisDark);
  back.position.z = -side * (w * 0.2);
  back.rotation.y = side > 0 ? 0 : Math.PI;
  g.add(back);
  return g;
}

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
  const motorY = componentLayout().motor.y;
  const axleY = spec.tire.diameter_mm / 2;
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

/** 導輪：塑膠導輪本體＋凸緣、培林內外環與密封蓋、墊片、十字頭螺絲、底部螺帽 */
function buildRoller(mats, r) {
  const g = new THREE.Group();
  // iter-04：導輪改車削截面（上下凸緣＋中段內凹腰身），取代 iter-03 的直筒圓柱（ref front34：薄型黑導輪、邊緣有凸緣）
  // 物理接觸半徑仍是 r.r（config rollerDiameter_mm），凸緣只外凸 0.3 mm
  const hh = r.h / 2;
  const prof = [
    [1.1, -hh], [r.r - 0.5, -hh], [r.r + 0.3, -hh + 0.35], [r.r + 0.3, -hh + 1.0], [r.r - 0.35, -hh + 1.5],
    [r.r - 0.35, hh - 1.5], [r.r + 0.3, hh - 1.0], [r.r + 0.3, hh - 0.35], [r.r - 0.5, hh], [1.1, hh],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), mats.roller);
  g.add(body);
  for (const sy of [-1, 1]) {
    // 培林外環（鋼）＋黑色密封蓋＋內環
    const outer = new THREE.Mesh(new THREE.RingGeometry(2.9, 3.6, 28), mats.steel);
    outer.rotation.x = sy > 0 ? -Math.PI / 2 : Math.PI / 2;
    outer.position.y = sy * (r.h / 2 + 0.02);
    g.add(outer);
    const seal = new THREE.Mesh(new THREE.RingGeometry(1.9, 2.9, 28), mats.chassisDark);
    seal.rotation.x = outer.rotation.x;
    seal.position.y = sy * (r.h / 2 + 0.03);
    g.add(seal);
    const inner = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.9, 20), mats.steel);
    inner.rotation.x = outer.rotation.x;
    inner.position.y = sy * (r.h / 2 + 0.04);
    g.add(inner);
  }
  // 導輪上方的大墊圈（ref front34：螺絲下方一片明顯的金屬墊圈）＋下方塑膠墊片
  const bigWasher = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.45, 28), mats.steel);
  bigWasher.position.y = r.h / 2 + 0.3;
  g.add(bigWasher);
  const spacer = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.6, 20), mats.bumper);
  spacer.position.y = -r.h / 2 - 0.3;
  g.add(spacer);
  // 頂部墊片＋十字頭螺絲
  const washer = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.4, 20), mats.steel);
  washer.position.y = r.h / 2 + 0.7;
  g.add(washer);
  const head = new THREE.Mesh(new THREE.SphereGeometry(2.1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), mats.screw);
  head.scale.y = 0.5;
  head.position.y = r.h / 2 + 0.9;
  g.add(head);
  for (const rot of [0, Math.PI / 2]) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 0.45), mats.chassisDark);
    slot.position.y = r.h / 2 + 1.8;
    slot.rotation.y = rot;
    g.add(slot);
  }
  // 底部六角螺帽＋螺絲尾端
  const nut = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 1.4, 6), mats.steel);
  nut.position.y = -r.h / 2 - 0.75;
  g.add(nut);
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.0, 10), mats.steel);
  tail.position.y = -r.h / 2 - 1.8;
  g.add(tail);
  g.position.set(r.x, r.y, r.z);
  return g;
}

/** 底盤：MA 一體式底盤、前後保桿、導輪架、雙軸馬達、齒輪列、電池、輪軸 */
function buildChassis(mats) {
  const g = new THREE.Group();
  const c = spec.chassis;
  const comp = componentLayout();
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
    roundedRect(0, 0, 27, 15, 3),
    gearWin(-1),
    gearWin(1),
    roundedRect(0, 19, 48, 12, 2.5),
    roundedRect(0, -19, 48, 12, 2.5),
  ];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      openings.push(roundedRect(sx * 53, sz * 17, 5, 3, 1.2));
    }
  }
  // 外形：馬達／電池段最寬（±29），前後輪之間縮到 ±24.5（輪胎內側 25.25 mm，避免與輪胎重疊）
  const outline = [[61, -22], [61, 22], [58, 24.5], [26, 24.5], [24, 29], [-24, 29], [-26, 24.5], [-58, 24.5], [-61, 22], [-61, -22], [-58, -24.5], [-26, -24.5], [-24, -29], [24, -29], [26, -24.5], [58, -24.5]];
  const plate = extrudeXZ(outline, t, mats.chassis, openings);
  plate.position.y = y0;
  g.add(plate);
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
  // 電池蓋（內凹 0.5 mm）＋縱向防滑肋＋卡榫
  for (const sz of [-1, 1]) {
    const cover = extrudeXZ(roundedRect(0, sz * 19, 47.4, 11.4, 2.3), 0.9, mats.chassisDark);
    cover.position.y = y0 + 0.5;
    g.add(cover);
    for (let k = -4; k <= 3; k++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 8.5), mats.chassis);
      rib.position.set(k * 4.6 + 2, y0 + 0.36, sz * 19);
      g.add(rib);
    }
    const latch = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.35, 5), mats.chassis);
    latch.position.set(-20.5, y0 + 0.36, sz * 19);
    g.add(latch);
  }
  // ---- 齒輪箱蓋（iter-03）：真車齒輪包在齒輪箱裡，底面不直接露出 ----
  // 每個齒輪窗以齒輪箱底蓋封住（隆起外殼＋固定螺絲），中央留一個煙燻半透明檢視窗看得到中間齒輪；近側（−z）加齒輪箱側壁
  const smoke = new THREE.MeshPhysicalMaterial({ color: 0x5a6472, roughness: 0.08, metalness: 0.0, transparent: true, opacity: 0.38, clearcoat: 1.0, depthWrite: false });
  for (const sx of [-1, 1]) {
    const cx = sx * (gt.counterX + 3);
    const winHole = roundedRect(sx * gt.counterX, -4, 11, 9, 2.2);
    const cover = extrudeXZ(roundedRect(cx, -3.5, 32.6, 19.6, 3), 1.2, mats.chassisDark, [sx > 0 ? winHole : winHole.slice().reverse()]);
    cover.position.y = y0 + 0.05;
    g.add(cover);
    // 齒輪箱外殼的隆起（沿輪軸方向的半圓頂，表現箱體內有齒輪）
    const hump = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 15, 20, 1, false, Math.PI / 2, Math.PI), mats.chassisDark);
    hump.rotation.x = Math.PI / 2;
    hump.scale.set(1, 1, 0.35);
    hump.position.set(sx * hw, y0 + 1.2, -6.5);
    hump.rotation.z = Math.PI;
    g.add(hump);
    // 檢視窗（煙燻半透明）
    const pane = extrudeXZ(roundedRect(sx * gt.counterX, -4, 11.2, 9.2, 2.2), 0.5, smoke);
    pane.position.y = y0 + 0.5;
    pane.renderOrder = 3;
    g.add(pane);
    // 固定螺絲（四角）
    for (const [dx, dz] of [[-13, -10.5], [13, -10.5], [-13, 3.5], [13, 3.5]]) {
      const sc = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.5, 14), mats.screw);
      sc.position.set(cx + dx, y0 - 0.0 + 0.25, -3.5 + dz);
      g.add(sc);
      const slot = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 0.35), mats.chassisDark);
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
    const face = new THREE.Mesh(new THREE.BoxGeometry(42, 3.6, 1.0), mats.chassis);
    face.position.set(0, y0 + 0.3 + 1.8, sz * 35.6);
    g.add(face);
  }
  // 內層上蓋（馬達、電池上方的底盤頂板，深色），擋住從開口往上看到的車殼內面
  const deck = extrudeXZ(roundedRect(0, 0, 52, 48, 4), 1.2, mats.chassisDark);
  deck.position.y = 20.4;
  g.add(deck);
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
  const rz = c.overallWidth_mm / 2 - c.rollerDiameter_mm / 2;
  const bumperY = c.rollerCenterHeight_mm - 4.6;
  const bt = 2.4;
  /** @type {(x0: number, z0: number, x1: number, z1: number, w: number, h: number, y: number) => THREE.Mesh} 兩點之間的方樑 */
  const beam = (x0, z0, x1, z1, w, h, y) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, h, w), mats.bumper);
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
    const plateB = extrudeXZ(sx > 0 ? bridge : bridge.slice().reverse(), bt, mats.bumper, [
      roundedRect(sx * 58, 0, 6, 12, 2),
      circlePts(sx * (rx - 1), -5.5, 1.3, 12),
      circlePts(sx * (rx - 1), 5.5, 1.3, 12),
    ].map((h) => (sx > 0 ? h : h.slice().reverse())));
    plateB.position.y = bumperY;
    g.add(plateB);
    // 橋接板前緣立起的厚邊（保桿正面）
    g.add(beam(sx * (rx + 2.4), -9, sx * (rx + 2.4), 9, 1.4, 4.2, bumperY));
    for (const sz of [-1, 1]) {
      // 導輪臂：底板＋兩側立起的邊框（I 字斷面，臂厚約 5 mm）
      const ax0 = sx * 54;
      const az0 = sz * 16;
      const ax1 = sx * rx;
      const az1 = sz * rz;
      g.add(beam(ax0, az0, ax1, az1, 6.5, bt, bumperY));
      const dirX = ax1 - ax0;
      const dirZ = az1 - az0;
      const L = Math.hypot(dirX, dirZ);
      const nx = -dirZ / L;
      const nz = dirX / L;
      for (const off of [-2.6, 2.6]) {
        g.add(beam(ax0 + nx * off, az0 + nz * off, ax1 + nx * off, az1 + nz * off, 1.2, 2.2, bumperY + bt));
      }
      // 導輪座（圓柱凸台，導輪下方）
      const boss = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, bt + 1.0, 24), mats.bumper);
      boss.position.set(ax1, bumperY + (bt + 1.0) / 2 - 0.5, az1);
      g.add(boss);
      // 三角斜撐：臂中段下方往後下方連回底盤側框（從側面與前 3/4 視角看得到）
      const mx = ax0 + dirX * 0.45;
      const mz = az0 + dirZ * 0.45;
      const strut = beam(sx * 44, sz * 22.5, mx, mz, 1.6, 1.6, 0);
      strut.position.y = (y0 + t + bumperY) / 2 + 0.4;
      strut.rotation.z = sx * Math.atan2(bumperY - (y0 + t), Math.hypot(mx - sx * 44, mz - sz * 22.5)) * 0.9;
      g.add(strut);
      const web = extrudeXY([[0, 0], [10, 0], [10, 3.2], [0, 1]], 1.2, mats.bumper);
      web.position.set(sx > 0 ? 50 : -60, bumperY - 2.2, sz * 21.5 - 0.6);
      g.add(web);
    }
    // 兩臂之間的 X 形補強（俯視可見）
    for (const sz of [-1, 1]) {
      g.add(beam(sx * 56, sz * 14, sx * (rx - 4), -sz * 8, 1.4, 1.6, bumperY + bt));
    }
  }
  // 後方上層導輪架（上下疊放）
  const upperStay = extrudeXZ(roundedRect(-rx + 4, 0, 14, 2 * rz + 6, 3), 2, mats.chassisDark);
  upperStay.position.y = c.rearUpperRollerHeight_mm - 4.4;
  g.add(upperStay);
  for (const sz of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(5, c.rearUpperRollerHeight_mm - c.rollerCenterHeight_mm, 4), mats.chassisDark);
    post.position.set(-rx + 6, (c.rearUpperRollerHeight_mm + c.rollerCenterHeight_mm) / 2 - 2, sz * (rz - 6));
    g.add(post);
  }
  for (const r of rollerLayout()) {
    g.add(buildRoller(mats, r));
  }

  // ---- 雙軸馬達（置中、軸向沿 x，130 型外殼平面朝上下）----
  const m = comp.motor;
  const can = new THREE.Mesh(new THREE.CylinderGeometry(m.dia / 2, m.dia / 2, m.length - 6, 40), mats.motorCan);
  can.scale.set(m.flat / m.dia, 1, 1);
  can.rotation.z = Math.PI / 2;
  can.position.set(m.x + 3, m.y, m.z);
  g.add(can);
  // 外殼上的散熱開孔與壓痕（底面開口看得到）
  for (const dz of [-4.5, 4.5]) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, 2.2), mats.chassisDark);
    slot.position.set(m.x + 7, m.y - m.flat / 2 - 0.05, dz);
    g.add(slot);
  }
  const capMesh = new THREE.Mesh(new THREE.CylinderGeometry(m.dia / 2 - 0.3, m.dia / 2 - 0.3, 6, 40), mats.motorCap);
  capMesh.scale.set(m.flat / m.dia, 1, 1);
  capMesh.rotation.z = Math.PI / 2;
  capMesh.position.set(m.x - m.length / 2 + 3, m.y, m.z);
  g.add(capMesh);
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
  for (const w of wheelLayout().filter((q) => q.z > 0)) {
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
 * 建立整台車
 * @returns {THREE.Group} 單位 mm
 */
export function buildCarModel() {
  const mats = makeMaterials();
  const car = new THREE.Group();
  car.name = 'mini4wd';
  car.add(buildChassis(mats));
  for (const w of wheelLayout()) {
    const side = w.z > 0 ? 1 : -1;
    const wheel = buildWheel(mats, side);
    wheel.position.set(w.x, w.y, w.z);
    wheel.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
      }
    });
    car.add(wheel);
  }
  car.add(buildChevalierBody(mats));
  return car;
}

/**
 * 建立賽道模型（牆面直接使用物理同一份三角網格）
 * @param {ReturnType<import('./track.js').buildCircuit>} track
 * @returns {THREE.Group} 單位 mm
 */
/**
 * 非索引幾何：每個三角形三個頂點改成同一顏色（取三頂點色的眾數，沒有眾數取第一個），
 * 色塊交界變成三角形邊界上的硬邊，不再於三角形內內插出紫色暈開
 * @type {(geo: THREE.BufferGeometry) => void}
 */
const flatColorPerTriangle = (geo) => {
  const c = geo.attributes.color;
  for (let i = 0; i < c.count; i += 3) {
    const key = (k) => `${c.getX(k).toFixed(3)},${c.getY(k).toFixed(3)},${c.getZ(k).toFixed(3)}`;
    const k0 = key(i);
    const k1 = key(i + 1);
    const k2 = key(i + 2);
    let src = i;
    if (k1 === k2 && k1 !== k0) {
      src = i + 1;
    }
    for (let j = 0; j < 3; j++) {
      c.setXYZ(i + j, c.getX(src), c.getY(src), c.getZ(src));
    }
  }
  c.needsUpdate = true;
};

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
  const plasticMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.0, side: THREE.DoubleSide });
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
    flatColorPerTriangle(flat);
    const mesh = new THREE.Mesh(flat, plasticMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
  }
  // 路面：沿中心線鋪設的帶狀網格（灰色 ABS）
  const P = track.dims.pitch;
  const halfW = 1.5 * P + 0.02;
  // iter-04：路面取樣 2 cm → 5 mm，並改成每個三角形取單一顏色（flatColorPerTriangle），
  //   修正 reviewer 指出的紅藍交界暈開（頂點色在跨越交界的三角形內線性內插）
  const n = Math.ceil(track.path.length / 0.005);
  const pos = [];
  const idx = [];
  const floorCol = [];
  for (let i = 0; i <= n; i++) {
    const s = (track.path.length * i) / n;
    const a = track.path.point(s, halfW);
    const b = track.path.point(s, -halfW);
    pos.push(a.x * 1000, 0, a.z * 1000, b.x * 1000, 0, b.z * 1000);
    const fc = colorAt(track.path.point(s, 0).x, track.path.point(s, 0).z);
    floorCol.push(fc.r, fc.g, fc.b, fc.r, fc.g, fc.b);
    if (i < n) {
      const k = i * 2;
      idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  const floorGeo = new THREE.BufferGeometry();
  floorGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  floorGeo.setAttribute('color', new THREE.Float32BufferAttribute(floorCol, 3));
  floorGeo.setIndex(idx);
  const floorFlat = floorGeo.toNonIndexed();
  floorFlat.computeVertexNormals();
  flatColorPerTriangle(floorFlat);
  const floor = new THREE.Mesh(floorFlat, plasticMat);
  floor.receiveShadow = true;
  floor.position.y = 0.2;
  g.add(floor);

  // iter-04：片件接縫（JCJC 每片彎道 45°、直線段兩端）：橫跨路面的 1.2 mm 深色細縫
  const seamS = [];
  for (const sg of track.path.segments) {
    seamS.push(sg.s0);
    if (sg.type === 'arc') {
      for (let k = 1; k < 4; k++) {
        seamS.push(sg.s0 + (sg.len * k) / 4);
      }
    }
  }
  const seamPos = [];
  const seamIdx = [];
  const seamHalf = 0.0006;
  for (const s0 of seamS) {
    const base = seamPos.length / 3;
    for (const [ds, d] of [[-seamHalf, halfW], [-seamHalf, -halfW], [seamHalf, halfW], [seamHalf, -halfW]]) {
      const q = track.path.point(Math.max(0, s0 + ds), d);
      seamPos.push(q.x * 1000, 0.25, q.z * 1000);
    }
    seamIdx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
  }
  const seamGeo = new THREE.BufferGeometry();
  seamGeo.setAttribute('position', new THREE.Float32BufferAttribute(seamPos, 3));
  seamGeo.setIndex(seamIdx);
  seamGeo.computeVertexNormals();
  g.add(new THREE.Mesh(seamGeo, new THREE.MeshStandardMaterial({ color: 0x1a1b1f, roughness: 0.9, side: THREE.DoubleSide })));

  // 換道立體橋（iter-00 只做外觀）：外側線道爬升、越過其他車道後落到內側線道
  if (track.laneChanger) {
    const lc = track.laneChanger;
    const hBridge = spec.track.bridgeHeight_mm;
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
