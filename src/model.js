// Three.js 程序化模型：中置雙軸馬達底盤的 1/32 迷你四驅車（底盤＋可換車殼）＋賽道
// 單位 mm；車體座標 x 向前、y 向上、z 向右，原點在前後軸中點的地面上
// 第二階段：所有尺寸來自組裝結果（assembly.js 的 asm.spec，由零件資料組成）與 carLayout.js（與物理共用）
import * as THREE from 'three';
import { wheelLayout, componentLayout } from './carLayout.js';
import { assemble, loadConfig, rollerLayoutOf, singleShaftTrain } from './assembly.js';
import { getPart } from './parts/index.js';
import { bumperGeometry, inBumperPolygon } from './parts/bumperGeom.js';
import { chassisSideGeometry } from './parts/chassisGeom.js';

/** 車殼卡榫與開關位置（底盤座標，取自底盤零件資料） */
const BODY_MOUNTS = getPart('chassis-midship').bodyMounts;
const SWITCH_POS = getPart('chassis-midship').switchPos_mm;
// B14：VZ 底盤（後置單軸）另有自己的模型（buildChassisVZ）

/**
 * 建模期間使用的整車規格（buildCarModel 開頭設為 asm.spec；建模是同步的，模組內的函式共用這一份）
 * @type {any}
 */
let spec = null;
/**
 * 建模期間使用的組裝結果（buildCarModel 開頭設定；選配零件、導輪板外形從這裡取）
 * @type {any}
 */
let asmCur = null;

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

/** @type {Map<string, THREE.Texture>} 程序化貼圖快取（每次換件重建模型時不重算） */
const textureCache = new Map();

/** @type {(key: string, make: () => THREE.Texture) => THREE.Texture} */
function cachedTexture(key, make) {
  let t = textureCache.get(key);
  if (!t) {
    t = make();
    textureCache.set(key, t);
  }
  return t;
}

/**
 * 碳纖斜紋（2/2 twill）貼圖（DataTexture，Node 測試環境也能建立）：每格是一束纖維，橫束 / 直束交錯，
 * 束內依纖維方向做亮度起伏（模擬清漆下纖維束的反光）。一張貼圖 8 × 8 格
 * @type {() => THREE.DataTexture}
 */
function carbonWeaveTexture() {
  const cell = 8;
  const n = 8;
  const w = cell * n;
  const data = new Uint8Array(w * w * 4);
  for (let j = 0; j < w; j++) {
    for (let i = 0; i < w; i++) {
      const cx = Math.floor(i / cell);
      const cy = Math.floor(j / cell);
      const horizontal = (((cx - cy) % 4) + 4) % 4 < 2;
      // 束內位置 0..1：橫束看 y、直束看 x（束寬方向的圓弧亮度）＋沿纖維方向的細紋
      const across = horizontal ? (j % cell) / (cell - 1) : (i % cell) / (cell - 1);
      const along = horizontal ? i : j;
      const bulge = Math.sin(Math.PI * across);
      const fine = 0.5 + 0.5 * Math.sin(along * 2.1 + (horizontal ? cy : cx) * 1.7);
      const v = Math.round(18 + 52 * bulge * (horizontal ? 1.0 : 0.62) + 8 * fine);
      const k = (j * w + i) * 4;
      data[k] = v;
      data[k + 1] = v;
      data[k + 2] = Math.min(255, v + 3);
      data[k + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, w, w, THREE.RGBAFormat);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  // 擠出板件的 UV 以 mm 為單位：一張貼圖 = 12 mm（每束約 1.5 mm，3K 斜紋常見尺寸，推估）
  t.repeat.set(1 / 12, 1 / 12);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

/**
 * FRP（玻纖環氧板）貼圖：灰色底上有隨機方向的短玻纖紋與淡淡的雲狀深淺（固定種子，可重現）
 * @type {() => THREE.DataTexture}
 */
function frpFiberTexture() {
  const w = 128;
  const data = new Float32Array(w * w).fill(0);
  let seed = 4242;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  // 短纖維：隨機起點、隨機方向、長 6–20 px 的亮線
  for (let f = 0; f < 420; f++) {
    let x = rand() * w;
    let y = rand() * w;
    const a = rand() * Math.PI;
    const len = 6 + rand() * 14;
    const amp = 0.25 + rand() * 0.35;
    for (let t = 0; t < len; t++) {
      const ix = ((Math.floor(x) % w) + w) % w;
      const iy = ((Math.floor(y) % w) + w) % w;
      data[iy * w + ix] += amp;
      x += Math.cos(a);
      y += Math.sin(a);
    }
  }
  const out = new Uint8Array(w * w * 4);
  for (let k = 0; k < w * w; k++) {
    const i = k % w;
    const j = Math.floor(k / w);
    const cloud = 0.5 + 0.25 * Math.sin(i * 0.11 + Math.sin(j * 0.07) * 2) + 0.25 * Math.sin(j * 0.09 + Math.sin(i * 0.05) * 2);
    const v = Math.min(255, Math.round(170 + 22 * cloud + 26 * Math.min(1, data[k])));
    out[k * 4] = v;
    out[k * 4 + 1] = Math.min(255, v + 4);
    out[k * 4 + 2] = Math.min(255, v + 6);
    out[k * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(out, w, w, THREE.RGBAFormat);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  // 一張貼圖 = 24 mm
  t.repeat.set(1 / 24, 1 / 24);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

/**
 * 發泡海綿表面（細小氣孔的明暗雜訊），給煞車海綿當 bump / 顏色貼圖
 * @type {() => THREE.DataTexture}
 */
function spongePoreTexture() {
  const w = 64;
  const data = new Uint8Array(w * w * 4);
  let seed = 777;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  for (let k = 0; k < w * w; k++) {
    const v = rand() < 0.18 ? Math.round(150 + 40 * rand()) : Math.round(225 + 30 * rand());
    data[k * 4] = v;
    data[k * 4 + 1] = v;
    data[k * 4 + 2] = v;
    data[k * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(data, w, w, THREE.RGBAFormat);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 8, 1 / 8);
  t.needsUpdate = true;
  return t;
}

/**
 * 海綿氣孔貼圖（iter-55：reviewer「煞車海綿只是一個平塊」）：淺底色上隨機分佈的圓形氣孔（中心深、邊緣漸淡），
 * 一張貼圖 = 4 mm 見方（repeat 1/4，ExtrudeGeometry 的 UV 以 mm 為單位）→ 氣孔直徑約 0.25–0.6 mm（發泡海綿的開孔尺寸，推估）
 * @type {() => THREE.DataTexture}
 */
function spongeCellTexture() {
  const w = 128;
  const data = new Uint8Array(w * w * 4);
  let seed = 4242;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const val = new Float32Array(w * w).fill(1);
  for (let k = 0; k < 260; k++) {
    const cx = rand() * w;
    const cy = rand() * w;
    const r = 4 + rand() * 6;
    const depth = 0.35 + 0.35 * rand();
    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
      for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
        const d = Math.hypot(dx, dy) / r;
        if (d > 1) {
          continue;
        }
        // 平鋪：座標取模，貼圖邊緣無接縫
        const x = (Math.floor(cx + dx) + w) % w;
        const y = (Math.floor(cy + dy) + w) % w;
        val[y * w + x] = Math.min(val[y * w + x], 1 - depth * (1 - d * d));
      }
    }
  }
  for (let k = 0; k < w * w; k++) {
    const v = Math.round(255 * Math.max(0, Math.min(1, val[k] - 0.04 * rand())));
    data[k * 4] = v;
    data[k * 4 + 1] = v;
    data[k * 4 + 2] = v;
    data[k * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(data, w, w, THREE.RGBAFormat);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 4, 1 / 4);
  t.needsUpdate = true;
  return t;
}

/** 建立材質集合 */
function makeMaterials() {
  return {
    // iter-06：黑塑膠與橡膠胎粗糙度區分——底盤 ABS 半光（roughness 0.4＋薄清漆，邊緣有亮線），
    // 深色內層件平光（0.75），輪胎橡膠全霧（0.96，見 tire）
    // iter-34：底盤改深槍灰（ref_ma-chassis 為深灰成型件，純黑時肋條與倒角在棚拍光下看不出來）
    chassis: new THREE.MeshPhysicalMaterial({ name: 'abs-chassis-gunmetal', color: 0x4a4e55, roughness: 0.45, metalness: 0.05, clearcoat: 0.3, clearcoatRoughness: 0.35 }),
    chassisDark: new THREE.MeshStandardMaterial({ color: 0x212226, roughness: 0.75, metalness: 0.0 }),
    // iter-42：黑色 ABS 分件（電池艙頂蓋、齒輪箱外殼、馬達固定扣），和深槍灰主框做兩色分件（reviewer iter-41：「全部同一種深灰」）
    chassisBlack: new THREE.MeshPhysicalMaterial({ name: 'abs-chassis-black', color: 0x18191c, roughness: 0.42, metalness: 0.0, clearcoat: 0.35, clearcoatRoughness: 0.3 }),
    body: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.35, clearcoat: 1.0, clearcoatRoughness: 0.08 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x15181d, roughness: 0.05, metalness: 0.2, clearcoat: 1.0 }),
    // iter-03：輪胎橡膠粗糙感（程序化雜訊 bump＋roughness 貼圖），顏色由死黑提亮到深炭灰
    tire: new THREE.MeshStandardMaterial({ color: 0x232325, roughness: 0.96, metalness: 0.0, bumpMap: rubberNoiseTexture(), bumpScale: 0.6, roughnessMap: rubberNoiseTexture(), envMapIntensity: 0.6 }),
    tireTread: new THREE.MeshStandardMaterial({ color: 0x161617, roughness: 0.97, metalness: 0.0 }),
    // 第四階段：海綿胎（細孔發泡、全霧）、超硬 / 拱形硬胎（硬膠，表面略亮）
    tireSponge: new THREE.MeshStandardMaterial({ name: 'sponge-tire', color: 0x2b2b2e, map: cachedTexture('sponge-cell', spongeCellTexture), bumpMap: cachedTexture('sponge-cell', spongeCellTexture), bumpScale: 1.0, roughness: 1.0, metalness: 0.0 }),
    tireHard: new THREE.MeshStandardMaterial({ name: 'tire-hard', color: 0x2a2a2d, roughness: 0.62, metalness: 0.0, envMapIntensity: 0.8 }),
    // 穩定零件（POM 樹脂，白色半霧）
    stabPom: new THREE.MeshPhysicalMaterial({ name: 'pom-stabilizer', color: 0xe9e7e0, roughness: 0.45, metalness: 0.0, clearcoat: 0.2, clearcoatRoughness: 0.5 }),
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
    // iter-35：鋁合金導輪（roller 零件 finish = 'aluminum'，例如 roller-19）：車削鋁的亮銀色
    rollerAlu: new THREE.MeshPhysicalMaterial({ name: 'metal-roller-aluminum', color: 0xc4c9d0, roughness: 0.28, metalness: 0.95, side: THREE.DoubleSide }),
    // iter-99（評審 iter-97：單向輪黑色內轂＋黑色分隔縫看不出兩件）：內轂改槍灰緞面（與淺灰輪框、黑縫三種明度；顏色推估，官方頁沒寫）
    onewayHub: new THREE.MeshPhysicalMaterial({ name: 'paint-gunmetal-oneway-hub', color: 0x5f656e, roughness: 0.4, metalness: 0.35, clearcoat: 0.3, clearcoatRoughness: 0.3 }),
    screw: new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.25, metalness: 1.0 }),
    // 第三階段改裝零件（material.name 給 Blender 管線分類：frp-*、carbon-*、alu-*、sponge-*、*-weight）
    // iter-47：FRP 板加短玻纖紋（frpFiberTexture）、碳纖板加斜紋貼圖（carbonWeaveTexture）；reviewer iter-46「只是平塗的灰色、黑色」
    frpPlate: new THREE.MeshPhysicalMaterial({ name: 'frp-gray', color: 0x7c8488, map: cachedTexture('frp', frpFiberTexture), roughness: 0.62, metalness: 0.0, clearcoat: 0.25, clearcoatRoughness: 0.45 }),
    carbonPlate: new THREE.MeshPhysicalMaterial({ name: 'carbon-plate', color: 0xffffff, map: cachedTexture('carbon', carbonWeaveTexture), roughness: 0.3, metalness: 0.15, clearcoat: 1.0, clearcoatRoughness: 0.08 }),
    aluSpacer: new THREE.MeshStandardMaterial({ name: 'alu-spacer', color: 0xb9bec6, roughness: 0.3, metalness: 0.9 }),
    // iter-47：黃銅再亮一點（app 沒有環境貼圖時金屬會偏暗，reviewer iter-46「很小的金色圓柱，不容易認出來」）
    // iter-82（reviewer：app 截圖的黃銅像平光土黃）：粗糙度 0.26 → 0.18、環境反射加強，看得出金屬亮面
    // iter-85：拿掉自發光（讓黃銅變平光）、metalness 1、較飽和的金色、環境反射加強 → 灰色棚拍環境下也有金屬高光與暗面
    brassWeight: new THREE.MeshStandardMaterial({ name: 'brass-weight', color: 0xf3c35a, roughness: 0.22, metalness: 1.0, envMapIntensity: 2.2 }),
    nylonCap: new THREE.MeshStandardMaterial({ name: 'plastic-nylon-cap', color: 0x34373c, roughness: 0.55, metalness: 0.0 }),
    // iter-50：板件切口（側面與孔壁）另用一個材質，讓 1.5 mm 板厚與孔緣看得出來：FRP 切口偏白（玻纖斷面）、碳纖切口霧灰
    frpEdge: new THREE.MeshStandardMaterial({ name: 'frp-edge', color: 0xc4c9c6, roughness: 0.8, metalness: 0.0 }),
    carbonEdge: new THREE.MeshStandardMaterial({ name: 'carbon-plate-edge', color: 0x5d6166, roughness: 0.75, metalness: 0.05 }),
    aluNut: new THREE.MeshStandardMaterial({ name: 'alu-nut-blue', color: 0x3f6fb8, roughness: 0.3, metalness: 0.85 }),
    // iter-61：滑動保桿的鋁滑動板（髮絲面霧銀，切口較亮）與樹脂滑軌（黑色低摩擦樹脂）
    aluPlate: new THREE.MeshStandardMaterial({ name: 'alu-plate', color: 0xc9ced5, roughness: 0.36, metalness: 0.85 }),
    aluPlateEdge: new THREE.MeshStandardMaterial({ name: 'alu-plate-edge', color: 0xe4e7eb, roughness: 0.25, metalness: 0.9 }),
    slideRail: new THREE.MeshStandardMaterial({ name: 'plastic-slide-rail', color: 0x1d1f23, roughness: 0.45, metalness: 0.0 }),
    steelWeight: new THREE.MeshStandardMaterial({ name: 'steel-weight', color: 0xc3c8ce, roughness: 0.3, metalness: 0.85, emissive: 0x15171a }),
    // iter-55：煞車海綿改用較大的開孔氣孔貼圖（spongeCellTexture），bump 加深，看得出發泡孔隙
    spongeWhite: new THREE.MeshStandardMaterial({ name: 'sponge-white', color: 0xf8f6ee, map: cachedTexture('sponge-cell', spongeCellTexture), bumpMap: cachedTexture('sponge-cell', spongeCellTexture), bumpScale: 1.2, roughness: 1.0, metalness: 0.0, emissive: 0x2a2a26 }),
    // 第七階段（iter-78）：灰色海綿（15441 三種摩擦海綿，顏色與摩擦的對應官方沒寫 → 三款都畫灰色）
    spongeGray: new THREE.MeshStandardMaterial({ name: 'sponge-gray', color: 0x8a8c90, map: cachedTexture('sponge-cell', spongeCellTexture), bumpMap: cachedTexture('sponge-cell', spongeCellTexture), bumpScale: 1.2, roughness: 1.0, metalness: 0.0, emissive: 0x111214 }),
    spongeBlue: new THREE.MeshStandardMaterial({ name: 'sponge-blue', color: 0x3c86f0, map: cachedTexture('sponge-cell', spongeCellTexture), bumpMap: cachedTexture('sponge-cell', spongeCellTexture), bumpScale: 1.2, roughness: 1.0, metalness: 0.0, emissive: 0x06142a }),
    // 雙面膠層（海綿與煞車板之間，淡琥珀色、半光澤，和海綿的霧面白區分）
    tape: new THREE.MeshStandardMaterial({ name: 'tape-double-sided', color: 0xe6d29a, roughness: 0.35, metalness: 0.0 }),
    // 中空不鏽鋼輪軸（較亮的緞面不鏽鋼）與中孔內壁（暗）
    stainless: new THREE.MeshStandardMaterial({ name: 'metal-stainless', color: 0xdfe3e8, roughness: 0.18, metalness: 1.0 }),
    boreDark: new THREE.MeshStandardMaterial({ name: 'bore-dark', color: 0x0c0c0e, roughness: 0.8, metalness: 0.2 }),
    light: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x99aabb, emissiveIntensity: 0.3, roughness: 0.2 }),
  };
}

/** 以俯視輪廓擠出板件（shape 在 x-z 平面，y 方向厚度） */
function extrudeXZ(points, thickness, material, holes = [], bevel = 0) {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const h of holes) {
    shape.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))));
  }
  // iter-34：可選倒角（射出件邊緣圓角）；倒角往外長 bevel，厚度維持 thickness（底面在 0、頂面在 thickness）
  let opts = { depth: thickness, bevelEnabled: false, curveSegments: 12 };
  if (bevel > 0) {
    opts = { depth: Math.max(0.01, thickness - 2 * bevel), bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelOffset: -bevel * 0.8, bevelSegments: 3, curveSegments: 12 };
  }
  const geo = new THREE.ExtrudeGeometry(shape, opts);
  if (bevel > 0) {
    geo.translate(0, 0, bevel);
  }
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

/** @type {number} slick 胎側壁平面的外緣（佔胎壁高度的比例；其餘是胎肩小圓角），iter-97 */
const SLICK_SHOULDER = 0.8;

/** 輪子：low profile 輪胎（Lathe）＋ Y 字幅輪框 */
function buildWheel(mats, side) {
  const g = new THREE.Group();
  const R = spec.tire.diameter_mm / 2;
  const w = spec.tire.width_mm;
  const rr = spec.tire.rimDiameter_mm / 2;
  // 輪胎截面（繞 y 軸旋轉後再轉到 z 軸）
  const prof = [];
  const n = 72;
  // 第四階段：胎面種類（零件 tread）——rubber 橡膠（溝槽）、hard 超硬（溝槽、較亮）、sponge 海綿（平胎面、方肩、無溝槽）、
  // barrel 拱形（斷面圓弧，半徑 crownRadius_mm，中央接地）
  const tread = spec.tire.tread ?? 'rubber';
  const crownR = spec.tire.crownRadius_mm ?? 6;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const y = -w / 2 + t * w;
    const edge = Math.min(t, 1 - t);
    let r;
    if (tread === 'sponge') {
      // 海綿：幾乎方形的斷面（只有 0.3 mm 小圓角）
      r = rr + (R - rr) * Math.min(1, 0.85 + edge * 6);
    } else if (tread === 'slick') {
      // 第七階段（iter-76）：slick 胎——胎面沒有溝槽。
      // iter-97（評審 iter-84：胎壁偏厚、肩部圓角像軟胎）：硬質 slick 用近直角胎肩（側壁平面到 0.8，約 0.25 mm 小圓角），
      // 側面看得到的胎壁就是資料上的 輪框 / 外徑（24.2 / 31 = 0.78）
      r = rr + (R - rr) * Math.min(1, SLICK_SHOULDER + edge * 8);
    } else if (tread === 'barrel') {
      // 拱形：圓弧 r = R − (crownR − √(crownR² − y²))，胎肩處不低於輪框外 0.4 mm
      const yy = Math.min(Math.abs(y), crownR * 0.98);
      r = Math.max(rr + 0.4, R - (crownR - Math.sqrt(crownR * crownR - yy * yy)));
    } else {
      // 胎面略帶圓角（胎肩）＋三條圓周溝槽（橡膠胎紋，深 0.3 mm）
      r = rr + (R - rr) * Math.min(1, 0.55 + edge * 4.5);
      for (const tc of [0.3, 0.5, 0.7]) {
        r -= 0.3 * Math.exp(-(((t - tc) / 0.022) ** 2));
      }
    }
    prof.push(new THREE.Vector2(r, y));
  }
  prof.push(new THREE.Vector2(rr, w / 2));
  prof.unshift(new THREE.Vector2(rr, -w / 2));
  const tireGeo = new THREE.LatheGeometry(prof, 64);
  tireGeo.rotateX(Math.PI / 2);
  /** @type {Record<string, THREE.Material>} */
  const treadMats = { sponge: mats.tireSponge, hard: mats.tireHard, barrel: mats.tireHard, slick: mats.tireHard };
  let tireMat = treadMats[tread] ?? mats.tire;
  // 第七階段（iter-76）：零件指定胎色（例如白色硬質 slick、透明軟質 slick）時，複製胎面材質換顏色（材質名稱不變，Blender 分類照舊）
  if (spec.tire.tireColor !== undefined) {
    tireMat = tireMat.clone();
    /** @type {THREE.MeshStandardMaterial} */ (tireMat).color.setHex(spec.tire.tireColor);
  }
  g.add(new THREE.Mesh(tireGeo, tireMat));

  // 輪框：外圈＋5 組 Y 字幅條
  const rimRing = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, w * 0.9, 40, 1, true), mats.rimBarrel);
  rimRing.rotation.x = Math.PI / 2;
  g.add(rimRing);
  const face = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 1.6, 20), mats.rim);
  hub.rotation.x = Math.PI / 2;
  face.add(hub);
  // iter-35：輪轂中心露出 2 mm 六角輪軸端（reviewer iter-34：「輪轂中心沒有細節」；實車輪框中心孔可看到六角軸頭）
  const hubRing = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.35, 8, 24), mats.rim);
  hubRing.position.z = side * 0.85;
  face.add(hubRing);
  // iter-55：中空輪軸（零件 boreDiameter_mm > 0）：不鏽鋼軸端凸出輪轂 0.6 mm，端面看得到中孔（暗色孔＋倒角亮環），孔徑取自零件資料
  const axlePart = asmCur?.partsBySlot?.axles;
  const bore = axlePart?.boreDiameter_mm ?? 0;
  // 軸端最外到 z = 1.6（face 內）→ 離輪子中心 4.48 mm，仍在胎寬 9 mm 之內，不改變外框
  const hexLen = bore > 0 ? 2.0 : 1.6;
  const hexEnd = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, hexLen, 6), bore > 0 ? mats.stainless : mats.steel);
  hexEnd.rotation.x = Math.PI / 2;
  hexEnd.position.z = side * 0.6;
  face.add(hexEnd);
  if (bore > 0) {
    const endZ = side * (0.6 + hexLen / 2 + 0.01);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(bore / 2, 24), mats.boreDark);
    hole.position.z = endZ + side * 0.005;
    hole.rotation.y = side > 0 ? 0 : Math.PI;
    face.add(hole);
    const chamfer = new THREE.Mesh(new THREE.RingGeometry(bore / 2, bore / 2 + 0.22, 24), mats.screw);
    chamfer.position.z = endZ;
    chamfer.rotation.y = side > 0 ? 0 : Math.PI;
    face.add(chamfer);
  }
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
  // 第四階段：輕量鏤空輪框（rimStyle = lightweight，腹板挖掉 rimWebCutout）→ 輻條寬度依剩餘比例縮小（與 inertia.js 的腹板質量同一個比例）
  const spokeScale = spec.tire.rimStyle === 'lightweight' ? Math.max(0.35, 1 - (spec.tire.rimWebCutout ?? 0)) : 1;
  const lightweight = spec.tire.rimStyle === 'lightweight';
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    const spoke = new THREE.Group();
    if (lightweight) {
      // iter-55：輕量鏤空輪框——Y 字輻條的分岔臂與腹板都挖掉，只留 5 支細直輻（寬 = 標準主幹 × 剩餘比例），
      // 輻條之間是貫穿的大開口（背板與內側補強肋也不畫，看得到裡面的輪轂與底盤），和標準輪框的密集 Y 字輻對比明顯
      const wSp = Math.max(0.7, 2.0 * spokeScale);
      spoke.add(curvedArm([2.2, 0], [(2.2 + rimIn) / 2, 0.25 * side], [rimIn + 0.2, 0.5 * side], wSp * 1.15, wSp));
    } else {
      // 主幹（輪轂 → 分岔點）
      spoke.add(curvedArm([2.2, 0], [3.6, 0.15 * side], [4.9, 0.35 * side], 2.3, 1.9));
      // 兩支分岔臂：同向彎曲（twist），外端在輪框內緣
      for (const sgn of [-1, 1]) {
        const ang = sgn * 0.36 + 0.16 * side;
        spoke.add(curvedArm([4.7, 0.35 * side], [6.9, sgn * 1.0 + 0.9 * side], [Math.cos(ang) * rimIn, Math.sin(ang) * rimIn], 1.25, 1.0));
      }
    }
    spoke.rotation.z = a;
    face.add(spoke);
  }
  if (lightweight) {
    // 開口內緣的加強環（輪轂外圈）：鏤空後輪轂周圍留一圈 0.5 mm 的肋
    const hubRib = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.32, 8, 32), mats.rim);
    face.add(hubRib);
  }
  if (spec.tire.rimStyle === 'oneway') {
    // 第七階段（iter-79）：單向輪框——輪框與中央內轂是兩件（內轂裝在輪軸上，輪框可以相對內轂往前空轉）：
    // 內轂比一般輪轂大（φ7.4，內含單向離合），外圈一道暗色分隔縫，轂面 8 道棘輪狀凸肋（示意內部棘爪；實際棘爪在內部看不到）
    // iter-82（reviewer：內轂與輪框同色看不出兩件）：內轂用黑色塑膠（顏色推估：官方頁沒寫內轂顏色），分隔縫加寬到 0.7 mm
    // iter-97（評審 iter-84：縫太細、棘輪肋太小）：分隔縫 1.0 mm、棘輪肋放大（外觀示意，不影響質量 / 物理）
    const clutchHub = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 1.9, 32), mats.onewayHub);
    clutchHub.rotation.x = Math.PI / 2;
    clutchHub.position.z = side * 0.15;
    face.add(clutchHub);
    const gap = new THREE.Mesh(new THREE.RingGeometry(3.6, 4.6, 40), mats.boreDark);
    gap.position.z = side * 0.62;
    gap.rotation.y = side > 0 ? 0 : Math.PI;
    face.add(gap);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 0.5), mats.rim);
      tooth.position.set(Math.cos(a) * 2.9, Math.sin(a) * 2.9, side * 1.2);
      // 棘輪齒：沿切線方向略斜，看得出單一旋轉方向
      tooth.rotation.z = a + Math.PI / 2 + 0.5;
      face.add(tooth);
    }
  }
  // 輪框外緣凸緣（面向外側的金屬唇邊）
  const flange = new THREE.Mesh(new THREE.TorusGeometry(rr - 0.35, 0.45, 8, 40), mats.rim);
  flange.position.z = side * 0.6;
  face.add(flange);
  face.position.z = side * (w * 0.32);
  g.add(face);
  // iter-07：外側壁貼片（胎壁平面 r = rr … rr + 0.55 (R − rr)，略浮 0.06 mm）
  // iter-97：slick 胎肩改方正後，黑色字樣帶仍只到 0.55（評審：拉到胎肩會讓白胎從斜前方看像黑胎），0.55–0.8 露出胎色
  const wallOuter = rr + 0.55 * (R - rr);
  const wall = new THREE.Mesh(new THREE.RingGeometry(rr + 0.05, wallOuter - 0.05, 96, 1), mats.tireWall);
  wall.position.z = side * (w / 2 + 0.06);
  wall.rotation.y = side > 0 ? 0 : Math.PI;
  wall.userData.wallOuter = wallOuter;
  g.add(wall);
  // 背板：標準輪框的腹板（暗色）。輕量鏤空輪框腹板已挖掉 → 不畫，開口可以看穿
  if (!lightweight) {
    const back = new THREE.Mesh(new THREE.CircleGeometry(rr, 32), mats.chassisDark);
    back.position.z = -side * (w * 0.2);
    back.rotation.y = side > 0 ? 0 : Math.PI;
    g.add(back);
  }
  // iter-51：輪框內側（reviewer：底視缺培林與輪軸細節）：內側輪轂凸台＋六角軸孔（輪軸六角端插入處）＋5 條補強肋＋內緣唇邊。
  // 全部在輪框半徑與輪胎寬度內，不改變外框
  const innerZ = -side * (w * 0.2);
  const innerHub = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 3.1, 1.4, 24), mats.rim);
  innerHub.rotation.x = Math.PI / 2;
  innerHub.position.z = innerZ - side * 0.7;
  g.add(innerHub);
  const hexSock = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.2, 6), mats.chassisDark);
  hexSock.rotation.x = Math.PI / 2;
  hexSock.position.z = innerZ - side * 1.41;
  g.add(hexSock);
  for (let k = 0; k < (lightweight ? 0 : 5); k++) {
    const a = (k / 5) * Math.PI * 2 + 0.3;
    const rib = new THREE.Mesh(new THREE.BoxGeometry(rr - 3.4, 0.8, 0.9), mats.rimBarrel);
    rib.position.set(Math.cos(a) * (3.1 + (rr - 3.4) / 2), Math.sin(a) * (3.1 + (rr - 3.4) / 2), innerZ - side * 0.45);
    rib.rotation.z = a;
    g.add(rib);
  }
  const innerLip = new THREE.Mesh(new THREE.TorusGeometry(rr - 0.3, 0.3, 8, 40), mats.rim);
  innerLip.position.z = -side * (w * 0.45 - 0.3);
  g.add(innerLip);
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
 * 滾珠培林導輪（第五階段 iter-59：15344 / 15345）：鋼外圈（四角倒角）＋上下黑色防塵蓋＋鋼內圈，外圈外緣 = 接觸半徑 R；
 * 頂部墊片與螺絲頭、底部墊片與螺帽同一般導輪（opt.bare 時不畫底部）
 * @type {(mats: ReturnType<typeof makeMaterials>, r: { x: number, y: number, z: number, r: number, h: number }, opt?: { bare?: boolean }) => THREE.Group}
 */
const buildBearingRoller = (mats, r, opt = {}) => {
  const g = new THREE.Group();
  const R = r.r;
  const H = r.h / 2;
  // 外圈厚度約外徑的 12%、內圈內徑 3 mm（推估，PARTS_RESEARCH AA 節）
  const outerIn = R - Math.max(0.8, R * 0.24);
  const innerOut = 2.3;
  const innerIn = 1.5;
  const c = 0.25;
  /** @type {number[][]} 外圈截面（r, y） */
  const outerProf = [
    [outerIn, H],
    [R - c, H],
    [R, H - c],
    [R, -H + c],
    [R - c, -H],
    [outerIn, -H],
  ];
  g.add(new THREE.Mesh(new THREE.LatheGeometry(outerProf.map(([a, b]) => new THREE.Vector2(a, b)).reverse(), 40), mats.steel));
  const innerRing = new THREE.Mesh(new THREE.CylinderGeometry(innerOut, innerOut, r.h, 24, 1, true), mats.steel);
  g.add(innerRing);
  for (const sy of [-1, 1]) {
    const faceRot = sy > 0 ? -Math.PI / 2 : Math.PI / 2;
    // 防塵蓋比外圈端面低 0.15 mm
    const shield = new THREE.Mesh(new THREE.RingGeometry(innerOut, outerIn, 40), mats.chassisDark);
    shield.rotation.x = faceRot;
    shield.position.y = sy * (H - 0.15);
    g.add(shield);
    const inner = new THREE.Mesh(new THREE.RingGeometry(innerIn, innerOut, 24), mats.steel);
    inner.rotation.x = faceRot;
    inner.position.y = sy * H;
    g.add(inner);
  }
  const washer = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.4, 24), mats.steel);
  washer.position.y = H + 0.2;
  g.add(washer);
  const head = new THREE.Mesh(new THREE.SphereGeometry(2.0, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), mats.screw);
  head.scale.y = 0.5;
  head.position.y = H + 0.4;
  g.add(head);
  if (!opt.bare) {
    const spacer = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 0.9, 20), mats.steel);
    spacer.position.y = -H - 0.45;
    g.add(spacer);
    const nut = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 1.4, 6), mats.steel);
    nut.position.y = -H - 1.6;
    g.add(nut);
  }
  g.position.set(r.x, r.y, r.z);
  return g;
};

/** @type {Map<string, THREE.Material>} 導輪外環材質（依材料與顏色共用；名稱給 web/export.js 對應 Blender 材質類別：rubber / plastic） */
const rollerRingMats = new Map();

/**
 * 導輪外環（第五階段）：橡膠 O 環是圓截面的環（TorusGeometry），塑膠環是矩形截面（四角倒圓 0.2 mm）的環；外緣半徑 = 接觸半徑 R
 * @type {(ring: import('./parts/types').RollerRing, R: number) => THREE.Mesh}
 */
const buildRollerRing = (ring, R) => {
  const key = `${ring.material}|${ring.color}`;
  let mat = rollerRingMats.get(key);
  if (!mat) {
    if (ring.material === 'rubber') {
      mat = new THREE.MeshStandardMaterial({ name: 'rubber-roller-ring', color: ring.color, roughness: 0.9, metalness: 0.0 });
    } else {
      mat = new THREE.MeshPhysicalMaterial({ name: 'plastic-roller-ring', color: ring.color, roughness: 0.42, metalness: 0.0, clearcoat: 0.2 });
    }
    rollerRingMats.set(key, mat);
  }
  if (ring.material === 'rubber') {
    const tube = ring.thickness_mm / 2;
    const torus = new THREE.Mesh(new THREE.TorusGeometry(R - tube, tube, 12, 48), mat);
    torus.rotation.x = Math.PI / 2;
    return torus;
  }
  const r0 = R - ring.thickness_mm;
  const h = ring.height_mm / 2;
  const c = 0.2;
  /** @type {number[][]} 截面（r, y），由內上 → 外上 → 外下 → 內下 */
  const prof = [
    [r0, h],
    [R - c, h],
    [R, h - c],
    [R, -h + c],
    [R - c, -h],
    [r0, -h],
  ];
  return new THREE.Mesh(new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a, b)).reverse(), 48), mat);
};

/**
 * 導輪（iter-06 重做；ref_ma-chassis：槍灰色導輪，上下輪緣凸出、中段內縮，頂面內凹看得到培林）：
 * Lathe 截面＝上下輪緣（含倒角）＋中段腰身＋頂底面內凹環；培林分外環（鋼，凸起）／黑色密封蓋（內凹）／內環（鋼）三層；
 * 導輪與臂之間有墊片間隙，頂部墊片＋十字頭螺絲，底部六角螺帽。物理接觸半徑不變（r.r）
 * opt.bare = true：裝在導輪板的導輪柱上（下方的墊片 / 螺帽由 buildStayPlates 的導輪柱負責），不畫底部墊片、螺帽、螺絲尾端
 * iter-56：前後導輪可不同款，材質（r.finish）與錐形輪廓（r.taper）取自這顆導輪自己的零件資料（rollerLayoutOf）
 * @type {(mats: ReturnType<typeof makeMaterials>, r: { x: number, y: number, z: number, r: number, h: number, finish?: string, taper?: import('./parts/types').RollerSpec['taper'], ring?: import('./parts/types').RollerSpec['ring'] }, opt?: { bare?: boolean, noTop?: boolean, noBottomFace?: boolean }) => THREE.Group}
 */
const buildRoller = (mats, r, opt = {}) => {
  // 第五階段：滾珠培林直接當導輪（finish = steel，9 / 11 mm）：外形就是一顆培林
  if (r.finish === 'steel') {
    return buildBearingRoller(mats, r, opt);
  }
  const g = new THREE.Group();
  const R = r.r;
  const H = r.h / 2;
  const recessR = R - 1.1;
  // iter-85：小徑導輪（9 / 8 mm）的培林外環放不進內凹（3.7 > R − 1.1）→ 培林環依內凹等比縮小（k = 1 時和原本相同）
  const brgR = Math.min(3.7, recessR - 0.4);
  const k = brgR / 3.7;
  const recessDepth = 0.7;
  // 截面由頂面內緣 → 外緣 → 底面內緣（r, y）
  /** @type {number[][]} */
  let prof = [
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
  // iter-97（評審 iter-84：9-8 導輪像墊片 / 彈簧疊）：矮片（≤ 3.5 mm，例如 9-8 二段導輪每片 3 mm）不畫中央溝，
  // 只留上下 0.3 mm 倒角——每片看起來是一段實心圓柱，兩片中間的縮腰與 9 / 8 mm 外徑差才看得出來
  if (r.h <= 3.5) {
    prof = [
      [brgR, H - recessDepth],
      [recessR, H - recessDepth],
      [recessR, H],
      [R - 0.3, H],
      [R, H - 0.3],
      [R, -H + 0.3],
      [R - 0.3, -H],
      [recessR, -H],
      [recessR, -H + recessDepth],
      [brgR, -H + recessDepth],
    ];
  }
  // 第四階段：錐形導輪（零件 taper）：上段圓柱 h_c、下段截錐縮到底面半徑 R_b（錐面朝下，與 sim.js rollerWallContacts 同一份幾何）
  const tp = r.taper ?? null;
  if (tp) {
    const Rb = tp.bottomDiameter_mm / 2;
    const yc = H - tp.cylinderHeight_mm;
    const recB = Math.min(recessR, Rb - 0.5);
    prof = [
      [brgR, H - recessDepth],
      [recessR, H - recessDepth],
      [recessR, H],
      [R - 0.3, H],
      [R, H - 0.3],
      [R, yc],
      [Rb, -H + 0.25],
      [Rb - 0.25, -H],
      [recB, -H],
      [recB, -H + recessDepth],
      [brgR, -H + recessDepth],
    ];
  }
  // 第五階段：有外環（橡膠 O 環 / 塑膠環）的導輪：輪轂外緣退到環的內緣，中段挖出環槽，環的外緣 = 接觸直徑 R（零件資料 ring）
  const ring = r.ring ?? null;
  if (ring && !tp) {
    const hubR = R - ring.thickness_mm;
    const flangeR = R - Math.min(0.45, ring.thickness_mm * 0.4);
    const halfRing = ring.height_mm / 2;
    prof = [
      [brgR, H - recessDepth],
      [recessR - 0.8, H - recessDepth],
      [recessR - 0.8, H],
      [flangeR - 0.3, H],
      [flangeR, H - 0.3],
      [flangeR, halfRing + 0.1],
      [hubR, halfRing],
      [hubR, -halfRing],
      [flangeR, -halfRing - 0.1],
      [flangeR, -H + 0.3],
      [flangeR - 0.3, -H],
      [recessR - 0.8, -H],
      [recessR - 0.8, -H + recessDepth],
      [brgR, -H + recessDepth],
    ];
  }
  const bodyGeo = new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a, b)).reverse(), 48);
  // 導輪本體材質依零件：塑膠（黑）或鋁合金（亮銀）
  const body = new THREE.Mesh(bodyGeo, rollerBodyMat(mats, r));
  g.add(body);
  if (ring && !tp) {
    g.add(buildRollerRing(ring, R));
  }
  // iter-85：雙層一體導輪的中間面（上片底面、下片頂面）被縮腰擋住、實物也沒有培林 → 不畫培林面與頂部螺絲
  for (const sy of [-1, 1]) {
    if ((sy > 0 && opt.noTop) || (sy < 0 && opt.noBottomFace)) {
      continue;
    }
    const faceRot = sy > 0 ? -Math.PI / 2 : Math.PI / 2;
    const floorY = sy * (H - recessDepth);
    // 培林外環：凸出內凹底面 0.45 mm 的鋼環（含外側壁）
    const outerWall = new THREE.Mesh(new THREE.CylinderGeometry(brgR, brgR, 0.45, 32, 1, true), mats.steel);
    outerWall.position.y = floorY + sy * 0.225;
    g.add(outerWall);
    const outer = new THREE.Mesh(new THREE.RingGeometry(2.95 * k, brgR, 32), mats.steel);
    outer.rotation.x = faceRot;
    outer.position.y = floorY + sy * 0.45;
    g.add(outer);
    // 黑色密封蓋（比外環低 0.25 mm）＋內側壁
    const sealWall = new THREE.Mesh(new THREE.CylinderGeometry(2.95 * k, 2.95 * k, 0.25, 32, 1, true), mats.steel);
    sealWall.position.y = floorY + sy * 0.325;
    g.add(sealWall);
    const seal = new THREE.Mesh(new THREE.RingGeometry(1.95 * k, 2.95 * k, 32), mats.chassisDark);
    seal.rotation.x = faceRot;
    seal.position.y = floorY + sy * 0.2;
    g.add(seal);
    // 內環（與密封蓋同高再凸 0.15 mm）
    const innerWall = new THREE.Mesh(new THREE.CylinderGeometry(1.95 * k, 1.95 * k, 0.15, 24, 1, true), mats.steel);
    innerWall.position.y = floorY + sy * 0.275;
    g.add(innerWall);
    const inner = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.95 * k, 24), mats.steel);
    inner.rotation.x = faceRot;
    inner.position.y = floorY + sy * 0.35;
    g.add(inner);
  }
  // 頂部墊片（離開導輪頂面 0.2 mm）＋十字頭螺絲（雙層導輪只有最上片有）
  if (opt.noTop) {
    g.position.set(r.x, r.y, r.z);
    return g;
  }
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
  if (opt.bare) {
    g.position.set(r.x, r.y, r.z);
    return g;
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

/**
 * 導輪本體材質：鋁合金（亮銀）或塑膠（預設黑；零件有 color 時用該色，例如 15532 藍色 POM 雙層導輪）
 * @type {(mats: ReturnType<typeof makeMaterials>, r: { finish?: string, color?: number }) => THREE.Material}
 */
const rollerBodyMat = (mats, r) => {
  if (r.finish === 'aluminum') {
    return mats.rollerAlu;
  }
  if (r.color === undefined) {
    return mats.rollerBody;
  }
  const m = mats.rollerBody.clone();
  m.color.setHex(r.color);
  return m;
};

/**
 * 導輪（可能是雙層）：每一片接觸面各建一顆 buildRoller（尺寸取該片的直徑與高度），整組放在導輪中心
 * @type {(mats: ReturnType<typeof makeMaterials>, r: { x: number, y: number, z: number, r: number, h: number, tiers?: { y: number, r: number, h: number }[], finish?: string, taper?: import('./parts/types').RollerSpec['taper'], ring?: import('./parts/types').RollerSpec['ring'] }, opt?: { bare?: boolean }) => THREE.Group}
 */
const buildRollerStack = (mats, r, opt = {}) => {
  const tiers = r.tiers ?? [{ y: 0, r: r.r, h: r.h }];
  if (tiers.length === 1) {
    return buildRoller(mats, { x: r.x, y: r.y + tiers[0].y, z: r.z, r: tiers[0].r, h: tiers[0].h, finish: r.finish, taper: r.taper, ring: r.ring, color: r.color }, opt);
  }
  const g = new THREE.Group();
  // 最上片 / 最下片（依 y）：螺絲頭只在最上片、底部五金只在最下片
  const top = tiers.reduce((bi, tt, j) => (tt.y > tiers[bi].y ? j : bi), 0);
  const bottom = tiers.reduce((bi, tt, j) => (tt.y < tiers[bi].y ? j : bi), 0);
  tiers.forEach((t, i) => {
    // 雙層導輪是一體成形：只有最下層保留底部五金
    // 第七階段（iter-76）：每一片可有自己的外環（例如 15418 上層橡膠環）
    g.add(buildRoller(mats, { x: r.x, y: r.y + t.y, z: r.z, r: t.r, h: t.h, finish: r.finish, taper: r.taper, ring: t.ring ?? r.ring, color: r.color }, { bare: opt.bare || i !== bottom, noTop: i !== top, noBottomFace: i !== bottom }));
  });
  // 兩片之間的縮腰（同材質的短圓柱）
  const ys = tiers.map((t) => r.y + t.y);
  const waistH = Math.max(...ys) - Math.min(...ys);
  const waist = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(...tiers.map((t) => t.r)) - 1.6, Math.min(...tiers.map((t) => t.r)) - 1.6, waistH, 32), rollerBodyMat(mats, r));
  waist.position.set(r.x, (Math.max(...ys) + Math.min(...ys)) / 2, r.z);
  g.add(waist);
  return g;
};

/**
 * 滑動保桿的樹脂滑軌與彈簧（iter-61）：滑軌 = 零件資料 slide.rail 的方塊（鎖在前保桿下方、壓在滑動板上）；
 * 彈簧 = 沿車身 z 的螺旋線圈，左右各 1 支，從滑軌端面（|z| = innerZ）到滑動板上的彈簧座（|z| = outerZ），座在滑動板頂面
 * @type {(mats: ReturnType<typeof makeMaterials>, sl: import('./parts/types').SlideSpec, plateTop: number) => THREE.Group}
 */
const buildSlideRailAndSprings = (mats, sl, plateTop) => {
  const g = new THREE.Group();
  g.name = 'slide-rail';
  const rl = sl.rail;
  const rail = new THREE.Mesh(new THREE.BoxGeometry(rl.xMax_mm - rl.xMin_mm, rl.thickness_mm, 2 * rl.halfZ_mm), mats.slideRail);
  rail.position.set((rl.xMin_mm + rl.xMax_mm) / 2, rl.y_mm + rl.thickness_mm / 2, 0);
  g.add(rail);
  const sp = sl.spring;
  const springMat = new THREE.MeshStandardMaterial({ name: 'steel-spring', color: sp.color, roughness: 0.3, metalness: 0.9 });
  const rc = (sp.coilDiameter_mm - sp.wireDiameter_mm) / 2;
  const yc = plateTop + sp.coilDiameter_mm / 2;
  for (const sz of [-1, 1]) {
    /** @type {THREE.Vector3[]} 螺旋線（沿 z，從滑軌端面到彈簧座） */
    const pts = [];
    const n = sp.turns * 24;
    for (let k = 0; k <= n; k++) {
      const f = k / n;
      const a = f * sp.turns * Math.PI * 2;
      const z = sz * (sp.innerZ_mm + (sp.outerZ_mm - sp.innerZ_mm) * f);
      pts.push(new THREE.Vector3(sp.x_mm + rc * Math.cos(a), yc + rc * Math.sin(a), z));
    }
    const coil = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 2, sp.wireDiameter_mm / 2, 6, false), springMat);
    g.add(coil);
    // 彈簧座：滑動板上折起的小擋片（鋁，外側端）
    const tab = new THREE.Mesh(new THREE.BoxGeometry(sp.coilDiameter_mm + 1.2, sp.coilDiameter_mm + 0.6, 0.8), mats.aluPlateEdge);
    tab.position.set(sp.x_mm, plateTop + (sp.coilDiameter_mm + 0.6) / 2, sz * (sp.outerZ_mm + 0.4));
    g.add(tab);
  }
  return g;
};

/**
 * FRP / 碳纖導輪板（外形與開孔取自零件資料 plate，與質量、干涉檢查同一份；板厚照資料 1.5 mm，不加倒角）＋導輪柱
 * 導輪柱（iter-47，ref_chevalier-ma_gradeup / ref_aero-avante-ar）：板底的螺絲頭 → 板面墊片 → 鋁墊管撐到導輪底 → 導輪 →
 * （兩層時）鋁墊管撐到上層導輪 → 頂部墊片＋鋁墊管＋尼龍蓋。導輪高度一律取 rollerLayoutOf（assembly.js，與物理碰撞體同一份；前後導輪各自的款式）
 * @type {(mats: ReturnType<typeof makeMaterials>) => THREE.Group}
 */
const buildStayPlates = (mats) => {
  const g = new THREE.Group();
  const layout = rollerLayoutOf(spec);
  for (const slot of ['frontStay', 'rearStay']) {
    const st = asmCur.partsBySlot[slot];
    const pl = st.plate;
    if (!pl) {
      continue;
    }
    const grp = new THREE.Group();
    grp.name = slot;
    grp.userData.part = slot === 'frontStay' ? 'stay-front' : 'stay-rear';
    // 上下面用板材貼圖、側面與孔壁用切口材質（ExtrudeGeometry 群組 0 = 上下面、1 = 側面）；0.25 mm 小倒角，總厚維持 1.5 mm
    let mat = [mats.frpPlate, mats.frpEdge];
    if (st.material === 'carbon') {
      mat = [mats.carbonPlate, mats.carbonEdge];
    } else if (st.material === 'aluminum') {
      mat = [mats.aluPlate, mats.aluPlateEdge];
    }
    const moving = new THREE.Group();
    moving.name = `${slot}-moving`;
    if (st.slide) moving.userData.sliderSlot = slot;
    grp.add(moving);
    const holes = pl.holes.map((h) => circlePts(h.x, h.z, h.r, 16));
    const plate = extrudeXZ(pl.outline, pl.thickness_mm, mat, holes, 0.25);
    plate.position.y = pl.y_mm;
    moving.add(plate);
    // 滑動保桿（iter-61）：樹脂滑軌＋左右對頂的彈簧（尺寸取自零件資料 slide，與質量同一份）
    if (st.slide) {
      grp.add(buildSlideRailAndSprings(mats, st.slide, pl.y_mm + pl.thickness_mm));
    }
    const plateTop = pl.y_mm + pl.thickness_mm;
    const sx = slot === 'frontStay' ? 1 : -1;
    // 每個導輪位置（同一 x、z 的上下導輪疊成一根柱）
    /** @type {Map<string, any[]>} */
    const posts = new Map();
    for (const r of layout.filter((q) => Math.sign(q.x) === sx)) {
      const key = `${r.x.toFixed(2)},${r.z.toFixed(2)}`;
      posts.set(key, [...(posts.get(key) ?? []), r]);
    }
    for (const stack of posts.values()) {
      stack.sort((a, b) => a.y - b.y);
      const { x, z } = stack[0];
      /** @type {(y0: number, y1: number, rad: number, m: THREE.Material) => void} 兩高度之間的圓柱 */
      const tube = (y0, y1, rad, m) => {
        if (y1 - y0 <= 0.05) {
          return;
        }
        const t = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, y1 - y0, 20), m);
        t.position.set(x, (y0 + y1) / 2, z);
        moving.add(t);
      };
      // 板底的十字頭螺絲頭
      const head = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.0, 1.0, 20), mats.screw);
      head.position.set(x, pl.y_mm - 0.5, z);
      moving.add(head);
      // 板面墊片 → 鋁墊管 → 導輪底墊片
      let y = plateTop;
      tube(y, y + 0.4, 2.6, mats.steel);
      y += 0.4;
      for (const r of stack) {
        const bottom = r.y - r.h / 2;
        tube(y, bottom - 0.3, 1.8, mats.aluSpacer);
        tube(bottom - 0.3, bottom, 2.4, mats.steel);
        y = r.y + r.h / 2;
      }
      // 頂部（iter-48，reviewer：白色大圓頭像球頭）：墊片＋鋁合金尼龍防鬆螺帽（六角對邊約 4 mm、高 1.8 mm，頂部深灰尼龍環 0.9 mm，推估尺寸），螺絲尾露出 0.4 mm
      tube(y + 0.9, y + 1.3, 2.2, mats.steel);
      const nut = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 1.8, 6), mats.aluNut);
      nut.position.set(x, y + 2.2, z);
      moving.add(nut);
      tube(y + 3.1, y + 4.0, 1.8, mats.nylonCap);
      // 螺絲桿（板底 → 頂端）
      tube(pl.y_mm, y + 4.4, 0.95, mats.screw);
    }
    g.add(grp);
  }
  return g;
};

/**
 * 擺動式制振器（第七階段 iter-75，球頭連桿 [T15478]）：位置取自組裝結果（asm.optional.dampers 的 seat / pos / swing.pivot，與質量、干涉、物理同一份）。
 * 支點底座（FRP 小板，鎖在後導輪板尾端）＋兩支球頭螺柱（鋼球 φ3）→ 擺臂（1.5 mm FRP 小板，前端兩個黑色樹脂球頭杯包住鋼球）→
 * 黃銅方塊 6×6×32（橫放，兩支螺絲由擺臂上方鎖進方塊）；方塊正下方的黑色止擋墊靠在後保桿頂面（座墊）
 * @type {(mats: ReturnType<typeof makeMaterials>, d: any) => THREE.Group}
 */
const buildSwingDamper = (mats, d) => {
  const part = d.part;
  const grp = new THREE.Group();
  grp.name = `mass-damper-${d.index}`;
  grp.userData.part = 'mass-damper';
  const pv = d.swing.pivot;
  const W = part.width_mm;
  const H = part.height_mm;
  const L = part.length_mm;
  // 黃銅方塊（x 向寬 W、z 向長 L）：四邊小倒角
  const shape = new THREE.Shape([new THREE.Vector2(-W / 2, -L / 2), new THREE.Vector2(W / 2, -L / 2), new THREE.Vector2(W / 2, L / 2), new THREE.Vector2(-W / 2, L / 2)]);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: H - 0.6, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.3, bevelSegments: 2 });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0.3, 0);
  const block = new THREE.Mesh(geo, mats.brassWeight);
  block.position.set(d.seat.x, d.seat.y, d.seat.z);
  grp.add(block);
  // 止擋墊（座墊）：方塊正下方的黑色橡膠小墊，厚 = 座墊靜態壓縮後剩下的間隙（視覺上 0.4 mm）
  const pad = new THREE.Mesh(new THREE.BoxGeometry(W - 1, 0.4, 8), mats.chassisDark);
  pad.position.set(d.seat.x, d.seat.y - 0.2, d.seat.z);
  grp.add(pad);
  // 支點底座：FRP 小板（1.5 mm）鎖在後導輪板尾端上方
  const baseT = 1.5;
  const baseY = pv.y - part.swing.pivotHeight_mm;
  const base = new THREE.Mesh(new THREE.BoxGeometry(7, baseT, 22), [mats.frpEdge, mats.frpEdge, mats.frpPlate, mats.frpPlate, mats.frpEdge, mats.frpEdge]);
  base.position.set(pv.x, baseY + baseT / 2, pv.z);
  grp.add(base);
  // 擺臂（iter-82 依 reviewer 改）：支點高度 pv.y 落在方塊的高度範圍內 → 擺臂是一片「水平 FRP 板＋末端往上折的 L 形鎖片」，
  // 鎖片貼在方塊朝支點那一面、兩支螺絲水平鎖進方塊（原本的斜板＋頂板看起來像斜坡）
  const armT = 1.5;
  const faceX = d.seat.x - W / 2;
  const armX0 = pv.x + 1.2;
  const armY = pv.y + 0.4;
  const frpBox = [mats.frpEdge, mats.frpEdge, mats.frpPlate, mats.frpPlate, mats.frpEdge, mats.frpEdge];
  const flat = new THREE.Mesh(new THREE.BoxGeometry(faceX - armT - armX0, armT, 20), frpBox);
  flat.position.set((armX0 + faceX - armT) / 2, armY, pv.z);
  grp.add(flat);
  const tabY0 = armY - armT / 2;
  const tabY1 = d.seat.y + H - 0.6;
  const tab = new THREE.Mesh(new THREE.BoxGeometry(armT, tabY1 - tabY0, 20), [mats.frpPlate, mats.frpPlate, mats.frpEdge, mats.frpEdge, mats.frpEdge, mats.frpEdge]);
  tab.position.set(faceX - armT / 2, (tabY0 + tabY1) / 2, pv.z);
  grp.add(tab);
  for (const sz of [-1, 1]) {
    const zc = pv.z + sz * 8;
    // 球頭螺柱：底座上的鋼柱＋φ3.2 鋼球
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, pv.y - baseY - baseT, 12), mats.steel);
    post.position.set(pv.x, (pv.y + baseY + baseT) / 2, zc);
    grp.add(post);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1.6, 20, 14), mats.steel);
    ball.position.set(pv.x, pv.y, zc);
    grp.add(ball);
    // 樹脂球頭杯（黑）：只包住鋼球上半（半球殼＋往擺臂的短頸），下半顆鋼球露出來、看得出是球頭（iter-82）
    const cup = new THREE.Mesh(new THREE.SphereGeometry(2.1, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), mats.chassisDark);
    cup.position.set(pv.x, pv.y, zc);
    grp.add(cup);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(armX0 - pv.x + 0.6, 1.4, 3.0), mats.chassisDark);
    neck.position.set((pv.x + armX0) / 2 + 0.3, armY, zc);
    grp.add(neck);
    // 方塊固定螺絲（十字頭，從鎖片外側水平鎖入方塊）
    const head = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.8, 16), mats.screw);
    head.rotation.z = Math.PI / 2;
    head.position.set(faceX - armT - 0.4, d.seat.y + H / 2 + 0.6, zc);
    grp.add(head);
  }
  return grp;
};

/**
 * 選配零件（第三階段）：制振器（含螺絲軸與座）、煞車海綿、配重。位置與尺寸取自組裝結果（asm.optional，與干涉檢查同一份）
 * @type {(mats: ReturnType<typeof makeMaterials>) => THREE.Group}
 */
const buildOptionalParts = (mats) => {
  const g = new THREE.Group();
  const o = asmCur.optional ?? {};
  for (const d of o.dampers ?? []) {
    // 第七階段：擺動式（球頭連桿）制振器另建模型
    if (d.swing) {
      g.add(buildSwingDamper(mats, d));
      continue;
    }
    const part = d.part;
    const grp = new THREE.Group();
    grp.name = `mass-damper-${d.index}`;
    grp.userData.part = 'mass-damper';
    const mat = mats.brassWeight;
    const h = part.height_mm;
    const top = d.seat.y + h + part.stroke_mm;
    let w;
    if (part.shape === 'box') {
      // 方塊制振器：四邊小倒角（擠出＋倒角），中間兩個螺絲孔各穿一支螺絲
      const L = part.length_mm;
      const W = part.width_mm;
      const shape = new THREE.Shape([new THREE.Vector2(-L / 2, -W / 2), new THREE.Vector2(L / 2, -W / 2), new THREE.Vector2(L / 2, W / 2), new THREE.Vector2(-L / 2, W / 2)]);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: h - 0.6, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.3, bevelSegments: 2 });
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, 0.3, 0);
      w = new THREE.Mesh(geo, mat);
      w.position.set(d.seat.x, d.seat.y, d.seat.z);
    } else {
      // 圓柱制振器（ref_chevalier-ma_gradeup：黃銅圓柱，底部有凸緣、頂面倒角，中孔套在長螺絲上）
      const R = part.diameter_mm / 2;
      /** @type {number[][]} 截面（半徑, 高度），由中孔底 → 外緣 → 中孔頂 */
      let prof = [
        [1.15, 0],
        [R, 0],
        [R, 1.3],
        [R - 0.6, 1.8],
        [R - 0.6, h - 0.7],
        [R - 1.1, h],
        [1.15, h],
      ];
      if (part.profile === 'barrel') {
        // 第七階段（iter-82）：樽型（15501 官方「樽型タイプ」）——中段最粗 = 零件直徑，兩端縮 0.9 mm 的圓弧鼓腹
        prof = [[1.15, 0]];
        for (let i = 0; i <= 12; i++) {
          const t = i / 12;
          prof.push([R - 0.9 * (2 * t - 1) ** 2, t * h]);
        }
        prof.push([1.15, h]);
      }
      w = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a, b)), 40), mat);
      w.position.set(d.seat.x, d.seat.y, d.seat.z);
      // 頂面車削的同心溝（深色細環）
      const groove = new THREE.Mesh(new THREE.RingGeometry(R - 2.4, R - 2.0, 40), mats.chassisDark);
      groove.rotation.x = -Math.PI / 2;
      groove.position.set(d.seat.x, d.seat.y + h + 0.01, d.seat.z);
      grp.add(groove);
    }
    grp.add(w);
    // Side adapter solids and fixed mass use the same assembly data.
    if (d.adapter) {
      const b = d.adapter.plate;
      const plate = new THREE.Mesh(new THREE.BoxGeometry(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z), [mats.frpEdge, mats.frpEdge, mats.frpPlate, mats.frpPlate, mats.frpEdge, mats.frpEdge]);
      plate.position.set((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2);
      plate.name = 'side-damper-mount-plate';
      grp.add(plate);
      const p = d.adapter.pad;
      const pad = p.kind === 'box'
        ? new THREE.Mesh(new THREE.BoxGeometry(p.max.x - p.min.x, p.max.y - p.min.y, p.max.z - p.min.z), mats.tireSponge)
        : new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r, 2 * p.halfLen, 24), mats.tireSponge);
      if (p.kind === 'box') pad.position.set((p.min.x + p.max.x) / 2, (p.min.y + p.max.y) / 2, (p.min.z + p.max.z) / 2);
      else pad.position.set(p.c.x, p.c.y, p.c.z);
      pad.name = 'side-damper-seat-pad';
      grp.add(pad);
      for (const sp of d.adapter.spacers) {
        const height = sp.y1 - sp.y0;
        const profile = [[sp.innerRadius, 0], [sp.outerRadius, 0], [sp.outerRadius, height], [sp.innerRadius, height], [sp.innerRadius, 0]];
        const spacer = new THREE.Mesh(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 24), mats.aluSpacer);
        spacer.position.set(sp.x, sp.y0, sp.z);
        spacer.name = 'side-damper-mount-spacer';
        grp.add(spacer);
      }
    } else if (part.bracket) {
      const t = part.bracket.thickness_mm;
      const side = Math.sign(d.seat.z) || 1;
      const plateH = h + part.stroke_mm + 1.0;
      // iter-82：圓柱制振器（AR 側制振器）的托架也畫出來（原本只畫方塊）；板長 = 方塊長或圓柱直徑 + 3 mm
      const plateLen = part.shape === 'box' ? part.length_mm + 3 : part.diameter_mm + 3;
      const halfW = part.shape === 'box' ? part.width_mm / 2 : part.diameter_mm / 2;
      const plate = new THREE.Mesh(new THREE.BoxGeometry(plateLen, plateH, t), [mats.frpEdge, mats.frpEdge, mats.frpEdge, mats.frpEdge, mats.frpPlate, mats.frpPlate]);
      plate.position.set(d.seat.x, d.seat.y + plateH / 2, d.seat.z - side * (halfW + t / 2));
      grp.add(plate);
    }
    // 長螺絲：板底的螺絲頭 → 穿過制振器 → 行程上端的墊片＋防鬆螺帽＋露出的螺絲尾（每個螺絲孔一支）
    const screwXs = part.shape === 'box' ? [-part.length_mm / 4, part.length_mm / 4] : [0];
    for (const dx of screwXs) {
      const sxp = d.seat.x + dx;
      // 後制振器：螺絲由導輪板底面（板厚 1.5 mm）往上鎖，板底露出螺絲頭；側制振器：托架很低（離地 1 mm），用平頭螺絲埋在托架內，不畫頭
      const below = d.adapter ? d.adapter.surfaceY : part.mount === 'side' ? d.seat.y - 1.0 : d.seat.y - 1.5 + 0.01;
      const shaftTop = top + 3.2;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, shaftTop - below, 12), mats.screw);
      shaft.position.set(sxp, (below + shaftTop) / 2, d.seat.z);
      grp.add(shaft);
      if (part.mount !== 'side') {
        // 皿頭螺絲：頭部埋進板底、與板底齊平（不凸出，板尾下方可貼煞車海綿；iter-48）
        const head = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.0, 0.9, 20), mats.screw);
        head.position.set(sxp, below + 0.45, d.seat.z);
        grp.add(head);
      }
      const washer = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.4, 20), mats.steel);
      washer.position.set(sxp, top + 0.2, d.seat.z);
      grp.add(washer);
      const nut = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 1.6, 6), mats.steel);
      nut.position.set(sxp, top + 1.2, d.seat.z);
      grp.add(nut);
      const nylon = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.6, 16), mats.nylonCap);
      nylon.position.set(sxp, top + 2.3, d.seat.z);
      grp.add(nylon);
    }
    if (part.mount === 'side' && !d.adapter) {
      // 側托架：從底盤側壁伸出的小板（ABS）
      const sz = Math.sign(d.seat.z);
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(part.length_mm + 4, 1.0, Math.abs(d.seat.z) - 28 + part.width_mm / 2), mats.chassis);
      bracket.position.set(d.seat.x, d.seat.y - 0.5, sz * (28 + (Math.abs(d.seat.z) - 28 + part.width_mm / 2) / 2));
      grp.add(bracket);
    }
    g.add(grp);
  }
  if (o.sponge?.pin) {
    // iter-95：橡膠煞車（15413）：保桿下向的樹脂管座＋伸出的橡膠柱；大徑輪時管座上方加鋁墊圈。尺寸取組裝結果（與質量、接觸同一份）
    const pin = o.sponge.pin;
    const grp = new THREE.Group();
    grp.name = 'brake-rubber';
    grp.userData.part = 'brake-sponge';
    const socketLen = pin.ySockTop - pin.ySockBot;
    const socket = new THREE.Mesh(new THREE.CylinderGeometry(pin.rSock, pin.rSock, socketLen, 20), mats.chassisBlack);
    socket.position.set(pin.x, (pin.ySockTop + pin.ySockBot) / 2, 0);
    socket.name = 'brake-rubber-socket';
    grp.add(socket);
    // 橡膠柱端面倒一點圓角（官方照片為圓柱狀橡膠），伸出部分用輪胎橡膠材質
    const rubberLen = pin.ySockBot - pin.yTip;
    const rubber = new THREE.Mesh(new THREE.CylinderGeometry(pin.rPin, pin.rPin * 0.92, rubberLen, 18), mats.tire);
    rubber.position.set(pin.x, (pin.ySockBot + pin.yTip) / 2, 0);
    rubber.name = 'brake-rubber-pin';
    grp.add(rubber);
    if (pin.collar > 0) {
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(pin.rSock, pin.rSock, pin.collar, 20), mats.aluSpacer);
      collar.position.set(pin.x, (pin.yTop + pin.ySockTop) / 2, 0);
      collar.name = 'brake-rubber-collar';
      grp.add(collar);
    }
    g.add(grp);
  }
  if (o.sponge && !o.sponge.pin) {
    // 煞車海綿（iter-47）：圓角方塊（海綿裁切邊），表面氣孔貼圖；白 = 強力、藍 = 溫和（G 節 [T15492]、[T15512]）
    // iter-50：煞車板（1.5 mm FRP 小板，鎖在導輪架煞車座下）＋貼在板下的海綿；尺寸取組裝結果（與質量、干涉同一份）
    if (o.sponge.plate) {
      const pb = o.sponge.plate.box;
      // iter-60：煞車架材質依零件（FRP / 碳纖）
      const isCarbon = o.sponge.plate.material === 'carbon';
      const face = isCarbon ? mats.carbonPlate : mats.frpPlate;
      const edge = isCarbon ? mats.carbonEdge : mats.frpEdge;
      const isResin = o.sponge.plate.material === 'abs';
      const plateMesh = new THREE.Mesh(new THREE.BoxGeometry(pb.max.x - pb.min.x, pb.max.y - pb.min.y, pb.max.z - pb.min.z), isResin ? mats.chassisBlack : [edge, edge, face, face, edge, edge]);
      plateMesh.position.set((pb.min.x + pb.max.x) / 2, (pb.min.y + pb.max.y) / 2, (pb.min.z + pb.max.z) / 2);
      plateMesh.name = 'brake-plate';
      plateMesh.userData.part = 'brake-sponge';
      g.add(plateMesh);
      const hull = o.sponge.plate.skidHull;
      if (hull) {
        // iter-95：AR 煞車組前端斜板（スキッド）：側面梯形沿 z 擠出，頂點與物理凸包同一份
        const zs = hull.map((q) => q.z);
        const z0 = Math.min(...zs);
        const side = hull.filter((q) => q.z === z0);
        const ordered = [side[0], side[2], side[3], side[1]];
        const shape = new THREE.Shape(ordered.map((q) => new THREE.Vector2(q.x, q.y)));
        const geo = new THREE.ExtrudeGeometry(shape, { depth: Math.max(...zs) - z0, bevelEnabled: false });
        geo.translate(0, 0, z0);
        const skid = new THREE.Mesh(geo, mats.chassisBlack);
        skid.name = 'brake-plate-skid';
        skid.userData.part = 'brake-sponge';
        g.add(skid);
      }
    }
    const b = o.sponge.spongeBox ?? o.sponge.solid;
    const lx = b.max.x - b.min.x;
    const lz = b.max.z - b.min.z;
    const ly = b.max.y - b.min.y;
    /** @type {(hx: number, hz: number, rc: number) => THREE.Shape} 圓角矩形（半長 hx、半寬 hz、圓角 rc） */
    const roundRect = (hx, hz, rc) => {
      const sh = new THREE.Shape();
      sh.moveTo(-hx + rc, -hz);
      sh.lineTo(hx - rc, -hz);
      sh.quadraticCurveTo(hx, -hz, hx, -hz + rc);
      sh.lineTo(hx, hz - rc);
      sh.quadraticCurveTo(hx, hz, hx - rc, hz);
      sh.lineTo(-hx + rc, hz);
      sh.quadraticCurveTo(-hx, hz, -hx, hz - rc);
      sh.lineTo(-hx, -hz + rc);
      sh.quadraticCurveTo(-hx, -hz, -hx + rc, -hz);
      return sh;
    };
    // iter-55（reviewer：「煞車海綿只是一個平塊，沒有黏貼邊與厚度層次」）：
    // 由上而下 = 雙面膠層（0.12 mm，淡琥珀色）＋海綿本體（剪刀裁切的圓角、下緣倒角 bevel、開孔氣孔貼圖）。
    // 全部在組裝的海綿實體方塊（spongeBox，與干涉 / 離地 / 接觸模型同一份）之內：倒角往內收，不改外框
    const tapeT = Math.min(0.12, ly * 0.15);
    const cx = (b.min.x + b.max.x) / 2;
    const cz = (b.min.z + b.max.z) / 2;
    const rc = Math.min(1.5, lx / 4, lz / 4);
    const tapeGeo = new THREE.ExtrudeGeometry(roundRect(lx / 2 - 0.05, lz / 2 - 0.05, rc), { depth: tapeT, bevelEnabled: false, curveSegments: 6 });
    tapeGeo.rotateX(Math.PI / 2);
    const tape = new THREE.Mesh(tapeGeo, mats.tape);
    tape.position.set(cx, b.max.y, cz);
    tape.name = 'brake-sponge-tape';
    tape.userData.part = 'brake-sponge';
    g.add(tape);
    const bev = Math.min(0.3, (ly - tapeT) * 0.3);
    const body = ly - tapeT - 2 * bev;
    const geo = new THREE.ExtrudeGeometry(roundRect(lx / 2 - bev, lz / 2 - bev, Math.max(0.2, rc - bev)), {
      depth: Math.max(0.05, body),
      bevelEnabled: true,
      bevelThickness: bev,
      bevelSize: bev,
      bevelSegments: 2,
      curveSegments: 6,
    });
    // ExtrudeGeometry 的 bevel 往 −z 與 +z 各長 bevelThickness：先平移讓整塊落在 [0, ly − tapeT]，再轉到 −y
    geo.translate(0, 0, bev);
    geo.rotateX(Math.PI / 2);
    /** @type {Record<string, THREE.Material>} */
    const spongeMats = { blue: mats.spongeBlue, gray: mats.spongeGray };
    const m = new THREE.Mesh(geo, spongeMats[o.sponge.part.color] ?? mats.spongeWhite);
    m.position.set(cx, b.max.y - tapeT, cz);
    m.name = 'brake-sponge';
    m.userData.part = 'brake-sponge';
    g.add(m);
  }
  if (o.ballast) {
    const b = o.ballast.solid;
    const part = o.ballast.part;
    const mat = part.material === 'brass' ? mats.brassWeight : mats.steelWeight;
    let m;
    if (part.id.startsWith('ballast-hex')) {
      // 六角柱（對邊 = width_mm），軸沿 y
      m = new THREE.Mesh(new THREE.CylinderGeometry(part.width_mm / Math.sqrt(3), part.width_mm / Math.sqrt(3), b.max.y - b.min.y, 6), mat);
    } else {
      m = new THREE.Mesh(new THREE.BoxGeometry(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z), mat);
    }
    m.position.set((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2);
    const grp = new THREE.Group();
    grp.name = 'ballast';
    grp.userData.part = 'ballast';
    grp.add(m);
    // 固定螺絲（iter-48）：M2 皿頭螺絲，頭部埋在配重露出的那一面（吊在保桿或導輪板下 → 底面；中央或導輪板的配重座上 → 頂面），
    // 方塊配重 2 支、六角配重 1 支；頭部只比表面高 0.02 mm，不改變外框與離地高度
    const faceY = o.ballast.onTop ? b.max.y : b.min.y;
    const dir = o.ballast.onTop ? 1 : -1;
    const cx = (b.min.x + b.max.x) / 2;
    const cz = (b.min.z + b.max.z) / 2;
    const xs = part.id.startsWith('ballast-hex') ? [0] : [-part.length_mm / 4, part.length_mm / 4];
    for (const dx of xs) {
      const head = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.3, 20), mats.screw);
      head.position.set(cx + dx, faceY - dir * 0.13, cz);
      grp.add(head);
      for (const rot of [0, Math.PI / 2]) {
        const slot = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.32, 0.4), mats.chassisDark);
        slot.position.set(cx + dx, faceY - dir * 0.15, cz);
        slot.rotation.y = rot;
        grp.add(slot);
      }
    }
    g.add(grp);
  }
  // 第四階段：穩定零件（前導輪上方同軸；位置與尺寸取自 asm.optional.stabilizers，與干涉檢查、sim.js 碰撞同一份）
  for (const st of o.stabilizers ?? []) {
    const grp = new THREE.Group();
    grp.name = `stabilizer-${st.pos.z < 0 ? 'L' : 'R'}`;
    grp.userData.part = 'stabilizer';
    if (asmCur.partsBySlot.frontStay.slide) grp.userData.sliderSlot = 'frontStay';
    const c = st.solid.c;
    const h = st.h;
    const isTube = h > st.r;
    // 外形：圓筒（中孔 φ2.6 從頂面看得到）或扁平的穩定頭（上緣倒角）
    /** @type {number[][]} */
    const prof = isTube
      ? [[1.3, -h / 2], [st.r - 0.3, -h / 2], [st.r, -h / 2 + 0.3], [st.r, h / 2 - 0.3], [st.r - 0.3, h / 2], [1.3, h / 2]]
      : [[1.3, -h / 2], [st.r, -h / 2], [st.r, h / 2 - 0.8], [st.r - 0.8, h / 2], [1.3, h / 2]];
    const body = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a, b)), 40), mats.stabPom);
    body.position.set(c.x, c.y, c.z);
    grp.add(body);
    // 下方墊片（導輪頂面到穩定零件之間 spacer_mm）＋頂部十字螺絲頭
    const sp = st.part.spacer_mm;
    const spacer = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, sp, 16), mats.steel);
    spacer.position.set(c.x, c.y - h / 2 - sp / 2, c.z);
    grp.add(spacer);
    // iter-55：螺絲頭下的平墊片（φ4.4 × 0.3）＋螺絲頭；穩定零件下方的墊片已在上面（spacer）
    const washer = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.3, 24), mats.steel);
    washer.position.set(c.x, c.y + h / 2 + 0.15, c.z);
    grp.add(washer);
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.9, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), mats.screw);
    head.scale.y = 0.5;
    head.position.set(c.x, c.y + h / 2 + 0.3, c.z);
    grp.add(head);
    for (const rot of [0, Math.PI / 2]) {
      const slot = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.45, 0.4), mats.chassisDark);
      slot.position.set(c.x, c.y + h / 2 + 1.15, c.z);
      slot.rotation.y = rot;
      grp.add(slot);
    }
    g.add(grp);
  }
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
  // iter-51：底板前後段的固定螺絲（底板與上層框鎖在一起的位置；皿頭，埋在肋格之間的板底，不凸出底面）
  for (const sx of [-1, 1]) {
    for (const [px, pz] of [[46, 12], [46, -17]]) {
      const head = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.12, 16), mats.screw);
      head.position.set(sx * px, y0 + BOTTOM_RIB_H - 0.06, pz);
      g.add(head);
      for (const rot of [Math.PI / 4, -Math.PI / 4]) {
        const slot = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.14, 0.3), mats.chassisDark);
        slot.position.set(sx * px, y0 + BOTTOM_RIB_H - 0.08, pz);
        slot.rotation.y = rot;
        g.add(slot);
      }
    }
  }
  // iter-36：底面馬達蓋（reviewer iter-35：「真實 MA 底面有馬達蓋」）：蓋住馬達窗的深色蓋板，開 3 × 4 的圓形散熱孔、周圍凸緣
  {
    /** @type {number[][][]} */
    const vents = [];
    for (let i = 0; i < 4; i++) {
      for (let k = 0; k < 3; k++) {
        vents.push(circlePts(-7.5 + i * 5, -5 + k * 5, 1.1, 12));
      }
    }
    const motorCover = extrudeXZ(roundedRect(0, 0, 25.5, 19.5, 2.6), 0.9, mats.chassisDark, vents, 0.2);
    motorCover.position.y = y0 + 0.08;
    g.add(motorCover);
  }
  // ---- 齒輪箱蓋（iter-03；iter-06 改成大檢視窗）----
  // iter-06：reviewer「齒輪只見兩小窗綠色」→ 齒輪箱底蓋改為外框＋大開口（不再用煙燻片），
  // 從底面依序看得到紫色小齒輪 → 綠色中間齒輪 → 粉紅輪軸齒輪與輪軸；開口周圍有凸起的窗框（第二層）與固定螺絲
  for (const sx of [-1, 1]) {
    const cx = sx * (gt.counterX + 3);
    const winCx = sx * 30.25;
    const winCz = -4.5;
    // iter-36：reviewer iter-35「真實 MA 底面有齒輪蓋，不會直接看到齒輪」→ 底蓋改成封閉，只留一條小檢視槽
    const winHole = roundedRect(winCx, winCz, 10, 3.4, 1.3);
    // iter-45：底蓋改成三角肋格（reviewer iter-44：「底盤主體是大面積平板，缺補強肋與成型細節」）：
    // 底蓋開一排排三角形口袋（深 0.8 mm），上方另有一片背板封住 → 從底面看是三角補強肋格，離地高度不變
    /** @type {number[][][]} */
    const pockets = [winHole];
    for (let i = 0; i < 6; i++) {
      for (const row of [-1, 1]) {
        const px = cx - 13 + i * 5.2;
        const pz = -3.5 + row * 4.6;
        const up = (i + (row > 0 ? 1 : 0)) % 2 === 0 ? 1 : -1;
        // 避開檢視槽（外擴 1.2 mm）與四角螺絲（±15, ±8.6）
        if (Math.abs(px - winCx) < 7.2 && Math.abs(pz - winCz) < 3.4) {
          continue;
        }
        if (Math.abs(Math.abs(px - cx) - 15) < 3 && Math.abs(Math.abs(pz + 3.5) - 8.6) < 3) {
          continue;
        }
        pockets.push([[px - 2.45, pz - up * 1.9], [px + 2.45, pz - up * 1.9], [px, pz + up * 2.1]]);
      }
    }
    const cover = extrudeXZ(roundedRect(cx, -3.5, 32.6, 19.6, 3), 0.8, mats.chassisDark, pockets);
    cover.position.y = y0 + 0.05;
    g.add(cover);
    // 背板用深槍灰，口袋底和黑色肋形成對比，肋格才讀得出來
    const coverBack = extrudeXZ(roundedRect(cx, -3.5, 32.0, 19.0, 2.8), 0.4, mats.chassis, [winHole]);
    coverBack.position.y = y0 + 0.85;
    g.add(coverBack);
    // 窗框（比底蓋高一層的細框，從底面看是一圈內縮的邊）
    const frame = extrudeXZ(roundedRect(winCx, winCz, 12.5, 5.8, 2), 0.9, mats.chassis, [winHole]);
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
  for (const sideGeom of chassisSideGeometry(c)) {
    const sz = sideGeom.sign;
    const sg = sideGeom.skirt;
    const skirt = extrudeXZ(sg.outline, sg.y1 - sg.y0, mats.chassis, sg.holes);
    skirt.position.y = sg.y0;
    skirt.name = `chassis-side-skirt-${sz}`;
    g.add(skirt);
    // iter-09：電池艙側壁（側視可見的底盤厚度；reviewer「側面只是一條細黑邊」）：
    // x-y 輪廓板，兩端沿輪胎外 2.5 mm 的圓弧內凹（MA 側面在前後輪處是弧形缺口），高到車殼底緣內側；
    // 板面有 3 個內凹窗（深色底）＋窗間立肋＋上緣倒角條，讀起來是有厚度的成型件而非細線
    // iter-12：車殼下緣 6.4 → 8.6 mm（ref side-high：車門下方露出一整條黑色底盤側裙）→ 側壁頂 6.9 → 9.4 mm，窗與倒角條跟著上移
    const { topY, wheelY, arcR, winY } = sideGeom;
    const wg = sideGeom.wall;
    const sideWall = extrudeXY(wg.outline, wg.z1 - wg.z0, mats.chassis, wg.holes);
    sideWall.position.z = wg.z0;
    sideWall.name = `chassis-side-wall-${sz}`;
    g.add(sideWall);
    // iter-43：上緣弧形外緣條（中段高、兩端順著輪拱降下，取代平直上緣的視覺）與兩個車殼卡榫凸片
    {
      const arcPts = [];
      for (let k = 0; k <= 24; k++) {
        const ax = -24 + (48 * k) / 24;
        // 嵌在側框外緣上（側框 z 範圍約 35.0–36.2），只露出半圈當作弧形翻邊
        arcPts.push(new THREE.Vector3(ax, topY - 0.3 - 1.4 * (ax / 24) ** 2, sz * 35.95));
      }
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arcPts), 48, 0.5, 8, false), mats.chassis));
      for (const tx of [-21, 21]) {
        const tab = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 1.0), mats.chassisBlack);
        tab.position.set(tx, topY - 2.2, sz * 36.9);
        g.add(tab);
      }
    }
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
    const bg = sideGeom.block;
    const block = new THREE.Mesh(new THREE.BoxGeometry(bg.max.x - bg.min.x, bg.max.y - bg.min.y, bg.max.z - bg.min.z), mats.chassis);
    block.position.set((bg.min.x + bg.max.x) / 2, (bg.min.y + bg.max.y) / 2, (bg.min.z + bg.max.z) / 2);
    block.name = `chassis-side-block-${sz}`;
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
    // iter-34：頂蓋邊緣倒角（reviewer：「平板加長條溝槽、像箱子」）＋外側弧形肋（ref_ma-chassis 電池段兩側的弧形骨架）
    const tub = extrudeXZ(roundedRect(0, zc, 50, 14.6, 3), 1.3, mats.chassisBlack, [], 0.45);
    tub.position.y = cellTop + 0.25;
    g.add(tub);
    // 弧形肋：從頂蓋前端外側往內彎到中段、再彎回後端外側（俯視像括號），截面圓 0.55 mm
    const arcCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-23, cellTop + 1.7, zc + sz * 5.2),
      new THREE.Vector3(-10, cellTop + 2.3, zc + sz * 2.0),
      new THREE.Vector3(10, cellTop + 2.3, zc + sz * 2.0),
      new THREE.Vector3(23, cellTop + 1.7, zc + sz * 5.2),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(arcCurve, 40, 0.55, 8, false), mats.chassisBlack));
    // 頂蓋上的 + / − 凹刻標示（電池方向，非文字商標）
    const mark = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.2, 0.5), mats.chassisDark);
    mark.position.set(17, cellTop + 1.6, zc - sz * 3);
    g.add(mark);
    const markV = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 2.4), mats.chassisDark);
    markV.position.set(17, cellTop + 1.6, zc - sz * 3);
    g.add(markV);
    const minus = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.2, 0.5), mats.chassisDark);
    minus.position.set(-17, cellTop + 1.6, zc - sz * 3);
    g.add(minus);
    // 頂蓋上的 4 道橫向補強肋與外緣立邊
    for (let k = 0; k < 4; k++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.8, 11.6), mats.chassisBlack);
      rib.position.set(-15 + k * 10, cellTop + 1.35 + 0.4, zc);
      g.add(rib);
    }
    const lip = new THREE.Mesh(new THREE.BoxGeometry(48, 1.6, 1.0), mats.chassisBlack);
    lip.position.set(0, cellTop + 1.35 + 0.8, zc + sz * 6.8);
    g.add(lip);
  }
  // iter-36：馬達上方改成兩端固定扣（reviewer iter-35：「MA 參考圖馬達從上方完整露出，本模型用一片橋板蓋住、只開小窗」）：
  // 罐身中段完全露出，只在兩端（罐口與端蓋處）各一道跨過馬達的扣條，扣條兩端往下接電池艙內側壁並有螺絲
  const motorTop = comp.motor.y + comp.motor.flat / 2;
  for (const sx of [-1, 1]) {
    const clipX = sx * 12.2;
    const clip = extrudeXZ(roundedRect(clipX, 0, 3.0, 23, 1.0), 1.2, mats.chassisBlack, [], 0.3);
    clip.position.y = motorTop + 0.3;
    g.add(clip);
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(3.0, motorTop + 0.3 - (y0 + t), 1.6), mats.chassisBlack);
      leg.position.set(clipX, (motorTop + 0.3 + y0 + t) / 2, sz * 11.0);
      g.add(leg);
      g.add(screwHead(mats, clipX, motorTop + 1.5, sz * 9.6, 0.8));
    }
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
  // iter-35：開關再加大（reviewer iter-34：「只看到很小的白色凸塊」）：深色開關座＋滑槽＋淺灰撥桿（止滑紋）＋座上兩個三角箭頭（ON / OFF 方向，非文字）
  const swBase = extrudeXZ(roundedRect(sw.x, sw.z, 12, 7.5, 1.4), 2.6, mats.chassisDark, [roundedRect(sw.x, sw.z, 8, 2.2, 0.9)], 0.35);
  swBase.position.y = sw.y - 2.4;
  g.add(swBase);
  const swKnob = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.6, 4.6), mats.motorCap);
  swKnob.position.set(sw.x + 2.0, sw.y + 1.1, sw.z);
  g.add(swKnob);
  for (const dx of [-0.9, 0, 0.9]) {
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 4.6), mats.chassisDark);
    grip.position.set(sw.x + 2.0 + dx, sw.y + 2.45, sw.z);
    g.add(grip);
  }
  for (const dir of [-1, 1]) {
    const tri = extrudeXZ([[sw.x + dir * 5.2, sw.z + 3.0], [sw.x + dir * 3.6, sw.z + 2.2], [sw.x + dir * 3.6, sw.z + 3.8]], 0.25, mats.motorCap);
    tri.position.y = sw.y + 0.2;
    g.add(tri);
  }

  // ---- 前後保桿：MA 立體保桿（iter-03，依 ref_ma-chassis / front34 / rear34）----
  // 中央橋接板＋兩支斜伸到導輪座的臂；臂與橋接板外緣有立起的邊框（厚度），臂下方有三角斜撐連回底盤，
  // 兩臂之間有 X 形補強，導輪座為圓柱凸台
  // 保桿是底盤一體的結構，外形固定用底盤的導輪座位置（換 FRP / 碳纖導輪板時保桿不變，導輪改裝在板上）
  const ch = asmCur.partsBySlot.chassis;
  const rx = ch.bumperRollerX_mm ?? comp.rollerX;
  const rz = ch.bumperRollerZ_mm ?? c.frontRollerZ_mm;
  const bumperY = ch.bumperBottomY_mm ?? c.rollerCenterHeight_mm - 4.6;
  const bt = ch.bumperThickness_mm;
  /** @type {(x0: number, z0: number, x1: number, z1: number, w: number, h: number, y: number) => THREE.Mesh} 兩點之間的方樑 */
  const beam = (x0, z0, x1, z1, w, h, y) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, h, w), mats.chassis);
    m.position.set((x0 + x1) / 2, y + h / 2, (z0 + z1) / 2);
    m.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    return m;
  };
  for (const sx of [-1, 1]) {
    // 保桿幾何（parts/bumperGeom.js）：與「保桿切除」的質量扣除同一份定義
    const bg = bumperGeometry(ch, sx);
    // 中央橋接板（底盤前端 → 導輪臂根部）
    const bridge = bg.bridge;
    // iter-06：橋接板改成「上蓋＋下方鏤空肋層」（MA 保桿底面是三角形肋格，頂面為平整上蓋）：
    // 下層 1.4 mm 開三角形／長圓口袋，上層 1.0 mm 上蓋封住 → 底面看是鏤空骨架、不會透出背景；
    // 上蓋外緣加立起的邊框樑、中央 2 顆十字螺絲（與後方上層導輪架同等的細節）
    const ribLayer = extrudeXZ(bridge, bg.ribDepth, mats.chassis, bg.bridgePockets);
    ribLayer.position.y = bumperY;
    g.add(ribLayer);
    // iter-35：舊的上蓋與邊框樑由下方的一體寬保桿取代
    for (const sz of [-1, 1]) {
      g.add(screwHead(mats, sx * 58, bumperY + bt, sz * 6, 1.5));
    }
    // 橋接板前緣立起的厚邊（保桿正面）
    g.add(beam(sx * (rx + 2.4), -9, sx * (rx + 2.4), 9, 1.4, 4.2, bumperY));
    // 這一端換成 FRP / 碳纖導輪板時，保桿兩側的導輪臂剪掉（實車改裝常見的「保桿切除」，導輪改由板子撐），
    // 只留中央橋接板當板子的鎖點（iter-47，reviewer iter-46：板子被原廠保桿蓋住、看起來很厚）。
    // 未加工底盤使用實測 24.4 g；切除體積與質心由 bumperTrim 扣除。
    const platedEnd = sx > 0 ? asmCur.partsBySlot.frontStay.plate : asmCur.partsBySlot.rearStay.plate;
    // iter-35：導輪臂改成和橋接板一體成形的寬保桿（reviewer iter-34：「細長的直桿導輪架加一塊平板」；
    // ref_ma-chassis：前後保桿是一整片帶曲線外形的寬板，兩端包住導輪座，板上有減重孔，外緣有立起的圓角肋）
    if (!platedEnd) {
      const plate = extrudeXZ(bg.wide, bg.skinThickness, mats.chassis, bg.wideHoles);
      plate.position.y = bumperY + bg.ribDepth;
      g.add(plate);
    } else {
      // 切除後留下的中央部分 = 寬保桿板 ∩ 橋接板範圍（切除的質量見 bumperTrim，同一份幾何）
      const inBridge = (pt) => {
        let c = false;
        for (let i = 0, j = bridge.length - 1; i < bridge.length; j = i++) {
          const [xi, zi] = bridge[i];
          const [xj, zj] = bridge[j];
          if (zi > pt[1] !== zj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - zi)) / (zj - zi) + xi) {
            c = !c;
          }
        }
        return c;
      };
      const keepHoles = bg.wideHoles.filter((h) => h.every((pt) => inBridge(pt)));
      const center = extrudeXZ(bg.bridgeSkin, bg.skinThickness, mats.chassis, keepHoles);
      center.position.y = bumperY + bg.ribDepth;
      g.add(center);
    }
    // 導輪座凸台、三角斜撐、補強片屬於導輪臂；保桿切除時一起拿掉（iter-47，幾何同 bumperTrim）
    if (!platedEnd) {
      for (const b of bg.bosses) {
        const boss = new THREE.Mesh(new THREE.CylinderGeometry(b.r, b.r, b.h, 24), mats.chassis);
        boss.position.set(b.x, b.yc, b.z);
        g.add(boss);
      }
      for (const st of bg.struts) {
        const strut = beam(st.a[0], st.a[1], st.b[0], st.b[1], st.w, st.h, 0);
        strut.position.y = st.yc;
        g.add(strut);
      }
      for (const w of bg.webs) {
        const web = extrudeXY([[0, 0], [10, 0], [10, w.top1], [0, w.top0]], w.thickness, mats.chassis);
        web.position.set(w.x, w.y, w.z);
        g.add(web);
      }
      // 保桿總厚 2.4 mm = 上蓋 1.0 mm＋下層肋格 1.4 mm（與 bumperTrim 同一份幾何），
      // 沿兩支導輪臂開一排口袋（口袋底為深色），中央橋接板與減重孔處挖空。
      // 肋格下緣 = 保桿底 5.4 mm；口袋深度為推估值。
      {
        const { bridgeHole, ribHoles } = bg;
        const ribGrid = extrudeXZ(bg.wide, bg.ribDepth, mats.chassis, ribHoles);
        ribGrid.position.y = bumperY;
        g.add(ribGrid);
        // 口袋底：保桿板底面貼一層深色薄面（口袋讀起來是凹進去的深色格子，肋是槍灰色）
        const pocketFloor = extrudeXZ(bg.wide, 0.05, mats.chassisDark, [bridgeHole, ...bg.wideHoles.filter((h) => !h.some(([x, z]) => inBumperPolygon(x, z, bridgeHole)))]);
        pocketFloor.position.y = bumperY + bg.ribDepth - 0.05;
        g.add(pocketFloor);
      }
      for (const sz of [-1, 1]) {
        // 保桿鎖點的六角螺帽（上方十字螺絲的另一端）
        const nut = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 1.0, 6), mats.steel);
        nut.position.set(sx * 58, bumperY - 0.5, sz * 6);
        g.add(nut);
      }
    }
    // iter-34：拿掉兩臂之間的 X 形補強（reviewer：「保桿上一根斜放的細桿，像多出來的零件」；上蓋已有安裝孔與邊框樑）
  }
  // 後上層導輪架：塑膠標準件（沒有板件）才畫原本的立體導輪架；FRP / 碳纖導輪板另外建模（buildStayPlates）
  const rearStay = asmCur.partsBySlot.rearStay;
  if (!rearStay.plate && c.rearUpperRollerHeight_mm !== null) {
    g.add(buildRearStay(mats, c.rearRollerX_mm, c.rearRollerZ_mm, bumperY + bt, c.rearUpperRollerHeight_mm - 4.4));
  }
  g.add(buildStayPlates(mats));
  for (const r of rollerLayoutOf(spec)) {
    const onPlate = r.x > 0 ? !!asmCur.partsBySlot.frontStay.plate : !!asmCur.partsBySlot.rearStay.plate;
    let roller = buildRollerStack(mats, r, { bare: onPlate });
    const slot = r.x > 0 ? 'frontStay' : 'rearStay';
    // B13（iter-105）：導輪角度調整板（15373）→ 導輪組以導輪中心為支點，頂端往車頭方向傾 θ（與 sim.js 的導輪軸同一個角度）
    const plate = asmCur.partsBySlot[r.x > 0 ? 'frontRollerAngle' : 'rearRollerAngle'];
    if (plate) {
      const pivot = new THREE.Group();
      pivot.position.set(r.x, r.y, r.z);
      roller.position.set(-r.x, -r.y, -r.z);
      pivot.add(roller);
      pivot.rotation.z = -(plate.angle_deg * Math.PI) / 180;
      roller = pivot;
    }
    if (asmCur.partsBySlot[slot].slide) roller.userData.sliderSlot = slot;
    g.add(roller);
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

  // iter-35：齒輪箱外殼（reviewer iter-34：「齒輪直接裝在薄隔板上，看起來沒有齒輪箱外殼」）：
  // 近側（−z）壁開大窗＋頂蓋開槽窗，保留看得到齒輪的檢視窗，整體讀成一個有外殼的齒輪箱
  for (const sx of [-1, 1]) {
    const gx0 = sx * 15.5;
    const gx1 = sx * (hw + 5);
    const nearPts = [[gx0, y0 + t], [gx0, 17.5], [sx * 22, 20], [sx * (hw - 2), 20], [gx1, 17.5], [gx1, y0 + t]];
    const nearOrdered = sx > 0 ? nearPts : nearPts.slice().reverse();
    const winC = [sx * (gt.counterX + hw) / 2, (axleY + gt.counterY) / 2];
    // roundedRect 回傳 [x, 第二座標]，這裡第二座標當作 y（x-y 平面板）
    const win = roundedRect(winC[0], winC[1], 21, 11, 2.5);
    const nearWall = extrudeXY(nearOrdered, 1.2, mats.chassisBlack, [sx > 0 ? win : win.slice().reverse()]);
    nearWall.position.z = -10.6;
    g.add(nearWall);
    // 槽窗開在齒輪正上方（輪軸齒輪與中間齒輪小齒在 z ≈ −5 ~ −8），從上方看得到齒輪
    const hoodHole = roundedRect(sx * (gt.counterX + hw) / 2, -5.6, 22, 7.4, 2.2);
    const hood = extrudeXZ(roundedRect(sx * (Math.abs(gx0) + Math.abs(gx1)) / 2, -2.7, Math.abs(gx1 - gx0), 16.2, 2.2), 0.8, mats.chassisBlack, [hoodHole], 0.25);
    hood.position.y = 19.6;
    g.add(hood);
    for (const sz of [-1, 1]) {
      // iter-44：螺絲座凸台（螺絲頭下方的圓形座）
      const bossY = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.6, 0.5, 16), mats.chassisBlack);
      bossY.position.set(sx * (Math.abs(gx0) + 2.6), 20.6, -2.7 + sz * 5.6);
      g.add(bossY);
      g.add(screwHead(mats, sx * (Math.abs(gx0) + 2.6), 20.85, -2.7 + sz * 5.6, 0.9));
    }
    // iter-44：外蓋補強肋與分件縫（reviewer iter-43：「齒輪箱外蓋只是平黑板，缺補強肋、螺絲座與分件縫」）
    const hoodCx = sx * (Math.abs(gx0) + Math.abs(gx1)) / 2;
    const hoodLen = Math.abs(gx1 - gx0);
    // 槽窗兩側的縱向肋（沿 x）
    for (const rz of [-9.9, 0.4]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(hoodLen - 6, 0.6, 0.8), mats.chassisBlack);
      rib.position.set(hoodCx, 20.7, rz);
      g.add(rib);
    }
    // 外端的橫向肋
    const endRib = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 14), mats.chassisBlack);
    endRib.position.set(sx * (Math.abs(gx1) - 2.2), 20.7, -2.7);
    g.add(endRib);
    // 分件縫：外蓋與齒輪箱側壁交界的深色細縫
    const seam = new THREE.Mesh(new THREE.BoxGeometry(hoodLen - 1, 0.25, 0.3), mats.chassisDark);
    seam.position.set(hoodCx, 19.55, -10.75);
    g.add(seam);
    // 近側壁上的直向肋
    for (const fx of [0.3, 0.7]) {
      const vr = new THREE.Mesh(new THREE.BoxGeometry(0.8, 10, 0.5), mats.chassisBlack);
      vr.position.set(sx * (Math.abs(gx0) + hoodLen * fx), 9.5, -10.85);
      g.add(vr);
    }
  }

  // ---- 電池（兩顆 AA，置於馬達兩側；藏在電池蓋內）----
  const b = comp.battery;
  for (const z of b.zs) {
    const cell = new THREE.Mesh(new THREE.CylinderGeometry(b.dia / 2, b.dia / 2, b.length, 28), mats.battery);
    cell.rotation.z = Math.PI / 2;
    cell.position.set(b.x, b.y, z);
    g.add(cell);
  }

  // ---- 輪軸（2 mm 六角鋼軸，貫穿左右輪；iter-51 改成六角斷面，外接圓 φ2.3）----
  for (const w of wheelLayout(spec).filter((q) => q.z > 0)) {
    // iter-55：中空輪軸（boreDiameter_mm > 0）用不鏽鋼材質（[T15440] 中空ステンレスシャフト），和一般鋼軸區分
    const hollowAxle = (asmCur?.partsBySlot?.axles?.boreDiameter_mm ?? 0) > 0;
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, c.trackWidth_mm + 4, 6), hollowAxle ? mats.stainless : mats.steel);
    axle.rotation.x = Math.PI / 2;
    axle.position.set(w.x, w.y, 0);
    g.add(axle);
  }
  // ---- 輪軸培林（iter-51）：620 培林（外徑 6、內徑 2、寬 2.5，SPEC 1.6 / bearing 零件）嵌在側框外側的軸承座，
  // 外端面和側框外表面齊平（z = ±24.5，輪胎內側 ≥ 24.75 mm，不碰輪胎）：鋼外環、防塵蓋（培林為深色、塑膠軸承為白色 POM）、鋼內環＋軸承座凸緣。
  // 位置與 assembly.js 的輪軸軸承相同（x = ±軸距/2、z = ±23.4），只是外觀，不另計質量（質量已在 bearings 零件）
  {
    const brg = asmCur.partsBySlot.bearings;
    const od = (brg.outerDiameter_mm ?? 6) / 2;
    const id = (brg.innerDiameter_mm ?? 2) / 2;
    const shieldMat = brg.kind === 'ball' ? mats.chassisDark : mats.motorCap;
    const faceZ = 24.5;
    for (const w of wheelLayout(spec)) {
      const sz = Math.sign(w.z);
      const housing = new THREE.Mesh(new THREE.RingGeometry(od, od + 1.0, 32), mats.chassisBlack);
      housing.position.set(w.x, w.y, sz * (faceZ + 0.04));
      housing.rotation.y = sz > 0 ? 0 : Math.PI;
      g.add(housing);
      const outer = new THREE.Mesh(new THREE.RingGeometry(od - 0.55, od, 32), mats.steel);
      outer.position.set(w.x, w.y, sz * (faceZ + 0.06));
      outer.rotation.y = sz > 0 ? 0 : Math.PI;
      g.add(outer);
      if (brg.kind === 'ball') {
        const shield = new THREE.Mesh(new THREE.RingGeometry(id + 0.45, od - 0.55, 32), shieldMat);
        shield.position.set(w.x, w.y, sz * (faceZ + 0.02));
        shield.rotation.y = sz > 0 ? 0 : Math.PI;
        g.add(shield);
        const inner = new THREE.Mesh(new THREE.RingGeometry(id + 0.05, id + 0.45, 24), mats.steel);
        inner.position.set(w.x, w.y, sz * (faceZ + 0.05));
        inner.rotation.y = sz > 0 ? 0 : Math.PI;
        g.add(inner);
      } else {
        const bush = new THREE.Mesh(new THREE.RingGeometry(id + 0.05, od - 0.55, 32), shieldMat);
        bush.position.set(w.x, w.y, sz * (faceZ + 0.05));
        bush.rotation.y = sz > 0 ? 0 : Math.PI;
        g.add(bush);
      }
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
 * B14（iter-107）：後置單軸馬達底盤（結構參考 VZ；VZ_RESEARCH 2.2–2.6，位置多為照片量測推估）。
 * 平底盤＋開散熱孔的底板（[T18094]「フラットなシャーシ下面にはエアダクト」）、中前段兩顆縱向電池＋電池扣、
 * 後軸前方橫置馬達、+z 側齒輪列（小齒輪 → 中間齒輪 → 後輪軸齒輪）、−z 側傳動軸連接前後冠狀齒輪、螺絲固定的前保桿與後導輪架。
 * 底盤本體網格（abs-chassis-gunmetal）同時是 chassis-vz 的質心／慣性分布來源（tests P14_component_tensors_vz）
 * @type {(mats: ReturnType<typeof makeMaterials>) => THREE.Group}
 */
function buildChassisVZ(mats) {
  const g = new THREE.Group();
  const c = spec.chassis;
  const ch = asmCur.partsBySlot.chassis;
  const comp = componentLayout(spec);
  const t = c.plateThickness_mm;
  const y0 = c.groundClearance_mm;
  const hw = c.wheelbase_mm / 2;
  const axleY = c.refWheelDiameter_mm / 2;
  const floorTop = y0 + t;
  // ---- 底板：前段窄（前輪內側 25.25 mm）、中段最寬、後段配合較寬的後輪距（後輪內側 28.25 mm）----
  const outline = [[60, -20], [60, 20], [55, 23.5], [27, 23.5], [24, 27], [-24, 27], [-27, 26.5], [-56, 26.5], [-60, 22], [-60, -22], [-56, -26.5], [-27, -26.5], [-24, -27], [24, -27], [27, -23.5], [55, -23.5]];
  const ducts = [];
  for (const dx of [-8, 2, 12, 22]) {
    ducts.push(roundedRect(dx, -7.3, 6, 3, 1.2), roundedRect(dx, 7.3, 6, 3, 1.2));
  }
  for (const dz of [-4, 4, 12]) {
    ducts.push(roundedRect(comp.motor.x, comp.motor.z + dz, 12, 2.4, 1.0));
  }
  const plate = extrudeXZ(outline, t, mats.chassis, ducts, 0.3);
  plate.position.y = y0;
  g.add(plate);
  // 側壁（外緣立壁）：前段、中段、後段
  const wallH = 8.5;
  for (const sz of [-1, 1]) {
    for (const [x0, x1, z] of [[27, 55, 23.5], [-24, 24, 27], [-56, -27, 26.5]]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, wallH, 1.4), mats.chassis);
      wall.position.set((x0 + x1) / 2, floorTop + wallH / 2, sz * (z - 0.7));
      g.add(wall);
    }
    // 側壁上的減重窗（深色內層）
    for (const wx of [-14, 0, 14]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(9, 3.6, 0.2), mats.chassisDark);
      win.position.set(wx, floorTop + 4.5, sz * 27.05);
      g.add(win);
    }
  }
  // ---- 電池倉：兩顆 AA 縱向並排（中央隔肋＋前後端牆，端牆上有銅端子）----
  const b = comp.battery;
  const bx0 = b.x - b.length / 2;
  const bx1 = b.x + b.length / 2;
  const rib = new THREE.Mesh(new THREE.BoxGeometry(b.length - 6, 4, 1.0), mats.chassis);
  rib.position.set(b.x, floorTop + 2, 0);
  g.add(rib);
  for (const [ex, sx] of [[bx1 + 1.2, 1], [bx0 - 1.2, -1]]) {
    const endWall = new THREE.Mesh(new THREE.BoxGeometry(1.6, 15, 2 * (b.zs[1] + b.dia / 2) + 2), mats.chassis);
    endWall.position.set(ex, floorTop + 7.5, 0);
    g.add(endWall);
    for (const z of b.zs) {
      const term = new THREE.Mesh(new THREE.BoxGeometry(0.3, 6, 6), mats.copper);
      term.position.set(ex - sx * 0.95, b.y, z);
      g.add(term);
    }
  }
  for (const z of b.zs) {
    const cell = new THREE.Mesh(new THREE.CylinderGeometry(b.dia / 2, b.dia / 2, b.length, 28), mats.battery);
    cell.rotation.z = Math.PI / 2;
    cell.position.set(b.x, b.y, z);
    g.add(cell);
  }
  // 電池扣（battery-cover-vz）：跨過兩顆電池上方的扣條，兩端扣在側框
  const strapY = b.y + b.dia / 2 + 0.3;
  for (const fx of [-0.22, 0.22]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(6, 1.2, 2 * (b.zs[1] + b.dia / 2) + 4), mats.chassisBlack);
    strap.position.set(b.x + fx * b.length, strapY + 0.6, 0);
    g.add(strap);
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(6, strapY - floorTop, 1.2), mats.chassisBlack);
      leg.position.set(b.x + fx * b.length, floorTop + (strapY - floorTop) / 2, sz * (b.zs[1] + b.dia / 2 + 1.4));
      g.add(leg);
    }
  }
  // ---- 馬達（後置橫置，軸沿 z、扁面朝上下）＋馬達座 ----
  const m = comp.motor;
  const motorPts = [];
  for (let k = 0; k < 72; k++) {
    const a = (k / 72) * Math.PI * 2;
    motorPts.push([(m.dia / 2 - 0.4) * Math.cos(a), Math.max(-(m.flat - 0.8) / 2, Math.min((m.flat - 0.8) / 2, (m.dia / 2 - 0.4) * Math.sin(a)))]);
  }
  const canLen = m.length - 6;
  const canGeo = new THREE.ExtrudeGeometry(new THREE.Shape(motorPts.map(([u, v]) => new THREE.Vector2(u, v))), { depth: canLen, bevelEnabled: false, curveSegments: 12 });
  canGeo.translate(0, 0, -canLen / 2);
  const can = new THREE.Mesh(canGeo, mats.motorCan);
  can.position.set(m.x, m.y, m.z + 3);
  g.add(can);
  const capGeo = new THREE.ExtrudeGeometry(new THREE.Shape(motorPts.map(([u, v]) => new THREE.Vector2(u * 0.95, v * 0.92))), { depth: 6, bevelEnabled: false, curveSegments: 12 });
  capGeo.translate(0, 0, -3);
  const cap = new THREE.Mesh(capGeo, mats.motorCap);
  cap.position.set(m.x, m.y, m.z - m.length / 2 + 3);
  g.add(cap);
  const train = singleShaftTrain(spec.drivetrain, m, -hw, axleY);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, train.z - (m.z + canLen / 2 + 3) + 2, 12), mats.steel);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.set(m.x, m.y, (train.z + m.z + canLen / 2 + 3) / 2);
  g.add(shaft);
  // 馬達座：前後擋牆＋兩側扣爪
  for (const sx of [-1, 1]) {
    const cradle = new THREE.Mesh(new THREE.BoxGeometry(1.4, m.flat * 0.7, m.length - 2), mats.chassis);
    cradle.position.set(m.x + sx * (m.dia / 2 + 0.7), floorTop + (m.flat * 0.7) / 2, m.z);
    g.add(cradle);
  }
  // ---- 齒輪列（+z 側）：小齒輪（紫）→ 中間齒輪（大齒藍綠／小齒）→ 後輪軸齒輪（黃）----
  const d = spec.drivetrain;
  const pin = gear(d.pinionPitchRadius_mm + 0.4, 8, 3, mats.pinion);
  pin.position.set(m.x, m.y, train.z);
  g.add(pin);
  const cl = gear(d.counterLargePitchRadius_mm + 0.4, 20, 2.2, mats.counter);
  cl.position.set(train.counter.x, train.counter.y, train.z);
  g.add(cl);
  const cs = gear(d.counterSmallPitchRadius_mm + 0.4, 12, 2.6, mats.counter);
  cs.position.set(train.counter.x, train.counter.y, train.z - 2.4);
  g.add(cs);
  const spur = gear(d.spurPitchRadius_mm + 0.4, 28, 2.4, mats.spur);
  spur.position.set(-hw, axleY, train.z - 2.4);
  g.add(spur);
  const cshaft = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 8, 12), mats.steel);
  cshaft.rotation.x = Math.PI / 2;
  cshaft.position.set(train.counter.x, train.counter.y, train.z - 1.5);
  g.add(cshaft);
  // 齒輪箱內壁（齒輪內側）＋後齒輪蓋（gear-cover-vz，深色，開檢視窗）
  const gbX0 = -hw - d.spurPitchRadius_mm - 1;
  const gbX1 = m.x + d.pinionPitchRadius_mm + 2;
  const inner = new THREE.Mesh(new THREE.BoxGeometry(gbX1 - gbX0, 14, 1.2), mats.chassis);
  inner.position.set((gbX0 + gbX1) / 2, floorTop + 7, train.z - 4.6);
  g.add(inner);
  const coverTop = Math.max(train.counter.y + d.counterLargePitchRadius_mm, axleY + d.spurPitchRadius_mm) + 1;
  const cover = extrudeXZ(roundedRect((gbX0 + gbX1) / 2, train.z - 1.5, gbX1 - gbX0, 7, 1.5), 1.2, mats.chassisBlack, [roundedRect((gbX0 + gbX1) / 2, train.z - 1.5, (gbX1 - gbX0) * 0.55, 3.4, 1.2)], 0.3);
  cover.position.y = coverTop;
  g.add(cover);
  // ---- 傳動軸（−z 側，電池外側）＋前後冠狀齒輪（粉紅 G13）----
  const ps = ch.propShaft_mm;
  const prop = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 2 * hw - 6, 12), mats.steel);
  prop.rotation.z = Math.PI / 2;
  prop.position.set(0, ps.y, ps.z);
  g.add(prop);
  const cr = d.crownPitchRadius_mm ?? 6.5;
  for (const sx of [1, -1]) {
    const crownDisk = new THREE.Mesh(new THREE.CylinderGeometry(cr + 0.8, cr + 0.8, 1.0, 32), mats.spur);
    crownDisk.rotation.x = Math.PI / 2;
    crownDisk.position.set(sx * hw, axleY, ps.z - 1.8);
    g.add(crownDisk);
    const teeth = crownTeeth(cr + 0.8, 24, 1.0, mats.spur);
    teeth.position.set(sx * hw, axleY, ps.z - 1.3);
    g.add(teeth);
    const pp = gear(1.6, 8, 2.4, mats.steel);
    pp.rotation.y = Math.PI / 2;
    pp.position.set(sx * (hw - 3), ps.y, ps.z);
    g.add(pp);
    // 傳動軸軸承座（底盤一體）
    const seat = new THREE.Mesh(new THREE.BoxGeometry(3, ps.y - floorTop + 1.5, 4), mats.chassis);
    seat.position.set(sx * (hw - 8), floorTop + (ps.y - floorTop + 1.5) / 2, ps.z);
    g.add(seat);
  }
  // ---- 前保桿（螺絲固定、可拆；含在底盤質量）：中央橋板＋斜伸到導輪座的臂 ----
  const bumperY = ch.bumperBottomY_mm;
  const bt = ch.bumperThickness_mm;
  const rx = ch.bumperRollerX_mm;
  const rz = ch.bumperRollerZ_mm;
  const bridge = extrudeXZ(roundedRect(63, 0, 10, 36, 3), bt, mats.chassis, [roundedRect(63, 0, 4, 12, 1.6)], 0.3);
  bridge.position.y = bumperY;
  g.add(bridge);
  for (const sz of [-1, 1]) {
    g.add(armPlate(60, sz * 12, rx, sz * rz, 7, bt, bumperY, 2, mats.chassis));
    if (!asmCur.partsBySlot.frontStay.plate) {
      const boss = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.3, bt + 0.8, 24), mats.chassis);
      boss.position.set(rx, bumperY + (bt + 0.8) / 2 - 0.4, sz * rz);
      g.add(boss);
    }
    g.add(screwHead(mats, 63, bumperY + bt, sz * 10, 1.5));
  }
  // ---- 後導輪架（stay-rear-vz；換成 FRP／碳纖板時由 buildStayPlates 建模，這裡只留鎖板的後端座）----
  const rearStay = asmCur.partsBySlot.rearStay;
  const rearMount = extrudeXZ(roundedRect(-61, 0, 8, 30, 2.5), bt, mats.chassis, [], 0.3);
  rearMount.position.y = bumperY;
  g.add(rearMount);
  if (!rearStay.plate) {
    const rrx = c.rearRollerX_mm;
    const rrz = c.rearRollerZ_mm;
    // 後導輪架是另計質量的分件：同色但材質另取名，不算進底盤本體的網格分布
    const stayMat = mats.chassis.clone();
    stayMat.name = 'abs-rear-stay-vz';
    for (const sz of [-1, 1]) {
      g.add(armPlate(-62, sz * 11, -rrx, sz * rrz, 7, bt, bumperY, 2, stayMat));
      const boss = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.3, bt + 0.8, 24), stayMat);
      boss.position.set(-rrx, bumperY + (bt + 0.8) / 2 - 0.4, sz * rrz);
      g.add(boss);
      g.add(screwHead(mats, -61, bumperY + bt, sz * 9, 1.5));
    }
  }
  g.add(buildStayPlates(mats));
  for (const r of rollerLayoutOf(spec)) {
    const onPlate = r.x > 0 ? !!asmCur.partsBySlot.frontStay.plate : !!rearStay.plate;
    let roller = buildRollerStack(mats, r, { bare: onPlate });
    const slot = r.x > 0 ? 'frontStay' : 'rearStay';
    const anglePlate = asmCur.partsBySlot[r.x > 0 ? 'frontRollerAngle' : 'rearRollerAngle'];
    if (anglePlate) {
      const pivot = new THREE.Group();
      pivot.position.set(r.x, r.y, r.z);
      roller.position.set(-r.x, -r.y, -r.z);
      pivot.add(roller);
      pivot.rotation.z = -(anglePlate.angle_deg * Math.PI) / 180;
      roller = pivot;
    }
    if (asmCur.partsBySlot[slot].slide) roller.userData.sliderSlot = slot;
    g.add(roller);
  }
  // ---- 車殼卡榫柱（專案定義的安裝點，見 chassis-vz.src.bodyMounts）----
  for (const mnt of ch.bodyMounts) {
    const h = mnt.y - floorTop;
    const post = new THREE.Mesh(new THREE.BoxGeometry(3.2, h, 6.4), mats.chassis);
    post.position.set(mnt.x, floorTop + h / 2, mnt.z);
    g.add(post);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 7.2, 16), mats.chassis);
    head.rotation.x = Math.PI / 2;
    head.position.set(mnt.x, mnt.y, mnt.z);
    g.add(head);
    const pinM = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 7.6, 12), mats.steel);
    pinM.rotation.x = Math.PI / 2;
    pinM.position.set(mnt.x, mnt.y, mnt.z);
    g.add(pinM);
  }
  // ---- 電源開關（電池倉前端上方，推估位置）----
  const sw = ch.switchPos_mm;
  const swBase = extrudeXZ(roundedRect(sw.x, sw.z, 7.5, 12, 1.4), 2.6, mats.chassisDark, [roundedRect(sw.x, sw.z, 2.2, 8, 0.9)], 0.35);
  swBase.position.y = sw.y - 2.4;
  g.add(swBase);
  const swKnob = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.6, 3.2), mats.motorCap);
  swKnob.position.set(sw.x, sw.y + 0.6, sw.z + 2);
  g.add(swKnob);
  // ---- 輪軸（前後輪距不同，長度跟著輪距）＋輪軸培林（z = ±(輪距/2 − 6.35)，同 assembly.js）----
  const hollowAxle = (asmCur?.partsBySlot?.axles?.boreDiameter_mm ?? 0) > 0;
  const brg = asmCur.partsBySlot.bearings;
  const od = (brg.outerDiameter_mm ?? 6) / 2;
  for (const [x, track] of [[hw, c.trackWidth_mm], [-hw, c.trackWidthRear_mm]]) {
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, track + 4, 6), hollowAxle ? mats.stainless : mats.steel);
    axle.rotation.x = Math.PI / 2;
    axle.position.set(x, axleY, 0);
    g.add(axle);
    for (const sz of [-1, 1]) {
      const bz = track / 2 - 6.35;
      const housing = new THREE.Mesh(new THREE.CylinderGeometry(od + 1.0, od + 1.0, 2.5, 24), mats.chassis);
      housing.rotation.x = Math.PI / 2;
      housing.position.set(x, axleY, sz * bz);
      g.add(housing);
      const ring = new THREE.Mesh(new THREE.RingGeometry(od - 0.55, od, 32), mats.steel);
      ring.position.set(x, axleY, sz * (bz + 1.3));
      ring.rotation.y = sz > 0 ? 0 : Math.PI;
      g.add(ring);
      // 軸承座連到底板的支撐
      const leg = new THREE.Mesh(new THREE.BoxGeometry(5, axleY - floorTop, 2.5), mats.chassis);
      leg.position.set(x, floorTop + (axleY - floorTop) / 2, sz * bz);
      g.add(leg);
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
 * 建立整台車（底盤、輪胎、車殼）。底盤座標的所有東西放在 sprung 群組，整組升降 asm.lift_mm（換輪徑時）
 * @type {(asm?: any, opt?: { body?: boolean }) => THREE.Group} 單位 mm；asm 省略時用預設組裝；opt.body = false 或 asm.body = null 不裝車殼
 */
export function buildCarModel(asm = assemble(loadConfig('default')), opt = {}) {
  spec = asm.spec;
  asmCur = asm;
  const mats = makeMaterials();
  const car = new THREE.Group();
  car.name = 'mini4wd';
  car.userData.assembly = { config: asm.config, mass_g: asm.mass_g, com_mm: asm.com_mm };
  const sprung = new THREE.Group();
  sprung.name = 'sprung';
  sprung.position.y = asm.lift_mm;
  car.add(sprung);
  const chassis = asm.partsBySlot.chassis.motorPosition === 'rear' ? buildChassisVZ(mats) : buildChassis(mats);
  chassis.name = 'chassis';
  sprung.add(chassis);
  const options = buildOptionalParts(mats);
  options.name = 'options';
  sprung.add(options);
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
  // asm.body 為 null（組裝時 body: null，不裝車殼）時同樣只建底盤
  if (opt.body !== false && asm.body) {
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
  // 牆（含換道橋的橋牆與支架）與橋板（路面）都直接用物理的同一份三角網格
  for (const m of [...track.wallMeshes, ...(track.roadMeshes ?? [])]) {
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

  return g;
}
