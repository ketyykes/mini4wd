// 由零件目錄與車殼目錄產生 Markdown 表格（給 FINAL_REPORT / SPEC 對照用，數值直接取自程式資料）
// 用法：npx vite-node scripts/parts-table.mjs
import { allParts } from '../src/parts/index.js';
import { listBodies, bodyMassProps } from '../src/bodies/index.js';
import { assemble, loadConfig, listConfigs } from '../src/assembly.js';
import { validateAssembly } from '../src/regulation.js';

/** @type {(p: any) => string} 每類零件的關鍵規格摘要 */
const keySpec = (p) => {
  switch (p.category) {
    case 'motor':
      return `${p.sizeClass} 尺寸 ${p.shaft === 'dual' ? '雙軸' : '單軸'}；${p.noLoadRpm_atRated} rpm / ${(p.stallTorque_atRated_Nm * 1000).toFixed(2)} mN·m / I0 ${p.noLoadCurrent_A} A / I_stall ${p.stallCurrent_atRated_A} A @${p.ratedVoltage_V} V`;
    case 'gear':
      return `${p.ratio}:1，η ${p.efficiency}`;
    case 'wheel':
      return `直徑 ${p.diameter_mm}、寬 ${p.width_mm}、輪框 ${p.rimDiameter_mm} mm；μ ${p.frictionCoeff}、C_rr ${p.rollingResistanceCoeff}`;
    case 'bearing':
      return `${p.kind === 'ball' ? '滾珠培林' : '塑膠軸承'} ${p.outerDiameter_mm}×${p.innerDiameter_mm}×${p.width_mm} mm；μ ${p.frictionCoeff}`;
    case 'roller':
      return `直徑 ${p.diameter_mm}、高 ${p.height_mm} mm（${p.finish === 'aluminum' ? '鋁合金' : '塑膠'}）`;
    case 'stay-front':
      return `導輪軸 x ${p.rollerX_mm}、z ±${p.rollerZ_mm}、高 ${p.rollerY_mm} mm`;
    case 'stay-rear':
      return `導輪軸 x −${p.rollerX_mm}、z ±${p.rollerZ_mm}、高 ${p.lowerRollerHeight_mm} / ${p.upperRollerHeight_mm} mm`;
    case 'battery':
      return `${p.cells} × ${p.size} ${p.chemistry}，${p.capacity_mAh} mAh，內阻 ${p.cellInternalResistance_ohm * 1000} mΩ/顆`;
    case 'chassis':
      return `軸距 ${p.wheelbase_mm}、輪距 ${p.trackWidth_mm}、離地 ${p.groundClearanceRef_mm} mm（${p.refWheelDiameter_mm} mm 輪）、${p.driveType}`;
    case 'axle':
      return `${p.diameter_mm} mm 六角 × ${p.length_mm} mm`;
    default:
      return '—';
  }
};

/** @type {(p: any) => string} 質量的來源摘要 */
const massSrc = (p) => (p.src?.mass_g ?? '').replace(/\|/g, '/');

const lines = [];
lines.push('### 零件');
lines.push('');
lines.push('| 類別 | id | 名稱 | 關鍵規格 | 質量 g | 質量來源 / 推估 |');
lines.push('| --- | --- | --- | --- | --- | --- |');
for (const p of allParts) {
  lines.push(`| ${p.category} | \`${p.id}\` | ${p.name} | ${keySpec(p)} | ${p.mass_g} | ${massSrc(p)} |`);
}
lines.push('');
lines.push('### 車殼');
lines.push('');
lines.push('| id | 名稱 | 材料 / 壁厚 | 殼面積 mm² | 質量 g | 外框（長 × 寬 × 高，車殼本體） |');
lines.push('| --- | --- | --- | --- | --- | --- |');
for (const b of listBodies()) {
  const m = bodyMassProps(b);
  const bb = m.bbox_mm;
  lines.push(`| \`${b.id}\` | ${b.name} | ${b.material} ${b.density_g_cm3} g/cm³ / ${b.wallThickness_mm} mm | ${m.shellArea_mm2.toFixed(0)} | ${m.mass_g.toFixed(2)} | ${(bb.max.x - bb.min.x).toFixed(1)} × ${(bb.max.z - bb.min.z).toFixed(1)} × ${bb.max.y.toFixed(1)} |`);
}
lines.push('');
lines.push('### 組裝設定');
lines.push('');
lines.push('| 設定 | 車殼 | 馬達 / 齒輪 / 輪胎 / 導輪 / 軸承 | 總重 g | 重心 (x, y) mm | 外框 mm | 規則 | 警告 |');
lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
for (const name of listConfigs()) {
  const c = loadConfig(name);
  const a = assemble(c);
  const v = validateAssembly(a);
  const s = a.bbox_mm.size;
  lines.push(`| \`${name}\` | ${c.body} | ${c.motor} / ${c.gear} / ${c.wheels} / ${c.rollers} / ${c.bearings} | ${a.mass_g.toFixed(1)} | (${a.com_mm.x.toFixed(1)}, ${a.com_mm.y.toFixed(1)}) | ${s.x.toFixed(1)} × ${s.z.toFixed(1)} × ${s.y.toFixed(1)} | ${v.ok ? '合法' : v.violations.map((x) => x.code).join(', ')} | ${v.warnings.map((x) => x.code).join(', ') || '—'} |`);
}
console.log(lines.join('\n'));
