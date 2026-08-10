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

const PUSH_TABLE = 'content'; // stored under id = 'push_subscriptions'
const PUSH_ID = 'push_subscriptions';

// ==========================================
// CALENDARIO — payload diario consciente
// ==========================================

function todayServerStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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

async function getSubscriptions() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(PUSH_TABLE)
    .select('data')
    .eq('id', PUSH_ID)
    .maybeSingle();

  if (error) throw error;
  return data?.data?.subscriptions || [];
}

async function saveSubscriptions(subscriptions) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from(PUSH_TABLE)
    .upsert(
      { id: PUSH_ID, data: { subscriptions }, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    );

  if (error) throw error;
}

// ==========================================
// HANDLER
// ==========================================

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const action = req.query.action || '';

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
// SUBSCRIBE
// ==========================================
async function handleSubscribe(req, res) {
  const { subscription } = req.body || {};
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription object. Must include endpoint.' });
  }

  // Verify auth token (pass through token from client)
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s*/i, '');
  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  // Verify the user
  try {
    const supabase = getSupabase();
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    const subscriptions = await getSubscriptions();

    // Remove old subscription for this user (one per user)
    const filtered = subscriptions.filter(s => s.userId !== user.id);

    // Add new subscription
    filtered.push({
      userId: user.id,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      createdAt: new Date().toISOString()
    });

    await saveSubscriptions(filtered);

    return res.status(200).json({ success: true, message: 'Subscription saved' });
  } catch (err) {
    console.error('[api/push/subscribe] auth error:', err.message);
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

// ==========================================
// UNSUBSCRIBE
// ==========================================
async function handleUnsubscribe(req, res) {
  const { endpoint } = req.body || {};
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s*/i, '');

  try {
    const supabase = getSupabase();
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    const subscriptions = await getSubscriptions();

    if (user && !userError) {
      // Remove by userId (preferred)
      const filtered = subscriptions.filter(s => s.userId !== user.id);
      await saveSubscriptions(filtered);
    } else if (endpoint) {
      // Remove by endpoint (fallback)
      const filtered = subscriptions.filter(s => s.endpoint !== endpoint);
      await saveSubscriptions(filtered);
    } else {
      return res.status(400).json({ error: 'Need either auth token or endpoint to unsubscribe' });
    }

    return res.status(200).json({ success: true, message: 'Unsubscribed' });
  } catch {
    return res.status(200).json({ success: true, message: 'Unsubscribed (best effort)' });
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
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
        isAdmin = profile?.role === 'admin';
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
