/* ==========================================
   Personal Hub — Player Service (reproductor global)
   El Audio vive aquí, fuera de cualquier página:
   la música sigue sonando al navegar entre
   secciones (feeling de app de música real).

   - player.audio   → elemento <audio> global
   - player.info    → { title, artist, cover } del tema actual
   - player.setInfo / setPlaying / subscribe / emit
   - Media Session  → controles en la pantalla de bloqueo
     y en las notificaciones del móvil (PWA).

   La lógica de cola/shuffle/reanudación la mantiene
   la página de Canciones; aquí solo vive el estado
   compartido y el puente de eventos.
   ========================================== */

function createAudio() {
  const a = new Audio();
  a.preload = 'metadata';
  // El elemento no pertenece al DOM de ninguna página: así sobrevive a
  // los re-renders y a la navegación del router hash.
  return a;
}

class PlayerService {
  constructor() {
    this.audio = createAudio();
    this.info = null;       // { title, artist, cover } del tema actual
    this._playing = false;
    this.shuffle = false;          // reproducción aleatoria (compartida: barra + Canciones)
    this.repeat = 'all';           // 'off' | 'all' | 'one' — por defecto repite la lista
    this._subs = new Set();
    this._mediaSessionReady = false;
    this._wireMediaSession();

    // Sincroniza el estado de reproducción con el audio real: así la barra
    // global, la página de Canciones y Media Session siempre coinciden,
    // aunque el play/pause venga de un sitio u otro.
    this.audio.addEventListener('play', () => this.setPlaying(true));
    this.audio.addEventListener('pause', () => this.setPlaying(false));
    this.audio.addEventListener('ended', () => this.setPlaying(false));
  }

  /** Suscripción a eventos: 'change', 'next', 'prev', 'toggle'. */
  subscribe(fn) {
    this._subs.add(fn);
    return () => this._subs.delete(fn);
  }

  emit(type, payload = {}) {
    this._subs.forEach(fn => {
      try { fn({ type, ...payload }); } catch (err) { console.warn('[player] subscriber error:', err); }
    });
  }

  /** Actualiza la ficha del tema en reproducción (lo llama la página al cargar pista). */
  setInfo(info) {
    this.info = info || null;
    this._updateMediaSession();
    this.emit('change', { info: this.info });
  }

  setPlaying(playing) {
    this._playing = !!playing;
    this.emit('change', { playing: this._playing });
  }

  get isPlaying() {
    return this._playing;
  }

  // ==========================================
  // SHUFFLE / REPEAT — estado compartido entre la barra
  // global (reproductor expandido) y la página de Canciones.
  // Al cambiar se emite 'change' para que ambas se sincronicen.
  // ==========================================
  setShuffle(v) {
    this.shuffle = !!v;
    this.emit('change', { shuffle: this.shuffle });
  }

  toggleShuffle() {
    this.setShuffle(!this.shuffle);
  }

  setRepeat(mode) {
    this.repeat = ['off', 'all', 'one'].includes(mode) ? mode : 'off';
    this.emit('change', { repeat: this.repeat });
  }

  cycleRepeat() {
    const next = { off: 'all', all: 'one', one: 'off' }[this.repeat] || 'off';
    this.setRepeat(next);
  }

  /** Órdenes desde la barra global / Media Session → la página las ejecuta. */
  commandNext() { this.emit('next'); }
  commandPrev() { this.emit('prev'); }
  commandToggle() { this.emit('toggle'); }
  /** Abre la cola en la página de Canciones (la recoge al montarse). */
  commandQueue() { this.emit('queue'); }

  // ==========================================
  // MEDIA SESSION — pantalla de bloqueo / notificación
  // ==========================================
  _updateMediaSession() {
    if (!('mediaSession' in navigator)) return;
    const t = this.info;
    if (!t) {
      try { navigator.mediaSession.metadata = null; } catch { /* no-op */ }
      return;
    }
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: t.title || 'Personal Hub',
        artist: t.artist || 'Canciones para ti',
        album: 'Personal Hub',
        artwork: t.cover
          ? [{ src: t.cover, sizes: '512x512', type: 'image/jpeg' }]
          : []
      });
    } catch { /* no-op */ }
  }

  _wireMediaSession() {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.setActionHandler('play', () => {
        this.audio.play().catch(() => {});
        this.setPlaying(true);
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        this.audio.pause();
        this.setPlaying(false);
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => this.commandPrev());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.commandNext());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details && Number.isFinite(details.seekTime)) {
          this.audio.currentTime = details.seekTime;
        }
      });
      navigator.mediaSession.setActionHandler('seekbackward', () => {
        this.audio.currentTime = Math.max(0, this.audio.currentTime - 10);
      });
      navigator.mediaSession.setActionHandler('seekforward', () => {
        if (Number.isFinite(this.audio.duration)) {
          this.audio.currentTime = Math.min(this.audio.duration, this.audio.currentTime + 10);
        }
      });
    } catch { /* navegador sin soporte completo */ }
  }
}

export const player = new PlayerService();
