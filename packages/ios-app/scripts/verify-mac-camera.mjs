// Real browser + real HTTP integration, with Chromium's synthetic video device only.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../../..');
const server = spawn(resolve(root, '.venv/bin/python'), [resolve(root, 'packages/ios-app/services/camera_test_server.py'), '--mode', 'browser', '--port', '0'], {cwd: root, stdio:['ignore','pipe','inherit']});
const lines = [], pending = [];
createInterface({input:server.stdout}).on('line', line => {
  const data = JSON.parse(line); if (pending.length) pending.shift()(data); else lines.push(data);
});
const nextLine = () => lines.length ? Promise.resolve(lines.shift()) : new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(Error('fixture timeout')), 10000);
  pending.push(value => {clearTimeout(timer); resolve(value);});
});
let browser;
try {
  const {port} = await nextLine(), origin = `http://127.0.0.1:${port}`;
  browser = await chromium.launch({headless:true, args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
  const context = await browser.newContext({viewport:{width:1100,height:1000}});
  async function session() {
    const id = randomBytes(16).toString('hex'), reader = randomBytes(32).toString('hex');
    const response = await fetch(origin+'/camera', {method:'POST',headers:{'Content-Type':'application/json','X-SystemEdu-Camera':'simulator'},body:JSON.stringify({id,reader})});
    assert.equal(response.status,202);
    const {cameraURL} = await nextLine();
    const read = () => fetch(`${origin}/camera/${id}`, {headers:{'X-Camera-Token':reader}});
    const close = () => fetch(`${origin}/camera/${id}`, {method:'DELETE',headers:{'X-Camera-Token':reader}});
    return {cameraURL,read,close};
  }
  const live = await session(), page = await context.newPage();
  await page.goto(live.cameraURL); await page.locator('#start').click();
  assert.equal(new URL(page.url()).hash,'');
  await page.waitForFunction(() => document.querySelector('video').srcObject?.getVideoTracks().length === 1);
  assert.equal(await page.evaluate(() => document.querySelector('video').srcObject.getAudioTracks().length),0);
  let result;
  for (let attempt=0;attempt<30;attempt++) {
    result = await (await live.read()).json(); if (result.image) break;
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  assert.equal(result.status,'live');
  assert.equal(Buffer.from(result.image,'base64').readUInt16BE(0),0xffd8);
  await page.evaluate(() => {window.testTrack = document.querySelector('video').srcObject.getVideoTracks()[0];});
  await live.close();
  await page.waitForFunction(() => window.testTrack.readyState === 'ended');
  assert.equal(await page.locator('#start').isDisabled(),true);
  await page.close();
  console.log('PASS: synthetic browser video reaches reader; no audio; cancel stops track.');

  const denied = await session(), failure = await context.newPage();
  await failure.addInitScript(() => { navigator.mediaDevices.getUserMedia = async () => {throw new DOMException('denied','NotAllowedError');}; });
  await failure.goto(denied.cameraURL); await failure.locator('#start').click();
  await failure.waitForFunction(() => document.querySelector('#status').textContent.includes('权限未开启'));
  const failed = await (await denied.read()).json();
  assert.equal(failed.status,'failed'); assert.equal(failed.image,undefined);
  await denied.close(); await failure.close();
  console.log('PASS: denied permission reaches Simulator status without an image.');

  const expired = await session(), stale = await context.newPage();
  await stale.goto(expired.cameraURL); await stale.locator('#start').click();
  await stale.waitForFunction(() => document.querySelector('video').srcObject?.getVideoTracks().length === 1);
  await stale.evaluate(() => {window.testTrack = document.querySelector('video').srcObject.getVideoTracks()[0];});
  await stale.waitForFunction(() => window.testTrack.readyState === 'ended', null, {timeout:20000});
  assert.equal((await expired.read()).status,404);
  await stale.close();
  console.log('PASS: lost Simulator heartbeat expires session and stops browser camera.');
} finally { await browser?.close(); server.kill('SIGTERM'); }
