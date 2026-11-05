// 車殼總表（markdown）：分組、型態、質量、車殼長 / 高、26 / 31 mm 合法性（寫 SPEC 1.14 / FINAL_REPORT 用）
import { listBodies, bodyMassProps } from '../../src/bodies/index.js';
import { assemble, loadConfig } from '../../src/assembly.js';
import { validateAssembly } from '../../src/regulation.js';
import { mythGroupLabel } from '../../src/bodies/mythSeries.js';

/** @type {(b: import('../../src/bodies/types').BodyDef) => string} */
const groupOf = (b) => {
  if (b.style === 'race') {
    return `比賽型（${b.raceType}）`;
  }
  if (b.style === 'myth') {
    return `${mythGroupLabel(b.mythSeries)}（${b.mythTheme}）`;
  }
  if (b.homageSeries === 'lg1') {
    return 'LG1 致敬';
  }
  if (b.homageSeries === 'lg2') {
    return 'LG2 致敬';
  }
  return '其他';
};
console.log('| body-id | 名稱 | 分組 | form / roof / wing | 材質 / 壁厚 | 車殼質量 | 車殼長 / 高 | 整車（26 mm） | 31 mm 輪 |');
console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const b of listBodies()) {
  const mp = bodyMassProps(b);
  const len = mp.bbox_mm.max.x - mp.bbox_mm.min.x;
  const a26 = assemble({ ...loadConfig('default'), body: b.id });
  const a31 = assemble({ ...loadConfig('default'), body: b.id, wheels: 'wheel-31-large' });
  const ok31 = validateAssembly(a31).ok;
  console.log(`| \`${b.id}\` | ${b.name} | ${groupOf(b)} | ${b.form} / ${b.roof} / ${b.wing} | ${b.material} ${b.wallThickness_mm} mm | ${mp.mass_g.toFixed(2)} g | ${len.toFixed(1)} / ${mp.bbox_mm.max.y.toFixed(1)} mm | ${a26.mass_g.toFixed(1)} g${validateAssembly(a26).ok ? '' : '（不合法）'} | ${ok31 ? '合法' : '不合法'} |`);
}
