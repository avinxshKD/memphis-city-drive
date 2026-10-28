'use strict';
const fs = require('node:fs');
const path = require('node:path');
const schedule = require('../src/events.js');
const { root, launch, openFilmPage, renderFrame, dataUrlToBuffer } = require('./browser.cjs');

const outDir = path.join(root, 'output');
const frameDir = path.join(outDir, 'frames');
// Concurrent pages are faster but produced 1-level antialiasing differences in Edge. Keep 1 for
// byte-identical output.
const WORKERS = Math.max(1, Number(process.env.RENDER_WORKERS || 1));
const framePath = i => path.join(frameDir, `frame_${String(i).padStart(4, '0')}.png`);

async function contactSheet(page) {
  const picks = [];
  for (let i = 0; i < schedule.frames; i += 60) picks.push(i);
  const url = await page.evaluate(list => {
    const cols = 4, tw = 480, th = 270, rows = Math.ceil(list.length / cols);
    const film = document.getElementById('film'), fctx = film.getContext('2d');
    const sheet = document.createElement('canvas');
    sheet.width = cols * tw; sheet.height = rows * th;
    const g = sheet.getContext('2d');
    g.fillStyle = '#25214A'; g.fillRect(0, 0, sheet.width, sheet.height);
    list.forEach((f, n) => {
      MemphisFilm.frame(f, fctx);
      const x = (n % cols) * tw, y = Math.floor(n / cols) * th;
      g.drawImage(film, x, y, tw, th);
      const s = Math.floor(f / 30), label = `${f} · 00:${String(s).padStart(2, '0')}:${String(f % 30).padStart(2, '0')}`;
      g.font = 'bold 15px Arial'; g.textBaseline = 'middle';
      const w = g.measureText(label).width + 16;
      g.fillStyle = '#FFC93C'; g.strokeStyle = '#25214A'; g.lineWidth = 3;
      g.beginPath(); g.roundRect(x + 8, y + 8, w, 24, 6); g.fill(); g.stroke();
      g.fillStyle = '#25214A'; g.fillText(label, x + 16, y + 21);
    });
    g.strokeStyle = '#25214A'; g.lineWidth = 4;
    for (let c = 1; c < cols; c++) { g.beginPath(); g.moveTo(c * tw, 0); g.lineTo(c * tw, sheet.height); g.stroke(); }
    for (let r = 1; r < rows; r++) { g.beginPath(); g.moveTo(0, r * th); g.lineTo(sheet.width, r * th); g.stroke(); }
    return sheet.toDataURL('image/png');
  }, picks);
  fs.writeFileSync(path.join(outDir, 'contact_sheet.png'), dataUrlToBuffer(url));
}

async function main() {
  fs.mkdirSync(frameDir, { recursive: true });
  const t0 = process.hrtime.bigint();
  const browser = await launch();
  try {
    const pages = await Promise.all(Array.from({ length: WORKERS }, () => openFilmPage(browser)));
    let next = 0, done = 0;
    await Promise.all(pages.map(async page => {
      while (next < schedule.frames) {
        const i = next++;
        fs.writeFileSync(framePath(i), dataUrlToBuffer(await renderFrame(page, i)));
        if (++done % 60 === 0) console.log(`rendered ${done}/${schedule.frames}`);
      }
    }));
    await contactSheet(pages[0]);
  } finally {
    await browser.close();
  }
  const secs = Number(process.hrtime.bigint() - t0) / 1e9;
  console.log(`done: ${schedule.frames} frames + contact_sheet.png in ${secs.toFixed(1)} s`);
}
main().catch(e => { console.error(e); process.exit(1); });
