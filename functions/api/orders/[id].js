// /api/orders/:id
// - GET   : full order detail with items
// - PATCH : update status / internal_note

import { json, error, clean } from '../_utils.js';

const VALID_STATUSES = ['new', 'processing', 'shipping', 'delivered', 'cancelled'];

export async function onRequestGet({ params, env }) {
  const id = clean(params.id, 50);
  if (!id) return error('Missing id', 400);

  const order = await env.DB.prepare(
    `SELECT * FROM orders WHERE id = ?1`
  ).bind(id).first();
  if (!order) return error('Không tìm thấy đơn hàng', 404, 'NOT_FOUND');

  const items = await env.DB.prepare(
    `SELECT product_code, product_name, quantity, unit_price, subtotal
     FROM order_items WHERE order_id = ?1`
  ).bind(id).all();

  return json({ order, items: items.results || [] });
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

  if (typeof body.shipping_fee === 'number') {
    updates.push(`shipping_fee = ?${binds.length + 1}`);
    binds.push(Math.max(0, Math.floor(body.shipping_fee)));
    // Recompute total
    updates.push(`total = subtotal + ?${binds.length}`);
  }

  if (updates.length === 0) return error('Không có thay đổi', 400, 'NO_CHANGES');

  updates.push(`updated_at = datetime('now')`);

  const result = await env.DB.prepare(
    `UPDATE orders SET ${updates.join(', ')} WHERE id = ?${binds.length + 1}`
  ).bind(...binds, id).run();

  if (!result.success || result.meta.changes === 0) {
    return error('Cập nhật thất bại', 500, 'UPDATE_FAILED');
  }

  const order = await env.DB.prepare(`SELECT * FROM orders WHERE id = ?1`).bind(id).first();
  return json({ ok: true, order });
}
