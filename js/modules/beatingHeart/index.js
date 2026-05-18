import { el, escapeHtml } from '../shared/dom.js';

export function render(data) {
    const root = el('div', 'gift-box');
    root.innerHTML = `<div class="heart-animation">💖</div><p style="margin-top:16px;">${escapeHtml(data?.message || '')}</p>`;
    const heart = root.querySelector('.heart-animation');
    if (heart) heart.className = 'heart-animation';
    return root;
}
