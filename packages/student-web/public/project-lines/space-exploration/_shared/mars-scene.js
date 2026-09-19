import { GRID, TARGETS } from "./models.mjs";

export async function createMarsScene(kind) {
  const root = document.querySelector("#scene"), cameraRoot = document.querySelector("#camera-view");
  let canvas = document.createElement("canvas"), preview = document.createElement("canvas");
  root.prepend(canvas); if (cameraRoot) cameraRoot.prepend(preview);
  canvas.setAttribute("aria-label", kind === "lander" ? "探测器着陆模拟场景" : "火星车和自己的行驶路线");
  let renderImpl, last = null;
  const api = { render(data) { last = data; renderImpl(data); }, snapshot() { if (last) renderImpl(last); return (cameraRoot ? preview : canvas).toDataURL("image/jpeg", .9); } };
  function fallback() {
    canvas.remove(); preview.remove(); canvas = document.createElement("canvas"); preview = document.createElement("canvas");
    root.prepend(canvas); if (cameraRoot) cameraRoot.prepend(preview);
    root.dataset.renderer = "canvas";
    renderImpl = data => drawFallback(canvas, cameraRoot ? preview : null, kind, data, root);
    document.querySelector("#render-mode").textContent = "简化画面 · 操作与结果不变";
    if (last) renderImpl(last);
  }
  try {
    if (new URLSearchParams(location.search).get("renderer") === "canvas") throw new Error("使用简化场景");
    const T = await import("../spot-a-world/vendor/three.module.min.js");
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor(0x332c2b);
    const scene = new T.Scene(); scene.fog = new T.Fog(0x332c2b, 45, 100);
    scene.add(new T.HemisphereLight(0xf2e3cb, 0x574633, 2.8));
    const sunlight = new T.DirectionalLight(0xffe2b0, 3.4); sunlight.position.set(-15, 30, 10); scene.add(sunlight);
    const camera = new T.PerspectiveCamera(43, 1, .1, 180);
    const mat = (color, metalness = .05) => new T.MeshStandardMaterial({ color, roughness: .8, metalness });
    const ground = new T.Mesh(new T.PlaneGeometry(150, 150), mat(0xa66e4c)); ground.rotation.x = -Math.PI / 2; ground.position.y = -.06; scene.add(ground);
    const mesh = (geometry, color, x, y, z, parent = scene) => { const m = new T.Mesh(geometry, mat(color)); m.position.set(x, y, z); parent.add(m); return m; };
    // 固定程序地形；装饰石块只放在可驾驶区域外。
    for (let i = 0; i < 75; i++) {
      const x = Math.sin(i * 12.7) * 34, z = -8 - (i * 7.3 % 26);
      const stone = mesh(new T.DodecahedronGeometry(.25 + (i % 4) * .18, 0), i % 2 ? 0x925f44 : 0xbf8962, x, .15, z);
      stone.scale.y = .6; stone.rotation.set(i, i * .5, .2);
    }
    const body = new T.Group(); scene.add(body);
    let flame, trail, focusRing; const labels = [];
    const marker = (text, x, z) => {
      const label = document.createElement("canvas"); label.width = 256; label.height = 64;
      const c = label.getContext("2d"); c.fillStyle = "#10212ddd"; c.fillRect(0, 0, 256, 64);
      c.fillStyle = "#f0d2a4"; c.font = "24px sans-serif"; c.textAlign = "center"; c.fillText(text, 128, 41);
      const sprite = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(label), depthTest: false }));
      sprite.position.set(x, 3, z); sprite.scale.set(3.8, .95, 1); scene.add(sprite); labels.push(sprite);
    };
    if (kind === "lander") {
      camera.position.set(23, 20, 27); camera.lookAt(0, 5, 0);
      mesh(new T.CylinderGeometry(3.3, 3.4, .12, 64), 0x5b615b, 0, 0, 0);
      const ring = mesh(new T.TorusGeometry(2.5, .045, 8, 64), 0xefc98a, 0, .1, 0); ring.rotation.x = Math.PI / 2;
      mesh(new T.CylinderGeometry(.9, 1.1, .85, 6), 0xd6b375, 0, 1, 0, body);
      mesh(new T.BoxGeometry(1.4, .17, 1.1), 0xdfe1d7, 0, 1.55, 0, body);
      mesh(new T.CylinderGeometry(.055, .055, 1.1, 10), 0xeeeecc, .35, 2.1, 0, body);
      mesh(new T.SphereGeometry(.13, 12, 8), 0xe7d7b4, .35, 2.68, 0, body);
      for (const x of [-1, 1]) for (const z of [-1, 1]) {
        const leg = mesh(new T.CylinderGeometry(.055, .055, 1.45, 8), 0xc6c8bd, x * .9, .55, z * .9, body);
        leg.rotation.z = -x * .6; leg.rotation.x = z * .5;
        mesh(new T.CylinderGeometry(.28, .34, .1, 12), 0x454e51, x * 1.25, .05, z * 1.25, body);
      }
      flame = mesh(new T.ConeGeometry(.35, 1.8, 16), 0xedaa64, 0, -.55, 0, body); flame.rotation.z = Math.PI;
      marker("着陆目标区", 0, -4);
    } else {
      camera.position.set(24, 26, 29); camera.lookAt(9, 0, 7);
      const grid = new T.GridHelper(21.6, 9, 0xd6b080, 0xb98358); grid.position.set(9.6, .02, 7.2); scene.add(grid);
      GRID.blocks.forEach(([x, z], i) => {
        const rock = mesh(new T.DodecahedronGeometry(.95, 0), 0x805840, x * 2.4, .65, z * 2.4);
        rock.rotation.set(.2, i * .8, .25); rock.scale.set(1, .8, 1);
      });
      for (const [id, t] of Object.entries(TARGETS)) {
        if (id === "ridge") for (let j = 0; j < 4; j++) mesh(new T.CylinderGeometry(1.2 - j * .15, 1.3 - j * .15, .45, 7), j % 2 ? 0xc59065 : 0x986447, t.x * 2.4, .22 + j * .4, t.z * 2.4);
        else { const dune = mesh(new T.SphereGeometry(1.3, 24, 12), 0xd8a264, t.x * 2.4, 0, t.z * 2.4); dune.scale.set(1.4, .65, 1); }
        marker(t.label, t.x * 2.4, t.z * 2.4);
      }
      mesh(new T.BoxGeometry(1.15, .35, 1.55), 0xe3d8b7, 0, .65, 0, body);
      mesh(new T.BoxGeometry(1.6, .07, .9), 0x3b5260, 0, .91, 0, body);
      for (const x of [-.7, .7]) for (const z of [-.55, 0, .55]) {
        const wheel = mesh(new T.CylinderGeometry(.26, .26, .24, 16), 0x243239, x, .3, z, body); wheel.rotation.z = Math.PI / 2;
      }
      mesh(new T.CylinderGeometry(.055, .055, .8, 8), 0xd4d5c3, 0, 1.25, -.35, body);
      mesh(new T.BoxGeometry(.42, .25, .24), 0xced2c7, 0, 1.69, -.35, body);
      focusRing = mesh(new T.TorusGeometry(1.8, .035, 8, 64), 0xffd393, 0, .05, 0); focusRing.rotation.x = Math.PI / 2;
    }
    let previewRenderer, pov;
    if (cameraRoot) {
      previewRenderer = new T.WebGLRenderer({ canvas: preview, antialias: true, preserveDrawingBuffer: true });
      previewRenderer.setSize(640, 400, false); previewRenderer.setClearColor(0x79675a);
      pov = new T.PerspectiveCamera(63, 1.6, .1, 100);
    }
    renderImpl = data => {
      const { width, height } = root.getBoundingClientRect();
      if (canvas.clientWidth !== width || canvas.width !== Math.round(width * renderer.getPixelRatio()) || canvas.height !== Math.round(height * renderer.getPixelRatio())) renderer.setSize(width, height, false);
      camera.aspect = width / height; camera.updateProjectionMatrix();
      if (kind === "lander") { body.position.y = data.height * .22; flame.visible = Boolean(data.braking && data.fuel > 0); }
      else {
        body.position.set(data.x * 2.4, 0, data.z * 2.4); body.rotation.y = -data.yaw;
        const target = TARGETS[data.target || "ridge"]; focusRing.position.set(target.x * 2.4, .05, target.z * 2.4);
        if (trail) { scene.remove(trail); trail.geometry.dispose(); trail.material.dispose(); }
        const points = (data.path || [data]).map(p => new T.Vector3(p.x * 2.4, .08, p.z * 2.4));
        trail = new T.Line(new T.BufferGeometry().setFromPoints(points), new T.LineBasicMaterial({ color: 0xffd696 })); scene.add(trail);
        pov.position.set(data.x * 2.4, 1.65, data.z * 2.4);
        pov.lookAt(data.x * 2.4 + Math.sin(data.yaw) * 10, 1, data.z * 2.4 - Math.cos(data.yaw) * 10);
        body.visible = false; trail.visible = false; focusRing.visible = false; labels.forEach(label => { label.visible = false; });
        previewRenderer.render(scene, pov);
        body.visible = true; trail.visible = true; focusRing.visible = true; labels.forEach(label => { label.visible = true; });
      }
      renderer.render(scene, camera);
    };
    root.dataset.renderer = "webgl";
    const lost = event => { event.preventDefault(); fallback(); };
    canvas.addEventListener("webglcontextlost", lost);
    if (cameraRoot) preview.addEventListener("webglcontextlost", lost);
  } catch {
    fallback();
  }
  document.querySelector("#render-mode").textContent = root.dataset.renderer === "webgl" ? "3D 教学场景 · 非真实影像" : "简化画面 · 操作与结果不变";
  new ResizeObserver(() => { if (last) renderImpl(last); }).observe(root);
  return api;
}

function drawFallback(canvas, preview, kind, data, root) {
  const w = root.clientWidth, h = root.clientHeight; canvas.width = w * 2; canvas.height = h * 2;
  const c = canvas.getContext("2d"); c.scale(2, 2);
  const sky = c.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, "#172838"); sky.addColorStop(1, "#976a4b"); c.fillStyle = sky; c.fillRect(0, 0, w, h);
  c.fillStyle = "#ac7953"; c.beginPath(); c.moveTo(0, h * .77); c.lineTo(w * .3, h * .64); c.lineTo(w, h * .8); c.lineTo(w, h); c.lineTo(0, h); c.fill();
  if (kind === "lander") {
    const y = h * .77 - data.height / 180 * h * .65;
    c.strokeStyle = "#eed9a0"; c.beginPath(); c.ellipse(w / 2, h * .86, 65, 18, 0, 0, Math.PI * 2); c.stroke();
    c.fillStyle = "#d3b181"; c.fillRect(w / 2 - 23, y - 23, 46, 31);
    c.strokeStyle = "#dedccc"; c.lineWidth = 3; c.beginPath(); c.moveTo(w / 2 - 18, y); c.lineTo(w / 2 - 36, y + 24); c.moveTo(w / 2 + 18, y); c.lineTo(w / 2 + 36, y + 24); c.stroke();
    if (data.braking && data.fuel > 0) { c.fillStyle = "#f4b169"; c.beginPath(); c.moveTo(w / 2 - 8, y + 9); c.lineTo(w / 2, y + 51); c.lineTo(w / 2 + 8, y + 9); c.fill(); }
    return;
  }
  const scale = Math.min(w / 19, h / 11), project = (x, z) => ({ x: w * .42 + (x - z) * scale, y: h * .22 + (x + z) * scale * .46 });
  for (let z = 0; z < 7; z++) for (let x = 0; x < 9; x++) {
    const p = project(x, z); c.fillStyle = (x + z) % 2 ? "#b07c56" : "#a3714f"; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + scale, p.y + scale * .46); c.lineTo(p.x, p.y + scale * .92); c.lineTo(p.x - scale, p.y + scale * .46); c.closePath(); c.fill();
  }
  c.lineWidth = 2; c.strokeStyle = "#f5d48d"; c.beginPath();
  (data.path || []).forEach((p, i) => { const v = project(p.x, p.z); if (i) c.lineTo(v.x, v.y); else c.moveTo(v.x, v.y); }); c.stroke();
  for (const [x, z] of GRID.blocks) { const p = project(x, z); c.fillStyle = "#755444"; c.beginPath(); c.ellipse(p.x, p.y, scale * .6, scale * .55, -.2, 0, Math.PI * 2); c.fill(); }
  for (const t of Object.values(TARGETS)) { const p = project(t.x, t.z); c.fillStyle = t.color; c.beginPath(); c.ellipse(p.x, p.y, scale * .8, scale * .6, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = "#fff0d2"; c.font = "11px sans-serif"; c.fillText(t.label, p.x - 22, p.y - 22); }
  const p = project(data.x, data.z); c.fillStyle = "#e3e0d0"; c.fillRect(p.x - 12, p.y - 8, 24, 16); c.strokeStyle = "#333f45"; c.lineWidth = 4; c.strokeRect(p.x - 14, p.y - 10, 28, 20);
  if (preview) {
    preview.width = 640; preview.height = 400; const d = preview.getContext("2d");
    d.fillStyle = "#8c7462"; d.fillRect(0, 0, 640, 400); d.fillStyle = "#b78354"; d.fillRect(0, 180, 640, 220);
    for (const t of Object.values(TARGETS)) {
      const dx = t.x - data.x, dz = t.z - data.z, distance = Math.hypot(dx, dz);
      const angle = Math.atan2(dx, -dz) - data.yaw;
      if (Math.cos(angle) > .3) {
        const x = 320 + Math.tan(angle) * 450, size = 130 / Math.max(.5, distance);
        d.fillStyle = t.color; d.beginPath(); d.ellipse(x, 200, size, size * .7, 0, 0, Math.PI * 2); d.fill();
        d.fillStyle = "#fff2d2"; d.font = "18px sans-serif"; d.fillText(t.label, x - 38, 195 - size);
      }
    }
    d.fillStyle = "#f1d9b5"; d.font = "15px monospace"; d.fillText("SIMULATED / " + data.x + "," + data.z, 20, 375);
  }
}
