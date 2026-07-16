import { el, escapeHtml } from '../../shared/components/dom.js';

export function getThumbnail(data) {
    return data?.photos?.[0]?.src || '';
}

export function render(data) {
    const root = el('div', 'polaroid-stack');
    (data?.photos || []).forEach((photo, i) => {
        const p = el('div', 'polaroid');
        p.style.transform = `translateX(-50%) rotate(${(i - 1) * 8}deg)`;
        p.style.zIndex = String(i);
        p.innerHTML = `<img src="${escapeHtml(photo.src)}" alt=""><div class="polaroid-caption">${escapeHtml(photo.caption || '')}</div>`;
        p.onclick = () => {
            if (typeof window.openLightbox === 'function') window.openLightbox(photo.src, photo.caption);
        };
        root.appendChild(p);
    });
    if (data?.footer) root.appendChild(el('p', '', escapeHtml(data.footer)));
    return root;
}
