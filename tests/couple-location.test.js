import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createVerify, generateKeyPairSync, randomUUID } from 'node:crypto';

import { cleanLocationEvent, enabledPartnerUserIds, geofenceFixIsReliable, partnerUserIds } from '../api/_couple-location.js';
import { buildMessage, sendFcmToTokens } from '../api/_fcm.js';
import { batteryLowPayload } from '../api/push.js';
import { performLocationRefresh } from '../tamp/src/services/location-refresh.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFile(path.join(ROOT, relative), 'utf8');

test('location events reject invalid coordinates and fixes that arrived too late', () => {
  const now = Date.parse('2026-11-24T10:00:00.000Z');
  const fresh = { lat: 39.5, lng: -0.3, accuracy: 24, location_at: '2026-11-24T09:59:00.000Z' };

  assert.deepEqual(cleanLocationEvent(fresh, now), {
    lat: 39.5, lng: -0.3, accuracy: 24, locationAt: '2026-11-24T09:59:00.000Z',
  });
  assert.equal(cleanLocationEvent({ ...fresh, lat: 91 }, now), null);
  assert.equal(cleanLocationEvent({ ...fresh, lng: 181 }, now), null);
  assert.equal(cleanLocationEvent({ ...fresh, lat: null }, now), null);
  assert.equal(cleanLocationEvent({ ...fresh, lng: '' }, now), null);
  assert.equal(cleanLocationEvent({ ...fresh, lat: '39.5' }, now), null);
  assert.equal(cleanLocationEvent({ ...fresh, accuracy: '' }, now), null);
  assert.equal(cleanLocationEvent({ ...fresh, location_at: '2026-11-24T09:40:00.000Z' }, now), null);
  assert.equal(cleanLocationEvent({ ...fresh, location_at: '2026-11-24T10:02:00.000Z' }, now), null);
});

test('geofence decisions wait for reliable fixes and require a confident entry', async () => {
  const migration = await read('sql/045_reliable_geofence_accuracy.sql');
  const api = await read('api/push.js');

  assert.equal(geofenceFixIsReliable(100), true);
  assert.equal(geofenceFixIsReliable(101), false);
  assert.equal(geofenceFixIsReliable(null), false);
  assert.match(migration, /p_accuracy_m IS NULL OR p_accuracy_m < 0 OR p_accuracy_m > 100/);
  assert.match(migration, /v_distance_m \+ p_accuracy_m <= v_place\.radius_m/);
  assert.match(migration, /v_distance_m <= v_place\.radius_m \+ v_margin_m/);
  assert.match(api, /geofenceFixIsReliable\(location\.accuracy\)/);
});

test('partner notifications never include the member who triggered them', () => {
  assert.deepEqual(partnerUserIds('self', [
    { user_id: 'self' }, { user_id: 'partner' }, { user_id: 'partner' }, { user_id: null },
  ]), ['partner']);
  assert.deepEqual(partnerUserIds('self', [{ user_id: 'self' }]), []);
});

test('partner refresh is requested even when this device cannot read its own location', async () => {
  let ownRead = false;
  let partnerAsked = false;

  const result = await performLocationRefresh({
    updateOwn: async () => { ownRead = true; return { updated: false, reason: 'prompt' }; },
    requestPartner: async () => {
      partnerAsked = true;
      return { sent: 1 };
    },
  });

  assert.equal(ownRead, true);
  assert.equal(partnerAsked, true);
  assert.deepEqual(result, {
    ok: true, requested: true, ownUpdated: false, location: null,
    reason: 'prompt', requestError: '',
  });
});

test('partner refresh starts without waiting for a slow own GPS fix', async () => {
  let releaseOwn;
  let partnerStarted = false;
  const pending = performLocationRefresh({
    updateOwn: () => new Promise(resolve => { releaseOwn = resolve; }),
    requestPartner: async () => {
      partnerStarted = true;
      return { sent: 1 };
    },
  });

  await Promise.resolve();
  assert.equal(partnerStarted, true);
  releaseOwn({ updated: false, reason: 'timeout' });
  const result = await pending;
  assert.equal(result.requested, true);
  assert.equal(result.ownUpdated, false);
});

test('partner refresh failure is reported separately from a successful own refresh', async () => {
  const result = await performLocationRefresh({
    updateOwn: async () => ({ updated: true, location: { lat: 39.5, lng: -0.3 } }),
    requestPartner: async () => { throw new Error('network'); },
  });

  assert.equal(result.ok, true);
  assert.equal(result.ownUpdated, true);
  assert.equal(result.requested, false);
  assert.equal(result.requestError, 'network');
  assert.deepEqual(result.location, { lat: 39.5, lng: -0.3 });
});

test('immediate partner alerts only target enabled profiles', () => {
  const members = [
    { user_id: 'self' }, { user_id: 'active-partner' },
    { user_id: 'disabled-partner' }, { user_id: 'active-partner' },
  ];
  assert.deepEqual(enabledPartnerUserIds('self', members, ['active-partner']), ['active-partner']);
  assert.deepEqual(enabledPartnerUserIds('self', members, []), []);
});

test('server API errors never return raw provider exception messages', async () => {
  const push = await read('api/push.js');
  const users = await read('api/users.js');

  assert.doesNotMatch(push, /\.json\(\{\s*error:\s*err\.message/);
  assert.doesNotMatch(push, /\$\{error\.message/);
  assert.doesNotMatch(users, /\.json\(\{\s*error:\s*(?:err|error)\.message/);
});

test('the missing-location notice explains that the shared map can still show the partner', async () => {
  const sheet = await read('tamp/src/components/DistanceMapSheet.js');

  assert.match(sheet, /Sin permiso no se comparte tu ubicación ni se calcula la distancia/);
  assert.match(sheet, /El mapa puede seguir mostrando los datos de tu pareja/);
  assert.doesNotMatch(sheet, /Sin permiso no hay distancia ni mapa/);
});

test('the map exposes tile loading and network failures instead of staying silently dark', async () => {
  const sheet = await read('tamp/src/components/DistanceMapSheet.js');
  const css = await read('tamp/src/styles/distance-map.css');

  assert.match(sheet, /data-map-state role="status" aria-live="polite"/);
  assert.match(sheet, /tileLayer\.on\('loading'/);
  assert.match(sheet, /tileLayer\.on\('tileerror'/);
  assert.match(sheet, /No se pudieron cargar los mosaicos del mapa/);
  assert.match(sheet, /new ResizeObserver\(invalidateMapSize\)/,
    'el mapa se reajusta cuando la transición o el layout cambian el tamaño del contenedor');
  assert.match(sheet, /requestAnimationFrame\(\(\) => requestAnimationFrame\(invalidateMapSize\)\)/,
    'espera a que el navegador pinte el tamaño final antes de recalcular las teselas');
  assert.match(sheet, /_mapResizeObserver\?\.disconnect\(\)/,
    'desconecta el observador al vaciar o desmontar el mapa');
  assert.match(css, /\.distmap__canvas\.leaflet-container\s*\{[^}]*color-scheme:\s*light/s,
    'las teselas de OpenStreetMap no deben recibir el oscurecimiento forzado del navegador');
});

test('the full map renders immediately while location requests are still pending', async () => {
  const page = await read('tamp/src/pages/Mapa.js');
  const sheet = await read('tamp/src/components/DistanceMapSheet.js');

  assert.doesNotMatch(page, /Buscando las dos posiciones/,
    'no debe ocupar toda la pantalla con una vista negra mientras espera la red');
  assert.match(page, /pintar\(\{\s*me:\s*fetchMyLocation\(\),\s*partner:\s*null,\s*km:\s*null\s*\}\);/,
    'crea el mapa base inmediatamente, antes de recibir las posiciones remotas');
  assert.match(sheet, /map\.setView\(\[40\.4,\s*-3\.7\],\s*5\)/,
    'sin una posición todavía, usa una vista genérica de España y no un punto personal');
  assert.match(sheet, /if \(!points\.length\) \{\s*\/\/ La vista genérica ya muestra el mapa base/,
    'el estado sin posiciones no debe leer el primer marcador que aún no existe');
  assert.match(sheet, /!wrap\._hasCenteredOnData/,
    'al llegar la primera ubicación centra el mapa una vez y después respeta el movimiento manual');
});

test('partner profile lookup cannot delay or overwrite the newest map position', async () => {
  const page = await read('tamp/src/pages/Mapa.js');
  const watch = page.slice(page.indexOf('const parar = watchDistance'), page.indexOf("page.addEventListener('click'"));

  assert.doesNotMatch(watch, /await fetchProfile\(/,
    'name/avatar are optional and must not hold up a known GPS position');
  assert.match(watch, /pintar\(currentModel\);[\s\S]*?void fetchProfile\(pedirPerfil\)/,
    'render the current coordinates before starting the optional profile request');
  assert.match(watch, /ultimoModelo/,
    'late profile responses must enrich the latest location rather than restore an old one');
});

test('a location refresh is a high priority data-only FCM message', () => {
  const message = buildMessage('fcm-device-token-that-is-long-enough', { type: 'location_refresh' });

  assert.deepEqual(message.message.data, { type: 'location_refresh' });
  assert.equal(message.message.android.priority, 'high');
  assert.equal(message.message.android.ttl, '300s');
  assert.equal('notification' in message.message, false);
});

test('a battery threshold produces an immediate FCM notification for the map', async () => {
  const payload = batteryLowPayload('Darwin', 20);
  const message = buildMessage('fcm-device-token-that-is-long-enough', payload).message;

  assert.equal(payload.type, 'battery_low');
  assert.match(payload.body, /Darwin tiene 20% de batería/);
  assert.match(payload.body, /ubicación se pausó hasta llegar al 30%/);
  assert.equal(payload.url, '/mapa');
  assert.equal(message.notification.title, 'Batería baja');
  assert.equal(message.data.type, 'battery_low');
  assert.equal(message.data.url, '/mapa');
  assert.equal(message.android.priority, 'high');
  assert.equal(message.android.ttl, '300s', 'a delayed battery warning must expire instead of showing stale state');

  const api = await read('api/push.js');
  assert.match(api, /level < 0 \|\| level > 20/);
  assert.match(api, /await activePartnerUserIds\(supabase, user\.id, members\);[\s\S]*?sendTokensToUsers\(recipients, batteryLowPayload/);
  assert.equal((api.match(/await activePartnerUserIds\(supabase, user\.id, members\)/g) || []).length, 3,
    'batería, refresh y geocerca deben respetar profiles.enabled');
  assert.match(api, /async function activePartnerUserIds[\s\S]*?\.from\('profiles'\)[\s\S]*?\.eq\('enabled', true\)/);
});

test('arrival and departure pushes expire while offline; routine pushes keep their default lifetime', () => {
  const urgentPayloads = [
    { type: 'place_arrival', title: 'Lugar compartido', body: 'Aviso urgente' },
    { type: 'place_departure', title: 'Lugar compartido', body: 'Aviso urgente' },
    { tag: 'admin-mood', title: 'Ánimo', body: 'Aviso urgente' },
    { tag: 'admin-mood-bad', title: 'Ánimo', body: 'Aviso urgente' },
  ];
  for (const payload of urgentPayloads) {
    const message = buildMessage('fcm-device-token-that-is-long-enough', payload).message;
    assert.equal(message.android.priority, 'high');
    assert.equal(message.android.ttl, '300s');
  }

  const routine = buildMessage('fcm-device-token-that-is-long-enough', {
    type: 'daily_reminder', title: 'Recordatorio', body: 'Rutina',
  }).message;
  assert.equal(routine.android.priority, 'high');
  assert.equal(routine.android.ttl, undefined);
});

test('the invalid-action response lists every action handled by the push API', async () => {
  const api = await read('api/push.js');
  const dispatch = api.match(/switch \(action\) \{([\s\S]*?)\n\s*default:/)?.[1] || '';
  const registered = [...dispatch.matchAll(/case '([^']+)':/g)].map((match) => match[1]);
  const advertised = api.match(/Invalid action\. Use: ([^']+)'/)?.[1]
    .split(', ')
    .filter(Boolean) || [];

  assert.deepEqual(new Set(advertised), new Set(registered));
});

test('native token removal is authenticated and can only delete the current account token', async () => {
  const api = await read('api/push.js');
  const dispatch = api.match(/switch \(action\) \{([\s\S]*?)\n\s*default:/)?.[1] || '';
  const handler = api.slice(api.indexOf('async function handleUnregisterToken'), api.indexOf('// ==========================================\n// SUBSCRIBE', api.indexOf('async function handleUnregisterToken')));

  assert.match(dispatch, /case 'token-unregister':[\s\S]*?handleUnregisterToken/);
  assert.match(handler, /const user = await authenticate\(req, res, \{ allowDisabled: true \}\)/);
  assert.match(handler, /\.delete\(\)[\s\S]*?\.eq\('user_id', user\.id\)[\s\S]*?\.eq\('token', token\)/);
  assert.match(api, /async function authenticate\(req, res, \{ allowDisabled = false \} = \{\}\)/);
  assert.match(api, /if \(!allowDisabled && profile && profile\.enabled === false\)/,
    'only the token revocation endpoint opts out of the disabled-account check');
  assert.equal((api.match(/allowDisabled: true/g) || []).length, 1,
    'no other push action may opt out of the disabled-account guard');
});

test('FCM valida la firma de servicio, entrega y elimina tokens revocados', async () => {
  const oldFetch = globalThis.fetch;
  const oldCredentials = process.env.FCM_SERVICE_ACCOUNT;
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const email = `test-${randomUUID()}@personal-hub.iam.gserviceaccount.com`;
  const requests = [];
  let activeSends = 0;
  let maximumConcurrentSends = 0;
  let tokenExchanges = 0;
  process.env.FCM_SERVICE_ACCOUNT = JSON.stringify({
    project_id: 'personal-hub-test',
    client_email: email,
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  });
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (url === 'https://oauth2.googleapis.com/token') {
      tokenExchanges++;
      assert.ok(init.signal, 'OAuth exchange must have a bounded request lifetime');
      const assertion = new URLSearchParams(init.body).get('assertion');
      const [header, claims, signature] = assertion.split('.');
      const verifier = createVerify('RSA-SHA256');
      verifier.update(`${header}.${claims}`);
      verifier.end();
      assert.ok(verifier.verify(publicKey, Buffer.from(signature, 'base64url')));
      const decodedClaims = JSON.parse(Buffer.from(claims, 'base64url').toString('utf8'));
      assert.equal(decodedClaims.iss, email);
      assert.equal(decodedClaims.scope, 'https://www.googleapis.com/auth/firebase.messaging');
      return { ok: true, status: 200, json: async () => ({ access_token: 'test-access-token', expires_in: 3600 }) };
    }
    if (!url.endsWith('/messages:send')) throw new Error(`Unexpected FCM request: ${url}`);
    assert.ok(init.signal, 'each FCM device send must have a bounded request lifetime');
    assert.equal(init.headers.authorization, 'Bearer test-access-token');
    const body = JSON.parse(init.body);
    requests.push(body.message);
    activeSends++;
    maximumConcurrentSends = Math.max(maximumConcurrentSends, activeSends);
    await new Promise(resolve => setTimeout(resolve, 20));
    activeSends--;
    if (body.message.token === 'expired-registration-token-123456789') {
      return { ok: false, status: 404, text: async () => 'UNREGISTERED' };
    }
    return { ok: true, status: 200, json: async () => ({ name: 'projects/personal-hub-test/messages/1' }) };
  };

  try {
    const result = await sendFcmToTokens([
      'active-registration-token-123456789',
      'expired-registration-token-123456789',
    ], { type: 'battery_low', title: 'Batería baja', body: 'Ha llegado al 20%' });

    assert.equal(tokenExchanges, 1);
    assert.equal(maximumConcurrentSends, 2, 'FCM sends to partner devices must not block each other');
    assert.deepEqual(result, {
      sent: 1,
      failed: 0,
      removed: ['expired-registration-token-123456789'],
      configured: true,
    });
    assert.equal(requests[0].android.priority, 'high');
    assert.equal(requests[0].data.type, 'battery_low');
    assert.equal(requests[1].token, 'expired-registration-token-123456789');
  } finally {
    globalThis.fetch = oldFetch;
    if (oldCredentials === undefined) delete process.env.FCM_SERVICE_ACCOUNT;
    else process.env.FCM_SERVICE_ACCOUNT = oldCredentials;
  }
});

test('Android delegates visible FCM alerts to Capacitor and reserves custom handling for data-only jobs', async () => {
  const service = await read('android/app/src/main/java/com/heater64/personalhub/WidgetMessagingService.java');
  const plugin = await read('node_modules/@capacitor/push-notifications/android/src/main/java/com/capacitorjs/plugins/pushnotifications/MessagingService.java');

  assert.match(service, /if \("location_refresh"\.equals\(message\.getData\(\)\.get\("type"\)\)\)[\s\S]*?return;[\s\S]*?if \("widget_sync"\.equals\(message\.getData\(\)\.get\("type"\)\)\)[\s\S]*?return;[\s\S]*?super\.onMessageReceived\(message\);/);
  assert.match(plugin, /public void onMessageReceived\(@NonNull RemoteMessage remoteMessage\)[\s\S]*?PushNotificationsPlugin\.sendRemoteMessage\(remoteMessage\)/);

  const message = buildMessage('fcm-device-token-that-is-long-enough', batteryLowPayload('Darwin', 20)).message;
  assert.ok(message.notification, 'battery and arrival alerts carry a notification payload for background tray display');
  assert.equal(message.data.type, 'battery_low');
});

test('shared places are couple-scoped and only the API can claim geofence transitions', async () => {
  const sql = await read('sql/040_lugares_compartidos.sql');
  const api = await read('api/push.js');

  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.couple_places/);
  assert.match(sql, /couple_id = public\.current_couple_id\(\)/);
  assert.match(sql, /CREATE POLICY couple_places_member_insert[\s\S]*?couple_id = public\.current_couple_id\(\)[\s\S]*?created_by = auth\.uid\(\)/,
    'both enabled members may add a place to their shared couple');
  assert.match(sql, /CREATE POLICY couple_places_member_update[\s\S]*?couple_id = public\.current_couple_id\(\)/,
    'both enabled members may edit shared places');
  assert.match(sql, /claim_couple_place_entries/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /last_location_at/);
  assert.match(sql, /event_type IN \('arrival', 'departure'\)/);
  assert.match(sql, /radius_m BETWEEN 10 AND 1000/);
  assert.match(sql, /ELSIF NOT v_inside AND COALESCE\(v_old_inside, FALSE\)/);
  assert.match(sql, /ON CONFLICT ON CONSTRAINT couple_place_presence_pkey/,
    'avoid ambiguity with the place_id output column of the table-returning PL/pgSQL function');
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.claim_couple_place_entries[^;]+ TO service_role/);
  assert.match(api, /case 'location-update':[\s\S]*?case 'request-location'/);
  assert.match(api, /supabase\.rpc\('claim_couple_place_entries'/);
  assert.match(api, /activePartnerUserIds\(supabase, user\.id, members\)/);
  assert.match(api, /type: event\.event_type === 'departure' \? 'place_departure' : 'place_arrival'/);
  assert.match(api, /Ha salido de \$\{event\.place_name\}/);
  assert.match(api, /Ha llegado a \$\{event\.place_name\}/);
});

test('geofence arrival uses the configured radius and applies tolerance only to exit', async () => {
  const migration = await read('sql/043_geofence_radius_accuracy.sql');

  assert.match(migration, /ON CONFLICT ON CONSTRAINT couple_place_presence_pkey/,
    'avoid ambiguity with the place_id output column of the table-returning PL/pgSQL function');
  assert.match(migration, /v_inside := v_distance_m <= v_place\.radius_m\s*\+\s*CASE WHEN COALESCE\(v_old_inside, FALSE\) THEN v_margin_m ELSE 0 END/,
    'an arrival must not be raised outside the radius configured by the couple');
  assert.match(migration, /v_margin_m := LEAST\(100, GREATEST\(30, COALESCE\(p_accuracy_m, 0\)\)\)/,
    'a small exit tolerance prevents GPS jitter from toggling the geofence');
});

test('pending place events cannot cross a user membership change between couples', async () => {
  const migration = await read('sql/044_scope_place_events_to_current_couple.sql');
  const api = await read('api/push.js');

  assert.match(migration, /p_couple_id UUID/);
  assert.match(migration, /v_couple_id <> p_couple_id/,
    'the RPC must reject a couple ID that no longer matches the caller membership');
  assert.match(migration, /event\.couple_id = v_couple_id/,
    'pending events are limited to the current couple');
  assert.match(migration, /ON CONFLICT ON CONSTRAINT couple_place_presence_pkey/,
    'the scoped RPC must avoid ambiguity with its place_id output column');
  assert.match(api, /rpc\('claim_couple_place_entries',\s*\{[^}]*p_couple_id:\s*membership\.couple_id/s);
  const finishCalls = [...api.matchAll(/rpc\('finish_couple_place_entries',\s*\{([\s\S]*?)\}\)/g)];
  assert.equal(finishCalls.length, 3, 'failure, success, and retry paths all finish claimed events');
  assert.ok(finishCalls.every(([, args]) => /p_couple_id:\s*membership\.couple_id/.test(args)),
    'all paths finish only events from the couple that claimed them');
});

test('the Android service refreshes on a partner request and reports new location fixes', async () => {
  const messaging = await read('android/app/src/main/java/com/heater64/personalhub/WidgetMessagingService.java');
  const service = await read('android/app/src/main/java/com/heater64/personalhub/DeviceStatusService.java');
  const fcm = await read('api/_fcm.js');

  assert.match(messaging, /location_refresh[\s\S]*?showLocationRefreshNotification[\s\S]*?DeviceStatusService\.requestLocationUpdate/);
  assert.match(messaging, /NotificationManagerCompat\.from\(this\)\.notify/);
  assert.match(messaging, /POST_NOTIFICATIONS/);
  assert.match(service, /static void requestLocationUpdate\(Context context\)/);
  assert.match(service, /sendLocationEvent|api\/push\?action=location-update/);
  assert.match(fcm, /collapse_key: 'location_refresh'/);
});

test('the map refreshes live data without recreating the map and supports shared places', async () => {
  const location = await read('tamp/src/services/location.service.js');
  const map = await read('tamp/src/components/DistanceMapSheet.js');
  const screen = await read('tamp/src/pages/Mapa.js');

  assert.match(location, /postgres_changes[\s\S]*?table: 'couple_locations'/);
  assert.match(location, /refreshBothLocations/);
  assert.match(location, /performLocationRefresh\(/,
    'the map must request the partner refresh even when the own GPS read fails');
  assert.match(location, /from\('couple_places'\)\.insert/);
  assert.match(location, /updateSharedPlace/);
  assert.match(location, /\[10, 20, 50, 75, 150, 300, 500, 1000\]/);
  assert.match(map, /data-edit-place/);
  assert.match(map, /distmap__place-label/);
  assert.match(map, /Siempre activo/);
  assert.match(map, /Ubicación en pausa/);
  assert.match(map, /Última lectura \$\{updated \|\| 'antigua'\}/);
  assert.match(map, /Mbps estimados/);
  assert.match(map, /batteryTile\(person, stale, updated\)/);
  assert.match(map, /const locationUpdated = timeAgo\(person\.at\)/);
  assert.match(map, /if \(Number\.isFinite\(person\.speed\)\) \{[\s\S]*?locationStale/);
  assert.match(map, /if \(Number\.isFinite\(person\.accuracy\)\) \{[\s\S]*?locationStale/);
  assert.match(map, /stale \? 'Sin señal' : person\.batteryPaused \? 'Ubicación en pausa'/);
  assert.match(map, /Actualizar ahora/);
  assert.match(map, /Ver ambos/);
  assert.match(map, /watchSharedPlaces/);
  assert.match(map, /coordinates\.length === 1\) map\.setView\(coordinates\[0\], 13\)/);
  assert.ok(map.indexOf('canvas.replaceChildren()') < map.indexOf('L.map(canvas'),
    'el estado vacío se elimina antes de que Leaflet añada sus capas y controles');
  assert.match(screen, /vista\._refresh\(model\)/);
});
