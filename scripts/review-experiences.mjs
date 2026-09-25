import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, resolve, join } from 'node:path';
const output = resolve('docs/experience-review');
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
await new Promise(r => server.listen(5198, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] });
const results = [];
try {
 for (const width of [1440, 390]) {
  for (const route of ['chef-chatbot', 'coach-trainer', 'virtual-pet', 'digital-wardrobe']) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.addInitScript(() => {
      // Deterministic speech events verify the avatar independently of host voices.
      window.__spoken = [];
      window.speechSynthesis.getVoices = () => [];
      window.speechSynthesis.resume = () => {};
      window.speechSynthesis.cancel = () => { clearInterval(window.__speechInterval); };
      window.speechSynthesis.speak = utterance => {
        window.__spoken.push(utterance.text);
        utterance.onstart?.({});
        let charIndex = 0;
        window.__speechInterval = setInterval(() => {
          utterance.onboundary?.({ name: 'word', charIndex });
          charIndex = (charIndex + 6) % utterance.text.length;
        }, 280);
        window.__utterance = utterance;
      };
    });
    await page.goto('http://127.0.0.1:5198/frankfabric/projects/' + route + '/', { waitUntil: 'networkidle' });
    await page.locator('canvas').waitFor();
    await page.waitForTimeout(3500);
    await page.screenshot({ path: join(output, `${route}-${width}.png`), fullPage: true });
    const canvas = page.locator('canvas').first();
    if (route === 'chef-chatbot' || route === 'coach-trainer') {
      await page.locator('input').fill(route === 'chef-chatbot' ? 'pasta recipe' : 'beginner workout');
      await page.locator('input').press('Enter');
      await page.waitForTimeout(1300);
      await canvas.screenshot({ path: join(output, `${route}-${width}-speaking.png`) });
      if (!(await page.evaluate(() => window.__spoken.length))) errors.push('Reply did not invoke speech');
      await page.evaluate(() => { clearInterval(window.__speechInterval); window.__utterance?.onend?.({}); });
      await page.locator('input').fill('next');
      await page.locator('input').press('Enter');
      await page.waitForTimeout(100);
      if ((await page.evaluate(() => window.__spoken.length)) !== 2) errors.push('Second reply did not invoke speech');
      await page.getByRole('button', { name: /Mute .* voice/ }).click();
      await page.locator('input').fill('help');
      await page.locator('input').press('Enter');
      await page.waitForTimeout(100);
      if ((await page.evaluate(() => window.__spoken.length)) !== 2) errors.push('Muted reply invoked speech');
    } else if (route === 'virtual-pet') {
      await page.getByRole('button', { name: 'Sound off' }).click();
      await page.getByRole('button', { name: /Feed/ }).click();
      await page.waitForTimeout(300);
    } else {
      await page.getByRole('radio', { name: 'Play Rest animation', exact: true }).click();
      await page.getByRole('button', { name: 'Top: Tank Top', exact: true }).click();
      await page.waitForTimeout(500);

    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('radio', { name: /Fast/i }).click();
    await page.waitForTimeout(150);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    results.push({ route, width, errors, overflow });
    console.log(JSON.stringify(results.at(-1)));
    await page.close();
  }
 }
 await writeFile(join(output, 'results.json'), JSON.stringify(results, null, 2));
} finally { await browser.close(); server.close(); }
if (results.some(r => r.errors.length || r.overflow)) process.exitCode = 1;
