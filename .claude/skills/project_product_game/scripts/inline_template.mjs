// Generic inliner: inject engine + three.js UMD + base64 textures into a
// project-product-game HTML that contains the three markers.
//   node inline_template.mjs <html> <three_reuse.js> [engine.js] [textures.js]
// - <three_reuse.js> : the r149 UMD source (extract once from any *_3D.html)
// - [engine.js]      : optional pure engine; module.exports tail is stripped and
//                      window.<name> exposers are appended for e2e (edit EXPORTS below)
// - [textures.js]    : optional file that assigns window.TEX_DATA = {...}; if omitted,
//                      the <!--TEX_DATA--> marker is left as an empty script
//
// Uses html.replace(marker, ()=>big) so `$` in base64/JS is not treated specially.
import fs from 'node:fs';

const [,, HTML, THREE_PATH, ENGINE_PATH, TEX_PATH] = process.argv;
if(!HTML || !THREE_PATH){ console.error('usage: node inline_template.mjs <html> <three.js> [engine.js] [textures.js]'); process.exit(2); }

// EDIT THIS to the symbols your page/e2e needs on window:
const EXPORTS = ['parseSmiles','descriptors','simStep'];

let html = fs.readFileSync(HTML,'utf8');
for(const mk of ['<!--THREE_INLINE-->']) if(!html.includes(mk)){ console.error('marker missing: '+mk); process.exit(1); }

const three = fs.readFileSync(THREE_PATH,'utf8');

if(ENGINE_PATH && html.includes('<!--ENGINE-->')){
  let engine = fs.readFileSync(ENGINE_PATH,'utf8').replace(/if\(typeof module[\s\S]*$/,'');
  engine += '\n;' + EXPORTS.map(n=>`try{window.${n}=${n}}catch(e){}`).join('');
  html = html.replace('<!--ENGINE-->', ()=>engine);
}
if(TEX_PATH && html.includes('<!--TEX_DATA-->')){
  const tex = fs.readFileSync(TEX_PATH,'utf8');   // should already be `window.TEX_DATA={...}`
  html = html.replace('<!--TEX_DATA-->', ()=>tex);
}
html = html.replace('<!--THREE_INLINE-->', ()=>three);
fs.writeFileSync(HTML, html);
console.log('inlined:', (html.length/1024/1024).toFixed(2)+'MB');
