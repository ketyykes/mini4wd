// 蛇首長船（body-serpent-longship，第八階段神話組・北歐）：維京長船意象的低船身——側面 4 道往外疊的疊板（clinker）稜線、
// 船舷上緣每側 5 面圓盾、iter-115 起甲板封成和船舷齊平、中央微拱的木板蓋板（只留一個小座艙口，評審：開放船斗不像比賽用車殼），船首柱往上彎成 S 形蛇頸、頂端是有眼、口、眉稜的蛇頭（沒有牙與角），船尾往上捲成 stern-curl 尾翼。
// iter-120（第九階段：LG1 低風阻楔形＋神話元素做成車身零件）：船首不再翹起，改成往前下壓的楔形鼻、船首柱高頸拿掉，蛇頭變成往前下伸的低平鼻錐衝角（封住車頭）；
// 疊板沿前低後高的船舷線排成側面速度線（最上一道漆赭紅＝沿船側延伸的蛇身賽車條），圓盾降到船舷下排成一列，船尾捲飾縮成小鴨尾擾流，蛇眼自發光。頂高 58.5 → 43。
// iter-114：船殼加寬並往下包（船舷在前後輪上方蓋住輪胎上半部、中段側面往下到 y 10 擋住電池艙），原本整艘船架在底盤上、四輪與電池艙全露。
// 設計：shared/design/body-serpent-longship/DESIGN.md（典故、借用的古代語彙、和市售車殼 / 現代作品 / 既有車殼的差異）。
// 造型回到出土文物（MYTH_RESEARCH N1、N2、N5–N7）：Oseberg 船艏柱盤捲的蛇（現存名船都不是龍頭）、Gokstad 陪葬的整船盾牌、疊板船殼的鉚釘列；
// 不做整車龍頭（避開市售 Dragon Jr. 系列；船首只有船首柱頂端的小蛇頭）、不用任何盧恩字母或符號、不用白藍配色。
// 塗裝全為自創：焦油黑褐船殼＋赭紅 / 奶油白對半分區的圓盾＋青銅盾心與鉚釘點列＋疊板邊緣淺木色細線；不含任何文字、號碼、商標。
import * as THREE from 'three';
import { makePolyBody } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp, sdRoundRect } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';
import { buildArchWell, chassisBlockedNearArch } from './kitsuneNinetail.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** 船身站位節點（x 由後到前；前後軸 x = ±40；船尾尖 −66、船首尖 73，船首 / 船尾柱另外以實體件往上捲） */
const XS = [-66, -62, -56, -48, -40, -28, -14, 0, 14, 28, 40, 48, 56, 63, 69, 73];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 船舷上緣（sheer line）：中段最低 32.5，往船首 / 船尾翹起（長船的弦弧）
  // iter-120（第九階段：LG1 低風阻楔形；基準評審：船首船尾翹高、中段凹像擺件船）：船首不再翹起，改成往前下壓的楔形鼻（x 40 的 33.6 → 船首尖 19，V3 鼻尖低），
  // 中段幾乎水平（33.3），船尾只微微上揚成鴨尾（38.6）。前後輪上方甲板仍 ≥ 31.3（31 mm 輪拱頂 30.5 之上）
  sheer: monoCurve(XS, [38, 37.1, 36, 34.8, 33.6, 33.4, 33.3, 33.2, 33.2, 33.3, 33.6, 31.5, 27, 23.5, 20.6, 19]),
  // 船舷半寬（iter-114 加寬）：中段最寬 38（寬 76 × 長 139，比例像 Gokstad 型的寬腹長船），前後輪上方仍有 35.5（船舷蓋住輪胎上半部，
  // 31 mm 輪胎外側面 |z| 34.75），往船首 / 船尾收成兩頭尖的柳葉形。原本中段 26、輪上 16，四輪與電池艙全露在船殼外（iter-113 評審）
  // iter-120：船首收尖段放寬成蛇頭鼻錐的底座（x 56 / 63 / 69 / 73：14 / 7.5 / 3.2 / 2.4 → 16 / 10.5 / 6.4 / 4）
  hw: monoCurve(XS, [2.4, 4.5, 10, 21.5, 35, 30.5, 28, 27.5, 28, 30.5, 35, 25, 16, 10.5, 6.4, 4]),
  // 船身下緣（iter-114 壓低）：中段 10（剛好在底盤側壁頂 9.4 之上，側面擋住電池艙；原本 13.2），往船首 / 船尾彎上去（龍骨前後上翹的 forefoot）；
  // 前後卡榫處（x 52 / −50）約 15，遮住卡座吊耳；船首 / 船尾下緣也比原本壓低 2–4 mm，前後齒輪不從船尖下方露出
  // iter-120：船首下緣不再往上翹（原本 20 / 27 / 34 的 forefoot 讓車頭開口露出底盤），壓成 15.6–16 封住車頭
  yLow: monoCurve(XS, [33, 22, 16.5, 14, 12.5, 10.4, 10, 10, 10, 10.4, 12.5, 14.2, 15.5, 15.6, 15.8, 16]),
  // 船底收向龍骨的下緣半寬（iter-114）：中段 34（船殼下段幾乎垂直往下，像龍骨側板）；前後輪處由輪拱切開（cutZFrom 21）
  keel: monoCurve(XS, [1.5, 3, 7.5, 18.5, 31, 28, 26, 25.5, 26, 28, 31, 21, 12.5, 7.5, 4.4, 2.6]),
};

/**
 * 甲板蓋板上的小座艙開口（iter-115）：原本中段整片下沉 10 mm 的開放甲板（評審：開放式船斗不像比賽用車殼）改成和船舷齊平的木板甲板，
 * 只在中段留一個 24 × 18 mm 的圓角方口（舵手 / 划手位），深 4.5 mm
 * @type {{ x0: number, x1: number, hz: number, r: number, depth: number }}
 */
const HATCH = { x0: -14, x1: 10, hz: 9, r: 3, depth: 4.5 };
/** @type {number} 疊板道數 */
const STRAKES = 4;
/** @type {number} 疊板接縫往內的階差（mm） */
const LAP_STEP = 0.8;

/**
 * 該站的寬度縮放（兩端船尖附近，船舷欄、疊板階差等比例縮小，避免剖面點交錯）
 * @type {(x: number) => number}
 */
const tipScale = (x) => Math.min(1, P.hw(x) / 20);

/**
 * 該站的幾何量：甲板高、船舷欄內緣 z、每道疊板的上緣 / 下緣（lip）
 * @type {(x: number) => { sheer: number, hw: number, yLow: number, deckY: number, zi: number, strakes: { zTop: number, yTop: number, zLip: number, yLip: number }[] }}
 */
const stationAt = (x) => {
  const sheer = P.sheer(x);
  const hw = P.hw(x);
  const yLow = P.yLow(x);
  const keel = Math.min(P.keel(x), hw - 0.5);
  const k = tipScale(x);
  // iter-115：甲板蓋板只比船舷頂低 1.2 mm（船舷欄成一道低矮的護欄），不再下沉
  const deckY = sheer - 1.2;
  // 船舷欄厚度（外側船殼到內壁）至少 1.5 mm：iter-114 修正——船首 / 船尾尖端原本只有 3k（< 殼厚 0.8），殼內面會從外側穿出（Blender 看到內面色塊）
  const zi = Math.max(0.4, hw - Math.max(3 * k, 1.5));
  const yTop0 = sheer - 1.4;
  const h = (yTop0 - yLow) / STRAKES;
  const half = (LAP_STEP * k) / 2;
  /** @type {(y: number) => number} 船殼斷面曲線：上段近乎垂直、下段往龍骨收（舭部彎曲，平方根曲線） */
  const zc = (y) => keel + (hw - keel) * Math.sqrt(Math.max(0, Math.min(1, (y - yLow) / (yTop0 - yLow))));
  /** @type {{ zTop: number, yTop: number, zLip: number, yLip: number }[]} */
  const strakes = [];
  for (let i = 0; i < STRAKES; i++) {
    const yTop = yTop0 - i * h;
    const yLip = yTop - h;
    // 每道疊板：上緣比斷面曲線內收半階、下緣唇外凸半階 → 接縫處往內一階（上一道的下緣蓋在下一道外面）
    strakes.push({ zTop: i === 0 ? hw : zc(yTop) - half, yTop, zLip: zc(yLip) + half, yLip });
  }
  return { sheer, hw, yLow, deckY, zi, strakes };
};

/**
 * 半剖面 12 點：甲板中線 → 甲板邊 → 船舷欄內壁頂 → 船舷欄頂 → 外側船舷角（第 1 道疊板上緣）→ 4 道疊板（每道：下緣唇、往內一階的下一道上緣）→ 船身下緣
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const s = stationAt(x);
  const k = tipScale(x);
  /** @type {number[][]} */
  const pts = [
    // 甲板中線拱起 2.2 mm（蓋板是一片弧面而不是平板；iter-120 由 3 mm 降低，減正面面積）
    [0, s.deckY + 2.2 * k],
    [s.zi - 1.2 * k, s.deckY],
    [s.zi, s.sheer - 0.6],
    [s.hw - 0.4 * k, s.sheer],
    [s.hw, s.sheer - 1.4],
  ];
  s.strakes.forEach((st, i) => {
    pts.push([st.zLip, st.yLip]);
    if (i < STRAKES - 1) {
      pts.push([s.strakes[i + 1].zTop, st.yLip]);
    }
  });
  return pts;
};

// 船首 / 船尾尖端曲率大，每 1 mm 一站；中段 2 mm
const STATIONS = [...buildStations(-66, -54, 1, profile).slice(0, -1), ...buildStations(-54, 60, 2, profile).slice(0, -1), ...buildStations(60, 73, 1, profile)];

/**
 * 剖面參數 s 的分段點（和 polyBody 的 createSmoothPolySurface 同一算法：各段平均長度占比），給塗裝分區判斷「甲板 / 外側船殼」
 * @type {number[]}
 */
const BRK = (() => {
  const n = STATIONS[0].pts.length;
  const seg = [];
  for (let i = 0; i < n - 1; i++) {
    let l = 0;
    for (const st of STATIONS) {
      l += Math.hypot(st.pts[i + 1][0] - st.pts[i][0], st.pts[i + 1][1] - st.pts[i][1]);
    }
    seg.push(Math.max(0.5, l / STATIONS.length));
  }
  const total = seg.reduce((a, b) => a + b, 0);
  const out = [0];
  for (const l of seg) {
    out.push(out[out.length - 1] + l / total);
  }
  return out;
})();

/** @type {number[]} 圓盾中心 x（每側 5 面，間距 10；盾徑 10.8 → 相鄰兩面互相疊 0.8 mm，像 Gokstad 船舷外互疊的盾列） */
const SHIELD_X = [-20, -10, 0, 10, 20];
/** @type {number} 圓盾半徑 */
const SHIELD_R = 5.4;
/** @type {number} 圓盾厚度 */
const SHIELD_T = 0.6;

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 霧面材質（基準評審 iter-112：神話款要有材質對比）：焦油木船殼、橡木甲板、盾面為霧面（roughness 0.6–0.75、低 clearcoat）
  tar: namedMaterial('paint-tar-brown', { color: 0x2a1d16, roughness: 0.72, clearcoat: 0.08, clearcoatRoughness: 0.6 }),
  deck: namedMaterial('paint-deck-oak', { color: 0x6b4a2f, roughness: 0.78, clearcoat: 0 }),
  deck2: namedMaterial('paint-deck-oak', { color: 0x5a3d26, roughness: 0.78, clearcoat: 0, side: THREE.DoubleSide }),
  ochre: namedMaterial('paint-ochre-red', { color: 0xa8432a, roughness: 0.62, clearcoat: 0.1 }),
  ochre2: namedMaterial('paint-ochre-red', { color: 0xa8432a, roughness: 0.62, clearcoat: 0.1, side: THREE.DoubleSide }),
  cream: namedMaterial('paint-cream-white', { color: 0xeee0c0, roughness: 0.6, clearcoat: 0.1, side: THREE.DoubleSide }),
  // 真金屬（青銅盾心、蛇眼）：名稱含 -brass → Blender 換成金屬材質
  // 蛇口內：深焦油紅（霧面）
  mouth: namedMaterial('paint-mouth-darkred', { color: 0x4a1610, roughness: 0.7, clearcoat: 0 }),
  bronze: namedMaterial('trim-bronze-brass', { color: 0xb08d57, metalness: 0.8, roughness: 0.32, clearcoat: 0.2 }),
  // iter-120b 擋風罩：深色煙燻 PC（V5 有色座艙；名稱 pc-smoke → Blender 煙燻 PC）
  smoke: namedMaterial('pc-smoke-umber', { color: 0x1c130d, roughness: 0.05, clearcoat: 1.0, transparent: true, opacity: 0.85 }),
  // iter-120 蛇眼：自發光琥珀（炫砲手法 5）
  eye: namedMaterial('lamp-serpent-amber', { color: 0xffb02e, emissive: 0xff8a00, emissiveIntensity: 0.75, roughness: 0.15, clearcoat: 1.0 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1d1612, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-tar', { color: 0x3a2a20, roughness: 0.7, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-tar', { color: 0x3a2a20, roughness: 0.75, side: THREE.DoubleSide }),
  dPale: decalMaterial('decal-pale-wood', { color: 0xc9ae80, roughness: 0.65 }),
  dSeam: decalMaterial('decal-deck-seam', { color: 0x2e2018, roughness: 0.8 }),
  dBronze: decalMaterial('decal-bronze-rivet', { color: 0xb8925a, metalness: 0.75, roughness: 0.32 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/**
 * 平面曲線掃掠（中心線在 z = zc 的 x–y 平面上）：斷面為橢圓，rz = 厚度方向（z）半徑、rn = 平面內法向半徑。
 * 和 sweepEllipse 不同的是側向固定為 z 軸，所以中心線可以通過垂直方向（螺旋捲）而不會翻轉；兩端封口，為封閉網格。
 * @type {(pts: number[][], zc: number, n: number, radius: (t: number) => number[], seg?: number) => THREE.BufferGeometry}
 */
const sweepPlanar = (pts, zc, n, radius, seg = 14) => {
  const curve = new THREE.CatmullRomCurve3(
    pts.map(([x, y]) => new THREE.Vector3(x, y, zc)),
    false,
    'centripetal',
  );
  const side = new THREE.Vector3(0, 0, 1);
  /** @type {THREE.Vector3[][]} */
  const rings = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const c = curve.getPointAt(t);
    const tg = curve.getTangentAt(t);
    const vert = new THREE.Vector3().crossVectors(side, tg).normalize();
    const [rz, rn] = radius(t);
    /** @type {THREE.Vector3[]} */
    const ring = [];
    for (let k = 0; k < seg; k++) {
      const a = (2 * Math.PI * k) / seg;
      ring.push(c.clone().addScaledVector(side, Math.cos(a) * rz).addScaledVector(vert, Math.sin(a) * rn));
    }
    rings.push(ring);
  }
  /** @type {number[]} */
  const pos = [];
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < seg; k++) {
      const a = rings[i][k];
      const b = rings[i][(k + 1) % seg];
      const c = rings[i + 1][(k + 1) % seg];
      const d = rings[i + 1][k];
      pos.push(a.x, a.y, a.z, d.x, d.y, d.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z);
    }
  }
  for (const [ring, flip] of [
    [rings[0], false],
    [rings[n], true],
  ]) {
    const cx = ring.reduce((acc, p) => acc.add(p), new THREE.Vector3()).multiplyScalar(1 / seg);
    for (let k = 0; k < seg; k++) {
      const a = ring[k];
      const b = ring[(k + 1) % seg];
      if (flip) {
        pos.push(cx.x, cx.y, cx.z, b.x, b.y, b.z, a.x, a.y, a.z);
      } else {
        pos.push(cx.x, cx.y, cx.z, a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
};

/**
 * 船尾柱中心線（側視 x–y）：iter-120 縮小成船尾上緣往後上翹、末端往前捲一小圈的鴨尾擾流（基準評審：船尾捲飾縮小；原本頂到 51.4）
 * @type {number[][]}
 */
const STERN_PATH = [
  [-60, 36.2],
  [-64.4, 37.8],
  [-67.4, 39.4],
  [-68.3, 40.9],
  [-67.1, 41.8],
  [-65.7, 41.1],
];
/** @type {(t: number) => number[]} 船尾柱斷面半徑：根粗尖細 */
const STERN_RAD = (t) => [lerp(1.7, 0.9, t), lerp(2.2, 1.1, t)];

/**
 * 蛇頭鼻錐（iter-120 重做；基準評審：船首蛇頭往前下伸成衝角、封住車頭）：原本立在 S 形高頸頂端（頂高 58.5）的小蛇頭，
 * 改成船首尖端往前下伸的扁楔形蛇頭——頭骨蓋在船首上（和船殼融成一體）、吻部往前收尖成衝角，下顎微張、口內深色，
 * 眼上一道往後掃的眉稜（Urnes / Oseberg 木雕蛇首的眼眶，自繪）、自發光琥珀蛇眼。沒有牙、沒有角（不做成龍頭）。
 * 低面數：橢球 16 × 10 段
 * @type {() => { head: THREE.BufferGeometry, mouth: THREE.BufferGeometry, eyes: THREE.BufferGeometry }}
 */
const buildSerpentHead = () => {
  /** @type {(r: number[], c: number[], rot: number) => THREE.BufferGeometry} 橢球（半軸 r、中心 c、繞 z 轉 rot） */
  const ellipsoid = (r, c, rot) => {
    const g = new THREE.SphereGeometry(1, 16, 10);
    g.scale(r[0], r[1], r[2]);
    g.rotateZ(rot);
    g.translate(c[0], c[1], c[2] ?? 0);
    return g;
  };
  // 頭骨：蓋住船首尖端（x 64–76），頂面低平、往前下斜
  // iter-120b（主 agent 看圖：蛇頭太小）：頭骨與吻部加大約 20%（寬 10.8 → 12.8、高約 6.5 → 8），仍是往前下伸的衝角
  const cranium = ellipsoid([7.4, 3.6, 6.4], [69, 19.9], -0.1);
  // 吻部：往前收尖的衝角（前緣 x ≈ 83）
  const snout = ellipsoid([6.4, 2.3, 4.2], [76.6, 18.7], -0.12);
  // 下顎：往下微張
  const jaw = ellipsoid([5.6, 1.1, 3.6], [75.4, 16.7], 0.04);
  // 口內：上下顎之間的深色楔
  const mouth = ellipsoid([5, 0.85, 3.2], [76.2, 17.6], -0.03);
  /** @type {THREE.BufferGeometry[]} */
  const brows = [];
  /** @type {THREE.BufferGeometry[]} */
  const eyes = [];
  for (const sg of [-1, 1]) {
    // 眉稜：眼睛上方往後上掃的長稜（衝刺時「瞇眼」的表情，兼作鼻錐上的導流稜）
    brows.push(ellipsoid([4.8, 0.9, 1.3], [66.8, 22.6, sg * 4.2], 0.12));
    // 杏眼：沿頭長方向拉長、往後上斜
    eyes.push(ellipsoid([1.8, 0.75, 0.75], [71.2, 21.2, sg * 5.1], 0.18));
  }
  return { head: mergeGeos([cranium, snout, jaw, ...brows]), mouth, eyes: mergeGeos(eyes) };
};

/**
 * 圓盾（單面）：實心圓盤（焦油色盾緣）＋外側面對半分區的赭紅 / 奶油白兩片薄面＋青銅盾心（扁球）
 * 對半分區用直線（不用十字四分、不用放射狀，避免任何被挪用的十字 / 日輪圖形）
 * @type {(x: number, sg: number, i: number) => { disc: THREE.BufferGeometry, faceA: THREE.BufferGeometry, faceB: THREE.BufferGeometry, boss: THREE.BufferGeometry }}
 */
const buildShield = (x, sg, i) => {
  const s0 = stationAt(x);
  // iter-120：盾心由船舷下 1.6 降到 4.4（盾頂只高出船舷 1 mm，盾列沿船側排成一條前低後高的帶，不再在正面輪廓上方多出一圈）
  const yc = s0.sheer - 4.4;
  // 盾貼在該高度的外側船殼上
  const s = { hw: hullZAt(x, yc) };
  // 奇數面盾往外多 0.35 mm，疊在偶數面盾外面（互疊的盾列）
  const lift = i % 2 === 1 ? 0.35 : 0;
  const zc = sg * (s.hw + SHIELD_T / 2 + 0.05 + lift);
  const disc = new THREE.CylinderGeometry(SHIELD_R, SHIELD_R, SHIELD_T, 16);
  disc.rotateX(Math.PI / 2);
  disc.translate(x, yc, zc);
  const zFace = sg * (s.hw + SHIELD_T + 0.12 + lift);
  // 分區線的傾角：相鄰兩面盾左右鏡射，盾列讀成有節奏的交替
  const tilt = (i % 2 === 0 ? 1 : -1) * 0.5;
  /** @type {(a0: number) => THREE.BufferGeometry} 半圓薄面（盾緣留 0.6 mm 焦油色） */
  const half = (a0) => {
    const sh = new THREE.Shape();
    const r = SHIELD_R - 0.6;
    sh.moveTo(r * Math.cos(a0), r * Math.sin(a0));
    sh.absarc(0, 0, r, a0, a0 + Math.PI, false);
    sh.lineTo(r * Math.cos(a0), r * Math.sin(a0));
    const g = new THREE.ShapeGeometry(sh, 8);
    if (sg < 0) {
      g.rotateY(Math.PI);
    }
    g.translate(x, yc, zFace);
    return g;
  };
  const faceA = half(Math.PI / 2 + tilt);
  const faceB = half(-Math.PI / 2 + tilt);
  const boss = new THREE.SphereGeometry(1, 10, 6);
  boss.scale(1.7, 1.7, 0.9);
  boss.translate(x, yc, sg * (s.hw + SHIELD_T + 0.2 + lift));
  return { disc, faceA, faceB, boss };
};

/**
 * 該站外側船殼在高度 y 的 |z|（沿剖面點 4 以下的疊板折線內插；超出範圍取端點）
 * @type {(x: number, y: number) => number}
 */
const hullZAt = (x, y) => {
  const pts = profile(x).slice(4);
  if (y >= pts[0][1]) {
    return pts[0][0];
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const [z0, y0] = pts[i];
    const [z1, y1] = pts[i + 1];
    if (y <= y0 && y >= y1) {
      return y0 - y1 < 1e-6 ? Math.min(z0, z1) : lerp(z1, z0, (y - y1) / (y0 - y1));
    }
  }
  return pts[pts.length - 1][0];
};

/**
 * 輪拱內襯（參考 zeppelin-xtail 的 buildHullLiner）：輪拱切口後面的上半圈圓柱面（半徑 = 輪拱半徑 + 0.3），
 * z 從船殼內面（外側 |z| − 1）往內 depth（不小於 zIn）；只做在船身下緣以上（不在船殼外面多出一片），擋住從側面看進去的殼內空腔與底盤
 * @type {(arch: { x: number, y: number, radius: number }, zIn: number, depth: number) => THREE.BufferGeometry}
 */
const buildArchLiner = (arch, zIn, depth) => {
  const r = arch.radius + 0.3;
  const n = 48;
  /** @type {number[]} */
  const pos = [];
  for (const sg of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const t0 = 0.12 + ((Math.PI - 0.24) * i) / n;
      const t1 = 0.12 + ((Math.PI - 0.24) * (i + 1)) / n;
      const x0 = arch.x + r * Math.cos(t0);
      const y0 = arch.y + r * Math.sin(t0);
      const x1 = arch.x + r * Math.cos(t1);
      const y1 = arch.y + r * Math.sin(t1);
      if (y0 < P.yLow(x0) + 0.4 || y1 < P.yLow(x1) + 0.4) {
        continue;
      }
      // 船殼本身比內襯內緣還窄的地方（船首 / 船尾收尖段）不做，避免露在船殼外的細條
      if (hullZAt(x0, y0) - 1 < zIn + 1 || hullZAt(x1, y1) - 1 < zIn + 1) {
        continue;
      }
      const zo0 = Math.max(zIn + 0.5, hullZAt(x0, y0) - 1);
      const zo1 = Math.max(zIn + 0.5, hullZAt(x1, y1) - 1);
      const A = [x0, y0, sg * Math.max(zIn, zo0 - depth)];
      const B = [x1, y1, sg * Math.max(zIn, zo1 - depth)];
      const C = [x1, y1, sg * zo1];
      const D = [x0, y0, sg * zo0];
      // 法線朝輪心
      if (sg > 0) {
        pos.push(...A, ...C, ...B, ...A, ...D, ...C);
      } else {
        pos.push(...A, ...B, ...C, ...A, ...C, ...D);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
};

export const serpentLongshipBody = makePolyBody({
  id: 'body-serpent-longship',
  name: '蛇首長船',
  style: 'myth',
  phase: 8,
  mythSeries: 'norse',
  mythTheme: 'serpent-longship',
  form: 'longship',
  roof: 'open-cockpit',
  wing: 'stern-curl',
  theme: '維京長船（iter-120 楔形衝角）：船首往前下壓的低楔形船身、蛇頭做成往前下伸的鼻錐衝角（自發光蛇眼）、側面 4 道前低後高的疊板速度線（最上一道赭紅蛇身賽車條）、船舷下每側 5 面圓盾、齊平木板甲板只留小座艙口、船尾小鴨尾捲飾',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 銳利稜線：甲板邊、船舷欄內壁頂、外側船舷角、每道疊板的下緣唇與內階（船舷欄頂 3 為圓角）
  hard: [1, 2, 4, 5, 6, 7, 8, 9, 10],
  wheelArches: [
    { x: 40, y: 13, radius: 17.5, cutZFrom: 21 },
    { x: -40, y: 13, radius: 17.5, cutZFrom: 21 },
  ],
  recesses: [
    {
      id: '小座艙',
      view: 'top',
      shape: 'fn',
      sd: (x, y, z) => sdRoundRect(x, Math.abs(z), HATCH.x0, HATCH.x1, -HATCH.hz, HATCH.hz, HATCH.r),
      depth: HATCH.depth,
    },
  ],
  innerSkipRecess: true,
  sideZMin: 30,
  zones: () => [
    // 甲板與船舷欄內壁（剖面點 0–2）：橡木色
    { mat: 'deck', keep: (x, y, z, s) => BRK[2] + 1e-4 - Math.abs(s) },
    // iter-120 賽車條（炫砲手法 4）：最上一道疊板漆赭紅，從蛇頭鼻錐沿船舷一路往後掃到船尾鴨尾——蛇身沿船側延伸（Urnes 蛇身帶的配置），
    // 疊板前低後高，紅條就是一條從鼻尖斜向後上的速度線
    { mat: 'ochre', keep: (x, y, z, s) => Math.min(Math.abs(s) - BRK[4] + 1e-4, BRK[5] + 1e-4 - Math.abs(s)) },
    { mat: 'tar', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'tar', recess: 'deck2', recessWall: 'deck2', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // iter-120 蛇頭鼻錐（赭紅）＋口內＋自發光蛇眼
    const sh = buildSerpentHead();
    parts.push({ geometry: sh.head, mat: 'ochre', solid: true, outline: true, name: 'prow-serpent-head' });
    parts.push({ geometry: sh.mouth, mat: 'mouth', solid: true, name: 'prow-serpent-mouth' });
    parts.push({ geometry: sh.eyes, mat: 'eye', solid: true, name: 'prow-serpent-eyes' });
    // 船尾鴨尾擾流（stern-curl 尾翼，iter-120 縮小）：焦油黑褐，往前捲一小圈
    parts.push({
      geometry: sweepPlanar(STERN_PATH, 0, 24, STERN_RAD, 8),
      mat: 'tar',
      solid: true,
      outline: true,
      name: 'stern-curl',
    });
    // iter-120b 頂面起伏（主 agent 看圖：頂面是一整片平甲板、座艙只是凹洞）：
    // 1) 蛇脊：赭紅低矮中央脊線，從蛇頭後方沿甲板中線往後升到座艙前（蛇身從鼻錐延伸上甲板，V4 中央隆起的概念，圓脊不是 V 形）
    // 2) 擋風罩：座艙口前段一個深色煙燻的低矮擋風罩（V5 小而有色的座艙，長 18、寬 19、高出甲板約 4.7 mm），座艙口後段仍開放
    // 3) 座艙後方焦油色低矮整流背（頭枕整流罩，往後收進甲板）
    {
      /** @type {(x: number) => number} 甲板中線頂高 */
      const deckTop = (x) => P.sheer(x) - 1.2 + 2.2 * tipScale(x);
      parts.push({
        geometry: sweepPlanar(
          [
            [60, deckTop(60) - 0.8],
            [48, deckTop(48) + 0.4],
            [36, deckTop(36) + 0.9],
            [24, deckTop(24) + 1.3],
            [17, deckTop(17) + 1.5],
          ],
          0,
          24,
          (t) => [lerp(1.4, 2.4, t), lerp(1.1, 1.6, t)],
          8,
        ),
        mat: 'ochre',
        solid: true,
        outline: true,
        name: 'serpent-spine-ridge',
      });
      /**
       * 上半橢球＋平底封口（封閉網格；只做甲板以上那一半，不在船殼內多算一整顆橢球的質量）
       * @type {(r: number[], c: number[]) => THREE.BufferGeometry}
       */
      const dome = (r, c) => {
        const top = new THREE.SphereGeometry(1, 16, 6, 0, 2 * Math.PI, 0, Math.PI / 2).toNonIndexed();
        const cap = new THREE.CircleGeometry(1, 16);
        cap.rotateX(Math.PI / 2);
        const g = mergeGeos([top, cap.toNonIndexed()]);
        g.scale(r[0], r[1], r[2]);
        g.translate(c[0], c[1], c[2] ?? 0);
        return g;
      };
      parts.push({ geometry: dome([9, 5.4, 9.5], [13, deckTop(13) - 1.1]), mat: 'smoke', solid: true, outline: true, name: 'cockpit-windshield' });
      parts.push({ geometry: dome([11, 3.4, 6.5], [-25, deckTop(-25) - 0.9]), mat: 'tar', solid: true, outline: true, name: 'cockpit-fairing' });
    }
    // 船舷圓盾：每側 5 面
    /** @type {THREE.BufferGeometry[]} */
    const discs = [];
    /** @type {THREE.BufferGeometry[]} */
    const facesRed = [];
    /** @type {THREE.BufferGeometry[]} */
    const facesCream = [];
    /** @type {THREE.BufferGeometry[]} */
    const bosses = [];
    for (const sg of [-1, 1]) {
      SHIELD_X.forEach((x, i) => {
        const sh = buildShield(x, sg, i);
        discs.push(sh.disc);
        facesRed.push(sh.faceA);
        facesCream.push(sh.faceB);
        bosses.push(sh.boss);
      });
    }
    parts.push({ geometry: mergeGeos(discs), mat: 'tar', solid: true, outline: true, name: 'shields' });
    parts.push({ geometry: mergeGeos(facesRed), mat: 'ochre2', name: 'shield-faces-ochre' });
    parts.push({ geometry: mergeGeos(facesCream), mat: 'cream', name: 'shield-faces-cream' });
    parts.push({ geometry: mergeGeos(bosses), mat: 'bronze', solid: true, name: 'shield-bosses' });
    // 輪拱內襯（前後）：iter-114 從殼內面一路做到 |z| 21（輪拱切口起點；原本只深 3 mm，船殼加寬後會露出殼內空腔），擋住切口裡的殼內空腔與底盤
    parts.push({
      geometry: mergeGeos([buildArchLiner({ x: 40, y: 13, radius: 17.5 }, 21, 14), buildArchLiner({ x: -40, y: 13, radius: 17.5 }, 21, 14)]),
      mat: 'liner',
      shell: true,
      name: 'arch-liners',
    });
    // iter-115：輪胎內側環形擋板（kitsune 的 buildArchWell，|z| 22.9；離 31 mm 輪內側面 1.85 mm）
    parts.push({
      geometry: mergeGeos([{ x: 40, y: 13 }, { x: -40, y: 13 }].map((a) => buildArchWell(a, 22.9, 12.3, 17.8, chassisBlockedNearArch))),
      mat: 'liner',
      shell: true,
      name: 'arch-wells',
    });
    // 小座艙裡的一條划手橫座（實心橫板，兩端埋進座艙壁）
    {
      const g = new THREE.BoxGeometry(2.2, 0.9, 2 * HATCH.hz + 0.6);
      g.translate(-1, stationAt(-1).deckY - HATCH.depth + 2.2, 0);
      parts.push({ geometry: g, mat: 'deck', solid: true, name: 'thwart' });
    }

    /** @type {(s: number) => boolean} 剖面參數在外側船殼（第 1 道疊板上緣以下） */
    const outerSide = (s) => Math.abs(s) > BRK[4] - 1e-4;
    // 疊板邊緣淺木色細線：每道疊板下緣唇上方 0.15–0.85 mm（線寬 0.7）
    parts.push({
      geometry: kit.decal((x, y, z, s) => {
        if (!outerSide(s)) {
          return -1;
        }
        const st = stationAt(x).strakes;
        let d = Infinity;
        for (const k of st) {
          d = Math.min(d, Math.abs(y - (k.yLip + 0.5)));
        }
        return Math.min(0.35 - d, x + 64, 71 - x);
      }),
      mat: 'dPale',
      name: 'decal-strake-edges',
    });
    // 青銅鉚釘點列：每道疊板下緣唇上方 1.6 mm，每 3.5 mm 一顆（直徑 0.9）
    parts.push({
      geometry: kit.decal((x, y, z, s) => {
        if (!outerSide(s)) {
          return -1;
        }
        const ph = (((x + 1.75) % 3.5) + 3.5) % 3.5;
        const du = Math.abs(ph - 1.75);
        const st = stationAt(x).strakes;
        let d = Infinity;
        for (const k of st) {
          d = Math.min(d, Math.hypot(du, y - (k.yLip + 1.6)));
        }
        return Math.min(0.45 - d, x + 60, 66 - x);
      }, { offset: 0.08 }),
      mat: 'dBronze',
      name: 'decal-rivets',
    });
    // 甲板木板縫：沿 x 的深色細線，每 4 mm 一道（只畫在甲板平面上）
    parts.push({
      geometry: kit.decal((x, y, z, s) => {
        if (Math.abs(s) > BRK[1] - 0.002) {
          return -1;
        }
        const ph = ((Math.abs(z) + 2) % 4) - 2;
        return 0.3 - Math.abs(ph);
      }),
      mat: 'dSeam',
      name: 'decal-deck-seams',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他款）',
    geometry: 'iter-120（推估）：船舷上緣 船尾 38 → 中段 33.2 → 前輪 33.6 → 船首尖 19（楔形鼻）、船首下緣 15.6–16（封住車頭）；蛇頭鼻錐前緣 x 82.6、船尾鴨尾 −69.7（外框 152.3 mm）、頂高 43（鴨尾捲飾）；盾心在船舷下 4.4 mm。以下為 iter-114 / 115 紀錄——本檔站位產生器 P（推估）：船身 x −66 ~ 73，船舷上緣中段 32.5、兩端 42.5 / 45；iter-114 起前後輪上方最寬 ±35（蓋住 31 mm 輪胎外側面 ±34.75）、中段 ±27.5（盾外緣約 ±29.5，俯視和 khepri / skeleton 的 IoU ≤ 0.81）、側面下緣中段 y 10；車殼外框含船首柱蛇頭 / 船尾柱 152.6 mm（SPEC 1.14a：碰撞方塊長 ≤ 153 mm 才不會在立體橋刮路面）；蛇頭頂約 58.5',
    strakes: '4 道疊板，每道下緣唇往內 0.8 mm 一階（推估：1/32 縮尺下看得到的最小階差；Gokstad / Oseberg 船為疊板船殼，見 DESIGN.md）',
    shields: '每側 5 面圓盾，半徑 6、厚 0.9 mm 實心 ABS（推估；Gokstad 船舷每側 32 面盾，縮尺後只放 5 面）',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），甲板高 = 船舷 − 1.2 ≥ 31.3（輪拱頂 30.5 之上）；iter-115 加 buildArchWell 輪胎內側環形擋板（|z| 22.9）',
    deck: 'iter-115：甲板蓋板 = 船舷頂 − 1.2 mm、中線拱 3 mm；小座艙 x −14 ~ 10、|z| ≤ 9、深 4.5 mm、內有一條划手橫座（推估）',
    serpentHead: '蛇頭鼻錐（iter-120）：頭長約 19（x 63.6 ~ 82.6）、寬 10.8、高約 6.5 mm 的實心橢球組合（頭骨＋吻部＋下顎＋眉稜，16 × 10 段），自發光琥珀眼 3 × 1.2 mm（推估）',
    stem: '船尾鴨尾捲飾為實心 ABS 掃掠件（斷面根部 3.4 × 4.4 mm 往捲曲中心漸細，iter-120 縮小），質量 = 封閉體積 × 1.05 g/cm³（推估）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
