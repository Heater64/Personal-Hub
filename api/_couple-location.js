export const LOCATION_EVENT_MAX_AGE_MS = 10 * 60 * 1000;
export const GEOFENCE_MAX_ACCURACY_M = 100;

/** Evita cambios de presencia basados en una lectura demasiado imprecisa. */
export function geofenceFixIsReliable(accuracy) {
  return Number.isFinite(accuracy) && accuracy >= 0 && accuracy <= GEOFENCE_MAX_ACCURACY_M;
}

/** Limpia una lectura antes de que el servidor la use para disparar avisos. */
export function cleanLocationEvent(input, now = Date.now()) {
  const lat = input?.lat;
  const lng = input?.lng;
  const accuracy = input?.accuracy;
  const locationAt = typeof input?.location_at === 'string' ? input.location_at : '';
  const timestamp = Date.parse(locationAt);

  if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90) return null;
  if (typeof lng !== 'number' || !Number.isFinite(lng) || lng < -180 || lng > 180) return null;
  if (!Number.isFinite(timestamp) || timestamp > now + 60_000 || now - timestamp > LOCATION_EVENT_MAX_AGE_MS) return null;
  if (accuracy != null && (typeof accuracy !== 'number' || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 10_000)) return null;

  return {
    lat,
    lng,
    accuracy: accuracy == null ? null : Math.round(accuracy),
    locationAt: new Date(timestamp).toISOString(),
  };
}

/** La persona que generó el evento nunca recibe su propio aviso de pareja. */
export function partnerUserIds(userId, members) {
  const current = String(userId || '');
  if (!current || !Array.isArray(members)) return [];
  return [...new Set(members
    .map(member => String(member?.user_id || ''))
    .filter(id => id && id !== current))];
}

/** El aviso inmediato solo puede llegar a miembros cuya cuenta sigue habilitada. */
export function enabledPartnerUserIds(userId, members, enabledUserIds) {
  const enabled = new Set((Array.isArray(enabledUserIds) ? enabledUserIds : [])
    .map(id => String(id || ''))
    .filter(Boolean));
  return partnerUserIds(userId, members).filter(id => enabled.has(id));
}
