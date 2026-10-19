// Three.js 程序化模型：Chevalier（MA 底盤）風格 1/32 迷你四驅車＋賽道
// 單位 mm；車體座標 x 向前、y 向上、z 向右，原點在前後軸中點的地面上
// 所有尺寸來自 config/spec.json 與 carLayout.js（與物理共用）
import * as THREE from 'three';
import { spec } from './spec.js';
import { rollerLayout, wheelLayout, componentLayout } from './carLayout.js';
import { buildChevalierBody } from './bodyShell.js';

/** 建立材質集合 */
function makeMaterials() {
  return {
    chassis: new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.55, metalness: 0.05 }),
    chassisDark: new THREE.MeshStandardMaterial({ color: 0x18191b, roughness: 0.6, metalness: 0.05 }),
    body: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.35, clearcoat: 1.0, clearcoatRoughness: 0.08 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x15181d, roughness: 0.05, metalness: 0.2, clearcoat: 1.0 }),
    tire: new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.92, metalness: 0.0 }),
    rim: new THREE.MeshStandardMaterial({ color: 0x70757d, roughness: 0.4, metalness: 0.6 }),
    motorCan: new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: 0.25, metalness: 0.9 }),
    motorCap: new THREE.MeshStandardMaterial({ color: 0xe8e2d0, roughness: 0.6 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.3, metalness: 0.95 }),
    pinion: new THREE.MeshStandardMaterial({ color: 0x8a4fd0, roughness: 0.5 }),
    counter: new THREE.MeshStandardMaterial({ color: 0x8be03a, roughness: 0.5 }),
    spur: new THREE.MeshStandardMaterial({ color: 0xf08aa0, roughness: 0.5 }),
    battery: new THREE.MeshStandardMaterial({ color: 0x1e5bd8, roughness: 0.4, metalness: 0.3 }),
    roller: new THREE.MeshStandardMaterial({ color: 0x222326, roughness: 0.45, metalness: 0.2 }),
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

/** 齒輪（簡化：帶齒的擠出圓盤） */
function gear(radius, teeth, width, material) {
  const shape = new THREE.Shape();
  const inner = radius * 0.86;
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = (i / (teeth * 2)) * Math.PI * 2;
    const a1 = ((i + 1) / (teeth * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? radius : inner;
    if (i === 0) {
      shape.moveTo(Math.cos(a0) * r, Math.sin(a0) * r);
    } else {
      shape.lineTo(Math.cos(a0) * r, Math.sin(a0) * r);
    }
    shape.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
  geo.translate(0, 0, -width / 2);
  return new THREE.Mesh(geo, material);
}

/** 輪子：low profile 輪胎（Lathe）＋ Y 字幅輪框 */
function buildWheel(mats, side) {
  const g = new THREE.Group();
  const R = spec.tire.diameter_mm / 2;
  const w = spec.tire.width_mm;
  const rr = spec.tire.rimDiameter_mm / 2;
  // 輪胎截面（繞 y 軸旋轉後再轉到 z 軸）
  const prof = [];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const y = -w / 2 + t * w;
    // 胎面略帶圓角
    const edge = Math.min(t, 1 - t);
    const r = rr + (R - rr) * Math.min(1, 0.55 + edge * 4.5);
    prof.push(new THREE.Vector2(r, y));
  }
  prof.push(new THREE.Vector2(rr, w / 2));
  prof.unshift(new THREE.Vector2(rr, -w / 2));
  const tireGeo = new THREE.LatheGeometry(prof, 48);
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
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    const spoke = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.BoxGeometry(rr * 0.5, 1.5, 1.0), mats.rim);
    stem.position.x = rr * 0.35;
    spoke.add(stem);
    for (const sgn of [-1, 1]) {
      const fork = new THREE.Mesh(new THREE.BoxGeometry(rr * 0.42, 1.1, 1.0), mats.rim);
      fork.position.set(rr * 0.74, sgn * 1.5, 0);
      fork.rotation.z = sgn * 0.5;
      spoke.add(fork);
    }
    spoke.rotation.z = a;
    face.add(spoke);
  }
  face.position.z = side * (w * 0.32);
  g.add(face);
  const back = new THREE.Mesh(new THREE.CircleGeometry(rr, 32), mats.chassisDark);
  back.position.z = -side * (w * 0.2);
  back.rotation.y = side > 0 ? 0 : Math.PI;
  g.add(back);
  return g;
}

/** 導輪：鋁製外圈＋培林＋螺絲頭 */
function buildRoller(mats, r) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r.r, r.r, r.h, 28), mats.roller);
  g.add(body);
  const lip = new THREE.Mesh(new THREE.CylinderGeometry(r.r + 0.6, r.r + 0.6, 0.8, 28), mats.roller);
  lip.position.y = -r.h / 2 + 0.4;
  g.add(lip);
  const bearing = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, r.h + 0.2, 16), mats.steel);
  g.add(bearing);
  const screw = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 1.2, 6), mats.screw);
  screw.position.y = r.h / 2 + 0.6;
  g.add(screw);
  g.position.set(r.x, r.y, r.z);
  return g;
}

/** 底盤：MA 一體式底盤、前後保桿、導輪架、馬達、齒輪、電池、輪軸 */
function buildChassis(mats) {
  const g = new THREE.Group();
  const c = spec.chassis;
  const comp = componentLayout();
  const y0 = c.groundClearance_mm;
  const t = c.plateThickness_mm;

  // 底板（MA 一體式底盤底面）：中央馬達蓋開口、前後齒輪蓋開口、兩側電池艙通風孔
  // 所有底面細節都內凹（不低於底板下緣 y0 = 離地 2.2 mm，SPEC 1.2）
  const hw = spec.chassis.wheelbase_mm / 2;
  const openings = [
    roundedRect(0, 0, 32, 24, 3),
    roundedRect(hw - 2, 0, 18, 28, 3),
    roundedRect(-hw + 2, 0, 18, 28, 3),
  ];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      for (const k of [0, 1, 2]) {
        openings.push(roundedRect(sx * (20 + k * 4.2), sz * 19, 2.4, 10, 1.1));
      }
    }
  }
  const plate = extrudeXZ(roundedRect(0, 0, 122, 58, 8), t, mats.chassis, openings);
  plate.position.y = y0;
  plate.castShadow = true;
  g.add(plate);
  // 馬達蓋（內凹 0.4 mm）＋肋條＋卡榫
  const motorCover = extrudeXZ(roundedRect(0, 0, 31.6, 23.6, 3), 0.8, mats.chassisDark);
  motorCover.position.y = y0 + 0.4;
  g.add(motorCover);
  for (const dz of [-6, 0, 6]) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(24, 0.35, 1.0), mats.chassis);
    rib.position.set(0, y0 + 0.24, dz);
    g.add(rib);
  }
  for (const sx of [-1, 1]) {
    const tab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.4, 8), mats.chassis);
    tab.position.set(sx * 14.5, y0 + 0.22, 0);
    g.add(tab);
  }
  // 前後齒輪蓋（內凹）＋固定螺絲
  for (const sx of [-1, 1]) {
    const gc = extrudeXZ(roundedRect(sx * (hw - 2), 0, 17.6, 27.6, 3), 0.8, mats.chassisDark);
    gc.position.y = y0 + 0.4;
    g.add(gc);
    for (const dz of [-9, 9]) {
      const screw = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.5, 14), mats.screw);
      screw.position.set(sx * (hw - 2), y0 + 0.2, dz);
      g.add(screw);
    }
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.35, 20), mats.chassis);
    ridge.position.set(sx * (hw - 2), y0 + 0.24, 0);
    g.add(ridge);
  }
  // 輪軸支座（底盤側壁上的軸承座塊）
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const h = spec.tire.diameter_mm / 2 + 3 - (y0 + t);
      const boss = new THREE.Mesh(new THREE.BoxGeometry(8, h, 4.5), mats.chassis);
      boss.position.set(sx * hw, y0 + t + h / 2, sz * 23.5);
      g.add(boss);
    }
  }
  // 側壁（電池艙／馬達艙外殼）
  for (const sz of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(96, 13, 2.2), mats.chassis);
    wall.position.set(2, y0 + t + 6.5, sz * 27);
    g.add(wall);
  }
  // 馬達艙罩與齒輪箱
  for (const sx of [-1, 1]) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(22, 13, 30), mats.chassis);
    box.position.set(sx * (c.wheelbase_mm / 2 - 2), y0 + t + 6.5, -6);
    g.add(box);
  }
  // 前後保桿（俯視梯形，延伸到導輪架）
  const rx = comp.rollerX;
  const rz = c.overallWidth_mm / 2 - c.rollerDiameter_mm / 2;
  for (const sx of [-1, 1]) {
    const pts = [
      [sx * 50, -24],
      [sx * (rx - 3), -rz - 2],
      [sx * (rx + 4), -rz + 3],
      [sx * (rx + 5), -8],
      [sx * (rx + 5), 8],
      [sx * (rx + 4), rz - 3],
      [sx * (rx - 3), rz + 2],
      [sx * 50, 24],
    ];
    const ordered = sx > 0 ? pts : pts.slice().reverse();
    const circle = (cx, cz, r) => Array.from({ length: 12 }, (_, k) => [cx + r * Math.cos((k / 12) * Math.PI * 2), cz + r * Math.sin((k / 12) * Math.PI * 2)]);
    const bumperHoles = [roundedRect(sx * (rx - 12), 0, 12, 22, 3), circle(sx * (rx - 6), -rz + 11, 1.6), circle(sx * (rx - 6), rz - 11, 1.6), circle(sx * (rx - 1), -16, 1.3), circle(sx * (rx - 1), 16, 1.3)];
    const bumper = extrudeXZ(ordered, 2.4, mats.chassis, bumperHoles);
    bumper.position.y = c.rollerCenterHeight_mm - 4.6;
    bumper.castShadow = true;
    g.add(bumper);
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

  // 雙軸馬達（置中、軸向沿 x）
  const m = comp.motor;
  const can = new THREE.Mesh(new THREE.CylinderGeometry(m.dia / 2, m.dia / 2, m.length - 6, 32), mats.motorCan);
  // 130 馬達外殼的平面在上下（MA 平放），所以壓扁的是世界 y 方向（旋轉前的局部 x）
  can.scale.set(m.flat / m.dia, 1, 1);
  can.rotation.z = Math.PI / 2;
  can.position.set(m.x + 3, m.y, m.z);
  g.add(can);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(m.dia / 2 - 0.3, m.dia / 2 - 0.3, 6, 32), mats.motorCap);
  cap.scale.set(m.flat / m.dia, 1, 1);
  cap.rotation.z = Math.PI / 2;
  cap.position.set(m.x - m.length / 2 + 3, m.y, m.z);
  g.add(cap);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, c.wheelbase_mm - 14, 10), mats.steel);
  shaft.rotation.z = Math.PI / 2;
  shaft.position.set(0, m.y, m.z);
  g.add(shaft);

  // 齒輪組：小齒輪（紫）→ 中間齒輪（綠）→ 冠狀齒輪（粉紅）在輪軸上
  for (const sx of [-1, 1]) {
    const pin = gear(2.6, 8, 4, mats.pinion);
    pin.rotation.y = Math.PI / 2;
    pin.position.set(sx * (m.length / 2 + 5), m.y, m.z);
    g.add(pin);
    const cnt = gear(6.8, 20, 3.5, mats.counter);
    cnt.rotation.y = Math.PI / 2;
    cnt.position.set(sx * (m.length / 2 + 10), m.y + 1, m.z - 8);
    g.add(cnt);
    const spur = gear(7.5, 22, 3, mats.spur);
    spur.position.set(sx * (c.wheelbase_mm / 2), spec.tire.diameter_mm / 2, -10);
    g.add(spur);
  }

  // 電池（兩顆 AA，置於馬達兩側）
  const b = comp.battery;
  for (const z of b.zs) {
    const cell = new THREE.Mesh(new THREE.CylinderGeometry(b.dia / 2, b.dia / 2, b.length, 28), mats.battery);
    cell.rotation.z = Math.PI / 2;
    cell.position.set(b.x, b.y, z);
    g.add(cell);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 1.2, 12), mats.steel);
    tip.rotation.z = Math.PI / 2;
    tip.position.set(b.x + b.length / 2 + 0.6, b.y, z);
    g.add(tip);
  }

  // 輪軸（2 mm 鋼軸）與 620 軸承座
  for (const w of wheelLayout().filter((q) => q.z > 0)) {
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, c.trackWidth_mm + 4, 10), mats.steel);
    axle.rotation.x = Math.PI / 2;
    axle.position.set(w.x, w.y, 0);
    g.add(axle);
    for (const sz of [-1, 1]) {
      const brg = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 2.5, 18), mats.steel);
      brg.rotation.x = Math.PI / 2;
      brg.position.set(w.x, w.y, sz * 22);
      g.add(brg);
    }
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
    const mesh = new THREE.Mesh(flat, plasticMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
  }
  // 路面：沿中心線鋪設的帶狀網格（灰色 ABS）
  const P = track.dims.pitch;
  const halfW = 1.5 * P + 0.02;
  const n = Math.ceil(track.path.length / 0.02);
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
  floorGeo.computeVertexNormals();
  const floor = new THREE.Mesh(floorGeo, plasticMat);
  floor.receiveShadow = true;
  floor.position.y = 0.2;
  g.add(floor);

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
