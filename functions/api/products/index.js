// /api/products
//   GET  (public) — list all published products, optionally by category
//   POST (admin)  — create new product

import { json, error, clean, safeInt, slugify, parseJSON } from '../_utils.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const category = clean(url.searchParams.get('category') || '', 50);
  const includeUnpublished = url.searchParams.get('all') === '1';

  const where = [];
  const binds = [];
  if (!includeUnpublished) {
    where.push(`published = 1`);
  }
  if (category) {
    where.push(`category = ?${binds.length + 1}`);
    binds.push(category);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await env.DB.prepare(
    `SELECT id, code, name, slug, price, price_old,
            description_short, description_long,
            image_main, image_gallery, category,
            in_stock, stock_qty, sort_order, published,
            created_at, updated_at
     FROM products ${whereSql}
     ORDER BY sort_order ASC, id ASC`
  ).bind(...binds).all();

  const products = (rows.results || []).map(p => ({
    ...p,
    image_gallery: parseJSON(p.image_gallery, []),
    in_stock: !!p.in_stock,
    published: !!p.published,
  }));

  return json({ products });
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return error('Invalid JSON', 400); }

  const code = clean(body.code, 20).toUpperCase();
  const name = clean(body.name, 200);
  let slug = clean(body.slug || '', 100) || slugify(name);
  const price = safeInt(body.price, 0);
  const priceOld = body.price_old ? safeInt(body.price_old, 0) : null;
  const descShort = clean(body.description_short, 500);
  const descLong = clean(body.description_long, 5000);
  const imageMain = clean(body.image_main, 500);
  const imageGallery = Array.isArray(body.image_gallery)
    ? body.image_gallery.map(s => clean(s, 500)).filter(Boolean).slice(0, 20)
    : [];
  const category = clean(body.category, 50);
  const inStock = body.in_stock === false ? 0 : 1;
  const stockQty = safeInt(body.stock_qty, 0);
  const sortOrder = safeInt(body.sort_order, 99);
  const published = body.published === false ? 0 : 1;

  if (!code) return error('Mã sản phẩm bắt buộc', 400, 'BAD_CODE');
  if (!name) return error('Tên sản phẩm bắt buộc', 400, 'BAD_NAME');
  if (price <= 0) return error('Giá không hợp lệ', 400, 'BAD_PRICE');

  // Auto-resolve slug conflicts
  let trySlug = slug;
  let counter = 1;
  while (true) {
    const exists = await env.DB.prepare(`SELECT id FROM products WHERE slug = ?1`).bind(trySlug).first();
    if (!exists) { slug = trySlug; break; }
    trySlug = slug + '-' + (++counter);
    if (counter > 50) return error('Slug conflict', 400);
  }

  try {
    const result = await env.DB.prepare(
      `INSERT INTO products (code, name, slug, price, price_old,
        description_short, description_long, image_main, image_gallery,
        category, in_stock, stock_qty, sort_order, published)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)`
    ).bind(code, name, slug, price, priceOld,
           descShort || null, descLong || null,
           imageMain || null, JSON.stringify(imageGallery),
           category || null, inStock, stockQty, sortOrder, published).run();

    const id = result.meta.last_row_id;
    return json({ ok: true, id, slug }, 201);
  } catch (e) {
    if (String(e.message || '').includes('UNIQUE')) {
      return error('Mã sản phẩm đã tồn tại', 400, 'CODE_EXISTS');
    }
    throw e;
  }
}
