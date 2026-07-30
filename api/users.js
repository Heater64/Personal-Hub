/* ==========================================
   Admin API: list all Supabase Auth users
   Requires admin session. Uses SERVICE ROLE KEY.
   ========================================== */

import { createClient } from '@supabase/supabase-js';

// Match the admin definition used by the frontend
const ADMIN_EMAILS = ['admin@personalhub.com'];

function isAdmin(user) {
  if (!user) return false;
  if (user.user_metadata?.role === 'admin') return true;
  return ADMIN_EMAILS.includes(user.email);
}

export default async function handler(req, res) {
  // Only allow GET
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const authHeader = req.headers.authorization || '';

  if (!supabaseUrl || !serviceKey || !anonKey) {
    return res.status(500).json({
      error: 'Server misconfigured: missing VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY'
    });
  }

  // 1. Verify the caller's JWT
  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const token = authHeader.replace(/^Bearer\s*/i, '');
  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const { data: { user }, error: userError } = await anonClient.auth.getUser(token);

  if (userError || !user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  if (!isAdmin(user)) {
    return res.status(403).json({ error: 'Forbidden: admin only' });
  }

  // 2. Use service role key to list all auth users
  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    const allUsers = [];
    let page = 1;
    const perPage = 100;
    const maxPages = 20;
    let hasMore = true;

    while (hasMore && page <= maxPages) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });

      if (error) {
        console.error('[api/users] listUsers error:', error.message);
        return res.status(400).json({ error: error.message });
      }

      const pageUsers = data.users || [];
      allUsers.push(...pageUsers);

      if (pageUsers.length < perPage) {
        hasMore = false;
      } else {
        page++;
      }
    }

    const users = allUsers.map(u => ({
      id: u.id,
      email: u.email,
      name:
        u.user_metadata?.name ||
        u.user_metadata?.username ||
        u.user_metadata?.full_name ||
        u.email?.split('@')[0] ||
        '',
      role: u.user_metadata?.role || 'user',
      photo: u.user_metadata?.avatar_url || u.user_metadata?.photo || '',
      enabled: u.user_metadata?.enabled !== false,
      created_at: u.created_at,
      last_login: u.last_sign_in_at
    }));

    return res.status(200).json(users);
  } catch (err) {
    console.error('[api/users] unexpected error:', err.message);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
