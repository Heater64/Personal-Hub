// shared/dialogs/toast.js
// Sistema de notificaciones Toast

class ToastManager {
    constructor() {
        this.container = null;
        this.queue = [];
        this.isShowing = false;
        this.init();
    }

    init() {
        this.container = document.getElementById('toastContainer');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toastContainer';
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }

        if (!document.getElementById('toast-styles')) {
            const styles = document.createElement('style');
            styles.id = 'toast-styles';
            styles.textContent = `
                .toast-container {
                    position: fixed;
                    bottom: 30px;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: var(--z-toast);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                    pointer-events: none;
                    max-width: 90vw;
                }
                .toast-item {
                    pointer-events: auto;
                    background: var(--theme-bg-secondary);
                    color: var(--theme-text-primary);
                    padding: 12px 24px;
                    border-radius: var(--radius-pill);
                    border-left: 4px solid var(--theme-accent-primary);
                    box-shadow: var(--theme-shadow-lg);
                    backdrop-filter: blur(var(--blur-sm));
                    font-size: var(--fs-sm);
                    font-family: var(--font-body);
                    display: flex;
                    align-items: center;
                    gap: var(--space-sm);
                    min-width: 200px;
                    max-width: 480px;
                    border: var(--theme-border-subtle);
                    animation: toast-enter var(--dur-mid) ease forwards;
                }
                .toast-item.toast-out {
                    animation: toast-exit var(--dur-fast) ease forwards;
                }
                .toast-item.toast-success { border-left-color: var(--theme-success); }
                .toast-item.toast-error { border-left-color: var(--theme-error); }
                .toast-item.toast-warning { border-left-color: var(--theme-warning); }
                .toast-item.toast-info { border-left-color: var(--theme-accent-primary); }
                .toast-item .toast-icon { flex-shrink: 0; width: 20px; height: 20px; }
                .toast-item.toast-success .toast-icon { color: var(--theme-success); }
                .toast-item.toast-error .toast-icon { color: var(--theme-error); }
                .toast-item.toast-warning .toast-icon { color: var(--theme-warning); }
                .toast-item.toast-info .toast-icon { color: var(--theme-accent-primary); }
                .toast-item .toast-message { flex: 1; word-break: break-word; }
                .toast-item .toast-close {
                    background: none; border: none; color: var(--theme-text-muted);
                    cursor: pointer; padding: 4px; font-size: 1.2rem; opacity: 0.6;
                    transition: opacity var(--dur-fast) ease;
                }
                .toast-item .toast-close:hover { opacity: 1; }
                @media (max-width: 768px) {
                    .toast-container { bottom: 20px; max-width: 95vw; }
                    .toast-item { padding: 10px 16px; font-size: var(--fs-xs); min-width: unset; width: 100%; }
                }
            `;
            document.head.appendChild(styles);
        }
    }

    show(message, type = 'info', options = {}) {
        const { duration = 3000 } = options;

        if (this.isShowing) {
            this.queue.push({ message, type, duration });
            return;
        }

        this.isShowing = true;
        this.renderToast(message, type, duration);
    }

    renderToast(message, type, duration) {
        const icons = {
            success: 'check-circle',
            error: 'alert-circle',
            warning: 'alert-triangle',
            info: 'info'
        };

        const icon = icons[type] || icons.info;

        const toast = document.createElement('div');
        toast.className = `toast-item toast-${type}`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'polite');

        toast.innerHTML = `
            <i data-lucide="${icon}" class="toast-icon"></i>
            <span class="toast-message">${this.escapeHtml(message)}</span>
            <button class="toast-close" aria-label="Cerrar notificación">×</button>
        `;

        this.container.appendChild(toast);
        if (typeof lucide !== 'undefined') {
            lucide.createIcons({ root: toast });
        }

        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.dismiss(toast));

        const timeout = setTimeout(() => this.dismiss(toast), duration);
        toast.dataset.timeout = timeout;

        toast.addEventListener('mouseenter', () => {
            clearTimeout(toast.dataset.timeout);
        });

        toast.addEventListener('mouseleave', () => {
            const newTimeout = setTimeout(() => this.dismiss(toast), 1000);
            toast.dataset.timeout = newTimeout;
        });
    }

    dismiss(toast) {
        if (toast.classList.contains('toast-out')) return;
        toast.classList.add('toast-out');
        clearTimeout(toast.dataset.timeout);
        setTimeout(() => {
            toast.remove();
            this.isShowing = false;
            this.processQueue();
        }, 300);
    }

    processQueue() {
        if (this.queue.length > 0) {
            const next = this.queue.shift();
            this.show(next.message, next.type, { duration: next.duration });
        }
    }

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    success(message, options = {}) {
        this.show(message, 'success', options);
    }

    error(message, options = {}) {
        this.show(message, 'error', options);
    }

    warning(message, options = {}) {
        this.show(message, 'warning', options);
    }

    info(message, options = {}) {
        this.show(message, 'info', options);
    }
}

const Toast = new ToastManager();

if (typeof window !== 'undefined') {
    window.Toast = Toast;
    window.showToast = (msg, isError = false) => {
        if (isError) Toast.error(msg);
        else Toast.info(msg);
    };
}

export default Toast;