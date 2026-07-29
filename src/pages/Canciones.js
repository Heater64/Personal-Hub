/**
 * Canciones Page — Reproductor con letras y listas duales
 */
(function() {
  const SONGS_BASE = "https://canciones-que-me-recuerdan-a-ti.vercel.app";

  // Songs that remind me of you
  const SONGS_RECUERDAN = [
    { title: "Si No Estás", artist: "Iñigo Quintero", album: "2023", cover: `${SONGS_BASE}/Fotos/1200x1200bf-60.jpg`, audio: `${SONGS_BASE}/Canciones/Si%20No%20Est%C3%A1s%20%E2%80%93%20I%C3%B1igo%20Quintero.m4a`, lyrics: `Quiero ver tu otra mitad,<br>alejarme de esta ciudad,<br>y contagiarme de tu forma de pensar.<br><br>Miro al cielo al recordar,<br>me doy cuenta otra vez más<br>que no hay momento que pase sin dejarte de pensar.` },
    { title: "Rara Vez", artist: "Milo J, Taiu", album: "2023", cover: `${SONGS_BASE}/Fotos/OIP%20(4).webp`, audio: `${SONGS_BASE}/Canciones/Taiu,%20Milo%20j%20-%20Rara%20Vez%20(mp3cut.net).m4a`, lyrics: `Sos lo que me da paz<br>Lo que andaba buscando<br>Y esa felicidad<br>Que hace que ande sonriendo` },
    { title: "Mi niña", artist: "Wisin, Myke Towers", album: "2023", cover: `${SONGS_BASE}/Fotos/OIP%20(3).webp`, audio: `${SONGS_BASE}/Canciones/Wisin,_Myke_Towers,_Los_Legendarios_Mi_Ni%C3%B1a_Letra_Lyrics%20(mp3cut.net).m4a`, lyrics: `Yo quiero viajar el mundo contigo de compañía<br>Ninguna mujer me comprendía` },
    { title: "Pareja del año", artist: "Sebastián Yatra, Myke Towers", album: "2021", cover: `${SONGS_BASE}/Fotos/OIP%20(5).webp`, audio: `${SONGS_BASE}/Canciones/Sebasti%C3%A1n_Yatra,_Myke_Towers_Pareja_del_A%C3%B1o_Official_Performance%20(mp3cut.net).m4a`, lyrics: `Qué tan loco sería si yo fuera<br>El dueño de tu corazón por solo un día` },
    { title: "¿A dónde vamos?", artist: "Morat", album: "2022", cover: `${SONGS_BASE}/Fotos/OIP%20(6).webp`, audio: `${SONGS_BASE}/Canciones/Morat%20-%20A%20D%C3%B3nde%20Vamos%20(Letra)%20_%20Albert%20%26%20Maricheli%20(mp3cut.net).m4a`, lyrics: `Que siendo un extraño, te dije te amo<br>Te he estado buscando por más de mil años` },
    { title: "Cuando te vi", artist: "Trueno, Maria Becerra", album: "2022", cover: `${SONGS_BASE}/Fotos/923cf890949406f52539a8ed4d16a352.1000x1000x1.png`, audio: `${SONGS_BASE}/Canciones/Maria%20Becerra,%20Trueno,%20Big%20One%20-%20Cuando%20Te%20Vi%20_%20CROSSOVER%20%235%20(mp3cut.net).m4a`, lyrics: `Aunque todavía no soy rico<br>Te puedo dar amor como de chico` },
    { title: "Todo de Ti", artist: "Rauw Alejandro", album: "2021", cover: `${SONGS_BASE}/Fotos/OIP%20(7).webp`, audio: `${SONGS_BASE}/Canciones/Rauw%20Alejandro%20-%20Todo%20de%20Ti%20(Video%20Oficial).m4a`, lyrics: `El viento soba tu cabello<br>Me matan esos ojos bellos` },
    { title: "Tiroteo (Remix)", artist: "Marc Seguí, Rauw Alejandro, Pol Granch", album: "2024", cover: "https://i.ytimg.com/vi/7lZW4UgBuWQ/maxresdefault.jpg", audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1783251965/Marc_Segu%C3%AD_Tiroteo_Remix_ft_Rauw_Alejandro___Pol_Granch_etwg28.m4a", lyrics: `Letra no disponible` },
    { title: "Loco Enamorado", artist: "Abraham Mateo, Farruko", album: "2020", cover: `${SONGS_BASE}/Fotos/f53f05470b4146d4a202cf5df55b4ead.1000x1000x1.png`, audio: `${SONGS_BASE}/Canciones/Loco_Enamorado,_de_Abraham_Mateo_Ft_Farruko_%26_Christian_Daniel_Letra.m4a`, lyrics: `Te confieso, llevo un rato idealizándote<br>Toda una vida yo buscándote` },
    { title: "Bailando", artist: "Enrique Iglesias", album: "2014", cover: `${SONGS_BASE}/Fotos/R%20(1).png`, audio: `${SONGS_BASE}/Canciones/Enrique_Iglesias_%E2%80%93_Bailando_Lyrics_feat_Descemer_Bueno,_Gente_De.m4a`, lyrics: `Yo te miro y se me corta la respiración<br>Cuando tú me miras, se me sube el corazón` },
  ];

  let currentSongIdx = 0;
  let isPlaying = false;
  let audioPlayer = null;
  let shuffleMode = false;
  let shuffleHistory = [];
  let lyricsVisible = true;

  function getRandomIdx(len) {
    const avoid = Math.min(3, Math.floor(len / 2));
    const recent = shuffleHistory.slice(-avoid);
    const available = [];
    for (let i = 0; i < len; i++) if (!recent.includes(i)) available.push(i);
    const pick = available.length > 0 ? available[Math.floor(Math.random() * available.length)] : Math.floor(Math.random() * len);
    shuffleHistory.push(pick);
    if (shuffleHistory.length > 10) shuffleHistory.shift();
    return pick;
  }

  const page = {
    name: 'canciones',

    mount(container) {
      container.innerHTML = this.render();
      this.afterMount(container);
    },

    render() {
      return `
        <section class="page-section">
          <div class="player-layout">
            <!-- Player Panel -->
            <div class="player-panel">
              <div style="font-size:0.72rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--accent-coral);margin-bottom:4px;">Reproduciendo ahora</div>
              <div class="player-album">
                <img id="currentCover" src="${SONGS_RECUERDAN[0].cover}" alt="Portada">
              </div>
              <div class="player-title" id="currentTitle">${SONGS_RECUERDAN[0].title}</div>
              <div class="player-subtitle" id="currentSubtitle">${SONGS_RECUERDAN[0].artist}</div>

              <div class="player-controls">
                <button class="player-btn" id="shuffleBtn" title="Modo aleatorio"><i data-lucide="shuffle"></i></button>
                <button class="player-btn" id="prevBtn" title="Anterior"><i data-lucide="skip-back"></i></button>
                <button class="player-btn play" id="playBtn" title="Reproducir"><i data-lucide="play"></i></button>
                <button class="player-btn" id="nextBtn" title="Siguiente"><i data-lucide="skip-forward"></i></button>
                <button class="player-btn" id="randomBtn" title="Canción aleatoria"><i data-lucide="dices"></i></button>
              </div>

              <div class="progress-bar">
                <div class="progress-time">
                  <span id="currentTime">0:00</span>
                  <span id="totalTime">0:00</span>
                </div>
                <div class="progress-track" id="progressTrack">
                  <div class="progress-fill" id="progressFill"></div>
                </div>
              </div>
              <audio id="audioPlayer" preload="metadata"></audio>
            </div>

            <!-- Right column -->
            <div style="display:grid;gap:16px;">
              <!-- Lyrics -->
              <div class="section-card lyrics-card">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
                  <i data-lucide="file-text"></i>
                  <h3 style="margin:0;flex:1;">Letra</h3>
                  <button class="icon-btn" id="toggleLyricsBtn" title="Ocultar/Mostrar letra"><i data-lucide="eye"></i></button>
                  <button class="icon-btn" id="expandLyricsBtn" title="Ver letra completa"><i data-lucide="maximize-2"></i></button>
                </div>
                <div class="lyrics-panel" id="lyricsPanel">${SONGS_RECUERDAN[0].lyrics}</div>
              </div>

              <!-- Songs list -->
              <div class="section-card">
                <div class="sub-nav" style="margin-bottom:16px;">
                  <button class="sub-tab active" data-tab="recuerdan"><i data-lucide="heart"></i> Canciones que me recuerdan a ti</button>
                </div>
                <div id="songsListContainer">
                  <div class="songs-grid" id="songsList"></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div class="lightbox lyrics-lightbox" id="lyricsLightbox" style="display:none;">
          <button class="lightbox-close" onclick="document.getElementById('lyricsLightbox').style.display='none'">&times;</button>
          <div class="lightbox-content lyrics-lightbox-content">
            <div class="lyrics-expanded" id="expandedLyricsText"></div>
          </div>
        </div>
      `;
    },

    afterMount(container) {
      audioPlayer = document.getElementById('audioPlayer');
      if (!audioPlayer) return;

      let activeList = SONGS_RECUERDAN;
      currentSongIdx = 0;

      function loadSong(idx) {
        currentSongIdx = idx;
        const s = activeList[idx];
        if (!s) return;
        document.getElementById('currentCover').src = s.cover;
        document.getElementById('currentTitle').textContent = s.title;
        document.getElementById('currentSubtitle').textContent = s.artist;
        audioPlayer.src = s.audio;
        document.getElementById('lyricsPanel').innerHTML = s.lyrics || '<em>Letra no disponible</em>';
        renderList();
        if (isPlaying) audioPlayer.play().catch(() => {});
      }

      function renderList() {
        const list = document.getElementById('songsList');
        if (!list) return;
        list.innerHTML = activeList.map((s, i) => `
          <button class="song-row ${i === currentSongIdx ? 'active' : ''}" data-index="${i}">
            <img src="${s.cover}" alt="${s.title}" loading="lazy">
            <div class="song-info">
              <strong>${Utils.escapeHtml(s.title)}</strong>
              <span>${Utils.escapeHtml(s.artist)}</span>
            </div>
            <i data-lucide="${i === currentSongIdx && isPlaying ? 'volume-2' : 'play'}"></i>
          </button>
        `).join('');
      }

      function togglePlay() {
        if (!audioPlayer) return;
        if (isPlaying) {
          audioPlayer.pause();
          document.getElementById('playBtn').innerHTML = '<i data-lucide="play"></i>';
        } else {
          audioPlayer.play().catch(() => {});
          document.getElementById('playBtn').innerHTML = '<i data-lucide="pause"></i>';
        }
        isPlaying = !isPlaying;
        renderList();
      }

      function nextSong() {
        const len = activeList.length;
        if (shuffleMode && len > 1) {
          loadSong(getRandomIdx(len));
        } else {
          loadSong((currentSongIdx + 1) % len);
        }
        if (isPlaying) audioPlayer.play().catch(() => {});
      }

      function prevSong() {
        const len = activeList.length;
        if (shuffleMode && len > 1) {
          loadSong(getRandomIdx(len));
        } else {
          loadSong((currentSongIdx - 1 + len) % len);
        }
        if (isPlaying) audioPlayer.play().catch(() => {});
      }

      // Setup progress
      document.querySelector('.progress-track')?.addEventListener('click', (e) => {
        if (!audioPlayer.duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        audioPlayer.currentTime = pct * audioPlayer.duration;
      });

      audioPlayer.addEventListener('timeupdate', () => {
        if (audioPlayer.duration) {
          const pct = (audioPlayer.currentTime / audioPlayer.duration) * 100;
          document.getElementById('progressFill').style.width = pct + '%';
          document.getElementById('currentTime').textContent = Utils.formatTime(audioPlayer.currentTime);
          document.getElementById('totalTime').textContent = Utils.formatTime(audioPlayer.duration);
        }
      });
      audioPlayer.addEventListener('ended', nextSong);

      // Controls
      document.getElementById('playBtn').addEventListener('click', togglePlay);
      document.getElementById('prevBtn').addEventListener('click', prevSong);
      document.getElementById('nextBtn').addEventListener('click', nextSong);

      document.getElementById('shuffleBtn').addEventListener('click', () => {
        shuffleMode = !shuffleMode;
        const btn = document.getElementById('shuffleBtn');
        btn.style.color = shuffleMode ? 'var(--accent-coral)' : '';
        btn.style.borderColor = shuffleMode ? 'var(--accent-coral)' : '';
        Utils.showToast(shuffleMode ? 'Modo aleatorio activado' : 'Modo aleatorio desactivado');
      });

      document.getElementById('randomBtn').addEventListener('click', () => {
        if (!activeList.length) return;
        loadSong(getRandomIdx(activeList.length));
        audioPlayer.play().catch(() => {});
        isPlaying = true;
        document.getElementById('playBtn').innerHTML = '<i data-lucide="pause"></i>';
        renderList();
      });

      document.getElementById('toggleLyricsBtn').addEventListener('click', () => {
        const panel = document.getElementById('lyricsPanel');
        lyricsVisible = !lyricsVisible;
        panel.style.display = lyricsVisible ? 'block' : 'none';
      });

      document.getElementById('expandLyricsBtn').addEventListener('click', () => {
        const text = document.getElementById('lyricsPanel').innerHTML;
        document.getElementById('expandedLyricsText').innerHTML = text;
        document.getElementById('lyricsLightbox').style.display = 'flex';
      });

      // Song list click
      document.getElementById('songsList').addEventListener('click', (e) => {
        const row = e.target.closest('.song-row');
        if (!row) return;
        const idx = parseInt(row.dataset.index);
        loadSong(idx);
        audioPlayer.play().catch(() => {});
        isPlaying = true;
        document.getElementById('playBtn').innerHTML = '<i data-lucide="pause"></i>';
        renderList();
      });

      loadSong(0);
      renderList();
    }
  };

  if (window.AppRouter) {
    AppRouter.register('canciones', () => page);
  }
})();
