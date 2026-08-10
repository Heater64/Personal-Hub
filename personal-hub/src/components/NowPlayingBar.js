/* ==========================================
   Personal Hub — Now Playing Bar (reproductor global)
   Barra fija tipo Spotify / YouTube Music: aparece
   al reproducir cualquier canción y sigue sonando al
   navegar entre secciones (el <audio> vive en
   player.service, fuera de cualquier página).

   Órdenes:
   - play/pause: actúan sobre player.audio directamente
     (funcionan con o sin la página de Canciones montada)
   - prev/next: player.commandPrev/Next → la página de
     Canciones los ejecuta si está montada (cola/shuffle)
   ========================================== */

import { player } from '../services/player.service.js';
import { formatTime } from '../utils/format.js';
import { escapeHtml } from '../utils/escape.js';

const ICON_PLAY = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
const ICON_PAUSE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
const ICON_PREV = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="19 20 9 12 19 4 19 20"/><rect x="5" y="4" width="2.6" height="16" rx="1.3"/></svg>';
const ICON_NEXT = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"/><rect x="16.4" y="4" width="2.6" height="16" rx="1.3"/></svg>';
const ICON_CLOSE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

export function NowPlayingBar(router) {
  const bar = document.createElement('div');
  bar.className = 'now-playing-bar';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Reproductor de música');

  let info = player.info;
  let playing = player.isPlaying;

  function syncProgress() {
    if (!info || !bar.classList.contains('is-visible')) return;
    const a = player.audio;
    const fill = bar.querySelector('.npb-progress-fill');
    if (!fill) return;
    if (Number.isFinite(a.duration) && a.duration > 0) {
      fill.style.width = Math.min(100, (a.currentTime / a.duration) * 100) + '%';
    }
    const cur = bar.querySelector('.npb-time-cur');
    if (cur) cur.textContent = formatTime(a.currentTime);
    const dur = bar.querySelector('.npb-time-dur');
    if (dur && Number.isFinite(a.duration)) dur.textContent = formatTime(a.duration);
  }

  function render() {
    const app = document.getElementById('app');
    const noNav = !!app?.classList.contains('no-nav');
    const visible = !!info && !noNav;
    app?.classList.toggle('has-player', visible);

    if (!visible) {
      bar.classList.remove('is-visible');
      bar.innerHTML = '';
      return;
    }

    bar.classList.add('is-visible');
    const title = info.title || 'Personal Hub';
    const artist = info.artist || '';
    const hasCover = !!info.cover;

    bar.innerHTML = `
      <button type="button" class="npb-main" id="npbOpen" aria-label="Abrir canciones">
        <span class="npb-cover ${playing ? 'is-spinning' : ''}">
          ${hasCover ? `<img src="${escapeHtml(info.cover)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
          <span class="npb-cover-fb"${hasCover ? ' style="display:none"' : ''}>🎵</span>
        </span>
        <span class="npb-text">
          <strong class="npb-title">${escapeHtml(title)}</strong>
          <span class="npb-artist">${escapeHtml(artist)}</span>
        </span>
      </button>

      <div class="npb-controls">
        <button type="button" class="npb-btn" id="npbPrev" aria-label="Anterior" title="Anterior">${ICON_PREV}</button>
        <button type="button" class="npb-btn npb-play" id="npbToggle" aria-label="${playing ? 'Pausar' : 'Reproducir'}" title="${playing ? 'Pausar' : 'Reproducir'}">${playing ? ICON_PAUSE : ICON_PLAY}</button>
        <button type="button" class="npb-btn" id="npbNext" aria-label="Siguiente" title="Siguiente">${ICON_NEXT}</button>
      </div>

      <span class="npb-time npb-time-cur">0:00</span>
      <span class="npb-time npb-time-dur">0:00</span>

      <button type="button" class="npb-close" id="npbClose" aria-label="Detener y cerrar reproductor" title="Cerrar reproductor">${ICON_CLOSE}</button>

      <div class="npb-progress" id="npbProgress" aria-hidden="true">
        <div class="npb-progress-fill"></div>
      </div>
    `;

    bar.querySelector('#npbOpen')?.addEventListener('click', () => router.navigate('/canciones'));
    bar.querySelector('#npbToggle')?.addEventListener('click', togglePlay);
    bar.querySelector('#npbPrev')?.addEventListener('click', () => player.commandPrev());
    bar.querySelector('#npbNext')?.addEventListener('click', () => player.commandNext());
    bar.querySelector('#npbClose')?.addEventListener('click', stop);

    const prog = bar.querySelector('#npbProgress');
    if (prog) {
      const seek = (e) => {
        const a = player.audio;
        if (!Number.isFinite(a.duration) || a.duration <= 0) return;
        const rect = prog.getBoundingClientRect();
        const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
        a.currentTime = ratio * a.duration;
      };
      prog.addEventListener('click', seek);
      prog.addEventListener('keydown', (e) => {
        const a = player.audio;
        if (e.key === 'ArrowRight') { a.currentTime = Math.min(a.duration, a.currentTime + 10); e.preventDefault(); }
        else if (e.key === 'ArrowLeft') { a.currentTime = Math.max(0, a.currentTime - 10); e.preventDefault(); }
      });
    }

    syncProgress();
  }

  // Play/pause directo sobre el audio global: funciona aunque la página
  // de Canciones no esté montada (barra visible en cualquier sección).
  function togglePlay() {
    const a = player.audio;
    if (a.paused) {
      a.play().then(() => player.setPlaying(true)).catch(() => {});
    } else {
      a.pause();
      player.setPlaying(false);
    }
  }

  function stop() {
    const a = player.audio;
    a.pause();
    try { a.removeAttribute('src'); a.load(); } catch { /* no-op */ }
    player.setInfo(null);
    player.setPlaying(false);
  }

  // Estado compartido: la página de Canciones y Media Session mantienen
  // info/playing al día; aquí solo reflejamos.
  player.subscribe((e) => {
    if (e.type !== 'change') return;
    if (e.info !== undefined) info = e.info;
    if (typeof e.playing === 'boolean') playing = e.playing;
    render();
  });

  // Progreso en vivo
  player.audio.addEventListener('timeupdate', syncProgress);
  player.audio.addEventListener('durationchange', syncProgress);

  // Rutas inmersivas (login, ositos) ocultan la barra vía clase no-nav
  window.addEventListener('hashchange', render);

  render();
  return bar;
}
