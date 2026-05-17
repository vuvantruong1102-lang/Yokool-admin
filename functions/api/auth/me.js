// GET /api/auth/me — returns current logged-in user

import { json } from '../_utils.js';

export async function onRequestGet({ data }) {
  return json({ user: data.user });
}
