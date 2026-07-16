import { el, escapeHtml } from '../../shared/components/dom.js';

export function render(data) {
    const root = el('div', 'memory-jar');
    root.innerHTML = '<p style="margin-bottom:12px;">🫙 Frasco de recuerdos — toca uno:</p>';
    (data?.memories || []).forEach((text) => {
        const chip = el('button', 'star-card', escapeHtml(text));
        chip.type = 'button';
        chip.style.cssText = 'width:100%;text-align:left;cursor:pointer;margin-bottom:8px;';
        chip.onclick = () => {
            if (typeof window.showToast === 'function') window.showToast(text);
            else alert(text);
        };
        root.appendChild(chip);
    });
    return root;
}
