# 验证骨架 — node 引擎单测 + Playwright e2e

三层全绿才算完成 (引擎单测 / 浏览器 e2e / 截图 eyeball)。前两层骨架如下, 照抄改断言。

## A. 引擎 node 单测

### A1. 引擎独立成文件时 (推荐)
`mol_engine.js` 末尾: `if(typeof module!=='undefined'&&module.exports) module.exports={parseSmiles,descriptors,...};`
```js
// test_engine.mjs
import * as E from './mol_engine.js';
const {parseSmiles,descriptors,esolLogS,dockScore,runFunnel} = E.default||E;
let pass=0,fail=0;
const ok=(n,c,e)=>{ if(c){pass++;console.log('  PASS',n,e!=null?('· '+e):'');} else {fail++;console.log('  FAIL',n,e!=null?('· '+e):'');} };
const near=(a,b,tol)=>Math.abs(a-b)<=tol;

// 与教科书值对齐 (关键: 真算可信度)
ok('aspirin MW ~180.16', near(descriptors(parseSmiles('CC(=O)Oc1ccccc1C(=O)O')).mw, 180.16, 0.5));
// 边界: 无效输入不崩
ok('garbage -> null', parseSmiles('XyzQ!!')===null);
// 单调/梯度: 排序有区分度
// ...
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
```

### A2. 引擎写在页面 script 里 (未独立) — vm 抽取
```js
// test_engine.mjs
import fs from 'node:fs'; import vm from 'node:vm';
const html=fs.readFileSync('.../<slug>_3D.html','utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
let engine=scripts.find(s=>s.includes('function genRegion'));   // 认领引擎那段
engine=engine.slice(0, engine.indexOf('const S={'));            // 切掉 DOM/状态机部分
const names=['parseSmiles','descriptors','WORLD','clamp'];      // 要导出的符号
engine+='\n;'+names.map(n=>`try{globalThis.${n}=${n}}catch(e){}`).join('');
const sb={window:{},Math,console,THREE:{Vector3:function(x,y,z){this.x=x||0;this.y=y||0;this.z=z||0;}}}; sb.globalThis=sb;
vm.createContext(sb); vm.runInContext(engine,sb,{filename:'engine'});
const {parseSmiles,descriptors}=sb;
// ... 断言 ...
```

## B. Playwright 浏览器 e2e (headless swiftshader)

```py
# e2e.py  (写成文件跑, 不要 Bash 内联多行 python)
import sys, pathlib
from playwright.sync_api import sync_playwright
HTML="file://"+str(pathlib.Path(".../<slug>_3D.html").resolve())
SHOT=".../scratchpad"
passed,failed,errors=[],[],[]
def check(n,c,e=""):
    (passed if c else failed).append(n)
    print(("  PASS " if c else "  FAIL ")+n+((" · "+str(e)) if e else ""))
with sync_playwright() as p:
    b=p.chromium.launch(headless=True, args=["--use-gl=angle","--use-angle=swiftshader",
        "--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
    pg=b.new_page(viewport={"width":1280,"height":800}, device_scale_factor=1)
    pg.on("console", lambda m: errors.append(m.type+": "+m.text) if m.type=="error" else None)
    pg.on("pageerror", lambda e: errors.append("PAGEERROR: "+str(e)))
    pg.goto(HTML); pg.wait_for_load_state("networkidle"); pg.wait_for_timeout(1500)
    # 确定性推进 sim (不靠 wall-clock; swiftshader rAF 太慢)
    def tick(sec, step=1/60):
        pg.evaluate(f"()=>{{ const n=Math.round({sec}/{step}); for(let i=0;i<n;i++) window.simStep({step}); }}")

    # Boot
    check("THREE r149", pg.evaluate("()=>Number(THREE.REVISION)")==149)
    check("scene ready", pg.evaluate("()=>window.S && window.S.ready")==True)
    img=pg.evaluate("()=>{try{return document.getElementById('scene').toDataURL('image/png').length;}catch(e){return -1;}}")
    check("scene renders non-trivial", img>5000, "len="+str(img))
    check("no console errors on boot", len(errors)==0, errors[:4])
    pg.screenshot(path=SHOT+"/boot.png")

    # 核心交互改变状态 + 真算数字与引擎一致
    # ... pg.evaluate 触发按钮 / setState, 再断言 S 与 UI ...

    # 闸门 (如有): 诱饵按钮不完成任务, 负责任选项才完成
    # ...

    # i18n
    pg.evaluate("()=>document.getElementById('langBtn').click()")
    check("switched to EN", pg.evaluate("()=>S.lang")=="en")

    check("zero console errors across run", len(errors)==0, errors[:6])
    b.close()
print(f"\nRESULT: {len(passed)} passed, {len(failed)} failed")
sys.exit(1 if failed or errors else 0)
```

### e2e 关键点
- 顶层 `let/const` 在 classic script 里**不挂 window**, 但在 `evaluate` 里能按裸名访问
  (共享全局词法作用域); `function` 声明会挂 window。断言时: 页面暴露的用 `window.X`,
  未暴露的顶层变量用 `typeof X!=='undefined' ? X : ...` 裸名访问。**别混用**
  (踩过 `window.dockLines` undefined 但裸名 `dockLines` 有值的坑)。
- 断言"真算数字与引擎一致": 读 UI 显示的数字, 跟 `pg.evaluate` 直接调纯函数的结果比。
- 每个视觉里程碑都 `pg.screenshot`, 供第三层 eyeball。

## C. 运行
```bash
node .../test_engine.mjs
NO_PROXY=127.0.0.1,localhost python .../e2e.py     # 本机有 http proxy, 加 NO_PROXY
```
全绿 (含零 console error) + 截图 eyeball 通过 → 完成。
