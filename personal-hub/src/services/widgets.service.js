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

const KEY_DAYS = 'widget_days';
const KEY_DISTANCE = 'widget_distance';

let prefsModule = null;

async function prefs() {
  if (!isNative()) return null;
  if (!prefsModule) prefsModule = await import('@capacitor/preferences').catch(() => null);
  return prefsModule?.Preferences || null;
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
export async function saveDaysWidget({ days, years, months, weeks, me, partner, breakdown }) {
  const Preferences = await prefs();
  if (!Preferences) return;
  await Preferences.set({
    key: KEY_DAYS,
    value: JSON.stringify({
      days: Number(days) || 0,
      years: Number(years) || 0,
      months: Number(months) || 0,
      weeks: Number(weeks) || 0,
      // Desglose exacto para el widget «tiempo juntos»: cuántos años, cuántos
      // meses y los días que sobran (no el total).
      y: Number(breakdown?.years) || 0,
      m: Number(breakdown?.months) || 0,
      d: Number(breakdown?.days) || 0,
      me: { name: me?.name || '', avatar: me?.avatar || '' },
      partner: { name: partner?.name || '', avatar: partner?.avatar || '' },
      at: new Date().toISOString(),
    }),
  });
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

/** Guarda los datos de la distancia (el widget claro). */
export async function saveDistanceWidget({ km, me, partner }) {
  const Preferences = await prefs();
  if (!Preferences) return;
  await Preferences.set({
    key: KEY_DISTANCE,
    value: JSON.stringify({
      km: Number.isFinite(km) ? Number(km.toFixed(2)) : null,
      text: formatDistance(km),
      me: { name: me?.name || '', avatar: me?.avatar || '' },
      partner: { name: partner?.name || '', avatar: partner?.avatar || '' },
      at: new Date().toISOString(),
    }),
  });
  refreshWidgets();
}

export const WIDGET_KEYS = { days: KEY_DAYS, distance: KEY_DISTANCE };
