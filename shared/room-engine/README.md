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
