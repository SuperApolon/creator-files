# 残像 AFTERIMAGE — アート（アリス）

画像に文字は入っていません。人物もなし。

| ファイル | サイズ | 用途 |
|---|---|---|
| bg-dark.png / bg-dark.jpg（q92） | 3000×3000 | 暗い場の全面背景。温かい紺〜葡萄色、微粒子つき。中央は均一寄りなので、縦にも横にもどこを切り抜いても使えます（object-fit: cover 推奨） |
| ring-aqua(.png / -white.png) | 1024×1024 RGBA | 水色の輪 |
| band-thin | 同上 | 細い帯 |
| dot-blue | 同上 | 丸い青 |
| glint-ultramarine | 同上 | 群青の照り |
| point-breath | 同上 | 呼吸する小さな点（scale/opacity を脈打たせる想定） |
| line-green | 同上 | 少し揺らいだ緑の線 |
| bleed-0094e6 | 同上 | #0094E6 のにじみ |

## 色つき版と白版
- `名前.png`：色つき（芯はやや白寄りに光る）。
- `名前-white.png`：RGB が白で、アルファだけでかたちを持つ版。色は後から乗せる前提。
  - CSS：`mask-image: url(名前-white.png)` に `background: <色>`、または白版に `mix-blend-mode: multiply` で着色。
  - Canvas：白版を描いたあと `globalCompositeOperation = 'source-in'` で色を塗る。
- 暗い背景の上では `mix-blend-mode: screen` または `lighter` にすると残像らしく光ります。
