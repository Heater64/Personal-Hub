# 8. Multimedia y archivos

## Decisiones

- **Cloudinary** es el proveedor preferido para fotos, vídeos, audios y medios compatibles.
- La solución debe ser sencilla de mantener y permitir sustituir el proveedor en el futuro sin rehacer cada módulo.
- Las fotos y vídeos de la galería deben poder añadirse desde móvil con un flujo rápido, inspirado en Retro.
- Los archivos se organizan desde el módulo que les corresponde.
- El contenido compartido es visible para ambos. Los adjuntos de la planificación privada de regalos y sorpresas también deben quedar privados.

## Flujo esperado de galería

1. Abrir Galería y elegir la categoría.
2. Pulsar añadir o seleccionar medios del dispositivo.
3. Añadir detalles opcionales y confirmar la carga.
4. Ver el elemento en la galería compartida.

La implementación debe mostrar el progreso y permitir reintentar una carga fallida. Los pasos exactos y las cargas múltiples quedan por definir.

## Tipos conocidos

Se aceptarán fotos, vídeos, audios, memes e imágenes de mundos de Minecraft. También se aceptarán GIF y PDF para compartir documentos o recuerdos. Los formatos ejecutables y archivos comprimidos no se aceptarán.

### Límites iniciales recomendados

- Imagen: hasta 20 MB por archivo.
- Audio: hasta 25 MB por archivo.
- Vídeo: hasta 100 MB por archivo.
- PDF: hasta 25 MB por archivo.
- Máximo inicial de 10 archivos por carga múltiple.

Estos límites se mostrarán antes de subir y se podrán ajustar desde configuración técnica si el almacenamiento disponible lo requiere.

## Reglas de archivo

- Los registros guardan referencias estables al medio y sus metadatos.
- Las credenciales de carga no se exponen en el cliente.
- Borrar un registro y borrar físicamente su archivo deben coordinarse.
- Sorpresas privadas no aparecen en miniaturas, búsqueda, widgets ni notificaciones compartidas.
- Las imágenes se reducirán de forma no destructiva para la vista previa, conservando el original descargable cuando el servicio lo permita.
- Se generarán miniaturas para vídeo e imagen; la carga permitirá cancelar y reintentar.
- El archivo se elimina cuando se borra el contenido que lo posee, tras confirmación; los registros de la papelera conservan el archivo durante 30 días para recuperación.
- La carga se hará desde una API segura del servidor o con credenciales temporales, nunca con una clave secreta en el navegador.

## Decisiones recomendadas

- Se permite seleccionar archivos desde el dispositivo; grabación directa desde la app queda para una fase posterior.
- Antes de subir, se puede añadir título o descripción, pero no es obligatorio.
- Un archivo pertenece a un registro para que borrado, permisos y exportación sean predecibles. Si se quiere reutilizar, se adjunta una copia referenciada al nuevo registro.
- La papelera es visible para el administrador en contenidos compartidos y para cada usuario en sus propios datos privados.
