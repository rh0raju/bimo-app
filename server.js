'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PUB = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PORT = Number(process.env.PORT) || 8090;
const SESSION_DAYS = 14;
const COOKIE_SECURE = process.env.COOKIE_SECURE === '1';

function loadEnv() {
  try {
    for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
}
loadEnv();

let db = { users: [], orders: [], products: [], expenses: [], sessions: {} };
function loadDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    try {
      db = Object.assign(db, JSON.parse(fs.readFileSync(DB_FILE, 'utf8')));
    } catch {
      fs.renameSync(DB_FILE, DB_FILE + '.bad');
    }
  }
  const now = Date.now();
  for (const t of Object.keys(db.sessions)) if (db.sessions[t].exp < now) delete db.sessions[t];
}
function save() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DB_FILE);
}
const uid = () => crypto.randomBytes(8).toString('hex');

function hashPw(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(pw, salt, 64).toString('hex');
}
function checkPw(pw, stored) {
  const [salt, h] = String(stored).split(':');
  if (!salt || !h) return false;
  const t = crypto.scryptSync(pw, salt, 64);
  const b = Buffer.from(h, 'hex');
  return b.length === t.length && crypto.timingSafeEqual(b, t);
}

const ENC_KEY = process.env.ENCRYPTION_KEY
  ? crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY).digest() : null;
function encrypt(text) {
  if (!ENC_KEY) return 'plain:' + text;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv);
  const d = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return 'gcm:' + iv.toString('hex') + ':' + c.getAuthTag().toString('hex') + ':' + d.toString('hex');
}
function decrypt(s) {
  if (!s) return '';
  if (s.startsWith('plain:')) return s.slice(6);
  if (s.startsWith('gcm:') && ENC_KEY) {
    const [, iv, tag, d] = s.split(':');
    const de = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, Buffer.from(iv, 'hex'));
    de.setAuthTag(Buffer.from(tag, 'hex'));
    return Buffer.concat([de.update(Buffer.from(d, 'hex')), de.final()]).toString('utf8');
  }
  return '';
}

function send(res, code, obj, headers = {}) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', c => { s += c; if (s.length > 2e6) { req.destroy(); reject(new Error('Request boro')); } });
    req.on('end', () => {
      if (!s) return resolve({});
      try { resolve(JSON.parse(s)); } catch { reject(new Error('Bad JSON')); }
    });
    req.on('error', reject);
  });
}
function cookieOf(req, name) {
  const m = (req.headers.cookie || '').match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? m[1] : null;
}
function cookie(sid) {
  return `sid=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${COOKIE_SECURE ? '; Secure' : ''}`;
}
function newSession(userId) {
  const t = crypto.randomBytes(32).toString('hex');
  db.sessions[t] = { uid: userId, exp: Date.now() + SESSION_DAYS * 864e5 };
  return t;
}
function currentUser(req) {
  const t = cookieOf(req, 'sid');
  if (!t) return null;
  const s = db.sessions[t];
  if (!s || s.exp < Date.now()) return null;
  return db.users.find(u => u.id === s.uid) || null;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      if (url.pathname === '/api/me') {
        const u = currentUser(req);
        if (!u) return send(res, 401, { error: 'Unauthorized' });
        return send(res, 200, { user: { id: u.id, email: u.email, brand: u.brand } });
      }
      return send(res, 404, { error: 'API not found' });
    }
    
    let rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    let file = path.normalize(path.join(PUB, rel));
    if (!file.startsWith(PUB + path.sep)) return send(res, 403, { error: 'Forbidden' });
    
    fs.readFile(file, (err, data) => {
      if (err) {
        fs.readFile(path.join(PUB, 'index.html'), (err2, data2) => {
          if (err2) return send(res, 404, { error: 'Not found' });
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(data2);
        });
        return;
      }
      const ext = path.extname(file);
      const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
      res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
      res.end(data);
    });
  } catch (e) {
    send(res, 500, { error: 'Server error' });
  }
});

loadDb();
server.listen(PORT, '0.0.0.0', () => console.log(`BIMO running on port ${PORT}`));
