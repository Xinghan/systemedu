import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const origin = 'http://localhost:4000';
const route = origin + '/explore/space-exploration/write-driving-rules';
const data = JSON.parse(await fs.readFile('packages/student-web/public/project-lines/space-exploration/write-driving-rules/course/tree/knowledge_tree.json'));
const { users: [user] } = JSON.parse(await fs.readFile('/private/tmp/learning-records-e2e.json'));
const dir = path.resolve('artifacts/guided-response'); await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({ args: ['--no-proxy-server'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await context.newPage();
const results = [], errors = [];
page.on('pageerror', error => errors.push(String(error)));
async function check(name, work) { try { await work(); results.push({ name, passed: true }); console.log('PASS ' + name); } catch (error) { results.push({ name, passed: false, error: String(error) }); throw error; } }
async function choose(p, label, value) { await p.getByRole('group', { name: label, exact: true }).getByRole('radio', { name: value, exact: true }).check(); }
async function text(p, label, value) { await p.getByLabel(label, { exact: true }).fill(value); }
async function ready(p, module = 'M01') { await p.goto(route + '?node=' + module); await expect(p.locator('[data-guided-notebook] [data-learning-status]')).not.toContainText('正在读取'); await expect(p.locator('[data-response-progress]')).toBeVisible(); }
async function firstNode(p) {
  await choose(p, '我看到的地形', '岩石');
  await text(p, '我担心……', '石块可能挡住车轮。');
  await choose(p, '我准备让车……', '沿已知侧道绕行');
  await p.getByRole('button', { name: '继续下一步', exact: true }).click();
  await text(p, '我还不知道……', '前面的地面是否有坑。');
  await text(p, '我会先……', '停下来，补充地面观测。');
}
try {
  await check('默认只有一步展开，示例不代填，下载收进选项', async () => {
    await ready(page);
    await expect(page.locator('[data-response-progress]')).toHaveText('0 / 2 步已写好');
    await expect(page.locator('input[type=radio]:checked')).toHaveCount(0);
    await expect(page.locator('textarea:visible')).toHaveCount(0);
    await expect(page.getByLabel('表达示例').first()).toContainText('水洼');
    await expect(page.getByRole('button', { name: '提交本节学习记录', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: '下载课程记录', exact: true })).toBeHidden();
    await expect(page.getByRole('button', { name: '下载当前记录', exact: true })).toBeHidden();
    await expect(page.locator('[data-response-step] h4 button[aria-expanded=true]')).toHaveCount(1);
    await page.locator('[data-guided-notebook]').screenshot({ path: path.join(dir, 'empty-notebook-desktop.png') });
  });
  await check('选择不能代替理由，完整填写才计入进度；刷新恢复结构', async () => {
    await choose(page, '我看到的地形', '岩石'); await choose(page, '我准备让车……', '沿已知侧道绕行');
    await expect(page.locator('[data-response-progress]')).toHaveText('0 / 2 步已写好');
    await expect(page.getByRole('button', { name: '继续下一步', exact: true })).toBeDisabled();
    await text(page, '我担心……', '石块可能挡住车轮。');
    await expect(page.locator('[data-response-progress]')).toHaveText('1 / 2 步已写好');
    await page.getByRole('button', { name: '继续下一步', exact: true }).click();
    await expect(page.locator('[data-response-step]').nth(1).locator('h4 button')).toBeFocused();
    await text(page, '我还不知道……', '前面的地面是否有坑。'); await text(page, '我会先……', '停下来，补充地面观测。');
    await page.getByRole('button', { name: '提交本节学习记录', exact: true }).click();
    await expect(page.locator('[data-course-progress]')).toHaveText('1 / 4');
    await page.reload(); await expect(page.getByLabel('我担心……', { exact: true })).toHaveValue('石块可能挡住车轮。');
    await expect(page.getByRole('radio', { name: '岩石', exact: true })).toBeChecked();
    await expect(page.locator('[data-response-progress]')).toHaveText('2 / 2 步已写好');
    await page.locator('[data-guided-notebook]').screenshot({ path: path.join(dir, 'filled-notebook-desktop.png') });
  });
  await check('其余节点分别使用条件规则、前后对照与作品说明', async () => {
    await ready(page, 'M02'); await choose(page, '如果看到……', '软沙'); await choose(page, '就让车……', '慢行');
    await page.getByRole('button', { name: '继续下一步', exact: true }).click();
    await text(page, '运行前：我预测……', '软沙可能让快行的轮子打滑。'); await text(page, '运行后：我实际看到……', '日志显示进入软沙后打滑。');
    await expect(page.locator('[data-response-progress]')).toHaveText('2 / 2 步已写好');
    await page.locator('[data-guided-notebook]').screenshot({ path: path.join(dir, 'prediction-comparison.png') });
    await ready(page, 'M03');
    for (const [label, value] of [['我只改了……','软沙由前进改成慢行'],['我保持不变的是……','同一条训练路线'],['修改前实际发生……','软沙打滑'],['修改后实际发生……','越过软沙，随后停在石块前']]) await text(page, label, value);
    await page.locator('[data-guided-notebook]').screenshot({ path: path.join(dir, 'experiment-comparison.png') });
    await page.getByRole('button', { name: '继续下一步', exact: true }).click();
    await text(page, '还要换路测试，因为……', '地形顺序可能不同'); await text(page, '两条通过后，我仍不知道……', '真实坡道上是否安全');
    await expect(page.locator('[data-response-progress]')).toHaveText('2 / 2 步已写好');
    await ready(page, 'M04'); await choose(page, '看不清地面时，我让车……', '停下确认'); await text(page, '继续之前，我需要确认……', '前方是否可通行');
    await page.getByRole('button', { name: '继续下一步', exact: true }).click();
    await text(page, '我完成了……', '修改了软沙和未知地形规则'); await text(page, '我实际测试了……', '当前规则的训练路线与换路测试'); await text(page, '平台已经提供了……', '地形标签和实验场景');
    await expect(page.locator('[data-response-progress]')).toHaveText('2 / 2 步已写好');
    await expect(page.locator('[data-module]')).not.toContainText('下载课程学习记录，和规则文件一起展示');
  });
  await check('旧文字记录原样恢复，不猜测拆分或填入默认选择', async () => {
    const legacy = await browser.newContext();
    const scope = { library_slug: data.id, module_id: 'M01', activity_id: 'reflection', kind: 'classroom', content_version: data.version };
    const answers = data.modules[0].questions.map((question, i) => ({ question_id: `q${i+1}`, question, answer: ['以前写的一整段观察，保留换行。\n第二行。','以前的未知地形解释。'][i] }));
    await legacy.addInitScript(({scope,answers}) => localStorage.setItem('systemedu:learning:v1:guest:' + encodeURIComponent(JSON.stringify(scope)), JSON.stringify({version:1,body:{answers},revision:0,dirty:false})), {scope,answers});
    const old = await legacy.newPage(); await ready(old);
    await expect(old.locator('[data-free-answer]').first()).toHaveValue(answers[0].answer);
    await expect(old.locator('input[type=radio]:checked')).toHaveCount(0);
    await expect(old.locator('[data-response-progress]')).toHaveText('2 / 2 步已写好');
    await old.locator('[data-response-step]').nth(1).locator('h4 button').click();
    await expect(old.locator('[data-free-answer]').nth(1)).toHaveValue(answers[1].answer);
    await legacy.close();
  });
  await check('账号保存完整结构，另一浏览器恢复选择与文字', async () => {
    const c = await browser.newContext(); await c.addInitScript(token => localStorage.setItem('systemedu_token', token), user.token);
    const p = await c.newPage(); await ready(p); await expect(p.locator('[data-learning-status]')).toContainText('已连接账号');
    await firstNode(p); await p.getByRole('button', { name: '提交本节学习记录', exact: true }).click(); await expect(p.locator('[data-learning-status]')).toContainText('已提交到账号');
    const fresh = await browser.newContext(); await fresh.addInitScript(token => localStorage.setItem('systemedu_token', token), user.token);
    const restored = await fresh.newPage(); await ready(restored); await expect(restored.locator('[data-learning-status]')).toContainText('已读取账号');
    await expect(restored.getByRole('radio', { name: '岩石', exact: true })).toBeChecked();
    await expect(restored.getByLabel('我担心……', { exact: true })).toHaveValue('石块可能挡住车轮。');
    await expect(restored.locator('[data-response-progress]')).toHaveText('2 / 2 步已写好');
    await expect(restored.getByRole('button', { name: '重试同步', exact: true })).toHaveCount(0);
    await restored.locator('[data-guided-notebook]').screenshot({ path: path.join(dir, 'account-restored.png') });
    await c.close(); await fresh.close();
  });
  await check('手机无横向溢出，选择可用键盘，备份仍可主动找到', async () => {
    await page.setViewportSize({ width:390,height:844 }); await ready(page);
    await page.getByRole('group', { name:'我看到的地形',exact:true }).getByRole('radio', { name:'岩石',exact:true }).focus();
    await page.keyboard.press('ArrowRight'); await expect(page.getByRole('radio', { name:'看不清地面',exact:true })).toBeChecked();
    await choose(page, '我看到的地形', '岩石');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('[data-guided-notebook]').screenshot({ path: path.join(dir,'notebook-mobile.png') });
    await page.getByText('课程记录选项', {exact:true}).click(); await expect(page.getByRole('button',{name:'下载课程记录',exact:true})).toBeVisible();
  });
  expect(errors).toEqual([]);
} catch(error) { console.error(error); process.exitCode=1; await page.screenshot({path:path.join(dir,'failure.png'),fullPage:true}).catch(()=>{}); }
finally { await fs.writeFile(path.join(dir,'verification.json'), JSON.stringify({at:new Date().toISOString(),source:'automated-tests-not-child-usability-trial',results,errors},null,2)); await browser.close(); }
