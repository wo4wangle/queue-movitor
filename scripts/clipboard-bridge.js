const http = require('http');
const { spawn } = require('child_process');

const HOST = process.env.CLIPBOARD_BRIDGE_HOST || '127.0.0.1';
const PORT = Number(process.env.CLIPBOARD_BRIDGE_PORT || 8031);
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const ALLOWED_ORIGINS = new Set([
  'http://localhost:8030',
  'http://127.0.0.1:8030',
]);
const WINDOWS_SET_CLIPBOARD_COMMAND =
  '[Console]::InputEncoding = [System.Text.Encoding]::UTF8; Set-Clipboard -Value ([Console]::In.ReadToEnd())';
const WINDOWS_GET_CLIPBOARD_COMMAND =
  '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-Clipboard -Raw';

function isAllowedOrigin(origin) {
  return !origin || ALLOWED_ORIGINS.has(origin);
}

function sendJson(res, statusCode, body, origin) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin || 'http://localhost:8030' : 'null',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  });
  res.end(JSON.stringify(body));
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on('data', (chunk) => {
      size += chunk.length;

      if (size > MAX_BODY_BYTES) {
        reject(new Error('request body is too large'));
        req.destroy();
        return;
      }

      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function writeClipboardWithCommand(command, args, text) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['pipe', 'ignore', 'pipe'],
      windowsHide: true,
    });
    let stderr = '';

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr.trim() || `${command} exited with code ${code}`));
      }
    });
    child.stdin.end(text);
  });
}

function readClipboardWithCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr.trim() || `${command} exited with code ${code}`));
      }
    });
  });
}

async function writeClipboard(text) {
  if (process.platform === 'win32') {
    await writeClipboardWithCommand('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      WINDOWS_SET_CLIPBOARD_COMMAND,
    ], text);
    return;
  }

  if (process.platform === 'darwin') {
    await writeClipboardWithCommand('pbcopy', [], text);
    return;
  }

  try {
    await writeClipboardWithCommand('wl-copy', [], text);
  } catch {
    await writeClipboardWithCommand('xclip', ['-selection', 'clipboard'], text);
  }
}

async function readClipboard() {
  if (process.platform === 'win32') {
    return readClipboardWithCommand('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      WINDOWS_GET_CLIPBOARD_COMMAND,
    ]);
  }

  if (process.platform === 'darwin') {
    return readClipboardWithCommand('pbpaste', []);
  }

  try {
    return await readClipboardWithCommand('wl-paste', ['--no-newline']);
  } catch {
    return readClipboardWithCommand('xclip', ['-selection', 'clipboard', '-o']);
  }
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;

  if (!isAllowedOrigin(origin)) {
    sendJson(res, 403, { ok: false, error: 'origin is not allowed' }, origin);
    return;
  }

  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true }, origin);
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, { ok: true, platform: process.platform }, origin);
    return;
  }

  if (req.method === 'GET' && req.url === '/clipboard') {
    try {
      const text = await readClipboard();
      sendJson(res, 200, { ok: true, text }, origin);
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) }, origin);
    }
    return;
  }

  if (req.method !== 'POST' || req.url !== '/clipboard') {
    sendJson(res, 404, { ok: false, error: 'not found' }, origin);
    return;
  }

  try {
    const rawBody = await collectBody(req);
    const parsedBody = JSON.parse(rawBody);
    const text = typeof parsedBody.text === 'string' ? parsedBody.text : '';

    await writeClipboard(text);
    sendJson(res, 200, { ok: true }, origin);
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) }, origin);
  }
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`Clipboard bridge listening on http://${HOST}:${PORT}`);
  });
}

module.exports = {
  WINDOWS_GET_CLIPBOARD_COMMAND,
  WINDOWS_SET_CLIPBOARD_COMMAND,
};
