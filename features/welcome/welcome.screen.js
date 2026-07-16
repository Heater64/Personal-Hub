// ==========================================
// Welcome Screen - Mood Check-in
// ==========================================

(function () {
    'use strict';

    var MOODS = [
        { id: 'great', label: 'Muy bieeeen', desc: 'Todo brilla hoy ✨', emoji: '🤍' },
        { id: 'good', label: 'Bien', desc: 'Un día normal y bonito 😊', emoji: '😊' },
        { id: 'meh', label: 'Regular', desc: 'Ni fu ni fa 😕', emoji: '😕' },
        { id: 'bad', label: 'Mal', desc: 'Un día difícil 😔', emoji: '😔' },
        { id: 'love', label: 'Necesito cariño', desc: 'Un abrazo virtual 🤗', emoji: '❤️' }
    ];

    var STORAGE_KEY = 'personalHub.welcomeMood';
    var STORAGE_DATE_KEY = 'personalHub.welcomeDate';

    var selectedMood = null;
    var screen = null;
    var moodButtons = [];
    var continueBtn = null;
    var statsLink = null;
    var userName = 'Darwin';

    function getTimeIcon() {
        var hour = new Date().getHours();
        if (hour >= 5 && hour < 12) return 'sunrise';
        if (hour >= 12 && hour < 18) return 'sun';
        if (hour >= 18 && hour < 22) return 'sunset';
        return 'moon';
    }

    function getGreeting() {
        var hour = new Date().getHours();
        if (hour >= 5 && hour < 12) return 'Buenos días';
        if (hour >= 12 && hour < 18) return 'Buenas tardes';
        if (hour >= 18 && hour < 22) return 'Buenas noches';
        return 'Buenas noches';
    }

    function hasSeenToday() {
        var today = new Date().toISOString().split('T')[0];
        var lastDate = localStorage.getItem(STORAGE_DATE_KEY);
        return lastDate === today;
    }

    function getStoredMood() {
        try {
            var data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    }

    function setStoredMood(mood) {
        var today = new Date().toISOString().split('T')[0];
        var data = {
            mood: mood,
            timestamp: new Date().toISOString()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        localStorage.setItem(STORAGE_DATE_KEY, today);
    }

    function createMoodButton(mood, index) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mood-btn';
        btn.dataset.mood = mood.id;
        btn.style.animationDelay = (index * 80) + 'ms';
        btn.innerHTML =
            '<span class="mood-btn__emoji">' + mood.emoji + '</span>' +
            '<div class="mood-btn__text">' +
                '<span class="mood-btn__label">' + mood.label + '</span>' +
                '<span class="mood-btn__desc">' + mood.desc + '</span>' +
            '</div>' +
            '<span class="mood-btn__check"><i data-lucide="check"></i></span>';
        return btn;
    }

    function renderMoods() {
        var container = screen.querySelector('.welcome-screen__moods');
        if (!container) return;

        container.innerHTML = '';
        moodButtons = [];

        MOODS.forEach(function (mood, index) {
            var btn = createMoodButton(mood, index);
            btn.addEventListener('click', function () { selectMood(mood.id); });
            container.appendChild(btn);
            moodButtons.push(btn);
        });

        if (typeof lucide !== 'undefined') {
            lucide.createIcons({ root: container });
        }
    }

    function selectMood(moodId) {
        selectedMood = moodId;

        moodButtons.forEach(function (btn) {
            var isSelected = btn.dataset.mood === moodId;
            btn.classList.toggle('selected', isSelected);
            btn.setAttribute('aria-pressed', isSelected);
        });

        if (continueBtn) {
            continueBtn.disabled = false;
            continueBtn.removeAttribute('disabled');
        }

        // Haptic feedback
        if ('vibrate' in navigator) {
            navigator.vibrate(50);
        }

        // Particle burst
        if (window.launchParticles) {
            var selectedBtn = screen.querySelector('.mood-btn.selected');
            if (selectedBtn) {
                window.launchParticles({
                    amount: 8,
                    symbols: ['✦', '❤', '✧'],
                    colors: ['#c65a3a', '#ffb347', '#ff8aa1'],
                    spread: 80,
                    duration: 1000,
                    source: selectedBtn
                });
            }
        }
    }

    function saveMoodAndContinue() {
        if (!selectedMood) return;

        var moodData = MOODS.find(function (m) { return m.id === selectedMood; });
        setStoredMood(moodData);

        // Sync with Firebase if available
        syncToFirebase(moodData);

        // Hide screen with animation
        hideScreen();

        // Trigger home page ambient decor
        if (window.triggerAmbientDecor) {
            setTimeout(window.triggerAmbientDecor, 500);
        }
    }

    function syncToFirebase(moodData) {
        if (!window.db || !window.SessionManager || !window.SessionManager.isLoggedIn()) return;

        var uid = window.SessionManager.getUid();
        if (!uid) return;

        var today = new Date().toISOString().split('T')[0];
        var docRef = window.db.collection('users').doc(uid).collection('moods').doc(today);

        docRef.set({
            mood: moodData.id,
            label: moodData.label,
            emoji: moodData.emoji,
            timestamp: new Date().toISOString()
        }, { merge: true }).catch(function (err) {
            console.warn('No se pudo sincronizar el estado de ánimo:', err);
        });
    }

    function showScreen() {
        if (hasSeenToday()) {
            // Already seen today, don't show
            return false;
        }

        screen = document.getElementById('welcomeScreen');
        if (!screen) {
            // Create screen if it doesn't exist
            createScreen();
            screen = document.getElementById('welcomeScreen');
        }

        // Get user name
        if (window.SessionManager && window.SessionManager.isLoggedIn()) {
            var user = window.SessionManager.getUserObject();
            if (user && user.name) {
                userName = user.name;
            }
        }

        renderMoods();
        updateUserName();

        // Show with animation
        screen.classList.remove('hidden');
        screen.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        // Focus first mood button for accessibility
        setTimeout(function () {
            var firstBtn = screen.querySelector('.mood-btn');
            if (firstBtn) firstBtn.focus();
        }, 300);

        return true;
    }

    function hideScreen() {
        if (!screen) return;

        screen.classList.add('hidden');
        screen.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';

        setTimeout(function () {
            screen.style.display = 'none';
        }, 500);
    }

    function updateUserName() {
        var nameEl = screen.querySelector('.welcome-screen__name');
        if (nameEl) {
            nameEl.textContent = userName;
        }
    }

    function createScreen() {
        var html =
            '<div class="welcome-screen" id="welcomeScreen" role="dialog" aria-modal="true" aria-labelledby="welcomeTitle" style="display:none;">' +
                '<div class="welcome-screen__bg">' +
                    '<div class="welcome-screen__bg-gradient"></div>' +
                    '<div class="welcome-screen__particles">' +
                        '<span class="welcome-screen__particle">✦</span>' +
                        '<span class="welcome-screen__particle">❤</span>' +
                        '<span class="welcome-screen__particle">✧</span>' +
                        '<span class="welcome-screen__particle">✦</span>' +
                        '<span class="welcome-screen__particle">❤</span>' +
                        '<span class="welcome-screen__particle">✧</span>' +
                    '</div>' +
                '</div>' +
                '<div class="welcome-screen__content">' +
                    '<div class="welcome-screen__greeting">' +
                        '<div class="welcome-screen__time-icon">' +
                            '<i data-lucide="' + getTimeIcon() + '"></i>' +
                        '</div>' +
                        '<h1 id="welcomeTitle" class="welcome-screen__title">' + getGreeting() + ',<br><span class="welcome-screen__name">' + userName + '</span></h1>' +
                        '<p class="welcome-screen__subtitle">¿Cómo te sientes hoy?</p>' +
                    '</div>' +
                    '<div class="welcome-screen__question">' +
                        '<h2 class="welcome-screen__question-text">Tu estado de ánimo</h2>' +
                        '<p class="welcome-screen__question-hint">Elige la opción que mejor te represente</p>' +
                    '</div>' +
                    '<div class="welcome-screen__moods" role="radiogroup" aria-label="Selecciona tu estado de ánimo"></div>' +
                    '<div class="welcome-screen__cta">' +
                        '<button type="button" class="welcome-btn" id="welcomeContinueBtn" disabled>' +
                            '<span>Continuar</span>' +
                            '<i data-lucide="arrow-right"></i>' +
                        '</button>' +
                    '</div>' +
                    '<div class="welcome-screen__footer">' +
                        '<p class="welcome-screen__note">Tu respuesta se guarda de forma privada y se sincroniza con tu nube ☁️</p>' +
                        '<button type="button" class="welcome-screen__stats-link" id="welcomeStatsLink">' +
                            '<i data-lucide="bar-chart-2" style="width:14px;height:14px;"></i>' +
                            '<span>Ver estadísticas mensuales</span>' +
                        '</button>' +
                    '</div>' +
                '</div>' +
            '</div>';

        var container = document.createElement('div');
        container.innerHTML = html;
        document.body.appendChild(container.firstElementChild);

        // Bind events
        continueBtn = document.getElementById('welcomeContinueBtn');
        if (continueBtn) {
            continueBtn.addEventListener('click', saveMoodAndContinue);
        }

        statsLink = document.getElementById('welcomeStatsLink');
        if (statsLink) {
            statsLink.addEventListener('click', function (e) {
                e.preventDefault();
                hideScreen();
                if (window.openAdminPanel) {
                    window.openAdminPanel('moods');
                } else if (window.location.pathname.includes('/features/')) {
                    window.location.href = '../admin/admin.html?section=moods';
                } else {
                    window.location.href = 'features/admin/admin.html?section=moods';
                }
            });
        }

        if (typeof lucide !== 'undefined') {
            lucide.createIcons({ root: screen });
        }
    }

    function init() {
        // Wait for DOM and services
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', tryInit);
        } else {
            tryInit();
        }
    }

    function tryInit() {
        // Wait for SessionManager
        var waitForSession = setInterval(function () {
            if (window.SessionManager) {
                clearInterval(waitForSession);
                if (window.SessionManager.isLoggedIn()) {
                    showScreen();
                } else {
                    // Listen for login
                    window.SessionManager.onAuthStateChanged(function (user) {
                        if (user) showScreen();
                    });
                }
            }
        }, 100);
    }

    // Public API
    window.WelcomeScreen = {
        show: showScreen,
        hide: hideScreen,
        getMoods: function () { return MOODS; },
        getStoredMood: getStoredMood
    };

    init();
})();

console.log('👋 welcome.screen.js cargado');