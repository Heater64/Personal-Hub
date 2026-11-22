/* ==========================================
   Personal Hub — cycle.service.js
   Persistencia del seguimiento menstrual en Supabase.

   Diferencias conscientes con el resto de servicios:
   · No hay espejo en localStorage: son datos de salud y viven en
     memoria + Supabase. La app avisa con claridad si no hay conexión.
   · Nunca escribe en nombre de otra persona: user_id sale siempre de
     la sesión, y la RLS lo vuelve a comprobar en el servidor.
   ========================================== */

import { supabase } from './supabase.js';
import { userStore } from '../stores/user.store.js';
import { notifyAdminOfCycle } from './notifications.service.js';

const TABLES = {
  settings: 'cycle_settings',
  periods: 'cycle_periods',
  logs: 'cycle_daily_logs',
  sharing: 'cycle_sharing'
};

const MISSING_TABLE = '42P01';
const MISSING_FUNCTION = '42883';

export class CycleError extends Error {
  constructor(message, code = '') {
    super(message);
    this.name = 'CycleError';
    this.code = code;
  }
}

function currentUserId() {
  return userStore.getUser()?.id || null;
}

function requireUser() {
  const id = currentUserId();
  if (!id) throw new CycleError('Inicia sesión para usar tu seguimiento.');
  return id;
}

function translate(error, fallback) {
  if (!error) return new CycleError(fallback);
  if (error.code === MISSING_TABLE) {
    return new CycleError('Falta aplicar la migración sql/027_ciclo_menstrual.sql en Supabase.', MISSING_TABLE);
  }
  if (error.code === '42501' || error.code === '401') {
    return new CycleError('Tu sesión no tiene permiso para esto. Vuelve a iniciar sesión.', error.code);
  }
  return new CycleError(error.message || fallback, error.code || '');
}

/* ==========================================
   LECTURA
   ========================================== */

export async function loadAll() {
  const user_id = requireUser();

  const [settingsRes, periodsRes, logsRes] = await Promise.all([
    supabase.from(TABLES.settings).select('*').eq('user_id', user_id).maybeSingle(),
    supabase.from(TABLES.periods).select('*').eq('user_id', user_id).order('start_date', { ascending: true }),
    supabase.from(TABLES.logs).select('*').eq('user_id', user_id).order('log_date', { ascending: true })
  ]);

  if (settingsRes.error && settingsRes.error.code !== 'PGRST116') throw translate(settingsRes.error, 'No se pudo leer la configuración.');
  if (periodsRes.error) throw translate(periodsRes.error, 'No se pudo leer el historial.');
  if (logsRes.error) throw translate(logsRes.error, 'No se pudieron leer los registros.');

  const settings = settingsRes.data || {};

  return {
    settings: {
      avgCycleLength: settings.avg_cycle_length ?? 28,
      avgPeriodLength: settings.avg_period_length ?? 5,
      lutealPhaseLength: settings.luteal_phase_length ?? 14,
      notifications: normalizeNotifications(settings.notifications),
      preferences: normalizePreferences(settings.preferences)
    },
    periods: periodsRes.data || [],
    logs: logsRes.data || []
  };
}

function normalizeNotifications(value) {
  const raw = typeof value === 'object' && value ? value : {};
  return {
    daily: raw.daily === true,
    dailyTime: /^\d{2}:\d{2}$/.test(String(raw.dailyTime || '')) ? raw.dailyTime : '20:00',
    period: raw.period === true
  };
}

function normalizePreferences(value) {
  const raw = typeof value === 'object' && value ? value : {};
  return {
    showFertile: raw.showFertile !== false,
    showOvulation: raw.showOvulation !== false
  };
}

export async function loadSharing() {
  const user_id = requireUser();
  const { data, error } = await supabase
    .from(TABLES.sharing)
    .select('*')
    .eq('owner_id', user_id)
    .maybeSingle();
  if (error) throw translate(error, 'No se pudo leer el estado de privacidad.');
  return data || null;
}

/** Resumen autorizado que ve la pareja. `{ shared:false }` si no hay permiso. */
export async function getPartnerSnapshot() {
  if (!currentUserId()) return { shared: false };
  const { data, error } = await supabase.rpc('cycle_partner_snapshot');
  if (error) {
    // Sin la migración aplicada o sin red: se comporta como "sin permiso".
    if (error.code === MISSING_FUNCTION || error.code === MISSING_TABLE) return { shared: false, unavailable: true };
    console.warn('[ciclo] no se pudo leer el resumen de pareja:', error.message);
    return { shared: false };
  }
  return data || { shared: false };
}

/* ==========================================
   ESCRITURA
   ========================================== */

export async function saveSettings(patch = {}) {
  const user_id = requireUser();
  const current = (await supabase.from(TABLES.settings).select('*').eq('user_id', user_id).maybeSingle()).data || {};

  const payload = {
    user_id,
    avg_cycle_length: Number(patch.avgCycleLength ?? current.avg_cycle_length ?? 28),
    avg_period_length: Number(patch.avgPeriodLength ?? current.avg_period_length ?? 5),
    luteal_phase_length: Number(patch.lutealPhaseLength ?? current.luteal_phase_length ?? 14),
    notifications: patch.notifications ?? normalizeNotifications(current.notifications),
    preferences: patch.preferences ?? normalizePreferences(current.preferences),
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase.from(TABLES.settings).upsert(payload, { onConflict: 'user_id' });
  if (error) throw translate(error, 'No se pudo guardar la configuración.');
  return payload;
}

function cleanDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : null;
}

export async function savePeriod(period = {}) {
  const user_id = requireUser();
  const start_date = cleanDate(period.start_date || period.start);
  const end_date = cleanDate(period.end_date || period.end);
  if (!start_date) throw new CycleError('Elige la fecha de inicio.');
  if (end_date && end_date < start_date) throw new CycleError('El fin no puede ser anterior al inicio.');

  const payload = {
    user_id,
    start_date,
    end_date: end_date || null,
    is_confirmed: period.is_confirmed !== false,
    notes: String(period.notes || '').slice(0, 2000),
    updated_at: new Date().toISOString()
  };

  let query;
  if (period.id) {
    query = supabase.from(TABLES.periods).update(payload).eq('id', period.id).eq('user_id', user_id).select().maybeSingle();
  } else {
    query = supabase.from(TABLES.periods).upsert(payload, { onConflict: 'user_id,start_date' }).select().maybeSingle();
  }

  const { data, error } = await query;
  if (error) throw translate(error, 'No se pudo guardar la menstruación.');

  // Aviso al chico: una menstruación nueva (o su fecha de fin, que es lo que
  // cierra el ciclo) es lo más útil que puede saber. Editar notas no avisa.
  const endsToday = !period.id && end_date;
  if (!period.id || endsToday) notifyAdminOfCycle('cycle_period');

  return data;
}

export async function deletePeriod(id) {
  const user_id = requireUser();
  const { error } = await supabase.from(TABLES.periods).delete().eq('id', id).eq('user_id', user_id);
  if (error) throw translate(error, 'No se pudo eliminar la menstruación.');
}

export async function saveLog(log = {}) {
  const user_id = requireUser();
  const log_date = cleanDate(log.log_date || log.date);
  if (!log_date) throw new CycleError('Elige la fecha del registro.');

  const payload = {
    user_id,
    log_date,
    flow: ['light', 'medium', 'heavy'].includes(log.flow) ? log.flow : null,
    spotting: log.spotting === true,
    symptoms: Array.isArray(log.symptoms) ? log.symptoms : [],
    mood: Array.isArray(log.mood) ? log.mood : [],
    energy: ['low', 'normal', 'high'].includes(log.energy) ? log.energy : null,
    sleep_quality: Number.isFinite(Number(log.sleep_quality)) && Number(log.sleep_quality) >= 1 && Number(log.sleep_quality) <= 5
      ? Number(log.sleep_quality)
      : null,
    notes: String(log.notes || '').slice(0, 2000),
    updated_at: new Date().toISOString()
  };

  // Se mira lo que había para no avisarle de un guardado que no cambia nada:
  // abrir el día y dar a guardar sin tocar nada no debe sonar en su móvil.
  const { data: before } = await supabase
    .from(TABLES.logs)
    .select('flow,spotting,symptoms,notes')
    .eq('user_id', user_id)
    .eq('log_date', log_date)
    .maybeSingle();

  const { data, error } = await supabase
    .from(TABLES.logs)
    .upsert(payload, { onConflict: 'user_id,log_date' })
    .select()
    .maybeSingle();
  if (error) throw translate(error, 'No se pudo guardar el registro.');

  const symptoms = payload.symptoms.toSorted().join(',');
  const changed =
    !before ||
    before.flow !== payload.flow ||
    before.spotting !== payload.spotting ||
    (before.symptoms || []).toSorted().join(',') !== symptoms ||
    (before.notes || '') !== payload.notes;
  if (changed) notifyAdminOfCycle('cycle_log');

  return data;
}

export async function deleteLog(log_date) {
  const user_id = requireUser();
  const date = cleanDate(log_date);
  if (!date) throw new CycleError('Fecha no válida.');
  const { error } = await supabase.from(TABLES.logs).delete().eq('user_id', user_id).eq('log_date', date);
  if (error) throw translate(error, 'No se pudo eliminar el registro.');
}

/* ==========================================
   COMPARTIR
   ========================================== */

/**
 * Quién es la otra persona de la casa.
 * Se resuelve con filas que ambos roles pueden leer (misma idea que
 * location.service): la cuenta de ella no puede leer el perfil del admin.
 */
export async function resolvePartnerId() {
  const me = requireUser();

  // Camino principal: lo resuelve el servidor (ella no puede leer el
  // perfil del admin por RLS). Si la migración aún no está aplicada, se
  // cae a las pistas que ambos roles ya pueden leer.
  try {
    const { data, error } = await supabase.rpc('cycle_partner_candidate');
    if (!error && data) return data;
  } catch { /* sin función: se prueba con las pistas */ }

  try {
    if (userStore.isAdmin) {
      const { data } = await supabase
        .from('user_progress')
        .select('user_id')
        .neq('user_id', me)
        .limit(1);
      if (data?.[0]?.user_id) return data[0].user_id;
      const { data: profiles } = await supabase.from('profiles').select('id').neq('id', me).limit(1);
      return profiles?.[0]?.id || null;
    }
    const { data } = await supabase.from('content').select('data').eq('id', 'presence_admin').maybeSingle();
    return data?.data?.user_id || null;
  } catch {
    return null;
  }
}

export async function saveSharing({ enabled = false, fields = [], supportMessage = '' } = {}) {
  const owner_id = requireUser();
  const partner_id = await resolvePartnerId();
  if (!partner_id) throw new CycleError('No se encontró la otra cuenta de la casa.');

  const payload = {
    owner_id,
    partner_id,
    sharing_enabled: enabled === true,
    shared_fields: [...new Set(fields)],
    support_message: String(supportMessage || '').slice(0, 500),
    updated_at: new Date().toISOString()
  };

  // Se mira lo que había antes para avisarle solo cuando de verdad cambia lo
  // que puede ver (activar el permiso o marcar/desmarcar campos con él ya
  // activo). Guardar el mensaje de apoyo no necesita sonar en su móvil.
  const { data: before } = await supabase
    .from(TABLES.sharing)
    .select('sharing_enabled, shared_fields')
    .eq('owner_id', owner_id)
    .maybeSingle();

  const { error } = await supabase.from(TABLES.sharing).upsert(payload, { onConflict: 'owner_id' });
  if (error) throw translate(error, 'No se pudo guardar el permiso.');

  const wasEnabled = before?.sharing_enabled === true;
  const sameFields =
    (before?.shared_fields || []).toSorted().join(',') === payload.shared_fields.toSorted().join(',');
  if (payload.sharing_enabled && (!wasEnabled || !sameFields)) {
    notifyAdminOfCycle('cycle_share');
  }

  return payload;
}

/* ==========================================
   EXPORTACIÓN Y BORRADO
   ========================================== */

export function toJSON({ settings, periods, logs }) {
  return JSON.stringify({
    exported_at: new Date().toISOString(),
    app: 'Personal Hub — Menstruación',
    settings,
    periods,
    daily_logs: logs
  }, null, 2);
}

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCSV({ periods = [], logs = [] }) {
  const lines = ['tipo,fecha,fin,flujo,manchado,sintomas,animo,energia,sueno,notas'];
  for (const p of periods) {
    lines.push([
      'periodo', p.start_date, p.end_date || '', '', '',
      '', '', '', '', p.notes || ''
    ].map(csvCell).join(','));
  }
  for (const log of logs) {
    lines.push([
      'registro', log.log_date, '', log.flow || '', log.spotting ? 'si' : 'no',
      (log.symptoms || []).join('|'), (log.mood || []).join('|'),
      log.energy || '', log.sleep_quality ?? '', log.notes || ''
    ].map(csvCell).join(','));
  }
  return lines.join('\n');
}

/** Descarga un archivo en el dispositivo. Sin servidores ni copias externas. */
export function download(filename, mime, text) {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function deleteAll() {
  const user_id = requireUser();
  const logs = await supabase.from(TABLES.logs).delete().eq('user_id', user_id);
  if (logs.error) throw translate(logs.error, 'No se pudieron borrar los registros.');
  const periods = await supabase.from(TABLES.periods).delete().eq('user_id', user_id);
  if (periods.error) throw translate(periods.error, 'No se pudo borrar el historial.');
  const sharing = await supabase.from(TABLES.sharing).delete().eq('owner_id', user_id);
  if (sharing.error) throw translate(sharing.error, 'No se pudo borrar el permiso de pareja.');
  const settings = await supabase.from(TABLES.settings).delete().eq('user_id', user_id);
  if (settings.error) throw translate(settings.error, 'No se pudo borrar la configuración.');
}

export const cycleService = {
  loadAll, loadSharing, getPartnerSnapshot,
  saveSettings, savePeriod, deletePeriod, saveLog, deleteLog,
  saveSharing, resolvePartnerId,
  toJSON, toCSV, download, deleteAll
};
