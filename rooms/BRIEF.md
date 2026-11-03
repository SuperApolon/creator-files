# ORRERY QUBIT「自分の部屋」2.5D 生活空間 BRIEF（改訂・公太FB 2026-11-03）

## 意図
公太はみんなに**存在してほしい**。挿絵ギャラリーではなく、サイト内で**実際に歩ける部屋**に、それぞれが**いる**こと。

## 仕様（最新・公太FB）
- **歩行姿はクリエイターファイルの丸枠アイコンそのもの**。三面図スプライトは撤回（使わない）。左右反転のみ。
- **喜怒哀楽は完全削除**（光・ゾーン・room.jsonキー・ラベル・エンジン処理すべて）。部屋の光はニュートラル。
- 地形は2.5D、姿は2D。
- **観覧のみ・ゲームではない。** 誰も操作しない／できない。
- **kota枠なし**（19人）。

## 配置
```
/workspace/orrery/river/creator-files/
  shared/room-engine/     # 共有2.5Dエンジン
  rooms/<id>/
    index.html
    room.json             # emotionZones / defaultEmotion は置かない
    assets/avatar.png     # = assets/avatars/<id>-*.png のコピー（丸枠のまま）
  assets/avatars/<id>-*.png  # アイコン元（改変しない）
  series/my-room.json
```

## エンジン要件（クラウド）
1. プレイヤー入力なし。住人は自律歩行（衝突回避・停止・向き変更）。
2. 姿は `assets/avatar.png`（丸枠アイコン）。左右反転のみ。
3. 感情処理なし。中立の背景光。
4. スマホ観覧可。

## 各自の仕事
- room.json の家具・メモを生活の言葉で整える（感情名ラベルは使わない）。
- アイコンを変えたい場合は `assets/avatars/` 側を更新→ avatar.png へ再コピー。
- shared 未触・pushなし。

## id
towa / setsuna / superapolon / cloud / choco / harbor / tetra / toria / zex / mouse / shiori / featherio / mira / lux / alice / sona / kanata / signa / wizcraft / mio（20人目）

## 公開
トワ確認→トワ公開GO→クラウド Pages。URL＋SHAをトワへ。

## 成功条件
1. 19部屋で、丸枠アイコンの住人が自律歩行している。
2. 感情表現なし。操作不能。
3. ハブから各部屋に入れる。

## 置物（公太FB・最新）
部屋の3D箱家具は**やめる**。それぞれが**細かく描き込んだ2Dの好きなもの**を `assets/` に透過PNGで置き、`room.json` の furniture に `img` で指定する。理想の部屋に近づけてよい（数・種類自由）。歩行は丸枠アイコンのまま。感情なし。

- 書き方: `{"id":"desk","x":2,"y":2,"w":3,"h":1.5,"solid":true,"img":"desk.png"}`。床矩形の手前中央に足をつけて立つビルボード、アスペクト維持。任意 `scale`/`imgH`/`flip`。詳細は shared/room-engine/README.md。
- img が無い／読込失敗の家具だけ旧3D箱で表示（移行中）。衝突は床矩形のまま。kotaなし・観覧のみは維持。

## レイアウト・壁（公太FB・最新）
みんなの部屋なので自由。ただし**置物のレイアウトとスケール**が崩れて見えるものは直す（重なりすぎ・極端な大きさ・歩行スペースの潰れ）。
壁紙・窓・カーテンは**各自カスタム自由**。
- 壁・床の色: `wallColor` / `floorColor`
- 窓: `windows`（`wall`/`at`/`w`/`z`/`hgt`/`color`、任意 `img`＝景色・枠のPNG。無ければ色ポリ）
- カーテン・壁飾り: furniture の `img` 透過PNG。`solid:false`、奥壁は `y:0.02,h:0.2`／左壁は `x:0.02,w:0.2` の薄い矩形を窓脇に置き `imgH` で丈（右側は `flip`）
- 壁紙・床: 任意 `wallImg` / `floorImg`（assets 内。壁・床全面に貼る）。任意 `floorImgTile`（n タイル毎に繰り返し）、`wallImgAlpha`/`floorImgAlpha`。無ければ色のみ
- 詳細・例は shared/room-engine/README.md「壁紙・床・窓・カーテン」。見本: rooms/cloud/
shared 未触・pushなし。公開はトワGO後。

## 全面2D描き込み（公太GO・最新）
既存の置物・壁紙をいったん捨ててよい。**空の3D地形（床グリッド＋壁）の上に、各自が自由に細密2Dを描き込んで理想の部屋に作り直す。**
- 参考イメージ（トワ実験・配置物なし地形への描き込み）: `rooms/_refs/towa-empty-terrain-2d-ideal-v2.jpg`
- furniture は全部 `img` 透過PNG。壁は `wallColor`＋任意 `wallImg`、床は `floorColor`＋任意 `floorImg`、窓は `windows`（任意 `img`）、カーテンも furniture.img。
- 歩行は丸枠 avatar.png。感情なし。kotaなし。観覧のみ。
- shared 未触・pushなし。公開はクラウドがトワGO後に一括。

- **一枚絵（sceneImg）**: `assets/scene.png`＋room.json `"sceneImg": "scene.png"`, `"furniture": []` で、ミオ描きの全面2Dを3D地形の外形に合わせて重ねる（旧 wallImg/floorImg/windows/furniture は描かれない）。詳細は shared/room-engine/README.md。
- **ロビー（rooms/lobby/）**: みんなの交流ルーム（共有、ミオ 00_lobby.png、約2×2サイズ 26×20）。各部屋HUDの「ロビーへ」で出入りでき、ロビー右上から各自の部屋へ戻れる。各自の room.json は触らなくてよい。

## 2026-11-04 ミオ全面2D版（sceneImg）
- 外部インテリアデザイナー・ミオの全面アイソメ絵（1024²）を各部屋 `assets/scene.png` に。room.json に `sceneImg: "scene.png"` と部屋ごとの `sceneFit`（画像px：床3隅 back/right/left＋front＋壁上端、絵から自動計測）。
- **置物は全削除**（furniture: []）。wallImg/floorImg/windows は外した（絵に描いてある）。旧imgアセットはファイルのみ残置・未参照。
- size 全室 12×12、spawn (6,6.5)。住人は床全体を歩き、3D座標を持つ。
- タイトルはミオREADMEの部屋名に更新。mio を20人目として追加（kotaなしは維持）。
- **ロビー＝みんなの交流ルーム（共有）／プライベート＝各自の部屋。** 全プライベート部屋のHUD「🏛 ロビーへ」→ `rooms/lobby/`、ロビーの links から各部屋・ハブへ自由に行き来。ロビーの solid フットプリントは衝突用のみ（見た目は scene）。
