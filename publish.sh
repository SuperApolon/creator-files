#!/bin/sh
set -e; cd "$(dirname "$0")"
# 公開前のJSON検証（tools/README-ja.md）。node と tools/node_modules があるときだけ走り、失敗したら止まる。
# 無い環境では従来どおりビルドだけ行う（OQ_SKIP_VALIDATE=1 でも省略）。
if [ -z "$OQ_SKIP_VALIDATE" ] && command -v node >/dev/null 2>&1 && [ -d tools/node_modules/ajv ]; then
  node tools/validate.mjs
else
  echo "validate: スキップ（node または tools/node_modules が無い）"
fi
python3 build.py
rm -rf c s w assets index.html; cp -r site/. ./
