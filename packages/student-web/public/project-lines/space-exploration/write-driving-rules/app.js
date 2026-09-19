import { TERRAINS, ACTIONS, DEFAULT_RULES, ROUTES, validRules, runRules, rulesCanFinish, rulesSignature } from "../_shared/models.mjs";
import { $, node, createArchive, baseRecord, recordBaseValid, jsonDownload, setupHelp } from "../_shared/storage.js";
const project = "write-driving-rules", draftKey = "systemedu:write-driving-rules:draft:v1";
const names = { clear: "平整地面", sand: "柔软沙地", rock: "岩石挡路", unknown: "看不清地面" };
const actionNames = { forward: "正常前进", slow: "慢速通过", detour: "从旁边绕行", stop: "停下并求助" };
const routeNames = { training: "训练路线", transfer: "换路测试" };
const archive = createArchive(project, r => recordBaseValid(r, project, "driving-rules") && r.controller_version === "terrain-actions/1" && validRules(r.program?.rules));
let rules = { ...DEFAULT_RULES }, runs = [], edits = 0, imported = false, running = false, active = null, routeId = "training", currentTrace = [{ x: 0, z: 0, t: 0 }], vehicle = { x: 0, z: 0 }, draftWritable = true;
function validRun(run) {
  if (!run || !validRules(run.rules) || !ROUTES[run.route_id]) return false;
  const expected = runRules(run.rules, run.route_id);
  return run.signature === expected.signature && run.passed === expected.passed && run.status === expected.status
    && JSON.stringify(run.trace) === JSON.stringify(expected.trace) && JSON.stringify(run.steps) === JSON.stringify(expected.steps);
}
try {
  const raw = localStorage.getItem(draftKey);
  if (raw) {
    const draft = JSON.parse(raw);
    if (!validRules(draft.rules) || !Array.isArray(draft.runs) || draft.runs.length > 50 || !draft.runs.every(validRun) || !Number.isInteger(draft.edits) || draft.edits < 0 || typeof draft.imported !== "boolean") throw new Error("无效草稿");
    rules = draft.rules; runs = draft.runs; edits = draft.edits; imported = draft.imported;
    $("#guide").textContent = "已找回你的规则和测试记录。可以继续改，也可以换路检验。";
  }
} catch { draftWritable = false; $("#storage-status").textContent = "旧草稿无法读取，未覆盖。完成后请下载规则。"; }
function saveDraft() {
  if (!draftWritable) return;
  try { localStorage.setItem(draftKey, JSON.stringify({ rules, runs, edits, imported })); }
  catch { draftWritable = false; $("#storage-status").textContent = "草稿没有写入本机，完成后请下载规则。"; }
}
for (const terrain of TERRAINS) {
  const row = node("div", "", "rule-row"), label = node("label", "看到 " + names[terrain]), select = document.createElement("select");
  label.htmlFor = "rule-" + terrain; select.id = label.htmlFor;
  for (const action of ACTIONS) { const option = node("option", actionNames[action]); option.value = action; select.append(option); }
  select.value = rules[terrain]; row.append(label, select); $("#rule-editor").append(row);
  select.onchange = () => {
    rules[terrain] = select.value; edits++; $("#result").hidden = true;
    $("#guide").textContent = "规则变了。请重新运行两条路线，之前版本的通过记录不会替这版作证。";
    saveDraft(); update();
  };
}
function syncEditor() { for (const t of TERRAINS) $("#rule-" + t).value = rules[t]; }
function update() {
  $("#save").disabled = running || !rulesCanFinish(rules, runs, edits, imported);
  $("#step-observe").dataset.done = String(runs.length > 0); $("#step-edit").dataset.done = String(edits > 0 || imported);
  $("#step-test").dataset.done = String(rulesCanFinish(rules, runs, edits, imported));
  const signature = rulesSignature(rules), passed = Object.keys(ROUTES).filter(id => runs.some(r => r.signature === signature && r.route_id === id && r.passed));
  $("#completion").textContent = rulesCanFinish(rules, runs, edits, imported) ? "这版规则通过两条路线，并在看不清地面时停下求助。可以保存了。" :
    (imported ? "导入后重新检验：" : "先观察一次不合适的动作，再修改和检验。") + " 当前版本通过 " + passed.length + " / 2 条路线。";
  $("#runs").replaceChildren();
  runs.slice().reverse().forEach(r => {
    const li = node("li", ""), details = node("details", "");
    details.append(node("summary", routeNames[r.route_id] + " · " + (r.passed ? "安全到达检查点" : r.steps.at(-1).outcome)));
    details.append(node("small", (r.signature === signature ? "与当前规则相同" : "旧版本记录，保留供比较") + (r.tested_at ? " · " + new Date(r.tested_at).toLocaleString() : "")));
    for (const t of TERRAINS) details.append(node("p", names[t] + " → " + actionNames[r.rules[t]]));
    const log = node("ol", "");
    r.steps.forEach(s => log.append(node("li", names[s.terrain] + " → " + actionNames[s.action] + " · " + s.outcome)));
    details.append(log); li.append(details); $("#runs").append(li);
  });
}
function toggleInputs(value) {
  running = value;
  for (const t of TERRAINS) $("#rule-" + t).disabled = value;
  $("#run-training").disabled = value; $("#run-transfer").disabled = value; $("#import").disabled = value; $("#baseline").disabled = value;
  document.querySelectorAll("#records button").forEach(b => b.disabled = value); update();
}
function showLog(result) {
  $("#log").replaceChildren(); result.steps.forEach(s => $("#log").append(node("li", names[s.terrain] + " → " + actionNames[s.action] + " · " + s.outcome)));
}
async function run(id) {
  if (running) return; toggleInputs(true); routeId = id; $("#log").replaceChildren(); $("#result").hidden = true;
  const result = runRules(rules, id); currentTrace = result.trace;
  $("#guide").textContent = "正在按你这版规则行驶，留意地形变化时它做了什么。";
  const duration = Math.max(1, result.time) * 420; let progress = 0, previous = performance.now();
  await new Promise(resolve => {
    function animate(now) {
      if (!document.hidden) progress += Math.min(80, now - previous);
      previous = now;
      const t = Math.min(result.time, progress / duration * result.time);
      let a = result.trace[0], b = a;
      for (let i = 1; i < result.trace.length; i++) { b = result.trace[i]; if (b.t >= t) break; a = b; }
      const ratio = b.t === a.t ? 1 : Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t)));
      vehicle = { x: a.x + (b.x - a.x) * ratio, z: a.z + (b.z - a.z) * ratio }; draw();
      if (progress >= duration) resolve(); else requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  });
  runs.push({ ...result, tested_at: new Date().toISOString() });
  if (runs.length > 50) { const failure = runs.find(r => !r.passed); runs = failure ? [failure, ...runs.slice(-49)] : runs.slice(-50); }
  showLog(result); saveDraft(); toggleInputs(false);
  $("#scene-caption").textContent = routeNames[id] + " · " + result.steps.at(-1).outcome;
  $("#guide").textContent = result.passed ? "这条路线到达了看不清地面的检查点，并且停下来。再检验另一条路线。" : result.steps.at(-1).outcome + "。找到对应的那条规则，只改一个动作试试。";
}
$("#baseline").onclick = () => {
  if (running) return;
  rules = { ...DEFAULT_RULES }; edits++; imported = false; active = null;
  currentTrace = [{ x: 0, z: 0, t: 0 }]; vehicle = { x: 0, z: 0 };
  $("#result").hidden = true; $("#log").replaceChildren();
  syncEditor(); saveDraft(); update(); draw();
  $("#guide").textContent = "已切回只会前进的初始规则。已有测试历史和保存作品仍保留，请先预测再运行。";
};
$("#run-training").onclick = () => run("training"); $("#run-transfer").onclick = () => run("transfer");
$("#save").onclick = () => {
  if (!rulesCanFinish(rules, runs, edits, imported) || running) return;
  active = { ...baseRecord(project, "driving-rules"), controller_version: "terrain-actions/1",
    contribution: imported ? "imported-and-retested" : "edited-and-tested", program: { input: TERRAINS, output: ACTIONS, rules: { ...rules } },
    evidence: { edits, runs: [...runs], current_signature: rulesSignature(rules) }, provided_modules: ["平台提供的地形类别", "动作运行器和侧方绕行通道", "两条受控测试路线"] };
  archive.save(active); $("#result").hidden = false; list();
};
$("#download").onclick = () => { if (active) jsonDownload(active, "my-driving-rules.json"); };
function loadRules(record) {
  rules = { ...record.program.rules }; edits = 0; imported = true; runs = []; active = null;
  $("#result").hidden = true; syncEditor(); saveDraft(); update();
  $("#guide").textContent = "已作为导入草稿打开。请重新运行两条路线，文件里的完成声明不会自动算作本轮通过。";
}
$("#import").onchange = async event => {
  const file = event.target.files[0]; if (!file || running) return;
  try {
    if (file.size > 500000) throw new Error("文件太大");
    const record = JSON.parse(await file.text());
    if (!recordBaseValid(record, project, "driving-rules") || record.controller_version !== "terrain-actions/1" || !validRules(record.program?.rules)) throw new Error("规则格式不兼容");
    loadRules(record);
  } catch { $("#guide").textContent = "规则文件不兼容，当前规则保持不变。"; }
  event.target.value = "";
};
function list() {
  $("#records").replaceChildren(); archive.records.forEach((r, i) => {
    const b = node("button", "打开规则 " + (archive.records.length - i), "record"); b.disabled = running; b.dataset.record = String(i);
    b.append(node("small", "重新检验")); b.onclick = () => loadRules(r); $("#records").append(b);
  });
}
setupHelp(() => {
  const failure = runs.at(-1);
  if (!failure) return "先运行平台的初始规则。看到它在哪里停住，才知道要修改哪一条。";
  if (failure.status === "stuck") return "柔软沙地不适合快速驶入。试试慢速，或者从旁边的平地绕过去。";
  if (failure.status === "collision") return "岩石不会因为开得慢就消失。可以选择从旁边绕行。";
  if (rules.unknown !== "stop") return "如果没有看清地面，最先该做的是停下并求助。";
  return "换一条路线，看看相同规则是否仍然有效；改完以后，两条路线都要重新测。";
});
const canvas = $("#rule-canvas");
function draw() {
  const w = $("#scene").clientWidth, h = $("#scene").clientHeight, dpr = Math.min(devicePixelRatio, 2);
  canvas.width = w * dpr; canvas.height = h * dpr; const c = canvas.getContext("2d"); c.scale(dpr, dpr);
  const bg = c.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, "#26343a"); bg.addColorStop(1, "#87664b"); c.fillStyle = bg; c.fillRect(0, 0, w, h);
  const size = Math.min(w / 9, 85), left = w / 2 - 3.15 * size, top = h / 2 - 30;
  const point = (x, z) => ({ x: left + x * size + z * size * .28, y: top + z * 76 });
  for (let z = 0; z < 2; z++) for (let x = 0; x < 7; x++) {
    const p = point(x, z); c.fillStyle = z ? "#987451" : "#b98e60"; c.fillRect(p.x - size * .43, p.y - 26, size * .86, 52);
  }
  for (const [i, terrain] of ROUTES[routeId].entries()) {
    const p = point(i + 1, 0); c.fillStyle = "#efd6b3"; c.font = Math.max(9, size * .17) + "px sans-serif"; c.textAlign = "center";
    c.fillText(names[terrain], p.x, p.y - 40);
    if (terrain === "rock") {
      c.fillStyle = "#665347"; c.beginPath(); c.moveTo(p.x - size * .24, p.y + 12); c.lineTo(p.x - size * .18, p.y - 15); c.lineTo(p.x + size * .08, p.y - 23); c.lineTo(p.x + size * .25, p.y + 9); c.closePath(); c.fill();
    } else if (terrain === "sand") {
      c.strokeStyle = "#e5c392"; c.lineWidth = 2;
      for (let j = 0; j < 4; j++) { c.beginPath(); c.moveTo(p.x - size * .3, p.y - 15 + j * 9); c.quadraticCurveTo(p.x, p.y - 25 + j * 9, p.x + size * .3, p.y - 15 + j * 9); c.stroke(); }
    } else if (terrain === "unknown") { c.fillStyle = "#525e62"; c.fillRect(p.x - size * .38, p.y - 22, size * .76, 44); c.fillStyle = "#f1d9ad"; c.font = "23px monospace"; c.fillText("?", p.x, p.y + 8); }
  }
  c.strokeStyle = "#f2d3a0"; c.lineWidth = 2; c.setLineDash([4, 4]); c.beginPath();
  currentTrace.forEach((v, i) => { const p = point(v.x, v.z); if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); }); c.stroke(); c.setLineDash([]);
  const p = point(vehicle.x, vehicle.z); c.fillStyle = "#293e48"; c.fillRect(p.x - 18, p.y - 16, 36, 32); c.fillStyle = "#e8dfc7"; c.fillRect(p.x - 20, p.y - 10, 40, 20);
  c.fillStyle = "#527081"; c.fillRect(p.x - 10, p.y - 7, 19, 14); c.strokeStyle = "#e9d5aa"; c.beginPath(); c.moveTo(p.x + 10, p.y); c.lineTo(p.x + 26, p.y); c.stroke();
  c.textAlign = "left"; c.font = "11px sans-serif"; c.fillStyle = "#e0cfb7"; c.fillText("下方通道：平台提供的平整绕行路线", Math.max(16, left), top + 142);
}
$("#render-mode").textContent = "受控教学路线 · 地形由平台提供"; $("#scene").dataset.renderer = "canvas";
new ResizeObserver(draw).observe($("#scene")); draw(); update(); list();
