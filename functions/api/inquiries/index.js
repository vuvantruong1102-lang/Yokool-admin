// /api/inquiries
// - POST (public) : create from b2b.html form
// - GET  (admin)  : list with filter

import { json, error, clean, isEmail, isVNPhone, safeInt, nextInquiryId } from '../_utils.js';

const VALID_STATUSES = ['new', 'contacted', 'quoted', 'deal', 'lost'];

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return error('Invalid JSON', 400); }

  const company = clean(body.company, 200);
  const name    = clean(body.contact_name, 100);
  const position = clean(body.position, 100);
  const email   = clean(body.email, 200).toLowerCase();
  const phone   = clean(body.phone, 20).replace(/\s+/g, '');
  const products = Array.isArray(body.products) ? body.products.map(p => clean(p, 20)).filter(Boolean).slice(0, 20) : [];
  const quantity = clean(body.quantity, 50);
  const deadline = clean(body.deadline, 100);
  const purpose  = clean(body.purpose, 500);
  const note     = clean(body.customer_note, 1000);

  if (company.length < 2)  return error('Tên công ty không hợp lệ', 400, 'BAD_COMPANY');
  if (name.length < 2)     return error('Tên liên hệ không hợp lệ', 400, 'BAD_NAME');
  if (!isEmail(email))     return error('Email không hợp lệ', 400, 'BAD_EMAIL');
  if (!isVNPhone(phone))   return error('Số điện thoại không hợp lệ', 400, 'BAD_PHONE');
  if (!quantity)           return error('Vui lòng chọn số lượng', 400, 'BAD_QUANTITY');

  const id = await nextInquiryId(env.DB);

  await env.DB.prepare(
    `INSERT INTO b2b_inquiries
       (id, company, contact_name, position, email, phone, products,
        quantity, deadline, purpose, customer_note, status)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,'new')`
  ).bind(
    id, company, name, position || null, email, phone,
    JSON.stringify(products), quantity, deadline || null, purpose || null, note || null
  ).run();

  return json({ ok: true, inquiry_id: id }, 201);
}

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
    where.push(`(id LIKE ?${binds.length + 1} OR company LIKE ?${binds.length + 1} OR contact_name LIKE ?${binds.length + 1} OR phone LIKE ?${binds.length + 1})`);
    binds.push(`%${search}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const totalRow = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM b2b_inquiries ${whereSql}`
  ).bind(...binds).first();

  const rows = await env.DB.prepare(
    `SELECT id, company, contact_name, email, phone, quantity, status, created_at
     FROM b2b_inquiries ${whereSql}
     ORDER BY created_at DESC
     LIMIT ?${binds.length + 1} OFFSET ?${binds.length + 2}`
  ).bind(...binds, limit, offset).all();

  return json({
    inquiries: rows.results || [],
    page,
    limit,
    total: totalRow?.n ?? 0,
  });
}
