// /api/articles
//   GET  (public) — list articles
//   POST (admin)  — create article

import { json, error, clean, safeInt, slugify } from '../_utils.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const includeAll = url.searchParams.get('all') === '1';
  const page = Math.max(1, safeInt(url.searchParams.get('page'), 1));
  const limit = Math.min(50, Math.max(5, safeInt(url.searchParams.get('limit'), 20)));
  const offset = (page - 1) * limit;

  const where = [];
  const binds = [];
  if (!includeAll) {
    where.push(`status = 'published'`);
  } else if (status === 'draft' || status === 'published') {
    where.push(`status = ?${binds.length + 1}`);
    binds.push(status);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const totalRow = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM articles ${whereSql}`
  ).bind(...binds).first();

  const rows = await env.DB.prepare(
    `SELECT id, slug, title, excerpt, thumbnail, author, status, published_at, created_at, updated_at
     FROM articles ${whereSql}
     ORDER BY COALESCE(published_at, created_at) DESC
     LIMIT ?${binds.length + 1} OFFSET ?${binds.length + 2}`
  ).bind(...binds, limit, offset).all();

  return json({
    articles: rows.results || [],
    total: totalRow?.n ?? 0,
    page, limit,
  });
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return error('Invalid JSON', 400); }

  const title = clean(body.title, 200);
  let slug = clean(body.slug || '', 100) || slugify(title);
  const excerpt = clean(body.excerpt, 500);
  const thumbnail = clean(body.thumbnail, 500);
  const contentMd = clean(body.content_md, 50000);
  const author = clean(body.author, 100);
  const status = body.status === 'published' ? 'published' : 'draft';
  const publishedAt = status === 'published'
    ? (body.published_at || new Date().toISOString().slice(0, 19).replace('T', ' '))
    : null;

  if (!title) return error('Tiêu đề bắt buộc', 400, 'BAD_TITLE');
  if (!contentMd) return error('Nội dung bắt buộc', 400, 'BAD_CONTENT');

  let trySlug = slug;
  let counter = 1;
  while (true) {
    const exists = await env.DB.prepare(`SELECT id FROM articles WHERE slug = ?1`).bind(trySlug).first();
    if (!exists) { slug = trySlug; break; }
    trySlug = slug + '-' + (++counter);
    if (counter > 50) return error('Slug conflict', 400);
  }

  const result = await env.DB.prepare(
    `INSERT INTO articles (slug, title, excerpt, thumbnail, content_md, author, status, published_at)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8)`
  ).bind(slug, title, excerpt || null, thumbnail || null, contentMd, author || null, status, publishedAt).run();

  return json({ ok: true, id: result.meta.last_row_id, slug }, 201);
}
