#!/usr/bin/env node
// Render viewpoints headlessly and save PNGs to screenshots/.
//   npm run build && npm run screenshot -- tower concourse aerial
// Options via env: WIDTH, HEIGHT, TIME, WEATHER, MONTH, QUALITY
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve('dist');
const views = process.argv.slice(2).length ? process.argv.slice(2) : ['tower', 'entrance', 'concourse', 'platforms', 'umbrella', 'aerial'];
const W = Number(process.env.WIDTH || 1600), H = Number(process.env.HEIGHT || 900);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[browser]', m.type(), m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
fs.mkdirSync('screenshots', { recursive: true });
const q = new URLSearchParams({ shot: '1', view: views[0].startsWith('cam:') ? 'tower' : views[0] });
for (const k of ['time', 'weather', 'month', 'quality', 'osm']) if (process.env[k.toUpperCase()]) q.set(k, process.env[k.toUpperCase()]);
const t0 = Date.now();
await page.goto(`http://localhost:${port}/?${q}`);
await page.waitForFunction(() => window.__glasgow && window.__glasgow.frames > 2, null, { timeout: 600000 });
console.log(`scene ready in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
const info = await page.evaluate(() => {
  const r = window.__glasgow.renderer.info;
  return { calls: r.render.calls, triangles: r.render.triangles, geometries: r.memory.geometries, textures: r.memory.textures };
});
console.log('render info', info);
for (const v of views) {
  await page.evaluate((name) => window.__glasgow.setView(name, true), v);
  const f0 = await page.evaluate(() => window.__glasgow.frames);
  await page.waitForFunction((f) => window.__glasgow.frames > f + 3, f0, { timeout: 600000 });
  const suffix = process.env.SUFFIX ? `-${process.env.SUFFIX}` : '';
  await page.screenshot({ timeout: 0, path: `screenshots/${v.startsWith('cam:') ? 'custom-' + views.indexOf(v) : v}${suffix}.png` });
  console.log('saved', v);
}
await browser.close();
server.close();
