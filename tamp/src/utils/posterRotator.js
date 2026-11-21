/* ==========================================
   posterRotator.js — Rotación suave de portadas
   dentro de un contenedor (tarjeta de Series en
   Inicio y Rincón). Mismo patrón que el hero de
   la sección: fade-out → cambia la portada → fade-in.
   Devuelve una función para detener la rotación.
   ========================================== */

/**
 * Rota las portadas de `urls` cada `interval` ms dentro de `container`
 * (busca su `img.sr-rotating-poster`). Con <2 portadas no hace nada.
 * `onChange(index)` se invoca tras cada cambio (índice sobre `urls`),
 * útil para sincronizar el texto de la tarjeta.
 * Devuelve un cleanup que detiene el temporizador.
 */
export function startPosterRotation(container, urls, { interval = 10000, fadeMs = 600, onChange } = {}) {
  const img = container?.querySelector?.('img.sr-rotating-poster');
  if (!img || !Array.isArray(urls) || urls.length < 2) return () => {};
  let index = 0;
  const tick = () => {
    const next = (index + 1) % urls.length;
    img.style.transition = `opacity ${fadeMs}ms ease`;
    img.style.opacity = '0';
    window.setTimeout(() => {
      if (!img.isConnected) return;
      index = next;
      img.src = urls[index];
      img.style.display = '';
      img.style.opacity = '1';
      if (typeof onChange === 'function') onChange(index);
    }, fadeMs);
  };
  const timer = window.setInterval(tick, interval);
  return () => { window.clearInterval(timer); };
}
