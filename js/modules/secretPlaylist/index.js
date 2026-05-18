import { el, escapeHtml } from '../shared/dom.js';

export function render(data) {
    const root = el('div', 'playlist-card');
    root.innerHTML = `<h4>${escapeHtml(data?.title || 'Playlist')}</h4>`;
    (data?.songs || []).forEach((s) => {
        const row = el('div', 'playlist-song');
        row.innerHTML = `<strong>${escapeHtml(s.title)}</strong><br><span>${escapeHtml(s.note || '')}</span>`;
        root.appendChild(row);
    });
    return root;
}
