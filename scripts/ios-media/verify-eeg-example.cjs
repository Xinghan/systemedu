const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../..'), root = process.argv[2] || path.join(repo, 'packages/learning-runtime/dist');
const { chromium } = require(path.join(repo, 'node_modules/playwright'));
const out = path.join(repo, 'artifacts/eeg-mobile-example');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'content/catalog.json')));
const node = catalog.courses.find(c => c.id === 'eeg-minecraft-bci').modules.find(n => n.moduleId === 'M03');
const lesson = JSON.parse(fs.readFileSync(path.join(root, node.path)));
const media = lesson.interactions.filter(i => ['animation', 'game'].includes(i.mode));
assert.ok(media.every(i => i.presentation_platform === 'ios'));
const workspaceKey = 'systemedu:runtime-workspace:v1:' + node.id.split(':').slice(1, 3).join(':');
const animationKey = 'ios:eeg-minecraft-bci:M03:anim_1779469418332_jvvy:r1';
const gameKey = 'ios:eeg-minecraft-bci:M03:game_1779469418332_acvr:r1';
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(root + '/') || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2' })[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
async function geometry(frame) {
  return frame.locator('body').evaluate(body => {
    const outside = [...body.querySelectorAll('main button,main input,main .chart,main .caption')].filter(el => {
      const r = el.getBoundingClientRect(); return r.width && r.height && (r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1);
    }).map(el => el.id || el.className);
    const small = [...body.querySelectorAll('main button')].filter(el => { const r = el.getBoundingClientRect(); return r.width < 43 || r.height < 43; }).map(el => el.id || el.className);
    return { outside, small, horizontalOverflow: body.scrollWidth > innerWidth + 1, verticalOverflow: body.scrollHeight > innerHeight + 1 };
  });
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true }), errors = [], requests = [], sizes = [[320,568],[390,704],[320,352],[704,390]];
  try {
    for (const [width,height] of sizes) {
      const context = await browser.newContext({ viewport: { width,height }, reducedMotion: 'reduce', hasTouch: true });
      const page = await context.newPage();page.on('pageerror', e => errors.push(e.message));
      page.on('request', r => requests.push(r.url()));
      const url=`http://127.0.0.1:${server.address().port}/index.html?activity=${node.id}`;
      await page.goto(url);await page.evaluate(k => localStorage.setItem(k, JSON.stringify({old_desktop_note:'keep-existing-data'})),workspaceKey);await page.reload();
      async function open(kind) {
        await page.getByRole('button',{name:'动画与互动',exact:true}).click();
        await page.getByRole('button',{name:(kind==='animation'?'打开演示：':'开始互动：')+media.find(i=>i.mode===kind).title,exact:true}).click();
        await page.locator('.mobile-activity iframe').waitFor();
        const f=page.frameLocator('.mobile-activity iframe');await f.locator('#plot').waitFor();return f;
      }
      let frame=await open('animation');
      assert.deepEqual(await geometry(frame),{outside:[],small:[],horizontalOverflow:false,verticalOverflow:false},`animation ${width}×${height}`);
      await frame.locator('#next').click();assert.equal(await frame.locator('#time').innerText(),'3.9');assert.equal(await frame.locator('#voltage').innerText(),'+20');
      const first=await frame.locator('#drawing').innerHTML();
      await frame.locator('#play').click();await frame.locator('#count').filter({hasText:'3 / 7'}).waitFor();await frame.locator('#play').click();
      const stopped=await frame.locator('#drawing').innerHTML();assert.notEqual(stopped,first);
      await page.waitForTimeout(250);assert.equal(await frame.locator('#drawing').innerHTML(),stopped,'Pause must freeze the drawing');
      await frame.locator('#help').click();await frame.locator('[data-rate="128"]').click();await frame.locator('#close-details').click();
      assert.equal(await frame.locator('#rate').innerText(),'128');
      await page.screenshot({path:path.join(out,`animation-${width}x${height}.png`)});
      if(width===390) {
        await page.emulateMedia({reducedMotion:'no-preference'});
        while((await frame.locator('#count').innerText())!=='6 / 7') await frame.locator('#next').click();
        await frame.locator('#play').click();
        await frame.locator('#play').filter({hasText:'重新播放'}).waitFor();
        assert.equal(await frame.locator('#count').innerText(),'7 / 7');
        assert.equal(await frame.locator('#time').innerText(),'46.9');
        assert.equal(await frame.locator('#voltage').innerText(),'0');
        assert.doesNotMatch(await frame.locator('#plot').innerHTML(),/NaN|undefined/);
        await frame.locator('#play').click();await frame.locator('#play').click();
        assert.notEqual(await frame.locator('#count').innerText(),'7 / 7','Replay must start from the beginning');
      }
      await page.getByRole('button',{name:'关闭面板',exact:true}).click();
      frame=await open('game');
      assert.deepEqual(await geometry(frame),{outside:[],small:[],horizontalOverflow:false,verticalOverflow:false},`game ${width}×${height}`);
      await frame.locator('#check').click();assert.match(await frame.locator('#feedback').innerText(),/0 \/ 3/);
      // Real pointer drag moves the first missing point up to +20 µV.
      const point=await frame.locator('[data-point="1"]').boundingBox(), plot=await frame.locator('#plot').boundingBox();
      await page.mouse.move(point.x+point.width/2,point.y+point.height/2);await page.mouse.down();
      await page.mouse.move(point.x+point.width/2,plot.y+23+(plot.height-38-23)/6,{steps:12});await page.mouse.up();
      assert.equal(await frame.locator('#current').innerText(),'+20 μV');
      await frame.locator('[data-record="3"]').click();await frame.locator('#minus').click();
      await frame.locator('[data-record="5"]').click();await frame.locator('#plus').click();
      await frame.locator('#check').click();assert.match(await frame.locator('#feedback').innerText(),/都已补回/);
      await page.screenshot({path:path.join(out,`game-${width}x${height}.png`)});
      await frame.locator('#help').click();await frame.locator('#undo').click();
      assert.equal(await frame.locator('#current').innerText(),'0 μV');
      await frame.locator('#help').click();await frame.locator('#hint').click();assert.equal(await frame.locator('.hint-target').count(),1);
      await frame.locator('#plus').click();await frame.locator('#check').click();
      await page.waitForFunction(({k,g})=>JSON.parse(JSON.parse(localStorage.getItem(k)||'{}')[g]||'{}').values?.join(',')==='20,-10,10',{k:workspaceKey,g:gameKey});
      await page.reload();frame=await open('game');
      assert.equal(await frame.locator('#current').innerText(),'+10 μV');
      await frame.locator('#help').click();assert.match(await frame.locator('#history').innerText(),/完成/);
      const download=page.waitForEvent('download');await frame.locator('#export').click();const file=await download;
      const exported=JSON.parse(fs.readFileSync(await file.path()));assert.equal(exported.data_kind,'constructed');assert.deepEqual(exported.values,[20,-10,10]);
      await frame.locator('#reset').click();await frame.locator('#check').click();assert.match(await frame.locator('#feedback').innerText(),/0 \/ 3/);
      const workspace=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),workspaceKey);assert.equal(workspace.old_desktop_note,'keep-existing-data');assert.ok(workspace[animationKey]);
      // Resource code and assets stay operational while networking is disabled after loading.
      await context.setOffline(true);await frame.locator('#plus').click();assert.equal(await frame.locator('#current').innerText(),'+10 μV');
      await context.close();
    }
    assert.deepEqual(errors,[]);assert.ok(requests.every(u=>u.startsWith('http://127.0.0.1:')||u.startsWith('data:')||u.startsWith('blob:')));
    fs.writeFileSync(path.join(out,'browser-verification.json'),JSON.stringify({status:'pass',viewports:sizes,checks:['layout and 44px touch targets','sample time and voltage','pause freezes animation','rate comparison','normal-motion completion and replay','real pointer drag','wrong and correct game outcomes','undo and hint','reload restores records','JSON export','old record retained','offline interaction','no remote dependencies'],errors},null,2)+'\n');
    console.log('PASS: phone layouts, animation, drag game, records and export');
  } catch(e) { console.error(e); process.exitCode=1; }
  finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
})().catch(e=>{console.error(e);process.exit(1)});
