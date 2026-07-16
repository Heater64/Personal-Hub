import { el, escapeHtml } from '../../shared/components/dom.js';

export function render(data) {
    const thoughts = data?.thoughts || ['Piensa en algo bonito.'];
    const root = el('div', 'random-thought-wrap');
    const text = el('p', 'paper-text', '');
    const btn = el('button', 'hold-btn', 'Otro pensamiento');
    btn.type = 'button';
    const pick = () => {
        text.textContent = thoughts[Math.floor(Math.random() * thoughts.length)];
    };
    btn.onclick = pick;
    pick();
    root.append(text, btn);
    return root;
}
