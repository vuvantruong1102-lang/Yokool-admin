// /api/orders
// - POST (public) : create order from yokool.vn checkout form
// - GET  (admin)  : list orders with filters, pagination

import { json, error, clean, isEmail, isVNPhone, safeInt, nextOrderId } from '../_utils.js';

const VALID_STATUSES = ['new', 'processing', 'shipping', 'delivered', 'cancelled'];

// ---------- POST ----------
export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return error('Invalid JSON', 400); }

  // Validate customer
  const name    = clean(body.customer_name, 100);
  const phone   = clean(body.customer_phone, 20).replace(/\s+/g, '');
  const email   = clean(body.customer_email, 200).toLowerCase();
  const address = clean(body.shipping_address, 300);
  const ward    = clean(body.shipping_ward, 100);
  const district = clean(body.shipping_district, 100);
  const province = clean(body.shipping_province, 100);
  const note    = clean(body.customer_note, 500);
  const payment = clean(body.payment_method, 20) || 'COD';

  if (name.length < 2)      return error('Họ tên không hợp lệ', 400, 'BAD_NAME');
  if (!isVNPhone(phone))    return error('Số điện thoại không hợp lệ', 400, 'BAD_PHONE');
  if (email && !isEmail(email)) return error('Email không hợp lệ', 400, 'BAD_EMAIL');
  if (address.length < 5)   return error('Địa chỉ giao hàng quá ngắn', 400, 'BAD_ADDRESS');
  if (province.length < 2)  return error('Vui lòng chọn tỉnh/thành', 400, 'BAD_PROVINCE');

  // Validate items
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0)   return error('Giỏ hàng trống', 400, 'EMPTY_CART');
  if (items.length > 20)    return error('Quá nhiều sản phẩm', 400, 'TOO_MANY_ITEMS');

  let subtotal = 0;
  const cleanItems = [];
  for (const it of items) {
    const code = clean(it.product_code, 20);
    const itemName = clean(it.product_name, 200);
    const qty = safeInt(it.quantity, 0);
    const price = safeInt(it.unit_price, 0);
    if (!code || !itemName || qty < 1 || qty > 999 || price <= 0) {
      return error('Sản phẩm không hợp lệ', 400, 'BAD_ITEM');
    }
    const itSubtotal = qty * price;
    subtotal += itSubtotal;
    cleanItems.push({ code, name: itemName, qty, price, subtotal: itSubtotal });
  }

  const shippingFee = safeInt(body.shipping_fee, 0);
  const total = subtotal + shippingFee;

  // Generate ID and insert
  const id = await nextOrderId(env.DB);

  // Insert order and items in a batch (D1 supports batch for atomicity)
  const stmts = [
    env.DB.prepare(
      `INSERT INTO orders (id, customer_name, customer_phone, customer_email,
        shipping_address, shipping_ward, shipping_district, shipping_province,
        customer_note, subtotal, shipping_fee, total, payment_method, status)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,'new')`
    ).bind(id, name, phone, email || null, address, ward || null, district || null,
           province, note || null, subtotal, shippingFee, total, payment),
  ];
  for (const it of cleanItems) {
    stmts.push(env.DB.prepare(
      `INSERT INTO order_items (order_id, product_code, product_name, quantity, unit_price, subtotal)
       VALUES (?1,?2,?3,?4,?5,?6)`
    ).bind(id, it.code, it.name, it.qty, it.price, it.subtotal));
  }
  await env.DB.batch(stmts);

  return json({ ok: true, order_id: id, total }, 201);
}

// ---------- GET (admin) ----------
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const search = clean(url.searchParams.get('search') || '', 100);
  const page = Math.max(1, safeInt(url.searchParams.get('page'), 1));
  const limit = Math.min(50, Math.max(10, safeInt(url.searchParams.get('limit'), 20)));
  const offset = (page - 1) * limit;

  const where = [];
  const binds = [];

  if (status && VALID_STATUSES.includes(status)) {
    where.push(`status = ?${binds.length + 1}`);
    binds.push(status);
  }
  if (search) {
    where.push(`(id LIKE ?${binds.length + 1} OR customer_name LIKE ?${binds.length + 1} OR customer_phone LIKE ?${binds.length + 1})`);
    binds.push(`%${search}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const totalRow = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM orders ${whereSql}`
  ).bind(...binds).first();

  const rows = await env.DB.prepare(
    `SELECT id, customer_name, customer_phone, shipping_province,
            total, status, payment_method, created_at
     FROM orders ${whereSql}
     ORDER BY created_at DESC
     LIMIT ?${binds.length + 1} OFFSET ?${binds.length + 2}`
  ).bind(...binds, limit, offset).all();

  return json({
    orders: rows.results || [],
    page,
    limit,
    total: totalRow?.n ?? 0,
  });
}
