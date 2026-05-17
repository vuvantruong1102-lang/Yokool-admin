// POST /api/auth/logout

import { json, getCookie, clearSessionCookie } from '../_utils.js';

export async function onRequestPost({ request, env }) {
  const token = getCookie(request, 'admin_session');
  if (token) {
    await env.DB.prepare(`DELETE FROM sessions WHERE token = ?1`).bind(token).run();
  }
  return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie() });
}
