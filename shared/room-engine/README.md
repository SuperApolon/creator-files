# room-engine（2.5D 自分の部屋）

自分の部屋は `rooms/<id>/` 。触るのは基本 `room.json` と `assets/` だけ。

## 観覧のみ
これはゲームではない。キー・タッチ・ボタン入力は一切ない。住人は自律で動く：
- 歩行：床上のランダムな目標へゆっくり歩く（家具 solid と壁は滑り衝突で避け、詰まったら目標を選び直す）。着いたら数秒立ち止まり、時々向きを変える。
- 部屋の光はニュートラル（暗い青灰）。感情表現・頭上マーカー・枠線は一切なし。
- カメラは固定俯瞰（isometric）。

## room.json
```json
{
  "id": "cloud", "title": "座標の観測室", "authorName": "クラウド",
  "spawn": {"x": 4, "y": 5}, "size": {"w": 14, "h": 10},
  "floorColor": "#d4c4a8", "wallColor": "#8a9bb5", "accent": "#5b7cfa",
  "wallHeight": 3, "grid": true,
  "note": "短い生活メモ",
  "windows": [{"wall": "back", "at": 5, "w": 3, "z": 1, "hgt": 1.3}],
  "furniture": [{"id": "desk", "x": 2, "y": 2, "w": 3, "h": 1.5, "z": 1.2, "solid": true, "color": "#6b5344", "label": "机"}]
}
```
- 座標はタイル単位（左上奥が 0,0、x→右奥、y→左手前）。家具は x,y から w×h の床面、z は高さ。
- `solid: true` は通れない。外周は常に壁。
- `windows.wall` は `back`(y=0) か `left`(x=0)。`at` は壁沿いの位置。
- 感情関連キー（旧 `emotionZones` / `defaultEmotion`）は廃止。置かない。

## 住人の姿（丸枠アイコン）
`assets/avatar.png` ＝ ハブと同じ丸枠アイコン（`assets/avatars/<id>-*.png` のコピー）。
- 丸枠のまま・切り抜き不要。進行方向の左右で反転するだけ（正面/背面の切替なし）。
- アスペクト維持で高さ 約1.2タイル。無い場合のみ自動描画の中立人形。
- 三面図スプライト（sprite-*.png）は使わない。

## もっと改造したい
index.html で `new RoomEngine(...)` の戻り値を使える（観覧用の演出のみ。入力ハンドラは足さない）。独自JSは自分の rooms/<id>/ 内だけに置く。shared は全員共通なので変更はクラウドへ。

## 2D置物（furniture.img）
3D箱はやめ、透過PNGの2D置物へ移行する。
```json
{"id":"desk","x":2,"y":2,"w":3,"h":1.5,"solid":true,"img":"desk.png"}
```
- `img`: 部屋の `assets/` 内のファイル名（`assetBase + img` を読む）。透過尊重・枠線なし。
- ビルボード描画: 床矩形 (x,y,w,h) の手前中央（中心と手前角の中間）に足をつけ、上へ縦に立つ。幅＝床矩形のiso投影幅、高さはPNGのアスペクト比で決まる（潰れない）。
- 任意: `scale`（幅倍率, 既定1）、`imgH`（高さをタイル単位で指定。幅はアスペクトで追従）、`flip`（左右反転）。
- `img` が無い／読込失敗時のみ従来の3D箱（`color`,`z`,`label`）でフォールバック（移行中）。
- 衝突（`solid`）と奥行きソートは img の有無に関係なく床矩形 x,y,w,h のまま。

## 壁紙・床・窓・カーテン（任意・公太FB）
```json
{
  "wallColor": "#26304e", "floorColor": "#5c4634",
  "wallImg": "wall.png", "wallImgAlpha": 1,
  "floorImg": "floor.png", "floorImgAlpha": 1, "floorImgTile": 7,
  "windows": [{"wall":"back","at":5,"w":4,"z":0.9,"hgt":1.6,"color":"#e3f2ff","img":"window-back.png"}]
}
```
- `wallImg`（任意）: assets/ 内の画像。奥壁(back)・左壁(left)それぞれ全面に1枚を貼る（画像上端＝壁上端、下端＝床）。左壁は少し暗く重ねる。透過PNGなら下地の `wallColor` が透ける。横長（例 1400×300）推奨。
- `floorImg`（任意）: 床全面に1枚貼る。`floorImgTile: n` を付けると n×n タイルごとに繰り返し（端は縮めて収める）。floorImg がある時 `grid` 線は薄くなる。透過なら `floorColor` 市松が透ける。
- `wallImgAlpha` / `floorImgAlpha`（任意, 0–1, 既定1）: 貼り込みの不透明度。
- `windows[].img`（任意）: 窓の矩形（`at`/`w`/`z`/`hgt`）に画像を貼る。景色＋枠を描き込んだPNGを想定。無い／読込失敗時は従来の `color` 色ポリ。
- 画像が無い／読み込めない時はすべて従来の色だけで描画する（既存の room.json はそのまま動く）。
- **カーテン・壁飾りは furniture の `img`**: `"solid": false` で、奥壁なら `y: 0.02, h: 0.2`、左壁なら `x: 0.02, w: 0.2` の薄い床矩形を窓の両脇に置き、`imgH`（例 2.3＝ほぼ壁の高さ）で丈を決めると、壁に掛かったように見える（ビルボードは床矩形の足元から立つので、壁に寄せた薄い矩形にするのがコツ。右側は `flip: true`）。
