import { expect, test } from 'vitest';
import { startRace } from '../web/garageRace.js';
import { readResults, recordResult, RESULTS_KEY } from '../web/garageResults.js';
import { assemble, loadConfig } from '../src/assembly.js';

test('P19_race_timing 三圈分段與總時間相符，完賽時停止在跨線物理步，不受畫面更新間隔影響', async () => {
  const asm = assemble(loadConfig('default'));
  const finish = async (frameDt) => {
    const race = await startRace(asm);
    try {
      let s = race.snapshot();
      for (let i = 0; i < 10000 && s.status === 'running'; i++) {
        race.advance(frameDt);
        s = race.snapshot();
      }
      expect(s.status).toBe('finished');
      expect(s.lapTimes).toHaveLength(3);
      expect(s.lapTimes.every((v) => v > 0)).toBe(true);
      expect(s.lapTimes.reduce((a, b) => a + b, 0)).toBeCloseTo(s.simTime, 10);
      const time = s.simTime;
      race.advance(0.05);
      expect(race.snapshot().simTime).toBe(time);
      return s;
    } finally {
      race.dispose();
    }
  };
  const fast = await finish(0.05);
  const slow = await finish(0.007);
  expect(fast.simTime).toBeCloseTo(slow.simTime, 10);
});

test('P19_local_results 只記錄三圈完賽、排序與保存；損壞或禁用儲存不使車庫失敗', () => {
  const values = new Map();
  const storage = { getItem: (k) => values.get(k), setItem: (k, v) => values.set(k, v) };
  const config = loadConfig('default');
  const result = { status: 'finished', laps: 3, simTime: 9, lapTimes: [3, 3, 3] };
  expect(recordResult(storage, { ...result, status: 'derailed' }, config, '翻車').rows).toHaveLength(0);
  for (let i = 0; i < 25; i++) recordResult(storage, { ...result, simTime: 9 + i }, config, `組裝 ${i}`);
  const rows = readResults(storage);
  expect(rows).toHaveLength(20);
  expect(rows[0].time).toBe(9);
  expect(rows[19].time).toBe(28);
  expect(rows[0].config).toEqual(config);
  values.set(RESULTS_KEY, '{bad json');
  expect(readResults(storage)).toEqual([]);
  values.set(RESULTS_KEY, JSON.stringify([null, { time: -1 }, { ...rows[0], time: '9' }]));
  expect(readResults(storage)).toEqual([]);
  const denied = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); } };
  const saved = recordResult(denied, result, config, '本次成績');
  expect(saved.saved).toBe(false);
  expect(saved.rows).toHaveLength(1);
});
