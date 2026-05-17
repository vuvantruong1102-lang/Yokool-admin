// /api/upload
//   POST (admin) — upload file to Cloudflare R2 bucket "IMAGES"
//
// Yêu cầu setup Cloudflare R2:
//   1. Cloudflare Dashboard → R2 → Create bucket → tên: yokool-images
//   2. Settings → "Public Access" → Allow Access  → copy "Public R2.dev Bucket URL"
//      (vd: https://pub-abc123def456.r2.dev)
//   3. Pages project Settings → Functions → R2 bucket bindings
//      Variable name: IMAGES
//      R2 bucket: yokool-images
//   4. Pages project Settings → Environment Variables
//      Variable name: R2_PUBLIC_BASE
//      Value: https://pub-abc123def456.r2.dev (URL từ bước 2)
//   5. Re-deploy
//
// Sau khi setup, admin có thể upload ảnh và lấy public URL.

import { json, error } from './_utils.js';

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function extFromMime(mime) {
  switch (mime) {
    case 'image/jpeg': return 'jpg';
    case 'image/png':  return 'png';
    case 'image/webp': return 'webp';
    case 'image/gif':  return 'gif';
    default:           return 'bin';
  }
}

function randomId(len = 16) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost({ request, env }) {
  if (!env.IMAGES) {
    return error('R2 bucket chưa được bind (xem hướng dẫn trong /api/upload.js)', 500, 'R2_NOT_CONFIGURED');
  }
  if (!env.R2_PUBLIC_BASE) {
    return error('Biến môi trường R2_PUBLIC_BASE chưa set', 500, 'R2_BASE_MISSING');
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return error('Yêu cầu phải là multipart/form-data', 400, 'BAD_FORMAT');
  }

  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return error('Thiếu file trong field "file"', 400, 'NO_FILE');
  }

  const type = file.type || 'application/octet-stream';
  if (!ALLOWED_TYPES.includes(type)) {
    return error('Chỉ chấp nhận JPG, PNG, WEBP, GIF', 400, 'BAD_TYPE');
  }
  if (file.size > MAX_SIZE) {
    return error('File quá lớn (tối đa 5MB)', 400, 'TOO_LARGE');
  }

  const folder = (formData.get('folder') || 'misc').toString().replace(/[^a-z0-9-]/g, '');
  const ext = extFromMime(type);
  const yyyymm = new Date().toISOString().slice(0, 7); // 2026-05
  const key = `${folder || 'misc'}/${yyyymm}/${randomId()}.${ext}`;

  await env.IMAGES.put(key, file.stream(), {
    httpMetadata: { contentType: type },
  });

  const url = `${env.R2_PUBLIC_BASE.replace(/\/+$/, '')}/${key}`;
  return json({ ok: true, url, key, size: file.size, type }, 201);
}
