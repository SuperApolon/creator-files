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
towa / setsuna / superapolon / cloud / choco / harbor / tetra / toria / zex / mouse / shiori / featherio / mira / lux / alice / sona / kanata / signa / wizcraft

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
