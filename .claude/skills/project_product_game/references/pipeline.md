# 3D 管线 — 素材获取 + 内联 + 注入

## Three.js
- 版本 **r149 UMD** (全局 `THREE`, 非 ES module)。~608KB。
- 复用已内联的副本最省事: 从任一已验收的 `course_factory/tests/project_game/*_3D.html` 里
  抽出 `<script>` 里那段 `THREE.REVISION==='149'` 的 UMD 全文, 存成 scratchpad 的 `three_reuse.js`。
- 用到的 API: WebGLRenderer(sRGBEncoding, ACESFilmicToneMapping, PCFSoftShadowMap)、
  PerspectiveCamera、PMREMGenerator.fromScene、MeshStandardMaterial/MeshPhysicalMaterial、
  IcosahedronGeometry/CylinderGeometry/TubeGeometry/PlaneGeometry、CanvasTexture、Raycaster、Clock。

## CC0 PBR 纹理 (ambientCG)
- 全部 CC0, 可商用免署名。直链: `https://ambientcg.com/get?file=<ID>_1K-JPG.zip`
  (例 `Ground054_1K-JPG.zip`, `Metal032_1K-JPG.zip`, `Rock030_1K-JPG.zip`, `Rubber004_1K-JPG.zip`)。
- 只需 normal + roughness (+ 偶尔 color) 三张。下载解压后缩小到 512 省体积:
  `sips -Z 512 -s format jpeg -s formatOptions 70 in.jpg --out out.jpg` (注意 sips 失败是静默的, 要验证输出)。
- base64 内联成 `window.TEX_DATA = { sandN:'data:image/jpeg;base64,...', metalN:'...', ... }`。
- **自定义 BufferGeometry 要手动生成 UV**, 否则 normalMap/roughnessMap 不生效。
- CanvasTexture (程序化画的贴图) 记得 `tex.encoding = THREE.sRGBEncoding`, 否则颜色被当线性提亮发灰。

## PMREM 摄影棚环境 (给金属/通透材质真反射)
```js
const pmrem = new THREE.PMREMGenerator(renderer);
const env = new THREE.Scene();
env.add(new THREE.Mesh(new THREE.SphereGeometry(40,16,12),
  new THREE.MeshBasicMaterial({color:0x1a2030, side:THREE.BackSide})));
// 几个发光面板当灯箱
const pan=(x,y,z,c)=>{ const m=new THREE.Mesh(new THREE.PlaneGeometry(22,14),
  new THREE.MeshBasicMaterial({color:c})); m.position.set(x,y,z); m.lookAt(0,0,0); env.add(m); };
pan(0,26,6,0xffffff); pan(-24,6,10,0x88a8e0); pan(20,6,-14,0xd88060);
scene.environment = pmrem.fromScene(env, 0.04).texture;
```

## Marker 注入 (保持源码可读)
HTML 里放注释 marker, 用 node 脚本注入大块内容 (源码里不手贴 600KB):
```html
<script><!--ENGINE--></script>
<script><!--TEX_DATA--></script>
<script><!--THREE_INLINE--></script>
```
注入脚本 (改自 mars/molecule 的 inline_*.mjs), 注意用 `html.replace(marker, ()=>bigString)`
的函数形式 —— 因为 `$` 在替换字符串里有特殊含义, base64/JS 里的 `$&` 会被误替换:
```js
import fs from 'node:fs';
let html = fs.readFileSync(HTMLPATH,'utf8');
html = html.replace('<!--ENGINE-->', ()=>engineSource);
html = html.replace('<!--TEX_DATA-->', "window.TEX_DATA={sandN:'"+dataUrl+"'};");
html = html.replace('<!--THREE_INLINE-->', ()=>threeSource);
fs.writeFileSync(HTMLPATH, html);
```
**注意**: 注入后 marker 就没了; 再次改引擎要么重新从模板生成, 要么直接在 HTML 里精确 Edit 那段
(引擎独立开发时, 建议同时改 scratchpad 引擎文件 + HTML 内的副本, 两处保持一致)。

## 提取引擎做 node 单测
引擎是纯函数时, 单独存 `mol_engine.js` (末尾 `if(typeof module!=='undefined') module.exports={...}`),
node 里 import 跑单测; 注入 HTML 时 strip 掉 module.exports 尾巴, 补 `window.X=X` 暴露给 e2e。
若引擎直接写在页面 script 里 (未独立), 单测用 vm 抽取那段 `<script>` 文本跑 (见 verification.md)。

## zsh 陷阱
`for f in $var` **不做词分割** (会把整串当一个 token)。要遍历用字面列表:
`for f in a.html b.html c.html; do ...; done`。
