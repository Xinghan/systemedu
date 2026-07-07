// Extract <script> blocks from the game HTML and syntax-check them via vm.
import fs from 'node:fs';
import vm from 'node:vm';

const f = process.argv[2];
const html = fs.readFileSync(f, 'utf8');
const re = /<script>([\s\S]*?)<\/script>/g;
let m, i = 0, bad = 0;
while ((m = re.exec(html)) !== null) {
  i++;
  const code = m[1];
  try {
    // compile only — do not run (DOM not present)
    new vm.Script(code, { filename: `script#${i}` });
    console.log(`script#${i}: OK (${code.split('\n').length} lines)`);
  } catch (e) {
    bad++;
    console.log(`script#${i}: SYNTAX ERROR -> ${e.message}`);
    // print a little context around the error if line info present
    const lm = /script#\d+:(\d+)/.exec(e.stack || '');
  }
}
console.log(bad === 0 ? 'ALL SCRIPTS PARSE OK' : `${bad} script(s) failed`);
process.exit(bad === 0 ? 0 : 1);
