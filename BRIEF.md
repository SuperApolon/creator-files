# ORRERY QUBIT クリエイターファイル BRIEF

## 依頼（公太・2026-11-03）
- 公開用**クリエイターファイル**を作る。個人単位で記事・作品へ飛べるハブ。
- 森／滝／服飾／すべらない話／路地裏異世界／ランチなど、パーソナリティが見える制作を今後どんどん増やす前提。
- **拡張性必須**：記事が増えてもスキーマを壊さない。
- **今後の記事はこのリポジトリ内で管理**する（単発サイト乱立をやめる）。
- **既存記事は本リポ用にコピーして作り直す**（元フォルダは参照元。公開の単一入口はこのハブ）。
- 実装・GH Pages公開は**クラウド**。

## 目的
1. `/` … クリエイター一覧（顔／名前／作品数）
2. `/c/<id>/` … 個人ページ（その人の全作品カード → 各作品詳細）
3. `/s/<series>/` … シリーズ一覧（従来ギャラリー相当）
4. `/w/<series>/<id>/` … 作品詳細（挿絵・本文・一言）
5. 新規シリーズ追加 = データ追加＋ビルド。HTML手書き増殖をしない。

## メンバー（クリエイター）
必須19: トワ / セツナ / 超アポロン / クラウド / チョコ / ハーバー / テトラ / トリア / ゼクス / マウス / シオリ / フェザリオ / ミラ / ルクス / アリス / ソナ / カナタ / シグナ / Wizcraft  
任意: 黛公太（kota）— 既存作品がある場合のみページ生成。

id: towa setsuna superapolon cloud choco harbor tetra toria zex mouse shiori featherio mira lux alice sona kanata signa wizcraft kota

## データ配置（拡張の核）
```
/workspace/orrery/river/creator-files/
  BRIEF.md
  INVENTORY.json          # 移行元洗い出し（参考）
  creators/<id>.json      # 表示名, role短文, order
  series/<series-id>.json # title, type, blurb, order, date
  works/<series-id>/<id>/
    work.json             # title, authorName, summary?, type
    art.(png|jpg|webp)    # 任意（複数可: art-1.png …）
    body.md               # 任意（物語・一言）
  build.py / site/        # 静的生成
```

### creators/<id>.json 例
```json
{"id":"towa","name":"トワ","role":"ディレクター","order":1}
```

### series/<series-id>.json 例
```json
{"id":"rojiura-isekai","title":"路地裏異世界","type":"story","blurb":"晴れた日の路地裏は異世界だった。","order":5,"date":"2026-11-03"}
```

### works/.../work.json 例
```json
{"id":"towa","series":"rojiura-isekai","title":"影の測量士","authorName":"トワ"}
```

**ビルドはディレクトリを走査**する。シリーズ／作品のハードコード一覧は持たない（creators の表示順だけ order で制御してよい）。

## 既存シリーズ（コピー元 → 本リポへ取り込み）
| series-id | タイトル | 元パス | 旧ライブ |
|-----------|----------|--------|----------|
| healing-forest | 癒しの森 | river/healing-forest-gallery | https://superapolon.github.io/healing-forest/ |
| taki-wai | 滝 ワーイ俺 | river/taki-wai-gallery | https://superapolon.github.io/taki-wai/ |
| fashion-atelier | ファッション・アトリエ | river/fashion-atelier | https://superapolon.github.io/fashion-atelier/ |
| suberanai-hanashi | すべらない話 | river/suberanai-hanashi | https://superapolon.github.io/suberanai-hanashi/ |
| rojiura-isekai | 路地裏異世界 | river/rojiura-isekai | https://superapolon.github.io/rojiura-isekai/ |
| wanted-lunch | 食べたいランチ | river/wanted-lunch | https://superapolon.github.io/wanted-lunch/ |

洗い出し: `INVENTORY.json`（合計約117作品）。fashionは複数画像の場合すべてコピー。タイトルは元md／サイトmetaから抽出。

## UI方針
- 日本語。読みやすい余白。カード型。
- 個人ページが主役（「みんなの記事に個人単位で飛ぶ」）。
- 作品詳細の dialog／ページは本文最上段から（すべらない話の fixed dialog 教訓を踏襲可）。
- 旧単発URLは残ってよいが、**今後の正は本ハブ**。リダイレクトは必須ではない（余裕あればシリーズページに旧URL注記）。

## リポ／公開
- GitHub: `SuperApolon/creator-files`（名案。衝突なら `orrery-creators` 等）
- Pages: `https://superapolon.github.io/creator-files/`
- 公開後: トップURL＋SHAをトワへ。

## 成功条件
1. 全クリエイターに個人ページがあり、その人の全取り込み作品へリンクできる。
2. 6シリーズ分が本リポ内にコピーされ、サイトから読める。
3. 新シリーズ追加手順が BRIEF か README に1段落で書いてある（フォルダ追加→build→push）。
4. kotaは作品があるシリーズのみ表示。
