import { HUB_CARDS } from '../data/hubCards.js';
import { getCardPlacement, getGridPatternLabel } from './hubGridLayout.js';

function buildCardElement(card, index, total) {
    const { span, featured } = getCardPlacement(index, total);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bento-card';
    if (card.variant === 'lab') btn.classList.add('lab-card');
    if (featured) btn.classList.add('bento-card--featured');

    btn.dataset.span = String(span);
    btn.dataset.index = String(index);
    btn.dataset.cardId = card.id;
    btn.setAttribute('aria-label', `${card.title}: ${card.description}`);
    btn.style.setProperty('--card-index', String(index));

    if (card.variant === 'lab') {
        const badge = document.createElement('span');
        badge.className = 'lab-badge';
        badge.textContent = 'LAB';
        btn.appendChild(badge);
    }

    const icon = document.createElement('i');
    icon.dataset.lucide = card.icon;
    icon.className = 'icon';
    icon.setAttribute('aria-hidden', 'true');
    btn.appendChild(icon);

    const h3 = document.createElement('h3');
    h3.textContent = card.title;
    btn.appendChild(h3);

    const p = document.createElement('p');
    p.textContent = card.description;
    btn.appendChild(p);

    if (card.footer) {
        const foot = document.createElement('div');
        foot.className = 'bento-card__footer';
        const metaIcon = document.createElement('span');
        metaIcon.className = 'bento-card__meta-icon';
        metaIcon.setAttribute('aria-hidden', 'true');
        const fi = document.createElement('i');
        fi.dataset.lucide = card.footer.icon;
        metaIcon.appendChild(fi);
        const metaText = document.createElement('span');
        metaText.className = 'bento-card__meta-text';
        metaText.textContent = card.footer.text;
        foot.append(metaIcon, metaText);
        btn.appendChild(foot);
    }

    btn.addEventListener('click', () => {
        window.location.href = card.href;
    });

    return btn;
}

/**
 * @param {HTMLElement} container
 * @param {typeof HUB_CARDS} [cards]
 */
export function renderHubGrid(container, cards = HUB_CARDS) {
    if (!container) return;

    const list = [...cards];
    const total = list.length;

    container.className = 'bento-grid';
    container.dataset.count = String(total);
    container.dataset.pattern = getGridPatternLabel(total);
    container.replaceChildren();

    list.forEach((card, index) => {
        container.appendChild(buildCardElement(card, index, total));
    });

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

export function initHubGrid(selector = '#hubGrid', cards) {
    const el = document.querySelector(selector);
    if (!el) return;
    renderHubGrid(el, cards);
}
