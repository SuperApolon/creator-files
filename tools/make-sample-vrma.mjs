// 自作のサンプル VRMA（VRMC_vrm_animation 1.0）を書き出す。外部素材を使わないのでライセンスの心配がない。
// 4秒ループ：首をゆっくり傾け、右腕を少し上げ下げする。 使い方: node make-sample-vrma.mjs [出力先]
import { writeFileSync } from 'node:fs';
const out = process.argv[2] || new URL('./examples/towa-sway.vrma', import.meta.url).pathname;

// ノード（レスト姿勢は回転なし、位置だけ）
const bones = [
  ['hips', null, [0, 1.0, 0]], ['spine', 'hips', [0, 0.1, 0]], ['chest', 'spine', [0, 0.12, 0]],
  ['neck', 'chest', [0, 0.2, 0]], ['head', 'neck', [0, 0.08, 0]],
  ['rightUpperArm', 'chest', [-0.18, 0.15, 0]], ['rightLowerArm', 'rightUpperArm', [-0.25, 0, 0]],
  ['leftUpperArm', 'chest', [0.18, 0.15, 0]], ['leftLowerArm', 'leftUpperArm', [0.25, 0, 0]],
];
const idx = Object.fromEntries(bones.map((b, i) => [b[0], i]));
const nodes = bones.map(([name, , t]) => ({ name, translation: t }));
bones.forEach(([n, p]) => { if (p) (nodes[idx[p]].children ||= []).push(idx[n]); });

const q = (ax, deg) => { const r = (deg * Math.PI) / 360, s = Math.sin(r); return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(r)]; };
const times = [0, 1, 2, 3, 4];
const tracks = {
  head: times.map((t) => q([0, 0, 1], [0, 6, 0, -6, 0][t])),
  neck: times.map((t) => q([1, 0, 0], [0, 4, 0, 4, 0][t])),
  rightUpperArm: times.map((t) => q([0, 0, 1], [65, 55, 65, 55, 65][t])),
  leftUpperArm: times.map((t) => q([0, 0, 1], [-65, -55, -65, -55, -65][t])),
};

const chunks = []; let off = 0; const views = [], accessors = [];
const push = (f32, type, extra = {}) => {
  const buf = Buffer.from(f32.buffer); views.push({ buffer: 0, byteOffset: off, byteLength: buf.length });
  chunks.push(buf); off += buf.length;
  accessors.push({ bufferView: views.length - 1, componentType: 5126, count: f32.length / (type === 'SCALAR' ? 1 : 4), type, ...extra });
  return accessors.length - 1;
};
const tIn = push(new Float32Array(times), 'SCALAR', { min: [0], max: [4] });
const samplers = [], channels = [];
for (const [bone, qs] of Object.entries(tracks)) {
  const o = push(new Float32Array(qs.flat()), 'VEC4');
  samplers.push({ input: tIn, output: o, interpolation: 'LINEAR' });
  channels.push({ sampler: samplers.length - 1, target: { node: idx[bone], path: 'rotation' } });
}
const bin = Buffer.concat(chunks);
const json = {
  asset: { version: '2.0', generator: 'ORRERY QUBIT make-sample-vrma.mjs' },
  extensionsUsed: ['VRMC_vrm_animation'],
  extensions: { VRMC_vrm_animation: { specVersion: '1.0', humanoid: { humanBones: Object.fromEntries(bones.map(([n]) => [n, { node: idx[n] }])) } } },
  scene: 0, scenes: [{ nodes: [0] }], nodes,
  buffers: [{ byteLength: bin.length }], bufferViews: views, accessors,
  animations: [{ name: 'towa-sway', samplers, channels }],
};
const pad = (b, c) => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4, c)]);
const j = pad(Buffer.from(JSON.stringify(json)), 0x20), b = pad(bin, 0);
const h = Buffer.alloc(12); h.writeUInt32LE(0x46546c67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(12 + 8 + j.length + 8 + b.length, 8);
const ch = (len, type) => { const x = Buffer.alloc(8); x.writeUInt32LE(len, 0); x.writeUInt32LE(type, 4); return x; };
writeFileSync(out, Buffer.concat([h, ch(j.length, 0x4e4f534a), j, ch(b.length, 0x004e4942), b]));
console.log(`書き出し: ${out}（${12 + 16 + j.length + b.length} bytes）`);
