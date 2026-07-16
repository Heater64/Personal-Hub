// features/login/login.js
// Lógica de inicio de sesión

(function() {
    const form = document.getElementById('loginForm');
    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    const loginBtn = document.getElementById('loginBtn');
    const errorEl = document.getElementById('loginError');
    const errorText = document.getElementById('loginErrorText');

    function getRedirectParam() {
        const params = new URLSearchParams(window.location.search);
        return params.get('redirect') || '/index.html';
    }

    function showError(msg) {
        errorText.textContent = msg;
        errorEl.classList.add('visible');
        emailInput.classList.add('error');
        passwordInput.classList.add('error');
    }

    function hideError() {
        errorEl.classList.remove('visible');
        emailInput.classList.remove('error');
        passwordInput.classList.remove('error');
    }

    function setLoading(loading) {
        if (loading) {
            loginBtn.classList.add('loading');
            loginBtn.disabled = true;
        } else {
            loginBtn.classList.remove('loading');
            loginBtn.disabled = false;
        }
    }

    function redirectAfterLogin() {
        const redirect = getRedirectParam();
        window.location.href = redirect;
    }

    // Verificar sesión existente
    function checkExistingSession() {
        if (typeof window.auth !== 'undefined' && window.auth) {
            const user = window.auth.currentUser;
            if (user) {
                redirectAfterLogin();
            }
        }
    }

    // Login con email/contraseña
    form.addEventListener('submit', async function(e) {
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
            if (typeof loginWithEmail !== 'function') {
                throw new Error('Firebase no está listo. Espera un momento y recarga.');
            }
            await loginWithEmail(email, password);
            redirectAfterLogin();
        } catch (err) {
            let msg = 'Error al iniciar sesión.';
            if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                msg = 'Correo o contraseña incorrectos.';
            } else if (err.code === 'auth/invalid-email') {
                msg = 'El formato del correo no es válido.';
            } else if (err.code === 'auth/too-many-requests') {
                msg = 'Demasiados intentos. Intenta más tarde.';
            } else if (err.message) {
                msg = err.message;
            }
            showError(msg);
        } finally {
            setLoading(false);
        }
    });

    // Limpiar errores al escribir
    emailInput.addEventListener('input', hideError);
    passwordInput.addEventListener('input', hideError);

    // Verificar sesión existente
    function waitForAuthAndCheck() {
        if (typeof window.auth !== 'undefined' && window.auth) {
            window.auth.onAuthStateChanged(function(user) {
                if (user) {
                    redirectAfterLogin();
                }
            });
        } else {
            setTimeout(waitForAuthAndCheck, 200);
        }
    }
    waitForAuthAndCheck();

    // Inicializar Lucide
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
})();