// shared/dialogs/betaModal.js
// Modal de confirmación para activar el modo claro (fase beta)

const BETA_ACCEPTED_KEY = 'personalHub.lightModeBetaAccepted';

export function hasAcceptedLightBeta() {
    return localStorage.getItem(BETA_ACCEPTED_KEY) === '1';
}

export function acceptLightBeta() {
    localStorage.setItem(BETA_ACCEPTED_KEY, '1');
}

/**
 * Muestra un modal de confirmación para activar el modo claro.
 * @param {Function} onAccept - Callback si el usuario acepta
 * @param {Function} onCancel - Callback si el usuario cancela
 */
export function showLightBetaModal({ onAccept, onCancel }) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay is-open';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const modal = document.createElement('div');
    modal.className = 'modal-content modal-sm';

    // Header
    const header = document.createElement('div');
    header.className = 'modal-header';
    const title = document.createElement('h3');
    title.textContent = 'Modo Claro — Fase Beta';
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close';
    closeBtn.setAttribute('aria-label', 'Cerrar');
    closeBtn.innerHTML = '✕';
    closeBtn.addEventListener('click', () => {
        closeModal(overlay);
        if (typeof onCancel === 'function') onCancel();
    });
    header.appendChild(closeBtn);
    modal.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'modal-body';
    const msg = document.createElement('p');
    msg.textContent = 'El modo claro se encuentra actualmente en fase beta. Puede contener elementos visuales aún en desarrollo.';
    body.appendChild(msg);
    modal.appendChild(body);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'modal-footer';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'Cancelar';
    cancelBtn.addEventListener('click', () => {
        closeModal(overlay);
        if (typeof onCancel === 'function') onCancel();
    });
    footer.appendChild(cancelBtn);

    const acceptBtn = document.createElement('button');
    acceptBtn.className = 'btn btn-primary';
    acceptBtn.textContent = 'Aceptar';
    acceptBtn.addEventListener('click', () => {
        acceptLightBeta();
        closeModal(overlay);
        if (typeof onAccept === 'function') onAccept();
    });
    footer.appendChild(acceptBtn);

    modal.appendChild(footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Cerrar con Escape
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeModal(overlay);
            if (typeof onCancel === 'function') onCancel();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);

    // Cerrar al hacer clic fuera
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeModal(overlay);
            if (typeof onCancel === 'function') onCancel();
        }
    });
}

function closeModal(overlay) {
    if (!overlay || !overlay.parentNode) return;
    overlay.classList.remove('is-open');
    overlay.classList.add('is-closing');
    setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 350);
}
