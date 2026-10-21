// 第四階段：車殼造型差異（P20，定義見 SPEC.md 第 2 部分）
// - 新致敬款（style 'homage' 且 phase 4）≥ 6、比賽型（style 'race'）≥ 3；第三階段的舊致敬款（wedge / beast / fork）已退役，不可留在清單
// - 全部車殼任兩款的側視 / 俯視輪廓 IoU 都低於門檻（量法見 src/bodies/silhouette.js：外形三角形投影、0.5 mm 光柵化、填滿輪廓、同安裝點座標）
// - 新致敬款兩兩之間，在車高、長度、車頂型態、尾翼型式中至少 2 項不同
// - 至少 2 款新致敬款與 31 mm 大徑輪（wheel-31-large）組裝合法
import { describe, test, expect } from 'vitest';
import { listBodies, bodyMassProps } from '../src/bodies/index.js';
import { bodyIoU } from '../src/bodies/silhouette.js';
import { assemble, loadConfig } from '../src/assembly.js';
import { validateAssembly } from '../src/regulation.js';

/** @typedef {import('../src/bodies/types').BodyDef} BodyDef */

/** @type {number} 輪廓 IoU 門檻（SPEC P20 補充定案 0.85；不可為了讓相似款通過而放寬） */
const IOU_MAX = 0.85;
/** @type {number} 車殼最高點相差至少這麼多才算「車高不同」（mm；SPEC P20 第四階段補充） */
const HEIGHT_DIFF_MM = 3;
/** @type {number} 車殼長度相差至少這麼多才算「長度不同」（mm；SPEC P20 第四階段補充） */
const LENGTH_DIFF_MM = 5;
/** @type {string[]} 第三階段退役的致敬款 */
const RETIRED = ['body-wedge', 'body-beast', 'body-fork'];

describe('第四階段：車殼造型差異（P20）', () => {
  test('P20_body_variety 新致敬款 ≥ 6、比賽型 ≥ 3、任兩款側視 / 俯視輪廓 IoU < 門檻、新致敬款兩兩至少 2 項型式不同、至少 2 款新致敬款可裝 31 mm 輪胎', () => {
    const bodies = listBodies();
    const homage = bodies.filter((b) => b.style === 'homage' && b.phase === 4);
    const race = bodies.filter((b) => b.style === 'race');
    console.log(`[P20] 車殼 ${bodies.length} 款：新致敬 ${homage.map((b) => b.id).join(', ') || '（無）'}；比賽型 ${race.map((b) => b.id).join(', ')}`);
    const retiredLeft = bodies.filter((b) => RETIRED.includes(b.id)).map((b) => b.id);
    expect(retiredLeft, '舊致敬款應已退役').toEqual([]);
    expect(homage.length).toBeGreaterThanOrEqual(6);
    expect(race.length).toBeGreaterThanOrEqual(3);

    let worstSide = 0;
    let worstTop = 0;
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const r = bodyIoU(bodies[i], bodies[j]);
        console.log(`[P20] IoU ${bodies[i].id} × ${bodies[j].id}：側視 ${r.side.toFixed(3)}、俯視 ${r.top.toFixed(3)}`);
        worstSide = Math.max(worstSide, r.side);
        worstTop = Math.max(worstTop, r.top);
        expect(r.side, `${bodies[i].id} × ${bodies[j].id} 側視輪廓太像`).toBeLessThan(IOU_MAX);
        expect(r.top, `${bodies[i].id} × ${bodies[j].id} 俯視輪廓太像`).toBeLessThan(IOU_MAX);
      }
    }
    console.log(`[P20] 最大 IoU：側視 ${worstSide.toFixed(3)}、俯視 ${worstTop.toFixed(3)}（門檻 ${IOU_MAX}）`);

    /** @type {Map<string, { height: number, length: number }>} */
    const dims = new Map();
    for (const b of homage) {
      const bb = bodyMassProps(b).bbox_mm;
      dims.set(b.id, { height: bb.max.y, length: bb.max.x - bb.min.x });
    }
    for (let i = 0; i < homage.length; i++) {
      for (let j = i + 1; j < homage.length; j++) {
        const a = homage[i];
        const b = homage[j];
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
        console.log(`[P20] 型式差異 ${a.id} × ${b.id}：${diffs.join('、') || '（無）'}`);
        expect(diffs.length, `${a.id} × ${b.id} 車高 / 長度 / 車頂 / 尾翼只有 ${diffs.length} 項不同`).toBeGreaterThanOrEqual(2);
      }
    }

    const bigWheelOk = homage.filter((b) => {
      const asm = assemble({ ...loadConfig('default'), body: b.id, wheels: 'wheel-31-large' });
      const v = validateAssembly(asm);
      console.log(`[P20] ${b.id} + wheel-31-large：${v.ok ? '合法' : `不合法（${v.violations.map((x) => x.code).join(', ')}）`}，車殼–輪胎間隙 ${asm.fit.tire_mm.toFixed(2)} mm`);
      return v.ok;
    });
    expect(bigWheelOk.length).toBeGreaterThanOrEqual(2);
  }, 300000);
});
