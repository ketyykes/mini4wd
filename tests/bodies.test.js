// 第六階段：車殼造型差異（P20，定義見 SPEC.md 第 2 部分）
// - 三組車殼：比賽型（style 'race'，raceType）≥ 6 款且 raceType ≥ 5 種；致敬《爆走兄弟》1（homageSeries 'lg1'）≥ 5 款；致敬《爆走兄弟》2（'lg2'，WGP）≥ 5 款
// - 第三階段的舊致敬款（wedge / beast / fork）已退役，不可留在清單
// - 全部車殼任兩款的側視 / 俯視輪廓 IoU 都低於門檻（量法見 src/bodies/silhouette.js：外形三角形投影、0.5 mm 光柵化、填滿輪廓、同安裝點座標）
// - 同組內兩兩之間，在車高、長度、車頂型態、尾翼型式、車身型態中至少 2 項不同；每組內 form / roof / wing 各至少 3 種
// - 每組至少 2 款與 31 mm 大徑輪（wheel-31-large）組裝合法
import { describe, test, expect } from 'vitest';
import { listBodies, bodyMassProps } from '../src/bodies/index.js';
import { bodyIoU } from '../src/bodies/silhouette.js';
import { assemble, loadConfig } from '../src/assembly.js';
import { validateAssembly } from '../src/regulation.js';

/** @typedef {import('../src/bodies/types').BodyDef} BodyDef */

/** @type {number} 輪廓 IoU 門檻（SPEC P20 補充定案 0.85；不可為了讓相似款通過而放寬） */
const IOU_MAX = 0.85;
/** @type {number} 車殼最高點相差至少這麼多才算「車高不同」（mm；SPEC P20 第四階段補充，第六階段沿用） */
const HEIGHT_DIFF_MM = 3;
/** @type {number} 車殼長度相差至少這麼多才算「長度不同」（mm；SPEC P20 第四階段補充，第六階段沿用） */
const LENGTH_DIFF_MM = 5;
/** @type {string[]} 第三階段退役的致敬款 */
const RETIRED = ['body-wedge', 'body-beast', 'body-fork'];

/** @type {{ key: string, label: string, minCount: number, pick: (b: BodyDef) => boolean }[]} 第六階段的三組（GOAL 完成條件 4） */
const GROUPS = [
  { key: 'race', label: '比賽型', minCount: 6, pick: (b) => b.style === 'race' },
  { key: 'lg1', label: '致敬《爆走兄弟》1', minCount: 5, pick: (b) => b.style === 'homage' && b.homageSeries === 'lg1' },
  { key: 'lg2', label: '致敬《爆走兄弟》2', minCount: 5, pick: (b) => b.style === 'homage' && b.homageSeries === 'lg2' },
];
/** @type {number} 每組內 form / roof / wing 至少幾種 */
const MIN_KINDS = 3;
/** @type {number} 比賽型 raceType 至少幾種 */
const MIN_RACE_TYPES = 5;
/** @type {number} 每組至少幾款可裝 31 mm 輪 */
const MIN_BIG_WHEEL = 2;

describe('第六階段：車殼造型差異（P20）', () => {
  test('P20_body_variety 比賽型 ≥ 6（raceType ≥ 5 種）、LG1 / LG2 致敬各 ≥ 5、任兩款側視 / 俯視輪廓 IoU < 門檻、同組兩兩至少 2 項型式不同、每組型式各 ≥ 3 種、每組 ≥ 2 款可裝 31 mm 輪胎', () => {
    const bodies = listBodies();
    const retiredLeft = bodies.filter((b) => RETIRED.includes(b.id)).map((b) => b.id);
    expect(retiredLeft, '舊致敬款應已退役').toEqual([]);
    // 致敬款一定要標作品；比賽型一定要標型態
    const unlabeled = bodies.filter((b) => (b.style === 'homage' && !b.homageSeries) || (b.style === 'race' && !b.raceType)).map((b) => b.id);
    expect(unlabeled, '致敬款缺 homageSeries 或比賽型缺 raceType').toEqual([]);

    let worstSide = 0;
    let worstTop = 0;
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const r = bodyIoU(bodies[i], bodies[j]);
        worstSide = Math.max(worstSide, r.side);
        worstTop = Math.max(worstTop, r.top);
        expect(r.side, `${bodies[i].id} × ${bodies[j].id} 側視輪廓太像（${r.side.toFixed(3)}）`).toBeLessThan(IOU_MAX);
        expect(r.top, `${bodies[i].id} × ${bodies[j].id} 俯視輪廓太像（${r.top.toFixed(3)}）`).toBeLessThan(IOU_MAX);
      }
    }
    console.log(`[P20] 車殼 ${bodies.length} 款；最大 IoU：側視 ${worstSide.toFixed(3)}、俯視 ${worstTop.toFixed(3)}（門檻 ${IOU_MAX}）`);

    /** @type {Map<string, { height: number, length: number }>} */
    const dims = new Map();
    for (const b of bodies) {
      const bb = bodyMassProps(b).bbox_mm;
      dims.set(b.id, { height: bb.max.y, length: bb.max.x - bb.min.x });
    }

    for (const g of GROUPS) {
      const members = bodies.filter(g.pick);
      console.log(`[P20] ${g.label} ${members.length} 款：${members.map((b) => b.id).join(', ') || '（無）'}`);
      expect(members.length, `${g.label} 款數`).toBeGreaterThanOrEqual(g.minCount);

      for (const key of /** @type {const} */ (['form', 'roof', 'wing'])) {
        const kinds = new Set(members.map((b) => b[key]).filter(Boolean));
        console.log(`[P20] ${g.label} ${key} ${kinds.size} 種：${[...kinds].join(', ')}`);
        expect(kinds.size, `${g.label} 的 ${key} 種類`).toBeGreaterThanOrEqual(MIN_KINDS);
      }
      if (g.key === 'race') {
        const raceTypes = new Set(members.map((b) => b.raceType));
        console.log(`[P20] 比賽型 raceType ${raceTypes.size} 種：${[...raceTypes].join(', ')}`);
        expect(raceTypes.size).toBeGreaterThanOrEqual(MIN_RACE_TYPES);
      }

      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const a = members[i];
          const b = members[j];
          const da = dims.get(a.id);
          const db = dims.get(b.id);
          /** @type {string[]} */
          const diffs = [];
          if (Math.abs(da.height - db.height) >= HEIGHT_DIFF_MM) {
            diffs.push('車高');
          }
          if (Math.abs(da.length - db.length) >= LENGTH_DIFF_MM) {
            diffs.push('長度');
          }
          if (a.roof && b.roof && a.roof !== b.roof) {
            diffs.push('車頂');
          }
          if (a.wing && b.wing && a.wing !== b.wing) {
            diffs.push('尾翼');
          }
          if (a.form && b.form && a.form !== b.form) {
            diffs.push('車身型態');
          }
          console.log(`[P20] 型式差異 ${a.id} × ${b.id}：${diffs.join('、') || '（無）'}`);
          expect(diffs.length, `${a.id} × ${b.id} 車高 / 長度 / 車頂 / 尾翼 / 車身型態只有 ${diffs.length} 項不同`).toBeGreaterThanOrEqual(2);
        }
      }

      const bigWheelOk = members.filter((b) => {
        const asm = assemble({ ...loadConfig('default'), body: b.id, wheels: 'wheel-31-large' });
        const v = validateAssembly(asm);
        console.log(`[P20] ${b.id} + wheel-31-large：${v.ok ? '合法' : `不合法（${v.violations.map((x) => x.code).join(', ')}）`}，車殼–輪胎間隙 ${asm.fit.tire_mm.toFixed(2)} mm`);
        return v.ok;
      });
      expect(bigWheelOk.length, `${g.label} 可裝 31 mm 輪的款數`).toBeGreaterThanOrEqual(MIN_BIG_WHEEL);
    }
  }, 300000);
});
