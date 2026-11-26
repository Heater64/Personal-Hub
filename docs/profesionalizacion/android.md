# Experiencia Android

**Estado: En progreso (revisión estática); pruebas en dispositivo bloqueadas.**

## Integración existente

- Capacitor 8; la configuración permite empaquetado local y documenta una URL remota HTTPS.
- `MainActivity.java` habilita edge-to-edge y aplica insets de barras del sistema y recorte de pantalla al contenido.
- `native.service.js` configura StatusBar, botón Atrás, retorno a primer plano, deep links y haptics bajo demanda.
- Hay plugins para ubicación/estado del dispositivo, notificaciones y widgets. CSS usa safe areas en varias superficies y respeta `prefers-reduced-motion`.

## Estado de comprobación

- `adb devices -l`: sin dispositivos conectados el 2026-11-26.
- No se instaló ni ejecutó una APK durante esta auditoría.
- No se verificaron teclado, gestos del sistema, insets reales, permisos, FCM, ubicación, widgets o trabajo en segundo plano en equipo físico.
- La suite automatizada contiene comprobaciones de contrato nativo, que no sustituyen pruebas Android.

## Próximas comprobaciones

1. Dispositivo físico con versión de Android y tipo de navegación documentados.
2. APK de debug generada desde el estado de trabajo actual; no distribuir ni publicar.
3. Casos: cold start, minimizar/reabrir, Atrás en root/child/overlay, teclado, orientación, insets, conexión, permisos ya concedidos/denegados y accesibilidad.
4. Registros nativos con datos privados protegidos; no registrar tokens ni ubicación precisa en informes.

## Regla de cierre

Cada comportamiento nativo queda **verificado** solo al ejecutarse en dispositivo, con modelo/Android, versión de app y resultado registrados en la matriz de pruebas. Los tests de contrato se anotan como verificación automatizada separada.
