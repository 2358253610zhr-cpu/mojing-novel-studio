const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function send(res, status, body, type='application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(body);
}

async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

async function handleAI(req, res) {
  const apiUrl = process.env.AI_API_URL;
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;
  if (!apiUrl || !apiKey || !model) {
    return send(res, 503, JSON.stringify({
      ok: false,
      error: 'AI_BACKEND_NOT_CONFIGURED',
      message: '云端 AI 尚未配置。请在部署平台设置 AI_API_URL、AI_API_KEY、AI_MODEL。'
    }));
  }

  const body = await parseBody(req);
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const temperature = typeof body.temperature === 'number' ? body.temperature : 0.8;

  if (!messages.length) {
    return send(res, 400, JSON.stringify({ ok:false, message:'messages 不能为空' }));
  }

  try {
    const endpoint = apiUrl.replace(/\/$/, '') + '/chat/completions';
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model, messages, temperature })
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      return send(res, upstream.status, JSON.stringify({ ok:false, message:'AI 上游请求失败', detail:data }));
    }
    const text = data?.choices?.[0]?.message?.content || '';
    return send(res, 200, JSON.stringify({ ok:true, text, raw:data }));
  } catch (err) {
    return send(res, 500, JSON.stringify({ ok:false, message:'AI 请求异常', detail:String(err) }));
  }
}

function serveStatic(req, res) {
  const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(u.pathname);
  if (pathname === '/') pathname = '/index.html';
  const safePath = path.normalize(path.join(ROOT, pathname));
  if (!safePath.startsWith(ROOT)) return send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
  fs.stat(safePath, (err, stat) => {
    if (err || !stat.isFile()) {
      return send(res, 404, 'Not Found', 'text/plain; charset=utf-8');
    }
    const ext = path.extname(safePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': mime[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=3600'
    });
    fs.createReadStream(safePath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/api/health') {
    return send(res, 200, JSON.stringify({ ok:true, app:'mojing-novel-studio', version:'0.1.0' }));
  }
  if (req.url === '/api/ai' && req.method === 'POST') {
    return handleAI(req, res);
  }
  serveStatic(req, res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`墨境已启动: http://0.0.0.0:${PORT}`);
});
