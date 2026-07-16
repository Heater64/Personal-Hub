// shared/dialogs/modalSystem.js
// Sistema de modales

let currentModal = null;

/**
 * Abre un modal de experiencia
 * @param {Object} options - Configuración
 * @param {string} options.title - Título del modal
 * @param {HTMLElement} options.contentNode - Contenido
 * @param {Function} options.onClose - Callback al cerrar
 * @returns {Object} - Controlador del modal
 */
export function openExperienceModal({ title, contentNode, onClose = null }) {
    if (currentModal) {
        closeExperienceModal();
    }

    const layer = document.createElement('div');
    layer.id = 'experience-layer';
    layer.className = 'modal-overlay is-open';
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-modal', 'true');

    const inner = document.createElement('div');
    inner.className = 'modal-content modal-md';

    // Título
    const header = document.createElement('div');
    header.className = 'modal-header';
    const titleEl = document.createElement('h3');
    titleEl.className = 'modal-title';
    titleEl.textContent = title || 'Sorpresa';
    header.appendChild(titleEl);

    // Botón cerrar
    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close';
    closeBtn.setAttribute('aria-label', 'Cerrar');
    closeBtn.innerHTML = '✕';
    closeBtn.addEventListener('click', () => {
        if (typeof onClose === 'function') onClose();
        closeExperienceModal();
    });
    header.appendChild(closeBtn);
    inner.appendChild(header);

    // Cuerpo
    const body = document.createElement('div');
    body.className = 'modal-body';
    body.id = 'experience-content';
    if (contentNode) body.appendChild(contentNode);
    inner.appendChild(body);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    const closeFooterBtn = document.createElement('button');
    closeFooterBtn.className = 'btn btn-secondary';
    closeFooterBtn.textContent = 'Cerrar ✧';
    closeFooterBtn.addEventListener('click', () => {
        if (typeof onClose === 'function') onClose();
        closeExperienceModal();
    });
    footer.appendChild(closeFooterBtn);
    inner.appendChild(footer);

    layer.appendChild(inner);
    document.body.appendChild(layer);

    // Animar entrada
    requestAnimationFrame(() => {
        layer.classList.add('is-open');
    });

    currentModal = {
        element: layer,
        setContent: (newContent) => {
            body.innerHTML = '';
            if (newContent) body.appendChild(newContent);
        },
        close: () => {
            if (typeof onClose === 'function') onClose();
            closeExperienceModal();
        }
    };

    // Cerrar con Escape
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            if (typeof onClose === 'function') onClose();
            closeExperienceModal();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);

    // Cerrar al hacer clic fuera
    layer.addEventListener('click', (e) => {
        if (e.target === layer) {
            if (typeof onClose === 'function') onClose();
            closeExperienceModal();
        }
    });

    return currentModal;
}

/**
 * Cierra el modal de experiencia
 */
export function closeExperienceModal() {
    if (currentModal) {
        const el = currentModal.element;
        if (el) {
            el.classList.remove('is-open');
            el.classList.add('is-closing');
            setTimeout(() => {
                if (el.parentNode) el.parentNode.removeChild(el);
            }, 350);
        }
        currentModal = null;
    }
}

/**
 * Abre un modal simple
 * @param {Object} options - Configuración
 * @param {string} options.title - Título
 * @param {string|HTMLElement} options.content - Contenido
 * @param {Array} options.buttons - Botones [{ label, action, variant }]
 * @returns {Object} - Controlador del modal
 */
export function openModal({ title, content, buttons = [] }) {
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay is-open';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const modal = document.createElement('div');
    modal.className = 'modal-content modal-md';

    // Header
    const header = document.createElement('div');
    header.className = 'modal-header';
    const titleEl = document.createElement('h3');
    titleEl.textContent = title || '';
    header.appendChild(titleEl);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close';
    closeBtn.innerHTML = '✕';
    closeBtn.addEventListener('click', () => closeModal(overlay));
    header.appendChild(closeBtn);
    modal.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'modal-body';
    if (typeof content === 'string') {
        body.innerHTML = content;
    } else if (content instanceof HTMLElement) {
        body.appendChild(content);
    }
    modal.appendChild(body);

    // Footer con botones
    if (buttons.length > 0) {
        const footer = document.createElement('div');
        footer.className = 'modal-footer';
        buttons.forEach(btn => {
            const button = document.createElement('button');
            button.className = `btn btn-${btn.variant || 'secondary'}`;
            button.textContent = btn.label;
            button.addEventListener('click', () => {
                if (btn.action) btn.action();
                if (btn.close !== false) closeModal(overlay);
            });
            footer.appendChild(button);
        });
        modal.appendChild(footer);
    }

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Cerrar con Escape
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeModal(overlay);
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal(overlay);
    });

    return {
        close: () => closeModal(overlay)
    };
}

/**
 * Cierra un modal
 * @param {HTMLElement} overlay - Elemento overlay del modal
 */
function closeModal(overlay) {
    if (overlay) {
        overlay.classList.remove('is-open');
        overlay.classList.add('is-closing');
        setTimeout(() => {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        }, 350);
    }
}