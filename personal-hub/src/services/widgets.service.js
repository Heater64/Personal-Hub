/* ==========================================
   widgets.service.js — lo que saben los widgets.

   Un widget de Android no ejecuta JavaScript: solo puede leer lo que la app
   dejó escrito. Aquí se preparan los dos paquetes de datos (días y distancia),
   con las caras incluidas, y se guardan en Preferences. Después se pide al
   puente nativo que los repinte.

   Las fotos van como URL: el lado nativo las descarga una vez y las guarda en
   caché, porque RemoteViews no puede cargar imágenes de red.
   ========================================== */

import { isNative } from './native.service.js';
import { formatDistance } from './location.service.js';
import { auth } from './auth.service.js';
import { db } from './db.service.js';
import { moodStore } from '../stores/mood.store.js';
import { resolveMood } from '../data/moods.data.js';
import { todayISO } from '../utils/format.js';

const KEY_DAYS = 'widget_days';
const KEY_DISTANCE = 'widget_distance';
const KEY_COUNTDOWN = 'widget_countdown';
const KEY_MOOD = 'widget_mood';
const KEY_CYCLE = 'widget_cycle';
const KEY_WATCHING = 'widget_watching';
const KEY_GIFTS = 'widget_gifts';

async function setStorage(key, value) {
  const plugin = bridge();
  if (!plugin?.setWidgetData) return;
  try {
    await plugin.setWidgetData({ key, value });
  } catch {
    /* el widget se queda con lo último que se guardó */
  }
}

async function getStorage(key) {
  const plugin = bridge();
  if (!plugin?.getWidgetData) return null;
  try {
    const res = await plugin.getWidgetData({ key });
    return res?.value || null;
  } catch {
    return null;
  }
}

function bridge() {
  return typeof window !== 'undefined' ? window.Capacitor?.Plugins?.WidgetBridge : null;
}

/** Pide al lado nativo que repinte ahora mismo (sin esperar los 30 min). */
export async function refreshWidgets() {
  const plugin = bridge();
  if (!plugin?.refresh) return false;
  try {
    await plugin.refresh();
    return true;
  } catch {
    return false;
  }
}

/**
 * La vista previa de verdad: el lado nativo infla el mismo RemoteViews que se
 * colocaría en el escritorio y lo devuelve como PNG.
 *
 * En el navegador no hay imagen (devuelve ''): allí la hoja dibuja su maqueta.
 */
export async function widgetPreview(widget, size = 'rect') {
  const plugin = bridge();
  if (!plugin?.preview) return '';
  try {
    const result = await plugin.preview({ widget, size });
    return result?.image || '';
  } catch {
    return '';
  }
}

/**
 * Abre el diálogo del sistema para colocar un widget.
 * `size` es 'compact' o 'wide'; Android confirma siempre con el usuario.
 */
export async function pinWidget(widget, size = 'wide') {
  const plugin = bridge();
  if (!plugin?.requestPin) return { pinned: false, reason: 'unsupported' };
  try {
    const result = await plugin.requestPin({ widget, size });
    return { pinned: !!result?.pinned, reason: result?.reason || '' };
  } catch {
    return { pinned: false, reason: 'error' };
  }
}

/**
 * Guarda los datos de «días juntos»: lo que el widget oscuro enseña.
 * `stats` viene de utils/specialDates (años, meses, semanas, días).
 */
export async function saveDaysWidget({ days, years, months, weeks, me, partner, breakdown, since }) {
  if (!isNative()) return;

  // Al arrancar Inicio se guardan los días sin caras (la ubicación aún no ha
  // llegado). Ese guardado no debe borrar las fotos que ya estaban.
  let previous = null;
  if (!me || !partner) {
    try {
      const stored = await getStorage(KEY_DAYS);
      previous = stored ? JSON.parse(stored) : null;
    } catch {
      previous = null;
    }
  }
  const person = (who, fallback) => ({
    name: who?.name || fallback?.name || '',
    avatar: who?.avatar || fallback?.avatar || '',
  });

  await setStorage(
    KEY_DAYS,
    JSON.stringify({
      days: Number(days) || 0,
      years: Number(years) || 0,
      months: Number(months) || 0,
      weeks: Number(weeks) || 0,
      // Desglose exacto para el widget «tiempo juntos»: cuántos años, cuántos
      // meses y los días que sobran (no el total).
      y: Number(breakdown?.years) || 0,
      m: Number(breakdown?.months) || 0,
      d: Number(breakdown?.days) || 0,
      // Fecha del aniversario (yyyy-mm-dd): el widget suma los días por su
      // cuenta, así el número no se queda clavado si la app no se abre.
      since: since || '',
      me: person(me, previous?.me),
      partner: person(partner, previous?.partner),
      at: new Date().toISOString(),
    })
  );
  refreshWidgets();
}

/**
 * Años, meses y días sueltos desde la fecha de aniversario.
 *
 * Se calcula con el calendario, no dividiendo: dividir 502 días entre 30,44
 * da «1 año 4 meses» y luego días que no cuadran con lo que se ve en la app.
 */
export function togetherBreakdown(totalDays) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  start.setDate(start.getDate() - Math.max(0, Math.floor(totalDays)));

  let years = today.getFullYear() - start.getFullYear();
  let months = today.getMonth() - start.getMonth();
  let days = today.getDate() - start.getDate();

  if (days < 0) {
    months -= 1;
    // Días del mes anterior al de hoy.
    days += new Date(today.getFullYear(), today.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return { years: Math.max(0, years), months: Math.max(0, months), days: Math.max(0, days) };
}

/**
 * Guarda los datos de la distancia (el widget claro).
 *
 * `device` es el estado del móvil de ella tal como llega con su posición
 * (batería, cargando y red): el widget no puede consultarlo, solo leer lo
 * último que se supo. Sin dato se guarda vacío para no enseñar el de ayer.
 */
export async function saveDistanceWidget({ km, me, partner, device }) {
  if (!isNative()) return;
  const battery = Number(device?.battery);
  await setStorage(
    KEY_DISTANCE,
    JSON.stringify({
      km: Number.isFinite(km) ? Number(km.toFixed(2)) : null,
      text: formatDistance(km),
      me: { name: me?.name || '', avatar: me?.avatar || '' },
      partner: { name: partner?.name || '', avatar: partner?.avatar || '' },
      device: Number.isFinite(battery)
        ? {
            battery: Math.max(0, Math.min(100, Math.round(battery))),
            charging: device?.charging === true,
            net: device?.net || '',
          }
        : null,
      at: new Date().toISOString(),
    })
  );
  refreshWidgets();
}

/**
 * Guarda las próximas fechas para la cuenta atrás.
 *
 * `events` es la lista completa (key/title/date, de la más cercana a la más
 * lejana): el widget deja elegir por instancia cuáles enseñar y lo guarda en su
 * propio lado, así que aquí viajan todas. `title`/`date` siguen siendo la más
 * próxima, que es lo que usan los tamaños pequeño y apaisado y lo que leen los
 * paquetes ya guardados por versiones anteriores.
 *
 * El widget suma los días por su cuenta (la fecha va cruda) para que la cuenta
 * atrás siga bajando aunque la app no se abra.
 */
export async function saveCountdownWidget({ title, date, events }) {
  if (!isNative()) return;

  const list = (Array.isArray(events) ? events : [])
    .filter(event => event && event.date)
    .slice(0, 8)
    .map(event => ({
      key: event.key || '',
      title: event.title || '',
      date: event.date || '',
    }));

  await setStorage(
    KEY_COUNTDOWN,
    JSON.stringify({
      title: title || list[0]?.title || '',
      date: date || list[0]?.date || '',
      events: list,
      at: new Date().toISOString(),
    })
  );
  refreshWidgets();
}

/**
 * Guarda el ánimo de hoy. Sin ánimo se guarda vacío a propósito: el widget
 * enseña su estado «sin registrar» en vez de la emoción de ayer.
 */
export async function saveMoodWidget({ emoji, label, date }) {
  await setStorage(
    KEY_MOOD,
    JSON.stringify({
      emoji: emoji || '',
      label: label || '',
      date: date || '',
      at: new Date().toISOString(),
    })
  );
  refreshWidgets();
}

/**
 * El widget de ánimo es el de ELLA y solo el de ella.
 *
 * En su móvil la sesión iniciada es la suya: el ánimo de hoy del store ya es
 * el suyo y se guarda al instante (también sin red). Si la sesión es la del
 * administrador —por ejemplo, al revisar la app desde el otro móvil— no se
 * escribe el ánimo de quien mira: se lee el de ella de la base. Si no se puede
 * saber, no se toca lo guardado, que es lo único que evita enseñar el de él.
 */
export async function saveHerMoodWidget() {
  if (!isNative()) return;

  const payload = await herMoodToday();
  if (!payload) return;
  await saveMoodWidget(payload);
}

/** Primer emoji y «+N», igual que lo enseña Inicio. */
function moodText(mood) {
  if (!mood) return { emoji: '', label: '' };
  const first = mood.items?.[0];
  const extra = (mood.count || mood.items?.length || 1) - 1;
  return {
    emoji: first?.emoji || mood.emoji || '',
    label: extra > 0 ? `${first.label} +${extra}` : mood.label || 'Registrado',
  };
}

/** El ánimo de ella de hoy, o null si no hay forma fiable de saberlo. */
async function herMoodToday() {
  await auth.refreshAccount();

  if (!auth.isAdmin()) {
    const mood = moodStore.getTodayMood();
    const text = moodText(mood);
    return { ...text, date: mood ? todayISO() : '' };
  }

  // Sesión de administrador: su ánimo no pinta nada en el widget de ella.
  try {
    const users = await db.listUsers();
    const her = (users || []).find(user => user && user.role === 'user' && user.enabled !== false);
    if (!her) return null;

    const rows = await db.getUserMoods(her.id);
    const row = (rows || []).find(item => String(item?.date || '').slice(0, 10) === todayISO());
    const text = moodText(resolveMood(row));
    return { ...text, date: row ? todayISO() : '' };
  } catch {
    return null;
  }
}

/**
 * Ciclo: fase, día y próxima regla.
 *
 * Es el único widget con datos de salud y sin espejo local (el servicio de
 * ciclo solo lee de Supabase), así que lo escribe la pantalla de ciclo cuando
 * ya tiene el paquete completo. Sin `date` no hay nada que enseñar y el widget
 * se queda en su estado «sin datos» en vez de inventar una fase.
 */
export async function saveCycleWidget({ phase, day, next, days, length }) {
  if (!isNative()) return;

  // La pantalla de ciclo recalcula al abrir cada vista: no se repinta el
  // widget si el paquete no cambió.
  try {
    const stored = await getStorage(KEY_CYCLE);
    const prev = stored ? JSON.parse(stored) : null;
    if (prev
      && prev.phase === (phase || '')
      && prev.day === (Number(day) || 0)
      && prev.next === (next || '')
      && prev.days === (Number.isFinite(days) ? Number(days) : null)
      && prev.length === (Number(length) || 0)) return;
  } catch { /* paquete roto: se reescribe */ }

  await setStorage(
    KEY_CYCLE,
    JSON.stringify({
      phase: phase || '',
      day: Number(day) || 0,
      next: next || '',
      days: Number.isFinite(days) ? Number(days) : null,
      length: Number(length) || 0,
      at: new Date().toISOString(),
    })
  );
  refreshWidgets();
}

/** La serie que se está viendo: título, póster y episodio. */
export async function saveWatchingWidget({ title, poster, watched, total, percent }) {
  if (!isNative()) return;
  const has = Boolean(title) && Number(total) > 0 && Number(watched) > 0;
  await setStorage(
    KEY_WATCHING,
    JSON.stringify({
      title: has ? title : '',
      poster: has ? poster || '' : '',
      watched: has ? Number(watched) : 0,
      total: has ? Number(total) : 0,
      percent: has ? Math.round(Number(percent) || 0) : 0,
      at: new Date().toISOString(),
    })
  );
  refreshWidgets();
}

/** Sorpresas del calendario: cuántas hay hoy y cuántas quedan por abrir. */
export async function saveGiftsWidget({ total, pending }) {
  await setStorage(
    KEY_GIFTS,
    JSON.stringify({
      total: Math.max(0, Number(total) || 0),
      pending: Math.max(0, Number(pending) || 0),
      at: new Date().toISOString(),
    })
  );
  refreshWidgets();
}

export const WIDGET_KEYS = {
  days: KEY_DAYS,
  distance: KEY_DISTANCE,
  countdown: KEY_COUNTDOWN,
  mood: KEY_MOOD,
  cycle: KEY_CYCLE,
  watching: KEY_WATCHING,
  gifts: KEY_GIFTS,
};
