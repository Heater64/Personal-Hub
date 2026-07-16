// features/welcome/welcome.screen.js
// Pantalla de bienvenida

const WELCOME_STORAGE_KEY = 'personalHub.welcomeShown';

export function showWelcomeScreen() {
    if (localStorage.getItem(WELCOME_STORAGE_KEY) === 'true') return;

    const overlay = document.createElement('div');
    overlay.className = 'welcome-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Bienvenida');

    overlay.innerHTML = `
        <div class="welcome-content">
            <div class="welcome-icon">✨</div>
            <h1 class="welcome-title">Bienvenida, princesa</h1>
            <p class="welcome-text">
                Este es tu rincón personal.<br>
                Un lugar hecho con mucho amor para ti.
            </p>
            <button class="welcome-btn" id="welcomeBtn">
                <span>Empezar ✧</span>
            </button>
            <p class="welcome-credit">Hecho con ❤️ por tu peluche</p>
        </div>
    `;

    document.body.appendChild(overlay);

    const btn = overlay.querySelector('#welcomeBtn');
    btn.addEventListener('click', () => {
        overlay.classList.add('is-closing');
        setTimeout(() => {
            overlay.remove();
            localStorage.setItem(WELCOME_STORAGE_KEY, 'true');
        }, 600);
    });

    const closeOnEscape = (e) => {
        if (e.key === 'Escape') {
            btn.click();
            document.removeEventListener('keydown', closeOnEscape);
        }
    };
    document.addEventListener('keydown', closeOnEscape);
}

// Inicializar automáticamente
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showWelcomeScreen);
} else {
    showWelcomeScreen();
}