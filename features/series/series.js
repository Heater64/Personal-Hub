// series.js - Biblioteca con progreso visual

'use strict';

let catalog = [];
let currentFilter = 'todo';
let searchTerm = '';
let hlsInstance = null;
let currentViewItem = null;

// ========== PODIO ==========
let podioData = { series: [], movies: [] };
let currentPodiumType = 'series';
let editingPodiumType = 'series';

const dom = {
  grid: document.getElementById('contentGrid'),
  empty: document.getElementById('emptyState'),
  searchInput: document.getElementById('searchInput'),
  filterBtns: document.getElementById('filterBtns'),
  overlayForm: document.getElementById('overlayForm'),
  overlayView: document.getElementById('overlayView'),
  modalFormTitle: document.getElementById('modalFormTitle'),
  formDocId: document.getElementById('formDocId'),
  fTitulo: document.getElementById('fTitulo'),
  fTipo: document.getElementById('fTipo'),
  fPortada: document.getElementById('fPortada'),
  fWeb: document.getElementById('fWeb'),
  fTotalEpisodios: document.getElementById('fTotalEpisodios'),
  btnAnadir: document.getElementById('btnAnadir'),
  btnEliminarTodo: document.getElementById('btnEliminarTodo'),
  closeFormBtn: document.getElementById('closeFormBtn'),
  cancelFormBtn: document.getElementById('cancelFormBtn'),
  closeViewBtn: document.getElementById('closeViewBtn'),
  viewTitle: document.getElementById('viewTitle'),
  viewCover: document.getElementById('viewCover'),
  viewTipo: document.getElementById('viewTipo'),
  viewEpisodiosList: document.getElementById('viewEpisodiosList'),
  playerWrapper: document.getElementById('playerWrapper'),
  videoPlayer: document.getElementById('videoPlayer'),
  toast: document.getElementById('toast'),
  bulkActions: document.getElementById('bulkActions'),
  markAllWatchedBtn: document.getElementById('markAllWatchedBtn'),
  unmarkAllBtn: document.getElementById('unmarkAllBtn'),
  deleteConfirmModal: document.getElementById('deleteConfirmModal'),
  closeConfirmBtn: document.getElementById('closeConfirmBtn'),
  cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
  confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
  epProgressModal: document.getElementById('episodeProgressModal'),
  epProgressTitle: document.getElementById('epProgressTitle'),
  epProgressList: document.getElementById('epProgressList'),
  epProgressSummary: document.getElementById('epProgressSummary'),
  closeEpProgressBtn: document.getElementById('closeEpProgressBtn'),
  closeEpProgressModalBtn: document.getElementById('closeEpProgressModalBtn'),
  epMarkAllBtn: document.getElementById('epMarkAllBtn'),
  epUnmarkAllBtn: document.getElementById('epUnmarkAllBtn')
};

const COL = 'seriesData';
const PROGRESS_COL = 'seriesProgress'; // subcolección en users/{uid}/progress/seriesProgress

let userProgressCache = {};

async function getDB() {
  if (typeof FirestoreService !== 'undefined') return FirestoreService.getDB();
  if (window.db) return window.db;
  if (typeof window.waitForFirebase === 'function') {
    await window.waitForFirebase();
    if (window.db) return window.db;
  }
  throw new Error('Firestore no inicializado');
}

function getUserUid() {
  var user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  return user ? user.uid : null;
}

// ========== PROGRESO POR USUARIO ==========
async function loadUserProgress() {
  var uid = getUserUid();
  if (!uid) return {};
  if (typeof ProgressService !== 'undefined') {
    try {
      userProgressCache = await ProgressService.loadSeriesProgress();
      return userProgressCache;
    } catch (e) {
      console.warn('Error cargando progreso via ProgressService:', e);
    }
  }
  userProgressCache = {};
  return {};
}

async function saveUserProgress(seriesId, episodeNum) {
  var uid = getUserUid();
  if (!uid) return false;
  try {
    userProgressCache[seriesId] = episodeNum;
    if (typeof ProgressService !== 'undefined') {
      return await ProgressService.saveSeriesProgress(userProgressCache);
    }
    return false;
  } catch (e) {
    console.error('Error guardando progreso de usuario:', e);
    return false;
  }
}

function showToast(msg, isError = false) {
  if (typeof window.showToast === 'function') {
    window.showToast(msg, isError);
    return;
  }
  if (!dom.toast) return;
  dom.toast.textContent = msg;
  dom.toast.style.display = 'block';
  dom.toast.style.borderLeftColor = isError ? '#dc3545' : 'var(--accent-coral)';
  setTimeout(() => { if (dom.toast) dom.toast.style.display = 'none'; }, 3000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}

function getTotal(item) {
  if (item.totalEpisodios) return item.totalEpisodios;
  if (item.episodios && item.episodios.length > 0) return item.episodios.length;
  return 0;
}

// ========== PROGRESO ==========
async function saveProgress(seriesId, episodeNum) {
  var ok = await saveUserProgress(seriesId, episodeNum);
  if (ok) {
    const item = catalog.find(i => i.id === seriesId);
    if (item) item.progreso = episodeNum;
  }
  return ok;
}

// ========== MARCAR EPISODIO ==========
async function changeEpisode(seriesId, episodeNum) {
  const clamped = Math.max(0, episodeNum);
  await saveProgress(seriesId, clamped);
  await renderGrid();
  const progressModal = document.getElementById('episodeProgressModal');
  if (progressModal && progressModal.style.display === 'flex') {
    const item = catalog.find(i => i.id === seriesId);
    if (item) renderEpisodeProgressModal(item);
  }
}

// ========== RENDER GRILLA ==========
function cardHTML(item) {
  const total = getTotal(item);
  const prog = item.progreso || 0;
  const percent = total > 0 ? (prog / total) * 100 : 0;
  const isCompleted = total > 0 && prog >= total;
  const isStarted = prog > 0;
  const hasCover = !!item.portada;
  const firstLetter = item.titulo ? escapeHtml(item.titulo[0]) : '?';

  return `
    <div class="movie-card" data-id="${escapeHtml(item.id)}" data-tipo="${item.tipo}" data-prog="${prog}" data-total="${total}">
      <div class="card-cover">
        ${hasCover
          ? `<img src="${escapeHtml(item.portada)}" alt="${escapeHtml(item.titulo)}" class="card-img"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
          : ''
        }
        <div class="card-cover-fallback" style="${hasCover ? 'display:none' : ''}">${firstLetter}</div>
        ${isCompleted ? '<div class="card-badge completed">✓</div>' : ''}
        ${isStarted && !isCompleted ? '<div class="card-badge watching">▶</div>' : ''}
      </div>

      <div class="movie-info">
        <div class="card-title">${escapeHtml(item.titulo || 'Sin título')}</div>

        ${item.tipo === 'serie' && total > 0 ? `
          <div class="card-progress">
            <div class="card-progress-fill" style="width:${percent}%"></div>
          </div>
        ` : ''}

        <div class="card-hover">
          <button class="ch-btn ch-play" data-action="ver" data-id="${escapeHtml(item.id)}" title="${total > 0 ? 'Ver episodios' : 'Abrir'}">
            <i data-lucide="play"></i>
          </button>
          <button class="ch-btn ch-mark" data-action="marcar" data-id="${escapeHtml(item.id)}" title="${isCompleted ? 'Desmarcar' : 'Marcar visto'}">
            <i data-lucide="${isCompleted ? 'refresh-cw' : 'check'}"></i>
          </button>
          <div class="ch-more-wrap">
            <button class="ch-btn ch-more" data-action="more" data-id="${escapeHtml(item.id)}" title="Más opciones">
              <i data-lucide="chevron-down"></i>
            </button>
            <div class="ch-dropdown" id="dd-${escapeHtml(item.id)}">
              <button data-action="editar" data-id="${escapeHtml(item.id)}"><i data-lucide="edit-2"></i> Editar</button>
              <button data-action="progreso" data-id="${escapeHtml(item.id)}"><i data-lucide="list"></i> Progreso</button>
              <button data-action="eliminar" data-id="${escapeHtml(item.id)}" class="dd-danger"><i data-lucide="trash-2"></i> Eliminar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderAddCard() {
  return `
    <div class="movie-card card-add" id="addCard" data-action="add">
      <div class="card-cover card-add-cover">
        <div class="card-add-icon">+</div>
        <div class="card-add-label">Añadir contenido</div>
      </div>
    </div>
  `;
}

function renderAddSection() {
  return `
    <div class="catalog-section catalog-section-add">
      <div class="catalog-grid">${renderAddCard()}</div>
    </div>
  `;
}

function renderSection(title, items) {
  if (items.length === 0) return '';
  return `
    <div class="catalog-section">
      <h3 class="catalog-section-title">${title} <span class="catalog-section-count">${items.length}</span></h3>
      <div class="catalog-grid">${items.map(cardHTML).join('')}</div>
    </div>
  `;
}

async function renderGrid() {
  let filtered = [...catalog];
  if (searchTerm) filtered = filtered.filter(i => (i.titulo || '').toLowerCase().includes(searchTerm));
  if (currentFilter === 'serie') filtered = filtered.filter(i => i.tipo === 'serie');
  else if (currentFilter === 'pelicula') filtered = filtered.filter(i => i.tipo === 'pelicula');

  if (filtered.length === 0) {
    dom.grid.innerHTML = '';
    dom.empty.style.display = 'flex';
    return;
  }
  dom.empty.style.display = 'none';

  let html = '';
  if (currentFilter === 'todo' && !searchTerm) {
    const completed = filtered.filter(i => {
      const total = getTotal(i);
      return (total > 0 && i.progreso >= total) || (total === 0 && i.progreso > 0);
    });
    const watching = filtered.filter(i => {
      const total = getTotal(i);
      return total > 0 && i.progreso > 0 && i.progreso < total;
    });
    const notStarted = filtered.filter(i => !i.progreso || i.progreso === 0);
    html += renderSection('Viendo', watching);
    html += renderSection('Ver más tarde', notStarted);
    html += renderSection('Visto', completed);
    html += renderAddSection();
  } else {
    const label = searchTerm ? `Resultados: "${searchTerm}"` : currentFilter === 'serie' ? 'Series' : 'Películas';
    html += renderSection(label, filtered);
    html += renderAddSection();
  }
  dom.grid.innerHTML = html;

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ========== MODAL PROGRESO EPISODIOS ==========
function renderEpisodeProgressModal(item) {
  const total = getTotal(item);
  const prog = item.progreso || 0;
  const percent = total > 0 ? Math.round((prog / total) * 100) : 0;
  const isCompleted = total > 0 && prog >= total;

  dom.epProgressTitle.textContent = `${item.emoji || '📺'} ${item.titulo}`;

  dom.epProgressList.innerHTML = '';
  for (let i = 1; i <= total; i++) {
    const watched = prog >= i;
    const isNext = prog + 1 === i;
    const div = document.createElement('div');
    div.className = `ep-progress-item ${watched ? 'watched' : ''} ${isNext && !isCompleted ? 'next' : ''}`;
    div.innerHTML = `
      <input type="checkbox" class="ep-progress-check" data-ep="${i}" ${watched ? 'checked' : ''}>
      <span class="ep-progress-num">${String(i).padStart(2, '0')}</span>
      <span class="ep-progress-label">Episodio ${i}</span>
      ${isNext && !isCompleted ? '<span class="ep-next-tag">Siguiente</span>' : ''}
    `;
    dom.epProgressList.appendChild(div);
  }

  dom.epProgressSummary.innerHTML = `
    <span>${prog}/${total}</span>
    <span class="ep-progress-pct">${percent}%</span>
  `;

  dom.epMarkAllBtn.onclick = async () => { await changeEpisode(item.id, total); };
  dom.epUnmarkAllBtn.onclick = async () => { await changeEpisode(item.id, 0); };

  dom.epProgressList.querySelectorAll('.ep-progress-check').forEach(ch => {
    ch.addEventListener('change', async (e) => {
      e.stopPropagation();
      const ep = parseInt(ch.dataset.ep);
      let newProg = prog;
      if (ch.checked) {
        newProg = Math.max(prog, ep);
      } else {
        const checks = dom.epProgressList.querySelectorAll('.ep-progress-check:checked');
        let highest = 0;
        checks.forEach(c => { const v = parseInt(c.dataset.ep); if (v > highest) highest = v; });
        newProg = highest;
      }
      await changeEpisode(item.id, newProg);
    });
  });

  dom.epProgressModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: dom.epProgressModal });
}

function openEpisodeProgressModal(item) {
  if (!item) return;
  const total = getTotal(item);
  if (total === 0) {
    dom.epProgressTitle.textContent = `${item.titulo}`;
    dom.epProgressList.innerHTML = `
      <div style="text-align:center;padding:40px;color:var(--umbra-ash);">
        <p>Esta serie no tiene episodios registrados.</p>
        <p style="font-size:0.75rem;margin-top:8px;">
          <button class="btn-secondary btn-sm" onclick="openEditModal('${item.id}')">Editar serie</button>
          para establecer el total de episodios.
        </p>
      </div>
    `;
    dom.epMarkAllBtn.style.display = 'none';
    dom.epUnmarkAllBtn.style.display = 'none';
    dom.epProgressSummary.textContent = '—';
    dom.epProgressModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    return;
  }
  dom.epMarkAllBtn.style.display = '';
  dom.epUnmarkAllBtn.style.display = '';
  renderEpisodeProgressModal(item);
}

function closeEpisodeProgressModal() {
  dom.epProgressModal.style.display = 'none';
  document.body.style.overflow = '';
}

// ========== VISTA MODAL (legacy con reproductor) ==========
async function openViewModal(item) {
  stopPlayer();
  currentViewItem = item;
  const episodios = item.episodios || [];
  const totalEpisodios = episodios.length;
  const currentViewProgress = item.progreso || 0;
  const isCompleted = totalEpisodios > 0 && currentViewProgress >= totalEpisodios;

  dom.viewTitle.textContent = item.titulo || '—';
  dom.viewTipo.className = `badge ${item.tipo === 'serie' ? 'serie' : 'pelicula'}`;
  dom.viewTipo.textContent = item.tipo === 'serie' ? 'Serie' : 'Película';

  if (item.portada) { dom.viewCover.src = item.portada; dom.viewCover.style.display = 'block'; }
  else { dom.viewCover.style.display = 'none'; }

  dom.playerWrapper.style.display = 'none';

  if (item.tipo === 'serie' && totalEpisodios > 0) {
    dom.bulkActions.style.display = 'flex';
    dom.markAllWatchedBtn.onclick = async () => { await changeEpisode(item.id, totalEpisodios); openViewModal(item); };
    dom.unmarkAllBtn.onclick = async () => { await changeEpisode(item.id, 0); openViewModal(item); };
  } else {
    dom.bulkActions.style.display = 'none';
  }

  let progressBarHtml = '';
  if (item.tipo === 'serie' && totalEpisodios > 0) {
    const percent = (currentViewProgress / totalEpisodios) * 100;
    progressBarHtml = `
      <div class="progress-track-serie">
        <div class="progress-header" style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span style="font-size:0.7rem;color:var(--umbra-ash);">Progreso</span>
          <span style="font-size:0.7rem;color:var(--accent-coral);">${currentViewProgress} / ${totalEpisodios}</span>
        </div>
        <div style="height:4px;background:rgba(255,255,255,0.1);border-radius:10px;overflow:hidden;">
          <div style="width:${percent}%;height:100%;background:var(--accent-coral);border-radius:10px;transition:width 0.3s;"></div>
        </div>
        ${isCompleted ? '<p style="font-size:0.7rem;color:#4caf50;margin-top:8px;">✨ Completada ✨</p>' : ''}
      </div>`;
  }

  const episodiosHtml = episodios.map((ep, idx) => {
    const epNum = ep.numero;
    const isWatched = currentViewProgress >= epNum;
    const isNext = currentViewProgress + 1 === epNum;
    const tieneMedia = ep.mp4 || ep.m3u8;
    const tieneExterno = ep.externo;
    let buttonHtml = '';
    if (tieneMedia) buttonHtml = `<button class="btn-primary btn-sm play-ep" data-num="${ep.numero}"><i data-lucide="play"></i> Reproducir</button>`;
    else if (tieneExterno) buttonHtml = `<button class="btn-secondary btn-sm open-ext" data-url="${escapeHtml(ep.externo)}">🌐 Abrir web</button>`;
    else buttonHtml = `<span class="no-link">Sin enlace</span>`;

    return `
      <div class="episode-row ${isNext && !isCompleted ? 'next-episode' : ''}" data-ep-num="${ep.numero}">
        <div class="episode-row-info">
          <span class="episode-row-num ${isWatched ? 'watched-num' : ''}">${String(ep.numero).padStart(2, '0')}</span>
          <span class="episode-row-title ${isWatched ? 'watched-title' : ''}">${escapeHtml(ep.titulo || `Episodio ${ep.numero}`)}</span>
          ${isNext && !isCompleted ? '<span class="next-badge">▶ Siguiente</span>' : ''}
          ${isCompleted && epNum === totalEpisodios ? '<span class="completed-badge">🏆 Completado</span>' : ''}
        </div>
        <div class="episode-row-actions">${buttonHtml}</div>
      </div>`;
  }).join('');

  dom.viewEpisodiosList.innerHTML = progressBarHtml + episodiosHtml;

  dom.viewEpisodiosList.querySelectorAll('.play-ep').forEach(btn => {
    btn.addEventListener('click', () => {
      const num = parseInt(btn.dataset.num);
      const ep = episodios.find(e => e.numero === num);
      if (ep) playEpisode(ep);
    });
  });

  dom.viewEpisodiosList.querySelectorAll('.open-ext').forEach(btn => {
    btn.addEventListener('click', () => window.open(btn.dataset.url, '_blank'));
  });

  dom.overlayView.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function playEpisode(ep) {
  const video = dom.videoPlayer;
  stopPlayer();
  dom.playerWrapper.style.display = 'block';
  if (ep.m3u8 && Hls.isSupported()) {
    if (hlsInstance) hlsInstance.destroy();
    hlsInstance = new Hls();
    hlsInstance.loadSource(ep.m3u8);
    hlsInstance.attachMedia(video);
    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => video.play());
  } else if (ep.mp4) {
    video.src = ep.mp4;
    video.play();
  }
  dom.playerWrapper.scrollIntoView({ behavior: 'smooth' });
}

function stopPlayer() {
  if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
  dom.videoPlayer.pause();
  dom.videoPlayer.src = '';
  dom.playerWrapper.style.display = 'none';
}

// ========== CRUD ==========
async function loadData() {
  try {
    var snap = await (await getDB()).collection(COL).get();
    var rawCatalog = snap.docs.map(function (doc) {
      var data = doc.data();
      return { id: doc.id, ...data, progreso: data.progreso || 0 };
    });

    // Cargar progreso del usuario y fusionarlo
    var userProg = await loadUserProgress();
    catalog = rawCatalog.map(function (item) {
      if (userProg[item.id] !== undefined) {
        item.progreso = userProg[item.id];
      }
      return item;
    });

    await loadPodio();
    await renderGrid();
  } catch (e) {
    console.error('Error:', e);
    showToast('Error al cargar datos', true);
  }
}

async function deleteContent(id) {
  try {
    await (await getDB()).collection(COL).doc(id).delete();
    await loadData();
    showToast('Contenido eliminado');
  } catch (e) {
    console.error(e);
    showToast('Error al eliminar', true);
  }
}

async function deleteAllContent() {
  try {
    const snap = await (await getDB()).collection(COL).get();
    const batch = (await getDB()).batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    await loadData();
    showToast('Todos los contenidos eliminados');
  } catch (e) {
    console.error(e);
    showToast('Error al eliminar todo', true);
  }
}

// ========== FORMULARIO ==========
function openEditModal(id) {
  const item = catalog.find(i => i.id === id);
  if (!item) return;
  dom.modalFormTitle.textContent = 'Editar contenido';
  dom.formDocId.value = id;
  dom.fTitulo.value = item.titulo || '';
  dom.fTipo.value = item.tipo || 'serie';
  dom.fPortada.value = item.portada || '';
  dom.fWeb.value = item.web || '';
  dom.fTotalEpisodios.value = getTotal(item) || '';
  dom.overlayForm.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function openAddModal() {
  dom.modalFormTitle.textContent = 'Añadir contenido';
  dom.formDocId.value = '';
  dom.fTitulo.value = '';
  dom.fTipo.value = 'serie';
  dom.fPortada.value = '';
  dom.fWeb.value = '';
  dom.fTotalEpisodios.value = '';
  dom.overlayForm.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

async function saveContent() {
  const titulo = dom.fTitulo.value.trim();
  const tipo = dom.fTipo.value;
  if (!titulo) { showToast('El título es obligatorio', true); return; }

  const totalEp = parseInt(dom.fTotalEpisodios.value, 10) || 0;
  const payload = {
    titulo,
    tipo,
    portada: dom.fPortada.value.trim(),
    web: dom.fWeb.value.trim(),
    totalEpisodios: tipo === 'serie' ? totalEp : 0,
    updatedAt: new Date().toISOString()
  };

  try {
    if (dom.formDocId.value) {
      await (await getDB()).collection(COL).doc(dom.formDocId.value).update(payload);
      showToast('Actualizado correctamente');
    } else {
      payload.createdAt = new Date().toISOString();
      const docRef = await (await getDB()).collection(COL).add(payload);
      await (await getDB()).collection(COL).doc(docRef.id).update({ id: docRef.id });
      showToast('Añadido correctamente');
    }
    await loadData();
    closeFormModal();
  } catch (e) {
    console.error(e);
    showToast('Error al guardar', true);
  }
}

function closeFormModal() {
  dom.overlayForm.style.display = 'none';
  document.body.style.overflow = '';
}

function closeViewModal() {
  stopPlayer();
  dom.overlayView.style.display = 'none';
  document.body.style.overflow = '';
  currentViewItem = null;
}

// ========== PODIO ==========
async function loadPodio() {
  try {
    const doc = await (await getDB()).collection('config').doc('podio').get();
    if (doc.exists) {
      const data = doc.data();
      podioData.series = data.series || [];
      podioData.movies = data.movies || [];
    } else { podioData = { series: [], movies: [] }; }
  } catch (e) {
    console.error('Error cargando podio:', e);
    podioData = { series: [], movies: [] };
  }
}

async function savePodio() {
  try {
    await (await getDB()).collection('config').doc('podio').set({
      series: podioData.series, movies: podioData.movies,
      updatedAt: new Date().toISOString()
    });
  } catch (e) { console.error('Error guardando podio:', e); showToast('Error al guardar podio', true); }
}

function renderPodium() {
  const grid = document.getElementById('podiumGrid');
  const empty = document.getElementById('podiumEmpty');
  const section = document.getElementById('podiumSection');
  if (!grid || !empty || !section) return;
  const items = podioData[currentPodiumType] || [];
  const sorted = [...items].sort((a, b) => a.position - b.position);
  const tipoLabel = currentPodiumType === 'series' ? 'Serie' : 'Película';
  if (sorted.length === 0) { grid.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  grid.innerHTML = sorted.map((item, idx) => {
    const rank = item.position;
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
    const coverBg = item.portada ? `background-image: url('${escapeHtml(item.portada)}')` : '';
    return `<div class="podium-card">
      <div class="podium-rank podium-rank-${rank}">${medal}</div>
      <div class="podium-card-cover" style="${coverBg}"></div>
      <div class="podium-card-info">
        <div class="podium-card-title">${escapeHtml(item.titulo)}</div>
        <div class="podium-card-sub">${tipoLabel} · Puesto #${rank}</div>
      </div>
    </div>`;
  }).join('');
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: grid });
}

function openPodiumModal(type) {
  editingPodiumType = type || currentPodiumType;
  const modal = document.getElementById('podiumModal');
  const list = document.getElementById('podiumEditList');
  if (!modal || !list) return;
  renderPodiumEditList();
  document.querySelectorAll('.podium-modal-tabs .podium-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.pmType === editingPodiumType || (!t.dataset.pmType && editingPodiumType === 'series'));
  });
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closePodiumModal() {
  const modal = document.getElementById('podiumModal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
}

function renderPodiumEditList() {
  const list = document.getElementById('podiumEditList');
  if (!list) return;
  const tipo = editingPodiumType === 'series' ? 'serie' : 'pelicula';
  const filtered = catalog.filter(item => item.tipo === tipo);
  const podioItems = podioData[editingPodiumType] || [];
  if (filtered.length === 0) {
    list.innerHTML = `<div style="text-align:center;padding:40px;color:var(--umbra-ash);"><p>No hay ${editingPodiumType} en tu catálogo.</p></div>`;
    return;
  }
  list.innerHTML = filtered.map(item => {
    const current = podioItems.find(p => p.itemId === item.id);
    const coverBg = item.portada ? `background-image: url('${escapeHtml(item.portada)}')` : '';
    return `<div class="podium-edit-item">
      <div class="podium-edit-cover" style="${coverBg}"></div>
      <span class="podium-edit-title">${escapeHtml(item.titulo)}</span>
      <select class="podium-edit-select" data-item-id="${item.id}" data-titulo="${escapeHtml(item.titulo)}" data-portada="${escapeHtml(item.portada || '')}">
        <option value="">—</option>
        <option value="1" ${current?.position === 1 ? 'selected' : ''}>#1</option>
        <option value="2" ${current?.position === 2 ? 'selected' : ''}>#2</option>
        <option value="3" ${current?.position === 3 ? 'selected' : ''}>#3</option>
        <option value="4" ${current?.position === 4 ? 'selected' : ''}>#4</option>
        <option value="5" ${current?.position === 5 ? 'selected' : ''}>#5</option>
      </select>
    </div>`;
  }).join('');
}

function collectPodiumData(type) {
  const selects = document.querySelectorAll('#podiumEditList .podium-edit-select');
  const items = [];
  selects.forEach(sel => {
    if (sel.value) items.push({ itemId: sel.dataset.itemId, position: parseInt(sel.value), titulo: sel.dataset.titulo, portada: sel.dataset.portada });
  });
  const positions = items.map(i => i.position);
  if (new Set(positions).size !== positions.length) { showToast('No puedes repetir posiciones.', true); return null; }
  return items;
}

async function savePodium() {
  const items = collectPodiumData(editingPodiumType);
  if (items === null) return;
  podioData[editingPodiumType] = items;
  await savePodio();
  renderPodium();
  closePodiumModal();
  showToast('✅ Podio guardado');
}

function switchView(view) {
  const catalogElements = [document.querySelector('.filters-bar'), document.getElementById('contentGrid'), document.getElementById('emptyState')];
  const podiumSection = document.getElementById('podiumSection');
  document.querySelectorAll('.cine-view-tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));
  if (view === 'podium') {
    catalogElements.forEach(el => { if (el) el.style.display = 'none'; });
    if (podiumSection) podiumSection.style.display = 'block';
    renderPodium();
  } else {
    catalogElements.forEach(el => { if (el) el.style.display = ''; });
    if (podiumSection) podiumSection.style.display = 'none';
    renderGrid();
  }
}

// ========== INICIALIZACIÓN ==========
function init() {
  loadData();

  dom.btnAnadir?.addEventListener('click', openAddModal);
  dom.closeFormBtn?.addEventListener('click', closeFormModal);
  dom.cancelFormBtn?.addEventListener('click', closeFormModal);
  dom.closeViewBtn?.addEventListener('click', closeViewModal);
  dom.closeEpProgressBtn?.addEventListener('click', closeEpisodeProgressModal);
  dom.closeEpProgressModalBtn?.addEventListener('click', closeEpisodeProgressModal);

  dom.btnEliminarTodo?.addEventListener('click', () => {
    dom.deleteConfirmModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  });
  dom.closeConfirmBtn?.addEventListener('click', () => {
    dom.deleteConfirmModal.style.display = 'none';
    document.body.style.overflow = '';
  });
  dom.cancelDeleteBtn?.addEventListener('click', () => {
    dom.deleteConfirmModal.style.display = 'none';
    document.body.style.overflow = '';
  });
  dom.confirmDeleteBtn?.addEventListener('click', async () => {
    dom.deleteConfirmModal.style.display = 'none';
    document.body.style.overflow = '';
    await deleteAllContent();
  });

  document.getElementById('contentForm')?.addEventListener('submit', (e) => { e.preventDefault(); saveContent(); });

  dom.searchInput?.addEventListener('input', (e) => { searchTerm = e.target.value.toLowerCase(); renderGrid(); });

  dom.filterBtns?.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      dom.filterBtns.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderGrid();
    });
  });

  dom.overlayForm?.addEventListener('click', (e) => { if (e.target === dom.overlayForm) closeFormModal(); });
  dom.overlayView?.addEventListener('click', (e) => { if (e.target === dom.overlayView) closeViewModal(); });
  dom.epProgressModal?.addEventListener('click', (e) => { if (e.target === dom.epProgressModal) closeEpisodeProgressModal(); });

  // Cerrar dropdowns al hacer clic fuera
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.ch-more-wrap')) {
      document.querySelectorAll('.ch-dropdown.open').forEach(d => d.classList.remove('open'));
    }
  });

  // Evento único en la grilla
  dom.grid?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) {
      const card = e.target.closest('.movie-card');
      if (!card) return;
      const id = card.dataset.id;
      if (card.dataset.action === 'add') { openAddModal(); return; }
      if (!id) return;
      const item = catalog.find(i => i.id === id);
      if (!item || !item.web) return;
      window.open(item.web, '_blank');
      return;
    }

    const action = btn.dataset.action;
    const id = btn.dataset.id;
    e.stopPropagation();

    if (action === 'add') { openAddModal(); return; }

    if (action === 'ver') {
      const item = catalog.find(i => i.id === id);
      if (!item) return;
      if (item.tipo === 'serie' && getTotal(item) > 0) { openEpisodeProgressModal(item); return; }
      if (item.web) { window.open(item.web, '_blank'); return; }
      showToast('No hay enlace disponible', true);
      return;
    }

    if (action === 'marcar') {
      const item = catalog.find(i => i.id === id);
      if (!item) return;
      const total = getTotal(item);
      const prog = item.progreso || 0;
      if (prog > 0) {
        await changeEpisode(id, 0);
        showToast('🔄 Progreso reiniciado');
      } else if (total > 0) {
        await changeEpisode(id, total);
        showToast('✅ Marcado como visto');
      } else {
        await saveProgress(id, 1);
        await renderGrid();
        showToast('✅ Marcado como visto');
      }
      return;
    }

    if (action === 'more') {
      const dd = document.getElementById('dd-' + id);
      if (dd) dd.classList.toggle('open');
      return;
    }

    if (action === 'editar') { openEditModal(id); return; }
    if (action === 'eliminar') { if (confirm('¿Eliminar este contenido?')) deleteContent(id); return; }
    if (action === 'progreso') {
      const item = catalog.find(i => i.id === id);
      if (item) openEpisodeProgressModal(item);
      return;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (dom.overlayForm.style.display === 'flex') closeFormModal();
      if (dom.overlayView.style.display === 'flex') closeViewModal();
      if (dom.epProgressModal.style.display === 'flex') closeEpisodeProgressModal();
      if (dom.deleteConfirmModal.style.display === 'flex') { dom.deleteConfirmModal.style.display = 'none'; document.body.style.overflow = ''; }
      if (document.getElementById('podiumModal')?.style.display === 'flex') closePodiumModal();
    }
  });

  // Podium events
  document.querySelectorAll('.cine-view-tab').forEach(tab => {
    tab.addEventListener('click', () => switchView(tab.dataset.view));
  });
  document.querySelectorAll('.podium-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.podium-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentPodiumType = tab.dataset.podiumType;
      renderPodium();
    });
  });
  document.querySelectorAll('.podium-modal-tabs .podium-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.podium-modal-tabs .podium-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      editingPodiumType = tab.dataset.pmType;
      renderPodiumEditList();
    });
  });
  document.getElementById('editPodiumBtn')?.addEventListener('click', () => openPodiumModal(currentPodiumType));
  document.getElementById('savePodiumBtn')?.addEventListener('click', savePodium);
  document.getElementById('cancelPodiumBtn')?.addEventListener('click', closePodiumModal);
  document.getElementById('closePodiumModalBtn')?.addEventListener('click', closePodiumModal);
  document.getElementById('podiumModal')?.addEventListener('click', (e) => { if (e.target === document.getElementById('podiumModal')) closePodiumModal(); });
}

document.addEventListener('DOMContentLoaded', init);
