#!/usr/bin/env python3
"""Assemble the published GitHub Pages tree from referenced files only.

Repo files are never deleted. This copies a subset into --out.
Unreferenced paths are excluded. When a dynamic path cannot be
resolved safely, sibling matches or the whole uncertainty set is kept.
"""
from __future__ import annotations

import argparse, json, os, re, shutil, sys
from collections import defaultdict
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlparse

EXTS_ASSET = {
    ".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".ico", ".avif",
    ".mp3", ".mp4", ".webm", ".ogg", ".wav", ".m4a",
    ".vrm", ".vrma", ".glb", ".gltf", ".bin", ".wasm",
    ".json", ".js", ".mjs", ".cjs", ".css", ".html", ".htm",
    ".woff", ".woff2", ".ttf", ".otf", ".map",
}
TEXT_SCAN = {".html", ".htm", ".js", ".mjs", ".cjs", ".css", ".json"}
SKIP_DIR_NAMES = {".git", "tools", "node_modules", "site", "_site"}
# files in these dir prefixes are never seeds (dev only)
NEVER_SEED_PREFIX = ("tools/", "rooms/_refs/", "rooms/_scraps/", "rooms-footprints/")

SITE_PREFIXES = (
    "https://superapolon.github.io/creator-files/",
    "http://superapolon.github.io/creator-files/",
    "/creator-files/",
)

ATTR_RE = re.compile(
    r"""(?is)(?:href|src|poster|data-src|data-href|action)\s*=\s*(['"])(.*?)\1"""
)
SRCSET_RE = re.compile(r"""(?is)srcset\s*=\s*(['"])(.*?)\1""")
CSS_URL_RE = re.compile(r"""(?i)url\(\s*(['"]?)([^'")]+)\1\s*\)""")
CSS_IMPORT_RE = re.compile(r"""(?i)@import\s+(?:url\()?['"]([^'"]+)['"]""")
IMPORTMAP_RE = re.compile(r"""(?is)<script[^>]*type=["']importmap["'][^>]*>(.*?)</script>""")
ESM_FROM_RE = re.compile(r"""(?m)(?:from|import)\s+['"]([^'"]+)['"]""")
ESM_IMPORT_CALL_RE = re.compile(r"""import\(\s*['"]([^'"]+)['"]\s*\)""")
STR_RE = re.compile(r"""(['"])([^'"\n]{1,200})\1""")
TMPL_RE = re.compile(r"""`([^`]{1,400})`""")
CONCAT_RE = re.compile(
    r"""(['"])([^'"]{0,200})\1\s*\+\s*[A-Za-z_][\w.]*\s*\+\s*(['"])([^'"]{0,80})\3"""
)

def is_git_tracked(root: Path) -> set[str]:
    import subprocess
    out = subprocess.check_output(["git", "-C", str(root), "ls-files"], text=True)
    return {ln.strip().replace("\\", "/") for ln in out.splitlines() if ln.strip()}


def norm_posix(p: str) -> str:
    p = p.replace("\\", "/")
    while "//" in p:
        p = p.replace("//", "/")
    if p.startswith("./"):
        p = p[2:]
    return p


def strip_query(url: str) -> str:
    url = url.strip()
    if not url:
        return ""
    url = unquote(url)
    for sep in ("#", "?"):
        if sep in url:
            url = url.split(sep, 0 if False else 1)[0] if False else url.split(sep, 1)[0]
    return url.strip()


def site_path_from_url(url: str) -> str | None:
    """Return a repo-relative path if this URL points at our site, else None if external, else the relative string."""
    u = strip_query(url)
    if not u or u.startswith(("data:", "blob:", "mailto:", "javascript:", "tel:")):
        return None
    if u.startswith(SITE_PREFIXES):
        for pref in SITE_PREFIXES:
            if u.startswith(pref):
                rest = u[len(pref):]
                return norm_posix(rest)
        return None
    if re.match(r"^[a-z][a-z0-9+.-]*:", u, re.I):
        # other scheme / absolute external
        return None
    return u


def resolve_against(base_file: str, rel: str) -> str | None:
    rel = rel.strip()
    if not rel or rel in (".",):
        rel = "./"
    # absolute from site root
    if rel.startswith("/"):
        # /foo -> foo, but /creator-files already handled
        rel = rel.lstrip("/")
        return norm_posix(str(PurePosixPath(rel)))
    base_dir = str(PurePosixPath(base_file).parent)
    if base_dir == ".":
        combined = rel
    else:
        combined = str(PurePosixPath(base_dir) / rel)
    try:
        resolved = PurePosixPath(norm_posix(combined))
        # refuse escape
        if ".." in resolved.parts:
            # normalize .. 
            parts = []
            for p in resolved.parts:
                if p == "..":
                    if parts:
                        parts.pop()
                    else:
                        return None
                elif p != ".":
                    parts.append(p)
            resolved = PurePosixPath(*parts) if parts else PurePosixPath(".")
        s = "" if str(resolved) == "." else str(resolved)
        return norm_posix(s)
    except Exception:
        return None


def existing_variants(root: Path, rel: str, tracked: set[str]) -> list[str]:
    """A reference may be a dir (needs index.html) or a file."""
    rel = norm_posix(rel)
    if not rel or rel.endswith("/"):
        rel = norm_posix(rel + "index.html") if rel else "index.html"
        return [rel] if rel in tracked else ([rel] if (root / rel).is_file() else [])
    hits = []
    if rel in tracked or (root / rel).is_file():
        hits.append(rel)
    # directory
    for cand in (rel + "/index.html", rel.rstrip("/") + "/index.html"):
        c = norm_posix(cand)
        if c in tracked or (root / c).is_file():
            if c not in hits:
                hits.append(c)
    return hits


def looks_like_path(s: str) -> bool:
    if not s or len(s) > 400:
        return False
    if s.startswith(("data:", "blob:", "mailto:", "javascript:", "http://www.w3.org", "https://www.w3.org")):
        return False
    if any(c in s for c in ["\n", " ", "*", "{", "}", "<", ">", "|"]):
        # allow spaces in rare names? our repo doesn't use them
        if " " in s and not s.startswith(("./", "../", "/")):
            return False
        if any(c in s for c in "*{}<>|"):
            return False
    ext = Path(s.split("?")[0].split("#")[0]).suffix.lower()
    if ext in EXTS_ASSET:
        return True
    if s.startswith(("./", "../", "/creator-files/", "https://superapolon.github.io/creator-files/")):
        return True
    if s.endswith("/"):
        return True
    return False


def extract_from_text(text: str, kind: str) -> list[str]:
    found: list[str] = []
    if kind in ("html", "htm"):
        for m in ATTR_RE.finditer(text):
            found.append(m.group(2))
        for m in SRCSET_RE.finditer(text):
            for part in m.group(2).split(","):
                url = part.strip().split()[0] if part.strip() else ""
                if url:
                    found.append(url)
        for m in CSS_URL_RE.finditer(text):
            found.append(m.group(2))
        for m in IMPORTMAP_RE.finditer(text):
            try:
                data = json.loads(m.group(1))
                imports = data.get("imports") or {}
                for k, v in imports.items():
                    found.append(v)
            except Exception:
                pass
        for m in ESM_FROM_RE.finditer(text):
            found.append(m.group(1))
    if kind in ("css",):
        for m in CSS_URL_RE.finditer(text):
            found.append(m.group(2))
        for m in CSS_IMPORT_RE.finditer(text):
            found.append(m.group(1))
    if kind in ("js", "mjs", "cjs", "html", "htm"):
        for m in ESM_FROM_RE.finditer(text):
            found.append(m.group(1))
        for m in ESM_IMPORT_CALL_RE.finditer(text):
            found.append(m.group(1))
        for m in STR_RE.finditer(text):
            s = m.group(2)
            if looks_like_path(s):
                found.append(s)
        for m in TMPL_RE.finditer(text):
            raw = m.group(1)
            # static template? or pattern with ${}
            if "${" in raw:
                found.append("TMPL:" + raw)
            elif looks_like_path(raw):
                found.append(raw)
        for m in CONCAT_RE.finditer(text):
            found.append("CONCAT:" + m.group(2) + "*" + m.group(4))
    if kind == "json":
        try:
            def walk(o):
                if isinstance(o, str):
                    if looks_like_path(o) or o.endswith(tuple(EXTS_ASSET)) or "/" in o:
                        found.append(o)
                elif isinstance(o, dict):
                    for v in o.values():
                        walk(v)
                elif isinstance(o, list):
                    for v in o:
                        walk(v)
            walk(json.loads(text))
        except Exception:
            for m in STR_RE.finditer(text):
                if looks_like_path(m.group(2)):
                    found.append(m.group(2))
    return found


def parse_import_maps(root: Path, html_rel: str, text: str) -> list[tuple[str, dict[str, str]]]:
    """Return (html_rel, {spec: resolved_path_or_prefix})"""
    maps = []
    for m in IMPORTMAP_RE.finditer(text):
        try:
            data = json.loads(m.group(1))
        except Exception:
            continue
        resolved = {}
        for k, v in (data.get("imports") or {}).items():
            sp = site_path_from_url(v)
            if sp is None:
                continue
            rp = resolve_against(html_rel, sp)
            if rp is not None:
                resolved[k] = rp
        if resolved:
            maps.append((html_rel, resolved))
    return maps


def resolve_specifier(spec: str, from_file: str, import_maps: list[tuple[str, dict[str, str]]]) -> list[str]:
    hits = []
    if spec.startswith(("./", "../", "/")):
        r = resolve_against(from_file, spec)
        return [r] if r else []
    # bare specifier via import maps
    for _html, imap in import_maps:
        # exact
        if spec in imap:
            hits.append(imap[spec])
            continue
        # prefix (keys ending with /)
        for k, v in imap.items():
            if k.endswith("/") and spec.startswith(k):
                rest = spec[len(k):]
                hits.append(norm_posix(v + rest if v.endswith("/") else v + "/" + rest))
    return hits


def expand_dynamic(root: Path, from_file: str, token: str, tracked: set[str]) -> list[str]:
    """Expand TMPL: and CONCAT: tokens to tracked files."""
    out = []
    base_dir = str(PurePosixPath(from_file).parent)
    if token.startswith("TMPL:"):
        raw = token[5:]
        # replace ${...} with *
        globpat = re.sub(r"\$\{[^}]+\}", "*", raw)
        # resolve relative
        if not globpat.startswith(("/", "http")):
            rel = resolve_against(from_file, globpat) or ""
        else:
            rel = globpat
        if rel:
            # pathlib glob from root
            # only allow a single * segment, no **
            if ".." in PurePosixPath(rel).parts:
                return []
            try:
                matches = list(root.glob(rel))
            except ValueError:
                matches = []
            for m in matches:
                try:
                    rp = m.relative_to(root).as_posix()
                except Exception:
                    continue
                if rp in tracked:
                    out.append(rp)
    elif token.startswith("CONCAT:"):
        left, right = token[7:].split("*", 1)
        # glob left*right in the file's directory
        pat = left + "*" + right
        rel = resolve_against(from_file, pat) or ""
        if rel:
            try:
                _ms = list(root.glob(rel))
            except ValueError:
                _ms = []
            for m in _ms:
                try:
                    rp = m.relative_to(root).as_posix()
                except Exception:
                    continue
                if rp in tracked:
                    out.append(rp)
    return out


def classify(rel: str) -> str:
    if rel.startswith("tools/") or rel in {
        "build.py", "migrate.py", "publish.sh", "room-footprint.py",
        "BRIEF.md", "INVENTORY.json", "README.md",
    }:
        return "開発・ビルド用"
    if rel.startswith("rooms/_refs/") or rel.startswith("rooms/_scraps/") or rel.endswith("-wip.md"):
        return "作業用・参照素材"
    if rel.endswith("BRIEF.md") or rel.endswith("/README.md") or rel == "rooms/BRIEF.md":
        return "開発用ドキュメント"
    if rel.startswith("rooms-footprints/"):
        return "開発用（足跡の生ログ置き場）"
    if rel.startswith("creators/"):
        return "ビルド入力（creators/）"
    if rel.startswith("series/") and rel.endswith(".json"):
        return "ビルド入力（series/）"
    if rel.endswith("/body.md") or rel.endswith("/work.json"):
        return "ビルド入力（work ソース）"
    if "/art/" in rel or rel.endswith("/art.png") or rel.endswith("/art.jpg") or rel.endswith("/art.jpeg") or rel.endswith("/art.webp"):
        if rel.startswith("works/") and not rel.startswith("works/game-shelf/") and "/viewer/" not in rel:
            return "未参照の作品ソース素材"
    if rel.endswith((".vrm", ".vrma")):
        return "未参照の3Dモーション/モデル"
    if rel.startswith("vendor/") and "INTEGRITY" in rel or rel.endswith("SHA256SUMS"):
        return "開発用ベンダー記録"
    if rel.startswith("rooms/") and "/assets/" in rel:
        return "未参照の部屋ソース素材"
    if rel.startswith("vendor/"):
        return "未参照のベンダー"
    return "未参照のその他"


def assemble(root: Path, out: Path) -> dict:
    tracked = is_git_tracked(root)
    # seeds: all public html
    seeds = []
    for rel in sorted(tracked):
        if any(rel.startswith(p) for p in NEVER_SEED_PREFIX):
            continue
        if Path(rel).suffix.lower() in {".html", ".htm"}:
            seeds.append(rel)

    keep: set[str] = set()
    # always
    if ".nojekyll" in tracked:
        keep.add(".nojekyll")

    import_maps: list[tuple[str, dict[str, str]]] = []
    queue: list[str] = []
    seen_scan: set[str] = set()
    why: dict[str, str] = {}

    def add(rel: str, reason: str):
        rel = norm_posix(rel)
        if not rel or rel not in tracked:
            # try variants
            return
        if rel not in keep:
            keep.add(rel)
            why[rel] = reason
            queue.append(rel)

    def keep_room_implicit():
        """Room engine loads assetBase + filename from room.json, and always requests avatar.png."""
        for rel in list(tracked):
            if not (rel.startswith("rooms/") and rel.endswith("/room.json")):
                continue
            add(rel, "room.json")
            asset_dir = str(PurePosixPath(rel).parent / "assets")
            av = norm_posix(asset_dir + "/avatar.png")
            if av in tracked:
                add(av, "room engine always loads avatar.png")
            try:
                data = json.loads((root / rel).read_text(encoding="utf-8"))
            except Exception:
                continue
            names = []
            def walk(o):
                if isinstance(o, dict):
                    for k, v in o.items():
                        if k in {"sceneImg", "wallImg", "floorImg", "img", "hitImg"} and isinstance(v, str):
                            names.append(v)
                        walk(v)
                elif isinstance(o, list):
                    for i in o:
                        walk(i)
                elif isinstance(o, str) and Path(o).suffix.lower() in EXTS_ASSET:
                    names.append(o)
            walk(data)
            for n in names:
                n = n.strip().lstrip("./")
                for cand in (
                    norm_posix(asset_dir + "/" + n),
                    resolve_against(rel, n) or "",
                ):
                    if cand in tracked:
                        add(cand, f"room.json asset from {rel}")

    for s in seeds:
        add(s, "html seed")
    keep_room_implicit()

    # parse import maps from seed html first
    for s in seeds:
        p = root / s
        try:
            text = p.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        import_maps.extend(parse_import_maps(root, s, text))

    def consider_ref(from_file: str, raw: str, reason: str):
        if raw.startswith(("TMPL:", "CONCAT:")):
            for rp in expand_dynamic(root, from_file, raw, tracked):
                add(rp, f"dynamic from {from_file}")
            # if TMPL/CONCAT in afterimage/sorairo/yorimichi/towa, also already globbed
            return
        sp = site_path_from_url(raw)
        if sp is None:
            # maybe bare specifier
            for r in resolve_specifier(raw, from_file, import_maps):
                for ev in existing_variants(root, r, tracked):
                    add(ev, f"import from {from_file}")
                # if it didn't exist, still record the resolved path if tracked
                if r in tracked:
                    add(r, f"import from {from_file}")
            return
        resolved = resolve_against(from_file, sp)
        candidates = []
        if resolved:
            candidates.append(resolved)
        # If the path repeats the current directory name (e.g. scenes.json
        # in bg/ with src "bg/foo.webp", used as ./src from the parent).
        if sp and not sp.startswith(("/", "http")):
            parent = str(PurePosixPath(from_file).parent)
            grand = str(PurePosixPath(from_file).parent.parent)
            name = PurePosixPath(from_file).parent.name
            psp = PurePosixPath(sp)
            if psp.parts and psp.parts[0] == name:
                candidates.append(norm_posix(str(PurePosixPath(parent, *psp.parts[1:]))))
            r2 = resolve_against(str(PurePosixPath(parent) / "dummy"), sp)
            # resolve as if from the parent directory
            r3 = resolve_against(from_file, "../" + sp.lstrip("./"))
            if r3:
                candidates.append(r3)
        variants = []
        for c in candidates:
            if not c:
                continue
            variants.extend(existing_variants(root, c, tracked))
        # unique
        seen=set(); uniq=[]
        for ev in variants:
            if ev not in seen:
                seen.add(ev); uniq.append(ev)
        variants=uniq
        if variants:
            for ev in variants:
                add(ev, f"ref from {from_file}")
        else:
            # maybe specifier that looks like path
            for r in resolve_specifier(raw, from_file, import_maps):
                for ev in existing_variants(root, r, tracked):
                    add(ev, f"import from {from_file}")

    while queue:
        rel = queue.pop()
        ext = Path(rel).suffix.lower()
        if ext not in TEXT_SCAN:
            continue
        if rel in seen_scan:
            continue
        seen_scan.add(rel)
        p = root / rel
        try:
            # skip huge payloads: still need to scan html/js but 8MB is ok
            text = p.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        # drop huge data/base64 to speed up and avoid false paths
        text = re.sub(r"data:[^\"'\s]+", "data:omit", text)
        text = re.sub(r"window\.__GLB__=\"[^\"]*\"", "window.__GLB__=\"\"", text)
        kind = ext.lstrip(".")
        if kind == "htm":
            kind = "html"
        refs = extract_from_text(text, kind)
        for raw in refs:
            consider_ref(rel, raw, "scan")
        if kind == "html":
            for m in re.finditer(r'data-img\s*=\s*([\'"])([^\'"]+)\1', text):
                stem = m.group(2)
                for ext in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
                    cand = resolve_against(rel, stem + ext)
                    if cand and cand in tracked:
                        add(cand, f"data-img from {rel}")
        # extra: afterimage fallback art/ and art-in/, sorairo tones, etc. already via TMPL
        # If this JS contains known dynamic patterns, glob the intended trees narrowly
        if rel.endswith("viewer.js") and "towa-" in text and ".vrma" in text:
            # idle/nod/wave already via CONCAT glob — CONCAT would glob towa-*.vrma in viewer/
            # that's correct (idle, nod, wave only live there)
            pass
        if "audio/tone-${" in text or "audio/tone-" in text and "${" in text:
            for rp in tracked:
                if rp.startswith(str(PurePosixPath(rel).parent / "audio") + "/") and rp.endswith(".mp3"):
                    add(rp, f"tone glob from {rel}")

    # Safety keeps requested by the brief — only add if still missing and tracked,
    # but do not re-add unreferenced sources. These are "must not break":
    # if a required page wasn't seeded, add it.
    must_pages = [
        "index.html",
        "rooms/lobby/index.html",
        "rooms/lobby/visits.json",
        "rooms/lobby/room.json",
        "rooms/lobby/board/index.html",
        "rooms/lobby/board/posts.json",
        "works/game-shelf/index.html",
        "works/game-shelf/games.json",
        "works/game-shelf/pv.mp4",
        "works/bookshelf/index.html",
        "works/shadow-still-reaches/index.html",
        "w/3d-model/setsuna/index.html",
        "works/3d-model/setsuna/viewer/index.html",
        "w/3d-model/towa/index.html",
        "works/3d-model/towa/viewer/index.html",
        "works/3d-model/towa/walk/index.html",
    ]
    for m in must_pages:
        if m in tracked and m not in keep:
            add(m, "safety must-page")
            # will be scanned if queued — if already finished loop, rescan:
    # If safety added new text files, drain queue again
    while queue:
        rel = queue.pop()
        ext = Path(rel).suffix.lower()
        if ext not in TEXT_SCAN or rel in seen_scan:
            continue
        seen_scan.add(rel)
        try:
            text = (root / rel).read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        text = re.sub(r"data:[^\"'\s]+", "data:omit", text)
        text = re.sub(r"window\.__GLB__=\"[^\"]*\"", "window.__GLB__=\"\"", text)
        kind = "html" if ext in {".html", ".htm"} else ext.lstrip(".")
        for raw in extract_from_text(text, kind):
            consider_ref(rel, raw, "scan")

    # measure
    def sz(rel: str) -> int:
        try:
            return (root / rel).stat().st_size
        except Exception:
            return 0

    all_files = sorted(tracked)
    excluded = [r for r in all_files if r not in keep]
    before_n, before_b = len(all_files), sum(sz(r) for r in all_files)
    after_n, after_b = len(keep), sum(sz(r) for r in keep)

    # copy
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    for rel in sorted(keep):
        src = root / rel
        dst = out / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)

    # classify exclusions
    buckets: dict[str, list[tuple[str, int]]] = defaultdict(list)
    for r in excluded:
        buckets[classify(r)].append((r, sz(r)))

    report = {
        "before": {"files": before_n, "bytes": before_b},
        "after": {"files": after_n, "bytes": after_b},
        "excluded": {
            k: {
                "files": len(v),
                "bytes": sum(b for _, b in v),
                "examples": [r for r, _ in sorted(v, key=lambda x: -x[1])[:30]],
            }
            for k, v in sorted(buckets.items(), key=lambda kv: -sum(b for _, b in kv[1]))
        },
        "excluded_all": excluded,
        "kept": sorted(keep),
    }
    return report


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=".")
    ap.add_argument("--out", default="_site")
    ap.add_argument("--report", default=None)
    args = ap.parse_args()
    root = Path(args.src).resolve()
    out = Path(args.out)
    if not out.is_absolute():
        out = (root / out).resolve()
    report = assemble(root, out)
    b, a = report["before"], report["after"]
    print(f"before: {b['files']} files, {b['bytes']/1e6:.1f} MB")
    print(f"after:  {a['files']} files, {a['bytes']/1e6:.1f} MB")
    print(f"saved:  {b['files']-a['files']} files, {(b['bytes']-a['bytes'])/1e6:.1f} MB")
    print("excluded by class:")
    for k, v in report["excluded"].items():
        print(f"  {k}: {v['files']} files, {v['bytes']/1e6:.1f} MB")
        for ex in v["examples"][:8]:
            print(f"    - {ex}")
    rp = Path(args.report) if args.report else out.parent / "assemble-pages-report.json"
    # don't write report inside out
    if rp.is_relative_to(out):
        rp = root / "assemble-pages-report.json"
    # write a slimmer report for humans (full excluded_all is ok, kept is long)
    slim = {k: report[k] for k in ("before", "after", "excluded")}
    slim["excluded_all"] = report["excluded_all"]
    rp.write_text(json.dumps(slim, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"report: {rp}")


if __name__ == "__main__":
    main()
