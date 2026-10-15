// Reads a public business website and reports simple online-presence signals.
// Used by /scan on jaysteenkamp.vercel.app. Speed scores come from Google PageSpeed in the browser.
const dns = require('dns').promises;
const net = require('net');

function isPrivate(ip) {
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    if (l.startsWith('::ffff:')) return isPrivate(l.slice(7));
    return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80');
  }
  const p = ip.split('.').map(Number);
  return p[0] === 10 || p[0] === 127 || p[0] === 0 || (p[0] === 169 && p[1] === 254) ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) ||
    (p[0] === 100 && p[1] >= 64 && p[1] <= 127) || p[0] >= 224;
}

async function safeUrl(raw) {
  let u;
  try { u = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw); } catch { return null; }
  if (!['http:', 'https:'].includes(u.protocol)) return null;
  if (u.port && !['80', '443'].includes(u.port)) return null;
  const host = u.hostname;
  if (!host.includes('.') || host.endsWith('.local') || host.endsWith('.internal')) return null;
  try {
    const addrs = await dns.lookup(host, { all: true });
    if (!addrs.length || addrs.some(a => isPrivate(a.address))) return null;
  } catch { return 'nodns'; }
  return u;
}

async function getPage(u) {
  // Follow up to 5 redirects by hand so every hop is checked.
  let cur = u;
  for (let i = 0; i < 6; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 7000);
    let r;
    try {
      r = await fetch(cur, { redirect: 'manual', signal: ctrl.signal, headers: { 'user-agent': 'Mozilla/5.0 (compatible; JayScan/1.0)', accept: 'text/html' } });
    } finally { clearTimeout(t); }
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
      const next = await safeUrl(new URL(r.headers.get('location'), cur).toString());
      if (!next || next === 'nodns') throw new Error('bad redirect');
      cur = next; continue;
    }
    const reader = r.body.getReader(); let size = 0; const chunks = [];
    while (size < 1500000) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); size += value.length; }
    try { reader.cancel(); } catch {}
    return { status: r.status, finalUrl: cur.toString(), html: Buffer.concat(chunks.map(c => Buffer.from(c))).toString('utf8') };
  }
  throw new Error('too many redirects');
}

module.exports = async (req, res) => {
  res.setHeader('cache-control', 's-maxage=3600');
  const raw = String((req.query && req.query.url) || '').trim().slice(0, 300);
  if (!raw) return res.status(400).json({ ok: false, error: 'missing url' });
  const u = await safeUrl(raw);
  if (u === 'nodns') return res.status(200).json({ ok: false, error: 'not found' });
  if (!u) return res.status(400).json({ ok: false, error: 'invalid url' });
  let page;
  try { page = await getPage(u); } catch (e) {
    // try plain http if https failed
    if (u.protocol === 'https:') {
      try { const h = new URL(u); h.protocol = 'http:'; page = await getPage(h); } catch {}
    }
    if (!page) return res.status(200).json({ ok: false, error: 'unreachable' });
  }
  const h = page.html;
  const low = h.toLowerCase();
  const meta = name => { const m = h.match(new RegExp('<meta[^>]+(?:name|property)=["\']' + name + '["\'][^>]*>', 'i')); if (!m) return ''; const c = m[0].match(/content=["']([^"']*)["']/i); return c ? c[1].trim() : ''; };
  const title = ((h.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || '').trim();
  const words = h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/gi, ' ').split(/\s+/).filter(Boolean).length;
  res.status(200).json({
    ok: page.status < 400,
    status: page.status,
    finalUrl: page.finalUrl,
    https: page.finalUrl.startsWith('https://'),
    title: title.slice(0, 120),
    description: meta('description').slice(0, 200),
    viewport: /<meta[^>]+name=["']viewport["']/i.test(h),
    ogImage: !!meta('og:image'),
    phoneLink: /href=["']tel:/i.test(h),
    whatsapp: /wa\.me\/|api\.whatsapp\.com|whatsapp:\/\//i.test(low),
    email: /href=["']mailto:/i.test(h),
    facebook: /facebook\.com\/(?!sharer|plugins|tr\b|dialog)/i.test(low),
    instagram: /instagram\.com\/(?!p\/)/i.test(low),
    maps: /google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps/i.test(low),
    schema: /"@type"\s*:\s*"(localbusiness|organization|restaurant|store|[a-z]*business)/i.test(low),
    form: /<form[\s>]/i.test(h),
    words
  });
};
