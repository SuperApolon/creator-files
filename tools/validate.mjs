// ORRERY QUBIT: JSON Schema 検証と「追記のみ」検査。
// 使い方: npm run validate [-- --base origin/main]   （--base none で追記検査を省略）
// Ajv は $data を使わない（過去の ReDoS 勧告対策）。allErrors で全部の誤りを出す。
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const args = process.argv.slice(2);
const baseIdx = args.indexOf('--base');
const base = baseIdx >= 0 ? args[baseIdx + 1] : 'origin/main';

const ajv = new Ajv({ allErrors: true, strict: true, strictRequired: false, $data: false });
const load = (p) => JSON.parse(readFileSync(p, 'utf8'));
const schema = (n) => ajv.compile(load(join(here, 'schemas', n)));
const vPosts = schema('posts.schema.json'), vBooks = schema('books.schema.json'), vWork = schema('work.schema.json');

let fail = 0;
const report = (ok, label, errs) => {
  if (ok) { console.log(`OK   ${label}`); return; }
  fail++; console.log(`NG   ${label}`);
  for (const e of errs || []) console.log(`     ${e.instancePath || '/'} ${e.message}${e.params ? ' ' + JSON.stringify(e.params) : ''}`);
};
const check = (v, rel) => {
  let data;
  try { data = load(join(root, rel)); } catch (e) { report(false, rel, [{ message: 'JSONとして読めない: ' + e.message }]); return null; }
  report(v(data), rel, v.errors); return data;
};

const POSTS = 'rooms/lobby/board/posts.json', BOOKS = 'works/bookshelf/books.json';
const posts = check(vPosts, POSTS);
const books = check(vBooks, BOOKS);

// work.json 全部
const walk = (d) => readdirSync(d).flatMap((n) => {
  const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : n === 'work.json' ? [p] : [];
});
const works = walk(join(root, 'works'));
let wOk = 0;
for (const p of works) { const rel = relative(root, p); const d = (() => { try { return load(p); } catch (e) { return e; } })();
  if (d instanceof Error) { report(false, rel, [{ message: d.message }]); continue; }
  if (vWork(d)) wOk++; else report(false, rel, vWork.errors); }
console.log(`${wOk === works.length ? 'OK  ' : 'NG  '} work.json ${wOk}/${works.length}`);

// 重複 id
const dup = (arr, label) => { const s = new Set(); for (const x of arr) { if (s.has(x.id)) report(false, `${label} の id 重複: ${x.id}`); s.add(x.id); } };
if (Array.isArray(posts)) dup(posts, POSTS);
if (books && Array.isArray(books.books)) dup(books.books, BOOKS);

// 追記のみ：基準の配列が、いまの配列の先頭にそのまま残っているか
if (base && base !== 'none') {
  const atBase = (rel) => { try { return JSON.parse(execFileSync('git', ['-C', root, 'show', `${base}:${rel}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })); } catch { return undefined; } };
  const prefix = (old, cur, label) => {
    if (old === undefined) { console.log(`SKIP 追記のみ ${label}（${base} に無い/読めない）`); return; }
    if (!Array.isArray(cur)) return;
    const bad = old.findIndex((x, i) => JSON.stringify(x) !== JSON.stringify(cur[i]));
    if (cur.length < old.length || bad >= 0) report(false, `追記のみ ${label}（基準 ${base}）`, [{ message: bad >= 0 ? `${bad} 番目（${old[bad]?.id}）が変更・削除されている` : '件数が減っている' }]);
    else console.log(`OK   追記のみ ${label}（基準 ${base}: ${old.length}件 → 現在 ${cur.length}件、+${cur.length - old.length}）`);
  };
  prefix(atBase(POSTS), posts, POSTS);
  const ob = atBase(BOOKS); prefix(ob && ob.books, books && books.books, BOOKS + ' .books');
  if (ob && books && ob.note !== books.note) report(false, `${BOOKS} .note が基準から変わっている`);
}

console.log(fail ? `\n検証失敗: ${fail} 件` : '\nすべて通過');
process.exit(fail ? 1 : 0);
