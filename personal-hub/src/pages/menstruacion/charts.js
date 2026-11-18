/* ==========================================
   Menstruación — gráficos sin dependencias
   SVG a mano para la evolución y barras HTML para las distribuciones.
   Cada gráfico dice qué datos usa: título a la izquierda y nota debajo.
   ========================================== */

import { escapeHtml } from '../../utils/escape.js';

/**
 * Gráfico de línea de una serie de valores.
 * @param {number[]} values
 * @param {{ label?: string, unit?: string, labels?: string[], note?: string, yLabel?: string, xLabel?: string }} options
 */
export function lineChart(
  values = [],
  { label = '', unit = 'días', labels = [], note = '', yLabel = '', xLabel = '' } = {}
) {
  const list = values.filter(value => Number.isFinite(value));
  if (list.length < 2) {
    return `<p class="cy-muted">Hacen falta al menos dos ciclos para dibujar la evolución.</p>`;
  }

  const width = 320;
  const height = 152;
  const padX = 18;
  const padTop = 22;
  const padBottom = 34;
  const plotBottom = height - padBottom;
  const min = Math.min(...list);
  const max = Math.max(...list);
  const span = max - min || 1;
  const stepX = (width - padX * 2) / (list.length - 1);

  const points = list.map((value, i) => {
    const x = padX + i * stepX;
    const y = padTop + (1 - (value - min) / span) * (plotBottom - padTop);
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)), value };
  });

  // Con muchos ciclos las etiquetas se espacian para no pisarse.
  const every = Math.max(1, Math.ceil(list.length / 7));
  const shown = new Set([0, list.length - 1]);
  for (let i = 0; i < list.length; i += every) shown.add(i);

  const path = points.map((point, i) => `${i === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ');
  const area = `${path} L${points[points.length - 1].x} ${plotBottom} L${points[0].x} ${plotBottom} Z`;

  return `
    <figure class="cy-chart">
      <figcaption class="cy-chart-head">
        <span class="cy-chart-label">${escapeHtml(label || 'Evolución')}</span>
        ${unit && !yLabel ? `<span class="cy-chart-unit">${escapeHtml(unit)}</span>` : ''}
      </figcaption>
      ${yLabel ? `<div class="cy-chart-axis cy-chart-axis--y" aria-hidden="true">${escapeHtml(yLabel)}</div>` : ''}
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(
        `${label || 'Evolución'}: ${list.join(', ')} ${unit}`
      )}">
        <path class="cy-chart-area" d="${area}"></path>
        <line class="cy-chart-axis" x1="${padX}" y1="${plotBottom}" x2="${width - padX}" y2="${plotBottom}"></line>
        <path class="cy-chart-line" d="${path}"></path>
        ${points.map(point => `<circle class="cy-chart-dot" cx="${point.x}" cy="${point.y}" r="3.2"></circle>`).join('')}
        ${points
          .map((point, i) =>
            shown.has(i)
              ? `<text class="cy-chart-value" x="${point.x}" y="${point.y - 8}" text-anchor="middle">${point.value}</text>`
              : ''
          )
          .join('')}
        ${points
          .map((point, i) =>
            labels[i] && shown.has(i)
              ? `<text class="cy-chart-tick" x="${point.x}" y="${plotBottom + 15}" text-anchor="middle">${escapeHtml(labels[i])}</text>`
              : ''
          )
          .join('')}
      </svg>
      ${xLabel ? `<div class="cy-chart-axis cy-chart-axis--x" aria-hidden="true">${escapeHtml(xLabel)}</div>` : ''}
      ${note ? `<p class="cy-chart-note">${escapeHtml(note)}</p>` : ''}
    </figure>
  `;
}

/**
 * Lista de barras horizontales (accesible: texto + longitud).
 * @param {{ label: string, value: number, hint?: string }[]} items
 * @param {{ unit?: string, note?: string }} options
 */
export function barRows(items = [], { unit = '', note = '' } = {}) {
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
          <span class="cy-bar-value">${item.value}${unit ? `<small>${escapeHtml(unit)}</small>` : ''}</span>
        </li>
      `
        )
        .join('')}
    </ul>
    ${note ? `<p class="cy-chart-note">${escapeHtml(note)}</p>` : ''}
  `;
}
