# Seguimiento y widgets en Android

El seguimiento se activa en el mapa. Android muestra una notificación del servicio con una acción para detenerlo. El permiso de ubicación permanente permite retomarlo después de reiniciar el teléfono. El mapa distingue la hora de cada posición de la del último envío de batería y conexión.

Los widgets consultan datos con una credencial de lectura por instalación, aunque el seguimiento esté desactivado. La credencial caduca a los 30 días y se renueva al abrir la app con una sesión activa. Los widgets se actualizan tras un aviso silencioso de Firebase y mediante WorkManager con un intervalo mínimo de 15 minutos. Android decide cuándo ejecuta ese trabajo y puede aplazarlo en reposo. Un cierre forzado desde Ajustes lo detiene hasta que se abre la app de nuevo.

## Activación en producción

1. Aplicar [la migración 032](../sql/032_android_widget_sync.sql) después de las migraciones de pareja y ciclo. Concede los permisos de ubicación acotados por las políticas de pareja y publica los cambios en Realtime.
2. Publicar la API junto con la web. El APK empaquetado usa el origen HTTPS de `CAP_SERVER_URL` durante la compilación para llegar a la API de producción.
3. Para el aviso inmediato, configurar `FCM_SERVICE_ACCOUNT` y un `WIDGET_WEBHOOK_SECRET` aleatorio en Vercel. En Supabase Vault, guardar el mismo valor con el nombre `android_widget_webhook_secret` y la URL HTTPS de `/api/widgets?action=invalidate` con el nombre `android_widget_webhook_url`. La consulta periódica funciona sin el webhook.
4. Instalar el APK actualizado, abrir una sesión y colocar los widgets. Comprobar con dos cuentas de la pareja que un cambio de ánimo o de ubicación llega al otro launcher mientras la app está en segundo plano.

Para verificar la ubicación en un teléfono, activar el seguimiento desde el mapa, apagar la pantalla, mover el teléfono o conectarlo al cargador y comprobar las horas desde la otra cuenta. Repetir con ubicación aproximada, tras reiniciar y al cerrar sesión. La última prueba debe vaciar los widgets de esa cuenta y detener el servicio.
