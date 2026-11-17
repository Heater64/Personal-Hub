/* ==========================================
   FCM — envío a la app Android (HTTP v1)

   Sin dependencias: la autenticación es un JWT firmado con la clave de la
   cuenta de servicio (RS256) que se canjea por un access token de OAuth2.
   Ese access token dura una hora y se reutiliza entre invocaciones calientes.

   FCM_SERVICE_ACCOUNT (Vercel → Environment Variables) es el JSON completo
   de la cuenta de servicio, en una sola línea. Sin esa variable esto no
   envía nada y devuelve { configured: false }: la web sigue funcionando con
   Web Push como hasta ahora.

   Ningún valor de aquí va al cliente. El token del dispositivo SÍ es del
   cliente (es suyo), pero la firma que puede enviarle, no.
   ========================================== */

import { createSign } from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

// Un access token cacheado por instancia caliente. La clave (email de la
// cuenta) evita reutilizar uno viejo si se rota el secreto.
let cached = null;

function credentials() {
  const raw = process.env.FCM_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed?.project_id || !parsed?.client_email || !parsed?.private_key) return null;
    return parsed;
  } catch {
    console.error('[fcm] FCM_SERVICE_ACCOUNT no es un JSON válido');
    return null;
  }
}

/** ¿Hay credenciales de FCM configuradas? (para responder con criterio) */
export function fcmConfigured() {
  return !!credentials();
}

function b64url(value) {
  return Buffer.from(value).toString('base64url');
}

async function accessTokenFor(sa) {
  const now = Date.now();
  if (cached && cached.key === sa.client_email && cached.expiresAt > now + 60_000) {
    return cached.accessToken;
  }

  const iat = Math.floor(now / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600 })
  );

  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const signature = signer.sign(sa.private_key, 'base64url');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${signature}`
    })
  });

  if (!res.ok) {
    throw new Error(`FCM auth ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  const data = await res.json();
  cached = {
    accessToken: data.access_token,
    expiresAt: now + (Number(data.expires_in) || 3600) * 1000,
    key: sa.client_email
  };
  return cached.accessToken;
}

/**
 * Convierte el payload de Web Push al mensaje de FCM.
 *
 * Web Push manda un JSON libre; FCM v1 exige `notification` para pintar el
 * aviso y `data` con valores **solo de tipo string**. `delivery_id` viaja
 * igual que en la web, aunque el acuse lo cumplimenta el service worker:
 * un mensaje nativo no tiene ese canal de vuelta.
 */
function buildMessage(deviceToken, payload) {
  const data = {};
  for (const [key, value] of Object.entries(payload || {})) {
    if (value === null || value === undefined) continue;
    data[key] = typeof value === 'string' ? value : String(value);
  }

  return {
    message: {
      token: deviceToken,
      notification: {
        title: payload?.title || 'Hub🧸',
        body: payload?.body || ''
      },
      data,
      android: {
        priority: 'high',
        notification: {
          // Sin channel_id: la app no crea canales propios, así que se usa el
          // canal por defecto del sistema. Un channel inexistente con Android 8+
          // descarta el aviso.
          default_sound: true,
          default_vibrate_timings: true
        }
      }
    }
  };
}

/** Un token que el servicio ya no reconoce: hay que borrarlo de la base. */
function isDeadToken(status, body) {
  if (status === 404) return true;
  return /UNREGISTERED|not a valid FCM registration token|registration token is not valid/i.test(body || '');
}

/**
 * Envía el mismo payload a una lista de tokens FCM.
 *
 * Devuelve `{ sent, failed, removed }`; `removed` son los tokens caducados
 * (app desinstalada, token rotado) que el llamante debe borrar.
 */
export async function sendFcmToTokens(tokens, payload) {
  const list = (tokens || []).filter(t => typeof t === 'string' && t.length > 20);
  const sa = credentials();
  if (!sa) return { sent: 0, failed: 0, removed: [], configured: false };
  if (list.length === 0) return { sent: 0, failed: 0, removed: [], configured: true };

  let accessToken;
  try {
    accessToken = await accessTokenFor(sa);
  } catch (err) {
    console.error('[fcm] no se pudo autenticar:', err.message);
    return { sent: 0, failed: list.length, removed: [], configured: true };
  }

  const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  const result = { sent: 0, failed: 0, removed: [], configured: true };

  for (const deviceToken of list) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify(buildMessage(deviceToken, payload))
      });

      if (res.ok) {
        result.sent++;
        continue;
      }

      const body = await res.text();
      if (isDeadToken(res.status, body)) {
        result.removed.push(deviceToken);
      } else {
        result.failed++;
        console.warn('[fcm] envío fallido', res.status, body.slice(0, 160));
      }
    } catch (err) {
      result.failed++;
      console.warn('[fcm] error de red:', err.message);
    }
  }

  return result;
}
