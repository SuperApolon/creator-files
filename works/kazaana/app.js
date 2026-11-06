/* 風穴 KAZAANA — vanilla, no CDN
 * Assets: art/sky-{wide,tall}.jpg · audio/wind-open{,-2,-3}.mp3 · audio/sky-full.mp3 · lines.json
 */
(() => {
  'use strict';

  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d', { alpha: false });
  const hintEl = document.getElementById('hint');
  const countEl = document.getElementById('count');
  const finaleEl = document.getElementById('finale');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Unified JP sans stack — avoid mincho fallback mix (small kana vs kanji size mismatch)
  const FONT_STACK = '"Noto Sans CJK JP","Noto Sans JP","Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic","YuGothic",Meiryo,system-ui,sans-serif';
  const FONT_MEMBER = `600 10px ${FONT_STACK}`;
  const FONT_TEXT = `12.5px ${FONT_STACK}`;
  let resolvedFont = '';

  let W = 0, H = 0, dpr = 1;
  let lines = [];
  let nextLine = 0;
  let holes = [];
  let crumbs = [];
  let chunks = [];
  let floaters = [];
  let wallTexts = [];
  let shake = 0, wallFlex = 0;
  let collapsed = false, collapsing = false, collapseT = 0;
  let lastT = 0;
  let skyImg = null, skyTall = null, skyWide = null;
  let portrait = true;
  let audio = null;
  let wallOff = null, wallOffCtx = null;

  // ——— Audio ———
  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.winds = [];       // decoded AudioBuffers
      this.fullBuf = null;
      this.lastWindIdx = -1;
      this.activeWinds = []; // {src, gain, stopAt}
      this._noise = null;
      this.fileOk = { wind: false, full: false };
      this.loadPromise = null;
    }
    unlock() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this._prepNoise();
        this.loadPromise = this._loadFiles();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    }
    _prepNoise() {
      const len = this.ctx.sampleRate * 2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this._noise = buf;
    }
    async _loadFiles() {
      const loaded = [];
      // Prefer prefetched bytes (may still be filling)
      const windAbs = (typeof audioPrefetch !== 'undefined' && audioPrefetch.winds.length)
        ? audioPrefetch.winds
        : null;
      if (windAbs) {
        for (const ab of windAbs) {
          try { loaded.push(await this.ctx.decodeAudioData(ab.slice(0))); }
          catch (_) {}
        }
      }
      if (!loaded.length) {
        for (const u of ['audio/wind-open.mp3','audio/wind-open-2.mp3','audio/wind-open-3.mp3']) {
          try {
            const res = await fetch(u);
            if (!res.ok) continue;
            loaded.push(await this.ctx.decodeAudioData((await res.arrayBuffer()).slice(0)));
          } catch (_) {}
        }
      }
      if (loaded.length) { this.winds = loaded; this.fileOk.wind = true; }
      try {
        let ab = (typeof audioPrefetch !== 'undefined') ? audioPrefetch.full : null;
        if (!ab) {
          const res = await fetch('audio/sky-full.mp3');
          if (res.ok) ab = await res.arrayBuffer();
        }
        if (ab) {
          this.fullBuf = await this.ctx.decodeAudioData(ab.slice(0));
          this.fileOk.full = true;
        }
      } catch (_) {}
    }
    async ensureLoaded() {
      if (this.loadPromise) await this.loadPromise;
    }
    playOpen() {
      if (!this.ctx) return;
      // kick load if needed; prefer files when ready, else synth
      if (this.fileOk.wind && this.winds.length) this._playWindFile();
      else if (this.loadPromise) {
        // files may still be decoding — synth now so first tap always has sound
        this._synthWind(0.9, 0.75, false);
        this.loadPromise.then(() => { /* next taps use files */ });
      } else {
        this._synthWind(0.9, 0.75, false);
      }
    }
    playFull() {
      if (!this.ctx) return;
      this._fadeWinds(0.3);
      if (this.fileOk.full && this.fullBuf) this._playBuf(this.fullBuf, 0.95);
      else this._synthWind(2.8, 1.0, true);
    }
    _playWindFile() {
      // prune finished
      const now = this.ctx.currentTime;
      this.activeWinds = this.activeWinds.filter((w) => w.stopAt > now);
      if (this.activeWinds.length >= 3) {
        // stop oldest
        const old = this.activeWinds.shift();
        try { old.gain.gain.cancelScheduledValues(now); old.gain.gain.setValueAtTime(old.gain.gain.value, now); old.gain.gain.linearRampToValueAtTime(0.0001, now + 0.08); old.src.stop(now + 0.1); } catch (_) {}
      }
      let idx = (Math.random() * this.winds.length) | 0;
      if (this.winds.length > 1 && idx === this.lastWindIdx) {
        idx = (idx + 1 + ((Math.random() * (this.winds.length - 1)) | 0)) % this.winds.length;
      }
      this.lastWindIdx = idx;
      const buf = this.winds[idx];
      const src = this.ctx.createBufferSource();
      const g = this.ctx.createGain();
      src.buffer = buf;
      src.playbackRate.value = 0.95 + Math.random() * 0.10;
      const gain = 0.7 + Math.random() * 0.1;
      g.gain.value = gain;
      src.connect(g); g.connect(this.ctx.destination);
      const dur = buf.duration / src.playbackRate.value;
      src.start();
      this.activeWinds.push({ src, gain: g, stopAt: now + dur + 0.05 });
    }
    _fadeWinds(sec) {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      for (const w of this.activeWinds) {
        try {
          const v = w.gain.gain.value;
          w.gain.gain.cancelScheduledValues(now);
          w.gain.gain.setValueAtTime(v, now);
          w.gain.gain.linearRampToValueAtTime(0.0001, now + sec);
          w.src.stop(now + sec + 0.05);
        } catch (_) {}
      }
      this.activeWinds = [];
    }
    _playBuf(buf, gain) {
      const s = this.ctx.createBufferSource();
      const g = this.ctx.createGain();
      s.buffer = buf;
      g.gain.value = gain;
      s.connect(g); g.connect(this.ctx.destination);
      s.start();
    }
    _synthWind(dur, intensity, big) {
      const c = this.ctx, now = c.currentTime;
      const src = c.createBufferSource();
      src.buffer = this._noise; src.loop = true;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = big ? 420 : 700;
      bp.Q.value = big ? 0.55 : 0.9;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = big ? 1800 : 2400;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.22 * intensity, now + 0.04);
      g.gain.exponentialRampToValueAtTime(0.12 * intensity, now + dur * 0.35);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      bp.frequency.setValueAtTime(big ? 280 : 500, now);
      bp.frequency.exponentialRampToValueAtTime(big ? 900 : 1400, now + dur * 0.45);
      bp.frequency.exponentialRampToValueAtTime(big ? 350 : 600, now + dur);
      src.connect(bp); bp.connect(lp); lp.connect(g); g.connect(c.destination);
      src.start(now); src.stop(now + dur + 0.05);
      if (big) {
        const osc = c.createOscillator();
        const og = c.createGain();
        osc.type = 'sine'; osc.frequency.value = 55;
        og.gain.setValueAtTime(0.0001, now);
        og.gain.exponentialRampToValueAtTime(0.08, now + 0.08);
        og.gain.exponentialRampToValueAtTime(0.0001, now + dur * 0.9);
        osc.connect(og); og.connect(c.destination);
        osc.start(now); osc.stop(now + dur);
      }
    }
    get state() { return this.ctx ? this.ctx.state : 'none'; }
  }
  audio = new AudioEngine();

  // ——— Sky (jpg preferred; orientation) ———
  function isPortrait() {
    try {
      if (window.matchMedia) {
        const mq = matchMedia('(orientation: portrait)');
        if (mq && typeof mq.matches === 'boolean') return mq.matches;
      }
    } catch (_) {}
    return W <= H;
  }

  function loadImg(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  async function exists(url) {
    try {
      const r = await fetch(url, { method: 'HEAD', cache: 'force-cache' });
      return r.ok;
    } catch (_) { return false; }
  }
  async function loadIfPresent(url) {
    if (!(await exists(url))) return null;
    return loadImg(url);
  }
  async function probeSky() {
    // Prefer jpg (weight). Only request URLs that exist — avoids console 404.
    const [wideJpg, tallJpg] = await Promise.all([
      loadIfPresent('art/sky-wide.jpg'),
      loadIfPresent('art/sky-tall.jpg'),
    ]);
    let wide = wideJpg, tall = tallJpg;
    if (!wide) wide = await loadIfPresent('art/sky-wide.png');
    if (!tall) tall = await loadIfPresent('art/sky-tall.png');
    if (!wide && !tall) {
      const g = (await loadIfPresent('art/sky.jpg')) || (await loadIfPresent('art/sky.png'));
      wide = tall = g;
    }
    skyWide = wide;
    skyTall = tall;
    pickSkyForOrientation();
  }

  function pickSkyForOrientation() {
    portrait = isPortrait();
    skyImg = portrait ? (skyTall || skyWide) : (skyWide || skyTall);
  }

  // ——— Wall noise ———
  const NOISE_POOL = [
    '既読', '通知', '締切', '未読 99+', '返信待ち', '既読スルー',
    'スクロール', 'いいね', 'フォロー', 'バズ', 'トレンド',
    '会議 15:00', 'TODO', 'WIP', 'レビュー依頼', '承認待ち',
    '電池残量', '通信制限', 'アップデート', '同意する',
    '閉じる', 'スキップ', '広告', '続きを読む', 'あとで見る',
    '……', '通知オン', 'リマインダー', '期限切れ',
  ];
  function seedWallTexts() {
    wallTexts = [];
    const n = Math.max(14, Math.floor((W * H) / 38000));
    for (let i = 0; i < n; i++) {
      wallTexts.push({
        text: NOISE_POOL[(Math.random() * NOISE_POOL.length) | 0],
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() * 0.35 + 0.08) * (Math.random() < 0.5 ? -1 : 1),
        life: Math.random(),
        size: 11 + Math.random() * 9,
        a: 0.04 + Math.random() * 0.1,
      });
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pickSkyForOrientation();
    if (!wallTexts.length) seedWallTexts();
    if ((collapsed || collapsing) && floaters.length) {
      layoutFloaters();
      for (const f of floaters) { f.x = f.tx; f.y = f.ty; f.settled = true; }
    }
  }
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(resize, 60));

  // ——— Draw helpers ———
  function drawProceduralSky(g) {
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#6eb6e8');
    grd.addColorStop(0.35, '#8ec8ef');
    grd.addColorStop(0.7, '#b7daf5');
    grd.addColorStop(1, '#d9ebf8');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
    const sx = W * 0.72, sy = H * 0.18;
    const sun = g.createRadialGradient(sx, sy, 0, sx, sy, Math.min(W, H) * 0.35);
    sun.addColorStop(0, 'rgba(255,250,230,0.85)');
    sun.addColorStop(0.25, 'rgba(255,240,200,0.35)');
    sun.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = sun;
    g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,0.55)';
    cloud(g, W * 0.2, H * 0.28, 60);
    cloud(g, W * 0.55, H * 0.42, 80);
    cloud(g, W * 0.78, H * 0.22, 50);
  }
  function cloud(g, x, y, r) {
    g.beginPath();
    g.arc(x, y, r * 0.55, 0, Math.PI * 2);
    g.arc(x + r * 0.55, y - r * 0.15, r * 0.45, 0, Math.PI * 2);
    g.arc(x + r * 1.05, y, r * 0.6, 0, Math.PI * 2);
    g.arc(x + r * 0.5, y + r * 0.2, r * 0.5, 0, Math.PI * 2);
    g.fill();
  }
  function drawSky(g) {
    if (skyImg && skyImg.complete && skyImg.naturalWidth) {
      const iw = skyImg.naturalWidth, ih = skyImg.naturalHeight;
      const scale = Math.max(W / iw, H / ih);
      const dw = iw * scale, dh = ih * scale;
      g.drawImage(skyImg, (W - dw) / 2, (H - dh) / 2, dw, dh);
    } else {
      drawProceduralSky(g);
    }
  }

  function drawWallBase(g, flex) {
    const grd = g.createLinearGradient(0, 0, W, H);
    grd.addColorStop(0, '#6a6e74');
    grd.addColorStop(0.45, '#5e6268');
    grd.addColorStop(1, '#54585e');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,0.03)';
    for (let i = 0; i < 40; i++) g.fillRect((i * 97) % W, (i * 53) % H, 2 + (i % 3), 1 + (i % 2));
    g.fillStyle = 'rgba(0,0,0,0.04)';
    for (let i = 0; i < 30; i++) g.fillRect((i * 131) % W, (i * 79) % H, 3, 2);
    if (flex > 0.001) {
      const shade = g.createLinearGradient(0, 0, W, 0);
      const mid = 0.5 + Math.sin(flex * 6) * 0.02 * flex;
      shade.addColorStop(0, `rgba(0,0,0,${0.06 * flex})`);
      shade.addColorStop(mid, 'rgba(0,0,0,0)');
      shade.addColorStop(1, `rgba(0,0,0,${0.05 * flex})`);
      g.fillStyle = shade;
      g.fillRect(0, 0, W, H);
    }
    g.save();
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    for (const t of wallTexts) {
      g.globalAlpha = t.a * (0.5 + 0.5 * Math.sin(t.life * Math.PI * 2));
      g.font = `${t.size}px system-ui,sans-serif`;
      g.fillStyle = '#d0d2d6';
      g.fillText(t.text, t.x, t.y);
    }
    g.restore();
  }

  function punchHoles(g) {
    g.save();
    g.globalCompositeOperation = 'destination-out';
    for (const h of holes) {
      if (h.r <= 0.5) continue;
      g.beginPath();
      g.arc(h.x, h.y, h.r, 0, Math.PI * 2);
      g.fill();
      for (let i = 0; i < 4; i++) {
        g.globalAlpha = 0.18;
        g.beginPath();
        g.arc(h.x, h.y, h.r + i * 2.2, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    }
    g.restore();
  }

  function drawHoleGlow(g) {
    for (const h of holes) {
      if (h.r < 1) continue;
      const glow = g.createRadialGradient(h.x, h.y, h.r * 0.7, h.x, h.y, h.r * 1.55);
      glow.addColorStop(0, 'rgba(180,220,255,0)');
      glow.addColorStop(0.55, `rgba(170,210,255,${0.08 + h.glow * 0.12})`);
      glow.addColorStop(1, 'rgba(170,210,255,0)');
      g.fillStyle = glow;
      g.beginPath();
      g.arc(h.x, h.y, h.r * 1.55, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = `rgba(255,255,255,${0.22 + h.glow * 0.25})`;
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(h.x, h.y, h.r * 0.98, 0, Math.PI * 2);
      g.stroke();
      if (h.age < 0.45) {
        const a = 1 - h.age / 0.45;
        g.strokeStyle = `rgba(30,30,32,${0.55 * a})`;
        g.lineWidth = 1.2;
        for (const c of h.cracks) {
          g.beginPath();
          g.moveTo(h.x, h.y);
          g.lineTo(
            h.x + Math.cos(c.ang) * c.len * (h.r / h.targetR),
            h.y + Math.sin(c.ang) * c.len * (h.r / h.targetR),
          );
          g.stroke();
        }
      }
    }
  }

  function openHole(x, y) {
    if (collapsing || collapsed) return;
    if (nextLine >= lines.length) return;

    const entry = lines[nextLine++];
    const base = Math.min(W, H);
    const targetR = base * (0.085 + Math.random() * 0.035);
    const cracks = [];
    for (let i = 0; i < 7; i++) {
      cracks.push({ ang: Math.random() * Math.PI * 2, len: targetR * (0.7 + Math.random() * 0.9) });
    }
    const hole = {
      x, y, r: 0, targetR, age: 0,
      member: entry.name,
      text: entry.line,
      glow: 1, cracks, lineReleased: false,
    };
    holes.push(hole);

    const n = reduceMotion ? 8 : 22;
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 180;
      crumbs.push({
        x, y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 40,
        life: 0.35 + Math.random() * 0.45,
        age: 0,
        s: 1.5 + Math.random() * 3.5,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 8,
      });
    }
    shake = reduceMotion ? 0.25 : 1;
    wallFlex = 1;
    audio.playOpen();
    if (hintEl && !hintEl.classList.contains('gone')) hintEl.classList.add('gone');
    updateCount();
    if (nextLine >= lines.length) {
      setTimeout(startCollapse, reduceMotion ? 280 : 520);
    }
  }

  function updateCount() {
    if (countEl) countEl.textContent = `${nextLine} / ${lines.length}`;
  }

  function cloudMaxWidth() {
    // Keep a clear side margin on narrow phones; still up to ~34em on wide
    return Math.min(W * 0.86, 34 * 16);
  }

  function wrapLines(g, text, maxW) {
    const chars = Array.from(text);
    const lines = [];
    let cur = '';
    for (const ch of chars) {
      const trial = cur + ch;
      if (cur && g.measureText(trial).width > maxW) {
        lines.push(cur);
        cur = ch;
      } else {
        cur = trial;
      }
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [''];
  }

  function measureFloater(f, opt) {
    const o = opt || {};
    const textSize = o.textSize || 12.5;
    const nameSize = o.nameSize || 10;
    const padX = o.padX != null ? o.padX : 12;
    const padY = o.padY != null ? o.padY : 7;
    const nameH = o.nameH != null ? o.nameH : 11;
    const gap = o.gap != null ? o.gap : 3;
    const lineH = o.lineH != null ? o.lineH : Math.round(textSize * 1.2);
    const maxCloud = cloudMaxWidth();
    const maxW = maxCloud - padX * 2;
    const g = ctx;
    const textFont = `${textSize}px ${FONT_STACK}`;
    const memberFont = `600 ${nameSize}px ${FONT_STACK}`;
    g.font = textFont;
    f.lines = wrapLines(g, f.text, maxW);
    let textW = 0;
    for (const ln of f.lines) textW = Math.max(textW, g.measureText(ln).width);
    g.font = memberFont;
    const nameW = g.measureText(f.member).width;
    f.bw = Math.min(maxCloud, Math.max(textW, nameW) + padX * 2);
    f.bh = padY + nameH + gap + f.lines.length * lineH + padY;
    f._padY = padY; f._nameH = nameH; f._gap = gap; f._lineH = lineH;
    f._textFont = textFont; f._memberFont = memberFont;
  }

  function floaterBox(f) {
    // axis-aligned bounds from center x,y
    return {
      left: f.x - f.bw / 2,
      right: f.x + f.bw / 2,
      top: f.y - f.bh / 2,
      bottom: f.y + f.bh / 2,
      w: f.bw,
      h: f.bh,
    };
  }

  function boxesOverlap(a, b, pad) {
    const p = pad || 2;
    return !(a.right + p <= b.left || b.right + p <= a.left || a.bottom + p <= b.top || b.bottom + p <= a.top);
  }

  function clampFloaterPos(f, x, y) {
    const margin = Math.max(6, W * 0.03);
    const halfW = f.bw / 2, halfH = f.bh / 2;
    const topM = 34;
    const botM = 40;
    // If cloud itself taller than usable band, pin center into band anyway
    const minY = topM + halfH;
    const maxY = H - botM - halfH;
    f.x = Math.min(W - margin - halfW, Math.max(margin + halfW, x));
    if (minY > maxY) f.y = (topM + H - botM) / 2;
    else f.y = Math.min(maxY, Math.max(minY, y));
  }

  function placeReadable(f) {
    // Nudge vertically so this cloud doesn't cover existing ones (hole phase)
    measureFloater(f);
    clampFloaterPos(f, f.x, f.y);
    for (let attempt = 0; attempt < 24; attempt++) {
      let hit = false;
      const box = floaterBox(f);
      for (const o of floaters) {
        if (o === f || !o.bw) continue;
        if (boxesOverlap(box, floaterBox(o), 4)) { hit = true; break; }
      }
      if (!hit) return;
      f.y += (attempt % 2 === 0 ? 1 : -1) * (14 + attempt * 3);
      clampFloaterPos(f, f.x, f.y);
    }
  }

  function releaseFloater(hole) {
    const f = {
      x: hole.x,
      y: hole.y - hole.targetR * 0.2,
      vx: (Math.random() - 0.5) * 10,
      vy: -14 - Math.random() * 10,
      member: hole.member,
      text: hole.text,
      a: 0, age: 0, settled: false, tx: 0, ty: 0,
      bw: 0, bh: 0, lines: null,
    };
    floaters.push(f);
    placeReadable(f);
  }

  function layoutFloaters() {
    const n = floaters.length;
    const marginX = Math.max(8, W * 0.06);
    const topM = 36;
    const botM = 44;
    const usableH = H - topM - botM;
    const mobile = portrait || W < 720;

    if (mobile) {
      // Fit all 20 in a single centered column by shrinking metrics until they fit
      const trials = [
        // Prefer readable size with clearer gaps between clouds
        { textSize: 11.5, nameSize: 9, padY: 4, nameH: 10, gap: 2, lineH: 14, stackGap: 5 },
        { textSize: 11, nameSize: 9, padY: 4, nameH: 9, gap: 2, lineH: 13, stackGap: 4 },
        { textSize: 10.5, nameSize: 8.5, padY: 3, nameH: 9, gap: 1, lineH: 12.5, stackGap: 3 },
        { textSize: 10, nameSize: 8, padY: 3, nameH: 8, gap: 1, lineH: 12, stackGap: 2 },
        { textSize: 9.5, nameSize: 8, padY: 2, nameH: 8, gap: 1, lineH: 11.5, stackGap: 2 },
        { textSize: 9, nameSize: 7.5, padY: 2, nameH: 7, gap: 1, lineH: 11, stackGap: 1 },
      ];
      let chosen = trials[trials.length - 1];
      for (const tr of trials) {
        for (const f of floaters) measureFloater(f, tr);
        const totalH = floaters.reduce((s, f) => s + f.bh, 0) + tr.stackGap * Math.max(0, n - 1);
        if (totalH <= usableH) { chosen = tr; break; }
        chosen = tr;
      }
      for (const f of floaters) measureFloater(f, chosen);
      const totalH = floaters.reduce((s, f) => s + f.bh, 0) + chosen.stackGap * Math.max(0, n - 1);
      let y = topM + Math.max(0, (usableH - totalH) / 2);
      // If still overflowing (extreme), compress stackGap to 0 and pin to top
      if (totalH > usableH) y = topM;
      const cx = W / 2;
      for (const f of floaters) {
        f.tx = cx;
        f.ty = y + f.bh / 2;
        f.driftAmp = 0;
        y += f.bh + chosen.stackGap;
      }
      // Final safety clamp — should be no-ops if fit succeeded
      for (const f of floaters) {
        clampFloaterPos(f, f.tx, f.ty);
        f.tx = f.x; f.ty = f.y;
      }
    } else {
      // Desktop: 3–4 columns, pack top-down (no overlap, fully in viewport)
      const gap = 8;
      const cols = W >= 1100 ? 4 : 3;
      const colW = (W - marginX * 2) / cols;
      const maxColInner = Math.max(160, colW - 12);
      // Temporarily constrain cloudMaxWidth via measure opt
      const deskOpt = { textSize: 13, nameSize: 10, padX: 12, padY: 7, nameH: 11, gap: 3, lineH: 16, _maxW: maxColInner };
      // monkey-patch cloud width for this pass
      const origMax = cloudMaxWidth;
      // measure with capped width
      for (const f of floaters) {
        const maxW = maxColInner;
        const textSize = 13, nameSize = 10, padX = 12, padY = 7, nameH = 11, igap = 3, lineH = 16;
        const g = ctx;
        const textFont = `${textSize}px ${FONT_STACK}`;
        const memberFont = `600 ${nameSize}px ${FONT_STACK}`;
        g.font = textFont;
        f.lines = wrapLines(g, f.text, maxW - padX * 2);
        let textW = 0;
        for (const ln of f.lines) textW = Math.max(textW, g.measureText(ln).width);
        g.font = memberFont;
        const nameW = g.measureText(f.member).width;
        f.bw = Math.min(maxW, Math.max(textW, nameW) + padX * 2);
        f.bh = padY + nameH + igap + f.lines.length * lineH + padY;
        f._padY = padY; f._nameH = nameH; f._gap = igap; f._lineH = lineH;
        f._textFont = textFont; f._memberFont = memberFont;
      }
      const buckets = Array.from({ length: cols }, () => []);
      floaters.forEach((f, i) => buckets[i % cols].push(f));
      for (let c = 0; c < cols; c++) {
        let y = topM;
        const list = buckets[c];
        const colH = list.reduce((s, f) => s + f.bh, 0) + gap * Math.max(0, list.length - 1);
        if (colH < usableH) y = topM + (usableH - colH) / 2;
        const cx = marginX + colW * (c + 0.5);
        for (const f of list) {
          f.tx = cx;
          f.ty = y + f.bh / 2;
          f.driftAmp = 0;
          y += f.bh + gap;
        }
      }
      for (const f of floaters) {
        clampFloaterPos(f, f.tx, f.ty);
        f.tx = f.x; f.ty = f.y;
      }
    }
  }

  function startCollapse() {
    if (collapsing || collapsed) return;
    collapsing = true;
    collapseT = 0;
    audio.playFull();
    shake = reduceMotion ? 0.4 : 1.4;

    chunks = [];
    const cols = reduceMotion ? 5 : 8;
    const rows = reduceMotion ? 8 : 12;
    const cw = W / cols, ch = H / rows;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const jx = (Math.random() - 0.5) * cw * 0.3;
        const jy = (Math.random() - 0.5) * ch * 0.3;
        const x = col * cw + jx;
        const y = row * ch + jy;
        const w = cw * (0.85 + Math.random() * 0.3);
        const h = ch * (0.85 + Math.random() * 0.3);
        let inside = false;
        for (const hole of holes) {
          const cx = x + w / 2, cy = y + h / 2;
          const dx = cx - hole.x, dy = cy - hole.y;
          if (dx * dx + dy * dy < hole.r * hole.r * 0.7) { inside = true; break; }
        }
        if (inside) continue;
        const ang = Math.atan2(y + h / 2 - H / 2, x + w / 2 - W / 2);
        const dist = Math.hypot(x + w / 2 - W / 2, y + h / 2 - H / 2);
        const burst = 80 + dist * 0.35 + Math.random() * 120;
        chunks.push({
          x, y, w, h,
          vx: Math.cos(ang) * burst * 0.55 + (Math.random() - 0.5) * 60,
          vy: Math.sin(ang) * burst * 0.25 - 80 - Math.random() * 160,
          rot: 0, vr: (Math.random() - 0.5) * 4, a: 1,
          shade: 0.55 + Math.random() * 0.2,
        });
      }
    }
    for (const h of holes) {
      if (!h.lineReleased) { h.lineReleased = true; releaseFloater(h); }
    }
    layoutFloaters();
  }

  function update(dt) {
    for (const h of holes) {
      h.age += dt;
      const t = Math.min(1, h.age / (reduceMotion ? 0.28 : 0.42));
      const c1 = 1.4, c3 = c1 + 1;
      const e = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
      h.r = h.targetR * Math.min(1.06, Math.max(0, e));
      if (t >= 1) h.r += (h.targetR - h.r) * Math.min(1, dt * 8);
      h.glow *= Math.pow(0.25, dt);
      if (!h.lineReleased && h.age > 0.12) {
        h.lineReleased = true;
        releaseFloater(h);
      }
    }
    for (let i = crumbs.length - 1; i >= 0; i--) {
      const p = crumbs[i];
      p.age += dt; p.vy += 420 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt; p.vx *= Math.pow(0.4, dt);
      if (p.age >= p.life) crumbs.splice(i, 1);
    }
    for (const t of wallTexts) {
      t.x += t.vx * 18 * dt; t.life += dt * 0.15;
      if (t.x < -80) t.x = W + 40;
      if (t.x > W + 80) t.x = -40;
      if (t.life > 1) {
        t.life = 0;
        t.text = NOISE_POOL[(Math.random() * NOISE_POOL.length) | 0];
        t.y = Math.random() * H;
      }
    }
    for (const f of floaters) {
      f.age += dt;
      if (!collapsing && !collapsed) {
        f.a = Math.min(1, f.age * 2.2);
        f.x += f.vx * dt; f.y += f.vy * dt;
        f.vx *= Math.pow(0.4, dt); f.vy *= Math.pow(0.55, dt);
        f.vx += Math.sin(f.age * 1.1) * 2 * dt;
        // Keep fully on-screen and de-overlap during hole phase
        if (!f.bw) measureFloater(f);
        clampFloaterPos(f, f.x, f.y);
        const box = floaterBox(f);
        for (const o of floaters) {
          if (o === f || !o.bw) continue;
          if (boxesOverlap(box, floaterBox(o), 3)) {
            f.y += (f.y <= o.y ? -1 : 1) * 20 * dt;
            clampFloaterPos(f, f.x, f.y);
          }
        }
      } else {
        f.a = Math.min(1, f.a + dt);
        const k = 1 - Math.pow(0.06, dt);
        f.x += (f.tx - f.x) * k;
        f.y += (f.ty - f.y) * k;
        if (Math.abs(f.x - f.tx) < 0.4 && Math.abs(f.y - f.ty) < 0.4) {
          f.x = f.tx; f.y = f.ty; f.settled = true;
        }
      }
    }
    shake *= Math.pow(0.04, dt);
    wallFlex *= Math.pow(0.08, dt);

    if (collapsing) {
      collapseT += dt;
      for (let i = chunks.length - 1; i >= 0; i--) {
        const c = chunks[i];
        c.vy += 980 * dt;
        c.x += c.vx * dt; c.y += c.vy * dt;
        c.rot += c.vr * dt; c.vx *= Math.pow(0.6, dt);
        if (c.y > H + 80) c.a -= dt * 1.2;
        else if (collapseT > 1.6) c.a -= dt * 0.6;
        if (c.a <= 0) chunks.splice(i, 1);
      }
      if (collapseT > 2.2 || chunks.length === 0) {
        collapsing = false;
        collapsed = true;
        chunks = [];
        holes = [];
        wallTexts = [];
        finaleEl.hidden = false;
        requestAnimationFrame(() => finaleEl.classList.add('show'));
      }
    }
  }

  function drawWallLayer() {
    if (!wallOff) {
      wallOff = document.createElement('canvas');
      wallOffCtx = wallOff.getContext('2d');
    }
    if (wallOff.width !== canvas.width || wallOff.height !== canvas.height) {
      wallOff.width = canvas.width;
      wallOff.height = canvas.height;
    }
    const g = wallOffCtx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    if (collapsing) {
      const veil = Math.max(0, 1 - collapseT * 1.4);
      if (veil > 0.02) {
        g.globalAlpha = veil * 0.35;
        drawWallBase(g, 0);
        g.globalAlpha = 1;
        punchHoles(g);
      }
    } else {
      drawWallBase(g, wallFlex);
      punchHoles(g);
    }
    return wallOff;
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function drawFloater(g, f) {
    if (!f.bw || !f.lines) measureFloater(f);
    g.save();
    g.globalAlpha = f.a * 0.96;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const bw = f.bw, bh = f.bh;
    const left = f.x - bw / 2, top = f.y - bh / 2;
    g.fillStyle = 'rgba(255,255,255,0.72)';
    roundRect(g, left, top, bw, bh, 11);
    g.fill();
    // soft inner highlight (stays inside measured box — no neighbor bleed)
    g.fillStyle = 'rgba(255,255,255,0.2)';
    roundRect(g, left + 2, top + 2, bw - 4, Math.max(6, bh * 0.35), 8);
    g.fill();

    let cy = top + f._padY + f._nameH / 2;
    g.fillStyle = 'rgba(40,55,75,0.58)';
    g.font = f._memberFont || FONT_MEMBER;
    g.fillText(f.member, f.x, cy);
    cy += f._nameH / 2 + f._gap + f._lineH / 2;
    g.fillStyle = 'rgba(25,35,50,0.9)';
    g.font = f._textFont || FONT_TEXT;
    for (const ln of f.lines) {
      g.fillText(ln, f.x, cy);
      cy += f._lineH;
    }
    g.restore();
  }

  function draw() {
    const sx = reduceMotion ? 0 : (Math.random() - 0.5) * shake * 7;
    const sy = reduceMotion ? 0 : (Math.random() - 0.5) * shake * 7;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(sx, sy);
    drawSky(ctx);
    if (!collapsed) {
      ctx.drawImage(drawWallLayer(), 0, 0, W, H);
      if (!collapsing) drawHoleGlow(ctx);
      for (const p of crumbs) {
        const a = 1 - p.age / p.life;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = a;
        ctx.fillStyle = '#4a4e54';
        ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.7);
        ctx.restore();
      }
      if (collapsing) {
        for (const c of chunks) {
          ctx.save();
          ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
          ctx.rotate(c.rot);
          ctx.globalAlpha = Math.max(0, c.a);
          const v = (90 + c.shade * 40) | 0;
          ctx.fillStyle = `rgba(${v},${v + 4},${v + 10},1)`;
          ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
          ctx.strokeStyle = 'rgba(0,0,0,0.18)';
          ctx.lineWidth = 1;
          ctx.strokeRect(-c.w / 2, -c.h / 2, c.w, c.h);
          ctx.restore();
        }
      }
    }
    for (const f of floaters) drawFloater(ctx, f);
    ctx.restore();
  }

  function frame(ts) {
    if (!lastT) lastT = ts;
    let dt = (ts - lastT) / 1000;
    lastT = ts;
    if (dt > 0.05) dt = 0.05;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  function onPointer(e) {
    audio.unlock(); // sync, first
    if (e.cancelable) e.preventDefault();
    if (collapsing || collapsed) return;
    if (nextLine >= lines.length) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / rect.width);
    const y = (e.clientY - rect.top) * (H / rect.height);
    openHole(x, y);
  }
  canvas.addEventListener('pointerdown', onPointer, { passive: false });
  canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  function normalizeLines(data) {
    // Accept either [{name,line}, ...] or {lines:[{name|member, line|text}, ...]}
    const arr = Array.isArray(data) ? data : (data && data.lines) || [];
    return arr.map((row) => ({
      name: row.name || row.member || '?',
      line: row.line || row.text || '',
    }));
  }

  // Prefetch audio bytes so first tap can decode quickly
  const audioPrefetch = { winds: [], full: null };
  async function prefetchAudio() {
    const windUrls = ['audio/wind-open.mp3','audio/wind-open-2.mp3','audio/wind-open-3.mp3'];
    for (const u of windUrls) {
      try {
        const r = await fetch(u);
        if (r.ok) audioPrefetch.winds.push(await r.arrayBuffer());
      } catch (_) {}
    }
    try {
      const r = await fetch('audio/sky-full.mp3');
      if (r.ok) audioPrefetch.full = await r.arrayBuffer();
    } catch (_) {}
  }

  async function boot() {
    resize();
    try {
      const res = await fetch('lines.json');
      lines = normalizeLines(await res.json());
    } catch (err) {
      console.error('lines.json', err);
      lines = [{ name: '?', line: '風が通る。' }];
    }
    prefetchAudio(); // parallel, no await required before paint
    await probeSky();
    // Ensure CJK face is ready before first measureText (avoids kana/kanji size mix)
    try {
      if (document.fonts && document.fonts.load) {
        await Promise.race([
          Promise.all([
            document.fonts.load(`12.5px "Noto Sans CJK JP"`),
            document.fonts.load(`12.5px "Noto Sans JP"`),
            document.fonts.load(`600 10px "Noto Sans CJK JP"`),
          ]),
          new Promise((r) => setTimeout(r, 1200)),
        ]);
        await document.fonts.ready;
      }
    } catch (_) {}
    seedWallTexts();
    updateCount();
    requestAnimationFrame(frame);

    // Probe which face canvas actually picks (for font diagnostics)
    try {
      const probe = document.createElement('canvas').getContext('2d');
      probe.font = FONT_TEXT;
      resolvedFont = probe.font;
      if (document.fonts && document.fonts.check) {
        const checks = {
          'Noto Sans CJK JP': document.fonts.check('12px "Noto Sans CJK JP"'),
          'Noto Sans JP': document.fonts.check('12px "Noto Sans JP"'),
          'Hiragino Sans': document.fonts.check('12px "Hiragino Sans"'),
        };
        resolvedFont = JSON.stringify({ css: probe.font, checks });
      }
    } catch (_) {}

    window.__kazaana = {
      get audioState() { return audio.state; },
      get audioFiles() { return { ...audio.fileOk, winds: audio.winds.length }; },
      get holes() { return holes.length; },
      get nextLine() { return nextLine; },
      get total() { return lines.length; },
      get collapsing() { return collapsing; },
      get collapsed() { return collapsed; },
      get sky() {
        const src = skyImg && skyImg.src ? skyImg.src : '';
        return { portrait, src, tall: !!(skyTall && skyImg === skyTall), wide: !!(skyWide && skyImg === skyWide) };
      },
      get font() { return { stack: FONT_STACK, resolved: resolvedFont }; },
      getFloaterBounds() {
        return floaters.map((f) => {
          if (!f.bw) measureFloater(f);
          const b = floaterBox(f);
          return { member: f.member, text: f.text, ...b, settled: !!f.settled };
        });
      },
      get viewport() { return { w: W, h: H }; },
      tap(x, y) { audio.unlock(); openHole(x, y); },
    };
  }
  boot();
})();
