'use strict';
(() => {
  const cfg = window.AFTERIMAGE_CONFIG;
  const field = document.querySelector('#field'), canvas = document.querySelector('#light');
  const ctx = canvas.getContext('2d'), guide = document.querySelector('#guide');
  const line = document.querySelector('#line'), sleep = document.querySelector('#sleep');
  const choices = document.querySelector('#choices');
  const state = { mode: 'explore', data: [], opened: [], selected: null, next: 0,
    width: 0, height: 0, assets: {}, decoded: {}, audioLog: [], wipe: null,
    artLoaded: [], fallbackArt: [], maxVoices: 0, ready: false };
  window.afterimage = state;
  let audio, master, compressor, buffers = {}, active = [], lastTap = -1, loadAudio;
  const stamp = performance.now.bind(performance);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function unlock() {
    if (!audio) {
      audio = new AudioContext();
      master = audio.createGain(); master.gain.value = .8;
      compressor = audio.createDynamicsCompressor();
      Object.assign(compressor.threshold, { value: -12 }); compressor.ratio.value = 4;
      compressor.attack.value = .003; compressor.release.value = .25;
      master.connect(compressor); compressor.connect(audio.destination);
      loadAudio = Promise.all([...cfg.taps, cfg.sleep].map(async path => {
        const response = await fetch(path);
        if (!response.ok) { state.decoded[path] = false; return; }
        try { buffers[path] = await audio.decodeAudioData(await response.arrayBuffer());
          state.decoded[path] = { duration: buffers[path].duration, channels: buffers[path].numberOfChannels };
        } catch { state.decoded[path] = false; }
      }));
    }
    audio.resume();
    return loadAudio;
  }
  document.addEventListener('pointerdown', unlock, { once: true });
  function stopVoice(voice) {
    const now = audio.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setTargetAtTime(.0001, now, .012);
    try { voice.source.stop(now + .05); } catch { /* Already ended. */ }
  }
  async function sound(closing = false) {
    await unlock();
    if (!closing && state.mode === 'sleep') return;
    if (closing) { active.forEach(stopVoice); active = []; }
    let index = Math.floor(Math.random() * (cfg.taps.length - 1));
    if (index >= lastTap) index++;
    if (lastTap < 0) index = Math.floor(Math.random() * cfg.taps.length);
    if (!closing) lastTap = index;
    const path = closing ? cfg.sleep : cfg.taps[index];
    const rate = closing ? 1 : .97 + Math.random() * .06;
    if (active.length >= 6) { const oldest = active.shift(); oldest.source.stop(); }
    const gain = audio.createGain(); gain.connect(master);
    let source;
    if (buffers[path]) { source = audio.createBufferSource(); source.buffer = buffers[path]; source.playbackRate.value = rate; }
    else {
      const length = closing ? 2.5 : .75, sampleRate = audio.sampleRate;
      const b = audio.createBuffer(1, Math.ceil(sampleRate * length), sampleRate);
      const values = b.getChannelData(0);
      for (let i = 0; i < values.length; i++) { const t = i / sampleRate;
        values[i] = .05 * Math.sin(2 * Math.PI * (closing ? 293.66 : 493.88) * t) * Math.min(1,t/.04) * Math.exp(-t*5); }
      source = audio.createBufferSource(); source.buffer = b; source.playbackRate.value = rate;
    }
    source.connect(gain);
    const voice = { source, gain }; active.push(voice);
    state.maxVoices = Math.max(state.maxVoices, active.length);
    source.onended = () => { active = active.filter(v => v !== voice); source.disconnect(); gain.disconnect(); };
    source.start();
    state.audioLog.push({ path, rate, closing, buffered: !!buffers[path] });
  }
  function image(path) { return new Promise(resolve => { const im = new Image(); im.onload = () => resolve(im); im.onerror = () => resolve(null); im.src = path; }); }
  function color(item) { return /^#[0-9A-Fa-f]{6}$/.test(item.color) ? item.color : cfg.colors[item.color] || cfg.fallbackColor; }
  async function art(item) {
    if (item.shape === '余白') return null;
    const name = cfg.colorArt[item.color] || cfg.shapes[item.shape];
    if (!name) return null;
    let im = await image(`art-in/${name}-white.png`);
    if (!im) im = await image(`art/${name}-white.png`);
    if (!im) { state.fallbackArt.push(name); return null; }
    const tile = document.createElement('canvas'); tile.width = tile.height = 384;
    const paint = tile.getContext('2d'); paint.drawImage(im,0,0,384,384);
    paint.globalCompositeOperation = 'source-in'; paint.fillStyle = color(item); paint.fillRect(0,0,384,384);
    state.artLoaded.push(name); return tile;
  }
  function layout() {
    const rect = field.getBoundingClientRect();
    state.width = rect.width; state.height = rect.height;
    const dpr = Math.min(devicePixelRatio || 1,2);
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    const n = Math.max(1,state.data.length);
    const cols = Math.max(1, Math.ceil(Math.sqrt(n * rect.width / rect.height)));
    const rows = Math.ceil(n/cols), cellW = rect.width/cols, cellH = rect.height/rows;
    state.slots = state.data.map((_,i) => ({ x: (i%cols+.5)*cellW, y: (Math.floor(i/cols)+.5)*cellH,
      size: Math.min(cellW,cellH)*.82 }));
    positionChoices();
  }
  function positionChoices() {
    for (const button of choices.children) {
      const item = state.opened.find(x => x.index === Number(button.dataset.index));
      const p = state.slots[item.slot];
      const size = Math.max(44, p.size);
      Object.assign(button.style,{left:`${p.x-size/2}px`,top:`${p.y-size/2}px`,width:`${size}px`,height:`${size}px`});
    }
  }
  function fallback(p,item) {
    const s=p.size, c=color(item); ctx.strokeStyle=c; ctx.fillStyle=c; ctx.lineWidth=1.5;
    ctx.shadowColor=c; ctx.shadowBlur=10;
    ctx.beginPath();
    switch(item.shape) {
      case '輪': ctx.ellipse(0,0,s*.28,s*.31,-.15,0,Math.PI*2); ctx.stroke(); break;
      case '帯': ctx.fillRect(-s*.36,-s*.015,s*.72,s*.03); break;
      case '線': ctx.moveTo(-s*.32,3); ctx.quadraticCurveTo(0,-6,s*.32,0); ctx.stroke(); break;
      case 'にじみ': { const g=ctx.createRadialGradient(0,0,0,0,0,s*.35); g.addColorStop(0,c);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(-s/2,-s/2,s,s);break; }
      default: ctx.arc(0,0,s*.06,0,Math.PI*2); ctx.fill();
    }
    ctx.shadowBlur=0;
  }
  function render(now) {
    const {width:w,height:h}=state; ctx.clearRect(0,0,w,h);
    for (const opened of state.opened) {
      const item=state.data[opened.index];
      if (item.shape==='余白') continue;
      if (state.mode==='sleep' && opened.index!==state.selected) continue;
      let p=state.slots[opened.slot], opacity;
      const age=(now-opened.time)/1000;
      if (state.mode==='sleep') {p={x:w/2,y:h/2,size:Math.min(w,h)*.56};opacity=.5;}
      else if (state.mode==='choose') opacity=state.selected===opened.index ? .8 : .38;
      else { const rise=Math.min(1,age/.5); opacity=(cfg.traceOpacity+.65*Math.exp(-age/cfg.fadeSeconds))*rise*opened.strength; }
      ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=opacity;
      ctx.translate(p.x,p.y);
      const pulse=reduced ? 1 : 1+Math.sin(now/1600+opened.index)*.018;
      ctx.scale(pulse,pulse);
      if (state.assets[opened.index]) ctx.drawImage(state.assets[opened.index],-p.size/2,-p.size/2,p.size,p.size);
      else fallback(p,item);
      ctx.restore();
    }
    requestAnimationFrame(render);
  }
  function reveal(event) {
    if (!state.ready || state.mode!=='explore') return;
    const index=state.next++%state.data.length;
    const rect=field.getBoundingClientRect();
    const tap={x:event.clientX ? event.clientX-rect.left : rect.width/2,y:event.clientY ? event.clientY-rect.top : rect.height/2};
    let opened=state.opened.find(x=>x.index===index);
    if (!opened) {
      const used=new Set(state.opened.map(x=>x.slot));
      const slots=state.slots.map((p,i)=>({i,dist:(p.x-tap.x)**2+(p.y-tap.y)**2})).filter(x=>!used.has(x.i)).sort((a,b)=>a.dist-b.dist);
      opened={index,slot:slots[0].i,time:stamp(),strength:1};state.opened.push(opened);
    } else { opened.time=stamp();opened.strength=1; }
    if (state.data[index].shape==='余白') {
      let affected=0;
      for (const other of state.opened) {
        if (other===opened) continue;
        const p=state.slots[other.slot],distance=Math.hypot(p.x-tap.x,p.y-tap.y);
        const attenuation=1-.88*Math.exp(-(distance**2)/(2*(Math.min(rect.width,rect.height)*.42)**2));
        other.strength*=attenuation;if(attenuation<.9) affected++;
      }
      state.wipe={x:tap.x,y:tap.y,affected};
    }
    line.textContent=state.data[index].line;
    guide.style.opacity=0;sleep.hidden=false;
    sound();
  }
  field.addEventListener('pointerdown',event=> { if (event.target.closest('.choice')) return; reveal(event); });
  field.addEventListener('keydown',event=> { if (event.target!==field) return; if(event.key==='Enter'||event.key===' ') {event.preventDefault();reveal(event);} });
  sleep.addEventListener('click',()=> {
    unlock();
    if(state.mode==='explore') {
      state.mode='choose';document.body.dataset.mode='choose';
      field.removeAttribute('role');field.removeAttribute('tabindex');
      line.textContent='';sleep.disabled=true;
      for(const opened of state.opened) {
        const button=document.createElement('button');button.className='choice';button.type='button';button.dataset.index=opened.index;
        button.setAttribute('aria-label',state.data[opened.index].line);button.setAttribute('aria-pressed','false');
        button.addEventListener('click',()=> {
          state.selected=opened.index;line.textContent=state.data[opened.index].line;
          for(const b of choices.children)b.setAttribute('aria-pressed',String(b===button));
          sleep.disabled=false;
        });choices.append(button);
      }
      positionChoices();choices.firstElementChild?.focus({preventScroll:true});
    } else if(state.mode==='choose' && state.selected!==null) {
      state.mode='sleep';document.body.dataset.mode='sleep';document.body.dataset.restShape=state.data[state.selected].shape;choices.replaceChildren();sleep.hidden=true;
      field.removeAttribute('aria-label');sound(true);layout();
    }
  });
  window.addEventListener('resize',layout);
  (async()=> {
    const response=await fetch('data/colors.json',{cache:'no-store'});state.data=await response.json();
    const bg=await image(cfg.background);
    if(bg) {document.querySelector('#night').style.setProperty('--night-art',`url("${cfg.background}")`);state.background=cfg.background;}
    await Promise.all(state.data.map(async(item,i)=> {state.assets[i]=await art(item);}));
    state.ready=state.data.length>0;layout();requestAnimationFrame(render);
  })();
})();
