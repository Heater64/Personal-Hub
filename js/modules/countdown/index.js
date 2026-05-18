import { el, escapeHtml } from '../shared/dom.js';

export function render(data) {
    const root = el('div', 'countdown-wrap');
    const label = el('p', '', escapeHtml(data?.label || ''));
    const display = el('p', 'countdown-display', '...');
    display.style.cssText = 'font-size:1.4rem;text-align:center;margin-top:16px;';
    root.append(label, display);

    const target = new Date(data?.targetDate || Date.now() + 86400000).getTime();
    const tick = () => {
        const diff = target - Date.now();
        if (diff <= 0) {
            display.textContent = '¡Ya llegó!';
            return;
        }
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        display.textContent = `${d}d ${h}h ${m}m ${s}s`;
    };
    tick();
    const id = setInterval(tick, 1000);
    root._cleanup = () => clearInterval(id);
    return root;
}
