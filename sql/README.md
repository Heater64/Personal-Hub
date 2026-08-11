# Carpeta `sql/` — Schema de Supabase por dominios

En lugar de un único `supabase-schema.sql` gigante, el schema está dividido en
archivos numerados por dominio. Así los cambios son más pequeños, más seguros
y se puede subir solo el archivo afectado desde el SQL Editor de Supabase.

## Orden de ejecución (importante)

Los archivos **dependen entre sí** — ejecútalos siempre en este orden:

| # | Archivo | Contenido |
|---|---------|-----------|
| 000 | `000_Reglas.sql` | Permisos base, helpers (`is_admin`) y migraciones globales. **Primero siempre.** |
| 001 | `001_Usuarios.sql` | Tabla `profiles`, triggers de perfil y auditoría de roles |
| 002 | `002_Contenido.sql` | Tabla `content` (config general) + datos iniciales |
| 003 | `003_Moods.sql` | Estados de ánimo diarios (Sentimientos) |
| 004 | `004_Actividad.sql` | Activity log, analítica y acciones de admin |
| 005 | `005_Progreso.sql` | Progreso del usuario (`user_progress`) |
| 006 | `006_Storage.sql` | Buckets públicos + políticas de Storage (avatares, galería, memes, audios) |
| 007 | `007_Juegos.sql` | Multijugador: salas, invitaciones, RPCs (Conecta 4, Tres en Raya, Battleship) |
| 008 | `008_Playlists.sql` | Playlists de música compartidas |

## Cómo usar

- **Base de datos nueva (vacía):** ejecutar los 9 archivos en orden (000 → 008).
- **Cambio puntual:** subir solo el archivo del dominio afectado al SQL Editor de
  Supabase. Todos los archivos son **idempotentes** (`IF NOT EXISTS`, `CREATE OR
  REPLACE`, `DO $$ ... EXCEPTION WHEN duplicate_object`), por lo que se pueden
  re-ejecutar sin romper nada.
- **Migración desde el monolítico:** el archivo `supabase-schema.sql` (raíz) se
  mantiene como referencia histórica completa, pero ya no es la fuente para
  cambios nuevos.

## Convenciones

- `NNN_Nombre.sql` — el prefijo numérico marca el orden de dependencia.
- Un archivo = un dominio de la app (usuarios, contenido, juegos…).
- Todo lo nuevo que añadas, añádelo al archivo de su dominio, no a otro.
