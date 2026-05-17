// /api/banners
//   GET (public) — list all banner slots
//   PUT (admin)  — bulk update slots

import { json, error, clean } from './_utils.js';

const VALID_SLOTS = ['home_1', 'home_2', 'home_3', 'b2b_1', 'b2b_2', 'b2b_3'];

export async function onRequestGet({ env }) {
  const rows = await env.DB.prepare(
    `SELECT slot, image_url, eyebrow, title_line1, title_line2,
            tagline, cta_text, cta_link, enabled, updated_at
     FROM banners
     ORDER BY CASE slot
       WHEN 'home_1' THEN 1 WHEN 'home_2' THEN 2 WHEN 'home_3' THEN 3
       WHEN 'b2b_1' THEN 4 WHEN 'b2b_2' THEN 5 WHEN 'b2b_3' THEN 6
       ELSE 99 END`
  ).all();

  return json({
    banners: (rows.results || []).map(b => ({ ...b, enabled: !!b.enabled })),
  });
}

export async function onRequestPut({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return error('Invalid JSON', 400); }

  const banners = Array.isArray(body.banners) ? body.banners : null;
  if (!banners) return error('Thiếu mảng banners', 400, 'BAD_INPUT');

  for (const b of banners) {
    const slot = clean(b.slot, 20);
    if (!VALID_SLOTS.includes(slot)) {
      return error(`Slot không hợp lệ: ${slot}`, 400, 'BAD_SLOT');
    }
    const imageUrl   = clean(b.image_url, 500);
    const eyebrow    = clean(b.eyebrow, 100);
    const titleL1    = clean(b.title_line1, 100);
    const titleL2    = clean(b.title_line2, 100);
    const tagline    = clean(b.tagline, 500);
    const ctaText    = clean(b.cta_text, 100);
    const ctaLink    = clean(b.cta_link, 500);
    const enabled    = b.enabled === false ? 0 : 1;

    // Upsert (banners table has slot UNIQUE)
    await env.DB.prepare(
      `INSERT INTO banners (slot, image_url, eyebrow, title_line1, title_line2,
        tagline, cta_text, cta_link, enabled, updated_at)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9, datetime('now'))
       ON CONFLICT(slot) DO UPDATE SET
         image_url=excluded.image_url,
         eyebrow=excluded.eyebrow,
         title_line1=excluded.title_line1,
         title_line2=excluded.title_line2,
         tagline=excluded.tagline,
         cta_text=excluded.cta_text,
         cta_link=excluded.cta_link,
         enabled=excluded.enabled,
         updated_at=datetime('now')`
    ).bind(slot, imageUrl || null, eyebrow || null, titleL1 || null, titleL2 || null,
           tagline || null, ctaText || null, ctaLink || null, enabled).run();
  }

  return json({ ok: true, updated: banners.length });
}
