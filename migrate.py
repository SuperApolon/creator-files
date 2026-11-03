# one-shot migration from original river folders (read-only on sources)
import json,os,re,shutil
R='/workspace/orrery/river'
inv=json.load(open('INVENTORY.json'))
srcdir={'healing-forest':'arts','taki-wai':'arts','fashion-atelier':'arts','suberanai-hanashi':'stories','rojiura-isekai':'stories','wanted-lunch':'meta'}
blurb={'healing-forest':'息を整えるための森を、みんなで一枚ずつ。','taki-wai':'滝の前で、ワーイと叫ぶ自分を描く。','fashion-atelier':'ひとりひとりの、着てみたい一着。','suberanai-hanashi':'各自が持ち寄った、すべらない話。','rojiura-isekai':'晴れた日の路地裏は異世界だった。','wanted-lunch':'いま食べたいランチを、一皿ずつ。'}
names={}
for o,s in enumerate(inv,1):
  sid=s['id'];src=s['source']
  json.dump({'id':sid,'title':s['title'],'type':s['type'],'blurb':blurb[sid],'order':o,'date':'2026-11-03','legacy':s['live']},open(f'series/{sid}.json','w'),ensure_ascii=False,indent=1)
  for m in s['members']:
    i=m['id'];d=f'works/{sid}/{i}';os.makedirs(d,exist_ok=True)
    md=open(f"{src}/{srcdir[sid]}/{i}.md").read()
    L=md.strip().split('\n');title=L[0].lstrip('# ').strip();author='';rest=[]
    for l in L[1:]:
      if l.startswith('作者:') and not author: author=l.split(':',1)[1].strip()
      else: rest.append(l)
    body='\n'.join(rest).strip()+'\n'
    names.setdefault(i,author)
    open(f'{d}/body.md','w').write(body)
    imgs=[f"{src}/arts/{i}.{e}" for e in ('png','jpg','webp') if os.path.exists(f"{src}/arts/{i}.{e}")]
    if sid!='fashion-atelier': imgs=imgs[:1]
    for n,p in enumerate(imgs):
      ext=p.rsplit('.',1)[1];shutil.copy2(p,f"{d}/art.{ext}" if n==0 else f"{d}/art-{n+1}.{ext}")
    json.dump({'id':i,'series':sid,'title':title,'authorName':author,'type':s['type']},open(f'{d}/work.json','w'),ensure_ascii=False,indent=1)
order='towa setsuna superapolon cloud choco harbor tetra toria zex mouse shiori featherio mira lux alice sona kanata signa wizcraft kota'.split()
for o,i in enumerate(order,1):
  json.dump({'id':i,'name':names.get(i,i),'role':'オーナー' if i=='kota' else 'ORRERY クリエイター','order':o},open(f'creators/{i}.json','w'),ensure_ascii=False,indent=1)
print(names)
