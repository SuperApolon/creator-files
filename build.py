#!/usr/bin/env python3
"""creators/ series/ works/ を走査して静的サイトを生成する。シリーズ・作品はハードコードしない。
出力: _site/ （python3 build.py 後、publish はリポルートへ展開: --root）"""
import json,os,glob,html,shutil,sys,re
H=os.path.dirname(os.path.abspath(__file__));OUT=os.path.join(H,'site')
e=html.escape
def J(p): return json.load(open(p,encoding='utf-8'))
creators={d['id']:d for d in map(J,glob.glob(f'{H}/creators/*.json'))}
series={d['id']:d for d in map(J,glob.glob(f'{H}/series/*.json'))}
works=[]
for wj in sorted(glob.glob(f'{H}/works/*/*/work.json')):
  d=J(wj);wd=os.path.dirname(wj);sid=os.path.basename(os.path.dirname(wd));wid=os.path.basename(wd)
  d.setdefault('id',wid);d['series']=sid;d.setdefault('creator',wid)
  arts=sorted([os.path.basename(p) for p in glob.glob(f'{wd}/art*') if p.lower().endswith(('.png','.jpg','.jpeg','.webp'))],key=lambda n:(n.split('.')[0]!='art',n))
  d['arts']=arts;d['dir']=wd
  b=f'{wd}/body.md';d['body']=open(b,encoding='utf-8').read() if os.path.exists(b) else d.get('summary','')
  if sid in series: works.append(d)
so=lambda s:(series[s].get('order',999),s)
works.sort(key=lambda w:(so(w['series']),creators.get(w['creator'],{}).get('order',999)))
by_c={};[by_c.setdefault(w['creator'],[]).append(w) for w in works]
# creators shown: those with works, or required (no 'optional')
OPTIONAL={i for i,c in creators.items() if c.get('optional') or i=='kota'}
shown=sorted([c for i,c in creators.items() if by_c.get(i) or i not in OPTIONAL],key=lambda c:(c.get('order',999),c['id']))
CSS="""*{box-sizing:border-box}body{margin:0;font-family:"Hiragino Sans","Noto Sans JP",system-ui,sans-serif;background:#f6f4ef;color:#222;line-height:1.85}
a{color:inherit}header.top{background:#1d2440;color:#fff;padding:18px 24px}header.top a{text-decoration:none}header.top .brand{font-weight:700;letter-spacing:.06em}
header.top nav{margin-top:6px;font-size:14px;opacity:.85}header.top nav a{margin-right:16px}
main{max-width:1100px;margin:0 auto;padding:32px 20px 80px}h1{font-size:28px;margin:.2em 0 .4em}.lead{color:#555;margin-bottom:28px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:20px}
.card{display:block;background:#fff;border-radius:14px;overflow:hidden;text-decoration:none;box-shadow:0 2px 10px rgba(0,0,0,.06);transition:transform .15s}
.card:hover{transform:translateY(-3px)}.card .ph{aspect-ratio:1/1;background:#e5e1d8;display:flex;align-items:center;justify-content:center;overflow:hidden;font-size:42px;color:#999}
.card .ph img{width:100%;height:100%;object-fit:cover}.card .m{padding:12px 14px}.card .t{font-weight:700;display:block}.card .a{font-size:13px;color:#777}
.pill{display:inline-block;font-size:12px;background:#eef0f7;color:#344;border-radius:99px;padding:1px 10px;margin-right:6px}
article{background:#fff;border-radius:16px;padding:28px clamp(18px,4vw,48px);box-shadow:0 2px 10px rgba(0,0,0,.06)}
article .arts img{width:100%;max-height:80vh;object-fit:contain;border-radius:10px;background:#eee;margin-bottom:14px}
article .body p{margin:0 0 1.1em}.crumb{font-size:14px;color:#666;margin-bottom:14px}.crumb a{margin-right:4px}
section{margin-top:44px}h2{font-size:20px;border-left:4px solid #1d2440;padding-left:10px}.card .ph img.av{width:78%;height:78%;border-radius:50%;object-fit:cover;box-shadow:0 2px 8px rgba(0,0,0,.15)}.hav{width:96px;height:96px;border-radius:50%;object-fit:cover;display:block;margin-bottom:8px}footer{text-align:center;color:#999;font-size:13px;padding:30px}"""
def page(path,title,inner):
  r='../'*len(path.split('/')) if path else './'
  s=f'''<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{e(title)}｜クリエイターファイル</title><link rel="stylesheet" href="{r}assets/style.css"></head><body>
<header class="top"><a class="brand" href="{r}">ORRERY クリエイターファイル</a><nav><a href="{r}">クリエイター</a><a href="{r}s/">シリーズ</a></nav></header>
<main>{inner.replace('@R@',r)}</main><footer>ORRERY QUBIT</footer></body></html>'''
  p=os.path.join(OUT,path,'index.html');os.makedirs(os.path.dirname(p),exist_ok=True);open(p,'w',encoding='utf-8').write(s)
def img(w): return f"@R@w/{w['series']}/{w['id']}/{w['arts'][0]}" if w['arts'] else ''
def wcard(w,label):
  im=img(w);ph=f'<img src="{e(im)}" alt="{e(w["title"])}" loading="lazy">' if im else '✎'
  return f'<a class="card" href="@R@w/{e(w["series"])}/{e(w["id"])}/"><div class="ph">{ph}</div><div class="m"><span class="t">{e(w["title"])}</span><span class="a">{e(label)}</span></div></a>'
def md(t):
  ps=[x.strip() for x in re.split(r'\n\s*\n',t) if x.strip()]
  return ''.join('<p>'+e(x).replace('\n','<br>')+'</p>' for x in ps if not x.startswith('#'))
if os.path.exists(OUT): shutil.rmtree(OUT)
os.makedirs(f'{OUT}/assets/avatars');
AV={}
for p in glob.glob(f'{H}/creators/avatars/*'):
  i=os.path.splitext(os.path.basename(p))[0];shutil.copy2(p,f'{OUT}/assets/avatars/'+os.path.basename(p));AV[i]='assets/avatars/'+os.path.basename(p)
open(f'{OUT}/assets/style.css','w').write(CSS);open(f'{OUT}/.nojekyll','w').close()
# top
cards=''
for c in shown:
  ws=by_c.get(c['id'],[]);av=AV.get(c['id'])
  ph=f'<img class="av" src="@R@{e(av)}" alt="{e(c["name"])}" loading="lazy">' if av else e(c['name'][:1])
  cards+=f'<a class="card" href="@R@c/{e(c["id"])}/"><div class="ph">{ph}</div><div class="m"><span class="t">{e(c["name"])}</span><span class="a">{len(ws)} 作品</span></div></a>'
page('','クリエイター一覧',f'<h1>クリエイター</h1><p class="lead">ひとりずつの作品へ。{len(shown)}人・{len(works)}作品。</p><div class="grid">{cards}</div>')
# creators
for c in shown:
  ws=by_c.get(c['id'],[])
  page(f"c/{c['id']}",c['name'],f'<div class="crumb"><a href="@R@">クリエイター</a>›</div>'+(f'<img class="hav" src="@R@{e(AV[c["id"]])}" alt="">' if c['id'] in AV else '')+f'<h1>{e(c["name"])}</h1><p class="lead">{e(c.get("role",""))}・{len(ws)} 作品</p><div class="grid">'+''.join(wcard(w,series[w['series']]['title']) for w in ws)+'</div>')
# series
sl=sorted(series.values(),key=lambda s:(s.get('order',999),s['id']))
def scard(s):
  f=next((w for w in works if w['series']==s['id'] and w['arts']),None);n=sum(1 for w in works if w['series']==s['id'])
  ph=f'<img src="{e(img(f))}" alt="{e(s["title"])}" loading="lazy">' if f else '✎'
  return f'<a class="card" href="@R@s/{e(s["id"])}/"><div class="ph">{ph}</div><div class="m"><span class="t">{e(s["title"])}</span><span class="a">{e(s.get("blurb",""))}・{n} 作品</span></div></a>'
page('s','シリーズ一覧','<h1>シリーズ</h1><div class="grid">'+''.join(scard(s) for s in sl)+'</div>')
for s in sl:
  ws=[w for w in works if w['series']==s['id']]
  leg=f'<p class="lead" style="font-size:13px">旧ページ: <a href="{e(s["legacy"])}">{e(s["legacy"])}</a>（今後の正はこのハブ）</p>' if s.get('legacy') else ''
  page(f"s/{s['id']}",s['title'],f'<div class="crumb"><a href="@R@s/">シリーズ</a>›</div><h1>{e(s["title"])}</h1><p class="lead">{e(s.get("blurb",""))}</p>{leg}<div class="grid">'+''.join(wcard(w,creators.get(w['creator'],{}).get('name',w.get('authorName',''))) for w in ws)+'</div>')
# works
for w in works:
  d=f"{OUT}/w/{w['series']}/{w['id']}";os.makedirs(d,exist_ok=True)
  for a in w['arts']: shutil.copy2(f"{w['dir']}/{a}",f"{d}/{a}")
  c=creators.get(w['creator'],{});s=series[w['series']]
  arts=''.join(f'<img src="{e(a)}" alt="{e(w["title"])}">' for a in w['arts'])
  page(f"w/{w['series']}/{w['id']}",w['title'],f'<article><div class="crumb"><a href="@R@c/{e(w["creator"])}/">{e(c.get("name",w.get("authorName","")))}</a>›<a href="@R@s/{e(s["id"])}/">{e(s["title"])}</a></div><h1>{e(w["title"])}</h1><p><span class="pill">{e(s["title"])}</span>作者: <a href="@R@c/{e(w["creator"])}/">{e(w.get("authorName") or c.get("name",""))}</a></p><div class="arts">{arts}</div><div class="body">{md(w["body"])}</div></article>')
print(f'creators={len(shown)} series={len(sl)} works={len(works)} kota={"kota" in [c["id"] for c in shown]}')
