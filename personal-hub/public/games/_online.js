/* ==========================================================
   GAMES — ONLINE BATTLE BRIDGE ("modo reto")
   Included by every /games/*.html that supports online play.
   Active ONLY when the parent loads the game with
   ?online=1&game=<id> (OnlineGame.js, modo reto).

   - Watches the post-game modal (#gameMessage.show).
   - Extracts the FINAL score from a per-game source
     (HUD element id or a regex over the modal text).
   - Posts { type: 'ph-score', score } to the parent.
   - Locks the modal so the player can't restart the run
     while the score is being submitted (the parent decides
     the next step: result or rival's turn).

   If a score can't be read, nothing is posted and the modal
   stays unlocked: the player can play again and the next
   game-over will send the score.
   ========================================================== */
(function () {
  'use strict';

  var params = new URLSearchParams(location.search);
  if (params.get('online') !== '1') return;
  var GAME_ID = params.get('game') || '';
  /* Modo carrera (?race=1): además de la puntuación se envía el TIEMPO,
     que es lo que decide quién fue más rápido. */
  var RACE = params.get('race') === '1';

  /* Fuente de la puntuación final por juego:
     · el  -> id de un elemento del HUD que muestra el marcador final
     · text-> regex sobre el texto del modal de fin de partida (#msgText)
     · timeText -> (carrera) regex del tiempo en el modal */
  var SCORE_SOURCES = {
    '2048': { el: 'scoreDisplay' },
    'agujero-negro': { el: 'scoreDisplay' },
    'ahorcado': { text: /Aciertos:\s*(\d+)/ },
    'breakout': { el: 'scoreDisplay' },
    'buscaminas': { el: 'revealedDisplay' },
    'cuchillos': { el: 'scoreDisplay' },
    'invaders': { el: 'scoreDisplay' },
    'laberinto': { el: 'levelDisplay' },
    'memoria': { text: /Movimientos:\s*(\d+)/, timeText: /Tiempo:\s*(\d+)s/ },
    'meteoritos': { el: 'scoreDisplay' },
    'pong': { el: 'p1Display' },
    'simon': { text: /Ronda:\s*(\d+)/ },
    'snake': { el: 'scoreDisplay' },
    'tetris': { el: 'scoreDisplay' },
    'tiroarco': { el: 'scoreDisplay' },
    'torre': { el: 'scoreDisplay' }
  };

  function readScore() {
    var source = SCORE_SOURCES[GAME_ID];
    if (!source) return null;
    var value = null;
    if (source.el) {
      var el = document.getElementById(source.el);
      if (el) value = parseInt(String(el.textContent).replace(/[^\d]/g, ''), 10);
    } else if (source.text) {
      var msg = document.getElementById('msgText');
      var match = msg && msg.textContent.match(source.text);
      if (match) value = parseInt(match[1], 10);
    }
    if (value === null || Number.isNaN(value)) return null;
    return Math.max(0, value);
  }

  /* Carrera: tiempo en segundos desde el modal de fin de partida. */
  function readTime() {
    var source = SCORE_SOURCES[GAME_ID];
    if (!source || !source.timeText) return null;
    var msg = document.getElementById('msgText');
    var match = msg && msg.textContent.match(source.timeText);
    var value = match ? parseInt(match[1], 10) : null;
    if (value === null || Number.isNaN(value)) return null;
    return Math.max(0, value);
  }

  /* ==========================================================
     PROGRESO EN VIVO — cada juego expone una función que lee su
     HUD y devuelve la métrica del momento. Se envía al padre
     (~1×/s) para que el rival vea tu avance en su HUD de duelo.
     ========================================================== */
  var PROGRESS_SOURCES = {
    'memoria': function () {
      var pairs = document.getElementById('pairCount');
      var moves = document.getElementById('moveCount');
      var time = document.getElementById('timerDisplay');
      var m = pairs ? String(pairs.textContent).trim().split('/') : [];
      return {
        pairs: parseInt(m[0], 10) || 0,
        totalPairs: parseInt(m[1], 10) || 0,
        moves: parseInt(String(moves && moves.textContent).replace(/\D/g, ''), 10) || 0,
        seconds: parseInt(String(time && time.textContent).replace(/\D/g, ''), 10) || 0
      };
    }
  };

  if (RACE) {
    var progressTimer = setInterval(function () {
      if (posted) { clearInterval(progressTimer); return; }
      var read = PROGRESS_SOURCES[GAME_ID];
      if (!read) return;
      try {
        var progress = read();
        if (progress) {
          window.parent.postMessage({ type: 'ph-progress', game: GAME_ID, progress: progress }, '*');
        }
      } catch (e) { /* el padre puede haberse ido: nada que hacer */ }
    }, 1000);
  }

  var modal = document.getElementById('gameMessage');
  if (!modal) return;

  var posted = false;
  function onGameOver() {
    if (posted || !modal.classList.contains('show')) return;
    var score = readScore();
    if (score === null) return;
    var time = RACE ? readTime() : null;
    if (RACE && time === null) return;
    posted = true;
    /* Bloquea reiniciar / volver mientras se envía el resultado. */
    var btn = document.getElementById('msgBtn');
    if (btn) btn.disabled = true;
    var back = modal.querySelector('.msg-back');
    if (back) back.remove();
    var title = modal.querySelector('#msgTitle');
    if (title) title.textContent = RACE ? '¡Terminaste!' : '¡Ronda completada!';
    var text = modal.querySelector('#msgText');
    if (text) text.textContent = RACE ? 'Enviando tu tiempo. Esperando resultado…' : 'Puntuación enviada. Esperando a tu rival…';
    if (progressTimer) clearInterval(progressTimer);
    try {
      if (RACE) {
        window.parent.postMessage({ type: 'ph-race', score: score, time: time, game: GAME_ID }, '*');
      } else {
        window.parent.postMessage({ type: 'ph-score', score: score, game: GAME_ID }, '*');
      }
    } catch (e) { /* el padre puede haberse ido: nada que hacer */ }
  }

  if (window.MutationObserver) {
    var observer = new MutationObserver(function () { onGameOver(); });
    observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
  }
  if (modal.classList.contains('show')) onGameOver();
})();
