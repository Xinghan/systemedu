import { GRID, TARGETS, moveRover, photoReady, isBlocked } from "../_shared/models.mjs";
import { $, $$, node, createArchive, baseRecord, recordBaseValid, validImage, imageDownload, jsonDownload, setupHelp } from "../_shared/storage.js";
import { createMarsScene, VISUAL_VERSION } from "../_shared/mars-scene.js";
const project = "drive-and-frame";
const validPose = p => p && Number.isInteger(p.x) && Number.isInteger(p.z) && !isBlocked(p.x, p.z) && Number.isFinite(p.yaw);
const archive = createArchive(project, r => recordBaseValid(r, project, "first-drive") && validImage(r.image) && TARGETS[r.target]
  && Array.isArray(r.path) && r.path.length >= 4 && r.path.length <= 500 && r.path.every(validPose) && validPose(r.pose));
const scene = await createMarsScene("rover");
let pose = { ...GRID.start, yaw: 0 }, target = "ridge", path = [{ ...pose }], moves = 0, actions = [], active = null, replaying = false, startTime = Date.now();
function render(value = pose, route = path) {
  scene.render({ ...value, path: route, target });
  const t = TARGETS[target]; $("#distance").textContent = Math.hypot(t.x - value.x, t.z - value.z).toFixed(1); $("#moves").textContent = String(moves);
  const directions = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"];
  $("#heading").textContent = directions[((Math.round(value.yaw / (Math.PI / 4)) % 8) + 8) % 8];
  $("#capture").disabled = replaying || !photoReady(pose, target, moves); $("#scene").dataset.pose = value.x + "," + value.z;
}
function act(type, detail = {}) { actions.push({ type, elapsed_ms: Date.now() - startTime, ...detail }); if (actions.length > 500) actions.shift(); }
function move(direction) {
  replaying = false;
  const next = moveRover(pose, direction); act("move", { direction, blocked: next.blocked }); pose = { x: next.x, z: next.z, yaw: next.yaw };
  if (!next.blocked) { moves++; path.push({ ...pose }); if (path.length > 499) { $("#guide").textContent = "路线已经很长了，可以先拍照或回到起点开新一轮。"; path = path.slice(-499); } }
  $("#guide").textContent = next.blocked ? "这里被挡住了。试着沿岩石的上方或下方绕过去。" : photoReady(pose, target, moves) ? "目标已经在镜头里。现在可以拍下你的发现。" : "继续接近标记。到目标旁边后，可以转动镜头把它放进画面。";
  render();
}
$$("[data-direction]").forEach(b => { b.onclick = () => move(b.dataset.direction); });
$$("[data-target]").forEach(b => { b.onclick = () => {
  target = b.dataset.target; replaying = false; act("target", { target });
  $$("[data-target]").forEach(v => v.setAttribute("aria-pressed", String(v === b))); render();
}; });
for (const [id, sign] of [["look-left", -1], ["look-right", 1]]) $("#" + id).onclick = () => {
  replaying = false; pose.yaw += sign * Math.PI / 4; act("camera-turn", { yaw: pose.yaw });
  $("#guide").textContent = photoReady(pose, target, moves) ? "目标已进入镜头，可以拍照了。" : "看取景窗，试着让目标出现在画面中央。"; render();
};
document.addEventListener("keydown", event => {
  if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
  const direction = { ArrowUp: "north", ArrowDown: "south", ArrowLeft: "west", ArrowRight: "east" }[event.key];
  if (direction) { event.preventDefault(); move(direction); }
});
$("#reset").onclick = () => {
  pose = { ...GRID.start, yaw: 0 }; path = [{ ...pose }]; moves = 0; actions = []; startTime = Date.now(); replaying = false;
  $("#guide").textContent = "回到起点了。已有照片仍然留在下面的相册里。"; $("#result").hidden = true; render();
};
function show(record) {
  active = record; $("#result").hidden = false; $("#photo").src = record.image;
  $("#photo-meta").textContent = TARGETS[record.target].label + " · " + record.path.length + " 个路线位置 · 模拟照片";
  $("#replay").max = String(record.path.length - 1); $("#replay").value = String(record.path.length - 1);
  $("#replay-label").textContent = "拖动查看记录中的位置；回看不算新的驾驶。";
}
function list() {
  $("#records").replaceChildren(); archive.records.forEach((r, i) => {
    const b = node("button", TARGETS[r.target].label, "record"); b.append(node("small", r.path.length + " 个路线位置")); b.dataset.record = String(i);
    b.onclick = () => { show(r); replaying = true; scene.render({ ...r.pose, target: r.target, path: r.path, instant: true }); $("#capture").disabled = true; }; $("#records").append(b);
  });
}
$("#capture").onclick = () => {
  if (replaying || !photoReady(pose, target, moves)) return;
  render(); act("capture");
  const r = { ...baseRecord(project, "first-drive"), target, pose: { ...pose }, path: path.map(p => ({ ...p })), image: scene.snapshot(), actions: [...actions], elapsed_ms: Date.now() - startTime, renderer: $("#scene").dataset.renderer, visual_version: VISUAL_VERSION };
  archive.save(r); show(r); list(); $("#guide").textContent = "这张照片和路线是你决定的。可以下载，也可以换个观察点再试。";
};
$("#replay").oninput = () => {
  if (!active) return; replaying = true; const index = Number($("#replay").value), p = active.path[index];
  scene.render({ ...p, target: active.target, path: active.path.slice(0, index + 1), instant: true }); $("#capture").disabled = true;
  $("#replay-label").textContent = "回看位置 " + (index + 1) + " / " + active.path.length + "。下一次驾驶从当前任务的位置继续。";
};
$("#download-photo").onclick = () => { if (active) imageDownload(active.image, "my-rover-photo.jpg"); };
$("#download-record").onclick = () => { if (active) jsonDownload(active, "my-first-drive.json"); };
setupHelp(() => target === "ridge" ? "中间的岩石像一道墙。先往北开，到墙的上方，再往东接近层状岩石。" : "可以从岩石墙的下方绕行。接近沙丘后，用左右转镜头来取景。");
render(); list();
