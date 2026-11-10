#!/usr/bin/env python3
"""旧 SuperApolon/creator-files の Pages 公開物を「転送スタブ＋素材の実体＋404.html」に組み立てる。

旧 repo のワークフローの組み立て段で使う（git のファイルは消さない）：
  python3 tools/assemble-pages.py --src . --out _full
  python3 tools/make-redirect-stubs.py --full _full --out _site

- HTML（*.html）は、ORRERYQUBIT の同じパスへ転送するスタブに置き換える。
  meta refresh・canonical・og（元にあれば写す）・location.replace（クエリと # を保持）。日付は出さない。
- 素材（HTML 以外）は今と同じパスに実体のまま残す。
- 例外：KEEP_AS_IS の HTML（GLB 埋め込みのセツナ単体 HTML）は倉庫の実体として残す（新側がここを参照する）。
- 404.html：拾えなかったパスも同じ形で転送する。
"""
from __future__ import annotations
import argparse, html, json, re, shutil
from pathlib import Path

OLD_PREFIX = "/creator-files/"
NEW_ORIGIN = "https://orreryqubit.github.io"
KEEP_AS_IS = {"works/3d-model/setsuna/viewer/index.html"}
OG_RE = re.compile(r"""<meta\s+[^>]*(?:property|name)\s*=\s*["'](og:[^"']+|twitter:[^"']+|description)["'][^>]*>""", re.I)
TITLE_RE = re.compile(r"<title>(.*?)</title>", re.I | re.S)
CONTENT_RE = re.compile(r"""content\s*=\s*["']([^"']*)["']""", re.I)


def page_url(rel: str) -> str:
    # works/x/index.html -> /creator-files/works/x/ 、 foo.html -> /creator-files/foo.html
    if rel == "index.html":
        p = ""
    elif rel.endswith("/index.html"):
        p = rel[: -len("index.html")]
    else:
        p = rel
    return NEW_ORIGIN + OLD_PREFIX + p


def fix_og(tag: str, new_url: str) -> str:
    # og:url は新URLへ。og:image などの相対/旧URLはそのまま（素材は旧側に実体が残る）
    if re.search(r"""["']og:url["']""", tag, re.I):
        return CONTENT_RE.sub(f'content="{html.escape(new_url)}"', tag)
    return tag


def stub(rel: str, src_html: str) -> str:
    url = page_url(rel)
    m = TITLE_RE.search(src_html)
    title = m.group(1).strip() if m else "ORRERY クリエイターファイル"
    ogs = "".join(fix_og(mm.group(0), url) for mm in OG_RE.finditer(src_html))
    u = html.escape(url, quote=True)
    js_url = json.dumps(url)
    return (
        '<!doctype html><html lang="ja"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        f"<title>{title}</title>"
        f'<link rel="canonical" href="{u}">'
        f"{ogs}"
        f'<meta http-equiv="refresh" content="0; url={u}">'
        f"<script>location.replace({js_url}+location.search+location.hash);</script>"
        '<link rel="icon" href="data:,">'
        "</head><body style=\"font-family:system-ui,sans-serif;padding:24px\">"
        f'<p>ORRERY クリエイターファイルは新しい場所へ移りました。<a href="{u}">こちら</a>から開けます。</p>'
        "</body></html>\n"
    )


NOT_FOUND = (
    '<!doctype html><html lang="ja"><head><meta charset="utf-8">'
    '<meta name="viewport" content="width=device-width,initial-scale=1">'
    "<title>ORRERY クリエイターファイル</title>"
    '<link rel="icon" href="data:,">'
    "<script>(function(){var p=location.pathname;"
    f"if(p.indexOf({json.dumps(OLD_PREFIX)})!==0)p={json.dumps(OLD_PREFIX)};"
    f"location.replace({json.dumps(NEW_ORIGIN)}+p+location.search+location.hash);}})();</script>"
    "</head><body style=\"font-family:system-ui,sans-serif;padding:24px\">"
    f'<p>ORRERY クリエイターファイルは新しい場所へ移りました。<a href="{NEW_ORIGIN}{OLD_PREFIX}">こちら</a>から開けます。</p>'
    "</body></html>\n"
)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--full", required=True, help="tools/assemble-pages.py の出力（いまの公開物）")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    full, out = Path(a.full), Path(a.out)
    if out.exists():
        shutil.rmtree(out)
    n_stub = n_asset = n_keep = 0
    for p in sorted(full.rglob("*")):
        if not p.is_file():
            continue
        rel = p.relative_to(full).as_posix()
        dst = out / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        if rel.lower().endswith((".html", ".htm")) and rel not in KEEP_AS_IS:
            dst.write_text(stub(rel, p.read_text(encoding="utf-8", errors="replace")), encoding="utf-8")
            n_stub += 1
        else:
            shutil.copy2(p, dst)
            n_keep += rel in KEEP_AS_IS
            n_asset += rel not in KEEP_AS_IS
    (out / "404.html").write_text(NOT_FOUND, encoding="utf-8")
    if not (out / ".nojekyll").exists():
        (out / ".nojekyll").write_text("")
    size = sum(f.stat().st_size for f in out.rglob("*") if f.is_file())
    print(f"stubs={n_stub} assets={n_asset} keep_html={n_keep} 404=1 total={size/1e6:.1f}MB")


if __name__ == "__main__":
    main()
