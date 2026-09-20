import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const route = 'http://localhost:4000/explore/space-exploration/write-driving-rules';
const dir = path.resolve('artifacts/guided-course-style');
await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({ args: ['--no-proxy-server'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const results = [], errors = [];
page.on('pageerror', error => errors.push(String(error)));
async function check(name, run) {
  await run(); results.push({ name, passed: true }); console.log('PASS ' + name);
}
try {
  await page.goto(route);
  await check('沿用主站字体颜色与卡片圆角，默认只加载封面', async () => {
    const tokens = await page.locator('[data-guided-course]').evaluate(el => ({
      font: getComputedStyle(el).fontFamily, bodyFont: getComputedStyle(document.body).fontFamily,
      ink: getComputedStyle(el).getPropertyValue('--ink').trim(), rootInk: getComputedStyle(document.documentElement).getPropertyValue('--ink').trim(),
    }));
    expect(tokens.font).toBe(tokens.bodyFont); expect(tokens.ink).toBe(tokens.rootInk);
    await expect(page.locator('[data-course-video]')).toHaveCSS('border-radius', '12px');
    await expect(page.locator('video, iframe')).toHaveCount(0);
    await page.getByRole('link', { name: '视频与观察', exact: true }).click();
    const cover = page.locator('[data-course-video] img');
    await expect.poll(() => cover.evaluate(el => el.complete && el.naturalWidth > 0), { timeout: 15000 }).toBe(true);
    await page.screenshot({ path: path.join(dir, 'video-desktop.png') });
  });
  await check('弹层播放、关闭、Escape 和焦点返回，视频未冒充学习完成', async () => {
    await page.route('**/6105_PIA25215.mp4', r => r.abort());
    const cover = page.getByRole('button', { name: /^播放视频：/ });
    await cover.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('button', { name: '关闭视频' })).toBeFocused();
    await expect(dialog.locator('video')).toHaveAttribute('src', /6105_PIA25215/);
    await page.getByRole('button', { name: '关闭视频' }).press('Escape');
    await expect(dialog).toHaveCount(0); await expect(cover).toBeFocused();
    await expect(page.locator('video')).toHaveCount(0);
    await expect(page.locator('[data-course-progress]')).toHaveText('0 / 4');
  });
  await check('播放失败可重试，保留观察问题、来源及中文替代任务', async () => {
    await page.getByRole('button', { name: /^播放视频：/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('此视频暂时无法播放');
    await expect(dialog).toContainText('暂停一次，找出一块岩石');
    await page.getByRole('button', { name: '重新加载视频' }).click();
    await expect(dialog).toContainText('此视频暂时无法播放');
    await expect(dialog.getByRole('link')).toHaveAttribute('href', /science.nasa.gov/);
    // Native modal keyboard traversal cannot reach the notebook behind it.
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => document.activeElement === document.body || Boolean(document.activeElement?.closest('dialog')))).toBe(true);
    }
    await page.screenshot({ path: path.join(dir, 'video-error-dialog.png') });
    await page.getByRole('button', { name: '关闭视频' }).click();
    await page.locator('#lesson-videos summary').click();
    await expect(page.locator('#lesson-videos')).toContainText('未观看视频');
  });
  await check('四节点使用不同官方封面，节点表单仍可访问', async () => {
    const covers = new Set();
    for (const id of ['M01', 'M02', 'M03', 'M04']) {
      await page.locator(`[aria-label="课程学习路径"] a[href="?node=${id}"]`).click();
      await expect(page.locator('[data-module]')).toHaveAttribute('data-module', id);
      covers.add(await page.locator('[data-course-video] img').getAttribute('src'));
      await expect(page.locator('[data-guided-notebook]')).toHaveAttribute('data-guided-notebook', id);
    }
    expect(covers.size).toBe(4);
  });
  await check('封面网络失败仍可播放和阅读，不留破图', async () => {
    const offline = await browser.newContext();
    await offline.route('**/cq5dam.web.1280.1280.jpeg', r => r.abort());
    const p = await offline.newPage();
    await p.goto(route + '?node=M03');
    await p.locator('[data-course-video]').scrollIntoViewIfNeeded();
    await expect(p.locator('[data-course-video]')).toContainText('视频预览');
    await expect(p.locator('[data-course-video] img')).toHaveCount(0);
    await p.getByRole('button', { name: /^播放视频：/ }).click();
    await expect(p.getByRole('dialog').locator('video')).toHaveAttribute('src', /PIA26073/);
    await p.getByRole('button', { name: '关闭视频' }).click();
    await offline.close();
  });
  await check('手机视频、弹层、资料与输入无横向溢出', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(route + '#lesson-videos');
    await page.locator('[data-course-video]').scrollIntoViewIfNeeded();
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(await overflow()).toBe(false);
    await page.screenshot({ path: path.join(dir, 'video-mobile.png') });
    await page.getByRole('button', { name: /^播放视频：/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const box = await page.getByRole('dialog').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(390);
    await page.screenshot({ path: path.join(dir, 'video-dialog-mobile.png') });
    await page.getByRole('button', { name: '关闭视频' }).click();
    await page.locator('#lesson-notebook').scrollIntoViewIfNeeded();
    expect(await overflow()).toBe(false);
    await page.locator('#lesson-notebook').screenshot({ path: path.join(dir, 'notebook-mobile.png') });
    await expect(page.locator('[data-response-progress]')).toHaveText('0 / 2 步已写好');
  });
  expect(errors).toEqual([]);
} catch (error) {
  process.exitCode = 1; console.error(error); results.push({ passed: false, error: String(error) });
  await page.screenshot({ path: path.join(dir, 'failure.png') }).catch(() => {});
} finally {
  await fs.writeFile(path.join(dir, 'verification.json'), JSON.stringify({ results, errors }, null, 2));
  await browser.close();
}
