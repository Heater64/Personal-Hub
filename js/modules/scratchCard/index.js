import { el, escapeHtml } from '../shared/dom.js';

export function render(data) {
    const root = el('div', 'scratch-card-wrap');
    root.style.cssText = 'position:relative;min-height:120px;border-radius:16px;overflow:hidden;';
    const prize = el('div', '', escapeHtml(data?.prize || '🎁'));
    prize.style.cssText = 'padding:40px;text-align:center;font-size:1.2rem;';
    const cover = el('canvas', 'scratch-cover');
    cover.width = 300;
    cover.height = 120;
    cover.style.cssText = 'width:100%;cursor:crosshair;touch-action:none;';
    const ctx = cover.getContext('2d');
    ctx.fillStyle = '#c65a3a';
    ctx.fillRect(0, 0, cover.width, cover.height);
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.fillText('Rasca aquí', 100, 65);
    let scratching = false;
    const scratch = (x, y) => {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(x, y, 18, 0, Math.PI * 2);
        ctx.fill();
    };
    const pos = (e) => {
        const r = cover.getBoundingClientRect();
        const t = e.touches?.[0] || e;
        return {
            x: ((t.clientX - r.left) / r.width) * cover.width,
            y: ((t.clientY - r.top) / r.height) * cover.height
        };
    };
    cover.onmousedown = (e) => { scratching = true; const p = pos(e); scratch(p.x, p.y); };
    cover.onmousemove = (e) => { if (scratching) { const p = pos(e); scratch(p.x, p.y); } };
    cover.onmouseup = () => { scratching = false; };
    cover.ontouchstart = (e) => { e.preventDefault(); scratching = true; const p = pos(e); scratch(p.x, p.y); };
    cover.ontouchmove = (e) => { e.preventDefault(); if (scratching) { const p = pos(e); scratch(p.x, p.y); } };
    cover.ontouchend = () => { scratching = false; };
    root.append(prize, cover);
    return root;
}
