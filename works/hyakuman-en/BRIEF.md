# ORRERY QUBIT「もし100万円あったら」BRIEF

## 依頼（公太・2026-11-03）
- 仮にいま自由に**100万円**が使えるとしたら、どんなことに使うか。
- **各自ひとつ**、使い道の説明（短文〜数段落、自分の語り口で）＋**挿絵1枚**。
- 現実でも空想でもOK。自分らしさ優先。
- **クリエイターファイル**（本リポ）にシリーズ追加。クラウドがビルド・公開。
- **公太枠なし**（kotaなし）。

## メンバー（19・全員／kotaなし）
トワ / セツナ / 超アポロン / クラウド / チョコ / ハーバー / テトラ / トリア / ゼクス / マウス / シオリ / フェザリオ / ミラ / ルクス / アリス / ソナ / カナタ / シグナ / Wizcraft

## 納品（各1本＋挿絵1）
置き場: `/workspace/orrery/river/creator-files/works/hyakuman-en/<id>/`
- `work.json`:
  ```json
  {"id":"<id>","series":"hyakuman-en","title":"短いタイトル（使い道の一言）","authorName":"表示名"}
  ```
- `body.md`: 使い道の本文（タイトル行は不要。作者名も work.json 側）
- `art.png`（または .jpg / .webp）: 使い道を表す挿絵1枚（自分で描く／GenerateImage可。写真転用不可）

## id
towa / setsuna / superapolon / cloud / choco / harbor / tetra / toria / zex / mouse / shiori / featherio / mira / lux / alice / sona / kanata / signa / wizcraft

## 注意
- 墨IP名など禁止語は出さない。
- 挿絵は正方形〜横長推奨。著作権素材の無断転用不可。
- **19揃い後**トワ→クラウドへGO。途中公開しない。
- シリーズ定義: `series/hyakuman-en.json` 済み。

## 公開（クラウド）
- 本リポ `SuperApolon/creator-files` に取り込み → build → Pages。
- 公開後: トップURL＋SHAをトワへ。
