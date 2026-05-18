import { el, escapeHtml } from '../shared/dom.js';

export function render(data) {
    const root = el('div', 'emoji-rain-wrap');
    root.style.cssText = 'position:relative;min-height:140px;overflow:hidden;';
    const msg = el('p', '', escapeHtml(data?.message || ''));
    msg.style.marginTop = '100px';
    root.appendChild(msg);
    const emojis = data?.emojis || ['💖', '✨'];
    let i = 0;
    const id = setInterval(() => {
        const span = document.createElement('span');
        span.textContent = emojis[i % emojis.length];
        span.style.cssText = `position:absolute;left:${Math.random() * 90}%;top:-20px;font-size:1.5rem;animation:emojiFall 2s linear forwards;`;
        root.appendChild(span);
        setTimeout(() => span.remove(), 2000);
        i++;
        if (i > 25) clearInterval(id);
    }, 200);
    if (!document.getElementById('emoji-fall-style')) {
        const style = document.createElement('style');
        style.id = 'emoji-fall-style';
        style.textContent = '@keyframes emojiFall{to{transform:translateY(120px);opacity:0;}}';
        document.head.appendChild(style);
    }
    root._cleanup = () => clearInterval(id);
    return root;
}
