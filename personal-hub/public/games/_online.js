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

  /* Fuente de la puntuación final por juego:
     · el  -> id de un elemento del HUD que muestra el marcador final
     · text-> regex sobre el texto del modal de fin de partida (#msgText) */
  var SCORE_SOURCES = {
    '2048': { el: 'scoreDisplay' },
    'agujero-negro': { el: 'scoreDisplay' },
    'ahorcado': { text: /Aciertos:\s*(\d+)/ },
    'breakout': { el: 'scoreDisplay' },
    'buscaminas': { el: 'revealedDisplay' },
    'cuchillos': { el: 'scoreDisplay' },
    'invaders': { el: 'scoreDisplay' },
    'laberinto': { el: 'levelDisplay' },
    'memoria': { text: /Movimientos:\s*(\d+)/ },
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

  var modal = document.getElementById('gameMessage');
  if (!modal) return;

  var posted = false;
  function onGameOver() {
    if (posted || !modal.classList.contains('show')) return;
    var score = readScore();
    if (score === null) return;
    posted = true;
    /* Bloquea reiniciar / volver mientras se envía la puntuación. */
    var btn = document.getElementById('msgBtn');
    if (btn) btn.disabled = true;
    var back = modal.querySelector('.msg-back');
    if (back) back.remove();
    var title = modal.querySelector('#msgTitle');
    if (title) title.textContent = '¡Ronda completada!';
    var text = modal.querySelector('#msgText');
    if (text) text.textContent = 'Puntuación enviada. Esperando a tu rival…';
    try {
      window.parent.postMessage({ type: 'ph-score', score: score, game: GAME_ID }, '*');
    } catch (e) { /* el padre puede haberse ido: nada que hacer */ }
  }

  if (window.MutationObserver) {
    var observer = new MutationObserver(function () { onGameOver(); });
    observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
  }
  if (modal.classList.contains('show')) onGameOver();
})();
