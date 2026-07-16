import { el, escapeHtml } from '../../shared/components/dom.js';

export function render(data) {
    const root = el('div', 'paper-stack');
    root.innerHTML = `<strong>${escapeHtml(data?.date || 'Hoy')}</strong><p class="paper-text">${escapeHtml(data?.entry || '')}</p>`;
    return root;
}
