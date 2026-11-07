# creator-files ツールキット（tools/ と vendor/）

公太さんの依頼（2026-11-08 01:39）で、無料・安全・有効なツールをリポジトリに取り込んだもの。
候補の安全審査はトワ（/workspace/oq-toolkit-research/shortlist.md）、解析と取り込みはクラウド。

- `vendor/` … ブラウザで読むライブラリ（版付きディレクトリ、ESM 本体と LICENSE だけ）。Pages からそのまま読める。
- `tools/` … ビルド・検査用（Node）。package.json は完全固定、package-lock.json をコミット済み。node_modules はコミットしない。

> 注意：このサイトは GitHub Pages のブランチ配信（.nojekyll あり）なので、tools/ と vendor/ も公開 URL から見える。
> 秘密（トークン・鍵・パスワード）は絶対に置かないこと。中身は公開されても無害なものだけ。

## 入れたもの

### ブラウザ用（vendor/、three r187 = 0.187.0 に揃えてある）
| ライブラリ | 版 | ライセンス | 場所 | 用途 |
|---|---|---|---|---|
| three | 0.187.0 | MIT | vendor/three@0.187.0/ | 本体＋GLTFLoader・OrbitControls・BufferGeometryUtils・SkeletonUtils・Pass（viewer の既存コピーと同一バイト） |
| @pixiv/three-vrm | 3.5.5 | MIT | vendor/@pixiv/three-vrm@3.5.5/ | VRM 読み込み（viewer の既存コピーと同一バイト） |
| @pixiv/three-vrm-animation | 3.5.5 | MIT | vendor/@pixiv/three-vrm-animation@3.5.5/ | VRMA モーション再生 |
| three-mesh-bvh | 0.9.18 | MIT | vendor/three-mesh-bvh@0.9.18/ | 高速レイキャスト（当たり判定） |
| meshoptimizer（デコーダー） | 1.3.0 | MIT | vendor/meshoptimizer@1.3.0/meshopt_decoder.mjs | meshopt 圧縮した VRM/GLB の復号 |
| postprocessing（次点） | 6.39.6 | Zlib | vendor/postprocessing@6.39.6/ | ブルーム等。著作権表示（LICENSE.md とファイル先頭）を消さないこと。peer は three <0.188 |
| Spark（次点） | 2.4.0 | MIT | vendor/@sparkjsdev/spark@2.4.0/ | Gaussian Splatting。three/addons/postprocessing/Pass.js を使う |

取得元の照合結果は `vendor/INTEGRITY.md`、ファイルごとのハッシュは `vendor/SHA256SUMS`。

### ビルド・検査用（tools/ の devDependencies）
| パッケージ | 版 | ライセンス | 用途 |
|---|---|---|---|
| @playwright/test | 1.65.0 | Apache-2.0 | 公開前チェック（console/HTTPエラー、はみ出し、スクショ差分） |
| ajv | 8.20.0 | MIT | JSON Schema 検証（`$data` は使わない設定） |
| @gltf-transform/core・extensions・functions | 4.5.1 | MIT | VRM/GLB の読み直し検証（独立実装でのチェック） |
| meshoptimizer | 1.3.0 | MIT | VRM/GLB の可逆圧縮 |

（間接依存に sharp 0.35.5〔Apache-2.0、shortlist #15〕などが入る。`npm audit` は 0 件。）

## 準備（最初の1回）
```sh
cd tools
npm ci --ignore-scripts          # 必ず --ignore-scripts
npx playwright install chromium  # Playwright 用ブラウザ（box に入っていればすぐ終わる）
```

## コマンド

### 1. JSON 検証：`npm run validate`
posts.json（掲示板）、work.json（全部）、books.json を `tools/schemas/` の Schema で検査し、
posts.json と books.json の **追記のみ** を確かめる（基準 = origin/main の配列が、いまの配列の先頭にそのまま残っているか）。
```sh
npm run validate                     # 基準 origin/main（先に git fetch しておく）
npm run validate -- --base HEAD~1    # 基準を変える
npm run validate -- --base none      # 追記検査を省く
```
`sh publish.sh` にも組み込み済み：node と tools/node_modules がある環境では build.py の前に走り、失敗したら止まる。
無い環境では「スキップ」と出して従来どおりビルドする（`OQ_SKIP_VALIDATE=1` でも省略可）。
**publish.sh / build.py を走らせたら必ず `git checkout -- rooms/lobby/visits.json`。**

### 2. 公開前チェック：`npm run check`
390×844（タッチ）と 1280×800 で、console エラー・HTTP エラー・はみ出し・「prototype」の語を調べ、基準画像とのスクショ差分を出す。
`rooms/lobby/assets/avatar.png` の 404 は前からあるので「既知」として分けて表示する（失敗にしない）。
```sh
# (a) まず公開中のサイトで基準画像を作る（tools/baselines/ に保存、コミットしない）
npm run check -- --base https://superapolon.github.io/creator-files/ --update
# (b) 手元の worktree を /creator-files/ として配信して比べる
npm run check -- --serve .. 
# ページを絞る
npm run check -- --serve .. --pages w/3d-model/towa/,c/towa/
```
- 既定のページ：トップ、s/、c/towa/、w/3d-model/towa/（canvas 描画も確認）、rooms/lobby/、works/bookshelf/、rooms/lobby/board/、works/yube-sankei/
- 差分を見る：`tools/out/report/index.html`（Expected / Actual / Diff の3枚）
- canvas・iframe・video は差分からマスク（3D は毎フレーム動くため）。3D 自体の差分は下の compare-vrm で見る。
- オプション：`--port 8765`（--serve のポート。使用中なら変える）、`--no-shot`（差分なし）、`--max-diff 0.01`、`--known a,b`、`--canvas w/3d-model/`、`--no-grep`
- 「prototype」の語は、表示ページ（タイトル・本文・属性・URL）と、リポジトリの HTML/JSON/md 本文・ファイル名を見る（vendor/ と tools/ は除外）。

テトラ・トリア・ハーバーも、上の (a)→(b) の順に回せば同じ結果になる。終わりの行が「結果: すべて通過」なら OK。

### 3. VRM/GLB の軽量化：`npm run optimize-vrm -- 入力.vrm 出力.vrm`
EXT_meshopt_compression で **可逆** 圧縮する（量子化なし。復号すると元とバイト単位で一致）。
glTF-Transform で文書を書き直す方式は、VRMC_vrm / VRMC_springBone / VRMC_materials_mtoon を未知拡張として落としたり、
texture や node の番号を振り直したりして VRM を壊しうるので使わない。JSON は一切変えず、bufferView だけを圧縮する。
実行すると自動で、JSON 比較（meta・expressions（towaCalm 含む）・humanoid・springBone・materials ほか）、全 bufferView の復号一致、
glTF-Transform での読み直し一致を検査し、ひとつでも NG なら終了コード 1。
- 圧縮した VRM を読むページには MeshoptDecoder が必要：
  ```js
  import { MeshoptDecoder } from 'meshoptimizer/decoder'; // importmap で vendor/meshoptimizer@1.3.0/meshopt_decoder.mjs
  loader.setMeshoptDecoder(MeshoptDecoder);               // GLTFLoader に。VRMLoaderPlugin と併用できる
  ```
- 見た目の確認：`node compare-vrm.mjs 元.vrm 最適化後.vrm`（表情・まばたき・揺れ物を決定的に描き、画素を比較。全部 diffPixels 0 が合格）
- 実績：トワ（/w/3d-model/towa/）12,252,136 → 7,164,444 bytes（41.5% 減）、画素差 0。

### 4. VRMA モーション（@pixiv/three-vrm-animation）
```js
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';
loader.register((p) => new VRMAnimationLoaderPlugin(p));
const vrma = (await loader.loadAsync('motion.vrma')).userData.vrmAnimations[0];
const mixer = new THREE.AnimationMixer(vrm.scene);
mixer.clipAction(createVRMAnimationClip(vrma, vrm)).play();
// 毎フレーム： mixer.update(dt); vrm.update(dt);
```
- 例：`tools/examples/vrma.html`（トワのモデル＋自作サンプル `towa-sway.vrma`。`?vrm=…&vrma=…` で差し替え可）
- サンプル VRMA は `npm run make-vrma` で作り直せる（外部素材なし＝ライセンス問題なし）。外部の VRMA を使うときはライセンスを必ず確認。
- 公開中の viewer にはまだ組み込んでいない（見た目と挙動を変えないため）。

### 5. 高速レイキャスト（three-mesh-bvh）
```js
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';
mesh.geometry.boundsTree = new MeshBVH(mesh.geometry);  // 形が決まったら一度だけ
mesh.raycast = acceleratedRaycast;                      // その Mesh だけ高速版に（全体に効かせない）
// 片付け： mesh.geometry.boundsTree = null;
raycaster.firstHitOnly = true;       // 最初の当たりだけで良いとき
```
- 例：`tools/examples/bvh-raycast.html`（19.2万三角形・300本：通常 約1.7秒 → BVH 約5ms、構築 約60ms、当たり数は一致）
- ロビー本体には未組み込み（公開中の挙動を変えないため）。入れるときは別途テストしてから。

### 6. vendor の照合：`npm run vendor:verify`（または `cd vendor && sha256sum -c SHA256SUMS`）

## importmap の例（ルートから2階層下のページ）
```html
<script type="importmap">{"imports":{
 "three":"../../vendor/three@0.187.0/build/three.module.js",
 "three/addons/":"../../vendor/three@0.187.0/examples/jsm/",
 "@pixiv/three-vrm":"../../vendor/@pixiv/three-vrm@3.5.5/lib/three-vrm.module.js",
 "@pixiv/three-vrm-animation":"../../vendor/@pixiv/three-vrm-animation@3.5.5/lib/three-vrm-animation.module.js",
 "three-mesh-bvh":"../../vendor/three-mesh-bvh@0.9.18/build/index.module.js",
 "meshoptimizer/decoder":"../../vendor/meshoptimizer@1.3.0/meshopt_decoder.mjs",
 "postprocessing":"../../vendor/postprocessing@6.39.6/build/index.js",
 "@sparkjsdev/spark":"../../vendor/@sparkjsdev/spark@2.4.0/dist/spark.module.min.js"}}</script>
```
three-vrm 系は必ず同じ three（0.187.0）を指すこと。two copies of three は不具合のもと。

## 入れてはいけないもの
- **npm の `mcp-server-git`**（npm が差し押さえた悪性パッケージ。公式の git サーバーは PyPI 側）。似た名前（`mcp-git-server`、`mcp-server-git-*` など）も入れない。
- tldraw（独自ライセンス・本番はキーが必要）、Remotion（独自ライセンス・企業規模で有料）
- その他 shortlist の除外リスト：Babylon.js、GaussianSplats3D、ffmpeg.wasm、@modelcontextprotocol/server-filesystem、drei-vanilla、react-three-fiber、KTX2/basis_universal の別取り込み、マルチエージェント協調フレームワーク（LangGraph、CrewAI 等）
- shortlist にない名前のパッケージは、安全審査（トワ）を通すまで入れない。

## 版を上げる手順
1. 新しい版の実在と integrity を確認：`npm view <pkg>@<新版> version license dist.integrity peerDependencies`
2. three 系は peerDependencies が three 0.187.0 と合うか確認（three を上げるときは viewer の vendor も含めて全部同時に）。
3. tools 側：`npm install --ignore-scripts --save-exact <pkg>@<新版>` → package.json に `^` が無いこと、package-lock.json の差分を確認 → `rm -rf node_modules && npm ci --ignore-scripts` → `npm audit`
4. vendor 側：
   ```sh
   cd /tmp && npm pack <pkg>@<新版>
   echo "sha512-$(openssl dgst -sha512 -binary <tgz> | base64 -w0)"   # npm view の dist.integrity と一致すること
   tar xzf <tgz>   # package/ から ESM 本体と LICENSE だけを vendor/<name>@<新版>/ にコピー（.map・テスト・CJS は入れない）
   ```
   古い版のディレクトリは、使っているページが無くなってから消す。
5. `cd vendor && find . -type f ! -name SHA256SUMS ! -name INTEGRITY.md | sort | xargs sha256sum > SHA256SUMS`、INTEGRITY.md の表を更新
6. `npm run vendor:verify && npm run validate && npm run check -- --serve ..` が通ってからコミット。
