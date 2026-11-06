/* 寄り道の机 — isolated, data-driven static prototype. */
(() => {
  'use strict';
  const prototypeLabels = window.YORIMICHI_CONFIG?.showPrototypeLabels !== false;
  document.documentElement.classList.toggle('release',!prototypeLabels);
  if (!prototypeLabels) document.title = document.title.replace(/ — prototype$/i,'');
  const $ = id => document.getElementById(id);
  let items = [], sourceItems = [], time = 0, selected = null, choosing = false, ended = false;
  let ctx = null, master = null;
  const buffers = new Map();
  const soundFiles = ['touch-brush','touch-bubble','touch-knife','touch-signal','touch-page','touch-tap','touch-tap-2','room-loop','leave-one','sona-unputaway'];
  let roomSource = null, roomGain = null, roomTimer = null;
  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -12; comp.ratio.value = 4; comp.attack.value = .003; comp.release.value = .25;
      master = ctx.createGain(); master.gain.value = .8;
      master.connect(comp); comp.connect(ctx.destination);
      for (const name of soundFiles) fetch(`audio/${name}.mp3`).then(r => r.ok ? r.arrayBuffer() : null).then(b => b && ctx.decodeAudioData(b)).then(b => { if (b) buffers.set(name,b); }).catch(() => {});
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }
  document.addEventListener('pointerdown', unlock, {once:true});
  document.addEventListener('keydown', unlock, {once:true});
  function sound(name) {
    unlock(); if (!ctx) return;
    const gain = ctx.createGain(); gain.gain.value = .6; gain.connect(master);
    if (buffers.has(name)) {
      const src = ctx.createBufferSource(); src.buffer = buffers.get(name); src.connect(gain); src.start(); src.onended = () => gain.disconnect();
    } else {
      const now = ctx.currentTime, osc = ctx.createOscillator(); osc.type = 'sine';
      osc.frequency.value = name === 'leave-one' ? 293.66 : name === 'paper-open' ? 587.33 : 440;
      const dur = name === 'leave-one' ? 2.3 : .65;
      gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.09,now+.02);gain.gain.exponentialRampToValueAtTime(.0001,now+dur);
      osc.connect(gain);osc.start();osc.stop(now+dur);osc.onended = () => gain.disconnect();
    }
  }
  function soundFor(item) {
    const thing=item.name;
    if(item.owner==='ソナ' && Number(item.round)===9)return 'sona-unputaway';
    if(item.kind==='note'||/本|栞|原稿|紙|台帳|照合|ルビ|改行|インク/.test(thing))return 'touch-page';
    if(/筆|水/.test(thing))return 'touch-brush';
    if(/泡|マグ|コップ|ユーカリ/.test(thing))return 'touch-bubble';
    if(/ナイフ|刃/.test(thing))return 'touch-knife';
    if(item.owner==='シグナ'||/信号|点滅/.test(thing))return 'touch-signal';
    return seeded(item.id)() < .5 ? 'touch-tap' : 'touch-tap-2';
  }
  function roomFade(active) {
    if(!ctx)return;
    if(!roomSource && buffers.has('room-loop')){
      roomSource=ctx.createBufferSource();roomSource.buffer=buffers.get('room-loop');roomSource.loop=true;
      roomGain=ctx.createGain();roomGain.gain.value=0;roomSource.connect(roomGain);roomGain.connect(master);roomSource.start();
    }
    if(roomGain){const now=ctx.currentTime;roomGain.gain.cancelScheduledValues(now);roomGain.gain.setValueAtTime(roomGain.gain.value,now);roomGain.gain.linearRampToValueAtTime(active?.18:0,now+(ended?.4:.3));}
    clearTimeout(roomTimer);if(active)roomTimer=setTimeout(()=>roomFade(false),340);
  }
  function threshold(item) {
    if (item.at !== undefined) return Math.max(0,Math.min(100,Number(item.at)));
    if (item.kind === 'note') return 50;
    return Number(item.round) <= 7 ? 0 : Number(item.round) === 8 ? 50 : 100;
  }
  function visible(item) {return time >= threshold(item);}
  function setTime(value) {
    time = Math.max(0,Math.min(100,Number(value)));
    $('time').value = time;
    const t = time / 100;
    $('bg1500').style.opacity = 1;
    $('bg1700').style.opacity = Math.min(1,t*2);
    $('bg1800').style.opacity = Math.max(0,t*2-1);
    const label = time < 50 ? '15:00' : time < 100 ? '夕方' : '帰りじたく';
    $('time').setAttribute('aria-valuetext',label);
    $('timeCaption').textContent = `${label} / ${ended ? 'ひとつだけ、残った' : 'まだ、寄り道の途中'}`;
    for (const item of items) {
      const el = item.el, show = visible(item);
      el.classList.toggle('available',show); el.disabled = !show || ended;
      el.setAttribute('aria-hidden',String(!show || (ended && selected !== item)));
      el.tabIndex = show && (!ended || item === selected) ? 0 : -1;
    }
    if (selected && !visible(selected)) closeReading();
    if (time < 100) choosing = false;
    $('leave').hidden = time < 100 || ended;
    $('leave').textContent = choosing ? '机のものを、ひとつ選ぶ' : 'ひとつだけ置いて帰る ↗';
    $('count').textContent = ended ? '1 / 残すもの' : `${items.filter(visible).length} / 置かれたもの`;
    updateStatus();
  }
  function updateStatus() {
    $('status').textContent = ended ? '今日は、ここまで。' : choosing ? '残したいものに、触れてください。' : time === 100 ? '帰る前に、ひとつだけ。' : '音は、最初に触れたときから。';
  }
  function closeReading() {
    selected = null; $('empty').hidden = false; $('reading').hidden = true;
    $('reader').classList.remove('paper');
    items.forEach(i => {i.el.classList.remove('active','open');i.el.setAttribute('aria-pressed','false');});
  }
  function read(item, play = true) {
    selected = item; $('empty').hidden = true; $('reading').hidden = false;
    $('byline').textContent = `${item.owner} / ${item.name}`;
    $('line').textContent = item.line;
    $('reader').classList.toggle('paper',item.kind === 'note');
    items.forEach(i => {i.el.classList.toggle('active',i === item);i.el.classList.toggle('open',i === item && i.kind === 'note');i.el.setAttribute('aria-pressed',String(i === item));});
    if (play) sound(soundFor(item));
  }
  function leave(item) {
    ended = true; choosing = false;
    read(item,false); $('desk').classList.add('ended');
    item.el.classList.add('kept'); $('time').disabled = true;
    $('again').hidden = false; setTime(100); layout(); roomFade(false);sound('leave-one');
    $('again').focus({preventScroll:true});
  }
  // FNV-1a string hash + Mulberry32: each item gets its own deterministic stream.
  function seeded(id) {
    let h = 2166136261;
    for (const ch of String(id)) {h ^= ch.codePointAt(0);h = Math.imul(h,16777619);}
    return () => {let t = h += 0x6D2B79F5;t = Math.imul(t ^ t >>> 15,t | 1);t ^= t + Math.imul(t ^ t >>> 7,t | 61);return ((t ^ t >>> 14) >>> 0)/4294967296;};
  }
  function layout() {
    const desk = $('desk'), w = desk.clientWidth, mobile = w < 600;
    const dense = items.length > 12;
    desk.classList.toggle('dense',dense);
    const bw = dense ? (mobile ? 44 : 60) : (mobile ? 88 : 104);
    const bh = dense ? (mobile ? 48 : 64) : (mobile ? 96 : 112);
    const cols = Math.max(1,Math.floor((w-16)/(dense ? (mobile ? 56 : 84) : bw+20)));
    const rows = Math.max(1,Math.ceil(items.length/cols));
    const step = dense ? (mobile ? 56 : 80) : bh+24;
    const h = Math.max(mobile ? 330 : 342,rows*step+16);
    desk.style.height = `${h}px`;
    const pad = 8, gap = dense ? 3 : 6;
    const cellW = (w-2*pad)/cols, cellH = (h-2*pad)/rows;
    const slots = [], occupied = [], placed = [];
    for(let row=0;row<rows;row++) for(let col=0;col<cols;col++) slots.push({row,col});
    const overlaps = p => occupied.some(q => p.x < q.x+bw+gap && p.x+bw+gap > q.x && p.y < q.y+bh+gap && p.y+bh+gap > q.y);
    for (const item of items) {
      const rand = seeded(item.id);
      const angle = (rand()*32-16).toFixed(3);
      item.el.style.setProperty('--angle',`${angle}deg`);
      // Reserve an invisible safety box including its on-demand label; artwork rotates inside.
      let p = Number.isFinite(item.x)&&Number.isFinite(item.y) ? {x:Math.max(pad,Math.min(w-bw-pad,item.x*w-bw/2)),y:Math.max(pad,Math.min(h-bh-pad,item.y*h-bh/2))} : null;
      if (!p || overlaps(p)) {
        const candidates = slots.map((slot,index) => ({slot,index,rank:rand()}));
        // Folded papers favour the edge, without forcing other items into visual rows.
        if(item.kind==='note') candidates.forEach(c=>{if(c.slot.col===cols-1||c.slot.row===rows-1)c.rank-=2;});
        candidates.sort((a,b)=>a.rank-b.rank);
        p=null;
        for (const {slot} of candidates) {
          const slackX=Math.max(0,cellW-bw-gap),slackY=Math.max(0,cellH-bh-gap);
          const point={x:pad+slot.col*cellW+(cellW-bw)/2+(rand()-.5)*slackX,y:pad+slot.row*cellH+(cellH-bh)/2+(rand()-.5)*slackY};
          if(!overlaps(point)){p=point;break;}
        }
      }
      if(!p) {
        // Arbitrary explicit coordinates may consume several cells: retry safely without them.
        // This deterministic second pass never loses or overlays a newly appended fragment.
        const coordinates=items.map(i=>[i.x,i.y]);items.forEach(i=>{delete i.x;delete i.y;});
        layout();items.forEach((i,n)=>{[i.x,i.y]=coordinates[n];});return;
      }
      occupied.push(p);placed.push({item,p,rand:seeded(item.id+':wander')});item.el.style.left=`${p.x.toFixed(3)}px`;item.el.style.top=`${p.y.toFixed(3)}px`;
    }
    // Relax the invisible cells into a natural tabletop arrangement. Every candidate move
    // is collision-checked, so this is not independent unbounded visual jitter.
    for(let pass=0;pass<100;pass++) for(const {item,p,rand} of placed) {
      if(Number.isFinite(item.x)&&Number.isFinite(item.y)) continue;
      const reach=mobile?24:42;
      const q={x:Math.max(pad,Math.min(w-bw-pad,p.x+(rand()-.5)*reach)),y:Math.max(pad,Math.min(h-bh-pad,p.y+(rand()-.5)*reach))};
      if(!occupied.some(other=>other!==p&&q.x<other.x+bw+gap&&q.x+bw+gap>other.x&&q.y<other.y+bh+gap&&q.y+bh+gap>other.y)){p.x=q.x;p.y=q.y;}
    }
    for(const {item,p} of placed){item.el.style.left=`${p.x.toFixed(3)}px`;item.el.style.top=`${p.y.toFixed(3)}px`;}
    if (ended && selected) {selected.el.style.left=`${(w-bw)/2}px`;selected.el.style.top=`${(h-bh)/2}px`;}
  }
  // Only the closest object in a small halo reveals its label on pointer approach.
  $('desk').addEventListener('pointermove',e=>{
    if(e.pointerType==='touch')return;
    let nearest=null,best=18;
    for(const item of items){
      if(!visible(item)||(ended&&item!==selected))continue;
      const r=item.el.getBoundingClientRect();
      const d=Math.hypot(Math.max(r.left-e.clientX,0,e.clientX-r.right),Math.max(r.top-e.clientY,0,e.clientY-r.bottom));
      if(d<best){best=d;nearest=item;}
    }
    items.forEach(i=>i.el.classList.toggle('near',i===nearest));
  });
  $('desk').addEventListener('pointerleave',()=>items.forEach(i=>i.el.classList.remove('near')));
  $('time').addEventListener('input',e => {if(!ended){setTime(e.target.value);unlock();roomFade(true);}});
  $('leave').addEventListener('click',() => {choosing=true;setTime(100);});
  $('again').addEventListener('click',() => {
    ended=false;choosing=false;$('desk').classList.remove('ended');items.forEach(i=>i.el.classList.remove('kept'));
    $('time').disabled=false;$('again').hidden=true;closeReading();setTime(0);layout();$('time').focus({preventScroll:true});
  });
  window.addEventListener('resize',layout);
  Promise.all([fetch('art/manifest.json').then(r=>r.json()),fetch('data/items.json').then(r => {if(!r.ok)throw new Error('items.json could not be loaded');return r.json();})]).then(([manifest,data]) => {
    const list = Array.isArray(data) ? data : data.items;
    if (!Array.isArray(list)) throw new Error('items must be an array');
    sourceItems = list;
    const ids = new Set();
    items = list.map((source,n) => {
      const id = source.id || `item-${String(n+1).padStart(3,'0')}`;
      const row = typeof source.text === 'string' ? {...source,id,owner:source.name,name:source.thing,line:source.text,kind:source.kind||'object',art:source.art || (source.kind==='note'?'art/props/memo-folded.png':(manifest.find(m=>m.id===id)?.art||'art/props/memo-folded.png'))} : {...source,id};
      if (!row.id || ids.has(row.id) || typeof row.line!=='string' || typeof row.owner!=='string' || typeof row.name!=='string') throw new Error(`Invalid item at ${n}`);
      ids.add(row.id);
      const item = {...row}, el = document.createElement('button');item.el=el;
      el.className=`item ${item.kind === 'note' ? 'note' : ''}`;el.dataset.id=item.id;
      el.setAttribute('aria-label',`${item.owner} / ${item.name}${item.kind === 'note' ? ' / 紙を開く' : ''}`);el.setAttribute('aria-pressed','false');
      const img=document.createElement('img');img.src=item.art || (item.kind==='note'?'art/props/memo-folded.png':'art/props/memo-folded.png');img.alt='';img.draggable=false;
      img.addEventListener('error',()=>{if(!img.dataset.fallback){img.dataset.fallback='1';img.src='art/props/memo-folded.png';}});
      const owner=document.createElement('span');owner.className='owner';owner.textContent=item.owner;
      el.append(img,owner);el.addEventListener('click',()=>{if(ended || !visible(item))return;if(choosing)leave(item);else read(item);});
      $('objects').append(el);return item;
    });
    layout();setTime(0);
    window.__yorimichi = {get sourceItems(){return sourceItems;},get items(){return items.map(({el,...rest})=>rest);},get time(){return time;},get ended(){return ended;},get selected(){return selected?.id;},get audioState(){return ctx?.state||'locked';},get audioFiles(){return [...buffers.keys()];},ready:true};
  }).catch(e=>{$('status').textContent='机のデータを読み込めませんでした。';console.error(e);});
})();
