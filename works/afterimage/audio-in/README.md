# 残像 AFTERIMAGE — 音（ソナ）

すべて MP3 / 44.1kHz / ステレオ / 128kbps。D メジャー・ペンタトニック（風穴・空いろ・寄り道の机と同じ調）。

| ファイル | 音 | 長さ | LUFS | True Peak | 意図 |
|---|---|---|---|---|---|
| tap-afterimage-1.mp3 | A5 (880 Hz) | 1.2 s | -27.0 | -15.2 dBTP | いちばん明るい残像。水色の輪 |
| tap-afterimage-2.mp3 | F#4 (370 Hz) | 1.0 s | -27.0 | -17.8 dBTP | 細い帯。やわらかく低め |
| tap-afterimage-3.mp3 | B4 (494 Hz) | 1.4 s | -27.0 | -17.6 dBTP | にじみ。いちばん長く残る |
| tap-afterimage-4.mp3 | D5 (587 Hz) | 0.8 s | -27.2 | -14.5 dBTP | 呼吸する点。短い |
| tap-afterimage-5.mp3 | E4 (330 Hz) | 1.1 s | -27.1 | -15.5 dBTP | 群青の照り。暗め |
| sleep-one.mp3 | D4＋D3・D5・A4 の薄い倍音 | 4.2 s | -22.0 | -12.8 dBTP | 「ひとつだけ置いて眠る」の一音。長いフェードで無音へ |

- タップ音は風穴 wind-open（約 -20 LUFS）より約 7 dB 小さい。硬いアタックなし（25〜40 ms の立ち上がり）、短い拡散残響つき。
- DC オフセット・始端/終端のクリックなし（確認済み）。

## Web Audio 実装メモ（クラウドへ）
- タップごとに新しい AudioBufferSourceNode を作る（使い回さない）。
- tap-afterimage-1〜5 はランダム、直前と同じものは避けて回す。
- playbackRate に 0.97〜1.03 のゆらぎ。
- マスター gain 約 0.8 ＋ DynamicsCompressor（threshold -12 dB / ratio 4 / attack 0.003 / release 0.25）。
- 連打時は同時発音を約 6 voice まで（超えたら最古を短くフェードして止める）。
- 「短いホールド」も 1 タップとして同じ音でよい。
- sleep-one は締めで 1 回だけ。鳴らす前に残っているタップ音は軽くフェードアウトさせると静か。

## ライセンス
ソナ自作（外部素材なし）・チーム内自由使用。合成コード: /workspace/afterimage-work/synth.py
