import { freeAnswer } from './helpers/guided-records.mjs';
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
const root = 'http://localhost:4000', route = root + '/explore/space-exploration/write-driving-rules';
const key = 'systemedu:learning:v1:guest:' + encodeURIComponent(JSON.stringify({ library_slug: 'write-driving-rules', module_id: 'M01', activity_id: 'reflection', kind: 'classroom', content_version: '1.0' }));
const labKey = 'systemedu:write-driving-rules:v1';
const dir = path.resolve('artifacts/guided-course');
await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({ args: ['--no-proxy-server'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await context.newPage(), results = [], errors = [];
page.on('pageerror', error => errors.push(String(error)));
async function check(name, work) {
  try { await work(); results.push({ name, passed: true }); console.log('PASS ' + name); }
  catch (e) { results.push({ name, passed: false, error: String(e) }); throw e; }
}
const outline = page.locator('[aria-label="课程学习路径"]');
async function node(id) { await outline.locator(`a[href="?node=${id}"]`).click(); await expect(page.locator('[data-module]')).toHaveAttribute('data-module', id); }
try {
  await check('真实四节点、正文资料视频，默认不是单个互动', async () => {
    await page.goto(route);
    await expect(outline.locator('a[href^="?node="]')).toHaveCount(4);
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(page.locator('#lesson-reading')).toContainText('输入是什么');
    await expect(page.locator('#lesson-references a')).toHaveAttribute('href', /science.nasa.gov/);
    await expect(page.locator('#lesson-videos')).toContainText('AutoNav');
    await expect(page.locator('[data-course-progress]')).toHaveText('0 / 4');
    await expect(page.locator('[data-learning-status]')).toContainText('未登录');
    await page.screenshot({ path: path.join(dir, 'course-desktop.png'), fullPage: true });
  });
  await check('逐节点记录、刷新恢复，修改撤销提交标记', async () => {
    await freeAnswer(page, 0, '输入是岩石，风险是碰撞，我选择沿已知侧道绕行。');
    await freeAnswer(page, 1, '未知表示信息不够，需要先停下确认，而不是当作平地。');
    await page.getByRole('button', { name: '提交本节学习记录' }).click();
    await expect(page.locator('[data-course-progress]')).toHaveText('1 / 4');
    await page.reload(); await expect(page.locator('textarea').first()).toHaveValue(/输入是岩石/);
    await freeAnswer(page, 1, '信息不够，要补充环境信息后再决定。');
    await expect(page.locator('[data-course-progress]')).toHaveText('0 / 4');
    await page.getByRole('button', { name: '提交本节学习记录' }).click();
    await node('M02'); await expect(await freeAnswer(page, 0)).toHaveValue('');
    await expect(page.locator('#lesson-reading')).toContainText('条件与动作');
  });
  await check('无法播放时有可完成的替代任务与可追溯官网', async () => {
    await page.route('https://videos.code.org/**', request => request.abort());
    await page.getByRole('button', { name: '播放视频' }).click();
    await expect(page.locator('#lesson-videos video')).toHaveAttribute('src', /videos.code.org/);
    await page.locator('#lesson-videos summary').click();
    await expect(page.locator('#lesson-videos')).toContainText('替代例子');
    await expect(page.locator('#lesson-videos a').last()).toHaveAttribute('href', /studio.code.org\/courses/);
  });
  await check('课程嵌入实验、初始失败、双路线验证与可展开历史', async () => {
    await page.getByRole('button', { name: '打开本节实验' }).click();
    const frame = page.frameLocator('iframe[title="驾驶规则实验工具"]');
    await expect(frame.locator('#render-mode')).not.toContainText('正在准备');
    async function run(id) { await frame.locator('#run-' + id).click(); await expect(frame.locator('#run-' + id)).toBeEnabled({ timeout: 25000 }); }
    await frame.locator('#baseline').click(); await run('training');
    await expect(frame.locator('#log')).toContainText('打滑');
    for (const [terrain, action] of [['sand','slow'], ['rock','detour'], ['unknown','stop']]) await frame.locator('#rule-' + terrain).selectOption(action);
    await run('training'); await run('transfer');
    await frame.locator('#save').click();
    await expect(frame.locator('#runs details')).toHaveCount(3);
    await frame.locator('#runs summary').last().click();
    await expect(frame.locator('#runs details').last()).toContainText('柔软沙地 → 正常前进');
    await frame.locator('#baseline').click();
    await expect(frame.locator('#rule-sand')).toHaveValue('forward');
    await expect(frame.locator('#runs details')).toHaveCount(3);
    await expect(frame.locator('#records button')).toHaveCount(1);
    await page.screenshot({ path: path.join(dir, 'course-lab.png'), fullPage: true });
  });
  await check('关联实际实验凭据，实验通过不冒充全课程完成，交付可下载', async () => {
    await node('M04');
    await page.getByRole('button', { name: '关联实验作品', exact: true }).click();
    await expect(page.getByText('本节已关联实验凭据。', { exact: false })).toBeVisible();
    await expect(page.locator('[data-course-progress]')).toHaveText('1 / 4');
    const pending = page.waitForEvent('download');
    await page.getByText('课程记录选项', { exact: true }).click();
    await page.getByRole('button', { name: '下载课程记录', exact: true }).click();
    await (await pending).saveAs(path.join(dir, 'sample-course-record.json'));
    const data = JSON.parse(await fs.readFile(path.join(dir, 'sample-course-record.json')));
    expect(data.nodes.M01.answers).toHaveLength(2);
    expect(data.lab_artifact.program.rules.unknown).toBe('stop');
    expect(data.lab_artifact.evidence.runs.filter(r => r.passed)).toHaveLength(2);
    await page.evaluate(({ key, labKey }) => {
      const records = JSON.parse(localStorage.getItem(labKey));
      records[0].evidence.runs.filter(r => r.passed).forEach(r => { r.trace = []; });
      localStorage.setItem(labKey, JSON.stringify(records)); localStorage.removeItem(key);
    }, { key, labKey });
    await page.reload(); await page.getByRole('button', { name: '关联实验作品', exact: true }).click();
    await expect(page.getByText('还没找到实际通过两条路线', { exact: false })).toBeVisible();
    await expect(page.locator('[data-course-progress]')).toHaveText('0 / 4');
  });
  await check('存储损坏不覆盖，配额失败仍可跨节点保留和下载当前记录', async () => {
    for (const mode of ['corrupt', 'quota']) {
      const c = await browser.newContext();
      await c.addInitScript(({ mode, key }) => {
        if (mode === 'corrupt') localStorage.setItem(key, '{broken');
        else Storage.prototype.setItem = function() { throw new DOMException('quota', 'QuotaExceededError'); };
      }, { mode, key });
      const p = await c.newPage(); await p.goto(route);
      await freeAnswer(p, 0, '仍保留在页面内的观察');
      await expect(p.locator('[data-learning-status]')).toContainText('当前内容只在页面中');
      await p.locator('[aria-label="课程学习路径"] a').nth(1).click();
      await p.locator('[aria-label="课程学习路径"] a').first().click();
      await expect(p.locator('textarea').first()).toHaveValue('仍保留在页面内的观察');
      if (mode === 'corrupt') expect(await p.evaluate(k => localStorage.getItem(k), key)).toBe('{broken');
      await c.close();
    }
  });
  await check('手机课程布局与项目库课程入口', async () => {
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto(route);
    await expect(page.locator('[data-learning-status]')).toContainText('未登录');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: path.join(dir, 'course-mobile.png'), fullPage: true });
    await page.goto(root + '/library?view=lines&line=space-exploration');
    await expect(page.locator('[data-project-card="write-driving-rules"]')).toContainText('4 学习节点');
    await expect(page.locator('[data-planned-project="pick-an-observation-site"]')).toContainText('3 学习节点');
    await expect(page.locator('[data-project-card="write-driving-rules"]')).toContainText('50 分钟');
  });
  expect(errors).toEqual([]);
} catch (e) {
  process.exitCode = 1; console.error(e);
  await page.screenshot({ path: path.join(dir, 'failure.png'), fullPage: true }).catch(() => {});
} finally {
  await fs.writeFile(path.join(dir, 'verification.json'), JSON.stringify({ at: new Date().toISOString(), scope: 'automated-browser-not-child-trial', results, errors }, null, 2));
  await browser.close();
}
