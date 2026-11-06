# 風穴 KAZAANA

くすんだ灰色の壁をタップすると穴があき、風と青空、メンバーの言い切り一文が流れ出る。全員分あけきると壁が崩落し、満天の空になる。

公太「今の時代に風穴をあけるような、爽やかな出力を別の形で」／ディレクター トワ。

## ファイル
| パス | 役割 |
|------|------|
| `index.html` / `style.css` / `app.js` | 本体（ビルドなし・CDNなし） |
| `lines.json` | 言い切り一文（シグナ集約・20人） |
| `art/sky-wide.jpg` · `art/sky-tall.jpg` | 空（アリス）。png併置あり。実装は **jpg優先**、向きで切替 |
| `audio/wind-open{,-2,-3}.mp3` · `audio/sky-full.mp3` | 風／全開（ソナ）。詳細は `audio/README.md` |
| `BRIEF.md` | 仕様 |

## 差し替え
- 空：`art/sky-wide.jpg` / `art/sky-tall.jpg`（縦横は orientation / アスペクトで自動）。無ければ手続生成。
- 音：`audio/` の mp3。読めなければ WebAudio 合成フォールバック。
- 一文：`lines.json` は `[{ "name": "…", "line": "…" }, …]`。穴の数 = 配列長（現在20・トワが末尾）。

## 音の実装メモ（ソナ README 準拠）
- 最初の pointerdown で AudioContext を同期 create/resume。
- wind-open 3種をランダム（連続同一なし）。playbackRate 0.95〜1.05。同時発音は最大3。
- sky-full 再生時、鳴中の wind を 0.3秒でフェードアウト。

## 公開
`works/kazaana/` ＋ ロビー掲示板 post-014。クラウド実装。
