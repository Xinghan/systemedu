const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../..');
const runtime = path.join(repo, 'packages/learning-runtime');
const dist = path.join(runtime, 'dist');
const esbuild = require(path.join(runtime, 'node_modules/esbuild'));
const { chromium } = require(path.join(repo, 'node_modules/playwright'));
const out = path.join(repo, 'artifacts/mobile-activities');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'activity-access-'));

async function onScreen(locator, page) {
  const box = await locator.boundingBox(), viewport = page.viewportSize();
  assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1, 'Entry must be visible without scrolling');
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const catalog = JSON.parse(fs.readFileSync(path.join(dist, 'content/catalog.json')));
  const counts = {}, ant = {}, guides = [];
  let missingPaths = 0, dynamicAntDemos = 0;
  for (const course of catalog.courses) for (const node of course.modules) {
    const lesson = JSON.parse(fs.readFileSync(path.join(dist, node.path)));
    if (course.id === 'ai-ant-ethologist') ant[lesson.module_id] = lesson;
    for (const item of lesson.interactions ?? []) {
      counts[item.mode] = (counts[item.mode] || 0) + 1;
      if (!item.path) continue;
      const file = path.join(dist, decodeURIComponent(new URL(item.path, 'http://localhost').pathname));
      if (!fs.existsSync(file)) missingPaths++;
      if (course.id === 'ai-ant-ethologist' && item.mode === 'animation') {
        const html = fs.readFileSync(file, 'utf8');
        if (html.includes('<canvas') && html.includes('requestAnimationFrame')) dynamicAntDemos++;
        else guides.push(lesson.module_id);
      }
    }
  }
  assert.equal(missingPaths, 0);
  assert.equal(Object.keys(ant).length, 60);
  const entry = path.join(temp, 'entry.tsx');
  fs.writeFileSync(entry, `import React from '${runtime}/node_modules/react';import {createRoot} from '${runtime}/node_modules/react-dom/client';import {CourseReader} from '${runtime}/src/mobile/course-reader';import '${runtime}/src/shell.css';const root=createRoot(document.getElementById('root')!);let n=0;(window as any).start=(lesson:any)=>{const change=(s:any)=>{(window as any).saved=structuredClone(s)};root.render(<div className="classroom-shell"><CourseReader key={++n} lesson={lesson} initial={{}} onChange={change} onCommit={async s=>change(s)}/></div>)};`);
  esbuild.buildSync({ entryPoints: [entry], bundle: true, platform: 'browser', format: 'iife', outfile: path.join(temp, 'app.js'), jsx: 'automatic', nodePaths: [path.join(runtime, 'node_modules')], loader: { '.woff': 'dataurl', '.woff2': 'dataurl', '.ttf': 'dataurl' } });
  fs.writeFileSync(path.join(temp, 'index.html'), '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture/app.css"><div id="root"></div><script src="/fixture/app.js"></script>');
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const base = pathname.startsWith('/fixture/') ? temp : dist;
    const file = path.resolve(base, '.' + (base === temp ? pathname.slice(8) : pathname));
    if (!file.startsWith(base + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  try {
    for (const [width, height] of [[320, 568], [390, 704]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/fixture/index.html`);
      await page.evaluate(lesson => window.start(lesson), ant.M01);
      const activities = page.getByRole('button', { name: '动画与互动', exact: true });
      await activities.waitFor(); await onScreen(activities, page); await activities.click();
      const guide = page.getByRole('button', { name: '打开演示：把问题与证据连起来', exact: true });
      const workbench = page.getByRole('button', { name: '开始互动：我的观察计划', exact: true });
      await onScreen(guide, page); await onScreen(workbench, page);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.screenshot({ path: path.join(out, `entries-${width}.png`) });
      await workbench.click();
      const frame = page.frameLocator('iframe');
      await frame.locator('textarea').first().waitFor();
      await page.getByRole('button', { name: '全屏操作', exact: true }).click();
      await frame.locator('textarea').first().fill('比较同一观察线内两段等长时段的向外通行次数。');
      await page.waitForFunction(() => Object.values(window.saved.shared_workspace ?? {}).some(v => v.includes('等长时段')));
      if (width === 390) await page.screenshot({ path: path.join(out, 'workbench-390.png') });
      await page.getByRole('button', { name: '退出全屏', exact: true }).click();
      await page.getByRole('button', { name: '关闭面板', exact: true }).click();
      // Opening the actual animation, rather than only asserting that its file exists.
      await page.evaluate(lesson => window.start(lesson), ant.M02);
      await activities.click();
      await page.getByRole('button', { name: '打开演示：同一条路径，两种记录', exact: true }).click();
      await page.getByRole('button', { name: '全屏操作', exact: true }).click();
      await frame.locator('#frameIndicator').filter({ hasText: /^1 \/ 4$/ }).waitFor();
      const before = await frame.locator('canvas').evaluate(c => c.toDataURL());
      const caption = await frame.locator('#caption').innerText();
      await frame.locator('#btnNext').click();
      await frame.locator('#frameIndicator').filter({ hasText: /^2 \/ 4$/ }).waitFor();
      await frame.locator('#caption').filter({ hasNotText: caption }).waitFor();
      assert.notEqual(await frame.locator('canvas').evaluate(c => c.toDataURL()), before);
      await frame.locator('#btnPlay').click();
      await frame.locator('#btnPlay').filter({ hasText: /^暂停$/ }).waitFor();
      await frame.locator('#btnPlay').click();
      if (width === 390) await page.screenshot({ path: path.join(out, 'animation-390.png') });
      await page.close();
    }
    assert.deepEqual(errors, []);
    const report = { status: 'pass', inventory: { counts, missingPaths, antModules: 60, dynamicAntDemos, conceptGuides: guides.sort(), antInteractiveActivities: Object.values(ant).reduce((n, l) => n + l.interactions.filter(i => i.mode === 'game').length, 0) }, viewports: ['320×568', '390×704'], checks: ['activity entry and first two activities visible without scrolling', 'actual workbench loads and saves typed input', 'actual animation changes canvas and caption when stepping', 'animation play and pause'], errors };
    fs.writeFileSync(path.join(out, 'verification.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); fs.rmSync(temp, { recursive: true, force: true }); }
})().catch(e => { console.error(e); process.exitCode = 1; });
