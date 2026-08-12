/* ==========================================
   Personal Hub — Now Playing Bar (reproductor global)
   Barra fija tipo Spotify / YouTube Music: aparece
   al reproducir cualquier canción y sigue sonando al
   navegar entre secciones (el <audio> vive en
   player.service, fuera de cualquier página).

   Al pulsar la barra se EXPANDE: se abre un reproductor
   a pantalla completa con la portada en grande y todos
   los controles (progreso, shuffle, repetir, cola...).

   Órdenes:
   - play/pause: actúan sobre player.audio directamente
     (funcionan con o sin la página de Canciones montada)
   - prev/next: player.commandPrev/Next → la página de
     Canciones los ejecuta si está montada (cola/shuffle)
   - shuffle/repeat: estado global en player.service,
     compartido con la página de Canciones
   ========================================== */

import { player } from '../services/player.service.js';
import { formatTime } from '../utils/format.js';
import { escapeHtml } from '../utils/escape.js';

const ICON_PLAY = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
const ICON_PAUSE = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
const ICON_PREV = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="19 20 9 12 19 4 19 20"/><rect x="5" y="4" width="2.6" height="16" rx="1.3"/></svg>';
const ICON_NEXT = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"/><rect x="16.4" y="4" width="2.6" height="16" rx="1.3"/></svg>';
const ICON_CLOSE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
const ICON_CHEVRON_DOWN = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
const ICON_SHUFFLE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>';
const ICON_REPEAT = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>';
const ICON_QUEUE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>';

export function NowPlayingBar(router) {
  const bar = document.createElement('div');
  bar.className = 'now-playing-bar';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Reproductor de música');

  let info = player.info;
  let playing = player.isPlaying;
  let expanded = false;

  // ── Overlay a pantalla completa (vive fuera de la barra, en <body>) ──
  const overlay = document.createElement('div');
  overlay.className = 'np-full';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Reproductor');
  overlay.hidden = true;
  document.body.appendChild(overlay);

  function syncProgress() {
    const a = player.audio;
    if (!info) return;
    const pct = (Number.isFinite(a.duration) && a.duration > 0)
      ? Math.min(100, (a.currentTime / a.duration) * 100)
      : 0;

    // Barra compacta
    if (bar.classList.contains('is-visible')) {
      const fill = bar.querySelector('.npb-progress-fill');
      if (fill) fill.style.width = pct + '%';
      const cur = bar.querySelector('.npb-time-cur');
      if (cur) cur.textContent = formatTime(a.currentTime);
      const dur = bar.querySelector('.npb-time-dur');
      if (dur && Number.isFinite(a.duration)) dur.textContent = formatTime(a.duration);
    }

    // Overlay expandido
    if (overlay.classList.contains('is-open')) {
      const fill = overlay.querySelector('#npfFill');
      if (fill) fill.style.width = pct + '%';
      const thumb = overlay.querySelector('#npfThumb');
      if (thumb) thumb.style.left = pct + '%';
      const cur = overlay.querySelector('#npfCur');
      if (cur) cur.textContent = formatTime(a.currentTime);
      const dur = overlay.querySelector('#npfDur');
      if (dur && Number.isFinite(a.duration)) dur.textContent = formatTime(a.duration);
      const slider = overlay.querySelector('#npfProgress');
      if (slider) slider.setAttribute('aria-valuenow', String(Math.round(pct)));
    }
  }

  function renderBar() {
    const app = document.getElementById('app');
    const noNav = !!app?.classList.contains('no-nav');
    const visible = !!info && !noNav;
    app?.classList.toggle('has-player', visible);

    if (!visible) {
      bar.classList.remove('is-visible');
      bar.innerHTML = '';
      setExpanded(false);
      return;
    }

    bar.classList.add('is-visible');
    const title = info.title || 'Personal Hub';
    const artist = info.artist || '';
    const hasCover = !!info.cover;

    bar.innerHTML = `
      <button type="button" class="npb-main" id="npbOpen" aria-label="Expandir reproductor" aria-expanded="${expanded}">
        <span class="npb-cover">
          ${hasCover ? `<img src="${escapeHtml(info.cover)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
          <span class="npb-cover-fb"${hasCover ? ' style="display:none"' : ''}><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></span>
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

    bar.querySelector('#npbOpen')?.addEventListener('click', () => setExpanded(!expanded));
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

  function renderOverlay() {
    if (!info) { setExpanded(false); return; }
    const title = info.title || 'Personal Hub';
    const artist = info.artist || '';
    const hasCover = !!info.cover;
    const repeatMode = player.repeat;
    const shuffleOn = player.shuffle;

    overlay.innerHTML = `
      <div class="npf-top">
        <button type="button" class="npf-collapse" id="npfCollapse" aria-label="Contraer reproductor" title="Contraer">${ICON_CHEVRON_DOWN}</button>
        <span class="npf-brand">Personal Hub</span>
        <span class="npf-top-spacer"></span>
      </div>

      <div class="npf-body">
        <div class="npf-art" id="npfArt">
          ${hasCover ? `<img src="${escapeHtml(info.cover)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
          <span class="npf-art-fb"${hasCover ? ' style="display:none"' : ''}><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></span>
        </div>

        <div class="npf-info">
          <strong class="npf-title">${escapeHtml(title)}</strong>
          <span class="npf-artist">${escapeHtml(artist)}</span>
        </div>

        <div class="npf-progress" id="npfProgress" role="slider" aria-label="Progreso de reproducción" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="0">
          <span class="npf-progress-fill" id="npfFill"></span>
          <span class="npf-progress-thumb" id="npfThumb"></span>
        </div>
        <div class="npf-times">
          <span id="npfCur">0:00</span>
          <span id="npfDur">0:00</span>
        </div>

        <div class="npf-controls">
          <button class="npf-btn ${shuffleOn ? 'is-active' : ''}" id="npfShuffle" type="button" title="${shuffleOn ? 'Desactivar reproducción aleatoria' : 'Reproducción aleatoria'}" aria-label="Reproducción aleatoria" aria-pressed="${shuffleOn}">${ICON_SHUFFLE}</button>
          <button class="npf-btn" id="npfPrev" type="button" title="Anterior" aria-label="Anterior">${ICON_PREV}</button>
          <button class="npf-btn npf-play" id="npfPlay" type="button" aria-label="${playing ? 'Pausar' : 'Reproducir'}" title="${playing ? 'Pausar' : 'Reproducir'}">${playing ? ICON_PAUSE : ICON_PLAY}</button>
          <button class="npf-btn" id="npfNext" type="button" title="Siguiente" aria-label="Siguiente">${ICON_NEXT}</button>
          <button class="npf-btn ${repeatMode !== 'off' ? 'is-active' : ''}" id="npfRepeat" type="button" title="${repeatMode === 'one' ? 'Repetir canción' : repeatMode === 'all' ? 'Repetir lista' : 'Repetir'}" aria-label="Repetir" aria-pressed="${repeatMode !== 'off'}">${ICON_REPEAT}${repeatMode === 'one' ? '<span class="npf-repeat-one">1</span>' : ''}</button>
        </div>

        <button class="npf-queue" id="npfQueue" type="button">${ICON_QUEUE} <span>Cola de reproducción</span></button>
      </div>
    `;

    overlay.querySelector('#npfCollapse')?.addEventListener('click', () => setExpanded(false));
    overlay.querySelector('#npfPlay')?.addEventListener('click', togglePlay);
    overlay.querySelector('#npfPrev')?.addEventListener('click', () => player.commandPrev());
    overlay.querySelector('#npfNext')?.addEventListener('click', () => player.commandNext());
    overlay.querySelector('#npfShuffle')?.addEventListener('click', () => player.toggleShuffle());
    overlay.querySelector('#npfRepeat')?.addEventListener('click', () => player.cycleRepeat());
    overlay.querySelector('#npfQueue')?.addEventListener('click', () => {
      sessionStorage.setItem('ph.openQueue', '1');
      window.dispatchEvent(new CustomEvent('ph:open-queue'));
      setExpanded(false);
      router.navigate('/canciones');
    });

    const npfProg = overlay.querySelector('#npfProgress');
    if (npfProg) {
      const seek = (e) => {
        const a = player.audio;
        if (!Number.isFinite(a.duration) || a.duration <= 0) return;
        const rect = npfProg.getBoundingClientRect();
        const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
        a.currentTime = ratio * a.duration;
      };
      npfProg.addEventListener('click', seek);
      npfProg.addEventListener('keydown', (e) => {
        const a = player.audio;
        if (e.key === 'ArrowRight') { a.currentTime = Math.min(a.duration, a.currentTime + 10); e.preventDefault(); }
        else if (e.key === 'ArrowLeft') { a.currentTime = Math.max(0, a.currentTime - 10); e.preventDefault(); }
      });
    }

    syncProgress();
  }

  function setExpanded(open) {
    expanded = !!open && !!info;
    overlay.classList.toggle('is-open', expanded);
    overlay.hidden = !expanded;
    if (expanded) {
      renderOverlay();
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    const openBtn = bar.querySelector('#npbOpen');
    if (openBtn) openBtn.setAttribute('aria-expanded', String(expanded));
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
    renderBar();
    if (expanded) renderOverlay();
  });

  // Progreso en vivo (barra compacta + overlay expandido)
  player.audio.addEventListener('timeupdate', syncProgress);
  player.audio.addEventListener('durationchange', syncProgress);

  // Escape cierra el reproductor expandido
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && expanded) setExpanded(false);
  });

  // Rutas inmersivas (login, ositos) ocultan la barra vía clase no-nav
  window.addEventListener('hashchange', renderBar);

  renderBar();
  return bar;
}
