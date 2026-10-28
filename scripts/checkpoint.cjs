'use strict';
const fs = require('node:fs');
const path = require('node:path');
const schedule = require('../src/events.js');
const { root, launch, openFilmPage, renderFrame } = require('./browser.cjs');

const output = path.join(root, 'output');
const SAMPLES = [
  { frame: 60, title: 'Establishing' },
  { frame: 180, title: 'Overpass + birds' },
  { frame: 400, title: 'Bus clears, landmark revealed' },
  { frame: 500, title: 'Ginkgo leaf trails the camera' }
];
const PALETTE = [
  ['Yellow', '#FFC93C'], ['Pink', '#FF8DB5'], ['Cobalt', '#2E5BE6'], ['Coral', '#FF5A5F'],
  ['Mint', '#A9E6C6'], ['Sky', '#8DD3F6'], ['Lilac', '#D3BEFF'], ['Indigo', '#25214A'], ['White', '#FFFFFF']
];
const timecode = n => {
  const s = Math.floor(n / 30), f = n % 30;
  return `00:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
};

function eventsTable() {
  return [
    '# Events', '',
    '90 BPM, 30 fps, 20 frames per beat, seed `20261027`.',
    'Frame 720 is an exclusive endpoint, not an exported image. Sound cues are synthesized by scripts/audio.cjs at frame x 1600 samples (see audio_sync.md).', '',
    '| Event | Frame | Seconds | Beat | Visual | Sound |',
    '|---|---:|---:|---:|---|---|',
    ...schedule.events.map(e =>
      `| ${e.name} | ${e.frame} | ${(e.frame / 30).toFixed(2)} | ${(e.frame / 20).toFixed(1)} | ${e.visual} | ${e.audio} |`)
  ].join('\n') + '\n';
}

const save = (name, dataUrl) =>
  fs.writeFileSync(path.join(output, name), Buffer.from(dataUrl.split(',')[1], 'base64'));

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const only = process.argv.slice(2).filter(a => /^\d+$/.test(a)).map(Number);
  const samples = only.length ? only.map(f => ({ frame: f, title: 'Debug' })) : SAMPLES;
  const browser = await launch();
  try {
    const page = await openFilmPage(browser);

    const shots = [];
    for (const s of samples) {
      const url = await renderFrame(page, s.frame);
      const name = `frame_${String(s.frame).padStart(4, '0')}.png`;
      save(name, url);
      shots.push({ ...s, url, tc: timecode(s.frame) });
      console.log('rendered', name);
    }
    if (only.length) return;

    const collages = await page.evaluate(async (items, palette) => {
      const load = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.src = src; });
      const imgs = await Promise.all(items.map(i => load(i.url)));
      const out = {};
      for (const [name, size] of [['collage_2x2_full', 3840], ['collage_2x2', 1920]]) {
        const k = size / 1920, cv = document.createElement('canvas');
        cv.width = size; cv.height = size * 9 / 16;
        const g = cv.getContext('2d');
        g.fillStyle = '#25214A'; g.fillRect(0, 0, cv.width, cv.height);
        const tw = cv.width / 2, th = cv.height / 2;
        imgs.forEach((im, n) => {
          const x = (n % 2) * tw, y = Math.floor(n / 2) * th;
          g.drawImage(im, x, y, tw, th);
          const label = `Frame ${items[n].frame} · ${items[n].tc} · ${items[n].title}`;
          g.font = `bold ${15 * k}px Arial`;
          const w = g.measureText(label).width + 22 * k;
          g.fillStyle = '#25214A'; g.beginPath(); g.roundRect(x + 10 * k + 3 * k, y + 10 * k + 3 * k, w, 28 * k, 8 * k); g.fill();
          g.fillStyle = '#FFC93C'; g.strokeStyle = '#25214A'; g.lineWidth = 3 * k;
          g.beginPath(); g.roundRect(x + 10 * k, y + 10 * k, w, 28 * k, 8 * k); g.fill(); g.stroke();
          g.fillStyle = '#25214A'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(label, x + 21 * k, y + 25 * k);
        });
        g.strokeStyle = '#25214A'; g.lineWidth = 6 * k;
        g.beginPath(); g.moveTo(tw, 0); g.lineTo(tw, cv.height); g.moveTo(0, th); g.lineTo(cv.width, th); g.stroke();
        out[name] = cv.toDataURL('image/png');
      }
      const sw = document.createElement('canvas'); sw.width = 1800; sw.height = 300;
      const g = sw.getContext('2d');
      g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, sw.width, sw.height);
      const cw = sw.width / palette.length;
      palette.forEach(([n, hex], j) => {
        g.fillStyle = '#25214A'; g.fillRect(j * cw + 8, 18, cw - 8, 264);
        g.fillStyle = hex; g.fillRect(j * cw, 10, cw - 8, 264);
        g.strokeStyle = '#25214A'; g.lineWidth = 4; g.strokeRect(j * cw + 2, 12, cw - 12, 260);
        g.fillStyle = hex === '#25214A' ? '#FFFFFF' : '#25214A'; g.textAlign = 'center';
        g.font = 'bold 26px Arial'; g.fillText(n, j * cw + cw / 2 - 4, 120);
        g.font = '22px Consolas, monospace'; g.fillText(hex, j * cw + cw / 2 - 4, 160);
      });
      out.palette_swatches = sw.toDataURL('image/png');
      return out;
    }, shots.map(({ frame, title, tc, url }) => ({ frame, title, tc, url })), PALETTE);

    for (const [k, v] of Object.entries(collages)) save(`${k}.png`, v);
    fs.writeFileSync(path.join(output, 'events.md'), eventsTable());
    console.log('collage, palette and events written to', output);
  } finally {
    await browser.close();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
