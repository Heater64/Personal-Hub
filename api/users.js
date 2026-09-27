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
    // authCtx ya verificó al llamador arriba (requireAdminCaller);
    // no hace falta volver a comprobar el JWT en cada acción.
    const admin = authCtx;

    if (action === 'update') {
      const { id, enabled } = req.body || {};
      if (!id) return res.status(400).json({ error: 'Missing user id' });

      try {
        if (typeof enabled !== 'boolean') {
          return res.status(200).json({ success: true });
        }

        // Un admin no puede deshabilitarse a sí mismo: perdería is_admin()
        // y ya no podría volver a habilitarse (mismo motivo por el que el
        // trigger prevent_role_escalation lo bloquea en la DB, aquí se
        // avisa antes de llegar).
        if (enabled === false && id === authCtx.user.id) {
          return res.status(400).json({ error: 'No puedes deshabilitar tu propia cuenta: te quedarías fuera sin poder volver a entrar.' });
        }

        // `enabled` SOLO se escribe en public.profiles.enabled.
        //
        // Antes se escribía también en raw_user_meta_data.enabled, que es
        // editable por el propio usuario con supabase.auth.updateUser y que
        // era lo que leía el login: eso permitía auto-habilitarse. La DB
        // (017) bloquea ya ese intento con un trigger, y la app ya no lee
        // metadata para decidir. Aquí se deja de duplicar el valor.
        const { error: profileError } = await admin.supabaseAdmin
          .from('profiles')
          .update({ enabled, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (profileError) throw profileError;

        // Corte real de acceso en Supabase Auth. Un ban bloquea el inicio
        // de sesión en el servidor (no es un flag que el cliente pueda
        // saltarse). NO es instantáneo para una sesión ya abierta: el JWT
        // sigue siendo válido hasta que expira. Por eso el resto de capas
        // (RLS con is_enabled, guard de rutas, esta API) también miran
        // profiles.enabled.
        // ban_duration: 'none' es el valor oficial para levantar el ban.
        const { error: authError } = await admin.supabaseAdmin.auth.admin.updateUserById(id, {
          ban_duration: enabled ? 'none' : '876000h', // ~100 años: hasta que el admin lo levante
        });
        if (authError) {
          // El ban es una capa extra: si falla, profiles.enabled + RLS
          // siguen siendo la fuente de verdad. Se avisa pero no se falla.
          console.warn('[api/users] ban no aplicado:', authError.message);
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
        // Limpia los datos asociados ANTES de borrar el usuario de Auth.
        // profiles se elimina sola (ON DELETE CASCADE desde auth.users),
        // pero moods y analytics_visits no tienen FK: sin este paso el
        // usuario reaparecía en el panel porque listUsers los reconstruye.
        // push_subscriptions tiene ON DELETE CASCADE desde 018, pero se
        // incluye aquí para que el borrado sea limpio también en bases
        // donde la tabla existe sin la FK. El error se ignora: si la tabla
        // no existe (017/018 sin aplicar) no debe impedir el borrado.
        const tables = ['moods', 'analytics_visits', 'push_subscriptions'];
        for (const table of tables) {
          const { error } = await admin.supabaseAdmin.from(table).delete().eq('user_id', id);
          if (error) console.warn(`[api/users] No se pudieron borrar ${table}:`, error.message);
        }
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

    // Roles y estado desde profiles (fuente de verdad); nunca desde
    // user_metadata, que el usuario puede editar por su cuenta.
    let profilesById = {};
    try {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, role, enabled, name, avatar_url');
      (profiles || []).forEach(p => { profilesById[p.id] = p; });
    } catch { /* profiles puede no existir: los usuarios salen como 'user' */ }

    const users = allUsers.map(u => {
      const profile = profilesById[u.id];
      return {
        id: u.id,
        email: u.email,
        name:
          profile?.name ||
          u.user_metadata?.name ||
          u.user_metadata?.username ||
          u.user_metadata?.full_name ||
          u.email?.split('@')[0] ||
          '',
        role: profile?.role || 'user',
        photo: profile?.avatar_url || u.user_metadata?.avatar_url || u.user_metadata?.photo || '',
        // Sin fila en profiles no hay dato que lo contradiga: se trata
        // como habilitado. Un `false` explícito en profiles manda siempre.
        enabled: profile ? profile.enabled !== false : true,
        created_at: u.created_at,
        last_login: u.last_sign_in_at
      };
    });

    return res.status(200).json(users);
  } catch (err) {
    console.error('[api/users] unexpected error:', err.message);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
