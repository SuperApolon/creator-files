// 公開前チェック：console エラー / HTTP エラー / はみ出し / prototype の語 / 基準画像との差分
import { test, expect } from '@playwright/test';

const BASE = (process.env.OQ_BASE || 'http://127.0.0.1:8765/creator-files/').replace(/\/?$/, '/');
const PAGES = [...new Set((process.env.OQ_PAGES ?? '').split(',').map((s) => s.trim()))];
const KNOWN = (process.env.OQ_KNOWN || 'rooms/lobby/assets/avatar.png').split(',').filter(Boolean);
const NO_SHOT = process.env.OQ_NO_SHOT === '1';
const CANVAS = (process.env.OQ_CANVAS || '').split(',').filter(Boolean);
const isKnown = (s) => KNOWN.some((k) => s.includes(k));
const slug = (p) => (p.replace(/\/$/, '').replace(/[^A-Za-z0-9._-]+/g, '_') || 'top');

for (const path of PAGES) {
  test(`page ${path || '/'}`, async ({ page }, info) => {
    const errors = [], known = [];
    const note = (msg) => (isKnown(msg) ? known : errors).push(msg);
    page.on('console', (m) => { if (m.type() === 'error') note(`console: ${m.text()} @ ${m.location()?.url || ''}`); });
    page.on('pageerror', (e) => note(`pageerror: ${e.message}`));
    page.on('response', (r) => { if (r.status() >= 400) note(`HTTP ${r.status()}: ${r.url()}`); });
    page.on('requestfailed', (r) => { const f = r.failure()?.errorText || ''; if (!/ERR_ABORTED/.test(f)) note(`requestfailed: ${r.url()} ${f}`); });

    const res = await page.goto(BASE + path, { waitUntil: 'load' });
    expect(res?.status(), `${path} のHTTPステータス`).toBeLessThan(400);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(Number(process.env.OQ_SETTLE || '1500'));

    // はみ出し：横スクロールが出ていないか＋右端を越える要素（最大10件）
    const overflow = await page.evaluate(() => {
      const W = document.documentElement.clientWidth, out = [];
      const sw = document.documentElement.scrollWidth;
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
        const cs = getComputedStyle(el); if (cs.position === 'fixed' || cs.visibility === 'hidden') continue;
        let p = el.parentElement, clipped = false;
        while (p && p !== document.body) { const o = getComputedStyle(p).overflowX; if (o === 'hidden' || o === 'auto' || o === 'scroll' || o === 'clip') { clipped = true; break; } p = p.parentElement; }
        if (!clipped && (r.right > W + 1 || r.left < -1)) out.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''} [${Math.round(r.left)}..${Math.round(r.right)}] > ${W}`);
        if (out.length >= 10) break;
      }
      return { W, sw, out };
    });

    // prototype の語：タイトル・本文・属性値・URL（JSコード内の Object.prototype などは対象外）
    const proto = await page.evaluate(() => {
      const hits = []; const re = /prototype/i;
      if (re.test(document.title)) hits.push('title');
      if (re.test(location.href)) hits.push('url');
      if (re.test(document.body?.innerText || '')) hits.push('本文');
      for (const el of document.querySelectorAll('*')) for (const a of el.attributes) if (re.test(a.value)) hits.push(`${el.tagName.toLowerCase()}[${a.name}]`);
      return hits;
    });

    // canvas が描画されているか（OQ_CANVAS に含まれるページ、iframe 内も見る）
    let canvasInfo = null;
    if (CANVAS.some((c) => path.startsWith(c))) {
      canvasInfo = [];
      for (const f of page.frames()) {
        const v = await f.evaluate(async () => {
          const c = document.querySelector('canvas'); if (!c) return null;
          await new Promise((r) => requestAnimationFrame(() => r()));
          const t = document.createElement('canvas'); t.width = 64; t.height = 64;
          const g = t.getContext('2d'); g.drawImage(c, 0, 0, 64, 64);
          const d = g.getImageData(0, 0, 64, 64).data; const set = new Set();
          for (let i = 0; i < d.length; i += 4) set.add((d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | (d[i + 2] >> 4));
          return { w: c.width, h: c.height, colors: set.size };
        }).catch(() => null);
        if (v) canvasInfo.push(v);
      }
    }

    info.annotations.push({ type: 'known', description: known.join(' | ') || 'なし' });
    console.log(`[${info.project.name}] ${path || '/'}: errors=${errors.length} known=${known.length} overflow=${overflow.out.length}(scrollWidth ${overflow.sw}/${overflow.W}) prototype=${proto.length}${canvasInfo ? ' canvas=' + JSON.stringify(canvasInfo) : ''}`);
    for (const k of known) console.log(`   既知: ${k}`);

    expect.soft(errors, 'console / HTTP エラー').toEqual([]);
    expect.soft(overflow.out, 'はみ出し').toEqual([]);
    expect.soft(overflow.sw <= overflow.W + 1, `横スクロール（scrollWidth ${overflow.sw} > ${overflow.W}）`).toBe(true);
    expect.soft(proto, 'prototype の語').toEqual([]);
    if (canvasInfo) expect.soft(canvasInfo.some((c) => c.colors > 8), 'canvas が描画されている').toBe(true);

    if (!NO_SHOT) {
      await expect.soft(page).toHaveScreenshot(`${slug(path)}.png`, {
        fullPage: false,
        mask: process.env.OQ_MASK === '0' ? [] : [page.locator('canvas, iframe, video')],
      });
    }
  });
}
