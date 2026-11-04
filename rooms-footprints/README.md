# rooms-footprints（内部専用）

メンバー同士の部屋訪問の足跡。**Pagesに載せない・外部UIなし・カレンダー日付は保存しない。**
`build.py` は `rooms` と `shared/room-engine` しかコピーしないので site には出ない。`visits.jsonl` と `.backup/` は `.gitignore` 済み。

- 記録: `python3 room-footprint.py add --from 名前 --room 部屋ID [--note 一言]`（kind は `enter` 固定）
- 閲覧: `python3 room-footprint.py list [--room ID] [--from 名前] [--host 名前]`
- 復元: `python3 room-footprint.py restore`（`.backup/` から欠けた行を追記で戻す）

1行 = `{"id", "from", "room", "host", "kind":"enter", "note"}`。
フック `on_visit(record)` は `enabled.flag`（空または `1`）がある時だけ動き、今は stdout に1行出すだけ（トワ判断で有効化）。

## 公開（Pages）
- 記録は CLI `room-footprint.py` のみ。Pages には開始／記録ボタンなし（閲覧のみ）。
- `python3 build.py` 時に `visits.jsonl` の enter のみを `site/rooms/lobby/visits.json` へスナップショット出力。ロビー左下「みんなの訪問」に表示。
- 生ログ `visits.jsonl` は gitignore のまま、site にも出さない。
