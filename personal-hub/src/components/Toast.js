/* ==========================================
   Personal Hub v2 — Toast System
   ========================================== */

let toastId = 0;

const TOAST_COLORS = {
  success: { bg: 'var(--theme-success-dim)', border: 'var(--theme-success)', icon: 'check-circle' },
  error:   { bg: 'var(--theme-error-dim)',   border: 'var(--theme-error)',   icon: 'alert-circle' },
  warning: { bg: 'var(--theme-warning-dim)', border: 'var(--theme-warning)', icon: 'alert-triangle' },
  info:    { bg: 'var(--theme-info-dim)',    border: 'var(--theme-info)',    icon: 'info' }
};

export function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const colors = TOAST_COLORS[type] || TOAST_COLORS.info;
  const id = ++toastId;

  const el = document.createElement('div');
  el.className = 'toast';
  el.id = `toast-${id}`;
  el.innerHTML = `
    <div class="toast__content">
      <span class="toast__text">${message}</span>
    </div>
    <button class="toast__close" onclick="document.getElementById('toast-${id}').remove()">✕</button>
  `;

  el.style.cssText = `
    background: ${colors.bg};
    border: 1px solid ${colors.border};
    color: var(--theme-text-primary);
    padding: 12px 16px;
    border-radius: var(--radius-md);
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    animation: slide-up var(--dur-mid) ease forwards;
    font-size: var(--fs-sm);
    box-shadow: var(--theme-shadow-md);
    backdrop-filter: blur(var(--blur-sm));
    max-width: 400px;
  `;

  container.appendChild(el);

  if (duration > 0) {
    setTimeout(() => {
      const toast = document.getElementById(`toast-${id}`);
      if (toast) {
        toast.style.animation = 'fade-out var(--dur-fast) ease forwards';
        setTimeout(() => toast.remove(), 200);
      }
    }, duration);
  }
}

// Inject toast container styles
const toastStyles = document.createElement('style');
toastStyles.textContent = `
  #toast-container {
    position: fixed;
    bottom: 90px;
    left: 50%;
    transform: translateX(-50%);
    z-index: var(--z-toast, 1100);
    display: flex;
    flex-direction: column;
    align-items: center;
    pointer-events: none;
    width: 100%;
    max-width: 420px;
  }
  #toast-container .toast {
    pointer-events: auto;
  }
  .toast__close {
    background: none;
    border: none;
    color: var(--theme-text-muted);
    cursor: pointer;
    font-size: 1rem;
    padding: 2px;
    opacity: 0.6;
    transition: opacity var(--dur-fast);
  }
  .toast__close:hover { opacity: 1; }
`;
document.head.appendChild(toastStyles);
