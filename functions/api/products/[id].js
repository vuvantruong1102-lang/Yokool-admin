// /api/products/:idOrSlug
//   GET    (public) — detail by id (numeric) or slug
//   PATCH  (admin)  — update product
//   DELETE (admin)  — delete product

import { json, error, clean, safeInt, parseJSON, slugify } from '../_utils.js';

async function findProduct(env, idOrSlug) {
  const isId = /^\d+$/.test(idOrSlug);
  return env.DB.prepare(
    isId
      ? `SELECT * FROM products WHERE id = ?1`
      : `SELECT * FROM products WHERE slug = ?1`
  ).bind(isId ? parseInt(idOrSlug, 10) : idOrSlug).first();
}

export async function onRequestGet({ params, env }) {
  const p = await findProduct(env, params.id);
  if (!p) return error('Không tìm thấy sản phẩm', 404, 'NOT_FOUND');
  return json({
    product: {
      ...p,
      image_gallery: parseJSON(p.image_gallery, []),
      in_stock: !!p.in_stock,
      published: !!p.published,
    },
  });
}

export async function onRequestPatch({ params, request, env }) {
  const existing = await findProduct(env, params.id);
  if (!existing) return error('Không tìm thấy sản phẩm', 404, 'NOT_FOUND');

  let body;
  try { body = await request.json(); } catch { return error('Invalid JSON', 400); }

  const updates = [];
  const binds = [];
  const set = (col, val) => {
    updates.push(`${col} = ?${binds.length + 1}`);
    binds.push(val);
  };

  if (body.code !== undefined)             set('code', clean(body.code, 20).toUpperCase());
  if (body.name !== undefined)             set('name', clean(body.name, 200));
  if (body.slug !== undefined)             set('slug', clean(body.slug, 100) || slugify(body.name || existing.name));
  if (body.price !== undefined)            set('price', safeInt(body.price, 0));
  if (body.price_old !== undefined)        set('price_old', body.price_old ? safeInt(body.price_old, 0) : null);
  if (body.description_short !== undefined) set('description_short', clean(body.description_short, 500) || null);
  if (body.description_long !== undefined)  set('description_long', clean(body.description_long, 5000) || null);
  if (body.image_main !== undefined)       set('image_main', clean(body.image_main, 500) || null);
  if (body.image_gallery !== undefined) {
    const arr = Array.isArray(body.image_gallery)
      ? body.image_gallery.map(s => clean(s, 500)).filter(Boolean).slice(0, 20) : [];
    set('image_gallery', JSON.stringify(arr));
  }
  if (body.category !== undefined)         set('category', clean(body.category, 50) || null);
  if (body.in_stock !== undefined)         set('in_stock', body.in_stock === false ? 0 : 1);
  if (body.stock_qty !== undefined)        set('stock_qty', safeInt(body.stock_qty, 0));
  if (body.sort_order !== undefined)       set('sort_order', safeInt(body.sort_order, 0));
  if (body.published !== undefined)        set('published', body.published === false ? 0 : 1);

  if (updates.length === 0) return error('Không có thay đổi', 400, 'NO_CHANGES');
  updates.push(`updated_at = datetime('now')`);

  try {
    await env.DB.prepare(
      `UPDATE products SET ${updates.join(', ')} WHERE id = ?${binds.length + 1}`
    ).bind(...binds, existing.id).run();
  } catch (e) {
    if (String(e.message || '').includes('UNIQUE')) {
      return error('Mã hoặc slug đã tồn tại ở sản phẩm khác', 400, 'UNIQUE_VIOLATION');
    }
    throw e;
  }

  const p = await env.DB.prepare(`SELECT * FROM products WHERE id = ?1`).bind(existing.id).first();
  return json({
    ok: true,
    product: { ...p, image_gallery: parseJSON(p.image_gallery, []), in_stock: !!p.in_stock, published: !!p.published },
  });
}

export async function onRequestDelete({ params, env }) {
  const p = await findProduct(env, params.id);
  if (!p) return error('Không tìm thấy sản phẩm', 404, 'NOT_FOUND');
  await env.DB.prepare(`DELETE FROM products WHERE id = ?1`).bind(p.id).run();
  return json({ ok: true });
}
