// POST /api/auth/login
// Body: { email, password }
// Returns: { user } + Set-Cookie: admin_session

import { json, error, randomHex, verifyPassword, isEmail, clean, buildSessionCookie } from '../_utils.js';

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return error('Invalid JSON', 400); }

  const email = clean(body.email, 200).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';

  if (!isEmail(email) || !password) {
    return error('Email hoặc mật khẩu không hợp lệ', 400, 'BAD_CREDENTIALS');
  }

  const user = await env.DB.prepare(
    `SELECT id, email, name, role, password_hash, password_salt
     FROM admin_users WHERE email = ?1`
  ).bind(email).first();

  // Constant-time-ish: always verify against something
  const valid = user
    ? await verifyPassword(password, user.password_salt, user.password_hash)
    : await verifyPassword(password, 'dummy', 'dummy');

  if (!user || !valid) {
    return error('Email hoặc mật khẩu không đúng', 401, 'BAD_CREDENTIALS');
  }

  // Create session
  const token = randomHex(32);
  const sevenDays = 7 * 24 * 60 * 60;
  const expiresAt = new Date(Date.now() + sevenDays * 1000)
    .toISOString().replace('T', ' ').slice(0, 19);

  await env.DB.prepare(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES (?1, ?2, ?3)`
  ).bind(token, user.id, expiresAt).run();

  await env.DB.prepare(
    `UPDATE admin_users SET last_login_at = datetime('now') WHERE id = ?1`
  ).bind(user.id).run();

  // Cleanup expired sessions opportunistically (no extra cost when none)
  await env.DB.prepare(
    `DELETE FROM sessions WHERE expires_at <= datetime('now')`
  ).run();

  return json(
    { ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } },
    200,
    { 'set-cookie': buildSessionCookie(token, sevenDays) }
  );
}
