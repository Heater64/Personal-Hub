import { el } from '../shared/dom.js';

export function render(data) {
    const root = el('div', 'paper-stack');
    const out = el('div', 'paper-text', '');
    root.appendChild(out);
    const full = data?.text || '';
    let i = 0;
    const id = setInterval(() => {
        out.textContent += full[i] || '';
        i++;
        if (i >= full.length) clearInterval(id);
    }, 40);
    root._cleanup = () => clearInterval(id);
    return root;
}
