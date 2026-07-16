import { el, escapeHtml } from '../../shared/components/dom.js';

export function render(data) {
    const root = el('div', 'cipher-wrap');
    root.innerHTML = `
        <p class="paper-text" style="letter-spacing:0.1em;">${escapeHtml(data?.cipher || '')}</p>
        <p style="font-size:0.8rem;color:var(--umbra-ash);">Pista: ${escapeHtml(data?.hint || '')}</p>
        <input type="text" class="cipher-input" placeholder="Tu respuesta" style="width:100%;margin:12px 0;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.3);color:#fff;">
        <button type="button" class="hold-btn">Comprobar</button>
        <p class="cipher-result" style="display:none;margin-top:12px;"></p>`;
    const input = root.querySelector('.cipher-input');
    const result = root.querySelector('.cipher-result');
    root.querySelector('button').onclick = () => {
        const ok = input.value.trim().toLowerCase() === (data?.solution || '').toLowerCase();
        result.style.display = 'block';
        result.textContent = ok ? `✨ ${data?.solution}` : 'Casi… inténtalo otra vez';
    };
    return root;
}
