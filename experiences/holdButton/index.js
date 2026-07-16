import { el, escapeHtml } from '../../shared/components/dom.js';

export function render(data) {
    const root = el('div', 'hold-button-wrap');
    root.innerHTML = `<p>${escapeHtml(data?.hint || 'Mantén pulsado')}</p>`;
    const btn = el('button', 'hold-btn', 'Mantener');
    const reveal = el('p', 'hold-reveal', '');
    reveal.style.display = 'none';
    reveal.style.marginTop = '16px';
    let timer = null;
    const start = () => {
        timer = setTimeout(() => {
            reveal.textContent = data?.reveal || '💝';
            reveal.style.display = 'block';
        }, 2000);
    };
    const stop = () => { clearTimeout(timer); };
    btn.addEventListener('mousedown', start);
    btn.addEventListener('mouseup', stop);
    btn.addEventListener('mouseleave', stop);
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); start(); });
    btn.addEventListener('touchend', stop);
    root.append(btn, reveal);
    return root;
}
