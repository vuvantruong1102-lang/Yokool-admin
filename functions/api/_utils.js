// ============================================================
// Shared helpers used by every Pages Function
// ============================================================

/* ---------- Response builders ---------- */

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  });
}

export function error(message, status = 400, code) {
  return json({ error: message, code }, status);
}

/* ---------- CORS ---------- */

// Origins allowed to call /api/orders and /api/inquiries publicly.
// Add any custom domain you set up later.
const ALLOWED_ORIGINS = new Set([
  'https://yokool.vn',
  'https://www.yokool.vn',
  'https://yokool.tech',
  'https://www.yokool.tech',
  'https://yokool-web.pages.dev',
  'http://localhost:8788',
  'http://localhost:5173',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
]);

export function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : '';
  return {
    'access-control-allow-origin': allow,
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'vary': 'Origin',
  };
}

/* ---------- Cookies ---------- */

export function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

export function buildSessionCookie(token, maxAgeSec) {
  // HttpOnly + SameSite=Lax + Secure when on https
  return `admin_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${maxAgeSec}`;
}

export function clearSessionCookie() {
  return 'admin_session=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0';
}

/* ---------- Random + hashing (Web Crypto API) ---------- */

function bufToHex(buf) {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function randomHex(bytes = 32) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return bufToHex(arr.buffer);
}

export async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
    key, 256
  );
  return bufToHex(bits);
}

export async function verifyPassword(password, salt, expectedHash) {
  const actual = await hashPassword(password, salt);
  // Timing-safe comparison
  if (actual.length !== expectedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) {
    diff |= actual.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }
  return diff === 0;
}

/* ---------- ID generators ---------- */

function todayCompact() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

export async function nextOrderId(db) {
  const prefix = `ORD-${todayCompact()}`;
  // Find max seq for today
  const row = await db.prepare(
    `SELECT id FROM orders WHERE id LIKE ?1 ORDER BY id DESC LIMIT 1`
  ).bind(`${prefix}-%`).first();
  let seq = 1;
  if (row && row.id) {
    const last = parseInt(row.id.split('-').pop(), 10);
    if (!isNaN(last)) seq = last + 1;
  }
  return `${prefix}-${String(seq).padStart(3, '0')}`;
}

export async function nextInquiryId(db) {
  const prefix = `INQ-${todayCompact()}`;
  const row = await db.prepare(
    `SELECT id FROM b2b_inquiries WHERE id LIKE ?1 ORDER BY id DESC LIMIT 1`
  ).bind(`${prefix}-%`).first();
  let seq = 1;
  if (row && row.id) {
    const last = parseInt(row.id.split('-').pop(), 10);
    if (!isNaN(last)) seq = last + 1;
  }
  return `${prefix}-${String(seq).padStart(3, '0')}`;
}

/* ---------- Validation helpers ---------- */

export function isEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export function isVNPhone(s) {
  return typeof s === 'string' && /^0\d{9,10}$/.test(s.replace(/\s+/g, ''));
}

export function clean(s, max = 500) {
  if (typeof s !== 'string') return '';
  return s.trim().slice(0, max);
}

export function safeInt(v, fallback = 0) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}
