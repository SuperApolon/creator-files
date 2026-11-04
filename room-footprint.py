#!/usr/bin/env python3
"""部屋の足跡CLI（内部専用・Pages非掲載）。日付は保存しない。初回は kind=enter のみ。"""
import argparse, fcntl, json, os, shutil, sys
D = os.path.dirname(os.path.abspath(__file__)); FP = os.path.join(D, "rooms-footprints")
VP = os.path.join(FP, "visits.jsonl"); BD = os.path.join(FP, ".backup"); FLAG = os.path.join(FP, "enabled.flag")
def lines_of(p): return [l for l in open(p, encoding="utf-8") if l.strip()] if os.path.exists(p) else []
def load(): return [json.loads(l) for l in lines_of(VP)]
def host_of(room):
    if room == "lobby": return "lobby"
    try: j = json.load(open(os.path.join(D, "rooms", room, "room.json"), encoding="utf-8"))
    except Exception: return room
    for k in ("owner", "ownerName", "author", "authorName"):
        if j.get(k): return j[k]
    return room
def backup():
    os.makedirs(BD, exist_ok=True)
    ns = sorted(int(f.split(".")[1]) for f in os.listdir(BD) if f.startswith("visits.") and f.split(".")[1].isdigit())
    n = (ns[-1] + 1) if ns else 1
    shutil.copy2(VP, os.path.join(BD, f"visits.{n}.jsonl"))
    for old in ns[:max(0, len(ns) + 1 - 50)]: os.remove(os.path.join(BD, f"visits.{old}.jsonl"))
def on_visit(record):
    """次アクション用フック。enabled.flag が無ければ no-op。有効時も stdout に一行出すだけ（外部送信なし）。"""
    if not os.path.exists(FLAG): return
    if open(FLAG, encoding="utf-8").read().strip() not in ("", "1"): return
    print("[hook] " + json.dumps(record, ensure_ascii=False))
def add(a):
    if not os.path.exists(os.path.join(D, "rooms", a.room, "room.json")): sys.exit(f"部屋が見つかりません: rooms/{a.room}/room.json")
    os.makedirs(FP, exist_ok=True)
    with open(VP, "a", encoding="utf-8") as f:  # 追記のみ
        fcntl.flock(f, fcntl.LOCK_EX)
        nid = max([r.get("id", 0) for r in load()] + [0]) + 1
        r = {"id": nid, "from": a.frm, "room": a.room, "host": host_of(a.room), "kind": "enter", "note": a.note or ""}
        f.write(json.dumps(r, ensure_ascii=False) + "\n"); f.flush(); os.fsync(f.fileno())
        backup(); fcntl.flock(f, fcntl.LOCK_UN)
    print(f"足跡を残しました: {a.room} #{nid}")
    on_visit(r)
def lst(a):
    for r in load():
        if (a.room and r["room"] != a.room) or (a.frm and r["from"] != a.frm) or (a.host and r["host"] != a.host): continue
        print(f"[#{r['id']}] {r['from']} → {r['room']}（{r['host']}） {r['kind']}" + (f" / {r['note']}" if r["note"] else ""))
def restore(a=None):
    cur = lines_of(VP); have = {l.strip() for l in cur}; ids = {json.loads(l).get("id") for l in cur}; miss = []
    if os.path.isdir(BD):
        for fn in os.listdir(BD):
            for l in lines_of(os.path.join(BD, fn)):
                r = json.loads(l)
                if l.strip() not in have and r.get("id") not in ids: miss.append(l.strip()); have.add(l.strip()); ids.add(r.get("id"))
    if miss:
        miss.sort(key=lambda l: json.loads(l).get("id", 0))
        with open(VP, "a", encoding="utf-8") as f:
            fcntl.flock(f, fcntl.LOCK_EX); f.write("\n".join(miss) + "\n"); fcntl.flock(f, fcntl.LOCK_UN)
    print(f"復元：{len(miss)}件")
p = argparse.ArgumentParser(); s = p.add_subparsers(dest="cmd", required=True)
x = s.add_parser("add"); x.add_argument("--from", dest="frm", required=True); x.add_argument("--room", required=True); x.add_argument("--note"); x.set_defaults(f=add)
y = s.add_parser("list"); y.add_argument("--room"); y.add_argument("--from", dest="frm"); y.add_argument("--host"); y.set_defaults(f=lst)
s.add_parser("restore").set_defaults(f=restore)
a = p.parse_args(); a.f(a)
