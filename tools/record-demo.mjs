#!/usr/bin/env node

/**
 * Capture the browser toolkit's real guided tour and cut it into docs/media/demo.mp4.
 * No browser automation package is required; this talks to a local Chromium browser
 * through its DevTools protocol and hands the resulting stills to ffmpeg.
 *
 * Usage:
 *   npm run demo                 # full stack at :8080
 *   npm run demo:record
 *
 * For a Vite session:
 *   DEMO_URL=http://127.0.0.1:5173 npm run demo:record
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mediaDir = join(repoRoot, 'docs', 'media');
const baseUrl = process.env.DEMO_URL || 'http://127.0.0.1:8080';
const port = Number(process.env.DEMO_DEBUG_PORT || 9223);
const profileDir = mkdtempSync(join(tmpdir(), 'fates-edge-demo-'));
const framesDir = join(profileDir, 'frames');

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  for (const candidate of candidates) {
    const result = spawnSync(candidate, ['--version'], { stdio: 'ignore' });
    if (!result.error) return candidate;
  }
  throw new Error('Chrome or Chromium was not found. Set CHROME_BIN to its executable.');
}

const sleep = ms => new Promise(resolvePromise => setTimeout(resolvePromise, ms));

async function waitForToolkit() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {}
    await sleep(500);
  }
  throw new Error(`The toolkit is not answering at ${baseUrl}. Start it before recording.`);
}

async function waitForDebugger() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
      const page = pages.find(item => item.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error('Chrome started, but its DevTools endpoint did not answer.');
}

function connectCDP(url) {
  const socket = new WebSocket(url);
  let nextId = 1;
  const pending = new Map();

  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve: resolveCall, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolveCall(message.result || {});
  });

  return {
    ready: new Promise((resolveReady, rejectReady) => {
      socket.addEventListener('open', resolveReady, { once: true });
      socket.addEventListener('error', rejectReady, { once: true });
    }),
    call(method, params = {}) {
      const id = nextId++;
      return new Promise((resolveCall, reject) => {
        pending.set(id, { resolve: resolveCall, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() { socket.close(); },
  };
}

async function evaluate(cdp, expression) {
  const result = await cdp.call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Browser evaluation failed.');
  return result.result?.value;
}

async function capture(cdp, filename) {
  const result = await cdp.call('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  const path = join(framesDir, filename);
  writeFileSync(path, Buffer.from(result.data, 'base64'));
  return path;
}

async function run() {
  mkdirSync(mediaDir, { recursive: true });
  mkdirSync(framesDir, { recursive: true });
  await waitForToolkit();

  const chrome = spawn(findChrome(), [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--mute-audio',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    '--window-size=1440,810',
    `${baseUrl}/#home`,
  ], { stdio: 'ignore' });

  try {
    const cdp = connectCDP(await waitForDebugger());
    await cdp.ready;
    await cdp.call('Page.enable');
    await cdp.call('Runtime.enable');
    await cdp.call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 810, deviceScaleFactor: 1, mobile: false });
    await sleep(2200);

    await evaluate(cdp, `
      (() => {
        document.querySelector('[data-action="dismiss-welcome"]')?.click();
        document.documentElement.style.scrollBehavior = 'auto';
        const style = document.createElement('style');
        style.textContent = '*{transition:none!important}.tab-content:focus{outline:none!important}';
        document.head.appendChild(style);
        window.scrollTo(0, 0);
      })()
    `);
    // A fresh, headless profile can finish the app shell before its initial
    // hash navigation. Visit a neighbouring route and come home so the first
    // frame always contains the actual landing page, not an empty shell.
    await evaluate(cdp, `document.querySelector('.sidebar-nav [data-tab="characters"]')?.click()`);
    await sleep(900);
    await evaluate(cdp, `document.querySelector('.sidebar-nav [data-tab="home"]')?.click()`);
    await sleep(1200);
    await evaluate(cdp, `window.scrollTo(0, 0)`);
    const home = await capture(cdp, 'toolkit-home.png');

    await evaluate(cdp, `document.querySelector('[data-action="product-tour"]')?.click()`);
    await sleep(1200);
    const tourHome = await capture(cdp, 'tour-01-home.png');
    const tourFrames = [tourHome];
    const names = ['characters', 'dice', 'encounter', 'spellcraft', 'docs'];
    for (let index = 0; index < names.length; index += 1) {
      await evaluate(cdp, `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))`);
      await sleep(1250);
      tourFrames.push(await capture(cdp, `tour-0${index + 2}-${names[index]}.png`));
    }

    writeFileSync(join(mediaDir, 'toolkit-home.png'), readFileSync(home));
    writeFileSync(join(mediaDir, 'toolkit-tour.png'), readFileSync(tourFrames[2]));

    await evaluate(cdp, `
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      location.hash = 'encounters';
    `);
    await sleep(1400);
    const encounter = await capture(cdp, 'toolkit-encounter.png');
    writeFileSync(join(mediaDir, 'toolkit-encounter.png'), readFileSync(encounter));

    const videoFrames = [home, ...tourFrames];
    const durations = [4.5, 6, 6, 6, 6, 6, 7];
    const inputs = [];
    const filters = [];
    videoFrames.forEach((frame, index) => {
      inputs.push('-loop', '1', '-t', String(durations[index]), '-i', frame);
      filters.push(`[${index}:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[v${index}]`);
    });
    let previous = 'v0';
    let elapsed = durations[0];
    for (let index = 1; index < videoFrames.length; index += 1) {
      const output = index === videoFrames.length - 1 ? 'outv' : `x${index}`;
      const offset = elapsed - (0.55 * index);
      filters.push(`[${previous}][v${index}]xfade=transition=fade:duration=0.55:offset=${offset.toFixed(2)}[${output}]`);
      previous = output;
      elapsed += durations[index];
    }

    const output = join(mediaDir, 'demo.mp4');
    const ffmpeg = spawnSync('ffmpeg', [
      '-y', '-hide_banner', '-loglevel', 'error',
      ...inputs,
      '-filter_complex', filters.join(';'),
      '-map', '[outv]', '-r', '30', '-c:v', 'libx264', '-preset', 'medium', '-crf', '22',
      '-movflags', '+faststart', '-pix_fmt', 'yuv420p', output,
    ], { stdio: 'inherit' });
    if (ffmpeg.status !== 0) throw new Error('ffmpeg could not assemble the demo video.');

    writeFileSync(join(mediaDir, 'demo-thumbnail.png'), readFileSync(tourHome));
    const pressSync = resolve(repoRoot, '..', 'fates-edge-docs', 'tools', 'sync_press_kit.py');
    if (existsSync(pressSync)) {
      const sync = spawnSync('python3', [pressSync, '--refresh-media'], { stdio: 'inherit' });
      if (sync.status !== 0) throw new Error('The demo was recorded, but the press-kit sync failed.');
    }
    cdp.close();
    console.log(`Recorded ${output}`);
  } finally {
    chrome.kill('SIGTERM');
    await sleep(250);
    rmSync(profileDir, { recursive: true, force: true });
  }
}

run().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
