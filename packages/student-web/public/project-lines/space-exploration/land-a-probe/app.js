import { LANDER, newLander, stepLander } from "../_shared/models.mjs";
import { $, node, createArchive, baseRecord, recordBaseValid, jsonDownload, setupHelp } from "../_shared/storage.js";
import { createMarsScene } from "../_shared/mars-scene.js";

const project = "land-a-probe";
const valid = r => recordBaseValid(r, project, "landing-replay") && Array.isArray(r.frames) && r.frames.length > 1 && r.frames.length <= 1100
  && r.frames.every(f => Number.isFinite(f.height) && Number.isFinite(f.velocity) && Number.isFinite(f.fuel) && Number.isFinite(f.t))
  && ["landed", "hard", "outside", "aborted"].includes(r.result?.status);
const archive = createArchive(project, valid), scene = await createMarsScene("lander");
let state = newLander(), running = false, braking = false, frames = [], actions = [], activeRecord = null, startTime = 0, previous = 0, accumulator = 0, lastSample = 0;
const statusText = { landed: "柔和着陆", hard: "落地有点快", outside: "离开练习范围", aborted: "中途重新开始" };
function display(s, replay = false) {
  scene.render(s); $("#height").textContent = Math.max(0, s.height).toFixed(1); $("#speed").textContent = Math.abs(s.velocity).toFixed(1);
  $("#speed-label").textContent = s.velocity > 0 ? "上升速度" : "下降速度"; $("#fuel").textContent = String(Math.round(s.fuel / LANDER.fuelSeconds * 100));
  $("#scene").dataset.status = replay ? "replay" : s.status;
}
function sample() { frames.push({ ...state, braking }); }
function listRecords() {
  $("#records").replaceChildren();
  archive.records.forEach((r, i) => {
    const b = node("button", statusText[r.result.status], "record"); b.disabled = running;
    b.append(node("small", r.result.impact == null ? "未触地" : r.result.impact.toFixed(1) + " m/s"));
    b.onclick = () => showRecord(r); b.dataset.record = String(i); $("#records").append(b);
  });
  const graph = $("#comparison"), c = graph.getContext("2d"); graph.width = 560; graph.height = 160;
  c.clearRect(0, 0, 560, 160);
  const records = archive.records.slice(0, 2), maxT = Math.max(1, ...records.map(r => r.frames.at(-1).t)), maxH = Math.max(65, ...records.flatMap(r => r.frames.map(f => f.height)));
  records.forEach((r, i) => {
    c.strokeStyle = i ? "#8faabb" : "#e1b378"; c.lineWidth = 3; c.beginPath();
    r.frames.forEach((f, j) => { const x = 10 + f.t / maxT * 540, y = 145 - f.height / maxH * 130; if (j) c.lineTo(x, y); else c.moveTo(x, y); }); c.stroke();
  });
  if (records.length) $("#comparison-note").textContent = "横轴：模拟时间；纵轴：高度。金色为最新尝试" + (records.length > 1 ? "，蓝色为上一次。" : "。");
}
function showRecord(r) {
  if (running) return;
  activeRecord = r; $("#result").hidden = false; $("#result-title").textContent = statusText[r.result.status];
  $("#result-detail").textContent = r.result.impact == null ? "这次没有触地，操作与轨迹已留下。" : "落地速度 " + r.result.impact.toFixed(2) + " m/s。这是一次真实计算的模拟结果。";
  $("#replay").max = String(r.frames.length - 1); $("#replay").value = String(r.frames.length - 1);
  $("#replay-label").textContent = "回看模式；拖动不会产生新的一次尝试。"; display(r.frames.at(-1), true);
}
function finish(status = state.status) {
  running = false; state.status = status; sample();
  const r = { ...baseRecord(project, "landing-replay"), model: { ...LANDER }, elapsed_ms: Date.now() - startTime,
    actions, frames, result: { status, impact: state.impact }, renderer: $("#scene").dataset.renderer };
  archive.save(r); $("#start").disabled = false; $("#start").textContent = "再试一次"; $("#brake").disabled = true; braking = false;
  $("#brake").setAttribute("aria-pressed", "false"); $("#brake").textContent = "开启制动"; listRecords(); showRecord(r);
  $("#guide").textContent = status === "landed" ? "你让落地轻了下来！可以回看什么时候制动，再和上一次比一比。" : "这次尝试已经留下。回看轨迹，下次只改一个制动时机试试。";
}
function start() {
  state = newLander(); running = true; braking = false; accumulator = 0; lastSample = 0; previous = performance.now();
  startTime = Date.now(); frames = []; actions = [{ t: 0, action: "start" }]; sample();
  $("#start").disabled = true; $("#brake").disabled = false; $("#result").hidden = true; listRecords();
  $("#guide").textContent = "它开始下降了。速度越大，需要留给制动的距离越多。";
}
$("#start").onclick = start;
$("#brake").onclick = () => {
  if (!running) return; braking = !braking; actions.push({ t: state.t, action: braking ? "brake-on" : "brake-off" });
  $("#brake").setAttribute("aria-pressed", String(braking)); $("#brake").textContent = braking ? "松开制动" : "开启制动";
};
$("#restart").onclick = () => { if (running) finish("aborted"); start(); };
$("#replay").oninput = () => {
  if (!activeRecord || running) return; const f = activeRecord.frames[Number($("#replay").value)]; display(f, true);
  $("#replay-label").textContent = f.t.toFixed(1) + " 秒 · " + (f.braking ? "制动开启" : "自由下降") + " · 回看记录";
};
$("#download").onclick = () => { if (activeRecord) jsonDownload(activeRecord, "my-landing-replay.json"); };
setupHelp(() => !running ? "先点“开始下降”。下次可以试着早一点制动，再看落地速度怎样变化。" :
  braking ? "速度已经很小时，可以松开制动，让它继续靠近地面；不要一直向上飞。" :
  "别等快碰到地面才制动。先看速度：越快，就需要越早开始。");
function tick(now) {
  const dt = Math.min((now - (previous || now)) / 1000, .1); previous = now;
  if (running && !document.hidden) {
    accumulator += dt * .6;
    while (accumulator >= LANDER.dt && running) {
      accumulator -= LANDER.dt; state = stepLander(state, braking);
      if (state.t - lastSample >= .1) { sample(); lastSample = state.t; }
      if (state.status !== "flying") { finish(); break; }
    }
    if (running) display({ ...state, braking });
  }
  requestAnimationFrame(tick);
}
document.addEventListener("visibilitychange", () => { previous = performance.now(); accumulator = 0; });
$("#start").disabled = false; display(state); listRecords(); requestAnimationFrame(tick);
