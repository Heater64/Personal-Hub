/* ==========================================
   Clave VAPID de una suscripción push

   Una suscripción push queda ATADA para siempre a la clave VAPID con la que
   se creó: si el servidor firma con otra, el push service (FCM/Mozilla)
   responde 403 «the VAPID credentials ... do not correspond to the
   credentials used to create the subscriptions» y el aviso no llega nunca.

   Renovar las claves del servidor sin renovar las suscripciones de los
   navegadores deja a todo el mundo sin notificaciones y sin ningún error
   visible: el servidor solo cuenta «failed». `pushManager.getSubscription()`
   devuelve una suscripción vieja como si fuera válida, así que hay que
   comparar explícitamente su `applicationServerKey` con la clave actual
   antes de reutilizarla.

   Módulo puro (sin navegador ni Supabase) para poder probarlo en Node.
   ========================================== */

/**
 * Convierte base64 URL-safe (lo que da web-push) a bytes.
 * Chrome exige bytes en `applicationServerKey`; los navegadores ya devuelven
 * bytes en `subscription.options.applicationServerKey`.
 */
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/**
 * ¿La suscripción se creó con esta clave pública?
 *
 * Solo responde true cuando la comparación byte a byte es posible y coincide.
 */
export function subscriptionUsesKey(subscription, publicKeyBase64) {
  const current = subscription?.options?.applicationServerKey;
  if (!current || !publicKeyBase64) return false;

  const used = current instanceof Uint8Array ? current : new Uint8Array(current);
  const expected = urlBase64ToUint8Array(publicKeyBase64);
  if (used.length !== expected.length) return false;
  for (let i = 0; i < used.length; i++) {
    if (used[i] !== expected[i]) return false;
  }
  return true;
}

/**
 * ¿La suscripción está atada DEMOSTRABLEMENTE a otra clave?
 *
 * Solo true cuando hay dos claves que comparar y son distintas. Si el
 * navegador no expone `applicationServerKey` (Safari antiguo) o la clave
 * esperada está vacía (error de configuración), NO se renueva: cancelar una
 * suscripción válida por no poder comprobarla dejaría al dispositivo sin
 * avisos, y una clave vacía borraría todas. El caso que hay que curar es la
 * clave distinta, que sí se detecta.
 */
export function subscriptionKeyChanged(subscription, publicKeyBase64) {
  const current = subscription?.options?.applicationServerKey;
  if (!current || !publicKeyBase64) return false;
  return !subscriptionUsesKey(subscription, publicKeyBase64);
}
