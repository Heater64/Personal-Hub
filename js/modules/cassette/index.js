import { el, escapeHtml } from '../shared/dom.js';

export function getThumbnail() {
    return '';
}

export function render(data) {
    const root = el('div', 'cassette-player');
    root.innerHTML = `
        <div class="cassette-tape">
            <div class="tape-reel"></div>
            <span class="tape-label">${escapeHtml(data?.label || 'PARA TI')}</span>
            <div class="tape-reel"></div>
        </div>
        <p>${escapeHtml(data?.message || '')}</p>
    `;
    if (data?.audio) {
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.src = data.audio;
        root.appendChild(audio);
    }
    return root;
}
