import { el, escapeHtml } from '../shared/dom.js';

export function render(data) {
    const root = el('div', 'movie-ticket');
    root.innerHTML = `
        <div class="ticket-stub">
            <span class="ticket-movie">${escapeHtml(data?.movie || '')}</span>
            <span class="ticket-quote">${escapeHtml(data?.quote || '')}</span>
            <div class="ticket-details">
                <span>${escapeHtml(data?.date || '')}</span>
                <span>${escapeHtml(data?.seat || '')}</span>
            </div>
            <div class="ticket-tear"></div>
        </div>`;
    return root;
}
