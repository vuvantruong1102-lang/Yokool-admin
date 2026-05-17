// GET /api/orders/export?status=...&from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns CSV file for shippers

import { clean } from '../_utils.js';

const VALID_STATUSES = ['new', 'processing', 'shipping', 'delivered', 'cancelled'];

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const from = clean(url.searchParams.get('from') || '', 20);
  const to   = clean(url.searchParams.get('to')   || '', 20);

  const where = [];
  const binds = [];

  if (status && VALID_STATUSES.includes(status)) {
    where.push(`o.status = ?${binds.length + 1}`);
    binds.push(status);
  }
  if (from) {
    where.push(`o.created_at >= ?${binds.length + 1}`);
    binds.push(from);
  }
  if (to) {
    where.push(`o.created_at <= ?${binds.length + 1}`);
    binds.push(to + ' 23:59:59');
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await env.DB.prepare(
    `SELECT o.id, o.customer_name, o.customer_phone, o.customer_email,
            o.shipping_address, o.shipping_ward, o.shipping_district, o.shipping_province,
            o.subtotal, o.shipping_fee, o.total, o.payment_method, o.status,
            o.customer_note, o.internal_note, o.created_at,
            GROUP_CONCAT(oi.product_code || ' x' || oi.quantity, ' + ') AS items
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     ${whereSql}
     GROUP BY o.id
     ORDER BY o.created_at DESC`
  ).bind(...binds).all();

  const headers = [
    'Mã đơn', 'Khách hàng', 'SĐT', 'Email',
    'Địa chỉ', 'Phường/Xã', 'Quận/Huyện', 'Tỉnh/Thành',
    'Sản phẩm', 'Tạm tính', 'Phí ship', 'Tổng', 'Thanh toán',
    'Trạng thái', 'Ghi chú khách', 'Ghi chú nội bộ', 'Ngày tạo',
  ];

  const lines = [headers.map(csvEscape).join(',')];
  for (const r of (rows.results || [])) {
    lines.push([
      r.id, r.customer_name, r.customer_phone, r.customer_email,
      r.shipping_address, r.shipping_ward, r.shipping_district, r.shipping_province,
      r.items, r.subtotal, r.shipping_fee, r.total, r.payment_method,
      r.status, r.customer_note, r.internal_note, r.created_at,
    ].map(csvEscape).join(','));
  }

  // Prepend UTF-8 BOM so Excel reads Vietnamese correctly
  const csv = '\uFEFF' + lines.join('\n');

  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="yokool-orders-${date}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
