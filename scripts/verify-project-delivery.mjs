import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const url = 'http://localhost:4000/explore/space-exploration/write-driving-rules';
const { users: [user, other] } = JSON.parse(await fs.readFile('/private/tmp/learning-records-e2e.json'));
const scope = { library_slug: 'write-driving-rules', module_id: 'M04', activity_id: 'final-deliverable', kind: 'assignment', content_version: '1.0' };
const dir = path.resolve('artifacts/project-delivery'); await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({ args: ['--no-proxy-server'] });
const context = await browser.newContext({ viewport: { width:1440,height:1100 } });
await context.addInitScript(token => localStorage.setItem('systemedu_token', token), user.token);
const page = await context.newPage(); const results = [], errors = [];
page.on('pageerror', error => errors.push(String(error)));
const delivery = page.locator('[data-project-delivery]');
async function check(name, run) { try { await run(); results.push({name,passed:true}); console.log('PASS '+name); } catch(error) { results.push({name,passed:false,error:String(error)}); throw error; } }
async function ready(p) { await expect(p.locator('[data-guided-notebook] [data-learning-status]')).not.toContainText('正在读取'); await expect(p.locator('[data-project-delivery] [data-learning-status]')).not.toContainText('正在读取'); }
async function history(p=page, token=user.token) {
  const response = await p.request.get('http://localhost:18820/api/learning/records?' + new URLSearchParams(scope), {headers:{Authorization:'Bearer '+token}});
  expect(response.ok()).toBe(true); return response.json();
}
async function explanation(p) {
  await p.getByRole('group',{name:'看不清地面时，我让车……',exact:true}).getByRole('radio',{name:'正常前进',exact:true}).check();
  await p.getByLabel('继续之前，我需要确认……',{exact:true}).fill('需要确认地形和侧方可通行范围。');
  await p.getByRole('button',{name:'继续下一步',exact:true}).click();
  await p.getByLabel('我完成了……',{exact:true}).fill('我修改了沙地、岩石和未知输入对应的动作。');
  await p.getByLabel('我实际测试了……',{exact:true}).fill('同一版规则的训练路线和换路测试。');
  await p.getByLabel('平台已经提供了……',{exact:true}).fill('地形标签、平整侧道、动作执行器和两条路线。');
}
try {
  await check('开课即看见最终作品与验收目标，空作品不能交付', async()=>{
    await page.goto(url);
    await expect(page.getByRole('region',{name:'最终作品目标'})).toContainText('双路线测试证据');
    await page.getByRole('link',{name:'查看我的最终作品'}).click(); await ready(page);
    await expect(delivery.getByRole('button',{name:'提交项目作品',exact:true})).toBeDisabled();
    await expect(delivery.locator('[data-delivery-check][data-passed=false]')).toHaveCount(3);
    await expect(delivery).toContainText('待完成');
    await delivery.screenshot({path:path.join(dir,'empty-delivery.png')});
  });
  await check('说明不能代替作品，已选择的矛盾动作会提示修正', async()=>{
    await explanation(page);
    await expect(delivery.locator('[data-delivery-check=explanation]')).toContainText('动作与停止规则不一致');
    await page.locator('[data-response-step]').first().locator('h4 button').click();
    await page.getByRole('radio',{name:'停下确认',exact:true}).check();
    await expect(delivery.locator('[data-delivery-check=explanation]')).toHaveAttribute('data-passed','true');
    await expect(delivery.getByRole('button',{name:'提交项目作品',exact:true})).toBeDisabled();
  });
  await check('真实实验失败、修正规则并跑两条路线，关联后可查看逐步证据', async()=>{
    await page.getByRole('button',{name:'打开本节实验'}).click();
    const frame = page.frameLocator('iframe[title="驾驶规则实验工具"]');
    await expect(frame.locator('#render-mode')).not.toContainText('正在准备');
    async function run(id) { await frame.locator('#run-'+id).click(); await expect(frame.locator('#run-'+id)).toBeEnabled({timeout:25000}); }
    await frame.locator('#baseline').click(); await run('training');
    await expect(frame.locator('#log')).toContainText('打滑');
    for (const [terrain,action] of [['sand','slow'],['rock','detour'],['unknown','stop']]) await frame.locator('#rule-'+terrain).selectOption(action);
    await run('training'); await run('transfer'); await frame.locator('#save').click();
    await delivery.getByRole('button',{name:'关联实验作品',exact:true}).click();
    await expect(delivery.locator('[data-delivery-check][data-passed=true]')).toHaveCount(3);
    await delivery.locator('[data-delivery-preview] summary').first().click();
    await expect(delivery.locator('[data-delivery-preview]')).toContainText('未知地形前停下求助');
    await expect(page.locator('[data-guided-notebook] [data-learning-status]')).toContainText('已保存到账号');
    await delivery.screenshot({path:path.join(dir,'ready-delivery.png')});
  });
  await check('最终作品独立提交并入库，丢失响应重试不会重复交付', async()=>{
    let drop=true;
    await page.route('**/api/learning/submissions',async route=>{
      if (drop && route.request().postDataJSON().activity_id==='final-deliverable') { drop=false; await route.fetch(); await route.abort(); }
      else await route.continue();
    });
    await delivery.getByRole('button',{name:'提交项目作品',exact:true}).click();
    await expect(delivery.getByRole('button',{name:'重试上次交付',exact:true})).toBeEnabled();
    await delivery.getByRole('button',{name:'重试上次交付',exact:true}).click();
    await expect(delivery.locator('[data-delivery-state]')).toContainText('已提交到账号');
    const data=await history(); expect(data.submissions).toHaveLength(1);
    expect(data.submissions[0].kind).toBe('assignment'); expect(data.submissions[0].body.artifact.program.rules.unknown).toBe('stop');
    expect(data.submissions[0].body.client_context.delivery.assessment).toBe('ungraded');
    await expect(page.locator('[data-course-progress]')).toHaveText('0 / 4');
    await page.unroute('**/api/learning/submissions');
  });
  await check('改写笔记保留已交付版本，另一浏览器可查看完整作品，其他账号不串数据', async()=>{
    const original=(await history()).submissions[0].body.answers[1].answer;
    await page.locator('[data-response-step]').nth(1).locator('h4 button').click();
    await page.getByLabel('我完成了……',{exact:true}).fill('补充说明：还尝试过全前进规则，发现沙地会打滑。');
    await expect(delivery).toContainText('当前内容与上次交付不同');
    await expect(page.locator('[data-guided-notebook] [data-learning-status]')).toContainText('已保存到账号');
    expect((await history()).submissions[0].body.answers[1].answer).toBe(original);
    const fresh=await browser.newContext(); await fresh.addInitScript(token=>localStorage.setItem('systemedu_token',token),user.token);
    const p=await fresh.newPage(); await p.goto(url+'?node=M04'); await ready(p);
    await p.locator('[data-delivered-version]>summary').click();
    await expect(p.locator('[data-delivered-version]')).toContainText(original);
    await expect(p.locator('[data-delivered-version] [data-delivery-preview]')).toContainText('沿已知侧道绕行');
    const foreign=await history(p,other.token); expect(foreign.draft).toBeNull(); expect(foreign.submissions).toHaveLength(0);
    await fresh.close();
  });
  await check('伪造通过标记、缺失测试轨迹无法作为可交付作品', async()=>{
    const artifact=(await history()).submissions[0].body.artifact;
    artifact.evidence.runs.forEach(r=>{r.passed=true;r.trace=[]});
    await page.evaluate(value=>localStorage.setItem('systemedu:write-driving-rules:v1',JSON.stringify([value])),artifact);
    await delivery.getByRole('button',{name:'关联实验作品',exact:true}).click();
    await expect(delivery).toContainText('还没找到实际通过两条路线');
    // The rejected candidate must not replace the already verified attachment.
    await expect(delivery.locator('[data-delivery-preview]').first()).toContainText('已通过');
    expect((await history()).submissions).toHaveLength(1);
  });
  await check('手机作品区无横向溢出，匿名状态明确只保存本机', async()=>{
    await page.setViewportSize({width:390,height:844});
    await delivery.scrollIntoViewIfNeeded();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await delivery.screenshot({path:path.join(dir,'delivery-mobile.png')});
    const guest=await browser.newContext(); const p=await guest.newPage(); await p.goto(url+'?node=M04'); await ready(p);
    await expect(p.locator('[data-project-delivery]').getByRole('button',{name:'保存项目作品到本机',exact:true})).toBeDisabled();
    await expect(p.locator('[data-project-delivery] [data-learning-status]')).toContainText('未登录');
    await guest.close();
  });
  expect(errors).toEqual([]);
} catch(error) {console.error(error);process.exitCode=1;await page.screenshot({path:path.join(dir,'failure.png'),fullPage:true}).catch(()=>{});}
finally {await fs.writeFile(path.join(dir,'verification.json'),JSON.stringify({results,errors},null,2));await browser.close();}
