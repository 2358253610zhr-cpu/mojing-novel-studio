const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { Pool } = require('pg');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const ACCESS_TOKEN = process.env.MOJING_ACCESS_TOKEN || '';
const DATABASE_URL = process.env.DATABASE_URL || '';

let pool = null;
let dbReady = false;

if (DATABASE_URL) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
}

async function initDb() {
  if (!pool) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    dbReady = true;
    console.log('墨境数据库已连接');
  } catch (err) {
    dbReady = false;
    console.error('数据库初始化失败:', err.message);
  }
}
initDb();

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
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > 15 * 1024 * 1024) throw new Error('REQUEST_TOO_LARGE');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

function authorized(req) {
  if (!ACCESS_TOKEN) return true;
  return req.headers['x-mojing-token'] === ACCESS_TOKEN;
}

function requireAuth(req, res) {
  if (authorized(req)) return true;
  send(res, 401, JSON.stringify({ ok:false, error:'UNAUTHORIZED', message:'同步密码不正确。' }));
  return false;
}

async function handleState(req, res) {
  if (!requireAuth(req, res)) return;
  if (!pool || !dbReady) return send(res, 503, JSON.stringify({ ok:false, error:'DATABASE_NOT_CONFIGURED', message:'云数据库尚未连接。' }));

  if (req.method === 'GET') {
    const result = await pool.query('SELECT data, updated_at FROM app_state WHERE key=$1', ['default']);
    if (!result.rows.length) return send(res, 200, JSON.stringify({ ok:true, state:null, updatedAt:null }));
    return send(res, 200, JSON.stringify({ ok:true, state:result.rows[0].data, updatedAt:result.rows[0].updated_at }));
  }

  if (req.method === 'PUT') {
    try {
      const body = await parseBody(req);
      if (!body || typeof body.state !== 'object') return send(res, 400, JSON.stringify({ ok:false, message:'state 格式无效' }));
      const result = await pool.query(
        `INSERT INTO app_state(key,data,updated_at) VALUES($1,$2::jsonb,NOW())
         ON CONFLICT(key) DO UPDATE SET data=EXCLUDED.data, updated_at=NOW()
         RETURNING updated_at`,
        ['default', JSON.stringify(body.state)]
      );
      return send(res, 200, JSON.stringify({ ok:true, updatedAt:result.rows[0].updated_at }));
    } catch (err) {
      return send(res, 500, JSON.stringify({ ok:false, message:'云端保存失败', detail:String(err.message || err) }));
    }
  }

  return send(res, 405, JSON.stringify({ ok:false, message:'Method Not Allowed' }));
}

async function handleAI(req, res) {
  if (!requireAuth(req, res)) return;
  const apiUrl = process.env.AI_API_URL;
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;
  if (!apiUrl || !apiKey || !model) {
    return send(res, 503, JSON.stringify({
      ok: false,
      error: 'AI_BACKEND_NOT_CONFIGURED',
      message: '云端 AI 尚未配置。请在 Render 设置 AI_API_URL、AI_API_KEY、AI_MODEL。'
    }));
  }

  const body = await parseBody(req);
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const temperature = typeof body.temperature === 'number' ? body.temperature : 0.8;
  if (!messages.length) return send(res, 400, JSON.stringify({ ok:false, message:'messages 不能为空' }));

  try {
    const endpoint = apiUrl.replace(/\/$/, '') + '/chat/completions';
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, temperature })
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) return send(res, upstream.status, JSON.stringify({ ok:false, message:'AI 上游请求失败', detail:data }));
    const text = data?.choices?.[0]?.message?.content || '';
    return send(res, 200, JSON.stringify({ ok:true, text }));
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
    if (err || !stat.isFile()) return send(res, 404, 'Not Found', 'text/plain; charset=utf-8');
    const ext = path.extname(safePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': mime[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=300'
    });
    fs.createReadStream(safePath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (u.pathname === '/api/health') {
      return send(res, 200, JSON.stringify({ ok:true, app:'mojing-novel-studio', version:'0.2.0', databaseReady:dbReady }));
    }
    if (u.pathname === '/api/config') {
      return send(res, 200, JSON.stringify({ ok:true, version:'0.2.0', databaseConfigured:!!DATABASE_URL, databaseReady:dbReady, aiConfigured:!!(process.env.AI_API_URL && process.env.AI_API_KEY && process.env.AI_MODEL), tokenRequired:!!ACCESS_TOKEN }));
    }
    if (u.pathname === '/api/state') return await handleState(req, res);
    if (u.pathname === '/api/ai' && req.method === 'POST') return await handleAI(req, res);
    return serveStatic(req, res);
  } catch (err) {
    return send(res, 500, JSON.stringify({ ok:false, message:'服务器异常', detail:String(err.message || err) }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`墨境 v0.2 已启动: http://0.0.0.0:${PORT}`);
});
