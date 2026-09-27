/* ==========================================
   API: Web Push Notifications
   - POST /api/push/subscribe   — guarda subscripción
   - POST /api/push/unsubscribe — elimina subscripción
   - POST /api/push/send        — envía a todos (admin/cron)
   ========================================== */

import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// VAPID keys desde variables de entorno
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@personalhub.com';

// Configurar web-push si las claves existen
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// Supabase admin client
function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

// ==========================================
// ALMACENAMIENTO DE SUSCRIPCIONES
// ==========================================
// Las suscripciones vivían en la fila id='push_subscriptions' de la tabla
// `content`, cuya policy es USING (true): cualquier usuario autenticado
// podía leer el endpoint de push de todos los demás y sus claves de
// cifrado. 018_push_subscriptions.sql lo mueve a una tabla propia con RLS
// por usuario.
//
// MIGRACIÓN SEGURA: se usa la tabla nueva si existe y, si todavía no,
// se cae al almacenamiento anterior. Así la API se puede desplegar antes
// o después del SQL sin dejar a nadie sin notificaciones. Cuando la tabla
// esté disponible y no haya nada legacy, el DELETE de la fila antigua
// ya lo hace la migración; la escritura legacy solo se usa en ese
// periodo transitorio.
const PUSH_TABLE = 'push_subscriptions';
const LEGACY_TABLE = 'content';
const LEGACY_ID = 'push_subscriptions';

// Fuente de verdad por persona: la tabla dedicada.
async function getSubscriptions() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(PUSH_TABLE)
    .select('user_id, endpoint, p256dh, auth, created_at')
    .order('created_at', { ascending: true });

  if (!error) {
    return (data || []).map(row => ({
      userId: row.user_id,
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth },
      createdAt: row.created_at
    }));
  }

  // 42P01 =relation does not exist. La migración 018 aún no se ha aplicado.
  if (error.code !== '42P01') throw error;
  return getLegacySubscriptions();
}

async function getLegacySubscriptions() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(LEGACY_TABLE)
    .select('data')
    .eq('id', LEGACY_ID)
    .maybeSingle();

  if (error) throw error;
  return data?.data?.subscriptions || [];
}

async function saveSubscriptions(subscriptions) {
  const supabase = getSupabase();
  const rows = (subscriptions || []).map(sub => ({
    user_id: sub.userId,
    endpoint: sub.endpoint,
    p256dh: sub.keys?.p256dh || '',
    auth: sub.keys?.auth || '',
    created_at: sub.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));

  // Solo hay algo que hacer si la lista no está vacía: un DELETE sin
  // filtro borraría la tabla entera.
  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from(PUSH_TABLE)
      .upsert(rows, { onConflict: 'endpoint' });
    if (upsertError && upsertError.code === '42P01') {
      return saveLegacySubscriptions(subscriptions);
    }
    if (upsertError) throw upsertError;
  }

  // Endpoints que ya no están en la lista (410/404 del push service, o el
  // propio unsubscribe) se eliminan aquí. Sin esto se acumularían filas
  // muertas para siempre.
  const keep = new Set(rows.map(r => r.endpoint));
  const { data: current, error: readError } = await supabase
    .from(PUSH_TABLE)
    .select('endpoint');
  if (!readError && current) {
    const stale = current.filter(row => !keep.has(row.endpoint)).map(row => row.endpoint);
    if (stale.length > 0) {
      const { error: delError } = await supabase
        .from(PUSH_TABLE)
        .delete()
        .in('endpoint', stale);
      if (delError && delError.code === '42P01') {
        return saveLegacySubscriptions(subscriptions);
      }
      if (delError) throw delError;
    }
  }
}

async function saveLegacySubscriptions(subscriptions) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from(LEGACY_TABLE)
    .upsert(
      { id: LEGACY_ID, data: { subscriptions }, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    );

  if (error) throw error;
}

// ==========================================
// CALENDARIO — payload diario consciente
// ==========================================

function todayServerStr(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

/**
 * Lee el catálogo del calendario (best effort). En Vercel la ruta del
 * repo puede variar, así que se prueban varias candidatas.
 */
function findGiftsCatalog() {
  const candidates = [
    path.join(process.cwd(), 'personal-hub', 'public', 'data', 'gifts.json'),
    path.join(process.cwd(), 'public', 'data', 'gifts.json'),
    path.join(process.cwd(), 'data', 'gifts.json')
  ];
  for (const p of candidates) {
    try {
      return JSON.parse(readFileSync(p, 'utf8'));
    } catch { /* siguiente candidata */ }
  }
  return null;
}

/**
 * Si hoy hay un regalo programado en el calendario, devuelve un payload
 * con enlace directo al día. Si no (o el catálogo no es legible), null
 * para que el push quede genérico.
 */
function calendarPayloadForToday() {
  const today = todayServerStr();
  try {
    const catalog = findGiftsCatalog();
    if (!catalog) return null;
    const byId = {};
    (catalog.gifts || []).forEach(g => { if (g.id) byId[g.id] = g; });
    const dayNum = String(parseInt(today.slice(8), 10));
    const giftId = catalog.months?.[today.slice(0, 7)]?.calendarMapping?.[dayNum];
    const gift = giftId ? byId[giftId] : null;
    if (!gift) return null;
    return {
      title: 'Hay una sorpresa esperándote 🎁',
      body: 'Tu calendario te espera hoy. Ábrela cuando quieras ❤️',
      url: `/calendario?day=${today}`,
      tag: 'daily-novelties'
    };
  } catch {
    return null;
  }
}

// ==========================================
// HELPERS
// ==========================================

function hourInSpain(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  return Number(parts.find(part => part.type === 'hour')?.value || 0);
}

// ==========================================
// HANDLER
// ==========================================

export default async function handler(req, res) {
  // Esta API se consume desde el mismo origen. No se habilita CORS abierto:
  // una página externa no debe poder invocar sus operaciones con el token.
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const action = req.query.action || '';
  if (action === 'send' && !['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (action !== 'send' && req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    switch (action) {
      case 'subscribe':
        return await handleSubscribe(req, res);
      case 'unsubscribe':
        return await handleUnsubscribe(req, res);
      case 'send':
        return await handleSend(req, res);
      default:
        return res.status(400).json({ error: 'Invalid action. Use: subscribe, unsubscribe, send' });
    }
  } catch (err) {
    console.error('[api/push] error:', err.message);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

// ==========================================
// SESSION — valida el token y el estado de la cuenta
// ==========================================
/**
 * Devuelve el usuario del token, o null tras haber respondido 401.
 *
 * Además del token se comprueba profiles.enabled: una cuenta deshabilitada
 * no debe poder registrar ni quitar suscripciones de push. Es la misma
 * fuente de verdad que usa la RLS (017).
 */
async function authenticate(req, res) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s*/i, '');
  if (!token) {
    res.status(401).json({ error: 'Missing Authorization header' });
    return null;
  }

  const supabase = getSupabase();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return null;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('enabled')
    .eq('id', user.id)
    .maybeSingle();
  if (profile && profile.enabled === false) {
    res.status(403).json({ error: 'Forbidden: account disabled' });
    return null;
  }

  return user;
}

// ==========================================
// SUBSCRIBE
// ==========================================
async function handleSubscribe(req, res) {
  const { subscription } = req.body || {};
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription object. Must include endpoint.' });
  }

  const user = await authenticate(req, res);
  if (!user) return; // ya respondió con el error

  try {
    const subscriptions = await getSubscriptions();

    // Una suscripción por persona: se retiran las anteriores de este
    // mismo usuario (otro dispositivo o un push service distinto).
    const filtered = subscriptions.filter(s => s.userId !== user.id);

    filtered.push({
      userId: user.id,
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys?.p256dh || '',
        auth: subscription.keys?.auth || ''
      },
      createdAt: new Date().toISOString()
    });

    await saveSubscriptions(filtered);

    return res.status(200).json({ success: true, message: 'Subscription saved' });
  } catch (err) {
    console.error('[api/push/subscribe] error:', err.message);
    return res.status(500).json({ error: err.message || 'Could not save subscription' });
  }
}

// ==========================================
// UNSUBSCRIBE
// ==========================================
async function handleUnsubscribe(req, res) {
  const user = await authenticate(req, res);
  if (!user) return; // ya respondió con el error

  try {
    // El cuerpo puede traer el endpoint concreto (pushsubscriptionchange)
    // o no venir (cierre de sesión / desuscribirse en los ajustes).
    const { endpoint } = req.body || {};
    const subscriptions = await getSubscriptions();
    const filtered = endpoint
      ? subscriptions.filter(s => !(s.userId === user.id && s.endpoint === endpoint))
      : subscriptions.filter(s => s.userId !== user.id);
    await saveSubscriptions(filtered);

    return res.status(200).json({ success: true, message: 'Unsubscribed' });
  } catch (err) {
    console.error('[api/push/unsubscribe] error:', err.message);
    return res.status(500).json({ error: 'Could not unsubscribe' });
  }
}

// ==========================================
// SEND — Envía push a todas las subscripciones
// Llamado por cron job diario a las 8:00 AM
// ==========================================
async function handleSend(req, res) {
  // Proteger con secret simple (no crítico para notificaciones anónimas,
  // pero evita abuso)
  const cronSecret = req.headers['x-cron-secret']
    || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const expectedSecret = process.env.CRON_SECRET;

  // También permitir llamadas autenticadas por admin
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s*/i, '');
  let isAdmin = false;

  if (token) {
    try {
      const supabase = getSupabase();
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, enabled')
          .eq('id', user.id)
          .maybeSingle();
        // Mismo criterio que public.is_admin() (017): rol admin, email
        // confirmado y cuenta habilitada.
        isAdmin = profile?.role === 'admin'
          && profile?.enabled !== false
          && !!(user.email_confirmed_at || user.confirmed_at);
      }
    } catch { /* not authenticated */ }
  }

  // No se permite ningún secreto por defecto: una configuración ausente
  // debe fallar cerrada en lugar de dejar el endpoint protegido por un
  // valor conocido. Vercel Cron puede entregar el secreto como Bearer.
  if (!expectedSecret && !isAdmin) {
    return res.status(500).json({ error: 'Cron secret not configured' });
  }

  if (cronSecret !== expectedSecret && !isAdmin) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Vercel Hobby solo permite un cron diario. La ejecución está fijada a
  // 06:00 UTC: equivale a 08:00 en verano y 07:00 en invierno en Madrid.
  // Aceptamos ambas horas para que la notificación no se pierda por DST.
  if (!isAdmin && ![7, 8].includes(hourInSpain())) {
    return res.status(200).json({ success: true, skipped: true, reason: 'Outside delivery window' });
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return res.status(500).json({ error: 'VAPID keys not configured' });
  }

  const subscriptions = await getSubscriptions();

  if (subscriptions.length === 0) {
    return res.status(200).json({ success: true, sent: 0, message: 'No subscriptions' });
  }

  // Mensaje personalizado del Admin (POST /api/push?action=send con body)
  const customTitle = req.body?.title?.trim();
  const customBody = req.body?.body?.trim();

  // Push diario del cron: si hoy hay un regalo del calendario, enlaza a ese
  // día; si no, queda el saludo genérico. (Las novedades por-usuario como
  // "razones sin leer" se notifican desde el cliente, que sí conoce su estado.)
  const calendarPush = customTitle ? null : calendarPayloadForToday();
  const payload = JSON.stringify({
    ...(calendarPush || {
      title: customTitle || '¡Buenos días! ☀️',
      body: customBody || 'Es hora de tu check-in diario de estado de ánimo.',
      url: req.body?.url || '/',
      tag: 'daily-welcome'
    }),
    timestamp: Date.now()
  });

  const results = { sent: 0, failed: 0, removed: 0 };
  const validSubscriptions = [];

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: sub.keys
        },
        payload
      );
      validSubscriptions.push(sub);
      results.sent++;
    } catch (err) {
      // 410 Gone = subscription expired/unsubscribed — remove it
      // 404 Not Found = endpoint no longer valid — remove it
      if (err.statusCode === 410 || err.statusCode === 404) {
        results.removed++;
      } else {
        // Keep subscription for retry (temporary error)
        validSubscriptions.push(sub);
        results.failed++;
      }
    }
  }

  // Save cleaned subscriptions (remove expired ones)
  if (results.removed > 0) {
    await saveSubscriptions(validSubscriptions);
  }

  return res.status(200).json({
    success: true,
    sent: results.sent,
    failed: results.failed,
    removed: results.removed,
    total: subscriptions.length
  });
}
