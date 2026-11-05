// 列出全部車殼的分組欄位（檢查用）
import { listBodies } from '../../src/bodies/index.js';
for (const b of listBodies()) {
  console.log([b.id, b.style, b.homageSeries ?? '-', b.raceType ?? '-', b.form ?? '-', b.roof ?? '-', b.wing ?? '-'].join('  '));
}
