/* ==========================================
   Personal Hub v2 — Login Page
   Inicio de sesión con Supabase Auth
   ========================================== */

import { auth } from '../services/auth.service.js';

export function LoginPage(router) {
  const page = document.createElement('div');
  page.className = 'login-page';
  page.innerHTML = `
    <div class="login-decor d1" aria-hidden="true">♥</div>
    <div class="login-decor d2" aria-hidden="true">✦</div>
    <div class="login-decor d3" aria-hidden="true">♥</div>
    <div class="login-decor d4" aria-hidden="true">✧</div>

    <div class="login-container">
      <div class="login-card glass-card">
        <div class="login-header">
          <div class="brand-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
            </svg>
          </div>
          <h1>Personal Hub</h1>
          <p>Inicia sesión para continuar</p>
        </div>

        <div id="loginError" class="login-error" style="display:none">
          <span id="loginErrorText"></span>
        </div>

        <form id="loginForm" class="login-form" autocomplete="on">
          <div class="form-group">
            <label for="loginEmail">Correo electrónico</label>
            <input type="email" id="loginEmail" class="form-input" placeholder="tu@correo.com" required autocomplete="email">
          </div>

          <div class="form-group">
            <label for="loginPassword">Contraseña</label>
            <div class="password-wrapper">
              <input type="password" id="loginPassword" class="form-input" placeholder="••••••••" required autocomplete="current-password">
              <button type="button" class="password-toggle" id="togglePassword" aria-label="Mostrar contraseña">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
            </div>
          </div>

          <button type="submit" class="login-btn" id="loginBtn">
            <span class="btn-text">Iniciar sesión</span>
            <span class="btn-loader"></span>
          </button>
        </form>

        <p class="login-footer">Hecho con amor · Solo para nosotros ♥</p>
      </div>
    </div>
  `;

  // Bind events
  const form = page.querySelector('#loginForm');
  const emailInput = page.querySelector('#loginEmail');
  const passwordInput = page.querySelector('#loginPassword');
  const loginBtn = page.querySelector('#loginBtn');
  const errorEl = page.querySelector('#loginError');
  const errorText = page.querySelector('#loginErrorText');
  const toggleBtn = page.querySelector('#togglePassword');

  function showError(msg) {
    errorText.textContent = msg;
    errorEl.style.display = 'block';
    errorEl.style.animation = 'shake 500ms ease';
  }

  function hideError() {
    errorEl.style.display = 'none';
  }

  function setLoading(loading) {
    loginBtn.classList.toggle('loading', loading);
    loginBtn.disabled = loading;
  }

  // Toggle password visibility
  toggleBtn.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    toggleBtn.innerHTML = isPassword
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
  });

  // Submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showError('Por favor completa todos los campos.');
      return;
    }

    setLoading(true);

    try {
      await auth.signIn(email, password);
      setLoading(false);
      // Navegar al home inmediatamente después del login exitoso
      // El beforeEach del router verificará la auth y permitirá el acceso
      // replace: Atrás tras el login no debe volver a la pantalla de login
      router.replace('/');
    } catch (err) {
      let msg = 'Error al iniciar sesión.';
      if (err.message?.includes('Invalid login credentials')) {
        msg = 'Correo o contraseña incorrectos.';
      } else if (err.message?.includes('Email not confirmed')) {
        msg = 'Confirma tu correo antes de iniciar sesión.';
      } else if (err.message) {
        msg = err.message;
      }
      showError(msg);
      setLoading(false);
    }
  });

  // Clear error on input
  emailInput.addEventListener('input', hideError);
  passwordInput.addEventListener('input', hideError);

  return page;
}
