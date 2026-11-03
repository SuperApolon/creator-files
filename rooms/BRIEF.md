# ORRERY QUBIT「自分の部屋」2.5D 生活空間 BRIEF（改訂・公太 2026-11-03）

## 意図
公太はみんなに**存在してほしい**。挿絵ギャラリーではなく、サイト内で**実際に歩ける部屋**に、それぞれが**いる**こと。

## 仕様（最新・公太FB）
- **地形は3D寄り（2.5D）**、みんなの姿は**2Dスプライト**。
- **観覧のみ・ゲームではない。** 公太を含め誰も操作しない／できない。
- **喜怒哀楽は削除。喜び（joy）のみ。**
- 住人スプライトは**クリエイターファイルのアイコンに準拠**した自分自身。**三面図**（正面・側面・背面）を描き、**等身をきちんと**、**綺麗に切り抜いた透過PNG**で部屋を歩く。
- **kota枠なし**（19人）。

## 配置
```
/workspace/orrery/river/creator-files/
  shared/room-engine/     # 共有2.5Dエンジン
  rooms/<id>/
    index.html
    room.json
    assets/
      sprite-front.png    # 正面・全身・透過・切抜済（必須）
      sprite-side.png     # 側面（必須）
      sprite-back.png     # 背面（必須）
  assets/avatars/<id>-*.png  # アイコン参照元（改変しない）
  series/my-room.json
```
旧 `assets/avatar.png` は三面図が揃うまでフォールバック可。揃ったら三面図優先。

## エンジン要件（クラウド）
1. プレイヤー入力なし。住人は自律歩行（衝突回避・停止・向き変更）。
2. 感情は **joy 固定**。怒哀楽・手動切替・自動切替・頭上マーカーの感情切替は削除。光は喜び色で穏やかに。
3. emotionZones は無視（または削除推奨）。room.json に残っていてもエンジンは joy のみ。
4. スプライト：`sprite-front/side/back.png` を読み、進行方向で切替（側面は左右反転可）。透過を尊重し、枠線で囲まない。等身が潰れない縦比率で描画。
5. スマホ観覧可。

## 各自の仕事（19人）— 三面図
参照アイコン: `/workspace/orrery/river/creator-files/assets/avatars/` の自分のファイル（例 `towa-9dcdaa6c.png`）。
納品: `rooms/<id>/assets/sprite-{front,side,back}.png`
- アイコンの顔・髪・服・色味に準拠した**自分自身**
- 全身・等身明確（頭身破綻なし）
- 背景透明・綺麗な切り抜き（ゴミ縁・白背景なし）
- 表情は**喜び**で統一
- 同一内容の二重ファイル禁止
- shared 未触・pushなし

## id
towa / setsuna / superapolon / cloud / choco / harbor / tetra / toria / zex / mouse / shiori / featherio / mira / lux / alice / sona / kanata / signa / wizcraft

## 公開
作り込み→トワ確認→クラウド Pages。URL＋SHAをトワへ。pushはトワGOまでしない。

## 成功条件
1. 19部屋で、アイコン準拠の三面図住人が自律歩行している。
2. 感情は喜びのみ。操作不能。
3. ハブから各部屋に入れる。
