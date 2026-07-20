// ==========================================
// Welcome Screen - Mood Check-in
// "Buenos días, Darwin ☀️ ¿Cómo te sientes hoy?"
// ==========================================

(function () {
    'use strict';

    var MOODS = [
        { id: 'great', label: 'Muy bieeeen', desc: 'Todo brilla ✨', emoji: '🤍🤍🤍' },
        { id: 'good', label: 'Bien', desc: 'Un día bonito 😊', emoji: '😊' },
        { id: 'meh', label: 'Un poquito mal', desc: 'Podría mejorar 🌧️', emoji: '😕' },
        { id: 'bad', label: 'Mal', desc: 'Día difícil 😔', emoji: '😔' },
        { id: 'love', label: 'Necesito cariño', desc: 'Un abrazo 🤗', emoji: '❤️' }
    ];

    var STORAGE_DATE_KEY = 'personalHub.welcomeDate';

    var selectedMood = null;
    var screen = null;
    var moodButtons = [];
    var continueBtn = null;
    var userName = 'Darwin';
    var revealTimer = null;
    var particlesInterval = null;

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

    function getToday() {
        return new Date().toISOString().split('T')[0];
    }

    function hasSeenToday() {
        return localStorage.getItem(STORAGE_DATE_KEY) === getToday();
    }

    function getStoredMood() {
        try {
            var raw = localStorage.getItem('personalHub.welcomeMood');
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }

    function setStoredMood(mood) {
        var data = { mood: mood, timestamp: new Date().toISOString() };
        localStorage.setItem('personalHub.welcomeMood', JSON.stringify(data));
        localStorage.setItem(STORAGE_DATE_KEY, getToday());
    }

    function getUid() {
        if (window.SessionManager && window.SessionManager.isLoggedIn()) {
            return window.SessionManager.getUid();
        }
        if (window.auth && window.auth.currentUser) {
            return window.auth.currentUser.uid;
        }
        return null;
    }

    function createMoodButton(mood, index) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mood-btn animate-mood-in';
        btn.dataset.mood = mood.id;
        btn.style.animationDelay = (200 + index * 90) + 'ms';
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
            continueBtn.classList.add('ready');
            continueBtn.classList.add('animate-btn-in');
        }

        if ('vibrate' in navigator) navigator.vibrate(20);

        var selectedBtn = screen.querySelector('.mood-btn.selected');
        if (selectedBtn) {
            selectedBtn.style.transform = 'scale(1.02)';
            setTimeout(function () { selectedBtn.style.transform = ''; }, 200);
        }
    }

    function saveMoodAndContinue() {
        if (!selectedMood) return;

        var moodData = MOODS.find(function (m) { return m.id === selectedMood; });
        setStoredMood(moodData);
        syncToFirebase(moodData);

        hideScreen();
    }

    function syncToFirebase(moodData) {
        var uid = getUid();
        if (!uid || !window.db) return;

        var today = getToday();
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
        if (hasSeenToday()) return false;
        if (screen) {
            screen.style.display = '';
            screen.classList.remove('hidden', 'is-closing');
        } else {
            createScreen();
            screen = document.getElementById('welcomeScreen');
        }

        // Get user name
        if (window.SessionManager && window.SessionManager.isLoggedIn()) {
            var user = window.SessionManager.getUserObject();
            if (user && user.name) userName = user.name;
        }

        renderMoods();
        updateUserName();

        screen.classList.remove('is-closing');
        screen.style.display = '';
        screen.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        // Animate greeting reveal
        var greeting = screen.querySelector('.welcome-screen__greeting');
        if (greeting) {
            greeting.classList.add('animate-reveal');
        }

        setTimeout(function () {
            var firstBtn = screen.querySelector('.mood-btn');
            if (firstBtn) firstBtn.focus();
        }, 600);

        // Floating particles
        startParticles();

        return true;
    }

    function hideScreen() {
        if (!screen) return;

        screen.classList.add('is-closing');
        screen.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';

        stopParticles();

        setTimeout(function () {
            screen.style.display = 'none';
        }, 600);
    }

    function startParticles() {
        stopParticles();
        var bg = screen.querySelector('.welcome-screen__bg');
        if (!bg) return;

        var symbols = ['✦', '❤', '✧', '✦', '❤', '✧', '✦', '❤', '✧'];
        particlesInterval = setInterval(function () {
            var p = document.createElement('span');
            p.className = 'welcome-screen__particle';
            p.textContent = symbols[Math.floor(Math.random() * symbols.length)];
            p.style.left = Math.random() * 100 + '%';
            p.style.top = Math.random() * 100 + '%';
            p.style.fontSize = (0.6 + Math.random() * 1.2) + 'rem';
            p.style.animationDuration = (6 + Math.random() * 8) + 's';
            p.style.opacity = '0.08';
            bg.appendChild(p);
            setTimeout(function () { if (p.parentNode) p.remove(); }, 14000);
        }, 2000);
    }

    function stopParticles() {
        if (particlesInterval) {
            clearInterval(particlesInterval);
            particlesInterval = null;
        }
    }

    function updateUserName() {
        var nameEl = screen.querySelector('.welcome-screen__name');
        if (nameEl) nameEl.textContent = userName;
    }

    function createScreen() {
        var html =
            '<div class="welcome-screen" id="welcomeScreen" role="dialog" aria-modal="true" aria-labelledby="welcomeTitle" style="display:none;">' +
                '<div class="welcome-screen__bg">' +
                    '<div class="welcome-screen__bg-gradient"></div>' +
                '</div>' +
                '<div class="welcome-screen__content">' +
                    '<div class="welcome-screen__greeting">' +
                        '<div class="welcome-screen__time-icon">' +
                            '<i data-lucide="' + getTimeIcon() + '"></i>' +
                        '</div>' +
                        '<h1 id="welcomeTitle" class="welcome-screen__title">' +
                            getGreeting() + ',<br>' +
                            '<span class="welcome-screen__name">' + userName + '</span>' +
                            ' <span class="welcome-screen__sun">☀️</span>' +
                        '</h1>' +
                        '<p class="welcome-screen__subtitle">¿Cómo te sientes hoy?</p>' +
                    '</div>' +
                    '<div class="welcome-screen__moods" role="radiogroup" aria-label="Selecciona tu estado de ánimo"></div>' +
                    '<div class="welcome-screen__cta">' +
                        '<button type="button" class="welcome-btn" id="welcomeContinueBtn" disabled>' +
                            '<span>Seguir</span>' +
                            '<i data-lucide="arrow-right"></i>' +
                        '</button>' +
                    '</div>' +
                    '<div class="welcome-screen__footer">' +
                        '<p class="welcome-screen__note">Se guarda en tu nube privada ☁️</p>' +
                    '</div>' +
                '</div>' +
            '</div>';

        var container = document.createElement('div');
        container.innerHTML = html;
        document.body.appendChild(container.firstElementChild);

        screen = document.getElementById('welcomeScreen');

        continueBtn = document.getElementById('welcomeContinueBtn');
        if (continueBtn) {
            continueBtn.addEventListener('click', saveMoodAndContinue);
        }

        if (typeof lucide !== 'undefined' && screen) {
            lucide.createIcons({ root: screen });
        }
    }

    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', tryInit);
        } else {
            tryInit();
        }
    }

    function tryInit() {
        var attempts = 0;
        var waitForSession = setInterval(function () {
            attempts++;
            var hasSession = window.SessionManager && window.SessionManager.isLoggedIn();
            var hasFirebase = window.auth && window.auth.currentUser;

            if (hasSession || hasFirebase) {
                clearInterval(waitForSession);

                // Pequeño retardo para que cargue todo el DOM
                setTimeout(function () {
                    showScreen();
                    // Si Firebase Auth está presente pero SessionManager no tiene sesión, crear sesión
                    if (!hasSession && hasFirebase && window.SessionManager && window.db) {
                        var user = window.auth.currentUser;
                        var email = user.email || '';
                        window.db.collection('users').where('username', '==', email).limit(1).get()
                            .then(function (snap) {
                                if (!snap.empty) {
                                    var doc = snap.docs[0];
                                    var data = doc.data();
                                    window.SessionManager.createSession({
                                        id: doc.id, username: data.username, name: data.name || data.username,
                                        photo: data.photo || '', role: data.role || 'user',
                                        enabled: data.enabled !== false, preferences: data.preferences || {},
                                        profile: data.profile || {}
                                    });
                                }
                            }).catch(function () {});
                    }
                }, 800);
                return;
            }

            if (attempts > 100) {
                clearInterval(waitForSession);
                // Mostrar welcome sin autenticación (con datos locales)
                showScreen();
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