# Tamp

Aplicación principal. La web y la APK Android se construyen desde este proyecto.

## Ejecutar

```powershell
npm run dev
npm run build
```

Vite la abre en `http://127.0.0.1:5175`.

## Datos nuevos

Aplicar en Supabase, en este orden, solo después de probar con las dos cuentas:

1. `sql/034_agenda_tamp.sql`
2. `sql/035_sorpresas_regalos.sql`
3. `sql/036_tamp_media.sql`

La primera migración crea el calendario compartido, Mal Día y la planificación privada. La segunda añade los detalles de regalos. La tercera crea los metadatos de archivos.

## Archivos

`api/tamp-media.js` firma cargas de Cloudinary y devuelve enlaces autenticados de corta duración. `src/services/tampMedia.js` ofrece la subida con progreso, cancelación, validación de límites, listado y papelera para conectarlo a Galería, Memes y Audios. En Vercel hay que configurar `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, además de las variables de Supabase del servidor. Las claves secretas no se incluyen en el cliente.

La galería existente sigue funcionando mientras se revisa el flujo de migración. No se borra ni se mueve ningún archivo antiguo automáticamente.
# Decisi�n de calendarios

Tamp muestra solo dos calendarios. El calendario general re�ne planes, fechas y regalos recibidos. El calendario menstrual est� dentro de Menstruaci�n. Mis sorpresas sigue siendo un planificador privado independiente.
