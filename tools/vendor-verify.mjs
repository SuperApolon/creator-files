// vendor/SHA256SUMS と実ファイルを照合する（sha256sum -c と同じ。node だけで動く）。 npm run vendor:verify
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'vendor');
let ng = 0, n = 0;
for (const line of readFileSync(join(dir, 'SHA256SUMS'), 'utf8').split('\n').filter(Boolean)) {
  const [h, f] = line.split(/\s+\*?/, 2); n++;
  let got; try { got = createHash('sha256').update(readFileSync(join(dir, f))).digest('hex'); } catch { got = '(無い)'; }
  if (got !== h) { ng++; console.log(`NG   ${f}`); }
}
console.log(ng ? `vendor: ${ng}/${n} 件が不一致` : `OK   vendor: ${n} ファイルすべて SHA256SUMS と一致`);
process.exit(ng ? 1 : 0);
