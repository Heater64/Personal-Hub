import { el, escapeHtml } from '../../shared/components/dom.js';

export function render(data) {
    const root = el('div', 'cloud-reveal-wrap');
    root.style.textAlign = 'center';
    const hidden = el('p', 'cloud-hidden', escapeHtml(data?.hidden || ''));
    hidden.style.cssText = 'opacity:0;transition:opacity 0.6s;font-size:1.1rem;';
    const btn = el('button', 'hold-btn', '☁️ Despejar nubes');
    btn.onclick = () => {
        hidden.style.opacity = '1';
        btn.disabled = true;
        btn.textContent = '✨';
    };
    root.append(btn, hidden);
    return root;
}
