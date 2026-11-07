# vendor の取得元と integrity 照合（2026-11-08 JST）

各パッケージは `npm pack <pkg>@<ver>` で tarball を取得し、tarball の sha512 を `npm view <pkg>@<ver> dist.integrity` と照合した（全件一致）。
ファイルごとのハッシュは SHA256SUMS（`cd vendor && sha256sum -c SHA256SUMS`）。

| パッケージ | 版 | ライセンス | npm dist.integrity | 照合 |
|---|---|---|---|---|
| three | 0.187.0 | MIT | `sha512-Qiu7R+Cmh8CstZsY1uJOSWnVlfo7ZtNLV7mF8Jltk3LB3AtDu9cRZlcnRKkAk8Y4z6KKw35z7Y7Urd7jWY8etA==` | 一致（viewer の既存 three.module.js と同一バイト） |
| @pixiv/three-vrm | 3.5.5 | MIT | `sha512-RPXy7jYAXs704NIpZlosB0U2ENu21G9DrqGWdQgRe8dShaCo1ugpj+6BVPRCy91nt+MPMA96j5rbsSzEl0HlQA==` | 一致（works/3d-model/towa/viewer/vendor の既存コピーとも同一バイト） |
| three-mesh-bvh | 0.9.18 | MIT | `sha512-S76hOBnsSG4jsuEyCu98K63klONG4NwJANabPY1LUD5l7oUgu2xtKC0IwnX/XyPzo4YZ1D7ZU+gHVA479UdQmA==` | 一致 |
| @pixiv/three-vrm-animation | 3.5.5 | MIT | `sha512-Q0kEtmftxfv0iCUHQkJH2jAr1zmT9ywYXnAzhxnLPMYCsx0Kken3J3U2GJF9PdGZmLlKpoK0LFEXVdD/L7ZA4Q==` | 一致 |
| meshoptimizer | 1.3.0 | MIT | `sha512-2oZqMAcEEiCtXWUjIGtZ71oPx1B0ZxYGTqIKsXB1wzWFhleNsCFxQuUJzgCV706bRcwPWtMGf1odmQvAcqKkIw==` | 一致 |
| postprocessing | 6.39.6 | Zlib | `sha512-HIVhnU8R9tF2YBMXOF2x+TKt3ia+caSHGsycSqrfkd426vH/jwm7w19YQCWsA8jMQJXvAsniLYMiJaNugxUFtA==` | 一致 |
| @sparkjsdev/spark | 2.4.0 | MIT | `sha512-aUjgBfhwDRcF3nUwiAD6Nh7IwvxEmW9liz2qrAXIm2BlPYBmn81QbXIpGFLBSr/o0TKGvEXbNIsKujgPGV/7QQ==` | 一致 |

入れたファイルは各パッケージの配布物のうちブラウザ用 ESM 本体と LICENSE だけ（ソースマップ・テスト・CJS/UMD・型定義は入れていない）。
