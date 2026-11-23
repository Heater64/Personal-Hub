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

  assert.match(manifest, /android:allowBackup="false"/);
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
  assert.match(service, /if \(code >= 200 && code < 300\) return ""/);
  assert.match(service, /if \(error\.isEmpty\(\)\) edit\.putString\("last_sent_at", at\)/);
  assert.match(plugin, /out\.put\("lastAt", prefs\.getString\("last_sent_at", ""\)\)/);
  assert.match(plugin, /out\.put\("lastAttemptAt", prefs\.getString\("last_attempt_at", ""\)\)/);
});

test('la alerta de batería baja pasa la API al servicio y se reintenta hasta que FCM entrega', async () => {
  const device = await read('tamp/src/services/device.service.js');
  const service = await read('android/app/src/main/java/com/heater64/personalhub/DeviceStatusService.java');

  assert.match(device, /apiOrigin,/);
  assert.match(service, /battery_paused.*battery_alert_delivered/s);
  assert.match(service, /sendBatteryAlert\(config, Math\.max\(0, batteryLevel\)\)/);
  assert.match(service, /optInt\("sent", 0\)/);
  assert.match(service, /delay = Math\.min\(delay, RETRY_MS\)/);
  assert.match(service, /level >= 30[\s\S]*?remove\("battery_alert_delivered"\)/);
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

  assert.match(sheet, /const on = !!\(bg\.enabled \|\| bg\.running\)/);
});

test('los cambios de ánimo en primer plano generan notificaciones nativas distintas', async () => {
  const native = await read('tamp/src/services/native.service.js');

  assert.match(native, /loadLocalNotifications = \(\) => import\('@capacitor\/local-notifications'\)/);
  assert.match(native, /if \(isMoodPush\(notification\)\) \{\s*await showNativeMoodNotification/);
  assert.match(native, /LocalNotifications\.schedule\(/);
  assert.match(native, /id: Math\.max\(1, Math\.trunc\(Date\.now\(\) % 2_147_483_647\)\)/);
  assert.match(native, /localNotificationActionPerformed/);
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
