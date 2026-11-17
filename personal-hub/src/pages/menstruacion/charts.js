/* ==========================================
   Menstruación — gráficos sin dependencias
   SVG a mano para la evolución y barras HTML para las distribuciones.
   ========================================== */

import { escapeHtml } from '../../utils/escape.js';

/**
 * Gráfico de línea de una serie de valores.
 * @param {number[]} values
 * @param {{ label?: string, unit?: string, labels?: string[] }} options
 */
export function lineChart(values = [], { label = '', unit = 'días', labels = [] } = {}) {
  const list = values.filter(value => Number.isFinite(value));
  if (list.length < 2) {
    return `<p class="cy-muted">Hacen falta al menos dos ciclos para dibujar la evolución.</p>`;
  }

  const width = 320;
  const height = 132;
  const padX = 12;
  const padY = 16;
  const min = Math.min(...list);
  const max = Math.max(...list);
  const span = max - min || 1;
  const stepX = (width - padX * 2) / (list.length - 1);

  const points = list.map((value, i) => {
    const x = padX + i * stepX;
    const y = padY + (1 - (value - min) / span) * (height - padY * 2);
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)), value };
  });

  const path = points.map((point, i) => `${i === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ');
  const area = `${path} L${points[points.length - 1].x} ${height - padY} L${points[0].x} ${height - padY} Z`;

  return `
    <figure class="cy-chart">
      ${label ? `<figcaption class="cy-chart-label">${escapeHtml(label)}</figcaption>` : ''}
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(`${label || 'Evolución'}: ${list.join(', ')} ${unit}`)}">
        <path class="cy-chart-area" d="${area}"></path>
        <path class="cy-chart-line" d="${path}"></path>
        ${points.map(point => `<circle class="cy-chart-dot" cx="${point.x}" cy="${point.y}" r="3.2"></circle>`).join('')}
        ${points.map((point, i) => (labels[i] ? `<text class="cy-chart-tick" x="${point.x}" y="${height - 3}" text-anchor="middle">${escapeHtml(labels[i])}</text>` : '')).join('')}
        <text class="cy-chart-min" x="${padX}" y="${padY - 4}">${max} ${escapeHtml(unit)}</text>
        <text class="cy-chart-min" x="${padX}" y="${height - padY + 11}">${min} ${escapeHtml(unit)}</text>
      </svg>
    </figure>
  `;
}

/**
 * Lista de barras horizontales (accesible: texto + longitud).
 * @param {{ label: string, value: number, hint?: string }[]} items
 */
export function barRows(items = []) {
  const list = items.filter(item => item.value > 0);
  if (!list.length) return `<p class="cy-muted">Todavía no hay datos suficientes.</p>`;
  const max = Math.max(...list.map(item => item.value));
  return `
    <ul class="cy-bars">
      ${list
        .map(
          item => `
        <li class="cy-bar-row">
          <span class="cy-bar-label">${escapeHtml(item.label)}${item.hint ? `<small>${escapeHtml(item.hint)}</small>` : ''}</span>
          <span class="cy-bar-track" aria-hidden="true"><span class="cy-bar-fill" style="width:${Math.round((item.value / max) * 100)}%"></span></span>
          <span class="cy-bar-value">${item.value}</span>
        </li>
      `
        )
        .join('')}
    </ul>
  `;
}
