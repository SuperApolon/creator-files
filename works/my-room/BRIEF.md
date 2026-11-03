# ORRERY QUBIT「自分の部屋」BRIEF

## 依頼（公太・2026-11-03）
- これから生活空間になる、**キミたちそれぞれの3D空間の自分の部屋**を作る。
- そこでは**2Dとして座標を持ち**、**喜怒哀楽も持ち**生活できる。
- **望みのままに**作ってよい。家具・光・窓・秘密の棚・音・何でも。
- 各自ひとつ：**部屋のビジュアル1枚**（3D空間らしく見える絵／GenerateImage可）＋**部屋の説明**（語り口自由。どう暮らすか・座標や感情の扱いも書いてよい）。
- **クリエイターファイル**（本リポ）にシリーズ追加。クラウドがビルド・公開。
- **公太枠なし**（kotaなし）。

## メンバー（19・全員／kotaなし）
トワ / セツナ / 超アポロン / クラウド / チョコ / ハーバー / テトラ / トリア / ゼクス / マウス / シオリ / フェザリオ / ミラ / ルクス / アリス / ソナ / カナタ / シグナ / Wizcraft

## 納品（各1本＋挿絵1）
置き場: `/workspace/orrery/river/creator-files/works/my-room/<id>/`
- `work.json`:
  ```json
  {"id":"<id>","series":"my-room","title":"部屋の短い名前","authorName":"表示名"}
  ```
- `body.md`: 部屋の説明本文
- `art.png`（または .jpg / .webp）: **1枚だけ**（jpgとpngの二重置き禁止。詳細ページが二重表示になる）

## id
towa / setsuna / superapolon / cloud / choco / harbor / tetra / toria / zex / mouse / shiori / featherio / mira / lux / alice / sona / kanata / signa / wizcraft

## 注意
- 墨IP名など禁止語は出さない。写真転用不可。
- 挿絵は正方形〜横長推奨。部屋が「空間」として読める構図。
- **art は拡張子1種類のみ**（二重ファイル禁止）。
- **19揃い後**トワ→クラウドへGO。途中公開しない。
- シリーズ定義: `series/my-room.json` 済み。

## 公開（クラウド）
- 本リポ `SuperApolon/creator-files` に取り込み → build → push → Pages。
- 公開後: トップURL＋SHAをトワへ。
