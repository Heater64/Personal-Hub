/* ==========================================
   widgets.service.js — lo que saben los widgets.

   Un widget de Android no ejecuta JavaScript: solo puede leer lo que la app
   dejó escrito. Aquí se preparan los dos paquetes de datos (días y distancia),
   con las caras incluidas, y se guardan en Preferences. Después se pide al
   puente nativo que los repinte.

   Las fotos van como URL: el lado nativo las descarga una vez y las guarda en
   caché, porque RemoteViews no puede cargar imágenes de red.
   ========================================== */

import { callNativeApi, isNative, nativeApiUrl } from './native.service.js';
import { formatDistance, togetherInfo } from './location.service.js';
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
// Fase 5: tres widgets nuevos que solo leen datos que ya existen.
const KEY_REASON = 'widget_reason';
const KEY_OPENWHEN = 'widget_openwhen';
const KEY_STREAK = 'widget_streak';

/**
 * Fuera del APK los paquetes viven en localStorage.
 *
 * La hoja de widgets del navegador enseña lo mismo que el widget leería en el
 * móvil, así que necesita poder leer lo que las pantallas guardan. Sin este
 * respaldo, en la web todos los paquetes se perdían y media hoja salía vacía.
 */
const webKey = key => `widget:${key}`;
const WIDGET_API = '/api/widgets';
let widgetAccount = null;
let syncStarted = false;
let disconnecting = false;

async function setStorage(key, value, userId = auth.getUser()?.id) {
  const plugin = bridge();
  if (!plugin?.setWidgetData) {
    try {
      localStorage.setItem(webKey(key), value);
    } catch {
      /* sin almacenamiento: el widget se queda como estaba */
    }
    return;
  }
  try {
    if (!userId || disconnecting || userId !== auth.getUser()?.id) return;
    const account = useWidgetAccount(userId);
    await account.ready;
    if (widgetAccount !== account || disconnecting) return;
    await plugin.setWidgetData({ key, value, userId });
  } catch {
    /* el widget se queda con lo último que se guardó */
  }
}

async function getStorage(key) {
  const plugin = bridge();
  if (!plugin?.getWidgetData) return readWeb(key);
  try {
    const res = await plugin.getWidgetData({ key });
    return res?.value || null;
  } catch {
    return null;
  }
}

function readWeb(key) {
  try {
    return localStorage.getItem(webKey(key));
  } catch {
    return null;
  }
}

/**
 * Último paquete guardado de un widget, ya parseado, o null.
 *
 * La hoja de widgets lo usa como respaldo cuando Inicio no tiene el dato a
 * mano (razón del día, cartas por descubrir, racha): así esas miniaturas se
 * dibujan con datos en vez de quedarse en su estado vacío.
 */
export function readSavedWidget(widget) {
  const key = WIDGET_KEYS[widget];
  if (!key) return null;
  const raw = readWeb(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function bridge() {
  return typeof window !== 'undefined' ? window.Capacitor?.Plugins?.WidgetBridge : null;
}

function useWidgetAccount(userId) {
  if (widgetAccount?.userId === userId) return widgetAccount;
  const pending = { userId, token: '', registeredAt: 0, request: null };
  widgetAccount = pending;
  pending.ready = Promise.resolve(bridge()?.setAccount?.({ userId })).catch(() => {});
  return pending;
}

function installationId() {
  const key = 'ph.nativeWidgetInstallation';
  const current = localStorage.getItem(key);
  if (current) return current;
  const id = crypto.randomUUID();
  localStorage.setItem(key, id);
  return id;
}

async function syncNativeWidgets() {
  const userId = auth.getUser()?.id;
  const plugin = bridge();
  if (!userId || disconnecting || !plugin?.configureSync) return;
  const account = useWidgetAccount(userId);
  if (account.request) return account.request;
  account.request = (async () => {
    await account.ready;
    if (widgetAccount !== account) return;
    const status = await plugin.requestSync({ schedule: false });
    if (status?.configured && Date.now() - (status.configuredAt || account.registeredAt) < 86400000) {
      await plugin.requestSync();
      return;
    }
    const { data } = await auth.getSession();
    const session = data?.session;
    if (session?.user?.id !== userId || !session.access_token || widgetAccount !== account) return;
    let messagingTimeout;
    const messaging = await Promise.race([
      Promise.resolve(plugin.getMessagingToken?.()).catch(() => null),
      new Promise(resolve => { messagingTimeout = setTimeout(resolve, 3500); }),
    ]).finally(() => clearTimeout(messagingTimeout));
    if (widgetAccount !== account) return;
    const response = await callNativeApi(`${WIDGET_API}?action=register`, 'POST', session.access_token, {
      installationId: installationId(),
      messagingToken: messaging?.token || '',
    });
    const token = response.status === 200 ? response.data?.token : '';
    if (token) account.token = token;
    if (widgetAccount !== account) return;
    if (!token) {
      if (status?.configured) await plugin.requestSync();
      return;
    }
    await plugin.configureSync({ endpoint: nativeApiUrl(WIDGET_API), token, userId });
    account.registeredAt = Date.now();
  })().catch(() => {}).finally(() => { account.request = null; });
  return account.request;
}

export async function disconnectWidgetSync() {
  const plugin = bridge();
  if (!isNative() || !plugin?.clearSync) return;
  disconnecting = true;
  const account = widgetAccount;
  const userId = auth.getUser()?.id;
  const sessionAtLogout = userId && auth.getSession().catch(() => null);
  widgetAccount = null;
  try {
    await plugin.clearSync();
  } catch {
    /* la cuenta nativa también se valida al próximo inicio */
  }
  if (userId) {
    // La purga en Android es inmediata incluso sin red. La revocación remota
    // espera el registro en curso para revocar también el token recién emitido.
    void (async () => {
      await account?.request;
      if (widgetAccount?.userId === userId) return;
      const session = (await sessionAtLogout)?.data?.session;
      const token = account?.token || (session?.user?.id === userId ? session.access_token : '');
      if (token) await callNativeApi(`${WIDGET_API}?action=revoke`, 'POST', token, { installationId: installationId() });
    })().catch(() => {});
  }
}

export function initWidgetSync() {
  if (syncStarted || !isNative()) return;
  syncStarted = true;
  void auth.isReady().then(() => {
    auth.onAuthChange(user => {
      if (!user) {
        if (!disconnecting) void disconnectWidgetSync().finally(() => {
          disconnecting = false;
          void syncNativeWidgets();
        });
        else disconnecting = false;
        return;
      }
      // Una notificación de refresco de sesión también pasa por aquí.
      if (disconnecting) return;
      useWidgetAccount(user.id);
      setTimeout(() => void syncNativeWidgets(), 0);
    });
    window.addEventListener('online', () => void syncNativeWidgets());
  });
}

// Varios cambios del Inicio pueden llegar en la misma vuelta del event loop
// (identidad, distancia y datos remotos). Android no necesita recibir tres
// repintados concurrentes: el último ya contiene todo el estado guardado.
let refreshInFlight = null;
let refreshAgain = false;

/** Pide al lado nativo que repinte ahora mismo (sin esperar los 30 min). */
export async function refreshWidgets() {
  const plugin = bridge();
  if (!plugin?.refresh) return false;

  if (refreshInFlight) {
    refreshAgain = true;
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    try {
      await plugin.refresh();
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  try {
    return await refreshInFlight;
  } finally {
    // Si se guardó otro paquete mientras Android pintaba, se hace un único
    // pase final. Así no se pierde el último cambio al volver de segundo plano.
    if (refreshAgain) {
      refreshAgain = false;
      void refreshWidgets();
    }
  }
}

// El proceso web puede reanudarse con widgets ya colocados. Un repintado
// inmediato conserva fechas relativas, fotos que acabaron de descargarse y
// cualquier dato escrito justo antes de pasar la app a segundo plano.
if (typeof window !== 'undefined') {
  window.addEventListener('personalhub:widgets-refresh', () => {
    void refreshWidgets();
    void syncNativeWidgets();
  });
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
  const userId = auth.getUser()?.id;

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
    }),
    userId
  );
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
  const battery = device?.battery;
  const together = Number.isFinite(km) && togetherInfo(me, partner)?.together;
  const oldestFix = Math.min(Date.parse(me?.at), Date.parse(partner?.at));
  const telemAt = Date.parse(device?.sentAt || device?.at);
  const expires = timestamp => Number.isFinite(timestamp) ? new Date(timestamp + 1800000).toISOString() : '';
  await setStorage(
    KEY_DISTANCE,
    JSON.stringify({
      km: Number.isFinite(km) ? Number(km.toFixed(2)) : null,
      text: together ? 'Juntos' : formatDistance(km),
      me: { name: me?.name || '', avatar: me?.avatar || '' },
      partner: { name: partner?.name || '', avatar: partner?.avatar || '' },
      device: Number.isFinite(battery)
        ? {
            battery: Math.max(0, Math.min(100, Math.round(battery))),
            charging: device?.charging === true,
            net: device?.net || '',
            expiresAt: expires(telemAt),
          }
        : null,
      at: Number.isFinite(oldestFix) ? new Date(oldestFix).toISOString() : '',
      expiresAt: expires(oldestFix),
    })
  );
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
}

/**
 * Guarda el ánimo que enseña el widget: la selección completa del último
 * estado y SU fecha (no la de hoy).
 *
 * Nunca se borra lo guardado: si no hay ánimo que escribir, el widget sigue
 * mostrando el último registrado en vez de quedarse en «sin registrar». Así el
 * ánimo de ayer sigue a la vista hasta que se registre el de hoy.
 */
export async function saveMoodWidget({ emoji, label, date, items, clear }, userId) {
  const list = (Array.isArray(items) ? items : [])
    .map(item => ({ emoji: item?.emoji || '', label: item?.label || '' }))
    .filter(item => item.label);
  const shownEmoji = emoji || list[0]?.emoji || '';
  const shownLabel = label || list.map(item => item.label).join(' · ');

  if (!shownEmoji && !shownLabel) {
    // Sin nada que enseñar solo se limpia cuando de verdad no queda ningún
    // ánimo (borró el suyo y el historial está vacío): dejarlo sería mostrar
    // uno que ya no existe. Si solo falta el de hoy, no se llega aquí.
    if (!clear) return;
    await setStorage(
      KEY_MOOD,
      JSON.stringify({
        emoji: '',
        label: '',
        date: '',
        items: [],
        at: new Date().toISOString(),
      }),
      userId
    );
    return;
  }

  await setStorage(
    KEY_MOOD,
    JSON.stringify({
      emoji: shownEmoji,
      label: shownLabel,
      date: date || '',
      items: list,
      at: new Date().toISOString(),
    }),
    userId
  );
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
  const userId = auth.getUser()?.id;
  if (!userId) return;

  const payload = await herMoodToday();
  if (!payload || auth.getUser()?.id !== userId) return;
  await saveMoodWidget(payload, userId);
}

/**
 * El ánimo se registra desde Sentimientos, el perfil o la bienvenida, y el
 * widget tiene que cambiar en ese mismo momento: no puede esperar a que se
 * vuelva a abrir Inicio. Se engancha una sola vez al arrancar la app.
 */
let moodWatchStarted = false;
export function initMoodWidgetSync() {
  if (moodWatchStarted || !isNative()) return;
  moodWatchStarted = true;
  moodStore.subscribe(() => {
    saveHerMoodWidget().catch(() => { /* el widget se queda con lo último */ });
  });
}

/**
 * Lo que enseña el widget: TODAS las emociones del último estado, no solo la
 * primera. Dos caben en la etiqueta («Triste · Cansada»); el resto se resume
 * con «+N», que es lo que entra en una tarjeta de 1×1 o 3×1.
 */
function moodText(mood) {
  if (!mood) return { emoji: '', label: '', items: [] };
  const items = (mood.items || [])
    .map(item => ({ emoji: item?.emoji || '', label: item?.label || '' }))
    .filter(item => item.label);
  const shown = items.slice(0, 2).map(item => item.label);
  const extra = items.length - shown.length;

  return {
    emoji: items[0]?.emoji || mood.emoji || '',
    label: shown.length
      ? `${shown.join(' · ')}${extra > 0 ? ` +${extra}` : ''}`
      : mood.label || 'Registrado',
    items,
  };
}

/** Último estado del historial local: `{ mood, date }`, o null si no hay. */
function lastLocalMood() {
  const history = moodStore.getHistory() || [];
  let best = null;
  for (const entry of history) {
    const date = String(entry?.date || '').slice(0, 10);
    if (!date) continue;
    if (best && date <= best.date) continue;
    const mood = moodStore.resolveMood({
      mood: entry.moodId || entry.mood,
      label: entry.label,
      emoji: entry.emoji,
      score: entry.score,
    });
    if (mood) best = { date, mood };
  }
  return best;
}

/**
 * El ánimo de ella: el de hoy o, si todavía no hay, el último que registró
 * (con su fecha, para que el widget pueda decir «ayer»).
 */
async function herMoodToday() {
  await auth.refreshAccount();

  if (!auth.isAdmin()) {
    const mood = moodStore.getTodayMood();
    if (mood) return { ...moodText(mood), date: todayISO() };
    const last = lastLocalMood();
    return last
      ? { ...moodText(last.mood), date: last.date }
      : { emoji: '', label: '', date: '', items: [], clear: true };
  }

  // Sesión de administrador: su ánimo no pinta nada en el widget de ella.
  try {
    const users = await db.listUsers();
    const her = (users || []).find(user => user && user.role === 'user' && user.enabled !== false);
    if (!her) return null;

    // La fila más reciente, sea de hoy o de días anteriores: el widget sigue
    // enseñando el último ánimo en vez de vaciarse cada mañana.
    const rows = (await db.getUserMoods(her.id)) || [];
    const row = rows
      .filter(item => item && item.mood)
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0];
    if (!row) return { emoji: '', label: '', date: '', items: [], clear: true };
    return {
      ...moodText(resolveMood(row)),
      date: String(row.date || '').slice(0, 10) || todayISO(),
    };
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
  const userId = auth.getUser()?.id;

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
    }),
    userId
  );
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
}

/** Sorpresas del calendario: cuántas hay hoy y cuántas quedan por abrir. */
export async function saveGiftsWidget({ total, pending, ids, openedIds, date }) {
  await setStorage(
    KEY_GIFTS,
    JSON.stringify({
      total: Math.max(0, Number(total) || 0),
      pending: Math.max(0, Number(pending) || 0),
      giftIds: Array.isArray(ids) ? ids : [],
      openedIds: Array.isArray(openedIds) ? openedIds : [],
      date: date || '',
    })
  );
}

/**
 * Razón del día: el mismo texto que enseña la pantalla de Razones.
 * Se guarda con la fecha para que el widget sepa si sigue siendo la de hoy.
 */
export async function saveReasonWidget({ text, date }) {
  const value = String(text || '').trim();
  await setStorage(
    KEY_REASON,
    JSON.stringify({
      text: value.slice(0, 400),
      date: date || (value ? todayISO() : ''),
      at: new Date().toISOString(),
    })
  );
}

/** Cartas de Open When sin abrir: cuántas quedan y de qué categoría es la próxima. */
export async function saveOpenWhenWidget({ pending, category, emoji }) {
  await setStorage(
    KEY_OPENWHEN,
    JSON.stringify({
      pending: Math.max(0, Number(pending) || 0),
      category: String(category || '').slice(0, 80),
      emoji: String(emoji || '').slice(0, 8),
      at: new Date().toISOString(),
    })
  );
}

/** Racha de ánimo: días seguidos y mejor racha de siempre. */
export async function saveStreakWidget({ days, best }) {
  const userId = auth.getUser()?.id;
  const current = Math.max(0, Number(days) || 0);
  const record = Math.max(current, Number(best) || 0);
  try {
    const stored = await getStorage(KEY_STREAK);
    const prev = stored ? JSON.parse(stored) : null;
    if (prev && prev.days === current && prev.best === record) return;
  } catch { /* paquete roto: se reescribe */ }

  await setStorage(
    KEY_STREAK,
    JSON.stringify({
      days: current,
      best: record,
      date: current ? todayISO() : '',
      at: new Date().toISOString(),
    }),
    userId
  );
}

export const WIDGET_KEYS = {
  days: KEY_DAYS,
  distance: KEY_DISTANCE,
  countdown: KEY_COUNTDOWN,
  mood: KEY_MOOD,
  cycle: KEY_CYCLE,
  watching: KEY_WATCHING,
  gifts: KEY_GIFTS,
  reason: KEY_REASON,
  openwhen: KEY_OPENWHEN,
  streak: KEY_STREAK,
};
