# ORRERY クリエイターファイル

個人単位で作品へ飛べる公開ハブ。LIVE: https://superapolon.github.io/creator-files/

- `creators/<id>.json` … id, name, role, order（表示順のみ order で制御）
- `series/<series-id>.json` … id, title, type, blurb, order, date（date はメタ用。公開HTMLには出さない）
- `works/<series-id>/<id>/` … `work.json`（title, authorName, 任意 creator/summary）＋ `art.(png|jpg|webp)`（複数可: art-2 …）＋ 任意 `body.md` / `creators/avatars/<id>.png` がアイコン（走査して自動使用） / 挿絵のない作品は `shared/writing-cover.png` を共通カバーとして表示
- `python3 build.py` で `site/` を生成し、その中身をリポルートへ展開して公開（Pages: main / root）。

## 新シリーズ追加手順
`series/<新series-id>.json` を1つ作り（id, title, type, blurb, order, date）、`works/<新series-id>/<クリエイターid>/` ごとに `work.json` と `art.png` 等・任意の `body.md` を置いたら、`python3 build.py` を実行し、`./publish.sh`（build→site の中身をルートへ展開）して commit → `git push` するだけ。build.py はディレクトリを走査するのでコードの変更は不要。新クリエイターは `creators/<id>.json` を追加する。
