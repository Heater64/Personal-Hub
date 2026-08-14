/* ==========================================================
   GAMES — INTERFACE ENHANCER "Personal Hub"
   Shared by /games/*.html (loaded before _postgame.js).
   Aligns every game's HUD with the web's design system:
   - Converts .score-item chips into icon stat chips
     (.stat / .stat-label / .stat-value) like Memoria/Ahorcado.
   - Injects the 🔊 sound toggle button into the toolbar.
   - Exposes window.SFX (WebAudio tones) + window.buzz
     (vibration) so each game wires its own events with
     1-line calls: SFX.point(), SFX.win(), SFX.lose(),
     SFX.record(), SFX.special(), SFX.click().
   - Keyboard: M toggles sound.
   ========================================================== */
(function () {
  'use strict';

  var gameId = (location.pathname.split('/').pop() || 'game').replace(/\.html$/i, '');
  var soundKey = gameId + 'Sound';

  /* ==========================================================
     SONIDO — WebAudio sin assets (oscillator + gain)
     ========================================================== */
  var soundOn = localStorage.getItem(soundKey) !== 'off';
  var audioCtx = null;

  function ensureAudio() {
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }

  function tone(freq, dur, type, gain, delay) {
    dur = dur || 0.12; type = type || 'sine'; gain = gain || 0.07; delay = delay || 0;
    if (!soundOn || !audioCtx) return;
    var t = audioCtx.currentTime + delay;
    var osc = audioCtx.createOscillator();
    var g = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  var SFX = {
    get on() { return soundOn; },
    set on(v) { soundOn = !!v; localStorage.setItem(soundKey, soundOn ? 'on' : 'off'); },
    toggle: function () { SFX.on = !soundOn; return soundOn; },
    ensureAudio: ensureAudio,
    tone: tone,
    /* punto / acierto */
    point: function () { tone(440, 0.09, 'triangle', 0.07); tone(660, 0.12, 'triangle', 0.06, 0.06); },
    /* impacto / golpe */
    hit: function () { tone(220, 0.12, 'square', 0.07); tone(150, 0.15, 'square', 0.06, 0.08); },
    /* victoria */
    win: function () { [523, 659, 784, 1046].forEach(function (f, i) { tone(f, 0.16, 'triangle', 0.08, i * 0.12); }); },
    /* derrota */
    lose: function () { tone(300, 0.2, 'sawtooth', 0.05); tone(220, 0.22, 'sawtooth', 0.05, 0.16); tone(160, 0.4, 'sawtooth', 0.05, 0.32); },
    /* récord nuevo */
    record: function () { [523, 659, 784, 1046, 1318].forEach(function (f, i) { tone(f, 0.18, 'triangle', 0.09, i * 0.1); }); },
    /* bonus / comida especial */
    special: function () { tone(523, 0.1, 'sine', 0.07); tone(784, 0.1, 'sine', 0.07, 0.08); tone(1046, 0.16, 'sine', 0.07, 0.16); },
    /* clic / UI */
    click: function () { tone(320, 0.07, 'sine', 0.04); },
    /* pausa */
    pause: function () { tone(320, 0.08, 'sine', 0.04); }
  };

  function buzz(pattern) {
    if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) { /* noop */ } }
  }

  window.SFX = SFX;
  window.buzz = buzz;

  /* ==========================================================
     BOTÓN DE SONIDO — se inyecta en el .toolbar del juego
     ========================================================== */
  function updateSoundBtn(btn) { if (btn) btn.textContent = soundOn ? '🔊' : '🔇'; }

  function injectSoundButton() {
    if (document.getElementById('phSfxBtn')) return;
    var btn = document.createElement('button');
    btn.id = 'phSfxBtn';
    btn.className = 'icon-btn';
    btn.title = 'Sonido (M)';
    btn.setAttribute('aria-label', 'Activar o silenciar sonido');
    updateSoundBtn(btn);
    btn.addEventListener('click', function () {
      ensureAudio();
      SFX.toggle();
      updateSoundBtn(btn);
      if (soundOn) tone(660, 0.1, 'triangle', 0.06);
    });

    var toolbar = document.querySelector('.toolbar');
    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.className = 'toolbar';
      var header = document.querySelector('.game-header');
      var title = document.querySelector('.game-container h1, .game-container h2');
      if (header) header.appendChild(toolbar);
      else if (title) title.insertAdjacentElement('afterend', toolbar);
      else document.querySelector('.game-container').insertBefore(toolbar, document.querySelector('.game-container').firstChild);
    }
    toolbar.insertBefore(btn, toolbar.firstChild);
  }

  /* ==========================================================
     INSIGNIA DE EMOJI — identidad propia de cada juego
     Inyecta el emoji del juego como insignia en .game-header
     (estilada por _game-ui.css con el acento ?accent=HEX).
     ========================================================== */
  var GAME_EMOJI = {
    '2048': '🔢', 'agujero-negro': '🕳️', 'ahorcado': '💀', 'breakout': '🧱',
    'buscaminas': '💣', 'cuchillos': '🔪', 'invaders': '👾', 'laberinto': '🌀',
    'memoria': '🧠', 'meteoritos': '☄️', 'pong': '🏓', 'simon': '🔔',
    'snake': '🐍', 'tetris': '🧩', 'tiroarco': '🎯', 'torre': '🏗️',
    'conecta4': '🔴', 'tresenraya': '❌', 'battleship': '🚢'
  };

  function injectHeaderEmoji() {
    var emoji = GAME_EMOJI[gameId];
    if (!emoji) return;
    var header = document.querySelector('.game-header');
    if (!header || header.querySelector('.game-header__emoji')) return;
    var badge = document.createElement('span');
    badge.className = 'game-header__emoji';
    badge.textContent = emoji;
    badge.setAttribute('aria-hidden', 'true');
    header.insertBefore(badge, header.firstChild);
  }

  /* ==========================================================
     CHIPS CON ICONOS — .score-item → .stat (icono + etiqueta)
     ========================================================== */
  var ICONS = {
    'puntuación': '🍎', 'puntuacion': '🍎', 'puntos': '⭐', 'punto': '⭐',
    'récord': '🏆', 'record': '🏆', 'mejor': '👑',
    'vidas': '❤️', 'longitud': '🐍', 'tiempo': '⏱️', 'nivel': '📈',
    'racha': '🔥', 'minas': '💣', 'reveladas': '🔍', 'estado': '🚩',
    'aciertos': '🎯', 'disparos': '🔫', 'ronda': '🔁', 'pisos': '🏗️',
    'masa': '🪐', 'bloques': '🧱', 'cuchillos': '🔪', 'intentos': '🎯',
    'letras': '🔤', 'pares': '👫', 'movimientos': '🎯', 'altura': '📏'
  };

  function upgradeChips() {
    document.querySelectorAll('.score-item').forEach(function (item) {
      if (item.querySelector('.stat-label')) return; // ya mejorado
      var labelEl = item.querySelector('.label');
      var valueEl = item.querySelector('.value');
      if (!labelEl || !valueEl) return;

      var label = labelEl.textContent.trim();
      var icon = ICONS[label.toLowerCase()] || '✨';

      var colorClass = '';
      valueEl.classList.forEach(function (c) {
        if (['gold', 'green', 'red', 'white'].indexOf(c) !== -1 && c !== 'white') colorClass = c;
      });

      item.classList.remove('score-item');
      item.classList.add('stat');

      var newLabel = document.createElement('span');
      newLabel.className = 'stat-label';
      newLabel.textContent = icon + ' ' + label;

      // IMPORTANTE: se REUTILIZA el elemento .value original en vez de
      // sustituirlo por uno nuevo. Los juegos guardaron su referencia con
      // getElementById ANTES de que este script corriera; reemplazar el nodo
      // dejaba el HUD congelado (el juego escribía en un nodo desconectado y
      // el marcador visible nunca se actualizaba).
      valueEl.className = 'stat-value' + (colorClass ? ' ' + colorClass : '');
      valueEl.textContent = valueEl.textContent;

      item.innerHTML = '';
      item.appendChild(newLabel);
      item.appendChild(valueEl);
    });
  }

  /* ==========================================================
     TECLADO — M alterna sonido
     ========================================================== */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'm' || e.key === 'M') {
      ensureAudio();
      SFX.toggle();
      updateSoundBtn(document.getElementById('phSfxBtn'));
    }
  });

  /* ==========================================================
     INIT
     ========================================================== */
  injectHeaderEmoji();
  injectSoundButton();
  upgradeChips();
})();
