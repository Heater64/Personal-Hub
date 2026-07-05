// js/core/modalSystem.js
// Sistema de modal para experiencias

let currentModal = null;

export function openExperienceModal({ title, contentNode, onClose = null }) {
    // Si ya hay un modal abierto, lo cerramos
    if (currentModal) {
        closeExperienceModal();
    }

    // Crear la capa del modal
    const layer = document.createElement('div');
    layer.id = 'experience-layer';
    layer.className = 'active is-open';
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-modal', 'true');

    // Contenedor interno
    const inner = document.createElement('div');
    inner.className = 'experience-modal-inner';

    // Título
    const titleEl = document.createElement('h3');
    titleEl.className = 'experience-modal-title';
    titleEl.textContent = title || 'Sorpresa';
    inner.appendChild(titleEl);

    // Botón cerrar
    const closeBtn = document.createElement('button');
    closeBtn.className = 'experience-modal-close';
    closeBtn.setAttribute('aria-label', 'Cerrar');
    closeBtn.innerHTML = '✕';
    closeBtn.addEventListener('click', () => {
        if (typeof onClose === 'function') onClose();
        closeExperienceModal();
    });
    inner.appendChild(closeBtn);

    // Cuerpo donde irá el contenido
    const body = document.createElement('div');
    body.className = 'experience-modal-body';
    body.id = 'experience-content';
    if (contentNode) {
        body.appendChild(contentNode);
    }
    inner.appendChild(body);

    // Pie (opcional, con un botón de cerrar)
    const footer = document.createElement('div');
    footer.className = 'experience-modal-footer';
    const closeFooterBtn = document.createElement('button');
    closeFooterBtn.className = 'experience-modal-footer-btn';
    closeFooterBtn.textContent = 'Cerrar ✧';
    closeFooterBtn.addEventListener('click', () => {
        if (typeof onClose === 'function') onClose();
        closeExperienceModal();
    });
    footer.appendChild(closeFooterBtn);
    inner.appendChild(footer);

    layer.appendChild(inner);
    document.body.appendChild(layer);

    // Guardar referencia
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

    return currentModal;
}

export function closeExperienceModal() {
    if (currentModal) {
        const el = currentModal.element;
        if (el && el.parentNode) {
            el.classList.remove('active', 'is-open');
            setTimeout(() => {
                if (el.parentNode) el.parentNode.removeChild(el);
            }, 350);
        }
        currentModal = null;
    }
}