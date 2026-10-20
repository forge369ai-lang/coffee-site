// Admin CRM API for jaysteenkamp.com/admin.
// Data lives in Supabase. The service key and admin password are Vercel environment
// variables and never reach the browser. The browser only gets a signed, HttpOnly cookie.
const crypto = require('crypto');

const URL_ = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_KEY || '';
const PASS = process.env.ADMIN_PASSWORD || '';
const COOKIE = 'jsa';
const DAYS = 30;

const FIELDS = ['business', 'type', 'contact', 'email', 'phone', 'town', 'rating', 'reviews', 'website', 'channel',
  'subject', 'status', 'first_contact', 'last_contact', 'next_action', 'follow_ups', 'reply_date', 'deal_value',
  'link', 'batch', 'notes', 'log'];

const secret = () => crypto.createHash('sha256').update(PASS + ':' + KEY).digest();
const sign = v => crypto.createHmac('sha256', secret()).update(v).digest('base64url');
const sha = v => crypto.createHash('sha256').update(String(v)).digest();

function token() {
  const exp = String(Date.now() + DAYS * 864e5);
  return exp + '.' + sign(exp);
}
function authed(req) {
  const raw = (req.headers.cookie || '').split(/;\s*/).find(c => c.startsWith(COOKIE + '='));
  if (!raw) return false;
  const [exp, sig] = raw.slice(COOKIE.length + 1).split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const good = sign(exp);
  return sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good));
}
function setCookie(res, value, maxAge) {
  res.setHeader('Set-Cookie', `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`);
}

// Simple brake on password guessing (per server instance).
const fails = new Map();
function ipOf(req) { return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x'; }
function tooMany(ip) {
  const f = fails.get(ip);
  return f && f.n >= 8 && Date.now() - f.t < 15 * 60e3;
}

function clean(obj) {
  const out = {};
  for (const k of FIELDS) {
    if (!(k in obj)) continue;
    let v = obj[k];
    if (v === '' || v === undefined) v = null;
    if (['rating', 'deal_value'].includes(k) && v !== null) { v = Number(v); if (!isFinite(v)) v = null; }
    if (['reviews', 'follow_ups'].includes(k) && v !== null) { v = parseInt(v, 10); if (!isFinite(v)) v = k === 'follow_ups' ? 0 : null; }
    if (['first_contact', 'last_contact', 'next_action', 'reply_date'].includes(k) && v !== null && !/^\d{4}-\d{2}-\d{2}/.test(String(v))) v = null;
    if (k === 'log' && !Array.isArray(v)) v = [];
    if (typeof v === 'string') v = v.slice(0, k === 'notes' || k === 'link' ? 8000 : 500);
    out[k] = v;
  }
  if (out.follow_ups === null) out.follow_ups = 0;
  return out;
}

async function sb(path, opts = {}) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(opts.headers || {}) }
  });
  const text = await r.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) { const e = new Error((data && data.message) || 'Database error'); e.status = r.status; throw e; }
  return data;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  if (!URL_ || !KEY || !PASS) return res.status(500).json({ error: 'setup', message: 'CRM is not connected yet. Add SUPABASE_URL, SUPABASE_SERVICE_KEY and ADMIN_PASSWORD in Vercel.' });

  const a = String((req.query && req.query.a) || '');
  const body = typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body); } catch { return {}; } })() : (req.body || {});

  // Mutating requests must carry this header; browsers can't add it cross-site without a preflight.
  if (req.method !== 'GET' && req.headers['x-crm'] !== '1') return res.status(403).json({ error: 'forbidden' });

  try {
    if (a === 'login' && req.method === 'POST') {
      const ip = ipOf(req);
      if (tooMany(ip)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
      await new Promise(r => setTimeout(r, 400));
      const ok = crypto.timingSafeEqual(sha(body.password || ''), sha(PASS));
      if (!ok) {
        const f = fails.get(ip) || { n: 0, t: Date.now() };
        fails.set(ip, { n: f.n + 1, t: Date.now() });
        return res.status(401).json({ error: 'Wrong password' });
      }
      fails.delete(ip);
      setCookie(res, token(), DAYS * 86400);
      return res.status(200).json({ ok: true });
    }
    if (a === 'logout') { setCookie(res, '', 0); return res.status(200).json({ ok: true }); }

    if (!authed(req)) return res.status(401).json({ error: 'auth' });

    if (a === 'me') return res.status(200).json({ ok: true });

    if (a === 'leads' && req.method === 'GET') {
      const rows = await sb('leads?select=*&order=next_action.asc.nullslast,updated_at.desc&limit=5000');
      return res.status(200).json({ leads: rows });
    }
    if (a === 'create' && req.method === 'POST') {
      const list = Array.isArray(body.leads) ? body.leads : [body.lead || body];
      const rows = list.map(clean).filter(r => r.business);
      if (!rows.length) return res.status(400).json({ error: 'Business name is required' });
      if (rows.length > 1000) return res.status(400).json({ error: 'Import up to 1000 at a time' });
      const out = await sb('leads', { method: 'POST', body: JSON.stringify(rows) });
      return res.status(200).json({ leads: out });
    }
    const id = String((req.query && req.query.id) || '');
    if (!/^[0-9a-f-]{36}$/i.test(id) && (a === 'update' || a === 'delete')) return res.status(400).json({ error: 'Bad id' });
    if (a === 'update' && (req.method === 'PATCH' || req.method === 'POST')) {
      const patch = clean(body);
      if ('business' in patch && !patch.business) return res.status(400).json({ error: 'Business name is required' });
      const out = await sb(`leads?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      return res.status(200).json({ lead: out && out[0] });
    }
    if (a === 'delete' && (req.method === 'DELETE' || req.method === 'POST')) {
      await sb(`leads?id=eq.${id}`, { method: 'DELETE' });
      return res.status(200).json({ ok: true });
    }
    return res.status(404).json({ error: 'Unknown action' });
  } catch (e) {
    return res.status(e.status && e.status < 500 ? 400 : 500).json({ error: e.message || 'Server error' });
  }
};
