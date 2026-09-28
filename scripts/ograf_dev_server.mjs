#!/usr/bin/env node

import http from 'node:http'
import path from 'node:path'
import { readFile, stat } from 'node:fs/promises'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

function parseArgs(argv) {
  const args = { root: null, host: '127.0.0.1', port: 4173 }
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--host') args.host = argv[++index]
    else if (value === '--port') args.port = Number(argv[++index])
    else if (!args.root) args.root = value
    else throw new Error(`Unexpected argument: ${value}`)
  }
  if (!args.root) throw new Error('Usage: ograf_dev_server.mjs <graphic-directory> [--host 127.0.0.1] [--port 4173]')
  if (!Number.isInteger(args.port) || args.port < 1 || args.port > 65535) throw new Error('Port must be between 1 and 65535')
  return args
}

const args = parseArgs(process.argv.slice(2))
const root = path.resolve(args.root)

await Promise.all(['project.json', 'index.html'].map(async (name) => {
  const info = await stat(path.join(root, name))
  if (!info.isFile()) throw new Error(`Required entry is not a file: ${name}`)
}))

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.mp3', 'audio/mpeg'],
  ['.wav', 'audio/wav'],
  ['.mp4', 'video/mp4'],
])

function send(response, statusCode, body, contentType = 'text/plain; charset=utf-8') {
  response.writeHead(statusCode, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Allow-Origin': '*',
  })
  response.end(body)
}

function graphicPath(urlPath) {
  let relative
  try {
    relative = decodeURIComponent(urlPath.slice('/graphic/'.length))
  } catch {
    return null
  }
  if (!relative || relative.includes('\0')) return null
  const candidate = path.resolve(root, relative)
  const prefix = `${root}${path.sep}`
  return candidate === root || candidate.startsWith(prefix) ? candidate : null
}

const debugHtml = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OGraf Debugger</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: #09090b; color: #f4f4f5; }
    button, input, select, textarea { font: inherit; }
    button { min-height: 42px; cursor: pointer; border: 1px solid #3f3f46; border-radius: 9px; background: #18181b; color: #f4f4f5; padding: 0 14px; transition: border-color .18s, background .18s; }
    button:hover { border-color: #8b5cf6; background: #27272a; }
    button.primary { border-color: #7c3aed; background: #7c3aed; font-weight: 700; }
    button.primary:hover { background: #6d28d9; }
    .app { display: grid; min-height: 100vh; grid-template-columns: minmax(0, 1fr) 360px; }
    .main { min-width: 0; padding: 22px; }
    .topbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
    h1 { margin: 0; font-size: 18px; }
    .meta { margin-top: 5px; color: #a1a1aa; font-size: 12px; }
    .status { display: inline-flex; align-items: center; gap: 7px; border: 1px solid #3f3f46; border-radius: 999px; padding: 7px 11px; color: #d4d4d8; font-size: 12px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #71717a; }
    .status.ready .dot { background: #22c55e; box-shadow: 0 0 14px #22c55e; }
    .status.error .dot { background: #ef4444; box-shadow: 0 0 14px #ef4444; }
    .stage-shell { display: grid; min-height: calc(100vh - 142px); place-items: center; overflow: hidden; border: 1px solid #27272a; border-radius: 14px; background: #111113; padding: 18px; }
    .stage { position: relative; width: 100%; max-height: calc(100vh - 180px); overflow: hidden; border: 1px solid #3f3f46; border-radius: 8px; background: repeating-conic-gradient(#1c1c20 0 25%, #242429 0 50%) 50% / 28px 28px; box-shadow: 0 28px 70px rgba(0,0,0,.38); }
    iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; background: transparent; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
    .sidebar { overflow: auto; max-height: 100vh; border-left: 1px solid #27272a; background: #111113; padding: 18px; }
    .panel { margin-bottom: 16px; border: 1px solid #27272a; border-radius: 12px; background: #18181b; padding: 14px; }
    .panel h2 { margin: 0 0 12px; font-size: 13px; text-transform: uppercase; letter-spacing: .08em; color: #d4d4d8; }
    .field { display: grid; gap: 7px; margin-bottom: 13px; }
    .field:last-child { margin-bottom: 0; }
    .field label { font-size: 12px; font-weight: 700; color: #d4d4d8; }
    .field small { color: #71717a; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .field input:not([type="checkbox"]):not([type="color"]), .field select, .field textarea { width: 100%; min-height: 38px; border: 1px solid #3f3f46; border-radius: 8px; outline: 0; background: #09090b; color: #fafafa; padding: 8px 10px; }
    .field input:focus, .field select:focus, .field textarea:focus { border-color: #8b5cf6; box-shadow: 0 0 0 3px rgba(139,92,246,.15); }
    .field textarea { resize: vertical; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; line-height: 1.5; }
    .color-row, .range-row { display: flex; align-items: center; gap: 9px; }
    .color-row input[type="color"] { width: 44px; height: 38px; border: 1px solid #3f3f46; border-radius: 8px; background: #09090b; padding: 3px; }
    .range-row input[type="range"] { flex: 1; }
    .logs { height: 180px; overflow: auto; margin: 0; white-space: pre-wrap; color: #a1a1aa; font: 11px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace; }
    .empty { color: #71717a; font-size: 12px; }
    @media (max-width: 900px) { .app { grid-template-columns: 1fr; } .sidebar { max-height: none; border-left: 0; border-top: 1px solid #27272a; } .stage-shell { min-height: 50vh; } }
  </style>
</head>
<body>
  <div class="app">
    <main class="main">
      <div class="topbar">
        <div><h1 id="title">OGraf Debugger</h1><div class="meta" id="meta"></div></div>
        <div class="status" id="status"><span class="dot"></span><span id="statusText">Loading project</span></div>
      </div>
      <div class="stage-shell"><div class="stage" id="stage"><iframe id="graphic" title="OGraf preview" sandbox="allow-scripts" referrerpolicy="no-referrer"></iframe></div></div>
      <div class="toolbar">
        <label>Canvas <select id="canvas"><option value="project">Project</option><option value="1920x1080">Landscape 1920×1080</option><option value="1080x1920">Portrait 1080×1920</option></select></label>
        <button class="primary" id="start">Start</button>
        <button id="stop">Stop</button>
        <button id="update">Update</button>
        <button id="reload">Reload</button>
      </div>
    </main>
    <aside class="sidebar">
      <section class="panel"><h2>Schema controls</h2><div id="form"></div></section>
      <section class="panel"><h2>Protocol log</h2><pre class="logs" id="logs"></pre></section>
    </aside>
  </div>
  <script>
    const frame = document.querySelector('#graphic');
    const stage = document.querySelector('#stage');
    const form = document.querySelector('#form');
    const logs = document.querySelector('#logs');
    const status = document.querySelector('#status');
    const statusText = document.querySelector('#statusText');
    const readers = new Map();
    let project = null;
    let data = {};
    let updateTimer = 0;

    function log(message, payload) {
      const stamp = new Date().toLocaleTimeString();
      const suffix = payload === undefined ? '' : ' ' + JSON.stringify(payload);
      logs.textContent += '[' + stamp + '] ' + message + suffix + '\n';
      logs.scrollTop = logs.scrollHeight;
    }

    function setStatus(text, kind = '') {
      status.className = 'status' + (kind ? ' ' + kind : '');
      statusText.textContent = text;
    }

    let renderCharacteristics;
    function send(message) {
      if (message.type === 'ograf:update') message = { ...message, renderCharacteristics };
      frame.contentWindow?.postMessage(message, '*');
      log('host -> graphic ' + message.type, message.data);
    }

    function constraint(value, fallback) {
      if (typeof value === 'number') return value;
      if (value && typeof value === 'object') return value.exact ?? value.ideal ?? fallback;
      return fallback;
    }

    function renderSize(manifest) {
      const selected = document.querySelector('#canvas').value;
      const resolution = selected === 'project' ? manifest.resolution : selected;
      const match = typeof resolution === 'string' && resolution.match(/^(\d+)x(\d+)$/);
      const requirement = selected === 'project' ? manifest.renderRequirements?.resolution || {} : {};
      const width = constraint(requirement.width, match ? Number(match[1]) : 1920);
      const height = constraint(requirement.height, match ? Number(match[2]) : 1080);
      const fps = constraint(manifest.renderRequirements?.frameRate, manifest.fps || 30);
      renderCharacteristics = { resolution: { width, height }, frameRate: fps };
      stage.style.aspectRatio = width + ' / ' + height;
      stage.style.width = 'min(100%, calc((100vh - 180px) * ' + (width / height) + '))';
      document.querySelector('#meta').textContent = width + '×' + height + ' @ ' + fps + 'fps';
    }

    function fieldShell(key, property) {
      const shell = document.createElement('div');
      shell.className = 'field';
      const label = document.createElement('label');
      label.textContent = property.title || key;
      const code = document.createElement('small');
      code.textContent = key;
      label.append(' ', code);
      shell.append(label);
      return shell;
    }

    function textInput(type, value) {
      const input = document.createElement('input');
      input.type = type;
      input.value = value ?? '';
      return input;
    }

    function createField(key, property, value) {
      const shell = fieldShell(key, property);
      const type = property.type || 'string';
      const isColor = property.format === 'color' || String(property.gddType || '').startsWith('color-');
      let control;
      let read;

      if (Array.isArray(property.enum)) {
        control = document.createElement('select');
        for (const optionValue of property.enum) {
          const option = document.createElement('option');
          option.value = String(optionValue);
          option.textContent = property.enumTitles?.[optionValue] ?? String(optionValue);
          option.selected = optionValue === value;
          control.append(option);
        }
        read = () => control.value;
      } else if (type === 'boolean') {
        control = textInput('checkbox', '');
        control.checked = Boolean(value);
        read = () => control.checked;
      } else if (type === 'number' || type === 'integer') {
        const wrap = document.createElement('div');
        wrap.className = 'range-row';
        control = textInput('number', value ?? '');
        control.step = type === 'integer' ? '1' : 'any';
        if (property.minimum !== undefined) control.min = property.minimum;
        if (property.maximum !== undefined) control.max = property.maximum;
        wrap.append(control);
        if (property.minimum !== undefined && property.maximum !== undefined) {
          const range = textInput('range', value ?? property.minimum);
          range.min = property.minimum;
          range.max = property.maximum;
          range.step = type === 'integer' ? '1' : 'any';
          control.addEventListener('input', () => { range.value = control.value; });
          range.addEventListener('input', () => { control.value = range.value; queueUpdate(); });
          wrap.append(range);
        }
        shell.append(wrap);
        read = () => control.value === '' ? undefined : Number(control.value);
      } else if (isColor) {
        const wrap = document.createElement('div');
        wrap.className = 'color-row';
        const color = textInput('color', String(value || '#000000').slice(0, 7));
        control = textInput('text', value || '#000000');
        color.addEventListener('input', () => {
          control.value = color.value + (control.value.length === 9 ? control.value.slice(7) : '');
          queueUpdate();
        });
        control.addEventListener('input', () => { if (/^#[0-9a-f]{6}/i.test(control.value)) color.value = control.value.slice(0, 7); });
        wrap.append(color, control);
        shell.append(wrap);
        read = () => control.value;
      } else if (type === 'array' || type === 'object') {
        control = document.createElement('textarea');
        control.rows = 5;
        control.value = JSON.stringify(value ?? (type === 'array' ? [] : {}), null, 2);
        read = () => JSON.parse(control.value);
      } else if (property.gddType === 'multi-line') {
        control = document.createElement('textarea');
        control.rows = 4;
        control.value = String(value ?? '');
        read = () => control.value;
      } else {
        control = textInput('text', String(value ?? ''));
        read = () => control.value;
      }

      if (!shell.contains(control)) shell.append(control);
      if (property.description) {
        const help = document.createElement('small');
        help.textContent = property.description;
        shell.append(help);
      }
      control.addEventListener('input', () => queueUpdate());
      control.addEventListener('change', () => queueUpdate(true));
      readers.set(key, read);
      return shell;
    }

    function collect() {
      const next = {};
      for (const [key, read] of readers) {
        const value = read();
        if (value !== undefined) next[key] = value;
      }
      return next;
    }

    function applyUpdate() {
      try {
        data = collect();
        send({ type: 'ograf:update', data });
      } catch (error) {
        setStatus('Invalid form value', 'error');
        log('form error', String(error));
      }
    }

    function queueUpdate(immediate = false) {
      clearTimeout(updateTimer);
      if (immediate) applyUpdate();
      else updateTimer = setTimeout(applyUpdate, 140);
    }

    function renderForm() {
      readers.clear();
      form.replaceChildren();
      const properties = project.schema?.properties || {};
      for (const [key, property] of Object.entries(properties)) {
        const value = Object.hasOwn(project.data || {}, key) ? project.data[key] : property.default;
        form.append(createField(key, property, value));
      }
      if (!Object.keys(properties).length) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = 'No schema.properties found.';
        form.append(empty);
      }
      data = collect();
    }

    function reload() {
      setStatus('Loading iframe');
      frame.src = '/graphic/index.html?v=' + Date.now();
      log('reload');
    }

    frame.addEventListener('load', () => {
      setStatus('Loaded; waiting for ready');
      send({ type: 'ograf:update', data });
    });

    addEventListener('message', (event) => {
      if (event.source !== frame.contentWindow) return;
      if (event.origin !== 'null') return;
      const message = event.data;
      if (!message || typeof message !== 'object') return;
      if (!['ograf:ready', 'ograf:ended', 'ograf:error'].includes(message.type)) return;
      log('graphic -> host ' + message.type, message.error);
      if (message.type === 'ograf:ready') {
        setStatus('Ready', 'ready');
        send({ type: 'ograf:update', data });
      } else if (message.type === 'ograf:ended') setStatus('Ended');
      else setStatus(message.error || 'Graphic error', 'error');
    });

    document.querySelector('#canvas').addEventListener('change', () => { renderSize(project); send({ type: 'ograf:update', data }); });
    document.querySelector('#start').addEventListener('click', () => send({ type: 'ograf:start' }));
    document.querySelector('#stop').addEventListener('click', () => send({ type: 'ograf:stop' }));
    document.querySelector('#update').addEventListener('click', applyUpdate);
    document.querySelector('#reload').addEventListener('click', reload);

    fetch('/__ograf__/project.json', { cache: 'no-store' })
      .then((response) => { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
      .then((manifest) => {
        project = manifest;
        document.querySelector('#title').textContent = manifest.name || 'OGraf Debugger';
        renderSize(manifest);
        renderForm();
        reload();
      })
      .catch((error) => { setStatus('Project error', 'error'); log('project error', String(error)); });
  </script>
</body>
</html>`

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)
  try {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      send(response, 405, 'Method not allowed')
      return
    }
    if (requestUrl.pathname === '/' || requestUrl.pathname === '/__ograf__') {
      response.writeHead(302, { Location: '/__ograf__/debug' })
      response.end()
      return
    }
    if (requestUrl.pathname === '/__ograf__/debug') {
      send(response, 200, request.method === 'HEAD' ? '' : debugHtml, 'text/html; charset=utf-8')
      return
    }
    if (requestUrl.pathname === '/__ograf__/project.json') {
      const body = await readFile(path.join(root, 'project.json'))
      send(response, 200, request.method === 'HEAD' ? '' : body, 'application/json; charset=utf-8')
      return
    }
    if (requestUrl.pathname.startsWith('/graphic/')) {
      const file = graphicPath(requestUrl.pathname)
      if (!file) {
        send(response, 400, 'Invalid path')
        return
      }
      const info = await stat(file)
      if (!info.isFile()) {
        send(response, 404, 'Not found')
        return
      }
      const body = request.method === 'HEAD' ? '' : await readFile(file)
      send(response, 200, body, mimeTypes.get(path.extname(file).toLowerCase()) || 'application/octet-stream')
      return
    }
    send(response, 404, 'Not found')
  } catch (error) {
    const code = error && error.code === 'ENOENT' ? 404 : 500
    send(response, code, code === 404 ? 'Not found' : String(error))
  }
})

server.listen(args.port, args.host, () => {
  const url = `http://${args.host}:${args.port}/__ograf__/debug`
  console.log(`OGraf root: ${root}`)
  console.log(`OGraf debugger: ${url}`)
})

function shutdown() {
  server.close(() => process.exit(0))
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
