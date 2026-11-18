const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const repo = path.resolve(__dirname, '../..');
const runtime = path.join(repo, 'packages/learning-runtime');
const esbuild = require(path.join(runtime, 'node_modules/esbuild'));
const { chromium } = require(path.join(repo, 'node_modules/playwright'));
const out = path.join(repo, 'artifacts/mobile-reading');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'reading-pages-'));
const baselineCommit = '0c1ff54de4f065c64478c5a090cd98fdc8a24595';
async function load(source, name) {
  const file = path.join(temp, name + '.mjs');
  esbuild.buildSync({ stdin: { contents: source, resolveDir: path.join(runtime, 'src/mobile'), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', outfile: file });
  return import(pathToFileURL(file));
}
(async () => {
  const oldCode = execFileSync('git', ['show', baselineCommit + ':packages/learning-runtime/src/mobile/reading-pages.ts'], { cwd: repo, encoding: 'utf8' });
  const before = (await load(oldCode, 'before')).readingPages;
  const { readingPages, restoreReadingPage } = await load(fs.readFileSync(path.join(runtime, 'src/mobile/reading-pages.ts'), 'utf8'), 'after');
  const catalog = JSON.parse(fs.readFileSync(path.join(runtime, 'dist/content/catalog.json')));
  const counts = { courses: catalog.courses.length, lessons: 0, affectedLessons: 0, hiddenPages: 0, retainedPages: 0, blankLessons: 0 };
  const affected = [];
  let antLesson;
  for (const course of catalog.courses) for (const node of course.modules) {
    const lesson = JSON.parse(fs.readFileSync(path.join(runtime, 'dist', node.path)));
    const oldPages = before(lesson.lesson), pages = readingPages(lesson.lesson);
    counts.lessons++;
    if (!pages.length) counts.blankLessons++;
    assert.ok(pages.length, node.id);
    assert.equal(new Set(pages.map(p => p.id)).size, pages.length, node.id);
    for (const page of pages) {
      const { sourceIndex, ...unchanged } = page;
      assert.deepEqual(unchanged, oldPages[sourceIndex], node.id + ' changed actual lesson content');
      assert.equal(restoreReadingPage(pages, page.id, sourceIndex), pages.indexOf(page));
      assert.equal(restoreReadingPage(pages, undefined, sourceIndex), pages.indexOf(page));
    }
    const hidden = oldPages.length - pages.length;
    if (hidden) { counts.affectedLessons++; counts.hiddenPages += hidden; affected.push({ activity: node.id, hiddenPages: hidden }); }
    counts.retainedPages += pages.length;
    if (course.id === 'ai-ant-ethologist' && node.moduleId === 'M01') antLesson = lesson;
  }
  assert.equal(counts.lessons, 843);
  assert.ok(antLesson);
  const entry = path.join(temp, 'entry.tsx');
  fs.writeFileSync(entry, `import React from '${runtime}/node_modules/react';import {createRoot} from '${runtime}/node_modules/react-dom/client';import {CourseReader} from '${runtime}/src/mobile/course-reader';import '${runtime}/src/shell.css';const root=createRoot(document.getElementById('root')!);let n=0;(window as any).start=(lesson:any,initial:any)=>{const change=(state:any)=>{(window as any).saved=structuredClone(state)};root.render(<div className="classroom-shell"><CourseReader key={++n} lesson={lesson} initial={initial} onChange={change} onCommit={async s=>change(s)}/></div>)};`);
  esbuild.buildSync({ entryPoints: [entry], bundle: true, platform: 'browser', format: 'iife', outfile: path.join(temp, 'app.js'), jsx: 'automatic', nodePaths: [path.join(runtime, 'node_modules')], loader: { '.woff': 'dataurl', '.woff2': 'dataurl', '.ttf': 'dataurl' } });
  fs.writeFileSync(path.join(temp, 'index.html'), '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="app.css"><div id="root"></div><script src="app.js"></script>');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(pathToFileURL(path.join(temp, 'index.html')).href);
      await page.evaluate(lesson => window.start(lesson, { content_revision: lesson.content_revision, reader_page: 's0-p1', page_index: 0 }), antLesson);
      await page.getByRole('heading', { name: '确定观察问题与研究范围', exact: true }).waitFor();
      assert.match(await page.locator('.reading-card').innerText(), /怎样把对蚂蚁的好奇/);
      assert.doesNotMatch(await page.locator('.reading-card').innerText(), /Module\s*:/i);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.screenshot({ path: path.join(out, `first-page-${width}.png`), fullPage: true });
    }
    const oldPages = before(antLesson.lesson);
    const targetIndex = oldPages.findIndex(p => p.markdown.includes('一群蚂蚁从巢口进出'));
    for (const useBookmark of [true, false]) {
      const initial = { content_revision: antLesson.content_revision, page_index: targetIndex, note: '原有笔记', ...(useBookmark ? { reader_page: oldPages[targetIndex].id } : {}) };
      await page.evaluate(({ lesson, initial }) => window.start(lesson, initial), { lesson: antLesson, initial });
      await page.getByText(/一群蚂蚁从巢口进出/).waitFor();
      const saved = await page.evaluate(() => window.saved);
      assert.equal(saved.reader_page, oldPages[targetIndex].id);
      assert.equal(saved.note, '原有笔记');
    }
    await page.evaluate(lesson => window.start({ ...lesson, lesson: '> Module: M01\n\n<!-- author-only -->' }, {}), antLesson);
    await page.getByText('本节暂未提供正文，可先查看作业与学习资料。').waitFor();
    assert.doesNotMatch(await page.locator('.reading-card').innerText(), /Module\s*:/i);
    assert.equal(await page.getByRole('button', { name: '下一页', exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: '标记为已读完', exact: true }).count(), 0);
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'pagination-verification.json'), JSON.stringify({ status: 'pass', baselineCommit, counts, affected, browserWidths: [320, 390, 768], bookmarkAndLegacyIndexRestore: 'pass', errors }, null, 2) + '\n');
    console.log(JSON.stringify({ status: 'pass', counts, browserWidths: [320, 390, 768] }, null, 2));
  } finally { await browser.close(); fs.rmSync(temp, { recursive: true, force: true }); }
})().catch(e => { console.error(e); process.exit(1); });
