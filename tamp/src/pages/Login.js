/* ==========================================
   Personal Hub v2 — Login Page
   Inicio de sesión con Supabase Auth
   ========================================== */

import '../styles/login.css';
import { auth } from '../services/auth.service.js';

export function LoginPage(router) {
  const page = document.createElement('div');
  page.className = 'login-page';
  const params = new URLSearchParams(
    window.location.search || window.location.hash.split('?')[1] || ''
  );
  const isRecovery = params.get('recovery') === '1';
  page.innerHTML = `
    <div class="login-decor d1" aria-hidden="true">♥</div>
    <div class="login-decor d2" aria-hidden="true">✦</div>
    <div class="login-decor d3" aria-hidden="true">♥</div>
    <div class="login-decor d4" aria-hidden="true">✧</div>

    <div class="login-container">
      <div class="login-card">
        <div class="login-header">
          <div class="brand-icon" aria-hidden="true">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
            </svg>
          </div>
          <p class="login-kicker">NUESTRO ESPACIO</p>
          <h1>Personal Hub</h1>
          <p id="loginSubtitle">${isRecovery ? 'Crea una contraseña nueva y segura' : 'Vuestra vida juntos, en un solo lugar'}</p>
        </div>

        <div id="loginError" class="login-error">
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
          <button type="button" class="login-link" id="loginForgot">¿Has olvidado la contraseña?</button>
        </form>

        <form id="loginResetForm" class="login-form login-panel" hidden>
          <div class="login-panel__intro">
            <b>Recupera tu acceso</b>
            <span>Te enviaremos un enlace seguro para crear una contraseña nueva.</span>
          </div>
          <div class="form-group">
            <label for="loginResetEmail">Correo electrónico</label>
            <input type="email" id="loginResetEmail" class="form-input" placeholder="tu@correo.com" required autocomplete="email">
          </div>
          <button type="submit" class="login-btn" id="loginResetBtn"><span class="btn-text">Enviar enlace</span><span class="btn-loader"></span></button>
          <button type="button" class="login-link" id="loginBack">Volver a iniciar sesión</button>
        </form>

        <form id="loginRecoveryForm" class="login-form login-panel" ${isRecovery ? '' : 'hidden'}>
          <div class="login-panel__intro">
            <b>Elige una contraseña nueva</b>
            <span>Usa al menos 12 caracteres para proteger vuestro espacio.</span>
          </div>
          <div class="form-group">
            <label for="loginNewPassword">Contraseña nueva</label>
            <input type="password" id="loginNewPassword" class="form-input" minlength="12" required autocomplete="new-password">
          </div>
          <div class="form-group">
            <label for="loginConfirmPassword">Repite la contraseña</label>
            <input type="password" id="loginConfirmPassword" class="form-input" minlength="12" required autocomplete="new-password">
          </div>
          <button type="submit" class="login-btn" id="loginRecoveryBtn"><span class="btn-text">Guardar contraseña</span><span class="btn-loader"></span></button>
        </form>

        <p class="login-footer"><span aria-hidden="true">✦</span> Privado para vosotros dos</p>
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
  const resetForm = page.querySelector('#loginResetForm');
  const recoveryForm = page.querySelector('#loginRecoveryForm');
  const forgotBtn = page.querySelector('#loginForgot');
  const backBtn = page.querySelector('#loginBack');
  const subtitle = page.querySelector('#loginSubtitle');

  function showError(msg) {
    errorEl.classList.remove('login-error--success');
    errorText.textContent = msg;
    errorEl.style.display = 'block';
    errorEl.style.animation = 'shake 500ms ease';
  }

  function hideError() {
    errorEl.classList.remove('login-error--success');
    errorEl.style.display = 'none';
  }

  function setLoading(loading) {
    loginBtn.classList.toggle('loading', loading);
    loginBtn.disabled = loading;
  }

  function showPanel(name) {
    form.hidden = name !== 'signin';
    resetForm.hidden = name !== 'reset';
    recoveryForm.hidden = name !== 'recovery';
    subtitle.textContent = name === 'reset'
      ? 'Recupera el acceso a vuestro espacio'
      : name === 'recovery'
        ? 'Crea una contraseña nueva y segura'
        : 'Vuestra vida juntos, en un solo lugar';
    hideError();
  }

  function setButtonLoading(button, loading) {
    button.classList.toggle('loading', loading);
    button.disabled = loading;
  }

  // Toggle password visibility
  toggleBtn.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    toggleBtn.innerHTML = isPassword
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
  });

  forgotBtn.addEventListener('click', () => showPanel('reset'));
  backBtn.addEventListener('click', () => showPanel('signin'));

  resetForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = page.querySelector('#loginResetEmail').value.trim();
    if (!email) return;
    const button = page.querySelector('#loginResetBtn');
    setButtonLoading(button, true);
    try {
      await auth.requestPasswordReset(email);
      showError('Si ese correo tiene acceso, recibirás un enlace para restablecer la contraseña.');
      errorEl.classList.add('login-error--success');
    } catch {
      showError('No se pudo enviar el enlace. Comprueba tu conexión e inténtalo de nuevo.');
    } finally {
      setButtonLoading(button, false);
    }
  });

  recoveryForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = page.querySelector('#loginNewPassword').value;
    const confirm = page.querySelector('#loginConfirmPassword').value;
    if (password !== confirm) {
      showError('Las contraseñas no coinciden.');
      return;
    }
    const button = page.querySelector('#loginRecoveryBtn');
    setButtonLoading(button, true);
    try {
      await auth.updatePassword(password);
      // El código de recuperación es de un solo uso; no queda en el historial.
      window.history.replaceState(null, '', `${window.location.pathname}#/login`);
      router.replace('/');
    } catch (err) {
      showError(err.message || 'No se pudo actualizar la contraseña. Solicita un enlace nuevo.');
    } finally {
      setButtonLoading(button, false);
    }
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
