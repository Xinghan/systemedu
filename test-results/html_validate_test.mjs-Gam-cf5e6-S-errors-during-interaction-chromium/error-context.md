# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: html_validate_test.mjs >> Game: _test_game_mars_terrain.html >> [_test_game_mars_terrain.html] no JS errors during interaction
- Location: html_validate_test.mjs:208:3

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "resetGame is not defined",
+ ]
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - heading "MISSION BRIEF ▼" [level=3] [ref=e3] [cursor=pointer]:
      - text: MISSION BRIEF
      - generic [ref=e4]: ▼
    - generic [ref=e5]:
      - generic [ref=e6]: TARGET
      - paragraph [ref=e7]: 将6种火星地形分类到正确的安全等级
      - generic [ref=e8]: CONTROLS
      - list [ref=e9]:
        - listitem [ref=e10]: 拖拽地形卡片到右侧分类区域
        - listitem [ref=e11]: 点击 RESET 清空重新开始
      - generic [ref=e12]: STEPS
      - list [ref=e13]:
        - listitem [ref=e14]: 阅读每张卡片上的地形描述
        - listitem [ref=e15]: 拖放到 SAFE / DECEPTIVE / HAZARD 区域
        - listitem [ref=e16]: 错误分类会弹出解释，可重新拖放
      - generic [ref=e17]: INTEL
      - paragraph [ref=e18]: 最危险的地形往往看起来最平坦
  - generic [ref=e19]:
    - heading "TERRAIN HAZARD CLASSIFICATION" [level=1] [ref=e20]
    - generic [ref=e21]: "CLASSIFIED: 0/6"
  - generic [ref=e22]:
    - generic [ref=e23]:
      - generic [ref=e24]: TERRAIN SAMPLES
      - generic [ref=e25]:
        - img [ref=e27]
        - generic [ref=e35]: 压实碎石地
        - generic [ref=e36]: 小碎石牢固嵌入土壤，粗糙但稳定
      - generic [ref=e37]:
        - img [ref=e39]
        - generic [ref=e47]: 薄壳地面
        - generic [ref=e48]: 薄矿物硬壳覆盖松散粉尘，受压即碎
      - generic [ref=e49]:
        - img [ref=e51]
        - generic [ref=e57]: 硬质玄武岩平原
        - generic [ref=e58]: 深色、坚硬的火山岩表面，纹理清晰可见
      - generic [ref=e59]:
        - img [ref=e61]
        - generic [ref=e66]: 细沙覆盖区
        - generic [ref=e67]: 平坦、均匀的红褐色表面，看起来和安全地面一样
      - generic [ref=e68]:
        - img [ref=e70]
        - generic [ref=e76]: 暗色碎石区
        - generic [ref=e77]: 散布的尖锐玄武岩碎片被亮色沙地掩盖
      - generic [ref=e78]:
        - img [ref=e80]
        - generic [ref=e84]: 阴影遮蔽区
        - generic [ref=e85]: 陨石坑或岩石背后的均匀黑暗区域，下方地形未知
    - generic [ref=e86]:
      - generic [ref=e87]:
        - generic [ref=e88]: SAFE -- CAN TRAVERSE
        - generic [ref=e89]: Firm, stable ground
      - generic [ref=e90]:
        - generic [ref=e91]: DECEPTIVE -- LOOKS SAFE, IS NOT
        - generic [ref=e92]: Hidden danger beneath surface
      - generic [ref=e93]:
        - generic [ref=e94]: HAZARD -- AVOID
        - generic [ref=e95]: Visible or known danger
  - button "RESET" [active] [ref=e96] [cursor=pointer]
  - generic [ref=e97]:
    - generic [ref=e98]:
      - generic [ref=e99]: CORRECT
      - generic [ref=e100]: "0"
    - generic [ref=e101]:
      - generic [ref=e102]: ERRORS
      - generic [ref=e103]: "0"
    - generic [ref=e104]:
      - generic [ref=e105]: REMAINING
      - generic [ref=e106]: "6"
    - generic [ref=e107]:
      - generic [ref=e108]: ACCURACY
      - generic [ref=e109]: "--"
```

# Test source

```ts
  146 |     await page.click('#langBtn');
  147 |     await page.waitForTimeout(500);
  148 | 
  149 |     const titleAfter = await page.evaluate(() => {
  150 |       const el = document.getElementById('mainTitle')
  151 |         || document.querySelector('h1')
  152 |         || document.querySelector('.header h1');
  153 |       return el ? el.textContent : null;
  154 |     });
  155 | 
  156 |     if (titleEl && titleAfter) {
  157 |       expect(titleEl).not.toBe(titleAfter);
  158 |     }
  159 |   });
  160 | 
  161 |   test(`[${fileName}] no JS errors during interaction`, async ({ page }) => {
  162 |     const errors = [];
  163 |     page.on('pageerror', err => errors.push(err.message));
  164 |     await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 15000 });
  165 |     await page.waitForTimeout(1500);
  166 | 
  167 |     // Interact with all controls
  168 |     const btns = ['#btnNext', '#btnNext', '#btnPrev', '#btnPlay'];
  169 |     for (const sel of btns) {
  170 |       const exists = await page.evaluate(s => !!document.querySelector(s), sel);
  171 |       if (exists) {
  172 |         await page.click(sel).catch(() => {});
  173 |         await page.waitForTimeout(600);
  174 |       }
  175 |     }
  176 |     // Let play run briefly
  177 |     await page.waitForTimeout(2000);
  178 | 
  179 |     expect(errors).toEqual([]);
  180 |   });
  181 | }
  182 | 
  183 | // ---- Game-specific tests ----
  184 | 
  185 | function gameTests(fileName, fileUrl) {
  186 |   commonTests(fileName, fileUrl);
  187 |   canvasRenderTest(fileName, fileUrl);
  188 | 
  189 |   test(`[${fileName}] has interactive elements`, async ({ page }) => {
  190 |     await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 15000 });
  191 |     await page.waitForTimeout(1500);
  192 | 
  193 |     const count = await page.evaluate(() => {
  194 |       const selectors = [
  195 |         '.game-area', '.terrain-card', '.card', 'input[type=range]',
  196 |         'canvas', 'svg', 'button', '.drag', '[draggable]',
  197 |         '.slider', '.option', '.choice',
  198 |       ];
  199 |       let total = 0;
  200 |       for (const sel of selectors) {
  201 |         total += document.querySelectorAll(sel).length;
  202 |       }
  203 |       return total;
  204 |     });
  205 |     expect(count).toBeGreaterThan(0);
  206 |   });
  207 | 
  208 |   test(`[${fileName}] no JS errors during interaction`, async ({ page }) => {
  209 |     const errors = [];
  210 |     page.on('pageerror', err => errors.push(err.message));
  211 |     // Auto-dismiss dialogs that some games trigger
  212 |     page.on('dialog', dialog => dialog.dismiss().catch(() => {}));
  213 | 
  214 |     await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 15000 });
  215 |     await page.waitForTimeout(1500);
  216 | 
  217 |     // Wrap all interaction in try/catch -- some games navigate or close the page
  218 |     try {
  219 |       // Click visible buttons (limit to 3 to avoid triggering navigation)
  220 |       const buttons = await page.$$('button');
  221 |       for (const btn of buttons.slice(0, 3)) {
  222 |         const visible = await btn.isVisible().catch(() => false);
  223 |         if (visible) {
  224 |           // Use Promise.race to cap per-click wait
  225 |           await Promise.race([
  226 |             btn.click().then(() => page.waitForTimeout(300)),
  227 |             new Promise(r => setTimeout(r, 3000)),
  228 |           ]).catch(() => {});
  229 |         }
  230 |       }
  231 | 
  232 |       // Move sliders if any
  233 |       const sliders = await page.$$('input[type=range]');
  234 |       for (const slider of sliders.slice(0, 3)) {
  235 |         const visible = await slider.isVisible().catch(() => false);
  236 |         if (visible) {
  237 |           await slider.fill('50').catch(() => {});
  238 |           await page.waitForTimeout(200).catch(() => {});
  239 |         }
  240 |       }
  241 | 
  242 |       await page.waitForTimeout(1000).catch(() => {});
  243 |     } catch {
  244 |       // Page may have been closed by navigation -- that's ok
  245 |     }
> 246 |     expect(errors).toEqual([]);
      |                    ^ Error: expect(received).toEqual(expected) // deep equality
  247 |   });
  248 | 
  249 |   test(`[${fileName}] language toggle exists`, async ({ page }) => {
  250 |     await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 15000 });
  251 |     await page.waitForTimeout(1000);
  252 | 
  253 |     const langBtnExists = await page.evaluate(() => !!document.getElementById('langBtn'));
  254 |     if (!langBtnExists) {
  255 |       console.warn(`[${fileName}] WARN: #langBtn not found (i18n not implemented)`);
  256 |     }
  257 |     // Warn only, don't hard-fail for older HTML that lacks i18n
  258 |   });
  259 | }
  260 | 
  261 | // ---- Generate test suites ----
  262 | 
  263 | for (const f of animFiles) {
  264 |   test.describe(`Animation: ${f}`, () => {
  265 |     animationTests(f, 'file://' + path.resolve(__dirname, f));
  266 |   });
  267 | }
  268 | 
  269 | for (const f of gameFiles) {
  270 |   test.describe(`Game: ${f}`, () => {
  271 |     gameTests(f, 'file://' + path.resolve(__dirname, f));
  272 |   });
  273 | }
  274 | 
```