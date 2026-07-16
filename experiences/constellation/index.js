import { el, escapeHtml } from '../../shared/components/dom.js';

export function render(data) {
    const root = el('div', 'constellation-wrap');
    (data?.stars || []).forEach((s) => {
        const card = el('div', 'star-card');
        card.innerHTML = `<strong>${escapeHtml(s.name)}</strong><p>${escapeHtml(s.wish || '')}</p>`;
        root.appendChild(card);
    });
    return root;
}
