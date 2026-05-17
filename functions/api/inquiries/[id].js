// /api/inquiries/:id
// - GET   : full detail
// - PATCH : update status / internal_note / assigned_to

import { json, error, clean, safeInt } from '../_utils.js';

const VALID_STATUSES = ['new', 'contacted', 'quoted', 'deal', 'lost'];

export async function onRequestGet({ params, env }) {
  const id = clean(params.id, 50);
  if (!id) return error('Missing id', 400);

  const row = await env.DB.prepare(
    `SELECT i.*, u.name AS assigned_to_name
     FROM b2b_inquiries i
     LEFT JOIN admin_users u ON u.id = i.assigned_to
     WHERE i.id = ?1`
  ).bind(id).first();

  if (!row) return error('Không tìm thấy yêu cầu', 404, 'NOT_FOUND');

  // Parse products JSON
  let products = [];
  try { products = JSON.parse(row.products || '[]'); } catch { products = []; }

  return json({ inquiry: { ...row, products } });
}

export async function onRequestPatch({ params, request, env }) {
  const id = clean(params.id, 50);
  if (!id) return error('Missing id', 400);

  let body;
  try { body = await request.json(); } catch { return error('Invalid JSON', 400); }

  const updates = [];
  const binds = [];

  if (typeof body.status === 'string') {
    if (!VALID_STATUSES.includes(body.status)) {
      return error('Trạng thái không hợp lệ', 400, 'BAD_STATUS');
    }
    updates.push(`status = ?${binds.length + 1}`);
    binds.push(body.status);
  }

  if (typeof body.internal_note === 'string') {
    updates.push(`internal_note = ?${binds.length + 1}`);
    binds.push(clean(body.internal_note, 2000));
  }

  if (body.assigned_to !== undefined) {
    if (body.assigned_to === null) {
      updates.push(`assigned_to = NULL`);
    } else {
      const uid = safeInt(body.assigned_to, 0);
      if (uid > 0) {
        updates.push(`assigned_to = ?${binds.length + 1}`);
        binds.push(uid);
      }
    }
  }

  if (updates.length === 0) return error('Không có thay đổi', 400, 'NO_CHANGES');

  updates.push(`updated_at = datetime('now')`);

  const result = await env.DB.prepare(
    `UPDATE b2b_inquiries SET ${updates.join(', ')} WHERE id = ?${binds.length + 1}`
  ).bind(...binds, id).run();

  if (!result.success || result.meta.changes === 0) {
    return error('Cập nhật thất bại', 500, 'UPDATE_FAILED');
  }

  const row = await env.DB.prepare(`SELECT * FROM b2b_inquiries WHERE id = ?1`).bind(id).first();
  let products = [];
  try { products = JSON.parse(row.products || '[]'); } catch {}
  return json({ ok: true, inquiry: { ...row, products } });
}
