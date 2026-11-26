# Rendimiento y fluidez

**Estado: Línea base verificada; diagnóstico de campo pendiente.**

## Build base · 2026-11-26

Comando `npm run build` (Vite 8.3.8), exit code 0.

| Artefacto emitido    |    Tamaño |     Gzip | Nota                                                         |
| -------------------- | --------: | -------: | ------------------------------------------------------------ |
| Entrada JS `index-*` | 254,15 kB | 77,40 kB | No incluye todos los chunks que podrían cargarse al arrancar |
| CSS global `index-*` | 106,68 kB | 20,19 kB | Las hojas de pantalla se emiten aparte                       |
| Admin JS             | 210,84 kB | 56,96 kB | Carga diferida                                               |
| Canciones JS         | 226,73 kB | 65,11 kB | Carga diferida                                               |
| Supabase JS          | 223,48 kB | 57,51 kB | Chunk compartido                                             |
| Rincón JS            | 146,96 kB | 38,04 kB | Carga diferida                                               |

Estos valores describen el build, no LCP, INP, FPS, tiempo de arranque nativo o latencia de red.

## Build posterior a la corrección A-08 · 2026-11-26

`npm run build` volvió a finalizar con exit code 0. El JS de entrada quedó en 254,84 kB (77,62 kB gzip) y el CSS global se mantuvo en 106,68 kB (20,19 kB gzip). El cambio incorpora el manejo diferido del error de imagen; esta diferencia pequeña no representa una mejora de rendimiento percibido.

## Hallazgos y siguientes pasos

- La separación por página ya existe; no hay justificación aún para rehacer la carga de módulos.
- Priorizar medición móvil real (LCP/CLS/INP, tareas >50 ms, arranque frío/caliente y memoria) y estudiar el coste de chunks grandes en tareas representativas.
- La auditoría anterior deja LCP de campo con throttling como pendiente. No se volvió a medir en esta sesión.
- Falta comparar antes/después con el mismo dispositivo, build y condiciones. Ninguna mejora de rendimiento se declara sin esa evidencia.

## Línea base automatizada

`npm test`: línea base 481/481 pasó en 9,65 s; después de agregar la regresión A-08, 482/482 pasó en 12,91 s. Esto mide contratos y lógica automatizada, no rendimiento percibido.
