// POST /api/auth/setup            — create first admin (only when no admin exists)
// GET  /api/auth/setup-status     — { needsSetup: boolean }

import { json, error, randomHex, hashPassword, isEmail, clean, buildSessionCookie } from '../_utils.js';

export async function onRequestGet({ env }) {
  const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM admin_users`).first();
  return json({ needsSetup: (row?.n ?? 0) === 0 });
}

export async function onRequestPost({ request, env }) {
  // Block if admins already exist
  const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM admin_users`).first();
  if ((row?.n ?? 0) > 0) {
    return error('Setup already completed', 403, 'SETUP_DONE');
  }

  let body;
  try { body = await request.json(); } catch { return error('Invalid JSON', 400); }

  const email = clean(body.email, 200).toLowerCase();
  const name  = clean(body.name,  100);
  const password = typeof body.password === 'string' ? body.password : '';

  if (!isEmail(email))      return error('Email không hợp lệ', 400, 'BAD_EMAIL');
  if (name.length < 2)      return error('Tên quá ngắn',       400, 'BAD_NAME');
  if (password.length < 8)  return error('Mật khẩu tối thiểu 8 ký tự', 400, 'BAD_PASSWORD');

  const salt = randomHex(16);
  const hash = await hashPassword(password, salt);

  const result = await env.DB.prepare(
    `INSERT INTO admin_users (email, name, password_hash, password_salt, role)
     VALUES (?1, ?2, ?3, ?4, 'admin')`
  ).bind(email, name, hash, salt).run();

  const userId = result.meta.last_row_id;

  // Auto-login after setup
  const token = randomHex(32);
  const sevenDays = 7 * 24 * 60 * 60;
  const expiresAt = new Date(Date.now() + sevenDays * 1000).toISOString().replace('T', ' ').slice(0, 19);

  await env.DB.prepare(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES (?1, ?2, ?3)`
  ).bind(token, userId, expiresAt).run();

  return json(
    { ok: true, user: { id: userId, email, name, role: 'admin' } },
    200,
    { 'set-cookie': buildSessionCookie(token, sevenDays) }
  );
}
