// 最適化前後の VRM を同条件で描画し、画素が一致するか比べる。
//   node compare-vrm.mjs <元.vrm> <最適化後.vrm>   （ファイルは一時的に tools/examples/_tmp/ にコピーして配信）
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, mkdir, copyFile, rm } from 'node:fs/promises';
import { join, resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url)); const root = resolve(here, '..');
const [fa, fb] = process.argv.slice(2); if (!fa || !fb) { console.error('使い方: node compare-vrm.mjs <元.vrm> <最適化後.vrm>'); process.exit(2); }
const tmp = join(here, 'examples', '_tmp'); await mkdir(tmp, { recursive: true }); await copyFile(fa, join(tmp, 'a.vrm')); await copyFile(fb, join(tmp, 'b.vrm'));
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript' };
const srv = createServer(async (q, s) => { const p = join(root, decodeURIComponent(q.url.split('?')[0]).replace(/^\/creator-files\//, '')); if (!p.startsWith(root)) { s.writeHead(403); return s.end(); } try { s.writeHead(200, { 'content-type': T[extname(p)] || 'application/octet-stream' }); s.end(await readFile(p)); } catch { s.writeHead(404); s.end(); } });
await new Promise((r) => srv.listen(8767, '127.0.0.1', r));
const b = await chromium.launch(); const B = 'http://127.0.0.1:8767/creator-files/tools/examples/';
const states = [ { view: 'front', expr: { towaCalm: 1 } }, { view: 'face', expr: { towaCalm: 1 } }, { view: 'face', expr: { blink: 1 } }, { view: 'face', expr: { happy: 1, aa: 0.6 } }, { view: 'front', expr: { towaCalm: 1 }, springSteps: 150 }, { view: 'back', expr: {}, springSteps: 150 } ];
const run = async (f) => { const p = await b.newPage(); const errs = []; p.on('console', m => m.type()==='error'&&errs.push(m.text())); p.on('pageerror', e=>errs.push(e.message)); await p.goto(B + 'vrm-compare.html?vrm=_tmp/' + f); await p.waitForFunction(() => window.ready, null, { timeout: 90000 });
  const info = await p.evaluate(() => ({ e: window.info.expressions.length, towaCalm: window.info.expressions.includes('towaCalm'), sj: window.info.springJoints, meta: JSON.stringify(window.info.meta) }));
  const r = []; for (const s of states) r.push(await p.evaluate((s) => window.renderState(s), s)); await p.close(); return { info, r, errs }; };
const A = await run('a.vrm'), O = await run('b.vrm');
console.log('info orig', JSON.stringify(A.info).slice(0,200)); console.log('info opt ', JSON.stringify(O.info).slice(0,200)); console.log('meta同一', A.info.meta === O.info.meta, 'errs', A.errs, O.errs);
states.forEach((s, i) => { let d = 0; const a = A.r[i].px, o = O.r[i].px; for (let k = 0; k < a.length; k += 4) if (a[k]!==o[k]||a[k+1]!==o[k+1]||a[k+2]!==o[k+2]) d++; console.log(JSON.stringify(s), 'diffPixels', d, 'nonBg', A.r[i].nonBg, 'hashSame', A.r[i].hash === O.r[i].hash); });
// 表情が本当に効いているか（towaCalm と blink で画素が変わる）
let d = 0; const a = A.r[1].px, c = A.r[2].px; for (let k = 0; k < a.length; k += 4) if (a[k]!==c[k]) d++; console.log('towaCalm→blink で変わる画素', d);
let e = 0; const f = A.r[0].px, g = A.r[4].px; for (let k = 0; k < f.length; k += 4) if (f[k]!==g[k]) e++; console.log('揺れ物シミュレーションで変わる画素', e);
await b.close(); srv.close(); await rm(tmp, { recursive: true, force: true });
