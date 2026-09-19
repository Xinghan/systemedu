export const $ = selector => document.querySelector(selector);
export const $$ = selector => [...document.querySelectorAll(selector)];
export function node(tag, text, className = "") {
  const item = document.createElement(tag); item.textContent = text; item.className = className; return item;
}
export function jsonDownload(value, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function imageDownload(data, filename) { const a = document.createElement("a"); a.href = data; a.download = filename; a.click(); }
export function createArchive(project, validate) {
  const key = "systemedu:" + project + ":v1";
  let records = [], writable = true;
  const message = text => { $("#storage-status").textContent = text; };
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const saved = JSON.parse(raw);
      if (!Array.isArray(saved) || saved.length > 30 || !saved.every(validate)) throw new Error("格式错误");
      records = saved.slice(0, 6); message("已找回 " + records.length + " 份本机作品。");
    }
  } catch { writable = false; message("旧记录无法读取，未覆盖。新作品请下载带走。"); }
  return {
    get records() { return records; },
    save(record) {
      records = [record, ...records].slice(0, 6);
      if (writable) {
        try { localStorage.setItem(key, JSON.stringify(records)); message("已保存到本机浏览器，可随时下载。"); return true; }
        catch { writable = false; }
      }
      message("没有写入本机。请下载作品，关闭页面后可能丢失。"); return false;
    },
  };
}
export function baseRecord(project, artifact) {
  return { schema_version: project + "/1", artifact_id: artifact, origin: "simulated", id: crypto.randomUUID(), created_at: new Date().toISOString(), scene_version: "mars-training/1", provided_modules: ["程序生成的教学场景", "预置运动与碰撞模型", "本地规则提示"], evidence_type: "simulation-not-real-hardware" };
}
export function recordBaseValid(record, project, artifact) {
  return record?.schema_version === project + "/1" && record.artifact_id === artifact && record.origin === "simulated"
    && typeof record.id === "string" && Number.isFinite(Date.parse(record.created_at)) && record.scene_version === "mars-training/1";
}
export const validImage = value => typeof value === "string" && value.length < 1800000 && /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value);
export function setupHelp(text) { $("#help").onclick = () => { $("#guide").textContent = typeof text === "function" ? text() : text; }; }
export function fitCanvas(canvas) {
  const box = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(box.width * dpr)); canvas.height = Math.max(1, Math.round(box.height * dpr));
  return { w: box.width, h: box.height, dpr };
}
