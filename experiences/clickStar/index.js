import { el, escapeHtml } from '../../shared/components/dom.js';

export function render(data) {
    const target = Number(data?.target) || 5;
    let count = 0;
    const root = el('div', 'click-star-wrap');
    const msg = el('p', '', escapeHtml(data?.message || 'Toca las estrellas'));
    const counter = el('p', 'star-counter', `0 / ${target}`);
    const sky = el('div', 'star-sky');
    sky.style.cssText = 'display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin:20px 0;';

    for (let i = 0; i < target + 2; i++) {
        const star = el('button', 'star-btn', '⭐');
        star.type = 'button';
        star.style.cssText = 'font-size:2rem;background:none;border:none;cursor:pointer;opacity:0.5;';
        star.onclick = () => {
            if (star.dataset.done) return;
            star.dataset.done = '1';
            star.style.opacity = '1';
            count++;
            counter.textContent = `${count} / ${target}`;
            if (count >= target) msg.textContent = '✨ ¡Completado!';
        };
        sky.appendChild(star);
    }
    root.append(msg, sky, counter);
    return root;
}
