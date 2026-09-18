// 教学场景不使用实况天文坐标；照片始终裁剪自孩子当前看到的画布。
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const KEY = "systemedu:spot-a-world:v1";
const VERSION = "spot-a-world/1";
const WORLDS = {
  moon: { name: "月球", yaw: -.22, pitch: .065, distance: 20, radius: 1.6, seed: 91 },
  mars: { name: "火星", yaw: .26, pitch: -.09, distance: 22, radius: 1.5, seed: 427 },
};
const canvas = $("#universe");
const sky = $("#sky");
const frame = $("#capture-frame");
const startedAt = Date.now();
const state = { target: "moon", yaw: 0, pitch: 0, zoom: 1, moved: false, zoomed: false, ready: false };
let album = [], activePhoto = null, backend = null, storageOK = true, actions = [];
let width = 1, height = 1, toastTimer, completed = false;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const round = (n) => Math.round(n * 10000) / 10000;
const finite = (n) => typeof n === "number" && Number.isFinite(n);

function randomGenerator(seed) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}
function direction(yaw, pitch) {
  return { x: Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw) * Math.cos(pitch) };
}
function record(type, detail = {}) {
  actions.push({ type, at_ms: Date.now() - startedAt, ...detail });
  if (actions.length > 200) actions.shift();
}
function announce(message) {
  clearTimeout(toastTimer);
  $("#live-status").textContent = message;
  toastTimer = setTimeout(() => { $("#live-status").textContent = ""; }, 5000);
}
function storageWarning(message) {
  $("#storage-note").textContent = message;
  $("#storage-note").classList.add("warning");
}
function validPhoto(photo) {
  return photo && photo.schema_version === VERSION && typeof photo.id === "string"
    && photo.origin === "simulated" && photo.artifact_id === "sky-observation"
    && WORLDS[photo.target] && typeof photo.image === "string"
    && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(photo.image) && photo.image.length < 1600000
    && typeof photo.created_at === "string" && Number.isFinite(Date.parse(photo.created_at))
    && photo.view && finite(photo.view.yaw) && Math.abs(photo.view.yaw) <= .7
    && finite(photo.view.pitch) && Math.abs(photo.view.pitch) <= .45
    && finite(photo.view.zoom) && photo.view.zoom >= 1 && photo.view.zoom <= 2.8
    && photo.evidence?.manual_pan === true && photo.evidence?.manual_zoom === true
    && Array.isArray(photo.evidence.actions) && typeof photo.note === "string";
}
function loadAlbum() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved)) throw new Error("invalid album");
    album = saved.filter(validPhoto).slice(0, 6);
    if (album.length !== saved.length) storageWarning("部分旧记录无法读取，已跳过；新照片仍可保存和下载。");
  } catch {
    // 不覆盖无法读取的数据，当前作品可留在会话内并下载。
    storageOK = false;
    storageWarning("本机相册暂时无法读取。新照片仍可拍摄，请下载带走。");
  }
  $("#album-count").textContent = String(album.length);
}
function persist() {
  $("#album-count").textContent = String(album.length);
  if (!storageOK) return false;
  try {
    localStorage.setItem(KEY, JSON.stringify(album));
    return true;
  } catch {
    storageOK = false;
    storageWarning("浏览器没有保存成功。请下载照片和记录，关闭页面后可能丢失。");
    return false;
  }
}

// 固定种子纹理保证恢复镜头时不会换成另一张地表，纹理为程序绘制。
function makeTexture(target) {
  const random = randomGenerator(WORLDS[target].seed);
  const texture = document.createElement("canvas");
  texture.width = 1024; texture.height = 512;
  const ctx = texture.getContext("2d");
  const data = ctx.createImageData(1024, 512);
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 1024; x++) {
      const n = (random() - .5) * 25;
      const waves = Math.sin(x * .017 + Math.sin(y * .02) * 3) * Math.sin(y * .026) * 14;
      const i = (y * 1024 + x) * 4;
      const base = target === "moon" ? [164, 168, 167] : [181, 103, 65];
      data.data[i] = base[0] + n + waves;
      data.data[i + 1] = base[1] + n + waves;
      data.data[i + 2] = base[2] + n + waves;
      data.data[i + 3] = 255;
    }
  }
  ctx.putImageData(data, 0, 0);
  for (let i = 0; i < (target === "moon" ? 230 : 95); i++) {
    const x = random() * 1024, y = random() * 512, r = 2 + random() ** 3 * 44;
    const g = ctx.createRadialGradient(x - r * .18, y - r * .18, r * .12, x, y, r);
    g.addColorStop(0, target === "moon" ? "#3b47554f" : "#57352148");
    g.addColorStop(.7, target === "moon" ? "#39444c66" : "#773b2955");
    g.addColorStop(.83, "#eeeece33"); g.addColorStop(1, "#b9c1bb00");
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  if (target === "mars") {
    const polar = ctx.createLinearGradient(0, 0, 0, 48);
    polar.addColorStop(0, "#e5dbcda0"); polar.addColorStop(1, "#e5dbcd00");
    ctx.fillStyle = polar; ctx.fillRect(0, 0, 1024, 48);
  }
  return texture;
}
const textures = { moon: makeTexture("moon"), mars: makeTexture("mars") };

// 与透视相机一致的投影也用于验收和无 WebGL 时的简化画面。
function project(yaw, pitch, radius = 0, distance = 1) {
  const v = direction(yaw, pitch), forward = direction(state.yaw, state.pitch);
  const right = { x: Math.cos(state.yaw), y: 0, z: Math.sin(state.yaw) };
  const up = { x: -Math.sin(state.yaw) * Math.sin(state.pitch), y: Math.cos(state.pitch), z: Math.cos(state.yaw) * Math.sin(state.pitch) };
  const depth = v.x * forward.x + v.y * forward.y + v.z * forward.z;
  const scale = height / (2 * Math.tan((48 / state.zoom) * Math.PI / 360));
  return {
    x: width / 2 + (v.x * right.x + v.z * right.z) * scale / depth,
    y: height / 2 - (v.x * up.x + v.y * up.y + v.z * up.z) * scale / depth,
    // 稍放宽外轮廓半径，确保照片不会切掉透视球体边缘。
    r: radius / distance * scale / depth * 1.015,
    visible: depth > .1,
  };
}
function cropBounds() {
  const bounds = activeCanvas().getBoundingClientRect(), box = frame.getBoundingClientRect();
  return { x: box.left - bounds.left, y: box.top - bounds.top, size: box.width };
}
function currentTarget() {
  const w = WORLDS[state.target];
  return project(w.yaw, w.pitch, w.radius, w.distance);
}
function updateInstructions() {
  if (!backend) return;
  const p = currentTarget(), box = cropBounds(), name = WORLDS[state.target].name;
  const inside = p.visible && p.x - p.r > box.x + 5 && p.x + p.r < box.x + box.size - 5
    && p.y - p.r > box.y + 5 && p.y + p.r < box.y + box.size - 5;
  state.ready = inside && state.moved && state.zoomed;
  frame.classList.toggle("ready", state.ready);
  frame.dataset.ready = String(state.ready);
  $(".finder-status").classList.toggle("ready", state.ready);
  $("#shutter").disabled = !state.ready;
  $("#step-find").className = state.moved ? "done" : "current";
  $("#step-frame").className = state.ready ? "done" : state.moved ? "current" : "";
  $("#step-photo").className = completed ? "done" : state.ready ? "current" : "";
  let hint;
  if (!state.moved) {
    hint = `先拖动天空，试着把${name}移进取景框。`;
  } else if (p.r * 2 > box.size - 20) {
    hint = `${name}太大啦，点一下“−”，给它留一点空间。`;
  } else if (!inside) {
    const horizontal = p.x - p.r <= box.x + 5 ? "左" : p.x + p.r >= box.x + box.size - 5 ? "右" : "";
    const vertical = p.y - p.r <= box.y + 5 ? "上" : p.y + p.r >= box.y + box.size - 5 ? "下" : "";
    hint = `点方向按钮向${horizontal}${vertical || (!horizontal ? "上" : "")}移动镜头，让${name}完整进入框里。`;
  } else if (!state.zoomed) {
    hint = `找到${name}了！点一下“＋”或拖动倍率，试试更近的构图。`;
  } else {
    hint = `构图就绪。按下快门，留下你眼中的${name}！`;
  }
  $("#guide-text").textContent = hint;
  $("#aim-hint").textContent = state.ready ? `${name}已入镜 · 可以拍照` : hint;
  $("#shutter-hint").textContent = state.ready ? "这一张，将是你亲手完成的作品" : !state.moved ? "先移动镜头，让目标进入取景框" : !state.zoomed && inside ? "再调整一次放大倍率" : "让完整目标留在取景框内";
  $("#zoom-value").textContent = `${state.zoom.toFixed(1)}×`;
  $("#view-coordinate").textContent = `${Math.round(state.yaw * 180 / Math.PI)}° / ${Math.round(state.pitch * 180 / Math.PI)}°`;
}
function draw() { backend?.render(); updateInstructions(); }
function resize() {
  width = sky.clientWidth; height = sky.clientHeight;
  backend?.resize(); draw();
}

async function createThreeRenderer() {
  const THREE = await import("./vendor/three.module.min.js");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setClearColor(0x101b27);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, .1, 500);
  scene.add(new THREE.AmbientLight(0xc6d4ed, .42));
  const sun = new THREE.DirectionalLight(0xfff0d6, 2.5);
  sun.position.set(-9, 5, 8); scene.add(sun);
  for (const [id, w] of Object.entries(WORLDS)) {
    const texture = new THREE.CanvasTexture(textures[id]);
    texture.colorSpace = THREE.SRGBColorSpace;
    const body = new THREE.Mesh(new THREE.SphereGeometry(w.radius, 80, 48), new THREE.MeshStandardMaterial({ map: texture, bumpMap: texture, bumpScale: .045, roughness: 1 }));
    const d = direction(w.yaw, w.pitch);
    body.position.set(d.x * w.distance, d.y * w.distance, d.z * w.distance);
    body.rotation.set(.12, id === "moon" ? .7 : -.5, .08);
    scene.add(body);
  }
  const random = randomGenerator(103), positions = [], colors = [];
  for (let i = 0; i < 2000; i++) {
    const d = direction((random() - .5) * Math.PI * 2, Math.asin(random() * 2 - 1));
    positions.push(d.x * 180, d.y * 180, d.z * 180);
    const b = .3 + random() * .65; colors.push(b * .88, b * .94, b);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  scene.add(new THREE.Points(geometry, new THREE.PointsMaterial({ size: .2, vertexColors: true, sizeAttenuation: true })));
  return {
    name: "webgl",
    resize() { renderer.setSize(width, height, false); camera.aspect = width / height; },
    render() {
      camera.fov = 48 / state.zoom; camera.updateProjectionMatrix();
      const d = direction(state.yaw, state.pitch); camera.lookAt(d.x, d.y, d.z);
      renderer.render(scene, camera);
    },
  };
}
function createCanvasRenderer() {
  // 获取 WebGL 失败后替换画布，避免已占用的上下文影响降级；交互绑定在父容器上。
  let surface = canvas;
  let ctx = surface.getContext("2d");
  if (!ctx) {
    surface = canvas.cloneNode(); canvas.replaceWith(surface);
    ctx = surface.getContext("2d");
  }
  const random = randomGenerator(103);
  const stars = Array.from({ length: 680 }, () => ({ yaw: (random() - .5) * 2.2, pitch: (random() - .5) * 1.6, r: .4 + random() * .85, alpha: .15 + random() * .65 }));
  $("#renderer-note").hidden = false;
  return {
    name: "canvas",
    surface,
    resize() { surface.width = width * Math.min(devicePixelRatio || 1, 2); surface.height = height * Math.min(devicePixelRatio || 1, 2); },
    render() {
      ctx.setTransform(surface.width / width, 0, 0, surface.height / height, 0, 0);
      ctx.fillStyle = "#101b27"; ctx.fillRect(0, 0, width, height);
      for (const star of stars) {
        const p = project(star.yaw, star.pitch);
        if (!p.visible) continue;
        ctx.beginPath(); ctx.arc(p.x, p.y, star.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(222,234,246,${star.alpha})`; ctx.fill();
      }
      for (const [id, w] of Object.entries(WORLDS)) {
        const p = project(w.yaw, w.pitch, w.radius, w.distance);
        if (!p.visible) continue;
        const r = p.r / 1.015;
        ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(textures[id], 260, 0, 512, 512, p.x - r, p.y - r, r * 2, r * 2);
        const shade = ctx.createRadialGradient(p.x - r * .35, p.y - r * .3, r * .1, p.x - r * .5, p.y - r * .25, r * 1.8);
        shade.addColorStop(0, "#fff4dc22"); shade.addColorStop(.5, "#02091210"); shade.addColorStop(.85, "#020912dc"); shade.addColorStop(1, "#020912ff");
        ctx.fillStyle = shade; ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2); ctx.restore();
      }
    },
  };
}
function activeCanvas() { return backend?.surface || canvas; }
function targetSelect(target, reset = true) {
  state.target = target;
  if (reset) { state.moved = false; state.zoomed = false; completed = false; record("select_target", { target }); }
  $$("[data-target]").forEach(button => { button.classList.toggle("active", button.dataset.target === target); button.setAttribute("aria-pressed", String(button.dataset.target === target)); });
  draw();
}
function pan(dx, dy, source) {
  if (!backend) return;
  const before = { yaw: state.yaw, pitch: state.pitch };
  state.yaw = clamp(state.yaw + dx, -.7, .7);
  state.pitch = clamp(state.pitch + dy, -.45, .45);
  if (state.yaw !== before.yaw || state.pitch !== before.pitch) {
    state.moved = true; completed = false;
    record("pan", { source, yaw: round(state.yaw), pitch: round(state.pitch) });
  }
  draw();
}
function zoom(value, source) {
  const next = clamp(Math.round(value * 10) / 10, 1, 2.8);
  if (state.zoom !== next) { state.zoomed = true; completed = false; record("zoom", { source, value: next }); }
  state.zoom = next; $("#zoom").value = String(next); draw();
}
function download(blob, filename) {
  const url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function showPhoto(photo, saved = true) {
  activePhoto = photo;
  $("#photo-image").src = photo.image;
  $("#photo-image").alt = `你在教学场景中拍摄的${WORLDS[photo.target].name}取景`;
  $("#photo-target").textContent = WORLDS[photo.target].name;
  $("#save-status").textContent = saved ? "作品已保存到这个浏览器。也可以下载，给家人看看。" : "作品已拍好，但没有写入本机存储。请下载带走，关闭页面后可能丢失。";
  $("#photo-meta").textContent = `模拟观测 / ${photo.view.zoom.toFixed(1)}× / ${new Date(photo.created_at).toLocaleString("zh-CN", { hour12: false })}`;
  $$("[data-note]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.note === photo.note)));
  if (!$("#photo-dialog").open) $("#photo-dialog").showModal();
}
function capture() {
  updateInstructions();
  if (!state.ready) return;
  backend.render();
  const surface = activeCanvas(), box = cropBounds();
  const output = document.createElement("canvas"); output.width = 720; output.height = 720;
  output.getContext("2d").drawImage(surface, box.x * surface.width / width, box.y * surface.height / height, box.size * surface.width / width, box.size * surface.height / height, 0, 0, 720, 720);
  record("capture", { target: state.target });
  const photo = {
    schema_version: VERSION, artifact_id: "sky-observation", project_id: "spot-a-world", line_id: "space-exploration",
    id: globalThis.crypto?.randomUUID?.() || `photo-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    created_at: new Date().toISOString(), origin: "simulated", target: state.target, target_name: WORLDS[state.target].name,
    image: output.toDataURL("image/jpeg", .91), image_width: 720, image_height: 720, note: "",
    view: { yaw: round(state.yaw), pitch: round(state.pitch), zoom: state.zoom, viewport: { width, height }, crop: { ...box } },
    evidence: { manual_pan: state.moved, manual_zoom: state.zoomed, target_fully_in_frame: true, elapsed_ms: Date.now() - startedAt, actions: [...actions] },
    provided_modules: ["procedural-sky/1", "telescope-controls/1", "local-observation-guide/1"],
    provenance: { renderer: backend.name, texture: "程序生成的教学纹理，非天文照片", coordinates: "为教学排布，非真实天体方位", generator_version: VERSION, texture_seed: WORLDS[state.target].seed },
  };
  album.unshift(photo); album = album.slice(0, 6);
  const saved = persist(); completed = true; updateInstructions();
  sky.classList.remove("shutter-flash"); void sky.offsetWidth; sky.classList.add("shutter-flash");
  showPhoto(photo, saved);
}
function renderAlbum() {
  const grid = $("#album-grid"); grid.replaceChildren();
  if (!album.length) {
    const empty = document.createElement("p"); empty.className = "album-empty";
    empty.textContent = "这里还没有照片。先移动镜头，拍下你的第一张。"; grid.append(empty); return;
  }
  for (const photo of album) {
    const item = document.createElement("article"); item.className = "album-item";
    const open = document.createElement("button"), img = document.createElement("img"), title = document.createElement("strong"), date = document.createElement("small");
    img.src = photo.image; img.alt = `${WORLDS[photo.target].name}观测照片`;
    title.textContent = `${WORLDS[photo.target].name} · ${photo.view.zoom.toFixed(1)}×`;
    date.textContent = new Date(photo.created_at).toLocaleDateString("zh-CN");
    open.append(img, title, date); open.addEventListener("click", () => { $("#album-dialog").close(); showPhoto(photo, storageOK); });
    const restore = document.createElement("button"); restore.className = "restore"; restore.textContent = "恢复这个镜头 ↗";
    restore.addEventListener("click", () => {
      state.yaw = photo.view.yaw; state.pitch = photo.view.pitch; state.zoom = photo.view.zoom;
      state.moved = false; state.zoomed = false; completed = false;
      $("#zoom").value = String(state.zoom); actions = [];
      record("restore_view", { source_photo_id: photo.id });
      targetSelect(photo.target, false); $("#album-dialog").close();
      announce("已恢复镜头。原照片完整保留，再调整一次就能创作新照片。");
      activeCanvas().focus({ preventScroll: true });
    });
    item.append(open, restore); grid.append(item);
  }
}

$$("[data-target]").forEach(button => button.addEventListener("click", () => targetSelect(button.dataset.target)));
const steps = { left: [-.045, 0], right: [.045, 0], up: [0, .04], down: [0, -.04] };
$$("[data-direction]").forEach(button => button.addEventListener("click", () => pan(...steps[button.dataset.direction], "button")));
$("#zoom").addEventListener("input", event => zoom(Number(event.target.value), "slider"));
$("#zoom-in").addEventListener("click", () => zoom(state.zoom + .2, "button"));
$("#zoom-out").addEventListener("click", () => zoom(state.zoom - .2, "button"));
$("#shutter").addEventListener("click", capture);
let pointer = null;
sky.addEventListener("pointerdown", event => {
  if (event.target !== activeCanvas() || event.button !== 0) return;
  pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
  activeCanvas().setPointerCapture(event.pointerId); activeCanvas().focus({ preventScroll: true });
});
sky.addEventListener("pointermove", event => {
  if (!pointer || pointer.id !== event.pointerId) return;
  const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
  if (Math.abs(dx) + Math.abs(dy) < 2) return;
  const factor = (48 / state.zoom) * Math.PI / 180 / height;
  pan(-dx * factor, dy * factor, "drag"); pointer.x = event.clientX; pointer.y = event.clientY;
});
for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) sky.addEventListener(name, () => { pointer = null; });
sky.addEventListener("keydown", event => {
  if (event.target !== activeCanvas()) return;
  const key = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" }[event.key];
  if (key) { event.preventDefault(); pan(...steps[key], "keyboard"); }
  if (event.key === "Enter") { event.preventDefault(); capture(); }
});
$("#help").addEventListener("click", () => {
  updateInstructions(); record("request_hint");
  announce($("#guide-text").textContent);
  activeCanvas().focus({ preventScroll: false });
});
$("#open-album").addEventListener("click", () => { renderAlbum(); $("#album-dialog").showModal(); });
$("#open-about").addEventListener("click", () => $("#about-dialog").showModal());
$$("[data-close]").forEach(button => button.addEventListener("click", () => document.getElementById(button.dataset.close).close()));
$("#retake").addEventListener("click", () => { $("#photo-dialog").close(); activeCanvas().focus({ preventScroll: true }); });
$$("[data-note]").forEach(button => button.addEventListener("click", () => {
  if (!activePhoto) return;
  activePhoto.note = button.dataset.note; record("choose_observation", { note: activePhoto.note });
  activePhoto.evidence.actions.push({ type: "choose_observation", note: activePhoto.note, at_ms: Date.now() - startedAt });
  const saved = persist(); showPhoto(activePhoto, saved);
}));
$("#download-record").addEventListener("click", () => {
  if (!activePhoto) return;
  download(new Blob([JSON.stringify(activePhoto, null, 2)], { type: "application/json" }), `sky-observation-${activePhoto.target}-${activePhoto.id.slice(0, 8)}.json`);
  announce("已交给浏览器下载：观测记录包含照片、镜头和操作。");
});
$("#download-photo").addEventListener("click", async () => {
  if (!activePhoto) return;
  const photo = activePhoto, img = new Image(); img.src = photo.image;
  await img.decode();
  const output = document.createElement("canvas"); output.width = 840; output.height = 940;
  const ctx = output.getContext("2d"); ctx.fillStyle = "#f2eddf"; ctx.fillRect(0, 0, 840, 940); ctx.drawImage(img, 40, 40, 760, 760);
  ctx.fillStyle = "#243443"; ctx.font = "26px sans-serif"; ctx.fillText(`我的第一张星球照片 · ${WORLDS[photo.target].name}`, 40, 846);
  ctx.fillStyle = "#5b686f"; ctx.font = "17px sans-serif"; ctx.fillText(`模拟观测 / ${photo.view.zoom.toFixed(1)}× / ${photo.note || "我的取景"}`, 40, 881);
  ctx.font = "13px sans-serif"; ctx.fillText("SystemEdu · 太空探索 · 教学场景，非天文实拍", 40, 916);
  output.toBlob(blob => { if (blob) download(blob, `我的星球照片-${WORLDS[photo.target].name}-${photo.id.slice(0, 8)}.png`); }, "image/png");
});

async function start() {
  loadAlbum();
  width = sky.clientWidth; height = sky.clientHeight;
  try {
    if (new URLSearchParams(location.search).get("renderer") === "canvas") throw new Error("requested fallback");
    backend = await createThreeRenderer();
  } catch {
    backend = createCanvasRenderer();
  }
  sky.dataset.renderer = backend.name;
  activeCanvas().addEventListener("webglcontextlost", event => {
    event.preventDefault(); backend = null; state.ready = false;
    $("#shutter").disabled = true; frame.dataset.ready = "false"; frame.classList.remove("ready");
    $("#loading").textContent = "画面暂时中断，请刷新页面。已保存的照片仍在相册中。";
    $("#loading").hidden = false;
  });
  $("#loading").hidden = true;
  resize(); new ResizeObserver(resize).observe(sky);
  record("start", { target: state.target, renderer: backend.name });
}
start().catch(() => {
  $("#loading").replaceChildren(document.createTextNode("观测台暂时没有打开，请刷新页面重试。"));
});
