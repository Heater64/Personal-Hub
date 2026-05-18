// Sistema modal universal para experiencias

let activeCloseHandler = null;
let keyHandler = null;

function getLayer() {
    return document.getElementById('experience-layer');
}

function getContainer() {
    return document.getElementById('experience-container');
}

function unbindGlobalClose() {
    if (keyHandler) {
        document.removeEventListener('keydown', keyHandler);
        keyHandler = null;
    }
    const layer = getLayer();
    if (layer && activeCloseHandler) {
        layer.removeEventListener('click', activeCloseHandler);
        activeCloseHandler = null;
    }
}

export function closeExperienceModal() {
    const layer = getLayer();
    const container = getContainer();
    unbindGlobalClose();
    if (layer) layer.classList.remove('active', 'is-open');
    if (container) container.innerHTML = '';
}

export function openExperienceModal({ title, contentNode, onClose }) {
    const layer = getLayer();
    const container = getContainer();
    if (!layer || !container) {
        console.error('experience-layer / experience-container no encontrados');
        return;
    }

    const close = () => {
        closeExperienceModal();
        if (typeof onClose === 'function') onClose();
    };

    const wrapper = document.createElement('div');
    wrapper.className = 'experience-modal-inner';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'experience-modal-close';
    closeBtn.setAttribute('aria-label', 'Cerrar');
    closeBtn.textContent = '✕';

    const titleEl = document.createElement('h3');
    titleEl.className = 'experience-modal-title';
    titleEl.textContent = title || '';

    const bodyEl = document.createElement('div');
    bodyEl.className = 'experience-modal-body';

    function setContent(nextContentNode) {
        bodyEl.innerHTML = '';
        if (nextContentNode && !nextContentNode.classList.contains('gift-module')) {
            nextContentNode.classList.add('gift-module');
        }
        if (nextContentNode) bodyEl.appendChild(nextContentNode);
    }

    if (contentNode) setContent(contentNode);

    const footer = document.createElement('div');
    footer.className = 'experience-modal-footer';

    const footerBtn = document.createElement('button');
    footerBtn.type = 'button';
    footerBtn.className = 'modal-close-btn experience-modal-footer-btn';
    footerBtn.textContent = 'Cerrar';
    footer.appendChild(footerBtn);

    wrapper.append(closeBtn, titleEl, bodyEl, footer);
    container.innerHTML = '';
    container.appendChild(wrapper);

    closeBtn.addEventListener('click', close);
    footerBtn.addEventListener('click', close);

    keyHandler = (e) => {
        if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', keyHandler);

    activeCloseHandler = (e) => {
        if (e.target === layer) close();
    };
    layer.addEventListener('click', activeCloseHandler);

    requestAnimationFrame(() => layer.classList.add('active', 'is-open'));

    return { close, setContent };
}
