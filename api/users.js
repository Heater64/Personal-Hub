/* ==========================================
   Admin API: list all Supabase Auth users
   Requires admin session. Uses SERVICE ROLE KEY.
   ========================================== */

import { requireAdminCaller } from './_admin.js';

const USER_ID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
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
    if (action === 'update') {
      const { id, enabled } = req.body || {};
      if (typeof id !== 'string' || !USER_ID.test(id) || typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'El estado o el identificador de la cuenta no es válido.' });
      }

      try {
        // Un admin no puede deshabilitarse a sí mismo: perdería is_admin()
        // y ya no podría volver a habilitarse (mismo motivo por el que el
        // trigger prevent_role_escalation lo bloquea en la DB, aquí se
        // avisa antes de llegar).
        if (enabled === false && id.toLowerCase() === authCtx.user.id) {
          return res.status(400).json({ error: 'No puedes deshabilitar tu propia cuenta: te quedarías fuera sin poder volver a entrar.' });
        }

        // `enabled` SOLO se escribe en public.profiles.enabled.
        //
        // Antes se escribía también en raw_user_meta_data.enabled, que es
        // editable por el propio usuario con supabase.auth.updateUser y que
        // era lo que leía el login: eso permitía auto-habilitarse. La DB
        // (017) bloquea ya ese intento con un trigger, y la app ya no lee
        // metadata para decidir. Aquí se deja de duplicar el valor.
        const { data: profile, error: profileError } = await supabaseAdmin
          .from('profiles')
          .update({ enabled, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select('id')
          .maybeSingle();
        if (profileError) throw profileError;
        if (!profile) return res.status(404).json({ error: 'No se encontró el perfil de la cuenta.' });

        // Corte real de acceso en Supabase Auth. Un ban bloquea el inicio
        // de sesión en el servidor (no es un flag que el cliente pueda
        // saltarse). NO es instantáneo para una sesión ya abierta: el JWT
        // sigue siendo válido hasta que expira. Por eso el resto de capas
        // (RLS con is_enabled, guard de rutas, esta API) también miran
        // profiles.enabled.
        // ban_duration: 'none' es el valor oficial para levantar el ban.
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
          ban_duration: enabled ? 'none' : '876000h', // ~100 años: hasta que el admin lo levante
        });
        if (authError) {
          console.warn('[api/users] ban no aplicado:', authError.message);
          const warning = enabled
            ? 'El perfil se habilitó, pero falta levantar el bloqueo de inicio de sesión.'
            : 'El perfil se deshabilitó. Supabase Auth no confirmó el bloqueo adicional.';
          return res.status(200).json({ success: true, warning });
        }

        return res.status(200).json({ success: true });
      } catch (err) {
        console.error('[api/users] update error:', err.message);
        return res.status(500).json({ error: err.message || 'Update failed' });
      }
    }

    if (action === 'delete') {
      const { id } = req.body || {};
      if (typeof id !== 'string' || !USER_ID.test(id)) {
        return res.status(400).json({ error: 'El identificador de la cuenta no es válido.' });
      }
      if (id.toLowerCase() === authCtx.user.id) {
        return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta.' });
      }
      try {
        // Primero Auth. Si rechaza la eliminación, conservamos los registros.
        const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
        if (error) throw error;

        const tables = ['moods', 'analytics_visits', 'push_subscriptions'];
        let cleanupIncomplete = false;
        for (const table of tables) {
          try {
            const { error: cleanupError } = await supabaseAdmin.from(table).delete().eq('user_id', id);
            if (cleanupError && !['42P01', 'PGRST205'].includes(cleanupError.code)) throw cleanupError;
          } catch (cleanupError) {
            cleanupIncomplete = true;
            console.warn(`[api/users] No se pudieron borrar ${table}:`, cleanupError.message);
          }
        }
        return res.status(200).json({
          success: true,
          ...(cleanupIncomplete ? { warning: 'La cuenta se eliminó. Algunos registros asociados necesitan revisión.' } : {}),
        });
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

      hasMore = !!data.nextPage || pageUsers.length === perPage && (!data.lastPage || page < data.lastPage);
      page++;
    }

    // Roles y estado desde profiles (fuente de verdad); nunca desde
    // user_metadata, que el usuario puede editar por su cuenta.
    const profilesById = new Map();
    for (let start = 0; start < allUsers.length; start += perPage) {
      const ids = allUsers.slice(start, start + perPage).map(user => user.id);
      const { data: profiles, error } = await supabaseAdmin
        .from('profiles')
        .select('id, role, enabled, name, avatar_url')
        .in('id', ids);
      if (error) throw error;
      (profiles || []).forEach(profile => profilesById.set(profile.id, profile));
    }

    const users = allUsers.map(u => {
      const profile = profilesById.get(u.id);
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

    res.setHeader('X-Users-Truncated', String(hasMore));
    return res.status(200).json(users);
  } catch (err) {
    console.error('[api/users] unexpected error:', err.message);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
