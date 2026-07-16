import { el, escapeHtml } from '../../shared/components/dom.js';

export function render(data) {
    const root = el('div', 'mood-card-wrap');
    (data?.moods || []).forEach((m) => {
        const card = el('button', 'star-card');
        card.type = 'button';
        card.style.cssText = 'width:100%;margin-bottom:10px;cursor:pointer;text-align:left;';
        card.innerHTML = `<span style="font-size:1.5rem;margin-right:8px;">${m.emoji || '💫'}</span>${escapeHtml(m.text || '')}`;
        root.appendChild(card);
    });
    return root;
}
