import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const credentials = JSON.parse(await fs.readFile('/private/tmp/learning-records-e2e.json', 'utf8'));
const [a, b] = credentials.users;
const origin = 'http://localhost:4000', backend = 'http://127.0.0.1:18820';
const courseUrl = origin + '/explore/space-exploration/write-driving-rules';
const scope = { library_slug: 'write-driving-rules', module_id: 'M01', activity_id: 'reflection', kind: 'classroom', content_version: '1.0' };
const dir = path.resolve('artifacts/learning-records'); await fs.mkdir(dir, { recursive: true });
const fixtureDir = path.resolve('packages/student-web/src/app/records-verification-local');
// 临时挂载真实题目组件，测试后只删除本脚本创建的页面，不修改课程材料。
try { await fs.access(fixtureDir); throw new Error('Verification fixture path already exists'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
await fs.mkdir(fixtureDir);
await fs.writeFile(path.join(fixtureDir, 'page.tsx'), `"use client"
import { PersistentQuestion, PersistentTheoryQuiz } from "@/components/learning/persistent-question"
import { AssignmentView } from "@/components/learning/assignment-view"
import type { KnodeInfo } from "@/lib/types/api"
const knode = { id:0, module_id:"M02", title:"交付", summary:"", difficulty_level:2, content_type:"lesson", acceptance_type:"assignment", estimated_minutes:15, xp_reward:0, prerequisite_indices:[] } satisfies KnodeInfo
const markdown = "## 选择题\\n**1. 先做什么？**\\nA. 观察\\nB. 随机前进\\n\\n**答案：A**\\n\\n## 问答题\\n**1. 为什么观察？**\\n\\n**参考答案要点：**\\n- 获得信息"
export default function Page() { return <main style={{padding:40}}>
<PersistentQuestion projectName="records-fixture" moduleId="M01" activityId="assignment-question" question="为什么先停下？" />
<PersistentQuestion projectName="records-fixture" moduleId="M01" activityId="quiz-question" kind="quiz" question="未知地形怎样处理？" options={[{value:"go",label:"继续"},{value:"stop",label:"停止"}]} correctAnswer="stop" explanation="信息不足先停下。" />
<PersistentQuestion projectName="records-fixture" moduleId="M01" activityId="exam-question" kind="exam" question="考试：解释判断依据" />
<div data-assignment-fixture><AssignmentView projectName="records-fixture" knode={knode} content={markdown} /></div>
<div data-theory-fixture><PersistentTheoryQuiz projectName="records-fixture" moduleId="M02" theoryId="observation" exercises={[{question:"未知时？",options:["停下","继续"],correct:0}]} /></div>
<AssignmentView projectName="records-fixture" knode={{...knode,module_id:"M03",module_role:"capstone",acceptance_artifacts:[{artifact_id:"report",title:"测试报告",description:"记录测试",format:"链接"}],acceptance_standard:["解释自己的选择"]}} content="## 成果交付" />
</main> }
`);
const browser = await chromium.launch({ args: ['--no-proxy-server'] });
const contexts = [], results = [], errors = [];
async function loggedIn(user) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 980 }, acceptDownloads: true }); contexts.push(context);
  await context.addInitScript(token => { if (!sessionStorage.getItem('e2e-seeded')) { localStorage.setItem('systemedu_token', token); sessionStorage.setItem('e2e-seeded', 'yes'); } }, user.token);
  const page = await context.newPage(); page.on('pageerror', e => errors.push(String(e))); return page;
}
async function read(user, s = scope) {
  const response = await fetch(backend + '/api/learning/records?' + new URLSearchParams(s), { headers: { Authorization: 'Bearer ' + user.token } });
  expect(response.status).toBe(200); return response.json();
}
async function check(name, task) { try { await task(); results.push({ name, passed: true }); console.log('PASS ' + name); } catch (error) { results.push({ name, passed: false, error: String(error) }); throw error; } }
let page;
try {
  page = await loggedIn(a);
  await check('课堂输入自动保存到账号；提交留快照；另一浏览器恢复', async () => {
    await page.goto(courseUrl); await expect(page.locator('[data-learning-status]')).toContainText('已连接账号');
    await page.locator('textarea').nth(0).fill('岩石输入，碰撞风险，沿已知侧道绕行。');
    await page.locator('textarea').nth(1).fill('未知表示信息不足，先停止。');
    await expect(page.locator('[data-learning-status]')).toContainText('已保存到账号');
    expect((await read(a)).draft.body.answers[1].answer).toBe('未知表示信息不足，先停止。');
    await page.getByRole('button', { name: '提交本节学习记录', exact: true }).click();
    await expect(page.locator('[data-learning-status]')).toContainText('已提交到账号');
    await expect(page.locator('[data-course-progress]')).toHaveText('1 / 4');
    const fresh = await loggedIn(a); await fresh.goto(courseUrl);
    await expect(fresh.locator('textarea').first()).toHaveValue('岩石输入，碰撞风险，沿已知侧道绕行。');
    await expect(fresh.locator('[data-course-progress]')).toHaveText('1 / 4');
    const other = await loggedIn(b); await other.goto(courseUrl);
    await expect(other.locator('[data-learning-status]')).toContainText('已连接账号');
    await expect(other.locator('textarea').first()).toHaveValue('');
    await fresh.close(); await other.close();
  });
  await check('双设备旧版本写入被拒绝，当前输入保留并可读取新版本', async () => {
    const stale = await loggedIn(a); await stale.goto(courseUrl);
    await expect(stale.locator('textarea').first()).toHaveValue(/岩石输入/);
    await page.locator('textarea').first().fill('设备一的新观察');
    await expect(page.locator('[data-learning-status]')).toContainText('已保存到账号');
    await stale.locator('textarea').first().fill('设备二未同步的观察');
    await expect(stale.locator('[data-learning-status]')).toContainText('没有覆盖');
    await expect(stale.locator('textarea').first()).toHaveValue('设备二未同步的观察');
    expect((await read(a)).draft.body.answers[0].answer).toBe('设备一的新观察');
    const pending = stale.waitForEvent('download'); await stale.getByRole('button', { name: '下载当前记录', exact: true }).click();
    await (await pending).saveAs(path.join(dir, 'conflict-draft.json'));
    await stale.getByRole('button', { name: '读取服务器版本（替换本机草稿）' }).click();
    await expect(stale.locator('textarea').first()).toHaveValue('设备一的新观察'); await stale.close();
  });
  await check('服务器已收到但响应丢失，重试不会产生重复提交', async () => {
    const count = (await read(a)).submissions.length;
    await page.route('**/api/learning/submissions', async route => { await route.fetch(); await route.abort(); }, { times: 1 });
    await page.getByRole('button', { name: '提交本节学习记录', exact: true }).click();
    await expect(page.locator('[data-learning-status]')).toContainText('当前内容仍保留');
    await page.getByRole('button', { name: '重试本次提交', exact: true }).first().click();
    await expect(page.locator('[data-learning-status]')).toContainText('已提交到账号');
    expect((await read(a)).submissions).toHaveLength(count + 1);
  });
  await check('网络保存失败有提示，重试保存成功', async () => {
    await page.route('**/api/learning/drafts', route => route.abort(), { times: 1 });
    await page.locator('textarea').first().fill('断线时仍保留的记录');
    await expect(page.locator('[data-learning-status]')).toContainText('当前内容仍保留');
    await page.getByRole('button', { name: '重试同步', exact: true }).click();
    await expect(page.locator('[data-learning-status]')).toContainText('已保存到账号');
    expect((await read(a)).draft.body.answers[0].answer).toBe('断线时仍保留的记录');
  });
  await check('同一浏览器切换账号不会显示或上传上一个孩子的输入', async () => {
    await page.evaluate(token => { localStorage.setItem('systemedu_token', token); window.dispatchEvent(new Event('storage')); }, b.token);
    await expect(page.locator('[data-learning-status]')).toContainText('已连接账号');
    await expect(page.locator('textarea').first()).toHaveValue('');
    await page.locator('textarea').first().fill('孩子B独立记录');
    await expect(page.locator('[data-learning-status]')).toContainText('已保存到账号');
    expect((await read(a)).draft.body.answers[0].answer).toBe('断线时仍保留的记录');
    expect((await read(b)).draft.body.answers[0].answer).toBe('孩子B独立记录');
  });
  await check('旧匿名记录不自动上传，主动导入后作为新草稿保存', async () => {
    await page.evaluate(() => localStorage.setItem('systemedu:guided-course:write-driving-rules:v1', JSON.stringify({ schema_version: 'guided-learning-record/1', course_id: 'write-driving-rules', course_version: '1.0', nodes: { M02: { answers: ['以前的条件规则','以前的预测'] } } })));
    await page.goto(courseUrl + '?node=M02'); await expect(page.locator('[data-learning-status]')).toContainText('已连接账号');
    await expect(page.locator('textarea').first()).toHaveValue('');
    expect((await read(b, { ...scope, module_id: 'M02' })).draft).toBeNull();
    await page.getByRole('button', { name: '将本机旧记录作为我的草稿' }).click();
    await expect(page.locator('textarea').first()).toHaveValue('以前的条件规则');
    await expect(page.locator('[data-learning-status]')).toContainText('已保存到账号');
  });
  await check('作业、测验、考试组件真实写库，刷新恢复且不伪造考试评分', async () => {
    await page.goto(origin + '/records-verification-local');
    const assignment = page.locator('[data-persistent-question="assignment-question"]');
    const quiz = page.locator('[data-persistent-question="quiz-question"]');
    const exam = page.locator('[data-persistent-question="exam-question"]');
    for (const item of [assignment, quiz, exam]) await expect(item.locator('[data-learning-status]')).toContainText('已连接账号');
    await assignment.locator('textarea').fill('先确认环境信息，再决定动作。'); await assignment.getByRole('button', { name: '提交答案', exact: true }).click();
    await quiz.getByRole('button', { name: '停止', exact: true }).click(); await quiz.getByRole('button', { name: '提交答案', exact: true }).click();
    await exam.locator('textarea').fill('根据观测信息判断，未知时不冒进。'); await exam.getByRole('button', { name: '提交答案', exact: true }).click();
    for (const item of [assignment, quiz, exam]) await expect(item.locator('[data-learning-status]')).toContainText('已提交到账号');
    await expect(exam).toContainText('尚未评分');
    await page.reload(); await expect(assignment.locator('textarea')).toHaveValue('先确认环境信息，再决定动作。');
    await expect(quiz.getByRole('button', { name: '停止', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(exam.locator('textarea')).toHaveValue('根据观测信息判断，未知时不冒进。');
    for (const item of [assignment, quiz, exam]) await expect(item.locator('[data-learning-status]')).toContainText('已读取账号');
    await page.screenshot({ path: path.join(dir, 'assessment-restored.png'), fullPage: true });
  });
  await check('旧作业解析、理论自测与项目交付清单均保存并恢复', async () => {
    const choice = page.locator('[data-persistent-question="assignment_choice_1"]');
    const qa = page.locator('[data-persistent-question="assignment_qa_1"]');
    await choice.getByRole('button', { name: 'A. 观察', exact: true }).click();
    await choice.getByRole('button', { name: '提交答案', exact: true }).click();
    await qa.locator('textarea').fill('观察能获取做决定所需的信息。');
    await qa.getByRole('button', { name: '提交答案', exact: true }).click();
    await page.locator('[data-theory-fixture]').getByRole('button', { name: '自测 · 1 题' }).click();
    const theory = page.locator('[data-persistent-question="observation_q0"]');
    await expect(theory.locator('[data-learning-status]')).toContainText('已连接账号');
    await theory.getByRole('button', { name: '停下', exact: true }).click();
    await theory.getByRole('button', { name: '提交答案', exact: true }).click();
    const capstone = page.locator('[data-capstone-record]');
    await capstone.getByRole('checkbox').check();
    await capstone.locator('textarea').nth(0).fill('测试报告已完成；还需要实地验证。');
    await capstone.locator('textarea').nth(1).fill('先观察再行动，记录未知信息。');
    await capstone.getByRole('button', { name: '提交项目交付', exact: true }).click();
    for (const item of [choice, qa, theory, capstone]) await expect(item.locator('[data-learning-status]')).toContainText('已提交到账号');
    await page.reload();
    await expect(choice.getByRole('button', { name: 'A. 观察', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(qa.locator('textarea')).toHaveValue('观察能获取做决定所需的信息。');
    await expect(capstone.getByRole('checkbox')).toBeChecked();
    await expect(capstone.locator('textarea').nth(1)).toHaveValue('先观察再行动，记录未知信息。');
    await page.locator('[data-theory-fixture]').getByRole('button', { name: '自测 · 1 题' }).click();
    await expect(theory.getByRole('button', { name: '停下', exact: true })).toHaveAttribute('aria-pressed', 'true');
    for (const item of [choice, qa, theory, capstone]) await expect(item.locator('[data-learning-status]')).toContainText('已读取账号');
    await page.screenshot({ path: path.join(dir, 'assignment-capstone-restored.png'), fullPage: true });
  });
  await page.goto(courseUrl + '?node=M02'); await expect(page.locator('textarea').first()).toHaveValue('以前的条件规则');
  await page.screenshot({ path: path.join(dir, 'classroom-account.png'), fullPage: true });
  expect(errors).toEqual([]);
} catch (error) { console.error(error); process.exitCode = 1; await page?.screenshot({ path: path.join(dir, 'failure.png'), fullPage: true }).catch(() => {}); }
finally {
  await fs.writeFile(path.join(dir, 'verification.json'), JSON.stringify({ run_at: new Date().toISOString(), source: 'real-local-api-isolated-test-accounts', results, errors }, null, 2));
  await browser.close(); await fs.rm(path.join(fixtureDir, 'page.tsx')); await fs.rmdir(fixtureDir);
}
