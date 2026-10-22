// 列出全部車殼的第六階段分組欄位（主 agent 檢查用）
import { listBodies } from '../../src/bodies/index.js';
for (const b of listBodies()) {
  console.log([b.id, b.style, b.homageSeries ?? '-', b.raceType ?? '-', b.form ?? '-', b.roof ?? '-', b.wing ?? '-'].join('  '));
}
