// 跑 vitest，依 SPEC 第 2 部分的 P01–P20 統計通過數（共 20 項；一個 ID 底下的所有測試都通過才算通過）
// 用法：node scripts/score.mjs [外觀平均分]
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Hold one lock over report deletion, testing AND reading the score. Two
// callers must not delete/replace one another's report after vitest releases it.
if (process.argv[2] !== '--under-heavy-lock') {
  const result = spawnSync('python3', [path.join(root, 'scripts/heavy.py'), '--label', 'mini4wd-score', '--', process.execPath, fileURLToPath(import.meta.url), '--under-heavy-lock', ...process.argv.slice(2)], { stdio: 'inherit' });
  process.exit(result.status ?? 1);
}
const out = path.join(root, 'tmp', 'vitest.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.rmSync(out, { force: true });
try {
  execFileSync(process.execPath, [path.join(root, 'node_modules/vitest/vitest.mjs'), 'run', '--reporter=json', `--outputFile=${out}`], { cwd: root, stdio: 'ignore' });
} catch {
  // 有測試失敗時 vitest 回傳非 0，結果仍寫在 JSON
}
if (!fs.existsSync(out)) throw new Error('Vitest 未產生本次報告，不能沿用舊分數');
const report = JSON.parse(fs.readFileSync(out, 'utf-8'));

/** @type {Map<string, boolean>} */
const status = new Map();
const TOTAL = 20;
for (let i = 1; i <= TOTAL; i++) {
  status.set(`P${String(i).padStart(2, '0')}`, false);
}
/** @type {Map<string, boolean[]>} */
const seen = new Map();
for (const file of report.testResults) {
  for (const t of file.assertionResults) {
    const m = /^(P\d\d)_/.exec(t.title);
    if (!m) {
      continue;
    }
    const arr = seen.get(m[1]) ?? [];
    arr.push(t.status === 'passed');
    seen.set(m[1], arr);
  }
}
for (const [id, arr] of seen) {
  status.set(id, arr.length > 0 && arr.every(Boolean));
}
const passed = [...status.values()].filter(Boolean).length;
const line = [...status.entries()].map(([id, ok]) => `${id}:${ok ? 'pass' : 'FAIL'}`).join(' ');
console.log(line);
console.log(`通過 ${passed}/${TOTAL} → 測試分 ${((passed / TOTAL) * 50).toFixed(2)}`);
const appearance = Number(process.argv[3]);
if (Number.isFinite(appearance)) {
  console.log(`外觀 ${appearance} → 總分 ${((passed / TOTAL) * 50 + appearance * 5).toFixed(2)}`);
}

if (passed !== TOTAL || !report.success) process.exitCode = 1;
