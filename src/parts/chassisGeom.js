// Shared structural side geometry, in chassis coordinates (mm).
// Dimensions retain the existing model estimates; mounting height is derived
// from these surfaces rather than the chassis-wide bounding box.
const cache = new Map();
export function roundRectOutline(cx, cy, width, height, radius, segments = 6) {
  const out = [], hx = width / 2 - radius, hy = height / 2 - radius;
  for (const [x, y, a] of [[hx, hy, 0], [-hx, hy, Math.PI / 2], [-hx, -hy, Math.PI], [hx, -hy, 1.5 * Math.PI]]) {
    for (let i = 0; i <= segments; i++) out.push([cx + x + radius * Math.cos(a + i / segments * Math.PI / 2), cy + y + radius * Math.sin(a + i / segments * Math.PI / 2)]);
  }
  return out;
}
const box = (x0, x1, y0, y1, z0, z1) => ({ kind: 'box', min: { x: x0, y: y0, z: z0 }, max: { x: x1, y: y1, z: z1 } });

export function chassisSideGeometry(ch) {
  const y0 = ch.groundClearanceRef_mm ?? ch.groundClearance_mm;
  const hw = ch.wheelbase_mm / 2, wheelY = ch.refWheelDiameter_mm / 2;
  const key = JSON.stringify([y0, hw, wheelY]);
  if (cache.has(key)) return cache.get(key);
  const topY = 9.4, arcR = wheelY + 2.5, winY = y0 + 3;
  const profile = [];
  for (const sign of [1, -1]) for (let i = 0; i <= 10; i++) {
    const y = y0 + (topY - y0) * (sign > 0 ? i : 10 - i) / 10;
    profile.push([sign * (hw - Math.sqrt(arcR ** 2 - (y - wheelY) ** 2)), y]);
  }
  const windows = [-13, 0, 13].map((x) => roundRectOutline(x, winY, 9, 3, 1));
  for (const x of [-19.5, -6.5, 6.5, 19.5]) windows.push(Array.from({ length: 12 }, (_, i) => [x + 0.8 * Math.cos(i / 6 * Math.PI), topY - 1.6 + 0.8 * Math.sin(i / 6 * Math.PI)]));
  const sides = [-1, 1].map((sign) => {
    const skirtOutline = [[-23, 29], [23, 29], [21, 35.5], [-21, 35.5]].map(([x, z]) => [x, sign * z]);
    const holes = [-12, 0, 12].map((x) => roundRectOutline(x, sign * 32.2, 8, 3, 1.2));
    if (sign < 0) { skirtOutline.reverse(); holes.forEach((h) => h.reverse()); }
    const skirt = { kind: 'plate', outline: skirtOutline, holes, y0: y0 + 0.3, y1: y0 + 3.1 };
    const wall = { kind: 'profileZ', outline: profile, holes: windows, z0: sign > 0 ? 35 : -36.2, z1: sign > 0 ? 36.2 : -35 };
    const block = box(-20, -10, y0, 7.6, sign > 0 ? 33 : -38.8, sign > 0 ? 38.8 : -33);
    return { sign, skirt, wall, block, y0, topY, wheelY, arcR, winY, hw };
  });
  cache.set(key, sides);
  return sides;
}

/** Side structures relevant to attachments. Small ribs/flanges use enclosing
 * boxes; the skirt/window holes and curved wheel relief are kept explicitly. */
export function chassisSideSolids(ch) {
  // VZ 這類用簡單立壁的底盤：側壁直接用零件資料（與 model.js 同一份）
  if (ch.sideWalls_mm) {
    const floorTop = (ch.groundClearanceRef_mm ?? ch.groundClearance_mm) + ch.plateThickness_mm;
    return ch.sideWalls_mm.flatMap(([x0, x1, z]) => [-1, 1].map((sign) => ({
      label: `${sign < 0 ? '左' : '右'}底盤側壁 x ${x0}～${x1}`,
      solid: box(x0, x1, floorTop, floorTop + ch.sideWallHeight_mm, sign > 0 ? z - 1.4 : -z, sign > 0 ? z : -(z - 1.4)),
    })));
  }
  return chassisSideGeometry(ch).flatMap((s) => {
    const sign = s.sign;
    const items = [['側裙', s.skirt], ['側壁', s.wall], ['支撐塊', s.block]];
    for (const x of [-13, 0, 13]) items.push(['內凹窗背板', { kind: 'profileZ', outline: roundRectOutline(x, s.winY, 9.4, 3.4, 1.1), z0: sign > 0 ? 34.6 : -34.9, z1: sign > 0 ? 34.9 : -34.6 }]);
    for (const x of [-6.5, 6.5]) items.push(['立肋', box(x - 0.4, x + 0.4, s.y0, s.topY - 0.6, sign > 0 ? 36.2 : -36.5, sign > 0 ? 36.5 : -36.2)]);
    for (const x of [-21, 21]) items.push(['卡榫', box(x - 1.6, x + 1.6, s.topY - 3, s.topY - 1.4, sign > 0 ? 36.4 : -37.4, sign > 0 ? 37.4 : -36.4)]);
    const halfChamfer = s.hw - Math.sqrt(s.arcR ** 2 - (7.4 - s.wheelY) ** 2);
    const dy = (0.6 * Math.cos(0.6) + 0.5 * Math.sin(0.6)) / 2;
    const dz = (0.6 * Math.sin(0.6) + 0.5 * Math.cos(0.6)) / 2;
    items.push(['倒角條', box(-halfChamfer, halfChamfer, 7.4 - dy, 7.4 + dy, sign * 36.3 - dz, sign * 36.3 + dz)]);
    // Bound the curved upper edge by short strips (the rendered tube radius is 0.5).
    for (let x = -24; x < 24; x += 2) {
      const y = (u) => s.topY - 0.3 - 1.4 * (u / 24) ** 2;
      items.push(['上緣翻邊', box(x - 0.5, x + 2.5, Math.min(y(x), y(x + 2)) - 0.5, Math.max(y(x), y(x + 2)) + 0.5, sign * 35.95 - 0.5, sign * 35.95 + 0.5)]);
    }
    return items.map(([name, solid]) => ({ label: `${sign < 0 ? '左' : '右'}底盤${name}`, solid }));
  });
}

export function sideDamperAdapter(ch, part, seat) {
  const side = Math.sign(seat.z), surfaceY = seat.y ?? chassisSideGeometry(ch)[0].skirt.y1;
  const spacerHeight = seat.spacer_mm ?? part.mountSpacer_mm ?? 6; // Tamiya 15473, official length; 底盤可指定不加墊管（VZ）
  // Estimated straight FRP adapter, matching the 6.5 mm side-skirt width.
  // Mass follows the displayed volume.
  const plateThickness = 1.5, length = seat.plateLength_mm ?? 35;
  const centerZ = seat.z;
  // 外掛式（seat.plateInnerZ_mm）：側板從底盤側壁外側伸到制振器外緣，制振器在側壁外面、貼近離地高度
  const zIn = seat.plateInnerZ_mm !== undefined ? side * seat.plateInnerZ_mm : centerZ - side * 3.25;
  const zOut = centerZ + side * 3.25;
  const width = Math.abs(zOut - zIn);
  const plateMass = length * width * plateThickness * 1.85 / 1000;
  const plateY = surfaceY + spacerHeight;
  const plate = box(-length / 2 + seat.x, length / 2 + seat.x, plateY, plateY + plateThickness, Math.min(zIn, zOut), Math.max(zIn, zOut));
  // Realize the existing 1 mm compressible seat above the rigid plate, so its
  // lower joint stop never places brass inside FRP. Foam density follows the
  // existing sponge estimate (0.12 g/cm³); this pad is an estimated installation.
  const padHeight = 1, padY = plate.max.y;
  const padWidth = Math.min(6.5, part.width_mm ?? part.diameter_mm);
  const padLength = Math.min(length, part.length_mm ?? part.diameter_mm);
  const pad = part.shape === 'box'
    ? box(seat.x - padLength / 2, seat.x + padLength / 2, padY, padY + padHeight, seat.z - padWidth / 2, seat.z + padWidth / 2)
    : { kind: 'cyl', axis: 'y', c: { x: seat.x, y: padY + padHeight / 2, z: seat.z }, r: padWidth / 2, halfLen: padHeight / 2 };
  const padMass = (part.shape === 'box' ? padWidth * padLength : Math.PI * (padWidth / 2) ** 2) * padHeight * 0.12 / 1000;
  const xs = part.shape === 'box' ? [-part.length_mm / 4, part.length_mm / 4] : [0];
  const spacers = spacerHeight > 0 ? xs.map((dx) => ({ x: seat.x + dx, z: seat.z, y0: surfaceY, y1: plateY, outerRadius: 2, innerRadius: 1.1, mass_g: Math.PI * (2 ** 2 - 1.1 ** 2) * spacerHeight * 2.7 / 1000 })) : [];
  return { plate, plateMass_g: plateMass, pad, padMass_g: padMass, spacers, seatY: plate.max.y + padHeight, surfaceY, spacerHeight };
}
