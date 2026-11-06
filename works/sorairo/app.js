/* 空いろ見本帳 SORAIRO
 * Swap: colors.json · audio/tone-01..20.mp3（明度順割当）· audio/README.md
 */
(() => {
  'use strict';

  const FONT = '"Noto Sans CJK JP","Noto Sans JP","Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic","YuGothic",Meiryo,system-ui,sans-serif';
  const PENTA = [146.83, 164.81, 185.0, 220.0, 246.94, 293.66, 329.63, 369.99]; // D pent synth fallback

  const skyCanvas = document.getElementById('sky');
  const skyCtx = skyCanvas.getContext('2d', { willReadFrequently: true });
  const deckEl = document.getElementById('deck');
  const skyHint = document.getElementById('skyHint');
  const skyNames = document.getElementById('skyNames');
  const btnSave = document.getElementById('btnSave');
  const btnReset = document.getElementById('btnReset');

  let colors = [];
  let selected = [];
  let cards = [];
  let toneOf = []; // colorIndex -> tone number 1..N
  let audio = null;

  function lin(c) {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  function parseHex(h) {
    const s = (h || '').replace('#', '');
    const n = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
    const v = parseInt(n, 16);
    return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
  }
  function luminance(hex) {
    const { r, g, b } = parseHex(hex);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }
  /** Darkest → tone-01. Ties keep colors.json array order (stable). */
  function assignTones(list) {
    const indexed = list.map((c, i) => ({ i, L: luminance(c.hex) }));
    indexed.sort((a, b) => (a.L - b.L) || (a.i - b.i));
    const map = new Array(list.length);
    const N = list.length;
    indexed.forEach((row, rank) => {
      // N==20 → tone = rank+1; N<20 scatter across 1..20
      const tone = N <= 1 ? 1
        : N >= 20 ? (rank + 1)
        : (Math.round(rank * 19 / (N - 1)) + 1);
      map[row.i] = tone;
    });
    return map;
  }

  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.comp = null;
      this.buffers = {}; // toneNum -> AudioBuffer
      this.fileOk = false;
      this.loadPromise = null;
      this.playing = 0;
    }
    unlock() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.8;
        this.comp = this.ctx.createDynamicsCompressor();
        // Sona README
        this.comp.threshold.value = -12;
        this.comp.knee.value = 6;
        this.comp.ratio.value = 4;
        this.comp.attack.value = 0.003;
        this.comp.release.value = 0.25;
        this.master.connect(this.comp);
        this.comp.connect(this.ctx.destination);
        this.loadPromise = this._loadTones();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    }
    async _loadTones() {
      const needed = [...new Set(toneOf.filter(Boolean))];
      let ok = 0;
      await Promise.all(needed.map(async (n) => {
        const file = `audio/tone-${String(n).padStart(2, '0')}.mp3`;
        try {
          const res = await fetch(file);
          if (!res.ok) return;
          const ab = await res.arrayBuffer();
          this.buffers[n] = await this.ctx.decodeAudioData(ab.slice(0));
          ok++;
        } catch (_) {}
      }));
      this.fileOk = ok > 0;
    }
    _voiceGain() {
      // soft 1/√n when many voices
      const n = Math.max(1, this.playing);
      return 1 / Math.sqrt(n);
    }
    playTone(colorIndex) {
      if (!this.ctx) return;
      const tone = toneOf[colorIndex];
      const buf = this.buffers[tone];
      if (buf) {
        this.playing++;
        const src = this.ctx.createBufferSource();
        const g = this.ctx.createGain();
        src.buffer = buf;
        g.gain.value = this._voiceGain();
        src.connect(g); g.connect(this.master);
        src.start();
        src.onended = () => { this.playing = Math.max(0, this.playing - 1); };
        return;
      }
      // synth fallback (D pent)
      if (this.loadPromise) {
        this.loadPromise.then(() => {
          if (this.buffers[tone]) this.playTone(colorIndex);
        });
      }
      this._synth(tone || (colorIndex % 8) + 1);
    }
    _synth(toneNum) {
      const c = this.ctx, now = c.currentTime;
      const freq = PENTA[(toneNum - 1) % PENTA.length] * (toneNum > 8 ? 2 : 1);
      this.playing++;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.16 * this._voiceGain(), now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
      const o1 = c.createOscillator(); o1.type = 'sine'; o1.frequency.value = freq;
      const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2.003;
      const g2 = c.createGain(); g2.gain.value = 0.2;
      o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(this.master);
      o1.start(now); o2.start(now);
      o1.stop(now + 1.85); o2.stop(now + 1.85);
      o1.onended = () => { this.playing = Math.max(0, this.playing - 1); };
    }
    get state() { return this.ctx ? this.ctx.state : 'none'; }
  }
  audio = new AudioEngine();

  function resizeSky() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const rect = skyCanvas.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect.width));
    const h = Math.max(128, Math.floor(rect.height));
    skyCanvas.width = Math.floor(w * dpr);
    skyCanvas.height = Math.floor(h * dpr);
    skyCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    skyCanvas._cssW = w; skyCanvas._cssH = h;
  }

  function drawSkyFrame() {
    const w = skyCanvas._cssW || skyCanvas.clientWidth;
    const h = skyCanvas._cssH || skyCanvas.clientHeight;
    const g = skyCtx;
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#e7eef5';
    g.fillRect(0, 0, w, h);

    if (!selected.length) {
      g.strokeStyle = 'rgba(120,140,160,.12)';
      g.lineWidth = 1;
      for (let y = 18; y < h; y += 18) {
        g.beginPath(); g.moveTo(12, y); g.lineTo(w - 12, y); g.stroke();
      }
      g.fillStyle = 'rgba(80,100,120,.22)';
      g.font = `12px ${FONT}`;
      g.textAlign = 'center';
      g.fillText('見本帳の余白', w / 2, h / 2);
      return;
    }

    const cols = selected.map((i) => colors[i].hex);
    if (cols.length === 1) {
      const c = parseHex(cols[0]);
      const grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, `rgb(${Math.min(255, c.r + 40)},${Math.min(255, c.g + 35)},${Math.min(255, c.b + 20)})`);
      grd.addColorStop(0.55, cols[0]);
      grd.addColorStop(1, `rgb(${Math.max(0, c.r - 50)},${Math.max(0, c.g - 35)},${Math.max(0, c.b - 20)})`);
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
    } else {
      const grd = g.createLinearGradient(0, 0, w, h);
      cols.forEach((hex, i) => {
        grd.addColorStop(cols.length === 1 ? 0 : i / (cols.length - 1), hex);
      });
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
      cols.forEach((hex, i) => {
        const c = parseHex(hex);
        const cx = ((i + 0.5) / cols.length) * w;
        const cy = h * (0.3 + (i % 3) * 0.15);
        const rad = Math.max(w, h) * 0.45;
        const rg = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
        rg.addColorStop(0, `rgba(${c.r},${c.g},${c.b},0.35)`);
        rg.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);
        g.fillStyle = rg;
        g.fillRect(0, 0, w, h);
      });
    }

    const sun = g.createRadialGradient(w * 0.72, h * 0.22, 0, w * 0.72, h * 0.22, Math.min(w, h) * 0.4);
    sun.addColorStop(0, 'rgba(255,252,240,0.55)');
    sun.addColorStop(1, 'rgba(255,252,240,0)');
    g.fillStyle = sun;
    g.fillRect(0, 0, w, h);

    const names = selected.map((i) => colors[i].name).join(' · ');
    g.fillStyle = 'rgba(255,255,255,0.28)';
    g.fillRect(0, h - 22, w, 22);
    g.fillStyle = 'rgba(30,40,55,0.7)';
    g.font = `600 10px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(names, w / 2, h - 11);
  }

  function updateSkyLabels() {
    if (!selected.length) {
      skyHint.classList.remove('gone');
      skyNames.textContent = '';
    } else {
      skyHint.classList.add('gone');
      skyNames.textContent = selected.map((i) => colors[i].name).join(' · ');
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (ch) => (
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]
    ));
  }

  function buildDeck() {
    deckEl.innerHTML = '';
    cards = [];
    colors.forEach((c, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'card';
      btn.setAttribute('role', 'listitem');
      btn.dataset.index = String(i);
      btn.setAttribute('aria-pressed', 'false');
      btn.innerHTML =
        `<span class="chip" style="background:${c.hex}" aria-hidden="true"></span>` +
        `<span class="meta">` +
        `<span class="who">${escapeHtml(c.name)}</span>` +
        `<span class="phrase">${escapeHtml(c.phrase)}</span>` +
        `<span class="hex">${escapeHtml(c.hex.toUpperCase())}</span>` +
        `</span>`;
      btn.addEventListener('pointerdown', () => { audio.unlock(); }, { passive: true });
      btn.addEventListener('click', () => toggle(i));
      deckEl.appendChild(btn);
      cards.push(btn);
    });
  }

  function toggle(i) {
    audio.unlock();
    const at = selected.indexOf(i);
    if (at >= 0) {
      selected.splice(at, 1);
      cards[i].classList.remove('on');
      cards[i].setAttribute('aria-pressed', 'false');
    } else {
      selected.push(i);
      cards[i].classList.add('on');
      cards[i].setAttribute('aria-pressed', 'true');
      audio.playTone(i);
    }
    updateSkyLabels();
    drawSkyFrame();
  }

  function resetAll() {
    audio.unlock();
    selected = [];
    cards.forEach((c) => { c.classList.remove('on'); c.setAttribute('aria-pressed', 'false'); });
    updateSkyLabels();
    drawSkyFrame();
  }

  function saveSkyPng() {
    audio.unlock();
    drawSkyFrame();
    const done = (blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sorairo-sky.png';
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      if (isIOS) {
        const w = window.open(url, '_blank');
        if (!w) { a.target = '_blank'; a.rel = 'noopener'; a.click(); }
      } else {
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    };
    if (skyCanvas.toBlob) skyCanvas.toBlob(done, 'image/png');
    else fetch(skyCanvas.toDataURL('image/png')).then((r) => r.blob()).then(done);
  }

  btnSave.addEventListener('click', saveSkyPng);
  btnReset.addEventListener('click', resetAll);

  function getCardBounds() {
    return cards.map((el, i) => {
      const r = el.getBoundingClientRect();
      return { index: i, name: colors[i]?.name, left: r.left, top: r.top, right: r.right, bottom: r.bottom, w: r.width, h: r.height };
    });
  }

  function sampleSkyCenter() {
    const w = skyCanvas._cssW || 1, h = skyCanvas._cssH || 1;
    const dpr = skyCanvas.width / w;
    const x = Math.floor(w * 0.5 * dpr);
    const y = Math.floor(h * 0.45 * dpr);
    const d = skyCtx.getImageData(x, y, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2] };
  }

  async function boot() {
    try {
      if (document.fonts?.load) {
        await Promise.race([
          document.fonts.load(`14px "Noto Sans CJK JP"`),
          new Promise((r) => setTimeout(r, 1000)),
        ]);
      }
    } catch (_) {}

    try {
      const res = await fetch('colors.json');
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (data.colors || []);
      colors = arr.map((row, index) => ({
        name: row.name,
        phrase: row.phrase,
        hex: row.hex,
        index,
      }));
    } catch (e) {
      console.error('colors.json', e);
      colors = [{ name: '?', phrase: '青。', hex: '#2F80ED', index: 0 }];
    }

    toneOf = assignTones(colors);
    buildDeck();
    resizeSky();
    drawSkyFrame();
    updateSkyLabels();
    window.addEventListener('resize', () => { resizeSky(); drawSkyFrame(); }, { passive: true });

    window.__sorairo = {
      get audioState() { return audio.state; },
      get audioFiles() {
        return {
          fileOk: audio.fileOk,
          loaded: Object.keys(audio.buffers || {}).length,
          toneOf: toneOf.slice(),
        };
      },
      get selected() { return selected.slice(); },
      get total() { return colors.length; },
      get colors() { return colors.map((c) => ({ name: c.name, hex: c.hex, phrase: c.phrase })); },
      toggle(i) { toggle(i); },
      reset() { resetAll(); },
      sampleSky: sampleSkyCenter,
      savePng() {
        return new Promise((resolve) => {
          drawSkyFrame();
          skyCanvas.toBlob((b) => resolve(b), 'image/png');
        });
      },
      getCardBounds,
      getViewport() { return { w: window.innerWidth, h: window.innerHeight }; },
      unlock() { audio.unlock(); },
    };
  }

  boot();
})();
