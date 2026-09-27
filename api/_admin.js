/* ==========================================
   Admin API: autenticación compartida para las
   funciones serverless de Vercel (api/*).
   Fuente de verdad del rol: email verificado en
   el JWT de Supabase Auth o rol 'admin' en profiles.
   NUNCA se confía en user_metadata.role (es manipulable).
   ========================================== */

import { createClient } from '@supabase/supabase-js';

// Identidad admin de referencia: email verificado en el JWT de Supabase Auth.
const ADMIN_EMAILS = ['admin@personalhub.com'];

/**
 * Verifica el rol contra la tabla profiles (fuente de verdad en DB).
 * `enabled` se lee en la MISMA consulta: una cuenta deshabilitada no
 * puede ser admin aunque conserve el rol. Nunca se mira
 * user_metadata (editable por el propio usuario).
 */
export async function isAdminFromDb(supabaseAdmin, userId) {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('role, enabled')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.error('[api/_admin] profiles query error:', error.message);
      return false;
    }
    if (!data) return false;
    return data.role === 'admin' && data.enabled !== false;
  } catch (err) {
    console.error('[api/_admin] profiles query threw:', err.message);
    return false;
  }
}

// Verifica el JWT del llamador y devuelve { supabaseAdmin, user } o null
// (ya se respondió el error). Fuente de verdad: email verificado en el
// JWT o rol admin en profiles (nunca user_metadata.role).
export async function requireAdminCaller(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const authHeader = req.headers.authorization || '';

  if (!supabaseUrl || !serviceKey || !anonKey) {
    res.status(500).json({ error: 'Server misconfigured: missing Supabase env vars' });
    return null;
  }

  const token = authHeader.replace(/^Bearer\s*/i, '');
  if (!token) {
    res.status(401).json({ error: 'Missing Authorization header' });
    return null;
  }

  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
  if (userError || !user) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return null;
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const emailConfirmed = !!(user.email_confirmed_at || user.confirmed_at);
  const adminByEmail = emailConfirmed && ADMIN_EMAILS.includes(String(user.email || '').toLowerCase());
  const adminByDb = emailConfirmed && !adminByEmail
    ? await isAdminFromDb(supabaseAdmin, user.id)
    : false;
  if (!adminByEmail && !adminByDb) {
    res.status(403).json({ error: 'Forbidden: admin only' });
    return null;
  }

  // Un admin deshabilitado pierde el acceso a las APIs aunque su sesión
  // siga viva en el navegador: se comprueba el estado de la cuenta, no
  // los claims del JWT (que no cambian hasta que expira).
  const { data: callerProfile } = await supabaseAdmin
    .from('profiles')
    .select('enabled')
    .eq('id', user.id)
    .maybeSingle();
  if (callerProfile && callerProfile.enabled === false) {
    res.status(403).json({ error: 'Forbidden: account disabled' });
    return null;
  }

  return { supabaseAdmin, user };
}
