// Runs the test chain of package.json ("test") one file at a time. Windows cuts commands longer than about
// 8 000 characters, and the chain is longer; this runs the same files, in the same order, on any system.
// Usage: npm run test:each        (or: node scripts/run-tests.mjs [--from <file>] to resume after a failure)
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const chain = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).scripts.test;
const steps = chain.split('&&').map((s) => s.trim()).filter(Boolean);
const files = steps.map((step) => {
    const m = /^node\s+--import\s+tsx\s+(\S+)$/.exec(step);
    if (!m) throw new Error(`Unexpected step in the test script: ${step}`);
    return m[1];
});
const fromIndex = process.argv.indexOf('--from');
const start = fromIndex > 0 ? files.indexOf(process.argv[fromIndex + 1]) : 0;
if (start < 0) throw new Error(`Not in the test list: ${process.argv[fromIndex + 1]}`);

const began = Date.now();
for (let i = start; i < files.length; i += 1) {
    const file = files[i];
    const run = spawnSync(process.execPath, ['--import', 'tsx', file], { stdio: 'inherit' });
    if (run.status !== 0) {
        console.error(`\n✖ ${file} failed (${i + 1}/${files.length}). Resume with: node scripts/run-tests.mjs --from ${file}`);
        process.exit(run.status || 1);
    }
}
console.log(`\n✔ ${files.length - start} test files passed in ${Math.round((Date.now() - began) / 1000)} s.`);
