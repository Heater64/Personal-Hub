/* ==========================================
   Admin API: list all Supabase Auth users
   Requires admin session. Uses SERVICE ROLE KEY.
   ========================================== */

import { requireAdminCaller } from './_admin.js';

export default async function handler(req, res) {
  // Only allow GET, POST (update/delete de usuarios)
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Autorización común: email verificado en JWT o rol admin en profiles.
  const authCtx = await requireAdminCaller(req, res);
  if (!authCtx) return; // ya respondió con el error
  const supabaseAdmin = authCtx.supabaseAdmin;

  if (req.method === 'POST') {
    const action = req.body?.action || '';
    const admin = await requireAdminCaller(req, res);
    if (!admin) return; // ya respondió con el error

    if (action === 'update') {
      const { id, enabled } = req.body || {};
      if (!id) return res.status(400).json({ error: 'Missing user id' });

      try {
        // Actualiza metadata (enabled) en Auth. NO se toca el rol desde aquí:
        // el rol vive en profiles y el trigger anti-escalación lo protege.
        const metadata = {};
        if (typeof enabled === 'boolean') metadata.enabled = enabled;
        if (metadata.enabled !== undefined) {
          await admin.supabaseAdmin.auth.admin.updateUserById(id, { user_metadata: metadata });
        }

        return res.status(200).json({ success: true });
      } catch (err) {
        console.error('[api/users] update error:', err.message);
        return res.status(500).json({ error: err.message || 'Update failed' });
      }
    }

    if (action === 'delete') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'Missing user id' });
      try {
        const { error } = await admin.supabaseAdmin.auth.admin.deleteUser(id);
        if (error) throw error;
        return res.status(200).json({ success: true });
      } catch (err) {
        console.error('[api/users] delete error:', err.message);
        return res.status(500).json({ error: err.message || 'Delete failed' });
      }
    }

    return res.status(400).json({ error: 'Invalid action. Use: update, delete' });
  }

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

    // Roles desde profiles (fuente de verdad); nunca desde user_metadata
    let profileRoles = {};
    try {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, role');
      (profiles || []).forEach(p => { profileRoles[p.id] = p.role; });
    } catch { /* profiles puede no existir: los usuarios salen como 'user' */ }

    const users = allUsers.map(u => ({
      id: u.id,
      email: u.email,
      name:
        u.user_metadata?.name ||
        u.user_metadata?.username ||
        u.user_metadata?.full_name ||
        u.email?.split('@')[0] ||
        '',
      role: profileRoles[u.id] || 'user',
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
