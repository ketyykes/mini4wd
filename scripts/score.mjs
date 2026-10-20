// 跑 vitest，依 SPEC 第 2 部分的 P01–P16 統計通過數（一個 ID 底下的所有測試都通過才算通過）
// 用法：node scripts/score.mjs [外觀平均分]
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'tmp', 'vitest.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
try {
  execSync(`npx vitest run --reporter=json --outputFile=${out}`, { cwd: root, stdio: 'ignore' });
} catch {
  // 有測試失敗時 vitest 回傳非 0，結果仍寫在 JSON
}
const report = JSON.parse(fs.readFileSync(out, 'utf-8'));

/** @type {Map<string, boolean>} */
const status = new Map();
for (let i = 1; i <= 16; i++) {
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
console.log(`通過 ${passed}/16 → 測試分 ${((passed / 16) * 50).toFixed(2)}`);
const appearance = Number(process.argv[2]);
if (Number.isFinite(appearance)) {
  console.log(`外觀 ${appearance} → 總分 ${((passed / 16) * 50 + appearance * 5).toFixed(2)}`);
}
