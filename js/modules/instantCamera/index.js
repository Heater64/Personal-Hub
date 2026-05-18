import { el, escapeHtml } from '../shared/dom.js';

export function getThumbnail(data) {
    return data?.image || '';
}

export function render(data) {
    const root = el('div', 'instant-camera');
    if (data?.image) {
        const img = document.createElement('img');
        img.src = data.image;
        img.alt = data.caption || '';
        img.onclick = () => {
            if (typeof window.openLightbox === 'function') window.openLightbox(data.image, data.caption);
        };
        root.appendChild(img);
    }
    if (data?.caption) root.appendChild(el('p', '', escapeHtml(data.caption)));
    return root;
}
