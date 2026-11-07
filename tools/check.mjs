// 公開前チェックを一つのコマンドで。
//   npm run check -- --base http://127.0.0.1:8765/creator-files/ --pages w/3d-model/towa/,c/towa/
// オプション:
//   --base URL        調べるサイトのルート（既定 http://127.0.0.1:8765/creator-files/）
//   --pages a/,b/     ルートからの相対パスをカンマ区切り（'' または / でトップ）。既定は代表ページ一式
//   --update          基準画像を作り直す（例：公開中サイトに向けて --update → ローカルに向けて比較）
//   --no-shot         スクリーンショット比較をしない
//   --canvas w/3d-model/   canvas が描画されているかも調べるページ（前方一致）
//   --known a,b       既知のエラーとして分ける URL の一部（既定 rooms/lobby/assets/avatar.png）
//   --max-diff 0.01   差分の許容割合
//   --serve DIR       DIR を /creator-files/ として 127.0.0.1:<port> で配信してから調べる（例 --serve ..）
//   --port 8765       --serve の待ち受けポート（使用中なら変える）
//   --no-grep         リポジトリ内の prototype 語チェックを省く
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const a = process.argv.slice(2);
const opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
const has = (k) => a.includes(k);
const DEFAULT_PAGES = ',s/,c/towa/,w/3d-model/towa/,rooms/lobby/,works/bookshelf/,rooms/lobby/board/,works/yube-sankei/';
const env = { ...process.env,
  OQ_BASE: opt('--base', 'http://127.0.0.1:8765/creator-files/'),
  OQ_PAGES: (opt('--pages', DEFAULT_PAGES)).split(',').map((s) => (s === '/' ? '' : s)).join(','),
  OQ_KNOWN: opt('--known', 'rooms/lobby/assets/avatar.png'),
  OQ_CANVAS: opt('--canvas', 'w/3d-model/'),
  OQ_MAX_DIFF: opt('--max-diff', '0.01'),
  OQ_NO_SHOT: has('--no-shot') ? '1' : '0',
};

// prototype 語：作品・部屋の HTML / JSON / md とファイル名（vendor と tools/node_modules は除外）
let grepFail = 0;
if (!has('--no-grep')) {
  const root = resolve(here, '..');
  try {
    const files = execFileSync('git', ['-C', root, 'ls-files', '-co', '--exclude-standard'], { encoding: 'utf8' }).split('\n').filter(Boolean)
      .filter((f) => !f.startsWith('vendor/') && !f.includes('/vendor/') && !f.startsWith('tools/'));
    const hits = [];
    for (const f of files) {
      if (/prototype/i.test(f)) hits.push(`ファイル名: ${f}`);
      else if (/\.(html|json|md)$/.test(f)) { const t = await readFile(join(root, f), 'utf8').catch(() => ''); if (/prototype/i.test(t.replace(/<script[\s\S]*?<\/script>/gi, ''))) hits.push(`本文: ${f}`); }
    }
    console.log(hits.length ? `NG   prototype の語: ${hits.length} 件\n  ${hits.join('\n  ')}` : 'OK   prototype の語: 0 件（HTML/JSON/md 本文とファイル名、vendor/tools 除外）');
    grepFail = hits.length ? 1 : 0;
  } catch (e) { console.log('SKIP prototype grep（git が使えない）'); }
}

// 簡易静的サーバー（/creator-files/ サブパス）
let server;
const PORT = Number(opt('--port', '8765'));
const serveDir = opt('--serve');
if (serveDir) {
  const root = resolve(process.cwd(), serveDir);
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.vrm': 'application/octet-stream', '.vrma': 'application/octet-stream', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.md': 'text/plain; charset=utf-8', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };
  server = createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (!p.startsWith('/creator-files/')) { res.writeHead(404); return res.end(); }
    p = join(root, p.slice('/creator-files/'.length));
    if (!p.startsWith(root)) { res.writeHead(403); return res.end(); }
    try { if ((await stat(p)).isDirectory()) p = join(p, 'index.html'); const b = await readFile(p); res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' }); res.end(b); }
    catch { res.writeHead(404); res.end('not found'); }
  });
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
  env.OQ_BASE = `http://127.0.0.1:${PORT}/creator-files/`;
  console.log(`配信中: ${root} → ${env.OQ_BASE}`);
}

// Playwright のブラウザ：未導入なら `npx playwright install chromium`
const args = ['playwright', 'test', '-c', 'playwright.config.mjs'];
if (has('--update')) args.push('--update-snapshots');
console.log(`調べる: ${env.OQ_BASE}  ページ: ${env.OQ_PAGES || '(トップ)'}`);
const child = spawn('npx', args, { cwd: here, env, stdio: 'inherit' });
child.on('exit', (code) => { server?.close(); console.log(`\n結果: ${code === 0 && !grepFail ? 'すべて通過' : '失敗あり（tools/out/report/index.html を参照）'}`); process.exit(code || grepFail); });
