// ============================================================
// API middleware — runs for every /api/* request
// - Handles CORS preflight (OPTIONS)
// - Whitelists public endpoints (login, setup, public POST)
// - Validates session cookie for everything else
// ============================================================

import { json, error, corsHeaders, getCookie } from './_utils.js';

const PUBLIC_ROUTES = [
  // Auth bootstrap
  { path: '/api/auth/login', method: 'POST' },
  { path: '/api/auth/setup', method: 'POST' },
  { path: '/api/auth/setup', method: 'GET'  },
  // Public submission endpoints (called from yokool.vn checkout / b2b forms)
  { path: '/api/orders',     method: 'POST' },
  { path: '/api/inquiries',  method: 'POST' },
];

// Public path PREFIXES — anything matching these on GET requires no auth
const PUBLIC_GET_PREFIXES = [
  '/api/products',   // list + detail by id/slug
  '/api/articles',   // list + detail by slug
  '/api/banners',    // banner list
  '/api/config',     // site config
];

export async function onRequest(context) {
  const { request, env, next, data } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  const cors = corsHeaders(request);

  // CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  // Public endpoints bypass auth check
  const isPublic = PUBLIC_ROUTES.some(r => r.path === path && r.method === method)
    || (method === 'GET' && PUBLIC_GET_PREFIXES.some(p => path === p || path.startsWith(p + '/')));

  if (!isPublic) {
    const token = getCookie(request, 'admin_session');
    if (!token) {
      return withCors(error('Unauthorized', 401, 'NO_SESSION'), cors);
    }

    if (!env.DB) {
      return withCors(error('Database not configured. Bind D1 as "DB" in Pages settings.', 500, 'NO_DB'), cors);
    }

    const session = await env.DB.prepare(
      `SELECT s.user_id, s.expires_at, u.email, u.name, u.role
       FROM sessions s
       JOIN admin_users u ON s.user_id = u.id
       WHERE s.token = ?1 AND s.expires_at > datetime('now')`
    ).bind(token).first();

    if (!session) {
      return withCors(error('Session expired', 401, 'SESSION_EXPIRED'), cors);
    }

    data.user = {
      id: session.user_id,
      email: session.email,
      name: session.name,
      role: session.role,
    };
  }

  // Forward to the route handler
  const response = await next();

  // Merge CORS headers into the final response
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function withCors(response, cors) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
