import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, resolve, join } from 'node:path';
const output = resolve('docs/layout-review');
await mkdir(output, { recursive: true });
const root = resolve('out');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/frankfabric/, '');
    if (path.endsWith('/')) path += 'index.html';
    const file = resolve(root, '.' + path);
    if (!file.startsWith(root + '/')) throw new Error('invalid path');
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(5197, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] });

const requested = process.argv.slice(2);
const results = [];
try {
 for (const viewport of [{width:1440,height:900},{width:1280,height:720},{width:390,height:844}]) {
  for (const route of ['coach-trainer', 'virtual-pet', 'digital-wardrobe', 'pet-puzzles', 'home']) {
   if (requested.length && !requested.includes(route)) continue;
   if (viewport.width === 1280 && route !== 'digital-wardrobe') continue;
   const page = await browser.newPage({ viewport });
   const errors = [];
   page.on('pageerror', e => errors.push(e.message));
   await page.goto('http://127.0.0.1:5197/frankfabric/' + (route === 'home' ? '' : 'projects/' + route + '/'), {waitUntil:'networkidle'});
   await page.waitForTimeout(route === 'home' || route === 'pet-puzzles' ? 500 : 2200);
   if (route === 'coach-trainer') {
    for (const exercise of ['Squats','March','Jumping jacks']) {
     await page.getByRole('button', {name:exercise,exact:true}).click();
     await page.waitForTimeout(1800);
     await page.getByRole('button', {name:'Pause demo',exact:true}).click();
     await page.waitForTimeout(500);
     await page.locator('canvas').screenshot({path:join(output,`trainer-${exercise}-${viewport.width}.png`)});
     if (!(await page.getByRole('button',{name:'Resume demo',exact:true}).isVisible())) errors.push('Pause failed');
    }
   }
   if (route === 'virtual-pet') {
    for (const action of ['Feed','Play','Sleep','Clean']) {
     await page.getByRole('button',{name:new RegExp(action)}).click();
     await page.waitForTimeout(200);
    }
   }
   if (route === 'digital-wardrobe' && viewport.width >= 1024) {
    const fit = await page.evaluate(() => ({height:document.documentElement.scrollHeight, viewport:innerHeight, bottom:document.querySelector('.wardrobe-builder').getBoundingClientRect().bottom}));
    if (fit.height > fit.viewport + 1 || fit.bottom > fit.viewport) errors.push('Wardrobe exceeds viewport: '+JSON.stringify(fit));
    await page.getByRole('button',{name:'Top: Tank Top',exact:true}).click();
   }
   if (route === 'home') {
    await page.locator('#projects').scrollIntoViewIfNeeded();
    await page.getByRole('button',{name:'Next build',exact:true}).click();
    await page.waitForTimeout(800);
    if (await page.getByRole('button',{name:'Previous build',exact:true}).isDisabled()) errors.push('Carousel did not advance');
    await page.locator('#projects').screenshot({path:join(output,`carousel-${viewport.width}.png`)});
   } else {
    await page.screenshot({path:join(output,`${route}-${viewport.width}.png`),fullPage:true});
   }
   if (route === 'pet-puzzles') {
    const menu = page.frameLocator('iframe');
    for (const kind of ['jump','sort']) {
     await menu.locator('.card.'+kind).click();
     await page.waitForTimeout(600);
     const game = menu.frameLocator('iframe:not([hidden])');
     await page.locator('iframe').scrollIntoViewIfNeeded();
     await game.getByRole('button', {name:/Start level/}).click();
     await page.waitForTimeout(200);
     const width = await game.locator('.app').evaluate(el => el.getBoundingClientRect().width);
     if (viewport.width >= 1024 && width < 900) errors.push('Puzzle still narrow: '+width);
     await page.screenshot({path:join(output,`puzzle-${kind}-${viewport.width}.png`),fullPage:true});
     await menu.locator('#back').click();
    }
   }
   const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
   results.push({route,...viewport,errors,overflow});
   console.log(JSON.stringify(results.at(-1)));
   await page.close();
  }
 }
 await writeFile(join(output,requested.length ? 'results-focused.json' : 'results.json'),JSON.stringify(results,null,2));
} finally {await browser.close();server.close();}
if (results.some(r=>r.errors.length || r.overflow)) process.exitCode=1;
