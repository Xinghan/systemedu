const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const repo = path.resolve(__dirname, '../..'), root = path.join(repo, 'packages/learning-runtime/dist');
const out = path.join(repo, 'artifacts/space-expedition-20261126/learning-revision-round2/browser');
fs.mkdirSync(out, {recursive:true});
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const course = read(path.join(root, 'content/catalog.json')).courses.find(c => c.id === 'lightkurve-transit-detective');
const drafts = ['M01-M11','M12-M22','M23-M32'].flatMap(name => read(path.join(out, '..', 'draft-' + name + '.json')));
const server = http.createServer((req,res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(root + '/') || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', ({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'})[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`, browser = await chromium.launch();
  const errors = [], nodes = [], downloads = [];
  try {
    const page = await browser.newPage({viewport:{width:1180,height:820},hasTouch:true,reducedMotion:'reduce'});
    page.on('pageerror', error => errors.push(error.message));
    const open = async node => { await page.goto(`${origin}/index.html?activity=${node.id}&presentation=tablet`); await page.locator('.reading-card').waitFor(); };
    const section = async title => {
      await page.getByRole('button',{name:'打开课文目录'}).click();
      const item = page.locator('.contents-list button').filter({has:page.getByText(title,{exact:true})});
      const index = Number(await item.locator('span').innerText()) - 1;
      await item.click();
      await page.locator(`.reading-card[data-section="${index}"]`).waitFor();
      await page.locator('.classroom-shell[data-save-state="saved"]').waitFor();
    };
    for (const node of course.modules) {
      const lesson = read(path.join(root,node.path)), draft = drafts.find(d => d.module === lesson.module_id);
      assert.ok(draft); await open(node);
      const headings = ['本节的材料与操作位置', ...[...draft.teaching.matchAll(/^#{2,3} (.+)$/gm)].map(m => m[1])];
      for (const title of headings) {
        await section(title);
        const card = page.locator('.reading-card');
        // A raw emphasis delimiter in ordinary prose is a visible rendering defect.
        for (const paragraph of await card.locator('p').all()) {
          if (await paragraph.locator('code').count() === 0) assert.ok(!(await paragraph.innerText()).includes('**'), `${lesson.module_id}: raw emphasis in ${title}`);
        }
        for (const img of await card.locator('img').all()) {
          assert.ok(await img.evaluate(async image => {image.loading='eager';await image.decode();return image.naturalWidth > 0;}));
        }
        const screenshots = {'这一节要把每一道判断摊开看':'M08-guided-checks','先把七条构造记录放在眼前':'M08-constructed-table','从原文件取出三条真实记录':'M08-real-rows','把“每次事件”与“所有点合并”分开':'M19-events','先把每个预测留下，再谈是否相符':'M26-coverage'};
        if (screenshots[title]) { await card.evaluate(e => e.scrollTop = 0); await page.screenshot({path:path.join(out,screenshots[title]+'.png')}); }
      }
      nodes.push({module:lesson.module_id, added_sections_opened:headings.length, images_decoded:true});
      console.log(`${lesson.module_id}: ${headings.length} added sections checked`);
    }
    const node = course.modules[0], lesson = read(path.join(root,node.path));
    const key = `systemedu:runtime-preview:v1:${node.id}`;
    const workspaceKey = `systemedu:runtime-workspace:v1:${node.id.split(':').slice(1,3).join(':')}`;
    const old = {content_revision:'beginner-20261126',note:'旧版笔记：缺测不能画成零。', answers:{'quiz:q1':'1','theory:theory_m01_1:0.2.0:0':'1','theory:theory_m01_1:beginner-20261126:0':'1'}, self_completed:true, page_index:4, reader_page:'s3-p1', shared_workspace:{'legacy-observation':JSON.stringify({target:'Kepler-10',geometry:'edge-on'})}};
    await page.evaluate(({key,workspaceKey,old}) => {localStorage.setItem(key,JSON.stringify(old));localStorage.setItem(workspaceKey,JSON.stringify(old.shared_workspace));}, {key,workspaceKey,old});
    await open(node);
    assert.equal(await page.locator('.reading-card').getAttribute('data-section'),'0');
    await page.locator('.classroom-shell[data-save-state="saved"]').waitFor();
    const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)),key);
    assert.equal(saved.content_revision,'guided-20261126-r2'); assert.equal(saved.self_completed,false);
    assert.deepEqual(saved.previous_completion,{revision:'beginner-20261126',completed:true});
    assert.equal(saved.note,old.note); assert.deepEqual(saved.answers,old.answers); assert.deepEqual(saved.shared_workspace,old.shared_workspace);
    await page.getByRole('button',{name:'练习与笔记',exact:true}).click(); assert.equal(await page.locator('#course-note').inputValue(),old.note);
    await page.getByLabel('选择练习内容').selectOption('history');
    assert.ok(await page.getByText('原答案：所设模拟条件能产生这种变化',{exact:true}).count());
    assert.ok(await page.getByText('原答案：观察方向会改变能否看见行星遮挡恒星',{exact:true}).count());
    await page.getByText('查看保留的互动记录',{exact:true}).click(); assert.ok(await page.getByText('legacy-observation',{exact:false}).count());
    await page.screenshot({path:path.join(out,'retained-history.png')});
    await page.getByRole('button',{name:'关闭面板',exact:true}).click();
    await section('Kepler、Kepler-10 和 Kepler-10 b，分别是谁');
    const bookmark = await page.locator('.reading-card').getAttribute('data-section');
    await page.locator('.classroom-shell[data-save-state="saved"]').waitFor(); await page.reload(); await page.locator('.reading-card').waitFor();
    assert.equal(await page.locator('.reading-card').getAttribute('data-section'),bookmark);
    await page.getByRole('button',{name:'讲课',exact:true}).click(); await page.getByRole('heading',{name:/讲课 · 1\//}).waitFor();
    await page.getByRole('button',{name:'关闭面板',exact:true}).click();
    await section('为什么并非每颗行星都能产生可见的凌星');
    await page.locator('.reading-card .interaction-entry').first().click(); await page.locator('iframe').waitFor();
    await page.getByRole('button',{name:'关闭面板',exact:true}).click();
    // Request actual bundled downloads, not just the menu labels.
    for (const name of ['question-card.json','kepler10-q3.csv','kepler10-q3-validity-input.csv','junior-guide.ipynb','first-observation-card-template.html','lightkurve-practice-kit.zip']) {
      const response = await page.request.get(`${origin}/content/assets/lightkurve-transit-detective/downloads/${name}`);
      assert.ok(response.ok()); const data = await response.body(); assert.ok(data.length > 20); downloads.push({name,bytes:data.length});
    }
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'guided-verification.json'), JSON.stringify({status:'pass',nodes,legacy_note_answers_artifact_restored:true,old_completion_archived:true,new_bookmark_restored:true,lecture_and_inline_activity_opened:true,downloads,errors},null,2)+'\n');
    console.log('PASS 32 lessons, added sections and images, old notes/answers/artifacts, revision/bookmark, lecture, inline activity and downloads.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => {console.error(error);process.exitCode=1;});
