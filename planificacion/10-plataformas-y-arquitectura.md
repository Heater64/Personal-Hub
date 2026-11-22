# 10. Plataformas y arquitectura

## Objetivo de trabajo

Preparar una reconstrucción ordenada de Tamp en una carpeta de trabajo separada. Primero se define el producto y su funcionamiento; después se construye y revisa esa versión. La aplicación principal no se reemplaza hasta que Darwin revise la nueva app.

## Plataformas

- La experiencia principal es una aplicación web adaptable a móvil y ordenador.
- La aplicación actual también se instala en Android mediante Capacitor.
- Los widgets nativos de Android ya forman parte del proyecto y se evaluarán para conservarlos.
- La primera etapa cubre web adaptable y Android. La PWA se mantiene como modo instalable de la web. iOS queda fuera de alcance inicial.

## Tecnología existente

El proyecto actual usa Vite, Supabase, funciones de Vercel, Cloudinary y Capacitor. También tiene autenticación, sincronización, notificaciones y datos existentes.

Para conservar las cuentas y el contenido, la arquitectura nueva reutilizará lo que funcione y documentará cualquier migración antes de aplicarla. No se cambiará de proveedor ni se descartarán datos por una decisión implícita.

Se mantiene el sistema actual de autenticación y Cloudinary como proveedor preferido. El resto de la arquitectura se validará al preparar el plan técnico.

## Requisitos de datos

- Solo existen dos cuentas autorizadas y los permisos deben aplicarse también en backend.
- Los registros compartidos se asocian a su autor cuando corresponda.
- La planificación de sorpresas se separa por usuario y no puede filtrarse en consultas compartidas.
- Ánimo, calendario y ciclo siguen el comportamiento definido en sus módulos.
- Exportación, borrado y copias de seguridad se definirán antes de cerrar la arquitectura.

## Decisiones técnicas recomendadas

- Mantener Vite, Supabase, Vercel y Capacitor inicialmente: reducir riesgo y conservar cuentas, SQL y funciones; evaluar cambios solo con un motivo claro.
- Supabase almacena datos estructurados; Cloudinary, archivos multimedia. La aplicación accede a ambos mediante servicios separados para poder sustituir proveedor.
- RLS aplica aislamiento por espacio y rol. Las reglas de privacidad de sorpresas se verifican en servidor y base de datos, no solo ocultando componentes.
- La primera versión requiere conexión para sincronizar. Se puede guardar temporalmente un borrador local si se interrumpe la red, indicando claramente si está pendiente de sincronización; no se promete edición completa sin conexión.
- Se incluye exportación de datos y medios de la pareja y procedimiento de borrado de cuenta/datos, con confirmación y copia descargable previa.
- Antes de migrar, se crea una copia recuperable y se valida la nueva estructura con una copia de datos; nunca se hace una migración destructiva directa.
- Compatibilidad objetivo: móviles Android actuales y navegadores modernos de escritorio, con diseño para ancho mínimo aproximado de 360 px.
