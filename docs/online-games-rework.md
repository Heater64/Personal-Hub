# Sala de juegos online — Reestructuración completa

## Objetivo

Convertir la sección de juegos online del Hub en un **sistema de juego real**:
bonito, coherente con el design system, con presencia real del rival y jugabilidad
correcta por juego, adaptado a móvil y escritorio. El estado actual "deja mucho
que desear" por tres razones concretas:

1. **No se ve al rival.** En el modo reto/carrera cada uno juega a solas en un
   iframe; no hay presencia ni progreso en vivo del otro jugador. No se *siente*
   multijugador.
2. **UI desalineada con el design system.** `online-games.css` usa glassmorphism,
   gradientes y tokens legacy, mientras el resto de la app es plano, premium y
   con tokens semánticos (coral `#e8735a`, Playfair/Inter, superficies planas).
3. **Móvil poco cuidado.** Alturas de iframe, botones y tableros no están
   pensados mobile-first (la app es, sobre todo, de móvil).

## Arquitectura del sistema

Tres modos de juego, todos sobre la misma sala (`game_rooms`) y el mismo HUD:

| Modo | Qué es | Fin de partida | Ganador |
|------|--------|----------------|---------|
| **Turnos** | Tablero compartido en tiempo real | Gana/concluye en el propio tablero | El jugador que gana el tablero |
| **Carrera** | Ambos juegan a la vez, cada uno su partida | El primero en terminar cierra la sala | El más rápido (menor tiempo) |
| **Duelo de puntos** | Ambos juegan a la vez | Cuando ambos terminan (o caen) | Regla del juego (más o menos puntos) |

**Presencia en vivo (nuevo):** los dos modos simultáneos (carrera y duelo) usan
un **canal broadcast de Supabase Realtime** por sala (`race-live-<roomId>`,
mismo patrón que `listenTogether.service.js`) para intercambiar el progreso del
rival (movimientos, tiempo, parejas, nivel…) sin escribir en la BD. La partida
final solo se escribe al terminar (`submit_race_result`), evitando contención.

**Contrato de progreso** (ephemeral, no persistente):
```json
{ "game": "memoria", "pairs": 3, "totalPairs": 8, "moves": 5, "seconds": 12 }
```
Cada juego define su propia métrica. Se emite como máximo ~2×/segundo y solo
cuando cambia algo significativo.

## Diseño visual

Lenguaje **plano premium** alineado con `design-tokens.css` (sin glassmorphism):

- **Superficies:** `--surface-0/1/2` planas, bordes `--divider`, radio `--r-xl`.
- **Acento:** coral `--accent` con glow sutil solo en el estado activo/ganador.
- **Tipografía:** Playfair Display para títulos ("En juego", "Resultado"),
  Inter para HUD y métricas.
- **HUD de duelo:** dos tarjetas de jugador enfrentadas (avatar, nombre, chip de
  métrica en vivo, barra de progreso). Escritorio: lado a lado con el tablero al
  centro. Móvil: tarjetas compactas apiladas sobre el tablero.
- **Podium de resultado:** medalla 🥇🥈, métricas de ambos, confeti en la
  victoria, revancha.
- **Lobby:** rejilla de portadas de juego + tarjetas de rival con avatar.

## Matriz por juego (jugabilidad correcta)

| Juego | Modo | Métrica en vivo | Fin de ronda | Móvil | Escritorio |
|-------|------|-----------------|--------------|-------|------------|
| **memoria** ★ | Carrera | parejas, movimientos, s | todas las parejas | grid táctil 4×4 | 5×4/6×4 opcionales |
| conecta4 | Turnos | turno actual | 4 en línea | tocar columna | clic columna |
| tresenraya | Turnos | turno actual | 3 en línea | celdas grandes | celdas |
| battleship | Turnos | barcos hundidos | flota hundida | grids 10×10 compactos | grids |
| snake | Duelo | longitud, s | morir (choque) | swipe | flechas |
| tetris | Duelo | líneas, puntos, s | game over | botones táctiles | teclado |
| 2048 | Duelo | mayor ficha, s | sin movimientos | swipe | flechas |
| breakout | Duelo | ladrillos, s | sin vidas | arrastre | ratón/flechas |
| buscaminas | Duelo | reveladas, s | todas reveladas | tap | clic |
| ahorcado | Duelo | aciertos, s | palabra adivinada/ahorcado | teclado nativo | teclado |
| cuchillos | Duelo | cuchillos, s | fallo | tap | clic |
| invaders | Duelo | puntos, s | sin vidas | botones | flechas/espacio |
| laberinto | Duelo | nivel, s | salida | swipe | flechas |
| meteoritos | Duelo | puntos, s | colisión | arrastre | ratón |
| pong | Duelo | marcador, s | marcador final | arrastre | ratón |
| simon | Duelo | ronda, s | fallo de secuencia | tap | clic |
| tiroarco | Duelo | aciertos, s | tiros agotados | arrastre | ratón |
| torre | Duelo | altura, s | caída | tap | clic |
| agujero-negro | Duelo | masa/tiempo, s | absorbido | arrastre | ratón |

★ = implementado y verificado en esta fase. El resto usa el mismo framework:
basta definir su fuente de progreso en `_online.js` (SCORE_SOURCES + progress).

## Fases

- **Fase 1 (esta iteración):** design system CSS, HUD de duelo, progreso en vivo
  por broadcast, lobby/espera/resultado rediseñados, **memoria** como juego
  insignia (carrera con progreso en vivo).
- **Fase 2:** convertir los 15 juegos de "modo reto por turnos" a **duelo
  simultáneo** (ambos a la vez + progreso en vivo), uno por uno con su métrica.
- **Fase 3:** pulido de los 3 juegos de turnos (tableros móvil + animaciones),
  sonidos de victoria/derrota y marcadores históricos.

## No hacer (por ahora)

- Matchmaking automático / colas de espera (la app es de dos personas; el flujo
  de invitación es el correcto).
- Espectadores, salas públicas o ranking global.
- Replay/ghost completo (guardar partidas) — el progreso en vivo es efímero.
