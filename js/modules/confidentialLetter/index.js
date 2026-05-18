import { el, escapeHtml } from '../shared/dom.js';

export function render(data) {
    const root = el('div', 'confidential-letter');
    const sealed = data?.sealed !== false;
    if (sealed) {
        root.innerHTML = '<div>🔒 Carta confidencial</div><button type="button" class="hold-btn" style="margin-top:16px;">Abrir sobre</button>';
        const btn = root.querySelector('button');
        btn.onclick = () => {
            root.innerHTML = `<p>${escapeHtml(data?.message || '')}</p>`;
        };
    } else {
        root.innerHTML = `<p>${escapeHtml(data?.message || '')}</p>`;
    }
    return root;
}
