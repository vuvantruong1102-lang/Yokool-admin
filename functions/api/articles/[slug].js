// /api/articles/:slug
//   GET    (public) — detail by slug
//   PATCH  (admin)  — update
//   DELETE (admin)  — delete

import { json, error, clean, slugify } from '../_utils.js';

async function findArticle(env, slug) {
  return env.DB.prepare(`SELECT * FROM articles WHERE slug = ?1`).bind(slug).first();
}

export async function onRequestGet({ params, env, request }) {
  const url = new URL(request.url);
  const includeAll = url.searchParams.get('all') === '1';

  const a = await findArticle(env, params.slug);
  if (!a) return error('Không tìm thấy bài viết', 404, 'NOT_FOUND');
  if (!includeAll && a.status !== 'published') {
    return error('Bài viết chưa xuất bản', 404, 'NOT_PUBLISHED');
  }
  return json({ article: a });
}

export async function onRequestPatch({ params, request, env }) {
  const existing = await findArticle(env, params.slug);
  if (!existing) return error('Không tìm thấy bài viết', 404, 'NOT_FOUND');

  let body;
  try { body = await request.json(); } catch { return error('Invalid JSON', 400); }

  const updates = [];
  const binds = [];
  const set = (col, val) => {
    updates.push(`${col} = ?${binds.length + 1}`);
    binds.push(val);
  };

  if (body.title !== undefined)      set('title', clean(body.title, 200));
  if (body.slug !== undefined)       set('slug', clean(body.slug, 100) || slugify(body.title || existing.title));
  if (body.excerpt !== undefined)    set('excerpt', clean(body.excerpt, 500) || null);
  if (body.thumbnail !== undefined)  set('thumbnail', clean(body.thumbnail, 500) || null);
  if (body.content_md !== undefined) set('content_md', clean(body.content_md, 50000));
  if (body.author !== undefined)     set('author', clean(body.author, 100) || null);

  if (body.status !== undefined) {
    const status = body.status === 'published' ? 'published' : 'draft';
    set('status', status);
    // Auto-set published_at when changing draft → published
    if (status === 'published' && existing.status !== 'published' && body.published_at === undefined) {
      set('published_at', new Date().toISOString().slice(0, 19).replace('T', ' '));
    }
    if (status === 'draft' && body.published_at === undefined) {
      set('published_at', null);
    }
  }
  if (body.published_at !== undefined) {
    set('published_at', body.published_at || null);
  }

  if (updates.length === 0) return error('Không có thay đổi', 400, 'NO_CHANGES');
  updates.push(`updated_at = datetime('now')`);

  try {
    await env.DB.prepare(
      `UPDATE articles SET ${updates.join(', ')} WHERE id = ?${binds.length + 1}`
    ).bind(...binds, existing.id).run();
  } catch (e) {
    if (String(e.message || '').includes('UNIQUE')) {
      return error('Slug đã tồn tại ở bài viết khác', 400, 'UNIQUE_VIOLATION');
    }
    throw e;
  }

  const a = await env.DB.prepare(`SELECT * FROM articles WHERE id = ?1`).bind(existing.id).first();
  return json({ ok: true, article: a });
}

export async function onRequestDelete({ params, env }) {
  const a = await findArticle(env, params.slug);
  if (!a) return error('Không tìm thấy bài viết', 404, 'NOT_FOUND');
  await env.DB.prepare(`DELETE FROM articles WHERE id = ?1`).bind(a.id).run();
  return json({ ok: true });
}
