# Contribuir a Personal Hub

Guía corta para desarrollo local y PRs. Detalle de entorno, SQL y seguridad: [`README.md`](README.md).

## Setup

```bash
npm install
cp .env.example .env   # rellena VITE_SUPABASE_* (y Cloudinary si tocas media)
npm run dev            # http://localhost:5173
```

Variables: ver README §3. No commits de `.env` reales ni secretos.

## SQL

`sql/` es la fuente de verdad del esquema. Aplica migraciones en orden numérico en el SQL Editor de Supabase.

- Detalle y peligrosidad: [`sql/README.md`](sql/README.md).
- **No ejecutes** `017` / `018` a ciegas en producción desde un PR de código: son endurecimiento RLS/push y van con el orden documentado en el README.
- `supabase-schema.sql` es histórico; no lo uses para actualizar una base viva.

## Tests

```bash
npm test               # tests/prepush.test.js — contratos sobre el código fuente
```

Cada PR debe pasar `npm test` en local antes de pedir review/merge.

## Lint / formato

```bash
npm run lint           # ESLint (avisos OK el primer día; no es gate de CI aún)
npm run format         # Prettier — escribe cambios
npm run format:check   # Prettier — solo comprueba
```

No hace falta reformatear todo el repo de golpe; formatea lo que toques.

## PRs

1. Rama desde `main` actualizado; un tema por PR (pequeños preferidos).
2. `npm test` en verde.
3. Descripción breve: qué / por qué / cómo probar.
4. Preferencia de merge: **squash**. Sin force-push a `main`.
5. CSS de páginas pesadas: importar desde el módulo de la página (no en `main.css`). Rutas estáticas (Login, Home, Profile, Razones, Mal Día) pueden seguir en el bundle inicial — ver test de code-splitting y README §7.

## Límites

- No borrar features de negocio.
- No tocar secretos, `.env` reales, ni aplicar migraciones 017/018 “porque sí”.
- No force-push a `main`.
