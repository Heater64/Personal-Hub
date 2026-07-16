import { el, escapeHtml } from '../../shared/components/dom.js';

export function getThumbnail(data) {
    return data?.image || data?.thumbnail || '';
}

export function render(data) {
    const root = el('div', 'surprise-letter');
    const envelope = el('div', 'letter-envelope');
    const body = el('div', 'letter-body');
    if (data?.image) {
        const img = document.createElement('img');
        img.src = data.image;
        img.alt = '';
        img.style.cssText = 'max-width:100%;border-radius:8px;margin-bottom:12px;';
        body.appendChild(img);
    }
    body.innerHTML += `<p>${escapeHtml(data?.message || '')}</p>`;
    envelope.appendChild(body);
    root.appendChild(envelope);
    return root;
}
