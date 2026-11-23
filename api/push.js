/* ==========================================
   API: Web Push Notifications
   - POST /api/push/subscribe   — guarda subscripción
   - POST /api/push/unsubscribe — elimina subscripción
   - POST /api/push/send        — envía a todos (admin/cron)
   - POST /api/push?action=notify-admin — avisa a los admins de lo que ella hace
     (body.kind: mood | mood_update | mood_change | note | cycle_period |
     cycle_log | cycle_share)
   - GET/POST /api/push?action=reminders — recordatorios programados (admin)
   - POST /api/push?action=run-reminders — envía los vencidos (cron/admin)
   - POST /api/push?action=ack — el dispositivo confirma que recibió un push
   ========================================== */

import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { sendFcmToTokens, fcmConfigured } from './_fcm.js';

// VAPID keys desde variables de entorno
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@personalhub.com';

// Configurar web-push si las claves existen.
//
// Esto se ejecuta al IMPORTAR el módulo: si web-push rechaza el par (una
// clave con `=` al final, comillas o de otro proyecto), un throw aquí mata
// la función entera y cada llamada responde 500 FUNCTION_INVOCATION_FAILED
// sin ningún JSON que explique el motivo. Se captura el error, se marca la
// configuración como inválida y cada acción responde su 500 legible de
// siempre ("VAPID keys not configured").
let vapidConfigError = null;
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  } catch (err) {
    vapidConfigError = err?.message || 'Invalid VAPID details';
    console.error('[api/push] VAPID inválidas:', vapidConfigError);
  }
}

/**
 * Guardia común de los envíos.
 *
 * Devuelve true (y responde 500) cuando no se puede enviar: faltan las claves
 * o web-push rechazó el par al importar. Mismo texto en todas partes para que
 * el motivo sea legible en los logs y en el panel, en vez de un 500 opaco.
 */
function requireVapid(res) {
  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && !vapidConfigError) return false;
  res.status(500).json({
    error: vapidConfigError
      ? `VAPID keys not configured: ${vapidConfigError}`
      : 'VAPID keys not configured',
  });
  return true;
}

/** Push funciona si está disponible Web Push o el canal nativo FCM. */
function requirePushTransport(res) {
  if (fcmConfigured()) return false;
  return requireVapid(res);
}

/**
 * ¿Es este error «esta suscripción se creó con OTRA clave VAPID»?
 *
 * El push service responde 403 con «the VAPID credentials in the
 * authorization header do not correspond to the credentials used to create
 * the subscriptions». Esa suscripción no puede volver a funcionar con la
 * clave actual: reintentarla cada día no arregla nada y deja el fallo mudo
 * (solo suma en `failed`). Se marca como caducada para retirarla; el cliente
 * la renueva al abrir la app y vuelve a suscribirse con la clave nueva.
 *
 * No se confunde con un 403 de otro tipo (p. ej. VAPID sin configurar en el
 * servidor): solo coincide si el cuerpo habla de credenciales VAPID.
 */
export function isVapidMismatchError(err) {
  if (!err || err.statusCode !== 403) return false;
  const body = typeof err.body === 'string' ? err.body : err.message || '';
  return /vapid/i.test(body) && /do not correspond|credentials/i.test(body);
}

// Supabase admin client
function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
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

// Recordatorios programados (migración 022). Viven en sus propias tablas:
// `push_reminders` (qué hay que enviar y cuándo) y `push_logs` (qué pasó
// en el último envío). Sin 022 aplicada, las acciones `reminders` y
// `run-reminders` responden 503 con la instrucción, no un 500 opaco.
const REMINDERS_TABLE = 'push_reminders';
const LOGS_TABLE = 'push_logs';
// Preferencias por persona (migración 023): qué tipos de aviso quiere y en
// qué horas no quiere que suene el teléfono.
const PREFS_TABLE = 'notification_prefs';

// Avisos del admin (migración 024). Son otro público: la usuaria recibe
// contenido (cartas, novedades, notas que él escribe) y el admin recibe
// SEGUIMIENTO (qué ha registrado, si ha tenido un mal día, si ha dejado una
// nota) más los avisos técnicos del hub. Cada clase mira su propio
// interruptor en la fila de preferencias del admin; los nombres coinciden con
// los del cliente para que el mismo objeto sirva en los dos lados.
const ADMIN_ALERT_KINDS = [
  'mood',
  'mood_update',
  'mood_change',
  'note',
  'cycle_period',
  'cycle_log',
  'cycle_share',
  'health',
];
const ADMIN_ALERT_PREF = {
  mood: 'adminMood',
  mood_update: 'adminMood',
  mood_change: 'adminMoodChanges',
  note: 'adminNotes',
  cycle_period: 'adminCycle',
  cycle_log: 'adminCycle',
  cycle_share: 'adminCycle',
  health: 'adminHealth',
};
const MALDIA_NOTES_TYPE = 'maldia_notes';

// Destinos que un aviso puede abrir en el panel. El servidor es un proceso
// aparte y no puede importar la lista del panel (arrastraría la SPA entera al
// bundle de la función), así que guarda su copia y un test exige que las dos
// coincidan. Si se añade una sección al menú, el test lo dice.
const ADMIN_SECTION_IDS = [
  'dashboard',
  'contenido',
  'multimedia',
  'moods',
  'usuarios',
  'notificaciones',
  'recordatorios',
  'actividad',
  'config',
];
const ADMIN_CONTENT_SUB_IDS = [
  'razones',
  'canciones',
  'regalos',
  'noticias',
  'maldia',
  'series',
  'openwhen',
  'audios',
];

/** La sección del panel de un aviso de ánimo: es donde se lee el ánimo del día. */
const ADMIN_MOOD_DESTINATION = '/admin?section=moods';
/** Donde se leen las notas de Mal Día es Contenido → Mal Día. */
const ADMIN_NOTES_DESTINATION = '/admin?section=contenido&sub=maldia';
/** El historial de envíos vive en Recordatorios. */
const ADMIN_LOGS_DESTINATION = '/admin?section=recordatorios';
/** El ciclo se lee en Menstruación, que para él es solo la vista de pareja. */
const ADMIN_CYCLE_DESTINATION = '/menstruacion';

// Nombres de los síntomas que la base guarda como id (catálogo de
// src/data/cycle.data.js). El servidor no puede importar la SPA, así que
// guarda su copia: si allí se renombra una etiqueta, aquí se ve el id tal cual
// en vez de inventarse un texto. Los escritos a mano llegan como `custom:…`.
const SYMPTOM_LABELS = {
  colicos: 'Cólicos',
  'dolor-abdominal': 'Dolor abdominal',
  'dolor-cabeza': 'Dolor de cabeza',
  'dolor-lumbar': 'Dolor lumbar',
  cansancio: 'Cansancio',
  'sensibilidad-mamaria': 'Sensibilidad mamaria',
  hinchazon: 'Hinchazón',
  nauseas: 'Náuseas',
  acne: 'Acné',
  apetito: 'Cambios en el apetito',
  otros: 'Otros síntomas',
};
const FLOW_LABELS = { light: 'Ligero', medium: 'Medio', heavy: 'Abundante' };
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

/** '2026-11-17' → '17 nov'. Sin Intl: el texto debe ser el mismo en todo servidor. */
function dayShort(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  if (!m) return '';
  return `${Number(m[3])} ${MONTHS_SHORT[Number(m[2]) - 1]}`;
}

/** Nombres legibles de una lista de síntomas (incluye los escritos por ella). */
function symptomList(ids) {
  return (Array.isArray(ids) ? ids : [])
    .map(id => {
      const key = String(id || '');
      return key.startsWith('custom:') ? key.slice(7) : SYMPTOM_LABELS[key];
    })
    .filter(Boolean)
    .filter((label, index, all) => all.indexOf(label) === index);
}

/**
 * ¿Se puede usar este destino en un aviso?
 *
 * Vale cualquier ruta interna —el admin elige destino al escribir un
 * recordatorio y el saludo diario apunta a donde toque—, pero el destino
 * tiene que ser una URL de la app y, cuando abre el panel, tiene que pedir una
 * sección que exista: `?section=` lo escribe un aviso, y una vista inventada
 * (o basura pegada a la query) no debe llegar al panel ni a la barra del
 * navegador.
 */
export function isAllowedNotificationPath(targetUrl) {
  const url = typeof targetUrl === 'string' ? targetUrl.trim() : '';
  // Solo rutas internas: una notificación que abre otro dominio es un vector
  // de phishing con la marca del hub.
  if (!url.startsWith('/') || url.startsWith('//')) return false;
  const queryAt = url.indexOf('?');
  if (url.slice(0, queryAt === -1 ? url.length : queryAt) !== '/admin') return true;
  // Sin `?section=` el panel abre su sección por defecto: es un destino válido.
  if (queryAt === -1) return true;
  let params;
  try {
    params = new URLSearchParams(url.slice(queryAt + 1));
  } catch {
    return false;
  }
  const section = params.get('section');
  if (section === null) return true;
  if (!ADMIN_SECTION_IDS.includes(section)) return false;
  const sub = params.get('sub');
  if (sub === null) return true;
  return section === 'contenido' && ADMIN_CONTENT_SUB_IDS.includes(sub);
}
const RECURRENCES = ['once', 'daily', 'weekly'];
const REMINDER_LIMITS = { title: 100, body: 500, url: 512 };
// Tope de vueltas al reprogramar. Un recordatorio diario parado dos años
// son ~730 saltos: si se pasa de esto, el dato está corrupto y se deja
// inactivo antes que entrar en un bucle.
const MAX_REMINDER_ITERATIONS = 1000;

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
      createdAt: row.created_at,
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
    updated_at: new Date().toISOString(),
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
  const { data: current, error: readError } = await supabase.from(PUSH_TABLE).select('endpoint');
  if (!readError && current) {
    const stale = current.filter(row => !keep.has(row.endpoint)).map(row => row.endpoint);
    if (stale.length > 0) {
      const { error: delError } = await supabase.from(PUSH_TABLE).delete().in('endpoint', stale);
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
    day: '2-digit',
  }).format(date);
}

// ==========================================
// ZONA HORARIA — Europe/Madrid
// ==========================================
// Un recordatorio «todos los días a las 19:00» tiene que sonar a las 19:00
// también el día que cambia la hora. Sumar 24 h exactas a un instante UTC
// lo desplaza una hora en los cambios de horario, así que la repetición se
// calcula sobre la hora de pared de Madrid: se lee la hora local del
// instante, se avanza el día de calendario y se vuelve a UTC con el desfase
// que toca ESE día.

/** Hora de pared de Madrid para un instante: { year, month, day, hour, minute }. */
function madridParts(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = type => Number(parts.find(part => part.type === type)?.value ?? 0);
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
  };
}

/** Desfase de Madrid (minutos) en el instante dado: +120 en verano, +60 en invierno. */
function madridOffsetMinutes(date) {
  const local = madridParts(date);
  const asUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  const rounded = Math.round(date.getTime() / 60000) * 60000;
  return Math.round((asUtc - rounded) / 60000);
}

/**
 * Instante UTC que corresponde a una hora de pared de Madrid.
 * Se resuelve por aproximación: el desfase depende del propio instante
 * (es justo lo que cambia con el horario de verano), así que se repite
 * hasta que se estabiliza. Dos vueltas bastan para cualquier fecha real.
 */
function fromMadridParts(parts) {
  const target = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  let candidate = target;
  for (let i = 0; i < 3; i++) {
    const next = target - madridOffsetMinutes(new Date(candidate)) * 60000;
    if (next === candidate) break;
    candidate = next;
  }
  return new Date(candidate);
}

/** Minutos desde medianoche en Madrid: el reloj que usan todas las ventanas horarias. */
function madridMinutes(date) {
  const local = madridParts(date);
  return local.hour * 60 + local.minute;
}

/** 'HH:MM' → minutos desde medianoche, o null si no es una hora válida. */
function parseHHMM(value) {
  if (typeof value !== 'string' || !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value)) return null;
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}

/**
 * ¿Cae el instante dentro de la franja de silencio?
 *
 * Soporta franjas que cruzan medianoche (23:00 → 08:00) y trata una franja
 * vacía (desde === hasta) como «sin silencio». Tiene que medir exactamente
 * lo mismo que `inQuietHours` del cliente (notifications.service.js): si
 * aquí sonara y allí no, la persona recibiría un aviso que su propio perfil
 * dice que no debe sonar — y al revés, se perdería uno que sí esperaba.
 * Se exporta para poder probarla sin base de datos (tests/).
 */
export function inQuietHours(now, quietFrom, quietTo) {
  const from = parseHHMM(quietFrom);
  const to = parseHHMM(quietTo);
  if (from === null || to === null || from === to) return false;
  const minutes = madridMinutes(now instanceof Date ? now : new Date(now));
  return from < to ? minutes >= from && minutes < to : minutes >= from || minutes < to;
}

/**
 * Instante en que termina el silencio vigente, o null si la franja no vale.
 * Sirve para APLAZAR un recordatorio en vez de perderlo.
 */
function quietEndsAt(now, quietTo) {
  const to = parseHHMM(quietTo);
  if (to === null) return null;
  const local = madridParts(now);
  const hour = Math.floor(to / 60);
  const minute = to % 60;
  let end = fromMadridParts({ ...local, hour, minute });
  if (end.getTime() <= now.getTime()) {
    // La hora de fin ya pasó hoy: el silencio empezó hoy y termina mañana.
    const next = new Date(Date.UTC(local.year, local.month - 1, local.day + 1));
    end = fromMadridParts({
      year: next.getUTCFullYear(),
      month: next.getUTCMonth() + 1,
      day: next.getUTCDate(),
      hour,
      minute,
    });
  }
  return end.toISOString();
}

/**
 * Score de ánimo (0 peor … 4 mejor, ver src/data/moods.data.js) a partir del
 * cual el aviso deja de ser «ha registrado su ánimo» y pasa a ser «hoy toca
 * acompañar». Se exporta para poder fijarlo en los tests.
 */
export const ADMIN_BAD_SCORE = 2;

/**
 * ¿Este estado merece compañía, o solo informa de cómo está?
 *
 * Sin un número que leer NO se afirma que sea un mal día: `Number(null)` es 0,
 * y una fila con el score vacío dispararía una alarma de emergencia falsa.
 * Una alarma de más es peor que ninguna, porque enseña a ignorarlas.
 */
export function isBadDayMood(score) {
  if (typeof score !== 'number' && typeof score !== 'string') return false;
  if (typeof score === 'string' && score.trim() === '') return false;
  const n = Number(score);
  return Number.isFinite(n) && n <= ADMIN_BAD_SCORE;
}

/** Interruptor que gobierna una clase de aviso del admin, o null si no existe. */
export function adminAlertPrefFor(kind) {
  return ADMIN_ALERT_PREF[kind] || null;
}

/**
 * Payload del aviso de ánimo al admin.
 *
 * Tres textos distintos para tres cosas distintas: un registro normal, un
 * cambio del mismo día (que deja obsoleto lo que vio antes) y un mal día, que
 * es el único que se queda en pantalla hasta que se descarta
 * (`requireInteraction`) y lleva su propio `tag` para que un «Bien» posterior
 * no lo reemplace silenciosamente.
 *
 * En los tres casos el texto dice el estado CONCRETO (emoji + nombre): el
 * aviso sirve para saber cómo está ahora, no solo para saber que algo pasó.
 * `mood_update` (corrección dentro de la ventana de 5 min) conserva la marca
 * de que es una corrección, pero se envía igual que las demás.
 */
/**
 * Una fila con VARIAS emociones guarda la lista con `|` en sus columnas (ver
 * src/data/moods.data.js). El aviso habla en lenguaje normal: aquí se
 * deshace el formato de almacenamiento.
 */
function splitMoodField(value, separator = '') {
  return String(value ?? '')
    .split('|')
    .map(part => part.trim())
    .filter(Boolean)
    .join(separator);
}

export function adminMoodPayload(mood, kind = 'mood') {
  const emoji = splitMoodField(mood?.emoji) || '💬';
  const label = splitMoodField(mood?.label, ' · ') || 'Ánimo registrado';
  if (kind === 'mood_change') {
    return {
      title: `${emoji} ${label} · ha cambiado`,
      body: `Ahora está en «${label}» ${emoji}. Lo que viste antes ya no es su estado actual.`,
      url: ADMIN_MOOD_DESTINATION,
      tag: 'admin-mood',
    };
  }
  if (kind === 'mood_update') {
    return {
      title: `${emoji} ${label} · actualizado`,
      body: `Acaba de corregir su ánimo de hoy: ahora está en «${label}» ${emoji}.`,
      url: ADMIN_MOOD_DESTINATION,
      tag: 'admin-mood',
    };
  }
  if (isBadDayMood(mood?.score)) {
    return {
      title: `${emoji} ${label} · hoy toca acompañar`,
      body: 'Ha marcado un mal día. Puede que le venga bien un mensaje tuyo ahora.',
      url: ADMIN_MOOD_DESTINATION,
      tag: 'admin-mood-bad',
      requireInteraction: true,
    };
  }
  return {
    title: `${emoji} ${label}`,
    body: `Su ánimo de hoy es «${label}» ${emoji}.`,
    url: ADMIN_MOOD_DESTINATION,
    tag: 'admin-mood',
  };
}

/**
 * Payload del aviso de una nota de Mal Día. El texto va recortado: una
 * notificación es un aviso para entrar, no el sitio donde leerla entera.
 */
export function adminNotePayload(text) {
  const clean = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  return {
    title: '💌 Nota nueva en Mal Día',
    body:
      clean.length > 160 ? `${clean.slice(0, 157)}…` : clean || 'Ha dejado una nota en Mal Día.',
    url: ADMIN_NOTES_DESTINATION,
    tag: 'admin-note',
    requireInteraction: true,
  };
}

/**
 * Aviso de una menstruación registrada. Distingue «empieza» de «termina»
 * porque para él son dos cosas distintas: una explica el ánimo de estos días y
 * la otra que ya pasó.
 */
export function adminCyclePeriodPayload(period) {
  const start = dayShort(period?.start_date) || 'su fecha de inicio';
  const end = dayShort(period?.end_date);
  return {
    title: end ? '🌸 Menstruación terminada' : '🌸 Menstruación registrada',
    body: end ? `Del ${start} al ${end}.` : `Empezó el ${start}.`,
    url: ADMIN_CYCLE_DESTINATION,
    tag: 'admin-cycle',
  };
}

/**
 * Aviso de un día del ciclo: flujo, síntomas y, si lo dejó, su nota. Es el
 * aviso con más contexto de todos, porque es lo que ella apunta para que él
 * sepa cómo está.
 */
export function adminCycleLogPayload(log) {
  const parts = [];
  if (log?.flow && FLOW_LABELS[log.flow]) parts.push(`Flujo ${FLOW_LABELS[log.flow].toLowerCase()}`);
  if (log?.spotting) parts.push('manchado');
  const symptoms = symptomList(log?.symptoms);
  if (symptoms.length) {
    const head = symptoms.slice(0, 3).join(', ');
    parts.push(symptoms.length > 3 ? `${head} +${symptoms.length - 3}` : head);
  }
  const day = dayShort(log?.log_date);
  const body = parts.length ? `${day} · ${parts.join(' · ')}` : `${day} · día registrado`;
  const note = String(log?.notes || '')
    .replace(/\s+/g, ' ')
    .trim();
  return {
    title: '🩸 Su día del ciclo',
    body: note ? `${body}. «${note.length > 90 ? `${note.slice(0, 87)}…` : note}»` : body,
    url: ADMIN_CYCLE_DESTINATION,
    tag: 'admin-cycle-day',
  };
}

/** Nombres de los campos de `cycle_sharing` en lenguaje normal. */
const SHARED_FIELD_LABELS = {
  next_period: 'próxima regla',
  cycle_status: 'estado del ciclo',
  cycle_day: 'día del ciclo',
  period: 'menstruaciones',
  symptoms: 'síntomas',
  mood: 'ánimo',
  notes: 'notas',
  stats: 'medias',
};

/**
 * Aviso de que ella ha abierto (o ampliado) lo que comparte. Sin esto él
 * tendría que entrar a mirar a ciegas si ya puede ver algo.
 */
export function adminCycleSharePayload(sharing) {
  const fields = (Array.isArray(sharing?.shared_fields) ? sharing.shared_fields : [])
    .map(f => SHARED_FIELD_LABELS[f])
    .filter(Boolean);
  const listed =
    fields.length > 4
      ? `${fields.slice(0, 4).join(', ')} y ${fields.length - 4} más`
      : fields.join(', ');
  return {
    title: '🔓 Comparte su ciclo contigo',
    body: fields.length
      ? `Ahora puedes ver: ${listed}.`
      : 'Ha activado compartir su ciclo contigo.',
    url: ADMIN_CYCLE_DESTINATION,
    tag: 'admin-cycle-share',
  };
}

/**
 * Payload del aviso técnico. Solo cuenta lo que ha fallado: un aviso de salud
 * que siempre llega no se lee.
 */
export function adminHealthPayload(summary) {
  const failed = Number(summary?.failed) || 0;
  const removed = Number(summary?.removed) || 0;
  const partes = [];
  if (failed > 0)
    partes.push(`${failed} envío${failed === 1 ? '' : 's'} fallido${failed === 1 ? '' : 's'}`);
  if (removed > 0) partes.push(`${removed} dispositivo${removed === 1 ? '' : 's'} sin suscripción`);
  return {
    title: '⚠️ Aviso técnico del hub',
    // Sin contadores no se deja el texto empezando en «. »: hoy quien llama ya
    // filtra el caso, pero esta función es la que decide el mensaje.
    body: partes.length
      ? `${partes.join(' · ')}. Revisa los recordatorios en el panel.`
      : 'Algo no se pudo entregar. Revisa los recordatorios en el panel.',
    url: ADMIN_LOGS_DESTINATION,
    tag: 'admin-health',
    requireInteraction: true,
  };
}

/**
 * Reparte los destinatarios de un tipo de aviso en tres grupos: los que lo
 * reciben ahora, los que están en silencio (bloqueo temporal) y los que
 * tienen ese tipo apagado (bloqueo permanente).
 *
 * Sin fila de preferencias se entrega: el defecto del hub es avisar, así que
 * quien nunca ha tocado sus ajustes —o una lectura que falló— no se queda
 * sin avisos por un dato que no existe.
 */
export function splitRecipients(subscriptions, prefsById, now, category) {
  const allowed = [];
  const quiet = [];
  const off = [];
  for (const sub of subscriptions || []) {
    const prefs = prefsById?.get(String(sub.userId));
    if (!prefs) {
      allowed.push(sub);
      continue;
    }
    if (prefs[category] === false) {
      off.push(sub);
      continue;
    }
    if (inQuietHours(now, prefs.quietFrom, prefs.quietTo)) {
      quiet.push(sub);
      continue;
    }
    allowed.push(sub);
  }
  return { allowed, quiet, off };
}

/**
 * Momento en que ya nadie está en silencio (el fin más tardío de los que
 * bloquean), o null si no se puede calcular.
 */
export function deferUntilFor(quietSubs, prefsById, now) {
  let latest = null;
  for (const sub of quietSubs || []) {
    const end = quietEndsAt(now, prefsById?.get(String(sub.userId))?.quietTo);
    if (!end) continue;
    if (latest === null || Date.parse(end) > Date.parse(latest)) latest = end;
  }
  return latest;
}

/**
 * Próxima ejecución de un recordatorio, o null si no vuelve a repetirse.
 * Avanza hasta quedar por delante de `now`: si el programador estuvo caído
 * dos días, un diario no vuelve con dos avisos atrasados, sino con el
 * siguiente que toca.
 *
 * Se exporta para poder probarla sin base de datos ni red (tests/).
 */
export function nextRunFor(nextRunAtIso, recurrence, now = new Date()) {
  if (!RECURRENCES.includes(recurrence) || recurrence === 'once') return null;
  const step = recurrence === 'weekly' ? 7 : 1;
  let cursor = new Date(nextRunAtIso);
  if (!Number.isFinite(cursor.getTime())) return null;
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();

  for (let i = 0; i < MAX_REMINDER_ITERATIONS; i++) {
    const local = madridParts(cursor);
    // Avanzar días sobre el calendario local evita el arrastre del desfase:
    // Date.UTC normaliza el desbordamiento de mes y de año.
    const target = new Date(Date.UTC(local.year, local.month - 1, local.day + step));
    cursor = fromMadridParts({
      year: target.getUTCFullYear(),
      month: target.getUTCMonth() + 1,
      day: target.getUTCDate(),
      hour: local.hour,
      minute: local.minute,
    });
    if (cursor.getTime() > nowMs) return cursor.toISOString();
  }
  return null;
}

/** Filas de recordatorio que ya toca enviar. */
export function dueReminders(rows, now = new Date()) {
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  return (rows || []).filter(row => {
    if (!row || row.active === false) return false;
    const at = Date.parse(row.next_run_at);
    return Number.isFinite(at) && at <= nowMs;
  });
}

/**
 * Valida y normaliza lo que llega del panel. Devuelve { ok: false, error }
 * con un texto que se puede enseñar tal cual al admin.
 *
 * El destino tiene que ser una ruta interna (ver `isAllowedNotificationPath`):
 * una notificación del sistema que abre otro dominio es un vector de phishing
 * con la marca del hub.
 */
export function cleanReminderInput(input = {}) {
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const body = typeof input.body === 'string' ? input.body.trim() : '';
  const rawUrl = typeof input.targetUrl === 'string' ? input.targetUrl.trim() : '';
  const targetUrl = rawUrl || '/';
  const recurrence = RECURRENCES.includes(input.recurrence) ? input.recurrence : 'once';

  if (!title) return { ok: false, error: 'El título es obligatorio' };
  if (title.length > REMINDER_LIMITS.title) {
    return { ok: false, error: `El título no puede pasar de ${REMINDER_LIMITS.title} caracteres` };
  }
  if (!body) return { ok: false, error: 'El mensaje es obligatorio' };
  if (body.length > REMINDER_LIMITS.body) {
    return { ok: false, error: `El mensaje no puede pasar de ${REMINDER_LIMITS.body} caracteres` };
  }
  if (targetUrl.length > REMINDER_LIMITS.url) {
    return { ok: false, error: 'El destino es demasiado largo' };
  }
  if (!isAllowedNotificationPath(targetUrl)) {
    return { ok: false, error: 'El destino tiene que ser una ruta de la app (empezar por /)' };
  }

  const scheduledAt = typeof input.scheduledAt === 'string' ? new Date(input.scheduledAt) : null;
  if (!scheduledAt || !Number.isFinite(scheduledAt.getTime())) {
    return { ok: false, error: 'La fecha de envío no es válida' };
  }

  return {
    ok: true,
    value: { title, body, targetUrl, recurrence, scheduledAt: scheduledAt.toISOString() },
  };
}

/**
 * Lee el catálogo del calendario (best effort). En Vercel la ruta del
 * repo puede variar, así que se prueban varias candidatas.
 */
function findGiftsCatalog() {
  const candidates = [
    path.join(process.cwd(), 'tamp', 'public', 'data', 'gifts.json'),
    path.join(process.cwd(), 'public', 'data', 'gifts.json'),
    path.join(process.cwd(), 'data', 'gifts.json'),
  ];
  for (const p of candidates) {
    try {
      return JSON.parse(readFileSync(p, 'utf8'));
    } catch {
      /* siguiente candidata */
    }
  }
  return null;
}

async function loadCalendarCatalog() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('content')
      .select('data')
      .eq('id', 'gifts')
      .maybeSingle();
    if (!error && data?.data && typeof data.data === 'object') return data.data;
  } catch {
    /* la API puede ejecutarse sin credenciales locales */
  }
  return findGiftsCatalog();
}

export function calendarPayloadForCatalog(catalog, today = todayServerStr()) {
  if (
    !catalog ||
    typeof today !== 'string' ||
    today.length !== 10 ||
    today[4] !== '-' ||
    today[7] !== '-'
  )
    return null;
  const dayNum = String(parseInt(today.slice(8), 10));
  const rawIds = catalog.months?.[today.slice(0, 7)]?.calendarMapping?.[dayNum];
  const giftIds = Array.isArray(rawIds) ? rawIds : rawIds ? [rawIds] : [];
  const giftsById = { ...(catalog.giftsById || {}) };
  (catalog.gifts || []).forEach(gift => {
    if (gift?.id) giftsById[gift.id] = gift;
  });
  const giftId = giftIds.find(id => giftsById[id]);
  if (!giftId) return null;
  return {
    title: 'Hay una sorpresa esperándote 🎁',
    body: 'Tu calendario te espera hoy. Ábrela cuando quieras ❤️',
    url: `/calendario?day=${today}&gift=${encodeURIComponent(giftId)}`,
    tag: 'daily-novelties',
  };
}

/** Lee el catálogo de Admin de Supabase y cae al JSON semilla si falta. */
async function calendarPayloadForToday() {
  try {
    return calendarPayloadForCatalog(await loadCalendarCatalog());
  } catch {
    return null;
  }
}

// ==========================================
// ANNOUNCE — contenido nuevo que publica el admin
// ==========================================

/**
 * Tipos de contenido que se pueden anunciar al publicarlos. La lista es
 * cerrada: el cliente elige QUÉ se publicó, pero el texto lo pone el servidor.
 *
 * Cada tipo se gobierna con el interruptor que ya existe (no se añade otro):
 * las cartas con «Cartas Open When» y el resto con el aviso diario, que es el
 * que ya agrupa las novedades del hub.
 */
export const ANNOUNCE_KINDS = ['openwhen', 'calendar', 'reason', 'content'];
const ANNOUNCE_PREF = {
  openwhen: 'letters',
  calendar: 'daily',
  reason: 'daily',
  content: 'daily',
};

/** Nombre de la sección, recortado y sin caracteres de control. */
function cleanSection(value) {
  const text = String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, 40);
}

/**
 * Payload del aviso de contenido nuevo.
 *
 * `count` es cuántos elementos se han añadido (1 por defecto): el texto cambia
 * entre singular y plural para que el aviso diga algo cierto. En `content` el
 * destino lo elige el panel, así que pasa por la lista blanca de rutas.
 * En Open When, `newCategory` distingue «Open When nueva» (una categoría que
 * antes no existía, con `category` como nombre) de «Open When actualizada»
 * (cartas nuevas en las de siempre); `updated` es el aviso de una carta que ya
 * existía y ha cambiado.
 */
export function announcePayload(kind, {
  count = 1, section = '', url = '', newCategory = false, category = '', updated = false
} = {}) {
  const n = Number.isFinite(Number(count)) && Number(count) > 0 ? Math.floor(Number(count)) : 1;
  if (kind === 'openwhen') {
    if (updated === true) {
      return {
        title: 'Carta actualizada en Open When ✏️',
        body:
          n === 1
            ? 'Una carta que ya conoces tiene cambios. Mírala cuando quieras.'
            : `${n} cartas que ya conocías tienen cambios.`,
        url: '/openwhen',
        tag: 'openwhen-updated',
      };
    }
    if (newCategory === true) {
      const name = cleanSection(category);
      return {
        title: 'Open When nueva 🗂️',
        body: `${name ? `«${name}»` : 'Una categoría'} es nueva. Tienes ${
          n === 1 ? 'una carta' : `${n} cartas`
        } esperándote.`,
        url: '/openwhen',
        tag: 'openwhen-new',
      };
    }
    return {
      title: 'Open When actualizada 💌',
      body:
        n === 1
          ? 'Tienes una carta nueva sin abrir.'
          : `Tienes ${n} cartas nuevas sin abrir.`,
      url: '/openwhen',
      tag: 'openwhen-new',
    };
  }
  if (kind === 'calendar') {
    return {
      title: n === 1 ? 'Hay una sorpresa nueva 🎁' : 'Hay sorpresas nuevas 🎁',
      body:
        n === 1
          ? 'El calendario tiene un regalo nuevo. Ábrelo cuando quieras.'
          : `El calendario tiene ${n} regalos nuevos.`,
      url: '/calendario',
      tag: 'calendar-new',
    };
  }
  if (kind === 'reason') {
    return {
      title: n === 1 ? 'Razón nueva 💛' : `${n} razones nuevas 💛`,
      body: 'Hay algo nuevo para ti en Razones.',
      url: '/razones',
      tag: 'reason-new',
    };
  }
  const where = cleanSection(section);
  return {
    title: where ? `Contenido nuevo: ${where}` : 'Contenido nuevo en el hub ✨',
    body: 'Hay cosas nuevas esperándote. Ábrelo cuando quieras.',
    url: isAllowedNotificationPath(url) ? url.trim() : '/',
    tag: 'content-new',
  };
}

// ==========================================
// HELPERS
// ==========================================

function hourInSpain(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    hourCycle: 'h23',
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
  // `send` y `reminders` se leen con GET (el cron de Vercel llama por GET y
  // el panel lista por GET); el resto son operaciones de escritura, y una
  // escritura solo entra por POST (DELETE/PUT no se cuelan en el handler).
  const READ_ACTIONS = ['send', 'reminders'];
  const allowedMethods = READ_ACTIONS.includes(action) ? ['GET', 'POST'] : ['POST'];
  if (action === 'send' && !['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!allowedMethods.includes(req.method)) {
    res.setHeader('Allow', allowedMethods.join(', '));
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
      case 'notify-admin':
        return await handleNotifyAdmin(req, res);
      case 'battery-low':
        return await handleBatteryLow(req, res);
      case 'announce':
        return await handleAnnounce(req, res);
      case 'reminders':
        return await handleReminders(req, res);
      case 'run-reminders':
        return await handleRunReminders(req, res);
      case 'ack':
        return await handleAck(req, res);
      case 'token':
        return await handleRegisterToken(req, res);
      default:
        return res
          .status(400)
          .json({
            error:
              'Invalid action. Use: subscribe, unsubscribe, send, notify-admin, announce, reminders, run-reminders, ack, token',
          });
    }
  } catch (err) {
    console.error('[api/push] error:', err.message);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

// Battery alerts are emitted by the authenticated background device service.
// Resolve recipients from couple_members; never accept user IDs from the client.
async function handleBatteryLow(req, res) {
  const user = await authenticate(req, res);
  if (!user) return;
  if (!fcmConfigured()) return res.status(503).json({ error: 'FCM no está configurado' });
  const level = Number(req.body?.level);
  if (!Number.isInteger(level) || level < 0 || level > 20) {
    return res.status(400).json({ error: 'Nivel de batería no válido' });
  }
  const supabase = getSupabase();
  const { data: membership, error: membershipError } = await supabase
    .from('couple_members').select('couple_id').eq('user_id', user.id).maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership?.couple_id) return res.status(200).json({ sent: 0, skipped: true });
  const { data: members, error: membersError } = await supabase
    .from('couple_members').select('user_id').eq('couple_id', membership.couple_id);
  if (membersError) throw membersError;
  const userIds = [...new Set((members || []).map(row => row.user_id).filter(Boolean))];
  const { data: profile } = await supabase.from('profiles').select('name').eq('id', user.id).maybeSingle();
  const payload = {
    type: 'battery_low',
    title: 'Batería baja',
    body: `${profile?.name || 'Tu pareja'} tiene ${level}% de batería. La ubicación se pausó hasta llegar al 30%.`,
    url: '/mapa',
  };
  const result = await sendTokensToUsers(userIds, payload);
  return res.status(200).json({ sent: result?.sent || 0, configured: true });
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
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
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
// ADMIN — quién puede programar recordatorios
// ==========================================
/**
 * ¿Es este usuario admin de verdad? Mismo criterio que `public.is_admin()`
 * (017) y que api/_admin.js: rol en `profiles`, cuenta habilitada y correo
 * confirmado en el JWT. Nunca se mira `user_metadata.role`.
 */
async function isAdminUser(user) {
  const supabase = getSupabase();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, enabled')
    .eq('id', user.id)
    .maybeSingle();
  return (
    profile?.role === 'admin' &&
    profile?.enabled !== false &&
    !!(user.email_confirmed_at || user.confirmed_at)
  );
}

/** Sesión de admin o null (ya respondió el error). */
async function requireAdmin(req, res) {
  const user = await authenticate(req, res);
  if (!user) return null;
  if (!(await isAdminUser(user))) {
    res.status(403).json({ error: 'Forbidden: admin only' });
    return null;
  }
  return user;
}

/**
 * ¿Viene del programador (cron)? Se exige el secreto configurado: sin
 * CRON_SECRET en el entorno esto es siempre false, así que una instalación
 * a medias no deja el envío masivo abierto.
 */
function cronSecretMatches(req) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const provided =
    req.headers['x-cron-secret'] || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return provided === expected;
}

// ==========================================
// TOKEN DE LA APP NATIVA (FCM)
// ==========================================
/**
 * Alta de un token de FCM que manda la app Android.
 *
 * Mismo guardia que `subscribe`: sesión válida y cuenta habilitada. El token
 * es único en la tabla, así que si el móvil cambia de cuenta la fila se
 * reasigna (`onConflict: 'token'`) en vez de quedar huérfana.
 */
async function handleRegisterToken(req, res) {
  const { token, platform } = req.body || {};
  if (!token || typeof token !== 'string' || token.length < 20) {
    return res.status(400).json({ error: 'Invalid token' });
  }

  const user = await authenticate(req, res);
  if (!user) return; // ya respondió con el error

  const supabase = getSupabase();
  const { error } = await supabase.from('push_tokens').upsert(
    {
      user_id: user.id,
      token,
      platform: platform === 'ios' ? 'ios' : 'android',
      enabled: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'token' }
  );

  if (error) {
    // El motivo se registra y se devuelve: un 503 genérico costó una tarde
    // entera de diagnóstico cuando la tabla existía pero service_role no
    // tenía privilegios (42501).
    console.error('[push] no se pudo guardar el token:', error.code, error.message);

    // 42P01 / PGRST205: falta sql/026 (o PostgREST aún no la ve).
    const missing = error.code === '42P01' || error.code === 'PGRST205';
    return res.status(missing ? 503 : 500).json({
      error: missing
        ? 'Aplica sql/026_push_tokens.sql en Supabase'
        : `No se pudo guardar el token (${error.code || 'error'}): ${error.message || 'sin detalle'}`,
      code: error.code || null,
    });
  }

  return res.status(200).json({ success: true });
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
        auth: subscription.keys?.auth || '',
      },
      createdAt: new Date().toISOString(),
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
// ACK — el dispositivo confirma que recibió el push (025)
// ==========================================
// WEB PUSH NO TIENE RECIBO. Que el push service acepte un envío (`sent`) solo
// significa eso: lo aceptó. El aviso puede quedarse ahí si el móvil está
// apagado, sin datos o con la app congelada, así que «enviado» NUNCA es
// «visto». La única prueba real de que llegó al dispositivo es que el propio
// dispositivo lo diga: el service worker manda de vuelta el token que viajó en
// el payload y el historial pasa de «enviado» a «entregado».
//
// No pide sesión: el token es la credencial (un UUID que solo conoce el
// dispositivo al que se envió) y lo único que permite es marcar como entregada
// esa fila concreta. Sin token válido no se toca nada.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Respuesta clara cuando la 025 (acuse de entrega) todavía no está aplicada. */
function missingDeliveryColumns(res, err) {
  if (err?.code !== '42703') return false;
  res.status(503).json({
    error:
      'El acuse de entrega necesita la migración sql/025_push_log_delivery.sql aplicada en Supabase',
  });
  return true;
}

async function handleAck(req, res) {
  const delivery = typeof req.body?.delivery === 'string' ? req.body.delivery.trim() : '';
  if (!UUID_RE.test(delivery)) {
    return res.status(400).json({ error: 'Invalid delivery id' });
  }
  const supabase = getSupabase();
  try {
    // Idempotente: un segundo acuse del mismo dispositivo no cambia nada.
    const { error } = await supabase
      .from(LOGS_TABLE)
      .update({ delivered_at: new Date().toISOString() })
      .eq('delivery_id', delivery)
      .is('delivered_at', null);
    if (error) throw error;
    return res.status(200).json({ success: true });
  } catch (err) {
    if (missingDeliveryColumns(res, err) || missingRemindersTable(res, err)) return;
    console.error('[api/push/ack] error:', err.message);
    return res.status(500).json({ error: 'Could not record delivery' });
  }
}

// ==========================================
// NOTIFY ADMIN — avisa a los admins de lo que ella hace (migración 024)
// ==========================================
// Lo llama el cliente de la usuaria. Dos decisiones que importan:
//
//   · La CLASE la elige el cliente (sabe si es el primer estado del día, una
//     corrección rápida o un estado nuevo que sustituye al anterior), pero el
//     CONTENIDO lo lee el servidor de la base: no se fía del cuerpo.
//   · El interruptor de cada clase lo pone el ADMIN en sus propias
//     preferencias: es su teléfono el que suena, así que decide él cuánto
//     quiere que le avise. El silencio nocturno NO descarta estos avisos —los
//     convertiría en avisos perdidos, cuando el evento ya ocurrió—: el service
//     worker los muestra sin sonido dentro de esa franja y quedan ahí.
async function handleNotifyAdmin(req, res) {
  const user = await authenticate(req, res);
  if (!user) return;

  if (requirePushTransport(res)) return;

  // Una clase desconocida (o ausente) cae a 'mood': el cliente antiguo sigue
  // funcionando sin cambio alguno.
  const kind = ADMIN_ALERT_KINDS.includes(req.body?.kind) ? req.body.kind : 'mood';

  const supabase = getSupabase();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  // El admin no se avisa a sí mismo
  if (profile?.role === 'admin') {
    return res.status(200).json({ success: true, sent: 0, skipped: true, reason: 'Admin event' });
  }

  // Sin la migración del ciclo aplicada la lectura falla con 42P01; el aviso
  // se salta en silencio en vez de devolver un 500 que parecería un fallo.
  const missingTables = new Set(['42P01', '42883']);

  let alert;
  if (kind === 'cycle_period') {
    const { data: period, error } = await supabase
      .from('cycle_periods')
      .select('start_date, end_date')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error && missingTables.has(error.code)) {
      return res.status(200).json({ success: true, sent: 0, skipped: true, reason: 'No cycle tables' });
    }
    if (error) throw error;
    if (!period) return res.status(404).json({ error: 'No cycle period found' });
    alert = adminCyclePeriodPayload(period);
  } else if (kind === 'cycle_share') {
    const { data: sharing, error } = await supabase
      .from('cycle_sharing')
      .select('sharing_enabled, shared_fields')
      .eq('owner_id', user.id)
      .maybeSingle();
    if (error && missingTables.has(error.code)) {
      return res.status(200).json({ success: true, sent: 0, skipped: true, reason: 'No cycle tables' });
    }
    if (error) throw error;
    if (!sharing?.sharing_enabled) {
      return res.status(200).json({ success: true, sent: 0, skipped: true, reason: 'Not sharing' });
    }
    alert = adminCycleSharePayload(sharing);
  } else if (kind === 'cycle_log') {
    const { data: log, error } = await supabase
      .from('cycle_daily_logs')
      .select('log_date, flow, spotting, symptoms, notes')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error && missingTables.has(error.code)) {
      return res.status(200).json({ success: true, sent: 0, skipped: true, reason: 'No cycle tables' });
    }
    if (error) throw error;
    if (!log) return res.status(404).json({ error: 'No cycle log found' });
    alert = adminCycleLogPayload(log);
  } else if (kind === 'note') {
    const text = await lastMaldiaNote(supabase, user.id);
    if (text === null) {
      return res.status(404).json({ error: 'No maldia note found' });
    }
    alert = adminNotePayload(text);
  } else {
    const { data: mood, error: moodError } = await supabase
      .from('moods')
      .select('label, emoji, score')
      .eq('user_id', user.id)
      .eq('date', todayServerStr())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (moodError) throw moodError;
    if (!mood) {
      return res.status(404).json({ error: 'No mood registered today' });
    }
    // Corrección rápida (dentro de la ventana de 5 min de mood.store): se
    // avisa igual que cualquier otro cambio. Antes se silenciaba salvo que
    // aterrizara en un mal día, y eso dejaba al admin con el estado viejo en
    // la cabeza cuando ella lo corregía. El aviso lleva el estado nuevo.
    alert = adminMoodPayload(mood, kind);
  }

  const { data: admins, error: adminsError } = await supabase
    .from('profiles')
    .select('id, enabled')
    .eq('role', 'admin');
  if (adminsError) throw adminsError;
  const adminIds = (admins || []).filter(a => a.enabled !== false).map(a => a.id);
  const adminIdSet = new Set(adminIds);

  const allSubscriptions = await getSubscriptions();
  const adminSubscriptions = allSubscriptions.filter(s => adminIdSet.has(s.userId));
  const nativeCandidates = await getNativeUserIds(adminIds);

  const prefsById = await loadPrefsByIds(adminIds);
  const { allowed, quiet, off } = splitRecipients(
    adminSubscriptions,
    prefsById,
    new Date(),
    adminAlertPrefFor(kind)
  );
  // En silencio se incluye: el service worker ya lo silencia en el dispositivo.
  const recipients = [...allowed, ...quiet];
  const native = splitRecipients(
    nativeCandidates.map(userId => ({ userId })),
    prefsById,
    new Date(),
    adminAlertPrefFor(kind)
  );
  const webUserIds = new Set(adminSubscriptions.map(sub => String(sub.userId)));
  const nativeOnly = native.allowed
    .map(row => String(row.userId))
    .filter(userId => !webUserIds.has(userId));
  if (recipients.length === 0 && nativeOnly.length === 0) {
    return res
      .status(200)
      .json({ success: true, sent: 0, filtered: off.length, message: 'Admin alert off' });
  }

  const payload = JSON.stringify({ ...alert, timestamp: Date.now() });
  const { results, expired } = await deliverPush(recipients, payload, null, nativeOnly);
  if (expired.length > 0) {
    await saveSubscriptions(allSubscriptions.filter(s => !expired.includes(s.endpoint)));
  }

  return res.status(200).json({ success: true, filtered: off.length, ...results });
}

/**
 * ANNOUNCE — el admin publica contenido y ella se entera al momento.
 *
 * La dirección es una sola: admin → ella. Los admins que publican no se
 * avisan a sí mismos de lo que acaban de escribir.
 *
 * El tipo lo elige el panel (lista cerrada) y el texto lo compone el servidor:
 * el cuerpo de la petición no puede inventar un mensaje ni un destino fuera de
 * la app. El interruptor es el que ya existe para esa clase de contenido.
 *
 * Dentro del silencio no suena nada —ni siquiera en silencio, porque un aviso
 * de «hay contenido nuevo» a las 3:00 no aporta nada que no esté al abrir— y
 * la respuesta lo dice con `quiet`/`until` para que el panel pueda explicarlo.
 */
async function handleAnnounce(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  if (requirePushTransport(res)) return;

  const kind = ANNOUNCE_KINDS.includes(req.body?.kind) ? req.body.kind : null;
  if (!kind) {
    return res.status(400).json({ error: 'Invalid kind', allowed: ANNOUNCE_KINDS });
  }

  const alert = announcePayload(kind, {
    count: req.body?.count,
    section: req.body?.section,
    url: req.body?.url,
    newCategory: req.body?.newCategory === true,
    category: req.body?.category,
    updated: req.body?.updated === true,
  });

  const supabase = getSupabase();
  const { data: admins, error: adminsError } = await supabase
    .from('profiles')
    .select('id, role, enabled')
    .eq('role', 'admin');
  if (adminsError) throw adminsError;
  const adminIds = new Set((admins || []).map(a => String(a.id)));

  const all = await excludeDisabledUsers(await getSubscriptions());
  const recipients = all.filter(sub => !adminIds.has(String(sub.userId)));
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, role, enabled');
  if (profilesError) throw profilesError;
  const eligibleUsers = (profiles || [])
    .filter(row => row.enabled !== false && row.role !== 'admin')
    .map(row => row.id);
  const nativeCandidates = await getNativeUserIds(eligibleUsers);

  const now = new Date();
  const prefsById = await loadPrefsByIds([
    ...new Set([...recipients.map(s => String(s.userId)), ...nativeCandidates]),
  ]);
  const { allowed, quiet, off } = splitRecipients(recipients, prefsById, now, ANNOUNCE_PREF[kind]);
  const native = splitRecipients(
    nativeCandidates.map(userId => ({ userId })),
    prefsById,
    now,
    ANNOUNCE_PREF[kind]
  );
  const webUserIds = new Set(recipients.map(sub => String(sub.userId)));
  const nativeOnly = native.allowed
    .map(row => String(row.userId))
    .filter(userId => !webUserIds.has(userId));

  if (allowed.length === 0 && nativeOnly.length === 0) {
    return res.status(200).json({
      success: true,
      sent: 0,
      quiet: quiet.length,
      until: deferUntilFor(quiet, prefsById, now),
      filtered: off.length,
      message: quiet.length > 0 ? 'Quiet hours' : 'Announcement off',
    });
  }

  const payload = JSON.stringify({ ...alert, timestamp: Date.now() });
  const { results, expired } = await deliverPush(allowed, payload, null, nativeOnly);
  if (expired.length > 0) {
    await saveSubscriptions(all.filter(s => !expired.includes(s.endpoint)));
  }

  return res.status(200).json({
    success: true,
    ...results,
    quiet: quiet.length,
    filtered: off.length,
  });
}

/**
 * Último texto que ella dejó en Mal Día (`user_progress` type='maldia_notes',
 * ver `saveMaldiaNote` en db.service.js), o null si no hay ninguno.
 * Se lee de la base a propósito: el aviso no repite lo que traiga el cuerpo de
 * la petición, igual que el de ánimo no se fía del título.
 */
async function lastMaldiaNote(supabase, userId) {
  const { data, error } = await supabase
    .from('user_progress')
    .select('data')
    .eq('user_id', userId)
    .eq('type', MALDIA_NOTES_TYPE)
    .maybeSingle();
  if (error || !Array.isArray(data?.data)) return null;
  const notes = data.data.filter(n => n && typeof n.text === 'string' && n.text.trim());
  if (notes.length === 0) return null;
  // La más reciente por marca de tiempo; si el dato es antiguo y no la trae,
  // se queda la última de la lista, que es el orden en que se escriben.
  const newest = notes.reduce(
    (best, n) => (Date.parse(n.createdAt) > Date.parse(best.createdAt) ? n : best),
    notes[0]
  );
  return newest.text.trim();
}

/**
 * Aviso técnico al admin (024) cuando un envío falla o se retiran
 * suscripciones caducadas. Es mantenimiento, así que va SOLO al admin.
 *
 * Nunca lanza: quien lo llama (el envío) no puede caerse porque falle el
 * aviso sobre sí mismo. Solo avisa si hay algo que contar, para que no se
 * convierta en un aviso que siempre llega y que nadie lee.
 */
async function notifyAdminsOfHealth(summary) {
  const failed = Number(summary?.failed) || 0;
  const removed = Number(summary?.removed) || 0;
  if (failed === 0 && removed === 0) return null;
  if (!fcmConfigured() && (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || vapidConfigError)) return null;
  try {
    const supabase = getSupabase();
    const { data: admins, error } = await supabase
      .from('profiles')
      .select('id, enabled')
      .eq('role', 'admin');
    if (error) return null;
    const adminIds = (admins || []).filter(a => a.enabled !== false).map(a => a.id);
    if (adminIds.length === 0) return null;

    const allSubscriptions = await getSubscriptions();
    const adminSubscriptions = allSubscriptions.filter(s => adminIds.includes(s.userId));
    const nativeCandidates = await getNativeUserIds(adminIds);

    const prefsById = await loadPrefsByIds(adminIds);
    const { allowed, quiet } = splitRecipients(
      adminSubscriptions,
      prefsById,
      new Date(),
      adminAlertPrefFor('health')
    );
    const recipients = [...allowed, ...quiet];
    const webUserIds = new Set(adminSubscriptions.map(sub => String(sub.userId)));
    const nativeOnly = nativeCandidates
      .filter(id => prefsById.get(String(id))?.adminHealth !== false)
      .filter(id => !webUserIds.has(String(id)));
    if (recipients.length === 0 && nativeOnly.length === 0) return null;

    const payload = JSON.stringify({ ...adminHealthPayload(summary), timestamp: Date.now() });
    await deliverPush(recipients, payload, null, nativeOnly);
    return true;
  } catch (err) {
    console.warn('[api/push] no se pudo avisar de los fallos:', err?.message);
    return null;
  }
} /**
 * Envía a cada suscripción y devuelve los endpoints caducados.
 * El payload puede ser una cadena o una función de la suscripción.
 */
async function deliverPush(subscriptions, payload, onResult, additionalFcmUserIds = []) {
  const results = { sent: 0, failed: 0, removed: 0, nativeSent: 0, nativeFailed: 0 };
  const expired = [];
  // El payload puede depender del destinatario (un token de acuse por
  // dispositivo). Acepta una cadena —lo normal— o una función de la suscripción.
  const payloadFor = typeof payload === 'function' ? payload : () => payload;
  const webConfigured = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && !vapidConfigError);
  for (const sub of webConfigured ? subscriptions : []) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payloadFor(sub));
      results.sent++;
      // Se espera a cada resultado: quien lo recibe cierra su fila del historial
      // antes de pasar al siguiente dispositivo.
      if (onResult) await onResult(sub, null);
    } catch (err) {
      // 410/404: la suscripción caducó. 403 con cambio de clave VAPID: nació
      // con otra clave y no puede recibir nunca más. En ambos casos se retira.
      if (err.statusCode === 410 || err.statusCode === 404 || isVapidMismatchError(err)) {
        results.removed++;
        expired.push(sub.endpoint);
        if (onResult) {
          await onResult(sub, {
            expired: true,
            error: isVapidMismatchError(err) ? 'vapid_mismatch' : String(err.statusCode),
          });
        }
      } else {
        results.failed++;
        if (onResult)
          await onResult(sub, {
            expired: false,
            error: String(err.statusCode || err.message || 'push_error'),
          });
      }
    }
  }
  // El mismo aviso, también a la app Android. Es un canal aparte: que falle
  // FCM no invalida lo que ya salió por Web Push.
  const fcmUserIds = [
    ...(subscriptions || []).map(sub => sub.userId),
    ...(additionalFcmUserIds || []),
  ];
  const nativeResults = await deliverFcmForUsers(fcmUserIds, payloadFor).catch(err => {
    console.error('[fcm] no se pudo completar el envío:', err?.message || err);
    return null;
  });
  if (nativeResults) {
    results.nativeSent = Number(nativeResults.sent) || 0;
    results.nativeFailed = Number(nativeResults.failed) || 0;
  }
  return { results, expired };
}

/**
 * Envía el aviso a los tokens FCM de los dueños de esas suscripciones.
 *
 * El payload de Web Push puede depender del dispositivo (el `delivery_id`
 * del acuse). Un mensaje nativo no tiene ese canal de vuelta, así que se
 * compone uno genérico: sirve igual para el texto y la URL.
 */
async function deliverFcmForUsers(userIds, payloadFor) {
  if (!fcmConfigured()) return null;
  const uniqueIds = [...new Set((userIds || []).map(id => String(id || '')).filter(Boolean))];
  if (uniqueIds.length === 0) return null;

  let payload;
  try {
    const raw = payloadFor({ userId: uniqueIds[0], endpoint: 'fcm', keys: null });
    payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }

  return sendTokensToUsers(uniqueIds, payload);
}

/** Lee los tokens activos de esos usuarios, envía y borra los caducados. */
async function sendTokensToUsers(userIds, payload) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('push_tokens')
    .select('token')
    .in('user_id', userIds)
    .eq('enabled', true);

  // 42P01: migración 026 sin aplicar. La app sigue con Web Push.
  if (error) return null;

  const tokens = (data || []).map(row => row.token).filter(Boolean);
  if (tokens.length === 0) return null;

  const result = await sendFcmToTokens(tokens, payload);
  if (result.removed?.length) {
    await supabase.from('push_tokens').delete().in('token', result.removed);
  }
  return result;
}

/** Tokens FCM activos que pertenecen a las cuentas habilitadas indicadas. */
async function getNativeUserIds(userIds) {
  const candidates = [...new Set((userIds || []).map(id => String(id || '')).filter(Boolean))];
  if (!fcmConfigured() || candidates.length === 0) return [];
  const { data, error } = await getSupabase()
    .from('push_tokens')
    .select('user_id')
    .in('user_id', candidates)
    .eq('enabled', true);
  if (error) {
    if (['42P01', 'PGRST205'].includes(error.code)) return [];
    throw error;
  }
  return [...new Set((data || []).map(row => String(row.user_id || '')).filter(Boolean))];
}

/** Usuarios habilitados con token nativo, para envíos programados generales. */
async function getEnabledNativeUserIds() {
  if (!fcmConfigured()) return [];
  const { data, error } = await getSupabase().from('profiles').select('id, enabled');
  if (error) throw error;
  const enabledIds = (data || []).filter(row => row.enabled !== false).map(row => row.id);
  return getNativeUserIds(enabledIds);
}

// ==========================================
// RECORDATORIOS — avisos programados (migración 022)
// ==========================================
// Un recordatorio lo escribe el admin en el panel y lo envía el servidor
// cuando toca, sin depender de que alguien tenga la app abierta.
//
// QUIÉN LO DISPARA: /api/push?action=run-reminders, que acepta el CRON_SECRET
// o una sesión de admin. El programador periódico (Supabase pg_cron, ver
// SUPABASE-SETUP.md §4) lo llama cada minuto; el cron diario de Vercel los
// vacía también al pasar por action=send, así que los recordatorios no se
// quedan muertos si pg_cron no está configurado.
//
// A QUIÉN LLEGA: a las cuentas habilitadas (`profiles.enabled`) que no hayan
// apagado los recordatorios ni estén en su horario de silencio (023).
// Si el momento cae dentro del silencio de todos los destinatarios, la
// ocurrencia se APLAZA al fin del silencio en vez de gastarse: con una sola
// ejecución, un aviso que caiga de noche no llegaría nunca.

/** Respuesta clara cuando la migración 022 todavía no está aplicada. */
function missingRemindersTable(res, err) {
  if (err?.code !== '42P01') return false;
  res.status(503).json({
    error:
      'Los recordatorios necesitan la migración sql/022_push_reminders.sql aplicada en Supabase',
  });
  return true;
}

/**
 * Quita de la lista las cuentas deshabilitadas (`profiles.enabled` es la
 * fuente de verdad desde 017). Si no se puede leer, se entrega a todas antes
 * que callar un aviso por un fallo de lectura.
 */
async function excludeDisabledUsers(subscriptions) {
  if (subscriptions.length === 0) return subscriptions;
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('profiles').select('id').eq('enabled', false);
    if (error) return subscriptions;
    const disabled = new Set((data || []).map(row => String(row.id)));
    return subscriptions.filter(sub => !disabled.has(String(sub.userId)));
  } catch {
    return subscriptions;
  }
}

/**
 * Historial de envíos. Un fallo al registrar no puede tumbar el envío.
 *
 * Devuelve si la fila quedó escrita, porque quien lo llama necesita saberlo:
 * el registro previo al envío (con token de acuse) solo sirve si de verdad se
 * guardó. `allowLegacy` permite caer al registro sin token cuando la 025
 * todavía no está aplicada — el código puede desplegarse antes o después del
 * SQL sin perder el historial, igual que con la 018.
 */
async function logReminderPush(entries, { allowLegacy = false } = {}) {
  if (entries.length === 0) return true;
  const supabase = getSupabase();
  try {
    const { error } = await supabase.from(LOGS_TABLE).insert(entries);
    if (!error) return true;

    // 42703 = la columna del token (025) no existe todavía.
    if (allowLegacy && error.code === '42703') {
      const sinToken = entries.map(entry => {
        const copia = { ...entry };
        delete copia.delivery_id;
        return copia;
      });
      const { error: retryError } = await supabase.from(LOGS_TABLE).insert(sinToken);
      if (retryError) console.warn('[api/push] no se pudo registrar el envío:', retryError.message);
      return !retryError;
    }

    console.warn('[api/push] no se pudo registrar el envío:', error.message);
    return false;
  } catch (err) {
    console.warn('[api/push] no se pudo registrar el envío:', err.message);
    return false;
  }
}

/**
 * Payload de un recordatorio. El tag propio hace que dos iguales se reemplacen.
 *
 * `deliveryId` es el token de acuse (025): viaja con el aviso y el dispositivo
 * lo devuelve al recibirlo, que es lo único que convierte «enviado» en
 * «entregado». Es distinto para cada dispositivo a propósito: que le llegue al
 * móvil no significa que le haya llegado al portátil.
 */
function reminderPayload(reminder, deliveryId) {
  return JSON.stringify({
    title: reminder.title,
    body: reminder.body,
    url: reminder.target_url || '/',
    tag: `reminder-${reminder.id}`,
    ...(deliveryId ? { delivery: deliveryId } : {}),
    timestamp: Date.now(),
  });
}

/**
 * Envía un recordatorio y deja el registro de cada dispositivo.
 *
 * `skipped` son los destinatarios que no lo reciben (silencio o tipo
 * apagado): se registran igual, para poder explicar en el panel por qué a
 * alguien no le llegó, que es justo lo que antes no se sabía.
 */
async function deliverReminder(reminder, subscriptions, skipped = [], additionalFcmUserIds = []) {
  const entries = skipped.map(({ sub, reason }) => ({
    reminder_id: reminder.id,
    user_id: sub.userId,
    endpoint: sub.endpoint,
    status: 'skipped',
    error: reason,
  }));
  // Un token de acuse por dispositivo: el payload lo lleva y la fila del
  // historial lo guarda, así que cuando el dispositivo confirme se sabe
  // exactamente qué envío marcar como entregado.
  const deliveries = new Map();
  for (const sub of subscriptions) deliveries.set(sub.endpoint, randomUUID());

  // El historial se escribe ANTES de enviar, con el envío aún sin resolver
  // ('queued'). No es un adorno: el acuse del dispositivo llega en cuanto el
  // push se muestra, y si la fila se creara después del envío el acuse no
  // encontraría nada que marcar y la confirmación se perdería para siempre.
  // Si el proceso muere a mitad, la fila se queda en 'queued' — que es la
  // verdad: no se sabe si llegó a salir.
  const registroPrevio = await logReminderPush([
    ...entries,
    ...subscriptions.map(sub => ({
      reminder_id: reminder.id,
      user_id: sub.userId,
      endpoint: sub.endpoint,
      status: 'queued',
      error: null,
      delivery_id: deliveries.get(sub.endpoint),
    })),
  ]);

  const { results, expired } = await deliverPush(
    subscriptions,
    sub => reminderPayload(reminder, deliveries.get(sub.endpoint)),
    // Con el registro previo hecho, cada fila se cierra con el resultado de SU
    // dispositivo. Si no se pudo registrar antes (025 sin aplicar), se acumula
    // y se registra al final con el estado definitivo y sin token: la forma de
    // antes, que no pierde el historial.
    (sub, failure) =>
      registroPrevio
        ? settleDelivery(deliveries.get(sub.endpoint), failure)
        : Promise.resolve(
            entries.push({
              reminder_id: reminder.id,
              user_id: sub.userId,
              endpoint: sub.endpoint,
              status: failure ? 'failed' : 'sent',
              error: failure ? failure.error : null,
            })
          ),
    additionalFcmUserIds
  );

  if (!registroPrevio) await logReminderPush(entries, { allowLegacy: true });
  return { results, expired };
}

/**
 * Cierra una fila del historial con el resultado real de su envío.
 *
 * Se actualiza por token y una fila cada vez, justo después del envío de ese
 * dispositivo: así el estado final es el de ESE envío y no el del lote. Un
 * fallo al escribir no puede tumbar el envío, solo deja la fila en 'queued'.
 */
async function settleDelivery(deliveryId, failure) {
  if (!deliveryId) return;
  try {
    const { error } = await getSupabase()
      .from(LOGS_TABLE)
      .update({
        status: failure ? 'failed' : 'sent',
        error: failure ? failure.error : null,
      })
      .eq('delivery_id', deliveryId);
    if (error) console.warn('[api/push] no se pudo cerrar el registro del envío:', error.message);
  } catch (err) {
    console.warn('[api/push] no se pudo cerrar el registro del envío:', err?.message);
  }
}

/**
 * Preferencias por usuario para decidir a quién se envía.
 * Sin tabla (023 sin aplicar) o sin red devuelve un mapa vacío, y un mapa
 * vacío significa «entregar»: una lectura que falla nunca silencia a nadie.
 */
async function loadPrefsByIds(userIds) {
  const prefsById = new Map();
  if (userIds.length === 0) return prefsById;
  try {
    // Las columnas `admin_*` son de la 024: si todavía no está aplicada, la
    // lectura falla (42703) y el mapa vuelve vacío, que significa «entregar».
    const { data, error } = await getSupabase()
      .from(PREFS_TABLE)
      .select(
        'user_id, daily, letters, moods, reminders, admin_mood, admin_mood_changes, admin_notes, admin_cycle, admin_health, quiet_from, quiet_to'
      )
      .in('user_id', userIds);
    if (error) return prefsById;
    (data || []).forEach(row =>
      prefsById.set(String(row.user_id), {
        daily: row.daily,
        letters: row.letters,
        moods: row.moods,
        reminders: row.reminders,
        adminMood: row.admin_mood,
        adminMoodChanges: row.admin_mood_changes,
        adminNotes: row.admin_notes,
        adminCycle: row.admin_cycle,
        adminHealth: row.admin_health,
        quietFrom: row.quiet_from,
        quietTo: row.quiet_to,
      })
    );
  } catch {
    return prefsById;
  }
  return prefsById;
}

/**
 * Envía los recordatorios vencidos y reprograma cada uno.
 *
 * El orden importa: cada recordatorio se reprograma (o se desactiva, si era
 * de una sola vez) ANTES de enviar. Si dos ejecuciones se solapan, la
 * segunda ya no lo encuentra vencido y nadie recibe el aviso dos veces.
 */
async function runDueReminders(now = new Date()) {
  const supabase = getSupabase();
  const summary = {
    reminders: 0,
    sent: 0,
    failed: 0,
    removed: 0,
    skipped: 0,
    deferred: 0,
    filtered: 0,
  };

  const { data: pending, error } = await supabase
    .from(REMINDERS_TABLE)
    .select('*')
    .eq('active', true)
    .lte('next_run_at', now.toISOString())
    .order('next_run_at', { ascending: true })
    .limit(100);
  if (error) throw error;

  const due = dueReminders(pending, now);
  if (due.length === 0) return summary;

  // `all` es la lista completa: al limpiar caducados se guarda esta, no la
  // filtrada, o el filtro de cuentas deshabilitadas borraría sus suscripciones.
  const all = await getSubscriptions();
  let subscriptions = await excludeDisabledUsers(all);
  const nativeCandidates = await getEnabledNativeUserIds();
  const prefsById = await loadPrefsByIds([
    ...new Set([...subscriptions.map(sub => String(sub.userId)), ...nativeCandidates]),
  ]);

  for (const reminder of due) {
    const stamp = new Date().toISOString();
    const { allowed, quiet, off } = splitRecipients(subscriptions, prefsById, now, 'reminders');
    const native = splitRecipients(
      nativeCandidates.map(userId => ({ userId })),
      prefsById,
      now,
      'reminders'
    );
    const webUserIds = new Set(subscriptions.map(sub => String(sub.userId)));
    const nativeOnly = native.allowed
      .map(row => String(row.userId))
      .filter(userId => !webUserIds.has(userId));
    const allQuiet = allowed.length === 0 && nativeOnly.length === 0 && quiet.length + native.quiet.length > 0;

    // Nadie puede recibirlo ahora y el motivo es el silencio: la ocurrencia
    // se aplaza SIN gastarse. Al contrario, un recordatorio de una sola vez
    // que caiga dentro del silencio no llegaría nunca.
    if (allQuiet) {
      const until = deferUntilFor([...quiet, ...native.quiet], prefsById, now);
      if (until && Date.parse(until) > now.getTime()) {
        const { error: deferError } = await supabase
          .from(REMINDERS_TABLE)
          .update({ next_run_at: until, updated_at: stamp })
          .eq('id', reminder.id);
        if (deferError) {
          console.error('[api/push] no se pudo aplazar el recordatorio:', deferError.message);
          summary.failed++;
          continue;
        }
        summary.deferred++;
        continue;
      }
    }

    // Reprogramar (o apagar, si era de una sola vez) ANTES de enviar.
    const nextRunAt = nextRunFor(reminder.next_run_at, reminder.recurrence, now);
    const { error: updateError } = await supabase
      .from(REMINDERS_TABLE)
      .update(
        nextRunAt
          ? { next_run_at: nextRunAt, updated_at: stamp }
          : { active: false, updated_at: stamp }
      )
      .eq('id', reminder.id);
    if (updateError) {
      console.error('[api/push] no se pudo reprogramar el recordatorio:', updateError.message);
      summary.failed++;
      continue;
    }

    summary.reminders++;
    summary.filtered += quiet.length + off.length + native.quiet.length + native.off.length;

    if (allowed.length === 0 && nativeOnly.length === 0) {
      summary.skipped++;
      continue;
    }

    const skipped = [
      ...quiet.map(sub => ({ sub, reason: 'quiet_hours' })),
      ...off.map(sub => ({ sub, reason: 'prefs_off' })),
    ];
    const { results, expired } = await deliverReminder(reminder, allowed, skipped, nativeOnly);
    summary.sent += results.sent;
    summary.failed += results.failed;
    summary.removed += results.removed;

    if (expired.length > 0) {
      subscriptions = subscriptions.filter(sub => !expired.includes(sub.endpoint));
      await saveSubscriptions(all.filter(sub => !expired.includes(sub.endpoint)));
    }
  }

  return summary;
}

// ==========================================
// RUN REMINDERS — envía los vencidos (cron o admin)
// ==========================================
async function handleRunReminders(req, res) {
  if (!cronSecretMatches(req)) {
    const user = await requireAdmin(req, res);
    if (!user) return; // ya respondió con el error
  }

  if (requirePushTransport(res)) return;

  try {
    const summary = await runDueReminders();
    // Un fallo real (no «no había nada que enviar») se avisa al admin: es la
    // única forma de que se entere de que un recordatorio no llegó.
    await notifyAdminsOfHealth(summary);
    return res.status(200).json({ success: true, ...summary });
  } catch (err) {
    if (missingRemindersTable(res, err)) return;
    console.error('[api/push/run-reminders] error:', err.message);
    return res.status(500).json({ error: 'No se pudieron enviar los recordatorios' });
  }
}

// ==========================================
// REMINDERS — alta, edición, baja y envío inmediato (admin)
// ==========================================
async function handleReminders(req, res) {
  const user = await requireAdmin(req, res);
  if (!user) return; // ya respondió con el error

  const supabase = getSupabase();

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from(REMINDERS_TABLE)
        .select(
          'id, title, body, target_url, scheduled_at, recurrence, active, next_run_at, created_at'
        )
        .order('next_run_at', { ascending: true })
        .limit(200);
      if (error) throw error;

      // Los últimos envíos, para poder ver si algo no llegó sin abrir los
      // logs de Vercel. El panel los cruza con la lista de recordatorios.
      // Sin la 025 aplicada (42703) se cae al SELECT de antes: la lista se ve
      // igual, solo que sin la confirmación del dispositivo.
      let { data: logs, error: logsError } = await supabase
        .from(LOGS_TABLE)
        .select('reminder_id, status, error, sent_at, delivered_at')
        .order('sent_at', { ascending: false })
        .limit(30);
      if (logsError?.code === '42703') {
        ({ data: logs } = await supabase
          .from(LOGS_TABLE)
          .select('reminder_id, status, error, sent_at')
          .order('sent_at', { ascending: false })
          .limit(30));
      }

      return res.status(200).json({ success: true, reminders: data || [], logs: logs || [] });
    }

    const action = req.body?.action || 'create';
    const id = req.body?.id;
    const stamp = new Date().toISOString();

    if (action === 'delete') {
      if (!id) return res.status(400).json({ error: 'Falta el id del recordatorio' });
      const { error } = await supabase.from(REMINDERS_TABLE).delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    if (action === 'toggle') {
      if (!id) return res.status(400).json({ error: 'Falta el id del recordatorio' });
      const { data: current, error: readError } = await supabase
        .from(REMINDERS_TABLE)
        .select('id, next_run_at, recurrence')
        .eq('id', id)
        .maybeSingle();
      if (readError) throw readError;
      if (!current) return res.status(404).json({ error: 'Ese recordatorio no existe' });

      const active = req.body?.active === true;
      const patch = { active, updated_at: stamp };
      // Reactivar algo cuya hora ya pasó no debe disparar el aviso de ayer:
      // un diario o semanal salta a su siguiente ocurrencia. Uno de una sola
      // vez se queda como está — encenderlo es justo pedirlo.
      if (active && Date.parse(current.next_run_at) <= Date.now()) {
        const next = nextRunFor(current.next_run_at, current.recurrence);
        if (next) patch.next_run_at = next;
      }

      const { error } = await supabase.from(REMINDERS_TABLE).update(patch).eq('id', id);
      if (error) throw error;
      return res.status(200).json({ success: true, active });
    }

    if (action === 'run') {
      if (!id) return res.status(400).json({ error: 'Falta el id del recordatorio' });
      if (requirePushTransport(res)) return;
      const { data: reminder, error: readError } = await supabase
        .from(REMINDERS_TABLE)
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (readError) throw readError;
      if (!reminder) return res.status(404).json({ error: 'Ese recordatorio no existe' });

      const subscriptions = await excludeDisabledUsers(await getSubscriptions());
      const nativeCandidates = await getEnabledNativeUserIds();
      const webUserIds = new Set(subscriptions.map(sub => String(sub.userId)));
      const nativeOnly = nativeCandidates.filter(id => !webUserIds.has(String(id)));
      if (subscriptions.length === 0 && nativeOnly.length === 0) {
        return res
          .status(200)
          .json({
            success: true,
            sent: 0,
            failed: 0,
            removed: 0,
            message: 'No hay dispositivos suscritos',
          });
      }

      // Enviarlo a mano no toca su calendario: la programación sigue igual.
      const { results } = await deliverReminder(reminder, subscriptions, [], nativeOnly);
      return res.status(200).json({ success: true, ...results });
    }

    if (action !== 'create' && action !== 'update') {
      return res
        .status(400)
        .json({ error: 'Invalid action. Use: create, update, toggle, delete, run' });
    }
    if (action === 'update' && !id) {
      return res.status(400).json({ error: 'Falta el id del recordatorio' });
    }

    const clean = cleanReminderInput(req.body || {});
    if (!clean.ok) return res.status(400).json({ error: clean.error });
    const { title, body, targetUrl, recurrence, scheduledAt } = clean.value;

    const row = {
      title,
      body,
      target_url: targetUrl,
      recurrence,
      scheduled_at: scheduledAt,
      // Editar fija la próxima ejecución en la fecha del formulario: es la
      // que el admin acaba de elegir. Encender o apagar es `toggle`.
      next_run_at: scheduledAt,
      updated_at: stamp,
    };
    if (typeof req.body?.active === 'boolean') row.active = req.body.active;

    if (action === 'create') {
      row.active = row.active !== false;
      row.created_by = user.id;
      const { data, error } = await supabase
        .from(REMINDERS_TABLE)
        .insert(row)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      return res.status(200).json({ success: true, id: data?.id || null });
    }

    const { error } = await supabase.from(REMINDERS_TABLE).update(row).eq('id', id);
    if (error) throw error;
    return res.status(200).json({ success: true });
  } catch (err) {
    if (missingRemindersTable(res, err)) return;
    console.error('[api/push/reminders] error:', err.message);
    return res.status(500).json({ error: 'No se pudieron guardar los recordatorios' });
  }
}

// ==========================================
// SEND — Envía push a todas las subscripciones
// Llamado por cron job diario a las 8:00 AM
// ==========================================
async function handleSend(req, res) {
  // Proteger con secret simple (no crítico para notificaciones anónimas,
  // pero evita abuso)
  const cronSecret =
    req.headers['x-cron-secret'] || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const expectedSecret = process.env.CRON_SECRET;

  // También permitir llamadas autenticadas por admin
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s*/i, '');
  let isAdmin = false;

  if (token) {
    try {
      const supabase = getSupabase();
      const {
        data: { user },
      } = await supabase.auth.getUser(token);
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, enabled')
          .eq('id', user.id)
          .maybeSingle();
        // Mismo criterio que public.is_admin() (017): rol admin, email
        // confirmado y cuenta habilitada.
        isAdmin =
          profile?.role === 'admin' &&
          profile?.enabled !== false &&
          !!(user.email_confirmed_at || user.confirmed_at);
      }
    } catch {
      /* not authenticated */
    }
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

  const manual = isAdmin && req.method === 'POST' && (req.body?.title != null || req.body?.body != null);
  const customTitle = manual && typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const customBody = manual && typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  if (manual && (!customTitle || !customBody || customTitle.length > 100 || customBody.length > 500)) {
    return res.status(400).json({ error: 'Escribe un título de hasta 100 caracteres y un mensaje de hasta 500.' });
  }

  // Recordatorios vencidos (022) ANTES de la ventana horaria: su hora la elige
  // el admin, no el reloj, así que no se descartan por caer fuera de las
  // 07:00–08:00. Así el cron diario de Vercel los vacía aunque Supabase
  // pg_cron no esté configurado. Un fallo aquí no puede impedir el saludo.
  let reminders = null;
  if (!manual) {
    try {
      reminders = await runDueReminders();
      await notifyAdminsOfHealth(reminders);
    } catch (err) {
      console.warn('[api/push/send] recordatorios no procesados:', err.message);
    }
  }

  // Vercel Hobby solo permite un cron diario. La ejecución está fijada a
  // 06:00 UTC: equivale a 08:00 en verano y 07:00 en invierno en Madrid.
  // Aceptamos ambas horas para que la notificación no se pierda por DST.
  if (!isAdmin && ![7, 8].includes(hourInSpain())) {
    return res
      .status(200)
      .json({ success: true, skipped: true, reason: 'Outside delivery window', reminders });
  }

  if (!manual && requirePushTransport(res)) return;

  const allSubscriptions = await getSubscriptions();
  const webConfigured = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && !vapidConfigError);
  const androidConfigured = fcmConfigured();
  let nativeCandidates = await getEnabledNativeUserIds();
  let availableSubscriptions = allSubscriptions;
  if (manual) {
    const supabase = getSupabase();
    const { data: profiles, error } = await supabase.from('profiles').select('id').eq('enabled', true);
    if (error) throw error;
    const enabled = new Set((profiles || []).map(row => row.id));
    availableSubscriptions = allSubscriptions.filter(subscription => enabled.has(subscription.userId));
    nativeCandidates = nativeCandidates.filter(id => enabled.has(id));
  }

  if (!manual && allSubscriptions.length === 0 && nativeCandidates.length === 0) {
    return res.status(200).json({ success: true, sent: 0, message: 'No subscriptions', reminders });
  }

  // A quién le toca (023). Este aviso es el «Recordatorio diario» del perfil,
  // así que quien lo tenga apagado no lo recibe: era el caso raro de un ajuste
  // visible que el servidor ignoraba.
  //
  // El silencio solo se respeta en el envío del cron. Un envío manual del
  // admin es una decisión expresa de mandarlo AHORA y no debe desaparecer sin
  // explicación: si él lo manda a las 23:30, se manda.
  const prefsById = await loadPrefsByIds([
    ...new Set([...availableSubscriptions.map(sub => String(sub.userId)), ...nativeCandidates]),
  ]);
  const { allowed, quiet, off } = splitRecipients(availableSubscriptions, prefsById, new Date(), 'daily');
  const recipients = isAdmin ? [...allowed, ...quiet] : allowed;
  const native = splitRecipients(nativeCandidates.map(userId => ({ userId })), prefsById, new Date(), 'daily');
  const filtered = off.length + (isAdmin ? 0 : quiet.length) + native.off.length;
  const nativeAllowedIds = (manual ? [...native.allowed, ...native.quiet] : native.allowed)
    .map(row => String(row.userId));
  const webRecipientIds = new Set(recipients.map(row => String(row.userId)));
  const fcmRecipients = nativeAllowedIds.filter(userId => !webRecipientIds.has(userId));

  if (!manual && recipients.length === 0 && fcmRecipients.length === 0) {
    return res.status(200).json({
      success: true,
      sent: 0,
      filtered,
      message: 'Ningún destinatario tiene activo este aviso',
      reminders,
    });
  }

  // Push diario del cron: si hoy hay un regalo del calendario, enlaza a ese
  // día; si no, queda el saludo genérico. (Las novedades por-usuario como
  // "razones sin leer" se notifican desde el cliente, que sí conoce su estado.)
  const calendarPush = customTitle ? null : await calendarPayloadForToday();
  const payload = JSON.stringify({
    ...(calendarPush || {
      title: customTitle || '¡Buenos días! ☀️',
      body: customBody || 'Es hora de tu check-in diario de estado de ánimo.',
      url: manual && isAllowedNotificationPath(req.body?.url) ? req.body.url : '/',
      tag: manual ? 'admin-broadcast' : 'daily-welcome',
    }),
    timestamp: Date.now(),
  });

  const results = { sent: 0, failed: 0, removed: 0 };
  const expiredEndpoints = [];
  const staleEndpoints = [];

  for (const sub of webConfigured ? recipients : []) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: sub.keys,
        },
        payload
      );
      results.sent++;
    } catch (err) {
      // 410 Gone = subscription expired/unsubscribed — remove it
      // 404 Not Found = endpoint no longer valid — remove it
      // 403 VAPID mismatch = se creó con otra clave (p. ej. tras rotarla):
      //   tampoco puede recibir nunca, así que se retira igual.
      if (err.statusCode === 410 || err.statusCode === 404 || isVapidMismatchError(err)) {
        results.removed++;
        expiredEndpoints.push(sub.endpoint);
        if (isVapidMismatchError(err)) staleEndpoints.push(sub.endpoint);
      } else {
        // Keep subscription for retry (temporary error)
        results.failed++;
      }
    }
  }

  // FCM incluye las cuentas con app nativa aunque no tengan una suscripción
  // Web Push en otro navegador. Las que ya están en `recipients` se mandan
  // desde el mismo lote para no duplicarles el aviso.
  let android = { sent: 0, failed: 0, removed: 0, configured: androidConfigured };
  if (fcmRecipients.length > 0) {
    try {
      const sent = await sendTokensToUsers(fcmRecipients, JSON.parse(payload));
      if (sent) android = { ...android, ...sent, removed: sent.removed.length };
    } catch {
      /* FCM es un extra: nunca tumba el envío web */
    }
  }

  if (staleEndpoints.length > 0) {
    console.warn(
      '[api/push/send] suscripciones creadas con otra clave VAPID retiradas:',
      staleEndpoints.length
    );
  }

  // Limpieza de caducados: la lista de referencia es la COMPLETA, no la de
  // hoy. `saveSubscriptions` borra todo lo que no esté en la lista que recibe,
  // así que pasarle solo los destinatarios (quien no está en silencio y tiene
  // el aviso encendido) daría de baja a los demás cada mañana.
  if (expiredEndpoints.length > 0) {
    await saveSubscriptions(
      allSubscriptions.filter(sub => !expiredEndpoints.includes(sub.endpoint))
    ).catch(err => console.warn('[api/push/send] no se pudieron retirar suscripciones:', err.message));
  }

  // Los fallos del propio saludo diario también son un aviso técnico.
  if (!manual) await notifyAdminsOfHealth({ failed: results.failed, removed: results.removed });

  return res.status(200).json({
    success: true,
    sent: results.sent,
    failed: results.failed,
    removed: results.removed,
    stale: staleEndpoints.length,
    filtered,
    total: allSubscriptions.length,
    webConfigured,
    android,
    reminders,
  });
}
