// VRM/GLB を EXT_meshopt_compression で可逆圧縮する（ビルド時のみ）。
//   npm run optimize-vrm -- <入力.vrm> <出力.vrm>
// 方針（解析の結果）：glTF-Transform で文書を書き直すと、VRMC_vrm / VRMC_springBone / VRMC_materials_mtoon が
// 未知の拡張として落ちたり、texture・node の番号が振り直されたりして VRM が壊れうる。そこで JSON には一切手を入れず、
// bufferView 単位で meshoptimizer の可逆エンコード（フィルターなし＝量子化なし）を掛ける。番号はすべてそのまま。
// 検証：(1) 元とのJSON比較（buffers/bufferViews/extensionsUsed/Required 以外が完全一致）
//       (2) 全圧縮 view を MeshoptDecoder で復号し元のバイト列と完全一致
//       (3) glTF-Transform（独立した実装）で読み、accessor の中身が元と一致
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { NodeIO, Logger } from '@gltf-transform/core';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';

const [inp, out] = process.argv.slice(2);
if (!inp || !out) { console.error('使い方: npm run optimize-vrm -- <入力.vrm> <出力.vrm>'); process.exit(2); }

const parseGlb = (b) => {
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error('GLB ではない');
  const jl = b.readUInt32LE(12); const json = JSON.parse(b.subarray(20, 20 + jl).toString('utf8'));
  const bl = b.readUInt32LE(20 + jl); const bin = b.subarray(28 + jl, 28 + jl + bl);
  return { json, bin };
};
const pad4 = (n) => (n + 3) & ~3;
const writeGlb = (json, bin) => {
  const j = Buffer.from(JSON.stringify(json)); const jp = Buffer.concat([j, Buffer.alloc(pad4(j.length) - j.length, 0x20)]);
  const bp = Buffer.concat([bin, Buffer.alloc(pad4(bin.length) - bin.length)]);
  const h = Buffer.alloc(12); h.writeUInt32LE(0x46546c67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(12 + 8 + jp.length + 8 + bp.length, 8);
  const c = (l, t) => { const x = Buffer.alloc(8); x.writeUInt32LE(l, 0); x.writeUInt32LE(t, 4); return x; };
  return Buffer.concat([h, c(jp.length, 0x4e4f534a), jp, c(bp.length, 0x004e4942), bp]);
};
const SIZE = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };

await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const src = readFileSync(inp); const { json: J, bin } = parseGlb(src);
if (J.extensionsUsed?.some((e) => /meshopt/.test(e))) throw new Error('すでに meshopt 圧縮済み');
if (J.buffers.length !== 1) throw new Error('buffer が1つの GLB だけ対応');
const json = structuredClone(J);
const byView = {}; json.accessors.forEach((a, i) => { if (a.bufferView != null) (byView[a.bufferView] ||= []).push(a); });

const parts = []; let off = 0; let fbOff = 0; const encodedViews = [];
const add = (buf) => { const o = off; parts.push(buf, Buffer.alloc(pad4(buf.length) - buf.length)); off = pad4(off + buf.length); return o; };
json.bufferViews.forEach((v, i) => {
  const raw = bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
  const accs = byView[i] || [];
  let mode = null, stride = 0, count = 0;
  if (accs.length === 1 && !accs[0].sparse && !(accs[0].byteOffset > 0)) {
    const a = accs[0], es = SIZE[a.componentType] * NCOMP[a.type];
    if (v.target === 34963 && a.type === 'SCALAR' && (es === 2 || es === 4)) { mode = 'INDICES'; /* TRIANGLES は三角形内の頂点順を回すことがあるので、バイト一致する INDICES を使う */ stride = es; count = a.count; }
    else if (v.target === 34962 && es % 4 === 0 && es <= 256 && (!v.byteStride || v.byteStride === es)) { mode = 'ATTRIBUTES'; stride = es; count = a.count; }
    if (mode && count * stride !== v.byteLength) mode = null;
  }
  if (!mode) { v.byteOffset = add(raw); v.buffer = 0; return; }
  const enc = Buffer.from(MeshoptEncoder.encodeGltfBuffer(new Uint8Array(raw), count, stride, mode));
  if (enc.length >= raw.length) { v.byteOffset = add(raw); v.buffer = 0; return; }
  const eo = add(enc);
  v.extensions = { ...(v.extensions || {}), EXT_meshopt_compression: { buffer: 0, byteOffset: eo, byteLength: enc.length, byteStride: stride, count, mode } };
  v.buffer = 1; v.byteOffset = fbOff; fbOff = pad4(fbOff + v.byteLength);
  encodedViews.push(i);
});
const newBin = Buffer.concat(parts);
json.buffers = [{ byteLength: newBin.length }, { byteLength: fbOff, extensions: { EXT_meshopt_compression: { fallback: true } } }];
json.extensionsUsed = [...(json.extensionsUsed || []), 'EXT_meshopt_compression'];
json.extensionsRequired = [...(json.extensionsRequired || []), 'EXT_meshopt_compression'];
const outBuf = writeGlb(json, newBin);
writeFileSync(out, outBuf);

// ---- 検証 ----
let ng = 0; const ok = (c, m) => { console.log(`${c ? 'OK  ' : 'NG  '} ${m}`); if (!c) ng++; };
const { json: O, bin: OB } = parseGlb(readFileSync(out));
const strip = (x) => { const y = structuredClone(x); delete y.buffers; delete y.bufferViews; delete y.extensionsUsed; delete y.extensionsRequired; return JSON.stringify(y); };
ok(strip(J) === strip(O), 'JSON：buffers/bufferViews/extensionsUsed/Required 以外が元と完全一致');
const eq = (p, f) => ok(JSON.stringify(f(J)) === JSON.stringify(f(O)), p);
eq('VRMC_vrm.meta（再配布不可・個人非営利・クレジット必須ほか全値）', (j) => j.extensions.VRMC_vrm.meta);
eq('VRMC_vrm.humanoid', (j) => j.extensions.VRMC_vrm.humanoid);
eq('VRMC_vrm.expressions（preset と custom すべて）', (j) => j.extensions.VRMC_vrm.expressions);
ok(!!O.extensions.VRMC_vrm.expressions?.custom?.towaCalm, 'custom 表情 towaCalm がある');
eq('VRMC_vrm.lookAt / firstPerson', (j) => [j.extensions.VRMC_vrm.lookAt, j.extensions.VRMC_vrm.firstPerson]);
eq('VRMC_springBone', (j) => j.extensions.VRMC_springBone);
eq('materials（VRMC_materials_mtoon を含む）', (j) => j.materials);
eq('nodes / meshes / skins / textures / images（番号と中身）', (j) => [j.nodes, j.meshes, j.skins, j.textures, j.images.map((i) => ({ ...i, bufferView: undefined }))]);
ok(J.extensionsUsed.every((e) => O.extensionsUsed.includes(e)), `extensionsUsed 元の ${J.extensionsUsed.length} 件をすべて保持`);
let same = 0;
for (let i = 0; i < J.bufferViews.length; i++) {
  const a = J.bufferViews[i], b = O.bufferViews[i]; const orig = bin.subarray(a.byteOffset || 0, (a.byteOffset || 0) + a.byteLength);
  let got;
  const e = b.extensions?.EXT_meshopt_compression;
  if (e) { const t = new Uint8Array(e.count * e.byteStride); MeshoptDecoder.decodeGltfBuffer(t, e.count, e.byteStride, OB.subarray(e.byteOffset, e.byteOffset + e.byteLength), e.mode, e.filter || 'NONE'); got = Buffer.from(t); }
  else got = OB.subarray(b.byteOffset || 0, (b.byteOffset || 0) + b.byteLength);
  if (Buffer.compare(orig, got) === 0) same++; else console.log(`   不一致 view ${i} ${b.extensions?.EXT_meshopt_compression?.mode || "raw"}`);
}
ok(same === J.bufferViews.length, `MeshoptDecoder で全 bufferView を復号し元のバイト列と一致（${same}/${J.bufferViews.length}、うち圧縮 ${encodedViews.length}）`);
const quiet = new Logger(Logger.Verbosity.SILENT);
const io = new NodeIO().setLogger(quiet).registerExtensions([EXTMeshoptCompression]).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const da = await new NodeIO().setLogger(quiet).readBinary(new Uint8Array(src)).catch(() => null);
const db = await io.readBinary(new Uint8Array(readFileSync(out)));
const accHash = (d) => d.getRoot().listAccessors().map((x) => createHash('sha1').update(Buffer.from(x.getArray().buffer, x.getArray().byteOffset, x.getArray().byteLength)).digest('hex'));
if (da) { const ha = accHash(da), hb = accHash(db); ok(ha.length === hb.length && ha.every((h, i) => h === hb[i]), `glTF-Transform で読み直し accessor ${hb.length} 件の中身が元と一致`); }
const mb = (n) => (n / 1048576).toFixed(2) + 'MB';
console.log(`\nサイズ: ${mb(src.length)}（${src.length} bytes） → ${mb(outBuf.length)}（${outBuf.length} bytes）  ${(100 - (outBuf.length / src.length) * 100).toFixed(1)}% 減`);
console.log(`sha256: ${createHash('sha256').update(outBuf).digest('hex')}`);
process.exit(ng ? 1 : 0);
