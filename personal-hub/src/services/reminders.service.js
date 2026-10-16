/* ==========================================
   Personal Hub v2 — Recordatorios programados
   Cliente del panel para /api/push?action=reminders.

   - Cada llamada lleva la sesión en el Authorization: el servidor comprueba
     que quien programa es admin (rol en `profiles`, no el navegador).
   - Las reglas (título y mensaje obligatorios, destino interno, longitudes)
     viven en la API: aquí no se duplican, o se desincronizarían.
   - Toda función lanza un Error con el mensaje del servidor ya listo para
     enseñar en un toast.
   ========================================== */

import { supabase } from './supabase.js';

const REMINDERS_URL = '/api/push?action=reminders';
const RUN_URL = '/api/push?action=run-reminders';

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Sesión no disponible');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`
  };
}

async function call(url, options = {}) {
  const res = await fetch(url, { ...options, headers: await authHeaders() });

  // En `npm run dev` las funciones de Vercel no existen y el servidor de
  // desarrollo responde al SPA fallback: 200 con el index.html. Sin este
  // control, `res.ok` sería true, el JSON fallaría en silencio y el panel
  // diría «todavía no hay recordatorios programados» — que es mentira, y
  // además manda a buscar el problema donde no está.
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('Los recordatorios se envían desde la API de Vercel: en local (npm run dev) esa ruta no existe. Pruébalo en la web desplegada.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

/** Recordatorios programados (con sus últimos envíos) para el panel. */
export async function listReminders() {
  const data = await call(REMINDERS_URL, { method: 'GET' });
  return { reminders: data.reminders || [], logs: data.logs || [] };
}

/**
 * Valor de un <input type="datetime-local"> → ISO en UTC.
 *
 * `new Date('2026-10-20T19:00')` sin zona se interpreta en la hora del
 * DISPOSITIVO, que es la que el admin acaba de ver en el formulario. El
 * servidor recibe un instante absoluto y no tiene que adivinar la zona.
 */
export function localInputToIso(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw new Error('Elige una fecha y una hora');
  return date.toISOString();
}

/** Instante ISO → valor para rellenar un <input type="datetime-local">. */
export function isoToLocalInput(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Formato corto para la lista: «20 oct, 19:00». */
export function formatReminderDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  });
}

export async function createReminder(input) {
  return call(REMINDERS_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'create', ...input })
  });
}

/** Edita un recordatorio. La próxima ejecución pasa a ser la del formulario. */
export async function updateReminder(id, input) {
  return call(REMINDERS_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'update', id, ...input })
  });
}

/** Enciende o apaga sin tocar la fecha programada. */
export async function toggleReminder(id, active) {
  return call(REMINDERS_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'toggle', id, active })
  });
}

export async function deleteReminder(id) {
  return call(REMINDERS_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'delete', id })
  });
}

/** Envía ese recordatorio ahora mismo, sin cambiar su programación. */
export async function runReminder(id) {
  return call(REMINDERS_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'run', id })
  });
}

/** Envía todos los recordatorios vencidos (el programador lo hace solo). */
export async function runDueReminders() {
  return call(RUN_URL, { method: 'POST' });
}
