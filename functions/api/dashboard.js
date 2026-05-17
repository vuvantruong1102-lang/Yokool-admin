// GET /api/dashboard
// Returns: { stats: {...}, recent_orders, recent_inquiries }

import { json } from './_utils.js';

export async function onRequestGet({ env }) {
  // Single batch of small queries — D1 free tier handles this easily
  const [statsRows, recentOrders, recentInquiries] = await Promise.all([
    env.DB.prepare(`
      SELECT
        (SELECT COUNT(*) FROM orders
          WHERE date(created_at) = date('now') AND status != 'cancelled') AS orders_today,
        (SELECT COUNT(*) FROM orders
          WHERE status IN ('new','processing','shipping')) AS orders_open,
        (SELECT COUNT(*) FROM orders
          WHERE status = 'new') AS orders_new,
        (SELECT COALESCE(SUM(total),0) FROM orders
          WHERE status != 'cancelled'
            AND created_at >= datetime('now','-7 days')) AS revenue_week,
        (SELECT COALESCE(SUM(total),0) FROM orders
          WHERE status = 'delivered'
            AND created_at >= datetime('now','-30 days')) AS revenue_month_delivered,
        (SELECT COUNT(*) FROM b2b_inquiries
          WHERE status = 'new') AS b2b_new,
        (SELECT COUNT(*) FROM b2b_inquiries
          WHERE status IN ('new','contacted','quoted')) AS b2b_open
    `).first(),

    env.DB.prepare(`
      SELECT id, customer_name, total, status, created_at
      FROM orders
      ORDER BY created_at DESC
      LIMIT 5
    `).all(),

    env.DB.prepare(`
      SELECT id, company, contact_name, quantity, status, created_at
      FROM b2b_inquiries
      ORDER BY created_at DESC
      LIMIT 5
    `).all(),
  ]);

  return json({
    stats: {
      orders_today: statsRows?.orders_today ?? 0,
      orders_open: statsRows?.orders_open ?? 0,
      orders_new: statsRows?.orders_new ?? 0,
      revenue_week: statsRows?.revenue_week ?? 0,
      revenue_month_delivered: statsRows?.revenue_month_delivered ?? 0,
      b2b_new: statsRows?.b2b_new ?? 0,
      b2b_open: statsRows?.b2b_open ?? 0,
    },
    recent_orders: recentOrders.results || [],
    recent_inquiries: recentInquiries.results || [],
  });
}
