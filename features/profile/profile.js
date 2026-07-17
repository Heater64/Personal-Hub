// features/profile/profile.js
// Página de perfil estilo FormsBiblicos (tarjetas). Solo claro/oscuro/auto.

(function () {
    'use strict';

    var state = {
        user: null,
        initialized: false
    };

    // Usuario de sesión: mismo sistema que index/login (Firebase),
    // con fallback a SessionManager (localStorage).
    function getAuthUser() {
        if (typeof getCurrentUser === 'function') {
            var u = getCurrentUser();
            if (u) return u;
        }
        if (window.SessionManager && window.SessionManager.getUserObject) {
            var s = window.SessionManager.getUserObject();
            if (s) return s;
        }
        if (window.auth && window.auth.currentUser) return window.auth.currentUser;
        return null;
    }

    function isAuthLoggedIn() {
        return !!getAuthUser();
    }

    var elements = {};

    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', doInit);
        } else {
            doInit();
        }
    }

    function doInit() {
        cacheElements();
        bindEvents();
        loadUserData();
        renderThemeMode();
        renderAccessibility();
        state.initialized = true;

        if (window.ThemeService) {
            window.ThemeService.subscribe(updateThemeUI);
        }

        // Auth changes (mismo sistema que index/login)
        var authSource = window.auth || (window.SessionManager && window.SessionManager.onAuthStateChanged ? window.SessionManager : null);
        if (authSource && typeof authSource.onAuthStateChanged === 'function') {
            authSource.onAuthStateChanged(function (user) {
                if (user) { loadUserData(); return; }
                setTimeout(function () {
                    if (isAuthLoggedIn()) return;
                    if (window.location.pathname.indexOf('login.html') !== -1) return;
                    window.location.href = '../../login.html';
                }, 600);
            });
        }

        if (window.lucide) window.lucide.createIcons();
    }

    function cacheElements() {
        elements = {
            avatarWrap: document.getElementById('profileAvatarWrap'),
            avatarImg: document.getElementById('profileAvatar'),
            avatarLetra: document.getElementById('profileInitial'),
            inputFoto: document.getElementById('inputFotoPerfil'),
            btnEditarNombre: document.getElementById('btnEditarNombre'),
            name: document.getElementById('profileName'),
            email: document.getElementById('profileEmail'),
            role: document.getElementById('profileRole'),
            memberSince: document.getElementById('profileMemberSince'),
            cuentaUsername: document.getElementById('cuentaUsername'),
            cuentaEmail: document.getElementById('cuentaEmail'),
            cuentaRol: document.getElementById('cuentaRol'),
            cuentaCreado: document.getElementById('cuentaCreado'),
            btnAdmin: document.getElementById('btnAdmin'),
            ultimaSync: document.getElementById('ultimaSync'),
            themeModeOptions: document.getElementById('themeModeOptions'),
            toggleAltoContraste: document.getElementById('toggleAltoContraste'),
            toggleTextoGrande: document.getElementById('toggleTextoGrande'),
            toggleReducirMovimiento: document.getElementById('toggleReducirMovimiento'),
            appVersion: document.getElementById('appVersion'),
            storageUsed: document.getElementById('storageUsed'),
            clearCacheBtn: document.getElementById('clearCacheBtn')
        };
    }

    function bindEvents() {
        if (elements.clearCacheBtn) {
            elements.clearCacheBtn.addEventListener('click', clearCache);
        }

        // Avatar editable
        if (elements.avatarWrap && elements.inputFoto) {
            var abrirInput = function () { elements.inputFoto.click(); };
            elements.avatarWrap.addEventListener('click', abrirInput);
            elements.avatarWrap.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirInput(); }
            });
            elements.inputFoto.addEventListener('change', onFotoChange);
        }

        if (elements.btnEditarNombre) {
            elements.btnEditarNombre.addEventListener('click', editarNombre);
        }

        // Accesos Admin
        var rootDir = document.body.dataset.sidebarRoot || '../..';
        var role = state.user && (state.user.role || (state.user.profile && state.user.profile.role));
        if (elements.btnAdmin) {
            elements.btnAdmin.hidden = role !== 'admin';
            if (role === 'admin') elements.btnAdmin.addEventListener('click', function () {
                window.location.href = rootDir + '/pages/admin.html';
            });
        }

        // Última sincronización
        if (elements.ultimaSync) {
            try {
                var raw = localStorage.getItem('personalHub.syncLast');
                if (raw) {
                    var t = new Date(raw);
                    elements.ultimaSync.textContent = 'Sincronizado ' + t.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
                }
            } catch (e) {}
        }

        // Tema (segmented)
        if (elements.themeModeOptions) {
            elements.themeModeOptions.querySelectorAll('.perfil-segmented__btn').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    if (!window.ThemeService) return;
                    var tema = this.dataset.tema;

                    if (tema === 'light' && window.BetaModal && !window.BetaModal.hasAcceptedLightBeta()) {
                        window.BetaModal.showLightBetaModal({
                            onAccept: function () {
                                window.ThemeService.setTheme('light');
                            },
                            onCancel: function () {}
                        });
                        return;
                    }

                    window.ThemeService.setTheme(tema);
                });
            });
        }

        // Accesibilidad (checkboxes)
        bindToggle(elements.toggleAltoContraste, 'highContrast');
        bindToggle(elements.toggleTextoGrande, 'largeText');
        bindToggle(elements.toggleReducirMovimiento, 'reducedMotion');
    }

    function bindToggle(input, key) {
        if (!input) return;
        if (window.ThemeService) {
            var estado = window.ThemeService.getThemeState ? window.ThemeService.getThemeState() : null;
            if (estado && typeof estado[key] !== 'undefined') input.checked = !!estado[key];
        }
        input.addEventListener('change', function () {
            if (window.ThemeService && window.ThemeService.setAccessibility) {
                window.ThemeService.setAccessibility(key, input.checked);
            } else if (window.ThemeService) {
                var method = 'set' + key.charAt(0).toUpperCase() + key.slice(1);
                if (window.ThemeService[method]) window.ThemeService[method](input.checked);
            }
            if (window.lucide) window.lucide.createIcons({ root: document.body });
        });
    }

    function loadUserData() {
        var user = getAuthUser();
        if (user) {
            state.user = user;
            renderUserProfile(user);
        }
    }

    function renderUserProfile(user) {
        if (!user) return;

        var nombre = user.name || user.username || user.displayName || 'Usuario';
        if (elements.name) elements.name.textContent = nombre;

        var initial = (nombre || '?').charAt(0).toUpperCase();
        if (elements.avatarLetra) elements.avatarLetra.textContent = initial;

        if (user.photoURL || user.photo) {
            if (elements.avatarImg) {
                elements.avatarImg.src = user.photoURL || user.photo;
                elements.avatarImg.style.display = 'block';
            }
            if (elements.avatarLetra) elements.avatarLetra.style.display = 'none';
        }

        var email = user.username || user.email || '';
        if (elements.email) {
            var e = elements.email.querySelector('span');
            if (e) e.textContent = email || '—';
        }

        var role = user.role || (user.profile && user.profile.role) || 'user';
        if (elements.role) {
            var r = elements.role.querySelector('span');
            if (r) r.textContent = role === 'admin' ? 'Administrador' : 'Usuario';
        }

        var created = user.profile && user.profile.createdAt || user.createdAt || user.loginTime;
        if (elements.memberSince && created) {
            var d = new Date(created);
            elements.memberSince.textContent = 'Miembro desde ' + d.toLocaleDateString('es-ES', { year: 'numeric', month: 'long' });
        }

        // Sección Cuenta
        if (elements.cuentaUsername) elements.cuentaUsername.textContent = user.username || user.displayName || '—';
        if (elements.cuentaEmail) elements.cuentaEmail.textContent = email || '—';
        if (elements.cuentaRol) elements.cuentaRol.textContent = role === 'admin' ? 'Administrador' : 'Usuario';
        if (elements.cuentaCreado && created) {
            elements.cuentaCreado.textContent = d.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
        }

        // Versión y almacenamiento
        if (elements.appVersion) elements.appVersion.textContent = window.APP_VERSION || '1.0.0';
        if (elements.storageUsed) {
            try {
                var total = 0;
                for (var i = 0; i < localStorage.length; i++) {
                    var k = localStorage.key(i);
                    total += (localStorage.getItem(k) || '').length;
                }
                elements.storageUsed.textContent = (total / 1024).toFixed(1) + ' KB';
            } catch (e) { elements.storageUsed.textContent = '—'; }
        }
    }

    function renderThemeMode() {
        if (!elements.themeModeOptions || !window.ThemeService) return;
        var actual = window.ThemeService.getCurrentTheme ? window.ThemeService.getCurrentTheme() : 'dark';
        var current = (typeof actual === 'string') ? actual.toLowerCase() : 'dark';
        elements.themeModeOptions.querySelectorAll('.perfil-segmented__btn').forEach(function (btn) {
            btn.classList.toggle('perfil-segmented__btn--activo', btn.dataset.tema === current);
        });
    }

    function renderAccessibility() {
        if (!window.ThemeService || !window.ThemeService.getThemeState) return;
        var s = window.ThemeService.getThemeState();
        if (elements.toggleAltoContraste) elements.toggleAltoContraste.checked = !!s.highContrast;
        if (elements.toggleTextoGrande) elements.toggleTextoGrande.checked = !!s.largeText;
        if (elements.toggleReducirMovimiento) elements.toggleReducirMovimiento.checked = !!s.reducedMotion;
    }

    function updateThemeUI(themeState) {
        if (elements.themeModeOptions) {
            var current = (themeState && themeState.theme ? themeState.theme : 'dark').toLowerCase();
            elements.themeModeOptions.querySelectorAll('.perfil-segmented__btn').forEach(function (btn) {
                btn.classList.toggle('perfil-segmented__btn--activo', btn.dataset.tema === current);
            });
        }
        renderAccessibility();
    }

    function clearCache() {
        if (!elements.clearCacheBtn) return;
        var btn = elements.clearCacheBtn;
        var originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Limpiando...';

        if ('caches' in window) {
            caches.keys().then(function (names) {
                names.forEach(function (name) { caches.delete(name); });
            });
        }
        if (window.showToast) window.showToast('Caché limpiado correctamente');

        setTimeout(function () {
            btn.disabled = false;
            btn.textContent = originalText;
            if (window.lucide) window.lucide.createIcons({ root: btn });
        }, 1000);
    }

    // ==========================================
    // EDITAR FOTO (recorte circular)
    // ==========================================
    function recortarCircular(file, cb) {
        var reader = new FileReader();
        reader.onload = function (ev) {
            var base64 = ev.target.result;
            var img = new Image();
            img.onload = function () {
                var size = Math.min(img.width, img.height, 420);
                var canvas = document.createElement('canvas');
                canvas.width = size; canvas.height = size;
                var ctx = canvas.getContext('2d');
                ctx.save();
                ctx.beginPath();
                ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
                var sx = (img.width - size) / 2, sy = (img.height - size) / 2;
                ctx.drawImage(img, sx, sy, size, size, 0, 0, size, size);
                ctx.restore();
                cb(canvas.toDataURL('image/jpeg', 0.86));
            };
            img.onerror = function () { cb(base64); };
            img.src = base64;
        };
        reader.readAsDataURL(file);
    }

    function onFotoChange(e) {
        var file = e.target.files[0];
        e.target.value = '';
        if (!file) return;
        recortarCircular(file, function (base64) {
            if (elements.avatarImg) { elements.avatarImg.src = base64; elements.avatarImg.style.display = 'block'; }
            if (elements.avatarLetra) elements.avatarLetra.style.display = 'none';
            var uid = (typeof getCurrentUser === 'function' && getCurrentUser()) ? getCurrentUser().uid : null;
            if (!uid && window.AuthService && window.AuthService.getCurrentUser) uid = window.AuthService.getCurrentUser().uid;
            if (uid && window.ProfileSystem && window.ProfileSystem.actualizarFoto) {
                window.ProfileSystem.actualizarFoto(uid, base64).then(function (ok) {
                    if (window.showToast) window.showToast(ok ? 'Foto de perfil actualizada.' : 'No se pudo guardar la foto.', !ok);
                });
            }
        });
    }

    function editarNombre() {
        var user = state.user;
        if (!user) return;
        var actual = user.name || user.username || '';
        var nuevo = window.prompt('Editar nombre', actual);
        if (nuevo === null) return;
        nuevo = nuevo.trim();
        if (!nuevo || nuevo === actual) return;
        var uid = (typeof getCurrentUser === 'function' && getCurrentUser()) ? getCurrentUser().uid : null;
        if (!uid && window.AuthService && window.AuthService.getCurrentUser) uid = window.AuthService.getCurrentUser().uid;
        if (uid && window.ProfileSystem && window.ProfileSystem.actualizarNombre) {
            window.ProfileSystem.actualizarNombre(uid, nuevo).then(function (ok) {
                if (ok) {
                    if (elements.name) elements.name.textContent = nuevo;
                    user.name = nuevo;
                    if (window.showToast) window.showToast('Nombre actualizado.');
                } else if (window.showToast) {
                    window.showToast('No se pudo guardar el nombre.', true);
                }
            });
        }
    }

    // Esperar a que el bridge (módulo) exponga ThemeService
    if (window.ThemeService) {
        init();
    } else {
        window.addEventListener('profile:bridge-ready', init);
    }
})();
