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

      var newValue = document.createElement('span');
      newValue.className = 'stat-value' + (colorClass ? ' ' + colorClass : '');
      if (valueEl.id) newValue.id = valueEl.id;
      newValue.textContent = valueEl.textContent;

      item.innerHTML = '';
      item.appendChild(newLabel);
      item.appendChild(newValue);
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
  injectSoundButton();
  upgradeChips();
})();
