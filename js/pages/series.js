// series.js - Biblioteca completa con widget flotante

'use strict';

let catalog = [];
let currentFilter = 'todo';
let searchTerm = '';
let currentEditId = null;
let hlsInstance = null;
let episodiosTemp = [];
let currentViewItem = null;
let currentViewProgress = 0;

// ========== PODIO TOP 5 ==========
let podioData = { series: [], movies: [] };
let currentPodiumType = 'series';
let editingPodiumType = 'series';

// ========== WIDGET FLOTANTE - VARIABLES GLOBALES ==========
let trackerSeries = [];
let currentTrackingSerie = null;

// Referencias DOM
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
  episodiosList: document.getElementById('episodiosList'),
  btnAnadir: document.getElementById('btnAnadir'),
  btnEliminarTodo: document.getElementById('btnEliminarTodo'),
  btnAddEpisodio: document.getElementById('btnAddEpisodio'),
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
  confirmDeleteBtn: document.getElementById('confirmDeleteBtn')
};

// Firestore
const COL = 'seriesData';

async function getDB() {
  if (window.db) return window.db;
  if (typeof window.waitForFirebase === 'function') {
    await window.waitForFirebase();
    if (window.db) return window.db;
  }
  if (typeof firebase !== 'undefined' && firebase.firestore) {
    window.db = firebase.firestore();
    return window.db;
  }
  throw new Error('Firestore no inicializado');
}

async function ensureFirebaseAuth() {
  const auth = window.auth || (typeof firebase !== 'undefined' && firebase.auth ? firebase.auth() : null);
  if (!auth || auth.currentUser) return true;

  try {
    const credential = await auth.signInAnonymously();
    window.auth = auth;
    console.log('Sesión anónima iniciada para guardar en Firebase:', credential.user?.uid);
    return true;
  } catch (error) {
    console.warn('No se pudo iniciar sesión anónima en Firebase:', error);
    if (error?.code === 'auth/admin-restricted-operation') {
      showToast('Firebase no permite login anónimo. Actívalo o ajusta las reglas.', true);
    }
    return false;
  }
}

async function loadTrackerItems(userId) {
  const snap = await (await getDB()).collection(COL).get();
  return snap.docs
    .map(doc => doc.data())
    .filter(item => item.isTracker && item.userId === userId)
    .map(item => ({ id: item.serieId, ...item }));
}

async function saveTrackerItems(userId, items) {
  await ensureFirebaseAuth();
  const database = await getDB();
  const snap = await database.collection(COL).get();
  const batch = database.batch();
  snap.docs.forEach(doc => {
    const data = doc.data();
    if (data.isTracker && data.userId === userId) batch.delete(doc.ref);
  });
  items.forEach(item => {
    const ref = database.collection(COL).doc(`tracker_${userId}_${item.id}`);
    batch.set(ref, {
      ...item,
      userId,
      serieId: item.id,
      isTracker: true,
      updatedAt: item.updatedAt || new Date().toISOString()
    });
  });
  await batch.commit();
}

function showToast(msg, isError = false) {
  if (!dom.toast) return;
  dom.toast.textContent = msg;
  dom.toast.style.display = 'block';
  if (isError) dom.toast.style.borderLeftColor = '#dc3545';
  else dom.toast.style.borderLeftColor = 'var(--accent-coral)';
  setTimeout(() => {
    if (dom.toast) dom.toast.style.display = 'none';
  }, 3000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

// ========== PROGRESO ==========
async function loadProgress(seriesId) {
  try {
    const doc = await (await getDB()).collection(COL).doc(seriesId).get();
    const data = doc.data();
    if (data && data.progreso) return data.progreso;
    return 0;
  } catch (e) {
    console.error('Error cargando progreso:', e);
    return 0;
  }
}

async function saveProgress(seriesId, episodeNum) {
  try {
    await ensureFirebaseAuth();
    await (await getDB()).collection(COL).doc(seriesId).update({
      progreso: episodeNum,
      updatedAt: new Date().toISOString()
    });
    return true;
  } catch (e) {
    console.error('Error guardando progreso:', e);
    return false;
  }
}

async function deleteProgress(seriesId) {
  try {
    await ensureFirebaseAuth();
    await (await getDB()).collection(COL).doc(seriesId).update({ progreso: 0 });
  } catch (e) {
    console.error('Error eliminando progreso:', e);
  }
}

// ========== MARCAR EPISODIO ==========
async function markEpisodeAsWatched(seriesId, episodeNum, totalEpisodes, autoComplete = false) {
  await saveProgress(seriesId, episodeNum);
  
  if (episodeNum === totalEpisodes && !autoComplete) {
    showToast('🎉 ¡Felicidades! Has completado esta serie');
  } else if (!autoComplete) {
    showToast(`📺 Episodio ${episodeNum} marcado como visto`);
  }
  
  if (currentViewItem && currentViewItem.id === seriesId) {
    await openViewModal(currentViewItem);
  }
  await renderGrid();
  await cargarTrackerSeries();
}

async function markAllWatched(seriesId, totalEpisodes) {
  await saveProgress(seriesId, totalEpisodes);
  showToast(`✅ Marcados todos los episodios como vistos`);
  if (currentViewItem && currentViewItem.id === seriesId) {
    await openViewModal(currentViewItem);
  }
  await renderGrid();
  await cargarTrackerSeries();
}

async function unmarkAll(seriesId) {
  await saveProgress(seriesId, 0);
  showToast(`🔄 Progreso reiniciado desde cero`);
  if (currentViewItem && currentViewItem.id === seriesId) {
    await openViewModal(currentViewItem);
  }
  await renderGrid();
  await cargarTrackerSeries();
}

// ========== RENDER EPISODIOS ==========
function renderEpisodesWithProgress(item, progressEpisode) {
  const episodios = item.episodios || [];
  const total = episodios.length;
  const isCompleted = progressEpisode >= total;
  
  if (episodios.length === 0) {
    return `<div class="empty-state" style="padding: 40px;">
      <i data-lucide="tv"></i>
      <p>Esta ${item.tipo === 'serie' ? 'serie' : 'película'} no tiene episodios registrados.</p>
    </div>`;
  }
  
  return episodios.map((ep, idx) => {
    const epNum = ep.numero;
    const isWatched = progressEpisode >= epNum;
    const isNext = progressEpisode + 1 === epNum;
    
    const tieneMedia = ep.mp4 || ep.m3u8;
    const tieneExterno = ep.externo;
    
    let buttonHtml = '';
    if (tieneMedia) {
      buttonHtml = `<button class="btn-primary btn-sm play-ep" data-num="${ep.numero}"><i data-lucide="play"></i> Reproducir</button>`;
    } else if (tieneExterno) {
      buttonHtml = `<button class="btn-secondary btn-sm open-ext" data-url="${escapeHtml(ep.externo)}">🌐 Abrir web</button>`;
    } else {
      buttonHtml = `<span class="no-link">Sin enlace</span>`;
    }
    
    const markBtn = (item.tipo === 'serie' || episodios.length > 1) ? `
      <button class="mark-ep-btn ${isWatched ? 'watched' : ''}" data-num="${ep.numero}" ${isWatched ? 'disabled' : ''}>
        ${isWatched ? '✅ Visto' : '👁️ Marcar visto'}
      </button>
    ` : '';
    
    const rowClass = isNext ? 'episode-row next-episode' : 'episode-row';
    const nextBadge = isNext && !isCompleted ? '<span class="next-badge">▶ Siguiente</span>' : '';
    const completedBadge = isCompleted && epNum === total ? '<span class="completed-badge">🏆 Completado</span>' : '';
    
    return `
      <div class="${rowClass}" data-ep-num="${ep.numero}">
        <div class="episode-row-info">
          <span class="episode-row-num ${isWatched ? 'watched-num' : ''}">${String(ep.numero).padStart(2, '0')}</span>
          <span class="episode-row-title ${isWatched ? 'watched-title' : ''}">${escapeHtml(ep.titulo || `Episodio ${ep.numero}`)}</span>
          ${nextBadge}${completedBadge}
        </div>
        <div class="episode-row-actions">${buttonHtml}${markBtn}</div>
      </div>
    `;
  }).join('');
}

// ========== VISTA MODAL ==========
async function openViewModal(item) {
  stopPlayer();
  currentViewItem = item;
  currentViewProgress = await loadProgress(item.id);
  const episodios = item.episodios || [];
  const totalEpisodios = episodios.length;
  const isCompleted = currentViewProgress >= totalEpisodios;
  
  dom.viewTitle.textContent = item.titulo || '—';
  dom.viewTipo.className = `badge ${item.tipo === 'serie' ? 'serie' : 'pelicula'}`;
  dom.viewTipo.textContent = item.tipo === 'serie' ? 'Serie' : 'Película';
  
  if (item.portada) {
    dom.viewCover.src = item.portada;
    dom.viewCover.style.display = 'block';
  } else {
    dom.viewCover.style.display = 'none';
  }
  
  dom.playerWrapper.style.display = 'none';
  
  if (item.tipo === 'serie' && totalEpisodios > 0) {
    dom.bulkActions.style.display = 'flex';
    dom.markAllWatchedBtn.onclick = async () => { await markAllWatched(item.id, totalEpisodios); };
    dom.unmarkAllBtn.onclick = async () => { await unmarkAll(item.id); };
  } else {
    dom.bulkActions.style.display = 'none';
  }
  
  let progressBarHtml = '';
  if (item.tipo === 'serie' && totalEpisodios > 0) {
    const percent = (currentViewProgress / totalEpisodios) * 100;
    progressBarHtml = `
      <div class="progress-track-serie">
        <div class="progress-header" style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <span style="font-size: 0.7rem; color: var(--umbra-ash);">Progreso</span>
          <span style="font-size: 0.7rem; color: var(--accent-coral);">${currentViewProgress} / ${totalEpisodios} episodios</span>
        </div>
        <div style="height: 4px; background: rgba(255,255,255,0.1); border-radius: 10px; overflow: hidden;">
          <div style="width: ${percent}%; height: 100%; background: var(--accent-coral); border-radius: 10px; transition: width 0.3s;"></div>
        </div>
        ${isCompleted ? '<p style="font-size:0.7rem; color:#4caf50; margin-top:8px;">✨ ¡Serie completada! ✨</p>' : ''}
      </div>
    `;
  }
  
  const episodiosHtml = renderEpisodesWithProgress(item, currentViewProgress);
  dom.viewEpisodiosList.innerHTML = progressBarHtml + episodiosHtml;
  
  dom.viewEpisodiosList.querySelectorAll('.play-ep').forEach(btn => {
    btn.addEventListener('click', () => {
      const num = parseInt(btn.dataset.num);
      const ep = episodios.find(e => e.numero === num);
      if (ep) playEpisode(ep);
    });
  });
  
  dom.viewEpisodiosList.querySelectorAll('.open-ext').forEach(btn => {
    btn.addEventListener('click', () => { window.open(btn.dataset.url, '_blank'); });
  });
  
  dom.viewEpisodiosList.querySelectorAll('.mark-ep-btn:not(.watched)').forEach(btn => {
    btn.addEventListener('click', async () => {
      const num = parseInt(btn.dataset.num);
      await markEpisodeAsWatched(item.id, num, totalEpisodios);
    });
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
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }
  dom.videoPlayer.pause();
  dom.videoPlayer.src = '';
  dom.playerWrapper.style.display = 'none';
}

// ========== CRUD ==========
async function loadData() {
  try {
    const snap = await (await getDB()).collection(COL).get();
    catalog = snap.docs.filter(doc => !doc.data().isTracker).map(doc => {
      const data = doc.data();
      return { id: doc.id, ...data, progreso: data.progreso || 0 };
    });
    await loadPodio();
    await renderGrid();
    await cargarTrackerSeries();
  } catch (e) {
    console.error('Error:', e);
    showToast('Error al cargar datos', true);
  }
}

async function renderGrid() {
  let filtered = [...catalog];
  if (searchTerm) {
    filtered = filtered.filter(item => (item.titulo || '').toLowerCase().includes(searchTerm));
  }
  if (currentFilter === 'serie') {
    filtered = filtered.filter(item => item.tipo === 'serie');
  } else if (currentFilter === 'pelicula') {
    filtered = filtered.filter(item => item.tipo === 'pelicula');
  }

  if (filtered.length === 0) {
    dom.grid.innerHTML = '';
    dom.empty.style.display = 'flex';
    return;
  }
  dom.empty.style.display = 'none';

  dom.grid.innerHTML = filtered.map(item => {
    const tipoTexto = item.tipo === 'serie' ? 'SERIE' : 'PELÍCULA';
    const tieneEpisodios = item.episodios && item.episodios.length > 0;
    const portada = item.portada || '';
    const totalEp = item.episodios ? item.episodios.length : 0;
    const progreso = item.progreso || 0;
    const percent = totalEp > 0 ? (progreso / totalEp) * 100 : 0;
    const isCompleted = totalEp > 0 && progreso >= totalEp;
    
    let progressHtml = '';
    if (item.tipo === 'serie' && totalEp > 0) {
      progressHtml = `
        <div style="margin-top: 10px;">
          <div style="display: flex; justify-content: space-between; font-size: 0.6rem; color: var(--umbra-ash); margin-bottom: 3px;">
            <span>Progreso</span>
            <span>${progreso}/${totalEp}</span>
          </div>
          <div style="height: 2px; background: rgba(255,255,255,0.1); border-radius: 2px;">
            <div style="width: ${percent}%; height: 100%; background: var(--accent-coral); border-radius: 2px;"></div>
          </div>
        </div>
      `;
    }
    
    return `
      <div class="movie-card" data-id="${escapeHtml(item.id)}">
        <div class="card-cover" style="background-image: url('${escapeHtml(portada)}')">
          <div class="cover-gradient"></div>
          ${isCompleted ? '<div class="completed-badge-card">✓ Completado</div>' : ''}
        </div>
        <div class="card-content">
          <div class="card-meta">${tipoTexto}</div>
          <div class="card-title">${escapeHtml(item.titulo || 'Sin título')}</div>
          ${progressHtml}
          <div class="card-actions">
            <button class="card-btn btn-ver" data-id="${escapeHtml(item.id)}">${tieneEpisodios ? 'Ver episodios' : 'Ver ahora'}</button>
            <button class="card-btn btn-editar" data-id="${escapeHtml(item.id)}">Editar</button>
            <button class="card-btn btn-eliminar" data-id="${escapeHtml(item.id)}" style="background: rgba(220,53,69,0.6);">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.btn-ver').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const item = catalog.find(i => i.id === id);
      if (item) handleCardClick(item);
    });
  });
  
  document.querySelectorAll('.btn-editar').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditModal(btn.dataset.id);
    });
  });
  
  document.querySelectorAll('.btn-eliminar').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('¿Eliminar este contenido?')) {
        deleteContent(btn.dataset.id);
      }
    });
  });
  
  document.querySelectorAll('.movie-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      const item = catalog.find(i => i.id === id);
      if (item) handleCardClick(item);
    });
  });

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function handleCardClick(item) {
  if (!item) return;
  
  if (!item.episodios || item.episodios.length === 0) {
    if (item.web) {
      window.open(item.web, '_blank');
    } else {
      showToast('No hay enlace disponible para este contenido', true);
    }
    return;
  }
  
  await openViewModal(item);
}

async function deleteContent(id) {
  try {
    await ensureFirebaseAuth();
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
    await ensureFirebaseAuth();
    const snap = await (await getDB()).collection(COL).get();
    const batch = (await getDB()).batch();
    snap.docs.forEach(doc => {
      if (!doc.data().isTracker) batch.delete(doc.ref);
    });
    await batch.commit();
    await loadData();
    showToast('Todos los contenidos han sido eliminados');
  } catch (e) {
    console.error(e);
    showToast('Error al eliminar todo', true);
  }
}

// ========== FORMULARIO ==========
function openEditModal(id) {
  const item = catalog.find(i => i.id === id);
  if (!item) return;
  
  currentEditId = id;
  dom.modalFormTitle.textContent = 'Editar contenido';
  dom.formDocId.value = id;
  dom.fTitulo.value = item.titulo || '';
  dom.fTipo.value = item.tipo || 'serie';
  dom.fPortada.value = item.portada || '';
  dom.fWeb.value = item.web || '';
  
  episodiosTemp = (item.episodios || []).map(ep => ({ ...ep }));
  renderEpisodiosForm();
  
  dom.overlayForm.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function openAddModal() {
  currentEditId = null;
  dom.modalFormTitle.textContent = 'Añadir contenido';
  dom.formDocId.value = '';
  dom.fTitulo.value = '';
  dom.fTipo.value = 'serie';
  dom.fPortada.value = '';
  dom.fWeb.value = '';
  episodiosTemp = [];
  renderEpisodiosForm();
  
  dom.overlayForm.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function renderEpisodiosForm() {
  if (!dom.episodiosList) return;
  
  dom.episodiosList.innerHTML = episodiosTemp.map((ep, idx) => `
    <div class="episode-item" data-idx="${idx}">
      <div class="episode-header">
        <span class="episode-num">EP #${ep.numero}</span>
        <button type="button" class="btn-secondary btn-sm remove-ep" data-idx="${idx}">Eliminar</button>
      </div>
      <div class="episode-fields">
        <input type="number" placeholder="Número" value="${ep.numero}" class="ep-num" data-field="numero">
        <input type="text" placeholder="Título" value="${escapeHtml(ep.titulo || '')}" class="ep-titulo" data-field="titulo">
        <input type="text" placeholder="MP4 URL" value="${escapeHtml(ep.mp4 || '')}" class="ep-mp4" data-field="mp4">
        <input type="text" placeholder="M3U8 URL" value="${escapeHtml(ep.m3u8 || '')}" class="ep-m3u8" data-field="m3u8">
        <input type="text" placeholder="Enlace externo" value="${escapeHtml(ep.externo || '')}" class="ep-externo" data-field="externo">
      </div>
    </div>
  `).join('');
  
  dom.episodiosList.querySelectorAll('input').forEach(input => {
    input.addEventListener('change', (e) => {
      const idx = parseInt(input.closest('.episode-item').dataset.idx);
      const field = input.dataset.field;
      if (episodiosTemp[idx]) {
        episodiosTemp[idx][field] = input.value;
        if (field === 'numero') episodiosTemp[idx].numero = parseInt(input.value);
      }
    });
  });
  
  dom.episodiosList.querySelectorAll('.remove-ep').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(btn.dataset.idx);
      episodiosTemp.splice(idx, 1);
      episodiosTemp.forEach((ep, i) => ep.numero = i + 1);
      renderEpisodiosForm();
    });
  });
}

function addEpisodio() {
  const newNum = episodiosTemp.length + 1;
  episodiosTemp.push({
    numero: newNum,
    titulo: '',
    mp4: '',
    m3u8: '',
    externo: ''
  });
  renderEpisodiosForm();
}

async function saveContent() {
  const titulo = dom.fTitulo.value.trim();
  const tipo = dom.fTipo.value;
  
  if (!titulo) {
    showToast('El título es obligatorio', true);
    return;
  }
  
  const payload = {
    titulo,
    tipo,
    portada: dom.fPortada.value.trim(),
    web: dom.fWeb.value.trim(),
    episodios: episodiosTemp.filter(ep => ep.titulo || ep.mp4 || ep.m3u8 || ep.externo),
    updatedAt: new Date().toISOString()
  };
  
  try {
    await ensureFirebaseAuth();
    if (currentEditId) {
      await (await getDB()).collection(COL).doc(currentEditId).update(payload);
      showToast('Actualizado correctamente');
      await loadData();
    } else {
      payload.createdAt = new Date().toISOString();
      const docRef = await (await getDB()).collection(COL).add(payload);
      showToast('Añadido correctamente');
      await loadData();
    }
    closeFormModal();
  } catch (e) {
    console.error(e);
    showToast('Error al guardar', true);
  }
}

function closeFormModal() {
  dom.overlayForm.style.display = 'none';
  document.body.style.overflow = '';
  currentEditId = null;
}

function closeViewModal() {
  stopPlayer();
  dom.overlayView.style.display = 'none';
  document.body.style.overflow = '';
  currentViewItem = null;
}

// ========== WIDGET FLOTANTE - FUNCIONES ==========

function getTrackerUserId() {
  // Usar un ID fijo para que sea el mismo en todos lados
  return 'usuario_principal_fijo';
}

async function cargarTrackerSeries() {
  const userId = getTrackerUserId();
  const trackerSeriesMap = new Map();
  
  try {
    const items = await loadTrackerItems(userId);
    items.forEach(item => {
      if (item?.id) trackerSeriesMap.set(item.id, item);
    });
    
    trackerSeries = Array.from(trackerSeriesMap.values());
    renderTrackerList();
    actualizarBadgeTracker();
  } catch (error) {
    console.error('Error cargando tracker:', error);
  }
}

async function guardarTrackerSerie(serieData) {
  const userId = getTrackerUserId();
  try {
    const items = await loadTrackerItems(userId);
    const item = {
      id: serieData.id,
      nombre: serieData.nombre,
      totalEpisodios: serieData.totalEpisodios,
      poster: serieData.poster || '',
      vistos: serieData.vistos || 0,
      esDelCatalogo: serieData.esDelCatalogo || false,
      createdAt: serieData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const index = items.findIndex(serie => serie.id === serieData.id);
    if (index >= 0) items[index] = { ...items[index], ...item };
    else items.push(item);
    await saveTrackerItems(userId, items);
    await cargarTrackerSeries();
    return true;
  } catch (error) {
    console.error('Error guardando tracker:', error);
    showToast('Error al guardar en Firebase', true);
    return false;
  }
}

async function actualizarVistosTracker(serieId, nuevosVistos) {
  const userId = getTrackerUserId();
  try {
    await ensureFirebaseAuth();
    const serie = trackerSeries.find(s => s.id === serieId);
    if (!serie) return;
    
    const totalEp = serie.totalEpisodios;
    const vistosFinal = Math.min(nuevosVistos, totalEp);
    
    const items = await loadTrackerItems(userId);
    const updatedItems = items.map(item => item.id === serieId
      ? { ...item, vistos: vistosFinal, updatedAt: new Date().toISOString() }
      : item
    );
    await saveTrackerItems(userId, updatedItems);
    
    serie.vistos = vistosFinal;
    await cargarTrackerSeries();
    await renderGrid();
    
    if (currentTrackingSerie && currentTrackingSerie.id === serieId) {
      currentTrackingSerie.vistos = vistosFinal;
      abrirModalEpisodiosTracker(currentTrackingSerie);
    }
    
    showToast(`✅ ${serie.nombre}: ${vistosFinal}/${totalEp}`);
  } catch (error) {
    console.error('Error actualizando vistos:', error);
    showToast('Error al guardar', true);
  }
}

async function eliminarTrackerSerie(serieId) {
  const userId = getTrackerUserId();
  try {
    await ensureFirebaseAuth();
    const items = await loadTrackerItems(userId);
    await saveTrackerItems(userId, items.filter(item => item.id !== serieId));
    await cargarTrackerSeries();
    showToast('Serie eliminada del seguimiento');
  } catch (error) {
    console.error('Error eliminando tracker:', error);
    showToast('Error al eliminar', true);
  }
}

function renderTrackerList() {
  const container = document.getElementById('trackerList');
  if (!container) return;
  
  const searchTerm = document.getElementById('trackerSearchInput')?.value.toLowerCase() || '';
  let filtered = [...trackerSeries];
  if (searchTerm) {
    filtered = filtered.filter(s => s.nombre.toLowerCase().includes(searchTerm));
  }
  
  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--umbra-ash);">
        <i data-lucide="inbox" style="width: 40px; height: 40px; margin-bottom: 12px;"></i>
        <p>No hay series en seguimiento</p>
        <p style="font-size: 0.75rem;">Haz clic en "+ Añadir serie manual"</p>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: container });
    return;
  }
  
  container.innerHTML = filtered.map(serie => {
    const total = serie.totalEpisodios;
    const vistos = serie.vistos || 0;
    const percent = total > 0 ? (vistos / total) * 100 : 0;
    const posterBg = serie.poster ? `background-image: url('${escapeHtml(serie.poster)}')` : '';
    
    return `
      <div class="tracker-serie-item" data-id="${serie.id}">
        <div class="tracker-serie-header">
          <div class="tracker-serie-poster" style="${posterBg}"></div>
          <div class="tracker-serie-info">
            <div class="tracker-serie-nombre">${escapeHtml(serie.nombre)}</div>
            <div class="tracker-serie-progreso">${vistos}/${total} episodios</div>
          </div>
        </div>
        <div class="tracker-progress-bar">
          <div class="tracker-progress-fill" style="width: ${percent}%"></div>
        </div>
        <div class="tracker-serie-actions">
          <button class="tracker-icon-btn" data-action="ver" data-id="${serie.id}" title="Ver episodios">
            <i data-lucide="eye"></i>
          </button>
          <button class="tracker-icon-btn" data-action="editar" data-id="${serie.id}" title="Editar serie">
            <i data-lucide="edit-2"></i>
          </button>
          <button class="tracker-icon-btn delete" data-action="eliminar" data-id="${serie.id}" title="Eliminar">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
  
  container.querySelectorAll('[data-action="ver"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const serie = trackerSeries.find(s => s.id === id);
      if (serie) abrirModalEpisodiosTracker(serie);
    });
  });
  
  container.querySelectorAll('[data-action="editar"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const serie = trackerSeries.find(s => s.id === id);
      if (serie) {
        document.getElementById('trackerSerieNombre').value = serie.nombre;
        document.getElementById('trackerSerieTotal').value = serie.totalEpisodios;
        document.getElementById('trackerSeriePoster').value = serie.poster || '';
        window.trackerEditandoId = id;
        const modal = document.getElementById('trackerAddModal');
        const modalTitle = modal?.querySelector('.tracker-modal-header h3');
        if (modalTitle) modalTitle.innerHTML = '<i data-lucide="edit-2"></i> Editar serie';
        if (modal) modal.style.display = 'flex';
      }
    });
  });
  
  container.querySelectorAll('[data-action="eliminar"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      eliminarTrackerSerie(btn.dataset.id);
    });
  });
  
  container.querySelectorAll('.tracker-serie-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.id;
      const serie = trackerSeries.find(s => s.id === id);
      if (serie) abrirModalEpisodiosTracker(serie);
    });
  });
  
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: container });
}

function actualizarBadgeTracker() {
  const badge = document.getElementById('trackerBadge');
  if (badge) {
    badge.textContent = trackerSeries.length;
  }
}

function abrirModalEpisodiosTracker(serie) {
  currentTrackingSerie = serie;
  const modal = document.getElementById('trackerEpisodiosModal');
  const title = document.getElementById('trackerEpisodiosTitle');
  const container = document.getElementById('trackerEpisodiosList');
  const summary = document.getElementById('trackerProgressSummary');
  
  if (!modal || !container) return;
  
  title.innerHTML = '<i data-lucide="list"></i> ' + escapeHtml(serie.nombre);
  
  const total = serie.totalEpisodios;
  const vistos = serie.vistos || 0;
  const percent = Math.round((vistos / total) * 100);
  
  container.innerHTML = '';
  for (let i = 1; i <= total; i++) {
    const visto = vistos >= i;
    container.innerHTML += `
      <div class="tracker-episodio-item ${visto ? 'visto' : ''}" data-episodio="${i}">
        <input type="checkbox" class="tracker-episodio-check" ${visto ? 'checked' : ''} data-ep="${i}">
        <span class="tracker-episodio-numero">Episodio ${i}</span>
      </div>
    `;
  }
  
  summary.innerHTML = `
    <span><i data-lucide="tv"></i> ${vistos}/${total}</span>
    <span><i data-lucide="trending-up"></i> ${percent}%</span>
  `;
  
  container.querySelectorAll('.tracker-episodio-check').forEach((checkbox) => {
    checkbox.addEventListener('change', async (e) => {
      e.stopPropagation();
      const episodioNum = parseInt(checkbox.dataset.ep);
      let nuevosVistos = vistos;
      
      if (checkbox.checked) {
        nuevosVistos = Math.max(vistos, episodioNum);
      } else {
        const todosChecks = container.querySelectorAll('.tracker-episodio-check');
        let ultimoMarcado = 0;
        todosChecks.forEach((ch, idx) => {
          if (ch.checked && (idx + 1) > ultimoMarcado) {
            ultimoMarcado = idx + 1;
          }
        });
        nuevosVistos = ultimoMarcado;
      }
      
      await actualizarVistosTracker(serie.id, nuevosVistos);
    });
  });
  
  modal.style.display = 'flex';
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: modal });
}

function toggleTrackerPanel() {
  const panel = document.getElementById('floatingTrackerPanel');
  if (panel) {
    if (panel.style.display === 'none' || getComputedStyle(panel).display === 'none') {
      panel.style.display = 'flex';
      cargarTrackerSeries();
    } else {
      panel.style.display = 'none';
    }
  }
}

function abrirModalAgregarSerie() {
  delete window.trackerEditandoId;
  const modal = document.getElementById('trackerAddModal');
  const modalTitle = modal?.querySelector('.tracker-modal-header h3');
  if (modalTitle) modalTitle.innerHTML = '<i data-lucide="plus"></i> Añadir serie manual';
  document.getElementById('trackerSerieNombre').value = '';
  document.getElementById('trackerSerieTotal').value = '1';
  document.getElementById('trackerSeriePoster').value = '';
  if (modal) modal.style.display = 'flex';
}

async function guardarSerieManual() {
  const nombre = document.getElementById('trackerSerieNombre').value.trim();
  const total = parseInt(document.getElementById('trackerSerieTotal').value, 10);
  const poster = document.getElementById('trackerSeriePoster').value.trim();
  
  if (!nombre) {
    showToast('El nombre es obligatorio', true);
    return;
  }
  if (isNaN(total) || total < 1) {
    showToast('Total de episodios válido', true);
    return;
  }
  
  const modal = document.getElementById('trackerAddModal');
  
  if (window.trackerEditandoId) {
    // EDITAR serie existente
    const userId = getTrackerUserId();
    try {
      await ensureFirebaseAuth();
      const items = await loadTrackerItems(userId);
      const updatedItems = items.map(item => item.id === window.trackerEditandoId
        ? { ...item, nombre, totalEpisodios: total, poster: poster || '', updatedAt: new Date().toISOString() }
        : item
      );
      await saveTrackerItems(userId, updatedItems);
      showToast(`✅ Serie "${nombre}" actualizada`);
      delete window.trackerEditandoId;
    } catch (error) {
      console.error('Error editando:', error);
      showToast('Error al editar', true);
      return;
    }
  } else {
    // AÑADIR nueva serie
    const nuevaSerie = {
      id: 'manual_' + Date.now(),
      nombre: nombre,
      totalEpisodios: total,
      poster: poster,
      vistos: 0,
      esDelCatalogo: false,
      createdAt: new Date().toISOString()
    };
    const guardado = await guardarTrackerSerie(nuevaSerie);
    if (!guardado) return;
    showToast(`✅ Serie "${nombre}" añadida`);
  }
  
  const modalTitle = modal?.querySelector('.tracker-modal-header h3');
  if (modalTitle) modalTitle.innerHTML = '<i data-lucide="plus"></i> Añadir serie manual';
  if (modal) modal.style.display = 'none';
  
  document.getElementById('trackerSerieNombre').value = '';
  document.getElementById('trackerSerieTotal').value = '1';
  document.getElementById('trackerSeriePoster').value = '';
  
  await cargarTrackerSeries();
}

// ========== PODIO ==========

async function loadPodio() {
  try {
    const doc = await (await getDB()).collection('config').doc('podio').get();
    if (doc.exists) {
      const data = doc.data();
      podioData.series = data.series || [];
      podioData.movies = data.movies || [];
    } else {
      podioData = { series: [], movies: [] };
    }
  } catch (e) {
    console.error('Error cargando podio:', e);
    podioData = { series: [], movies: [] };
  }
}

async function savePodio() {
  try {
    await ensureFirebaseAuth();
    await (await getDB()).collection('config').doc('podio').set({
      series: podioData.series,
      movies: podioData.movies,
      updatedAt: new Date().toISOString()
    });
  } catch (e) {
    console.error('Error guardando podio:', e);
    showToast('Error al guardar podio', true);
  }
}

function renderPodium() {
  const grid = document.getElementById('podiumGrid');
  const empty = document.getElementById('podiumEmpty');
  const section = document.getElementById('podiumSection');
  if (!grid || !empty || !section) return;

  const items = podioData[currentPodiumType] || [];
  const sorted = [...items].sort((a, b) => a.position - b.position);
  const tipoLabel = currentPodiumType === 'series' ? 'Serie' : 'Película';

  if (sorted.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  grid.innerHTML = sorted.map((item, idx) => {
    const rank = item.position;
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
    const coverBg = item.portada ? `background-image: url('${escapeHtml(item.portada)}')` : '';
    return `
      <div class="podium-card">
        <div class="podium-rank podium-rank-${rank}">${medal}</div>
        <div class="podium-card-cover" style="${coverBg}"></div>
        <div class="podium-card-info">
          <div class="podium-card-title">${escapeHtml(item.titulo)}</div>
          <div class="podium-card-sub">${tipoLabel} · Puesto #${rank}</div>
        </div>
      </div>
    `;
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
    list.innerHTML = `<div style="text-align:center;padding:40px;color:var(--umbra-ash);">
      <p>No hay ${editingPodiumType} en tu catálogo. ¡Añade algunas primero!</p>
    </div>`;
    return;
  }

  list.innerHTML = filtered.map(item => {
    const current = podioItems.find(p => p.itemId === item.id);
    const selectedPos = current ? current.position : '';
    const coverBg = item.portada ? `background-image: url('${escapeHtml(item.portada)}')` : '';
    return `
      <div class="podium-edit-item">
        <div class="podium-edit-cover" style="${coverBg}"></div>
        <span class="podium-edit-title">${escapeHtml(item.titulo)}</span>
        <select class="podium-edit-select" data-item-id="${item.id}" data-titulo="${escapeHtml(item.titulo)}" data-portada="${escapeHtml(item.portada || '')}">
          <option value="">—</option>
          <option value="1" ${selectedPos === 1 ? 'selected' : ''}>#1</option>
          <option value="2" ${selectedPos === 2 ? 'selected' : ''}>#2</option>
          <option value="3" ${selectedPos === 3 ? 'selected' : ''}>#3</option>
          <option value="4" ${selectedPos === 4 ? 'selected' : ''}>#4</option>
          <option value="5" ${selectedPos === 5 ? 'selected' : ''}>#5</option>
        </select>
      </div>
    `;
  }).join('');
}

function collectPodiumData(type) {
  const selects = document.querySelectorAll('#podiumEditList .podium-edit-select');
  const items = [];
  selects.forEach(sel => {
    if (sel.value) {
      items.push({
        itemId: sel.dataset.itemId,
        position: parseInt(sel.value),
        titulo: sel.dataset.titulo,
        portada: sel.dataset.portada
      });
    }
  });
  const positions = items.map(i => i.position);
  const unique = new Set(positions);
  if (positions.length !== unique.size) {
    showToast('No puedes repetir posiciones. Cada puesto debe ser único.', true);
    return null;
  }
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
  const catalogElements = [
    document.querySelector('.filters-bar'),
    document.getElementById('contentGrid'),
    document.getElementById('emptyState')
  ];
  const podiumSection = document.getElementById('podiumSection');
  const viewTabs = document.querySelectorAll('.cine-view-tab');

  viewTabs.forEach(t => t.classList.toggle('active', t.dataset.view === view));

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
  dom.btnAddEpisodio?.addEventListener('click', addEpisodio);
  dom.closeFormBtn?.addEventListener('click', closeFormModal);
  dom.cancelFormBtn?.addEventListener('click', closeFormModal);
  dom.closeViewBtn?.addEventListener('click', closeViewModal);
  
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
  
  document.getElementById('contentForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    saveContent();
  });
  
  dom.searchInput?.addEventListener('input', (e) => {
    searchTerm = e.target.value.toLowerCase();
    renderGrid();
  });
  
  dom.filterBtns?.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      dom.filterBtns.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderGrid();
    });
  });
  
  dom.overlayForm?.addEventListener('click', (e) => {
    if (e.target === dom.overlayForm) closeFormModal();
  });
  dom.overlayView?.addEventListener('click', (e) => {
    if (e.target === dom.overlayView) closeViewModal();
  });
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (dom.overlayForm.style.display === 'flex') closeFormModal();
      if (dom.overlayView.style.display === 'flex') closeViewModal();
      if (dom.deleteConfirmModal.style.display === 'flex') {
        dom.deleteConfirmModal.style.display = 'none';
        document.body.style.overflow = '';
      }
      if (document.getElementById('trackerAddModal')?.style.display === 'flex') {
        document.getElementById('trackerAddModal').style.display = 'none';
      }
      if (document.getElementById('trackerEpisodiosModal')?.style.display === 'flex') {
        document.getElementById('trackerEpisodiosModal').style.display = 'none';
      }
      if (document.getElementById('floatingTrackerPanel')?.style.display === 'flex') {
        document.getElementById('floatingTrackerPanel').style.display = 'none';
      }
      if (document.getElementById('podiumModal')?.style.display === 'flex') {
        closePodiumModal();
      }
    }
  });
  
  // ========== EVENTOS DEL WIDGET ==========
  document.getElementById('floatingTrackerBtn')?.addEventListener('click', toggleTrackerPanel);
  document.getElementById('closeTrackerBtn')?.addEventListener('click', toggleTrackerPanel);
  document.getElementById('trackerAddSeriesBtn')?.addEventListener('click', abrirModalAgregarSerie);
  document.getElementById('closeTrackerModalBtn')?.addEventListener('click', () => {
    document.getElementById('trackerAddModal').style.display = 'none';
  });
  document.getElementById('cancelTrackerModalBtn')?.addEventListener('click', () => {
    document.getElementById('trackerAddModal').style.display = 'none';
  });
  document.getElementById('saveTrackerSerieBtn')?.addEventListener('click', guardarSerieManual);
  document.getElementById('closeTrackerEpisodiosBtn')?.addEventListener('click', () => {
    document.getElementById('trackerEpisodiosModal').style.display = 'none';
  });
  document.getElementById('closeTrackerEpisodiosModalBtn')?.addEventListener('click', () => {
    document.getElementById('trackerEpisodiosModal').style.display = 'none';
  });
  document.getElementById('trackerMarcarTodosBtn')?.addEventListener('click', async () => {
    if (currentTrackingSerie) {
      await actualizarVistosTracker(currentTrackingSerie.id, currentTrackingSerie.totalEpisodios);
    }
  });
  document.getElementById('trackerDesmarcarTodosBtn')?.addEventListener('click', async () => {
    if (currentTrackingSerie) {
      await actualizarVistosTracker(currentTrackingSerie.id, 0);
    }
  });
  
  document.getElementById('trackerSearchInput')?.addEventListener('input', () => {
    renderTrackerList();
  });
  
  document.getElementById('trackerAddModal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('trackerAddModal')) {
      document.getElementById('trackerAddModal').style.display = 'none';
    }
  });
  document.getElementById('trackerEpisodiosModal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('trackerEpisodiosModal')) {
      document.getElementById('trackerEpisodiosModal').style.display = 'none';
    }
  });

  // ========== PODIO EVENTOS ==========
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
  document.getElementById('podiumModal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('podiumModal')) closePodiumModal();
  });
}

document.addEventListener('DOMContentLoaded', init);
