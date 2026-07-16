import { el, escapeHtml } from '../../shared/components/dom.js';

export function render(data) {
    const root = el('div', 'gift-box');
    root.innerHTML = `<div class="gift-icon">🎁</div><p id="giftBoxText" style="display:none;margin-top:16px;"></p><button type="button" class="hold-btn">Abrir regalo</button>`;
    const btn = root.querySelector('button');
    const text = root.querySelector('#giftBoxText');
    btn.onclick = () => {
        text.style.display = 'block';
        text.textContent = data?.surprise || '💝';
        btn.style.display = 'none';
        root.querySelector('.gift-icon').textContent = '✨';
    };
    return root;
}
