/* Contratos que impiden volver a presentar una posición antigua como actual. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFile(path.join(ROOT, relative), 'utf8');

test('el servicio conserva la hora real de la ubicación y su antigüedad', async () => {
  const service = await read('android/app/src/main/java/com/heater64/personalhub/DeviceStatusService.java');

  assert.match(service, /data\.put\("location_at", isoAt\(location\.getTime\(\)\)\)/);
  assert.match(service, /data\.put\("location_age_ms", Math\.max\(0L, System\.currentTimeMillis\(\) - location\.getTime\(\)\)\)/);
  assert.match(service, /previous\.optString\("location_at"/);
});

test('un reinicio no intenta iniciar ubicación sin permiso permanente', async () => {
  const receiver = await read('android/app/src/main/java/com/heater64/personalhub/BootReceiver.java');

  assert.match(receiver, /hasBackgroundLocationPermission/);
});

test('la aplicación deja de permitir backups de tokens o datos de widgets', async () => {
  const manifest = await read('android/app/src/main/AndroidManifest.xml');
  const legacyRules = await read('android/app/src/main/res/xml/backup_rules.xml');
  const modernRules = await read('android/app/src/main/res/xml/data_extraction_rules.xml');

  assert.match(manifest, /android:allowBackup="false"/);
  assert.match(manifest, /android:fullBackupContent="@xml\/backup_rules"/);
  assert.match(manifest, /android:dataExtractionRules="@xml\/data_extraction_rules"/);
  assert.equal((legacyRules.match(/<exclude\b/g) || []).length, 9);
  assert.equal((modernRules.match(/<exclude\b/g) || []).length, 18);
});

test('las notificaciones FCM y locales usan un canal Android que la app crea', async () => {
  const manifest = await read('android/app/src/main/AndroidManifest.xml');
  const strings = await read('android/app/src/main/res/values/strings.xml');
  const localManager = await read('node_modules/@capacitor/local-notifications/android/src/main/kotlin/com/capacitorjs/plugins/localnotifications/LocalNotificationManager.kt');
  const localPlugin = await read('node_modules/@capacitor/local-notifications/android/src/main/kotlin/com/capacitorjs/plugins/localnotifications/LocalNotificationsPlugin.kt');

  assert.match(manifest, /android:name="com\.google\.firebase\.messaging\.default_notification_channel_id"\s+android:value="@string\/default_notification_channel_id"/);
  assert.match(strings, /<string name="default_notification_channel_id">default<\/string>/);
  assert.match(localManager, /DEFAULT_NOTIFICATION_CHANNEL_ID = "default"/);
  assert.match(localPlugin, /manager\.createNotificationChannel\(\)/);
});

test('la ubicación compartida se aísla por pareja y no por rol', async () => {
  const sql = await read('sql/029_pareja_ubicacion.sql');

  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.couple_locations/);
  assert.match(sql, /PRIMARY KEY \(couple_id, user_id\)/);
  assert.match(sql, /user_id = auth\.uid\(\)/);
  assert.match(sql, /couple_id = public\.current_couple_id\(\)/);
  assert.doesNotMatch(sql, /is_admin\(\)/);
});

test('el bootstrap de la pareja se detiene antes de elegir usuarios ambiguos', async () => {
  const sql = await read('sql/030_inicializar_pareja_actual.sql');

  assert.match(sql, /array_length\(member_ids, 1\), 0\) <> 2/);
  assert.match(sql, /no se creó ninguna pareja/);
  assert.match(sql, /INSERT INTO public\.couple_members/);
});

test('el cliente distingue que el servicio está en marcha de que fue activado', async () => {
  const device = await read('tamp/src/services/device.service.js');
  const plugin = await read('android/app/src/main/java/com/heater64/personalhub/DeviceStatusPlugin.java');

  assert.match(plugin, /out\.put\("enabled", prefs\.getBoolean\("enabled", false\)\)/);
  assert.match(plugin, /out\.put\("running", DeviceStatusService\.isRunning\(\)\)/);
  assert.match(plugin, /out\.put\("locationServices", locationServicesState\(context\)\)/);
  assert.match(device, /running: res\?\.running === true/);
  assert.match(device, /locationServices: res\?\.locationServices/);
});

test('el servicio publica fuera del hilo principal y solo confirma envíos aceptados', async () => {
  const service = await read('android/app/src/main/java/com/heater64/personalhub/DeviceStatusService.java');
  const plugin = await read('android/app/src/main/java/com/heater64/personalhub/DeviceStatusPlugin.java');

  assert.match(service, /ExecutorService io = Executors\.newSingleThreadExecutor\(\)/);
  assert.match(service, /io\.execute\(\(\) -> \{\s*String error = publish\(\)/);
  assert.match(service, /if \(code >= 200 && code < 300\) \{[\s\S]*?return ""/);
  assert.match(service, /if \(error\.isEmpty\(\)\) edit\.putString\("last_sent_at", at\)/);
  assert.match(plugin, /out\.put\("lastAt", prefs\.getString\("last_sent_at", ""\)\)/);
  assert.match(plugin, /out\.put\("lastAttemptAt", prefs\.getString\("last_attempt_at", ""\)\)/);
});

test('la tarjeta del mapa conserva el modo real del servicio Android', async () => {
  const device = await read('tamp/src/services/device.service.js');
  const location = await read('tamp/src/services/location.service.js');

  assert.match(device, /facts\.bg = background\.native && background\.enabled && background\.running/);
  assert.match(location, /if \(typeof shared\.bg === 'boolean'\) facts\.bg = shared\.bg/);
  assert.match(location, /onDeviceStatus\(status => \{[\s\S]*?status\.background\.running === true/);
  assert.match(location, /sharedBackgroundState = current;[\s\S]*?void push\(self, onStatus\)/);
});

test('la alerta de batería baja pasa la API al servicio y se reintenta hasta que FCM entrega', async () => {
  const device = await read('tamp/src/services/device.service.js');
  const service = await read('android/app/src/main/java/com/heater64/personalhub/DeviceStatusService.java');

  assert.match(device, /apiOrigin,/);
  assert.match(service, /battery_paused.*battery_alert_delivered/s);
  assert.match(service, /sendBatteryAlert\(config, level\)/);
  assert.match(service, /optInt\("sent", 0\)/);
  assert.match(service, /delay = Math\.min\(delay, RETRY_MS\)/);
  assert.match(service, /level >= 30[\s\S]*?remove\("battery_alert_delivered"\)/);
});

test('el APK siempre recibe un origen API seguro para alertas nativas', async () => {
  const device = await read('tamp/src/services/device.service.js');
  const example = await read('.env.example');

  assert.match(device, /new URL\(import\.meta\.env\.VITE_NATIVE_API_ORIGIN \|\| window\.location\.origin\)/);
  assert.doesNotMatch(device, /DEFAULT_NATIVE_API_ORIGIN/);
  assert.match(example, /VITE_NATIVE_API_ORIGIN=https:\/\/personal-hub-alpha\.vercel\.app/);
});

test('Capacitor respeta la URL remota configurada y exige HTTPS', async () => {
  const config = await read('capacitor.config.ts');

  assert.match(config, /const remoteUrl = process\.env\.CAP_SERVER_URL\?\.trim\(\) \|\| ''/);
  assert.match(config, /new URL\(remoteUrl\)/);
  assert.match(config, /parsedRemoteUrl\.protocol !== 'https:'/);
});

test('Capacitor no escribe resultados nativos con sesión o ubicación en Logcat', async () => {
  const config = await read('capacitor.config.ts');

  assert.match(config, /loggingBehavior:\s*'none'/,
    'el bridge de Capacitor registra respuestas completas de plugins si el modo debug está activo');
});

test('la alerta al 20% usa una cola urgente y la telemetría pausada sigue sincronizándose', async () => {
  const service = await read('android/app/src/main/java/com/heater64/personalhub/DeviceStatusService.java');
  const pausedBranch = service.slice(service.indexOf('private String publish()'));
  const batteryLevelHandler = service.slice(
    service.indexOf('private void handleBatteryLevel'),
    service.indexOf('private void updateBatteryPauseNotification')
  );
  const urgentQueue = service.slice(
    service.indexOf('private void scheduleBatteryAlert'),
    service.indexOf('private void sendBatteryAlert')
  );

  assert.match(batteryLevelHandler, /scheduleBatteryAlert\(\)/,
    'el cambio de batería agenda el aviso sin esperar al tick de ubicación');
  assert.match(urgentQueue, /batteryAlerts\.execute\(/,
    'el aviso usa un executor independiente de la subida de ubicación');
  assert.match(urgentQueue, /batteryAlertSending/,
    'el mismo aviso no se agenda más de una vez mientras sigue en vuelo');
  assert.match(pausedBranch, /publishBatteryPausedStatus\(config\)/,
    'la app sigue sincronizando batería y la última ubicación válida');
  assert.doesNotMatch(pausedBranch, /sendBatteryAlert\(/,
    'la subida serializada de ubicación no debe bloquear el aviso urgente');
});

test('el aviso de batería renueva la sesión ante un 401 y reintenta inmediatamente', async () => {
  const service = await read('android/app/src/main/java/com/heater64/personalhub/DeviceStatusService.java');
  const alert = service.slice(service.indexOf('private void sendBatteryAlert'), service.indexOf('private void handleConnectionChange'));

  assert.match(alert, /BatteryAlertResponse response = postBatteryAlert\(config, level, session\)/);
  assert.match(alert, /if \(response\.status\(\) == 401\)[\s\S]*?renewSession\(config, session\.accessToken\(\)\)[\s\S]*?shouldRetryBatteryAlert\([\s\S]*?postBatteryAlert\(config, level, renewed\)/);
  assert.match(alert, /conn\.setInstanceFollowRedirects\(false\)/,
    'el token no debe seguir una redirección de la API');
  assert.match(service, /static boolean shouldRetryBatteryAlert\(int status, Session current, Session renewed\)/);
});

test('el aviso de llegada renueva la sesión si caduca justo tras guardar la ubicación', async () => {
  const service = await read('android/app/src/main/java/com/heater64/personalhub/DeviceStatusService.java');
  const locationNotice = service.slice(service.indexOf('private void notifyLocationUpdate'), service.indexOf('private HttpURLConnection open'));

  assert.match(locationNotice, /postLocationUpdate\(config, location, session\)/);
  assert.match(locationNotice, /if \(status == 401\)[\s\S]*?renewSession\(config, session\.accessToken\(\)\)[\s\S]*?shouldRetryLocationUpdate\([\s\S]*?postLocationUpdate\(config, location, renewed\)/);
  assert.match(service, /static boolean shouldRetryLocationUpdate\(int status, Session current, Session renewed\)/);
});

test('el servicio conserva y muestra cuando una geocerca no pudo evaluarse por poca precisión', async () => {
  const service = await read('android/app/src/main/java/com/heater64/personalhub/DeviceStatusService.java');
  const plugin = await read('android/app/src/main/java/com/heater64/personalhub/DeviceStatusPlugin.java');
  const sheet = await read('tamp/src/components/DistanceMapSheet.js');

  assert.match(service, /geofence_accuracy_warning/);
  assert.match(plugin, /geofenceAccuracyWarning/);
  assert.match(sheet, /geofenceAccuracyWarning[\s\S]*?precisión[\s\S]*?lugares compartidos/i);
});

test('los textos de widgets no bajan de 11sp para conservar legibilidad', async () => {
  const layoutDir = path.join(ROOT, 'android/app/src/main/res/layout');
  const files = (await readdir(layoutDir)).filter(file => file.endsWith('.xml'));
  const layouts = await Promise.all(files.map(file => readFile(path.join(layoutDir, file), 'utf8')));
  const undersized = layouts.flatMap((xml, index) =>
    [...xml.matchAll(/android:textSize="(\d+)sp"/g)]
      .filter(match => Number(match[1]) < 11)
      .map(match => `${files[index]}: ${match[1]}sp`));

  assert.deepEqual(undersized, []);
});

test('los iconos adaptativos incluyen capa monocroma para Android 13 y posteriores', async () => {
  const launcher = await read('android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml');
  const round = await read('android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml');

  assert.match(launcher, /<monochrome\b[^>]*@mipmap\/ic_launcher_foreground/);
  assert.match(round, /<monochrome\b[^>]*@mipmap\/ic_launcher_foreground/);
});

test('al pausar por batería el mapa recibe la telemetría sin inventar ubicación ni geocercas', async () => {
  const service = await read('android/app/src/main/java/com/heater64/personalhub/DeviceStatusService.java');
  const location = await read('tamp/src/services/location.service.js');
  const sheet = await read('tamp/src/components/DistanceMapSheet.js');

  assert.match(service, /if \(prefs\(this\)\.getBoolean\("battery_paused", false\)\) \{[\s\S]*?publishBatteryPausedStatus\(config\)/);
  assert.match(service, /data\.put\("batteryPaused", prefs\(this\)\.getBoolean\("battery_paused", false\)\)/);
  assert.match(service, /upsert\(data, config, false\)/);
  assert.match(service, /if \(notifyPlaceEvents && !config\.coupleId\(\)\.isEmpty\(\) && data\.has\("location_at"\)\)/);
  assert.match(location, /batteryPaused: data\?\.batteryPaused === true/);
  assert.match(sheet, /person\.batteryPaused \? 'Ubicación en pausa'/);
});

test('el seguimiento conserva el último punto y respeta el permiso de ubicación aproximada', async () => {
  const service = await read('android/app/src/main/java/com/heater64/personalhub/DeviceStatusService.java');

  assert.match(service, /if \(!data\.has\("location_at"\)\) error = "waiting-location";\s*else error = upsert\(data, config\)/);
  assert.match(service, /fix\.precise\(\) && !precise/);
  assert.match(service, /precise \|\| "approximate"\.equals\(previous\.optString\("location_precision"\)\)/);
  assert.match(service, /resume && \(!enabled \|\| !sameUser\)/);
});

test('web y servicio nativo prefieren la ubicación de pareja al contrato admin heredado', async () => {
  const location = await read('tamp/src/services/location.service.js');
  const native = await read('android/app/src/main/java/com/heater64/personalhub/DeviceStatusService.java');

  assert.match(location, /from\('couple_locations'\)\.upsert/);
  assert.match(location, /from\('couple_members'\)/);
  assert.match(native, /\/rest\/v1\/couple_locations\?on_conflict=couple_id,user_id/);
});

test('el control no pide activar si Android ya mantiene el servicio vivo', async () => {
  const sheet = await read('tamp/src/components/DistanceMapSheet.js');

  assert.match(sheet, /const running = bg\.running === true/);
  assert.match(sheet, /bg\.batteryPaused/);
});

test('el mapa no dice siempre activo si Android tiene la ubicación del sistema apagada', async () => {
  const service = await read('android/app/src/main/java/com/heater64/personalhub/DeviceStatusService.java');
  const location = await read('tamp/src/services/location.service.js');
  const sheet = await read('tamp/src/components/DistanceMapSheet.js');

  assert.match(service, /data\.put\("locationServices", locationServicesState\(this\)\)/);
  assert.match(location, /locationServices: data\?\.locationServices \|\| 'unknown'/);
  assert.match(sheet, /const locationDisabled = person\.locationServices === 'disabled'/);
  assert.match(sheet, /locationDisabled \? 'Ubicación desactivada'/);
});

test('el panel Android explica el GPS apagado y ofrece abrir sus ajustes', async () => {
  const sheet = await read('tamp/src/components/DistanceMapSheet.js');
  const device = await read('tamp/src/services/device.service.js');
  const plugin = await read('android/app/src/main/java/com/heater64/personalhub/DeviceStatusPlugin.java');

  assert.match(sheet, /const locationDisabled = bg\.locationServices === 'disabled'/);
  assert.match(sheet, /locationDisabled \? 'Ubicación desactivada'/);
  assert.match(sheet, /openLocationSettings/);
  assert.match(device, /api\?\.openLocationSettings/);
  assert.match(plugin, /Settings\.ACTION_LOCATION_SOURCE_SETTINGS/);
});

test('el panel permite abrir ajustes de batería cuando Android puede optimizar el servicio', async () => {
  const sheet = await read('tamp/src/components/DistanceMapSheet.js');
  const device = await read('tamp/src/services/device.service.js');
  const plugin = await read('android/app/src/main/java/com/heater64/personalhub/DeviceStatusPlugin.java');

  assert.match(sheet, /const needsBatteryOptimization = enabled && running && bg\.batteryUnrestricted === false/);
  assert.match(sheet, /settings\.hidden = !\(needsLocationSettings \|\| needsPermission \|\| needsNotifications \|\| needsBatteryOptimization\)/);
  assert.match(sheet, /openBatteryOptimizationSettings/);
  assert.match(device, /api\?\.openBatterySettings/);
  assert.match(plugin, /Settings\.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS/);
});

test('el panel avisa si Android bloquea las notificaciones para este móvil', async () => {
  const sheet = await read('tamp/src/components/DistanceMapSheet.js');

  assert.match(sheet, /const needsNotifications = enabled && bg\.notifications === 'denied'/);
  assert.match(sheet, /needsNotifications/);
  assert.match(sheet, /Ajustes de notificaciones/);
  assert.match(sheet, /else if \(needsNotifications\)/);
  assert.match(sheet, /bg\.background !== 'granted' \|\| bg\.notifications === 'denied'[\s\S]*?openDeviceSettings\(\)/);
});

test('los atributos de grid de widgets identifican su API mínima de Android', async () => {
  const directory = 'android/app/src/main/res/xml';
  const files = await readdir(path.join(ROOT, directory));
  const providers = files.filter(name => name.endsWith('_info.xml'));

  for (const file of providers) {
    const xml = await read(path.join(directory, file));
    if (!/android:targetCell(?:Height|Width)=/.test(xml)) continue;
    assert.match(xml, /xmlns:tools="http:\/\/schemas\.android\.com\/tools"/);
    assert.match(xml, /tools:targetApi="31"/,
      `${file} uses Android 12 widget sizing metadata intentionally`);
  }
});

test('los avisos inmediatos de pareja en primer plano generan notificaciones nativas distintas', async () => {
  const native = await read('tamp/src/services/native.service.js');
  const messaging = await read('android/app/src/main/java/com/heater64/personalhub/WidgetMessagingService.java');
  const manifest = await read('android/app/src/main/AndroidManifest.xml');

  assert.match(native, /loadLocalNotifications = \(\) => import\('@capacitor\/local-notifications'\)/);
  assert.match(native, /if \(isImmediatePartnerPush\(notification\)\) \{\s*await showNativeNotification/);
  assert.match(native, /type === 'battery_low' \|\| type === 'place_arrival' \|\| type === 'place_departure'/);
  assert.match(native, /LocalNotifications\.schedule\(/);
  assert.match(native, /id: nextLocalNotificationId\(\)/);
  assert.match(native, /localNotificationActionPerformed/);
  assert.match(manifest, /com\.capacitorjs\.plugins\.pushnotifications\.MessagingService"\s+tools:node="remove"/);
  assert.match(manifest, /android:name="\.WidgetMessagingService"[\s\S]*?com\.google\.firebase\.MESSAGING_EVENT/);
  assert.match(messaging, /class WidgetMessagingService extends MessagingService/,
    'custom FCM handling must retain Capacitor token and ordinary notification forwarding');
  assert.match(messaging, /onNewToken\(@NonNull String token\)[\s\S]*?super\.onNewToken\(token\)/);
});

test('Android no solicita permisos FCM antes de iniciar sesión', async () => {
  const native = await read('tamp/src/services/native.service.js');
  const app = await read('tamp/src/components/App.js');
  const register = native.slice(
    native.indexOf('export async function registerNativePush'),
    native.indexOf('/**\n * Estado de las notificaciones', native.indexOf('export async function registerNativePush'))
  );

  assert.match(register, /supabase\.auth\.getSession\(\)/);
  assert.match(register, /if \(!session\?\.access_token\) return false/);
  assert.ok(register.indexOf('getSession()') < register.indexOf('checkPermissions()'),
    'la sesión debe comprobarse antes de pedir permiso al sistema');
  assert.match(register, /else if \(pushOptOut\) \{\s*return false/,
    'resume events cannot silently re-enable notifications after logout');
  assert.match(app, /newPushSession[\s\S]*?registerNativePush\(\{ activateSession: newPushSession \}\)/);
  assert.match(app, /nativePushSessionId = null;/,
    'logging back into the same user can explicitly reactivate that new session');
});

test('logout removes the FCM token before clearing auth and clears delivered native alerts', async () => {
  const auth = await read('tamp/src/services/auth.service.js');
  const native = await read('tamp/src/services/native.service.js');
  const signOut = auth.slice(auth.indexOf('async signOut()'), auth.indexOf('getUser()'));
  const unregister = native.slice(native.indexOf('export async function unregisterNativePush()'), native.indexOf('/**\n * Estado de las notificaciones', native.indexOf('export async function unregisterNativePush()')));

  assert.ok(signOut.indexOf('unregisterNativePush()') < signOut.indexOf('supabase.auth.signOut()'),
    'the current session must still authenticate token removal');
  assert.match(unregister, /action=token-unregister/);
  assert.match(unregister, /settleWithin\(pendingRegistration, 1200\)/,
    'logout gives an in-flight native registration a bounded time to finish');
  assert.match(unregister, /settleWithin\(revokeRequest, 2500\)/,
    'offline token revocation cannot hold logout indefinitely');
  assert.match(unregister, /Promise\.resolve\(pendingTokenSave\)[\s\S]*?action=token-unregister/,
    'the server deletion must follow any in-flight token upsert');
  assert.match(unregister, /PushNotifications\?\.unregister\(\)/);
  assert.match(unregister, /removeAllDeliveredNotifications/);
});

test('el cierre automático por cuenta deshabilitada también revoca el token del móvil', async () => {
  const auth = await read('tamp/src/services/auth.service.js');
  const forced = auth.slice(auth.indexOf('async _forceSignOut()'), auth.indexOf('async refreshRole()'));

  assert.ok(forced.indexOf('unregisterNativePush()') < forced.indexOf("signOut({ scope: 'local' })"));
});

test('el tema del recorte de pantalla solo se aplica desde API 27', async () => {
  const base = await read('android/app/src/main/res/values/styles.xml');
  const api27 = await read('android/app/src/main/res/values-v27/styles.xml');

  assert.doesNotMatch(base, /windowLayoutInDisplayCutoutMode/);
  assert.match(api27, /windowLayoutInDisplayCutoutMode/);
});

test('las notificaciones inmediatas no solicitan acceso especial a alarmas exactas', async () => {
  const manifest = await read('android/app/src/main/AndroidManifest.xml');
  const native = await read('tamp/src/services/native.service.js');

  assert.match(manifest, /SCHEDULE_EXACT_ALARM.*tools:node="remove"/);
  assert.match(native, /isExactNotification: false/);
  assert.doesNotMatch(native, /trigger\s*:/,
    'el único uso de LocalNotifications es inmediato y no programa alarmas');
});

test('los widgets se refrescan al reanudar sin depender de abrir Inicio', async () => {
  const native = await read('tamp/src/services/native.service.js');
  const widgets = await read('tamp/src/services/widgets.service.js');

  assert.match(native, /personalhub:widgets-refresh/);
  assert.match(widgets, /window\.addEventListener\('personalhub:widgets-refresh'/);
  assert.match(widgets, /let refreshInFlight = null/);
});

test('una descarga parcial de foto se recupera en vez de dejar el widget vacío', async () => {
  const support = await read('android/app/src/main/java/com/heater64/personalhub/WidgetSupport.java');

  assert.match(support, /target\.getName\(\) \+ "\.part"/);
  assert.match(support, /if \(raw == null\) \{\s*file\.delete\(\);\s*download\(url, file, onReady\);/);
  assert.match(support, /if \(!partial\.renameTo\(target\)\) return/);
});

const WIDGETS = ['days', 'distance', 'countdown', 'mood', 'cycle', 'watching', 'gifts'];

test('todos los widgets reservan las mismas tres huellas: 1×1, 3×1 y 4×2', async () => {
  for (const widget of WIDGETS) {
    const compact = await read(`android/app/src/main/res/xml/widget_${widget}_compact_info.xml`);
    const rect = await read(`android/app/src/main/res/xml/widget_${widget}_rect_info.xml`);
    const large = await read(`android/app/src/main/res/xml/widget_${widget}_info.xml`);

    assert.match(compact, /android:targetCellWidth="1"/, `${widget}/compact`);
    assert.match(compact, /android:targetCellHeight="1"/, `${widget}/compact`);
    assert.match(rect, /android:targetCellWidth="3"/, `${widget}/rect`);
    assert.match(rect, /android:targetCellHeight="1"/, `${widget}/rect`);
    assert.match(large, /android:targetCellWidth="4"/, `${widget}/large`);
    assert.match(large, /android:targetCellHeight="2"/, `${widget}/large`);
  }
});

test('ningún tamaño se degrada al hueco que no le toca', async () => {
  const renderer = await read('android/app/src/main/java/com/heater64/personalhub/WidgetRenderer.java');

  // El destacado conserva su composición aunque el launcher aún no dé el hueco.
  for (const widget of WIDGETS) {
    assert.match(
      renderer,
      new RegExp(`if \\(defaultSize == Size\\.LARGE\\) \\{\\s*return R\\.layout\\.widget_${widget};`),
      `${widget}/large`
    );
  }
});

test('los layouts de widget usan solo vistas permitidas en RemoteViews', async () => {
  const dir = 'android/app/src/main/res/layout';
  const names = (await readdir(path.join(ROOT, dir))).filter(name => name.startsWith('widget_'));

  assert.ok(names.length >= 20, 'faltan layouts de widget');
  for (const name of names) {
    const xml = await read(`${dir}/${name}`);
    // `<View>` compila y luego no infla: el widget queda en blanco.
    assert.doesNotMatch(xml, /<View\b/, name);
  }
});
