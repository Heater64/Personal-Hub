import { el, escapeHtml } from '../../shared/components/dom.js';

export function render(data) {
    const root = el('div', 'cinematic-card');
    if (data?.bgImage) {
        const bg = el('div', 'cinematic-bg');
        bg.style.backgroundImage = `url(${data.bgImage})`;
        root.appendChild(bg);
    }
    const content = el('div', 'cinematic-content');
    content.innerHTML = `<p class="cinematic-quote">${escapeHtml(data?.quote || '')}</p>`;
    root.appendChild(content);
    return root;
}
