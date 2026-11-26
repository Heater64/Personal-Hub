/* ==========================================
   seriesPartner.js — lectura del otro lado de la videoteca

   Solo el Top 5 se comparte entre cuentas (user_progress). El historial
   completo y las valoraciones siguen privados; el admin conserva el acceso
   administrativo que ya permite RLS. La migración 047 habilita únicamente
   series_podio para la otra cuenta.
   ========================================== */

import { supabase } from './supabase.js';
import { userStore } from '../stores/user.store.js';

const CACHE_MS = 15000;
let cache = null;
let cachedAt = 0;

const currentUserId = () => userStore.getUser()?.id || null;

/** Nombre e id de la otra persona, sin depender de permisos de admin. */
async function resolvePartner() {
  const me = currentUserId();
  if (!me) return null;

  if (userStore.isAdmin) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .neq('id', me)
        .limit(5);
      const other = (data || [])[0];
      if (other?.id) {
        return { id: String(other.id), name: other.name || 'Mi pareja', avatar: other.avatar_url || '' };
      }
    } catch { /* sin perfiles: se intenta por presencia */ }
    return null;
  }

  // La fila de presencia del admin es legible por cualquier cuenta autenticada.
  try {
    const { data } = await supabase
      .from('content')
      .select('data')
      .eq('id', 'presence_admin')
      .maybeSingle();
    const payload = data?.data;
    if (payload?.user_id) {
      return { id: String(payload.user_id), name: payload.name || 'Mi pareja', avatar: payload.avatar || '' };
    }
  } catch { /* sin fila de presencia */ }
  return null;
}

async function readUserSeries(type, userId) {
  try {
    const { data, error } = await supabase
      .from('user_progress')
      .select('data')
      .eq('user_id', userId)
      .eq('type', type)
      .maybeSingle();
    if (error) return { data: null, error: error.code || 'rls' };
    return { data: data?.data ?? null, error: null };
  } catch {
    return { data: null, error: 'network' };
  }
}

/**
 * Datos de la pareja para la videoteca.
 * Devuelve { partner, podio, progress, error }.
 * error: 'sin-pareja' | 'sin-permiso' | 'sin-red' | null
 */
export async function loadPartnerData({ force = false } = {}) {
  if (!force && cache && Date.now() - cachedAt < CACHE_MS) return cache;

  const partner = await resolvePartner();
  if (!partner) {
    cache = { partner: null, podio: null, progress: null, error: 'sin-pareja' };
    cachedAt = Date.now();
    return cache;
  }

  const [podioRes, progressRes] = await Promise.all([
    readUserSeries('series_podio', partner.id),
    userStore.isAdmin
      ? readUserSeries('series_progress', partner.id)
      : Promise.resolve({ data: null, error: null }),
  ]);

  const error = podioRes.error === 'network' || progressRes.error === 'network'
    ? 'sin-red'
    : podioRes.error || progressRes.error
      ? 'sin-permiso'
      : null;

  cache = {
    partner,
    podio: podioRes.data && typeof podioRes.data === 'object' ? podioRes.data : null,
    progress: progressRes.data && typeof progressRes.data === 'object' ? progressRes.data : null,
    error
  };
  cachedAt = Date.now();
  return cache;
}

/** Valoración de la pareja para un título (0 si no hay). */
export function getPartnerRating(partnerProgress, itemId) {
  const entry = partnerProgress?.[itemId];
  const rating = Number(entry?.rating);
  return Number.isFinite(rating) && rating > 0 ? rating : 0;
}

/** Posición de la pareja en una serie (para mostrar progreso compartido). */
export function getPartnerProgress(partnerProgress, item) {
  const entry = partnerProgress?.[item?.id];
  if (!entry) return null;
  const watched = Array.isArray(entry.watched) ? entry.watched.length : 0;
  return { watched, movieWatched: entry.movieWatched === true, status: entry.status || '' };
}

export function clearPartnerCache() {
  cache = null;
  cachedAt = 0;
}
