// /api/config
//   GET   (public) — returns all key-value pairs as an object
//   PATCH (admin)  — bulk update key-value pairs

import { json, error, clean } from './_utils.js';

// Whitelist of allowed config keys to prevent typos / injection
const ALLOWED_KEYS = [
  // Contact widget
  'hotline', 'hotline_label',
  'zalo_link', 'zalo_label',
  'messenger_link', 'messenger_label',
  // B2B contact
  'b2b_email', 'b2b_hotline', 'b2b_hotline_owner',
  'office_address', 'work_hours',
  // External channels
  'shopee_link',
  // Footer
  'footer_tagline', 'footer_about', 'footer_copyright', 'footer_version',
];

export async function onRequestGet({ env }) {
  const rows = await env.DB.prepare(
    `SELECT key, value FROM site_config`
  ).all();

  const config = {};
  for (const r of (rows.results || [])) {
    config[r.key] = r.value || '';
  }
  // Ensure all whitelisted keys exist (empty string if not yet set)
  for (const k of ALLOWED_KEYS) {
    if (!(k in config)) config[k] = '';
  }
  return json({ config });
}

export async function onRequestPatch({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return error('Invalid JSON', 400); }

  const updates = body.config && typeof body.config === 'object' ? body.config : body;
  if (!updates || typeof updates !== 'object') {
    return error('Thiếu config object', 400, 'BAD_INPUT');
  }

  let updated = 0;
  for (const [key, value] of Object.entries(updates)) {
    if (!ALLOWED_KEYS.includes(key)) continue;
    const v = clean(value, 1000);
    await env.DB.prepare(
      `INSERT INTO site_config (key, value, updated_at)
       VALUES (?1, ?2, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
    ).bind(key, v).run();
    updated++;
  }

  return json({ ok: true, updated });
}
