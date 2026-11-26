'use strict';
const [id, token] = location.hash.slice(1).split('.');
history.replaceState(null, '', '/camera'); // Keep the capability out of copied links and browser history.
const video = document.querySelector('video'), status = document.querySelector('#status');
const start = document.querySelector('#start'), stop = document.querySelector('#stop');
let stream, ended = false, starting = false, heartbeat, loop;
const valid = /^[a-f0-9]{32}$/.test(id || '') && /^[a-f0-9]{64}$/.test(token || '');
const request = (suffix = '', options = {}) => fetch(`/camera/${id}${suffix}`, {...options, signal:AbortSignal.timeout(5000), cache:'no-store', headers:{'X-Camera-Token':token,...options.headers}});
function release(message) {
  ended = true; clearInterval(heartbeat); clearTimeout(loop);
  stream?.getTracks().forEach(track => track.stop()); stream = null; video.srcObject = null;
  start.disabled = true; stop.disabled = true; status.textContent = message;
}
async function monitor() {
  try { if (!(await request('/status')).ok) release('连接已结束。需要拍照时，请在模拟器重新点击「拍一张」。'); }
  catch { release('本机连接已断开，摄像头已停止。'); }
}
async function sendFrame() {
  if (ended || !stream) return;
  try {
    if (video.readyState >= 2 && video.videoWidth) {
      const canvas = document.createElement('canvas');
      const ratio = Math.min(1, 1024 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * ratio); canvas.height = Math.round(video.videoHeight * ratio);
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .83));
      if (ended) return;
      if (!blob || !(await request('/frame', {method:'POST', headers:{'Content-Type':'image/jpeg'}, body:blob})).ok) {
        release('连接已结束，摄像头已停止。'); return;
      }
    }
    loop = setTimeout(sendFrame, 300);
  } catch { release('画面传递中断，摄像头已停止。'); }
}
start.onclick = async () => {
  if (ended || starting) return;
  starting = true; start.disabled = true; status.textContent = '请允许浏览器使用摄像头…';
  try {
    if (!(await request('/status')).ok) { release('连接已过期，请在模拟器重新连接。'); return; }
    const media = await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:960}},audio:false});
    if (ended) { media.getTracks().forEach(track => track.stop()); return; }
    stream = media;
    stream.getVideoTracks().forEach(track => track.addEventListener('ended', () => {
      request('/error', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason:'NotReadableError'})}).catch(() => {});
      release('摄像头已断开，请从模拟器重新连接。');
    }));
    video.srcObject = stream; await video.play();
    if (ended) return;
    stop.disabled = false; status.textContent = '已连接。回到 iPad 模拟器取景、拍照即可。';
    sendFrame();
  } catch (error) {
    try { await request('/error', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason:error.name})}); } catch {}
    release(error.name === 'NotAllowedError' ? '相机权限未开启，请在浏览器和 Mac 系统设置中允许摄像头，再从模拟器重试。' : '无法开启摄像头，请检查设备是否连接或被其他应用占用。');
  } finally { starting = false; }
};
stop.onclick = () => { request('', {method:'DELETE'}).catch(() => {}); release('摄像头已停止。'); };
window.addEventListener('pagehide', () => { if (valid) request('', {method:'DELETE',keepalive:true}).catch(() => {}); release('摄像头已停止。'); });
if (valid) {
  request('/status').then(response => {
    if (!response.ok) { release('连接已过期，请从模拟器重新打开。'); return; }
    start.disabled = false; status.textContent = '点击连接，允许这台 Mac 的摄像头用于模拟器取景。';
    heartbeat = setInterval(monitor, 1000);
  }).catch(() => release('本机服务暂时不可用。'));
} else release('请先在 iPad 模拟器里点击「拍一张」，不要直接打开此页。');
