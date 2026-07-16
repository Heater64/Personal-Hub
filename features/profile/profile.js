// features/profile/profile.js
// Página de perfil con configuración completa

(function () {
    'use strict';

    var state = {
        user: null,
        initialized: false
    };

    var elements = {};

    var COLOR_THEMES = {
        coral: { name: 'Coral', primary: '#c65a3a', warm: '#ffb347' },
        ocean: { name: 'Océano', primary: '#0077b6', warm: '#90e0ef' },
        forest: { name: 'Bosque', primary: '#2d6a4f', warm: '#95d5b2' },
        violet: { name: 'Violeta', primary: '#7209b7', warm: '#c77dff' },
        rose: { name: 'Rosa', primary: '#e53e3e', warm: '#fc8181' },
        amber: { name: 'Ámbar', primary: '#d69e2e', warm: '#faf089' },
        mono: { name: 'Monocromo', primary: '#3d3d3d', warm: '#718096' }
    };

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
        renderThemeOptions();
        renderAccessibilityOptions();
        state.initialized = true;

        // Listen for theme changes
        if (window.ThemeService) {
            window.ThemeService.subscribe(updateUIFromTheme);
        }

        // Listen for auth changes
        if (window.SessionManager) {
            window.SessionManager.onAuthStateChanged(function (user) {
                if (user) {
                    loadUserData();
                } else {
                    window.location.href = '../../login.html';
                }
            });
        }

        if (window.lucide) window.lucide.createIcons();
    }

    function cacheElements() {
        elements = {
            avatar: document.getElementById('profileAvatar'),
            avatarPlaceholder: document.getElementById('profileAvatarPlaceholder'),
            initial: document.getElementById('profileInitial'),
            name: document.getElementById('profileName'),
            email: document.getElementById('profileEmail'),
            role: document.getElementById('profileRole'),
            memberSince: document.getElementById('profileMemberSince'),
            colorThemeOptions: document.getElementById('colorThemeOptions'),
            themeModeOptions: document.getElementById('themeModeOptions'),
            accessibilityOptions: document.getElementById('accessibilityOptions'),
            pushNotificationsToggle: document.getElementById('pushNotificationsToggle'),
            emailNotificationsToggle: document.getElementById('emailNotificationsToggle'),
            appVersion: document.getElementById('appVersion'),
            storageUsed: document.getElementById('storageUsed'),
            clearCacheBtn: document.getElementById('clearCacheBtn'),
            logoutBtn: document.getElementById('logoutBtn'),
            deleteAccountBtn: document.getElementById('deleteAccountBtn'),
            deleteAccountModal: document.getElementById('deleteAccountModal'),
            deleteCancelBtn: document.getElementById('deleteCancelBtn'),
            deleteConfirmBtn: document.getElementById('deleteConfirmBtn'),
            deleteModalClose: document.querySelector('#deleteAccountModal .modal-close'),
            accordions: document.querySelectorAll('.settings-accordion')
        };
    }

    function bindEvents() {
        // Accordions
        elements.accordions.forEach(function (acc) {
            var trigger = acc.querySelector('.settings-accordion__trigger');
            if (trigger) {
                trigger.addEventListener('click', function () {
                    acc.open = !acc.open;
                });
            }
        });

        // Clear cache
        if (elements.clearCacheBtn) {
            elements.clearCacheBtn.addEventListener('click', clearCache);
        }

        // Logout
        if (elements.logoutBtn) {
            elements.logoutBtn.addEventListener('click', handleLogout);
        }

        // Delete account modal
        if (elements.deleteAccountBtn) {
            elements.deleteAccountBtn.addEventListener('click', openDeleteModal);
        }
        if (elements.deleteCancelBtn) {
            elements.deleteCancelBtn.addEventListener('click', closeDeleteModal);
        }
        if (elements.deleteModalClose) {
            elements.deleteModalClose.addEventListener('click', closeDeleteModal);
        }
        if (elements.deleteConfirmBtn) {
            elements.deleteConfirmBtn.addEventListener('click', confirmDeleteAccount);
        }
        if (elements.deleteAccountModal) {
            elements.deleteAccountModal.addEventListener('click', function (e) {
                if (e.target === elements.deleteAccountModal) closeDeleteModal();
            });
        }

        // ESC to close modal
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && elements.deleteAccountModal && !elements.deleteAccountModal.hidden) {
                closeDeleteModal();
            }
        });
    }

    function loadUserData() {
        if (window.SessionManager && window.SessionManager.isLoggedIn()) {
            var user = window.SessionManager.getUserObject();
            state.user = user;
            renderUserProfile(user);
        }
    }

    function renderUserProfile(user) {
        if (!user) return;

        // Name
        if (elements.name) {
            elements.name.textContent = user.name || user.username || 'Usuario';
        }

        // Avatar
        var initial = (user.name || user.username || '?').charAt(0).toUpperCase();
        if (elements.initial) elements.initial.textContent = initial;

        if (user.photo) {
            if (elements.avatar) {
                elements.avatar.src = user.photo;
                elements.avatar.style.display = 'block';
            }
            if (elements.avatarPlaceholder) elements.avatarPlaceholder.style.display = 'none';
        } else {
            if (elements.avatar) elements.avatar.style.display = 'none';
            if (elements.avatarPlaceholder) elements.avatarPlaceholder.style.display = 'flex';
        }

        // Email
        if (elements.email) {
            var emailSpan = elements.email.querySelector('span');
            if (emailSpan) emailSpan.textContent = user.username || user.email || '—';
        }

        // Role
        if (elements.role) {
            var roleSpan = elements.role.querySelector('span');
            if (roleSpan) roleSpan.textContent = user.role === 'admin' ? 'Administrador' : 'Usuario';
        }

        // Member since
        if (elements.memberSince) {
            var sinceSpan = elements.memberSince.querySelector('span');
            var created = user.profile?.createdAt || user.createdAt || user.loginTime;
            if (sinceSpan && created) {
                var date = new Date(created);
                sinceSpan.textContent = 'Miembro desde ' + date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long' });
            }
        }
    }

    function renderThemeOptions() {
        // Color themes
        if (elements.colorThemeOptions) {
            elements.colorThemeOptions.innerHTML = Object.entries(COLOR_THEMES).map(function (_ref) {
                var key = _ref[0];
                var theme = _ref[1];
                return '<label class="color-theme-option" role="radio" aria-checked="false" data-color-theme="' + key + '">' +
                    '<input type="radio" name="color-theme" value="' + key + '" hidden>' +
                    '<div class="color-theme-option__swatch" style="background: linear-gradient(135deg, ' + theme.primary + ', ' + theme.warm + ');" title="' + theme.name + '"></div>' +
                '</label>';
            }).join('');

            // Bind events
            elements.colorThemeOptions.querySelectorAll('.color-theme-option').forEach(function (option) {
                option.addEventListener('click', function () {
                    if (window.ThemeService) {
                        window.ThemeService.setColorTheme(this.dataset.colorTheme);
                    }
                });
            });
        }

        // Theme modes
        if (elements.themeModeOptions) {
            var modes = [
                { value: 'auto', label: 'Auto', icon: 'monitor' },
                { value: 'dark', label: 'Oscuro', icon: 'moon' },
                { value: 'light', label: 'Claro', icon: 'sun' }
            ];

            elements.themeModeOptions.innerHTML = modes.map(function (mode) {
                return '<label class="theme-option" role="radio" aria-checked="false" data-theme-value="' + mode.value + '">' +
                    '<input type="radio" name="theme-mode" value="' + mode.value + '" hidden>' +
                    '<div class="theme-option__card">' +
                        '<i data-lucide="' + mode.icon + '" style="width:20px;height:20px;color:var(--theme-text-muted);"></i>' +
                        '<span class="theme-option__name">' + mode.label + '</span>' +
                    '</div>' +
                '</label>';
            }).join('');

            // Bind events
            elements.themeModeOptions.querySelectorAll('.theme-option').forEach(function (option) {
                option.addEventListener('click', function () {
                    if (window.ThemeService) {
                        window.ThemeService.setTheme(this.dataset.themeValue);
                    }
                });
            });
        }

        if (window.lucide) window.lucide.createIcons({ root: document.body });
    }

    function renderAccessibilityOptions() {
        if (!elements.accessibilityOptions) return;

        var options = [
            { key: 'highContrast', label: 'Alto contraste', desc: 'Aumenta el contraste de colores para mejor legibilidad' },
            { key: 'largeText', label: 'Texto grande', desc: 'Aumenta el tamaño de fuente en toda la aplicación' },
            { key: 'extraSpacing', label: 'Espaciado extra', desc: 'Añade más espacio entre elementos' },
            { key: 'reducedMotion', label: 'Reducir movimiento', desc: 'Desactiva animaciones y transiciones' }
        ];

        elements.accessibilityOptions.innerHTML = options.map(function (opt) {
            return '<label class="accessibility-option">' +
                '<div class="accessibility-option__info">' +
                    '<span class="accessibility-option__label">' + opt.label + '</span>' +
                    '<span class="accessibility-option__desc">' + opt.desc + '</span>' +
                '</div>' +
                '<button class="toggle-switch accessibility-option__toggle" type="button" role="switch" aria-checked="false" data-a11y="' + opt.key + '">' +
                    '<input type="checkbox" hidden>' +
                    '<span class="toggle-switch__slider"></span>' +
                '</button>' +
            '</label>';
        }).join('');

        // Bind toggle events
        elements.accessibilityOptions.querySelectorAll('[data-a11y]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var key = this.dataset.a11y;
                var enabled = this.getAttribute('aria-checked') === 'true';
                if (window.ThemeService) {
                    var method = 'set' + key.charAt(0).toUpperCase() + key.slice(1);
                    if (window.ThemeService[method]) {
                        window.ThemeService[method](!enabled);
                    } else if (window.ThemeService['toggle' + key.charAt(0).toUpperCase() + key.slice(1)]) {
                        window.ThemeService['toggle' + key.charAt(0).toUpperCase() + key.slice(1)]();
                    }
                }
            });
        });
    }

    function updateUIFromTheme(themeState) {
        // Update color theme options
        if (elements.colorThemeOptions) {
            elements.colorThemeOptions.querySelectorAll('.color-theme-option').forEach(function (option) {
                var value = option.dataset.colorTheme;
                var isActive = value === themeState.colorTheme;
                option.setAttribute('aria-checked', isActive);
                option.querySelector('input').checked = isActive;
            });
        }

        // Update theme mode options
        if (elements.themeModeOptions) {
            elements.themeModeOptions.querySelectorAll('.theme-option').forEach(function (option) {
                var value = option.dataset.themeValue;
                var isActive = value === themeState.theme;
                option.setAttribute('aria-checked', isActive);
                option.querySelector('input').checked = isActive;
            });
        }

        // Update accessibility toggles
        if (elements.accessibilityOptions) {
            elements.accessibilityOptions.querySelectorAll('[data-a11y]').forEach(function (btn) {
                var key = btn.dataset.a11y;
                var enabled = themeState[key];
                btn.setAttribute('aria-checked', enabled);
                btn.querySelector('input').checked = enabled;
            });
        }
    }

    function clearCache() {
        if (!elements.clearCacheBtn) return;
        
        var btn = elements.clearCacheBtn;
        var originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader" style="width:16px;height:16px;animation:spin 1s linear infinite;"></i> Limpiando...';

        // Clear localStorage (except auth)
        var authKeys = ['personalHub.session'];
        var keysToKeep = {};
        authKeys.forEach(function (key) {
            keysToKeep[key] = localStorage.getItem(key);
        });

        localStorage.clear();

        Object.keys(keysToKeep).forEach(function (key) {
            if (keysToKeep[key]) localStorage.setItem(key, keysToKeep[key]);
        });

        // Clear cache storage
        if ('caches' in window) {
            caches.keys().then(function (names) {
                names.forEach(function (name) {
                    caches.delete(name);
                });
            });
        }

        if (window.showToast) {
            window.showToast('Caché limpiado correctamente');
        }

        setTimeout(function () {
            btn.disabled = false;
            btn.innerHTML = originalText;
            if (window.lucide) window.lucide.createIcons({ root: btn });
        }, 1000);
    }

    function handleLogout() {
        if (window.AuthService) {
            window.AuthService.logout().then(function () {
                window.location.href = '../../login.html';
            });
        }
    }

    function openDeleteModal() {
        if (elements.deleteAccountModal) {
            elements.deleteAccountModal.hidden = false;
            setTimeout(function () {
                elements.deleteAccountModal.classList.add('is-open');
                elements.deleteCancelBtn.focus();
            }, 10);
        }
    }

    function closeDeleteModal() {
        if (elements.deleteAccountModal) {
            elements.deleteAccountModal.classList.remove('is-open');
            setTimeout(function () {
                elements.deleteAccountModal.hidden = true;
            }, 300);
        }
    }

    function confirmDeleteAccount() {
        var btn = elements.deleteConfirmBtn;
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader" style="width:16px;height:16px;animation:spin 1s linear infinite;"></i> Eliminando...';
        if (window.lucide) window.lucide.createIcons({ root: btn });

        if (window.AuthService && window.AuthService.getCurrentUser) {
            var user = window.AuthService.getCurrentUser();
            if (user && window.db) {
                // Delete user data from Firestore
                var batch = window.db.batch();
                var userRef = window.db.collection('users').doc(user.uid);
                batch.delete(userRef);

                // Delete subcollections
                ['preferences', 'progress', 'moods'].forEach(function (col) {
                    var colRef = userRef.collection(col);
                    colRef.get().then(function (snap) {
                        snap.docs.forEach(function (doc) {
                            batch.delete(doc.ref);
                        });
                    });
                });

                batch.commit().then(function () {
                    return window.AuthService.deleteAccount ? window.AuthService.deleteAccount() : window.AuthService.logout();
                }).then(function () {
                    closeDeleteModal();
                    window.location.href = '../../login.html?deleted=1';
                }).catch(function (err) {
                    console.error('Error deleting account:', err);
                    btn.disabled = false;
                    btn.innerHTML = '<i data-lucide="user-x" style="width:16px;height:16px;"></i> Eliminar cuenta';
                    if (window.lucide) window.lucide.createIcons({ root: btn });
                    if (window.showToast) window.showToast('Error al eliminar la cuenta', true);
                });
            }
        }
    }

    // Initialize
    init();
})();

console.log('👤 profile.js cargado');