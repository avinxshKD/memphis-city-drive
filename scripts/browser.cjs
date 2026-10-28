'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const puppeteer = require('puppeteer-core');

const root = path.resolve(__dirname, '..');

function executable() {
  const choices = [
    process.env.BROWSER_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ].filter(Boolean);
  const found = choices.find(p => fs.existsSync(p));
  if (!found) throw new Error('Set BROWSER_PATH to an installed Chrome or Edge executable.');
  return found;
}

function launch() {
  return puppeteer.launch({
    executablePath: executable(), headless: true,
    args: ['--force-color-profile=srgb', '--disable-gpu-vsync', '--hide-scrollbars']
  });
}

async function openFilmPage(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  page.on('pageerror', e => { throw e; });
  page.on('console', m => { if (m.type() === 'error') console.error('[page]', m.text()); });
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
  await page.evaluate(() => document.fonts.ready);
  return page;
}

function renderFrame(page, i) {
  return page.evaluate(f => {
    const c = document.getElementById('film');
    MemphisFilm.frame(f, c.getContext('2d'));
    return c.toDataURL('image/png');
  }, i);
}

const dataUrlToBuffer = url => Buffer.from(url.split(',')[1], 'base64');

module.exports = { root, executable, launch, openFilmPage, renderFrame, dataUrlToBuffer };
