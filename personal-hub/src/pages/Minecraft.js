/* ==========================================
   Personal Hub v3 — Minecraft Worlds
   Sección del Rincón: recuerda todos los
   mundos de Minecraft que hayáis hecho.

   - Lista de mundos (categorías) con portada,
     descripción general (semilla, versión...).
   - Cada mundo tiene fotos y vídeos, cada uno
     con su descripción individual.
   - Solo el admin crea/edita/subir; dada ve.

   ========================================== */

import { showToast } from '../components/Toast.js';
import { escapeHtml } from '../utils/escape.js';
import { userStore } from '../stores/user.store.js';
import { createLightbox, openLightbox } from '../components/MediaLightbox.js';
import { db } from '../services/db.service.js';
import {
  listWorlds, getWorld, saveWorld, deleteWorld,
  worldItems, addItems, updateItem, removeItem,
  worldStats, worldCover, formatDate, hydrateMinecraft
} from '../services/minecraftData.js';
import { getVideoPoster } from '../services/rincon-data.js';
import { onContentChange } from '../services/realtime.service.js';

const UI = {
  back: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>',
  plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  play: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>',
  edit: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  trash: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  grid: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  image: '<svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
  smile: '<svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
  mic: '<svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>',
  link: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>'
};

let page = null;
let currentRouter = null;
let currentWorldId = null;

/** Barra superior de secciones (Galería | Memes | Audios | Minecraft) */
function subnavHTML() {
  return `
    <nav class="rincon-subnav" aria-label="Secciones">
      <button class="rincon-subnav__btn" data-subnav="galeria">
        <span class="rincon-subnav__icon-wrap">${UI.image}</span> Galería
      </button>
      <button class="rincon-subnav__btn" data-subnav="memes">
        <span class="rincon-subnav__icon-wrap">${UI.smile}</span> Memes
      </button>
      <button class="rincon-subnav__btn" data-subnav="audios">
        <span class="rincon-subnav__icon-wrap">${UI.mic}</span> Audios
      </button>
      <button class="rincon-subnav__btn active" data-subnav="minecraft">
        <span class="rincon-subnav__icon-wrap">⛏️</span> Minecraft
      </button>
    </nav>
  `;
}

/** Miniatura de un item (vídeo → póster Cloudinary) */
function thumbOf(item) {
  if (item.type === 'video') return getVideoPoster(item.src) || '';
  return item.src;
}

// ==========================================
// RENDER — Lista de mundos
// ==========================================
function renderWorldsList() {
  const worlds = listWorlds();
  const isAdmin = userStore.isAdmin;

  return `
    <div class="mc-page">
      <button class="rincon-back-btn" data-mc-back>
        ${UI.back} Rincón
      </button>

      ${subnavHTML()}

      <header class="mc-head">
        <div class="mc-head-titles">
          <span class="mc-kicker">Minecraft · Nuestros mundos</span>
          <h2 class="mc-title">⛏️ Todos nuestros mundos</h2>
          <p class="mc-sub">Cada mundo guarda sus fotos, vídeos y recuerdos por separado, con su semilla y descripción.</p>
        </div>
        ${isAdmin ? `<button class="mc-add-world" id="mcAddWorldBtn">${UI.plus} Nuevo mundo</button>` : ''}
      </header>

      ${worlds.length ? `
        <div class="mc-worlds-grid">
          ${worlds.map((w, i) => {
            const items = worldItems(w.id);
            const stats = worldStats(w.id);
            const cover = worldCover(w, items);
            const thumb = cover ? (getVideoPoster(cover) || cover) : '';
            return `
            <div class="mc-world-card card animate-in" data-mc-world="${escapeHtml(w.id)}" style="--enter-delay:${Math.min(i, 8) * 0.05}s" role="button" tabindex="0" aria-label="Abrir mundo ${escapeHtml(w.name)}">
              ${isAdmin ? `<button class="mc-world-menu" data-menu-world="${escapeHtml(w.id)}" aria-label="Opciones de ${escapeHtml(w.name)}" title="Opciones del mundo">⋮</button>` : ''}
              <div class="mc-world-media${thumb ? '' : ' is-empty'}">
                ${thumb
                  ? `<span class="mc-world-loader" aria-hidden="true"></span><img src="${escapeHtml(thumb)}" alt="" loading="lazy" decoding="async" onload="this.parentElement.classList.add('is-loaded')" onerror="this.parentElement.classList.add('is-error');this.remove()"><span class="mc-world-fallback" aria-hidden="true">⛏️</span>`
                  : `<span class="mc-world-emoji">⛏️</span><span class="mc-world-open-hint">Abrir mundo</span>`}
              </div>
              <div class="mc-world-info">
                <h3 class="mc-world-name">${escapeHtml(w.name)}</h3>
                ${w.description ? `<p class="mc-world-desc">${escapeHtml(w.description)}</p>` : '<p class="mc-world-desc is-muted">Sin descripción todavía.</p>'}
                <div class="mc-world-meta">
                  <span>${stats.total} ${stats.total === 1 ? 'recuerdo' : 'recuerdos'}</span>
                  ${stats.fotos ? `<span>· ${stats.fotos} 📷</span>` : ''}
                  ${stats.videos ? `<span>· ${stats.videos} 🎬</span>` : ''}
                  ${w.createdAt ? `<span>· ${formatDate(w.createdAt)}</span>` : ''}
                </div>
              </div>
            </div>`;
          }).join('')}
        </div>
      ` : `
        <div class="mc-empty">
          <div class="mc-empty-icon">⛏️</div>
          <h3>Aún no hay mundos</h3>
          <p>${isAdmin ? 'Crea el primer mundo y añade sus fotos y vídeos para empezar a recordarlos.' : 'Cuando el admin añada mundos, aparecerán aquí.'}</p>
          ${isAdmin ? `<button class="mc-add-world" id="mcEmptyAddBtn">${UI.plus} Nuevo mundo</button>` : ''}
        </div>
      `}
    </div>
  `;
}

// ==========================================
// RENDER — Detalle de un mundo
// ==========================================
function renderWorldDetail() {
  const world = getWorld(currentWorldId);
  const isAdmin = userStore.isAdmin;
  if (!world) {
    currentWorldId = null;
    return renderWorldsList();
  }
  const items = worldItems(world.id);
  const stats = worldStats(world.id);
  const cover = worldCover(world, items);
  const thumb = cover ? (getVideoPoster(cover) || cover) : '';

  return `
    <div class="mc-page">
      <button class="rincon-back-btn" data-mc-back>
        ${UI.back} Rincón
      </button>

      ${subnavHTML()}

      <button class="rincon-back-btn" data-mc-back-world>
        ${UI.back} Mundos
      </button>

      <header class="mc-world-hero"${thumb ? ` style="--mc-cover:url('${escapeHtml(thumb)}')"` : ''}>
        <div class="mc-world-hero-shade"></div>
        <div class="mc-world-hero-body">
          <span class="mc-kicker">Mundo · Minecraft</span>
          <h2 class="mc-world-hero-title">${escapeHtml(world.name)}</h2>
          ${world.description ? `<p class="mc-world-hero-desc">${escapeHtml(world.description)}</p>` : ''}
          <div class="mc-world-hero-meta">
            <span>${stats.total} ${stats.total === 1 ? 'recuerdo' : 'recuerdos'}</span>
            ${stats.fotos ? `<span>· ${stats.fotos} 📷</span>` : ''}
            ${stats.videos ? `<span>· ${stats.videos} 🎬</span>` : ''}
          </div>
          ${isAdmin ? `
          <div class="mc-world-hero-actions">
            <button class="mc-btn mc-btn--primary" id="mcUploadBtn">${UI.plus} Añadir fotos/vídeos</button>
            <button class="mc-btn" id="mcLinkBtn">${UI.link} Por enlace</button>
            <button class="mc-btn" id="mcCoverBtn">📌 Portada</button>
            <button class="mc-btn" id="mcEditWorldBtn">${UI.edit} Editar mundo</button>
            <button class="mc-btn mc-btn--danger" id="mcDeleteWorldBtn">${UI.trash} Eliminar</button>
          </div>
          <input type="file" id="mcFileInput" accept="image/*,video/*" multiple hidden>` : ''}
        </div>
      </header>

      ${items.length ? `
        <div class="mc-collection-head">
          <div>
            <span class="mc-kicker">Recuerdos</span>
            <h3 class="mc-collection-title">Fotos y vídeos de este mundo</h3>
          </div>
        </div>
        <div class="mc-items-grid">
          ${items.map((it, i) => {
            const t = thumbOf(it);
            const isVid = it.type === 'video';
            return `
            <div class="mc-item" data-mc-item="${escapeHtml(it.id)}" data-index="${i}">
              <div class="mc-item-media ${isVid ? 'is-video' : ''}${t ? '' : 'is-no-thumb'}" role="button" tabindex="0" aria-label="${isVid ? 'Ver vídeo' : 'Ver foto'} ${escapeHtml(world.name)} ${i + 1}">
                ${t
                  ? `<span class="mc-world-loader" aria-hidden="true"></span><img src="${escapeHtml(t)}" alt="${escapeHtml(it.caption || '')}" loading="lazy" decoding="async" onload="this.parentElement.classList.add('is-loaded')" onerror="this.parentElement.classList.add('is-error');this.remove()"><span class="mc-world-fallback" aria-hidden="true">${isVid ? UI.play : '🖼️'}</span>`
                  : `<span class="mc-item-no-thumb">${isVid ? UI.play : '🖼️'}</span>`}
                ${isVid ? `<span class="mc-item-play" aria-hidden="true">${UI.play}</span>` : ''}
              </div>
              <div class="mc-item-body">
                ${isAdmin
                  ? `<input type="text" class="mc-item-caption" value="${escapeHtml(it.caption || '')}" placeholder="Descripción de esta foto/vídeo…" maxlength="200" aria-label="Descripción del recuerdo">`
                  : (it.caption ? `<p class="mc-item-caption-static">${escapeHtml(it.caption)}</p>` : '')}
                ${isAdmin ? `<button class="mc-item-del" data-del="${escapeHtml(it.id)}" aria-label="Eliminar recuerdo" title="Eliminar">${UI.trash}</button>` : ''}
              </div>
            </div>`;
          }).join('')}
        </div>
      ` : `
        <div class="mc-empty">
          <div class="mc-empty-icon">🏗️</div>
          <h3>Este mundo aún no tiene recuerdos</h3>
          <p>${isAdmin ? 'Sube las primeras fotos o vídeos de este mundo.' : 'El admin aún no ha añadido nada aquí.'}</p>
          ${isAdmin ? `
          <div class="mc-empty-actions">
            <button class="mc-btn mc-btn--primary" id="mcUploadEmptyBtn">${UI.plus} Añadir fotos/vídeos</button>
            <button class="mc-btn" id="mcLinkEmptyBtn">${UI.link} Por enlace</button>
          </div>` : ''}
        </div>
      `}
    </div>
  `;
}

// ==========================================
// MODALES (admin)
// ==========================================

/** Editor de mundo: nombre + descripción general (semilla, versión...) */
function openWorldEditor(world) {
  const isNew = !world;
  const w = world || { name: '', description: '' };
  const overlay = document.createElement('div');
  overlay.className = 'photo-menu-overlay mc-editor-overlay';
  overlay.innerHTML = `
    <div class="photo-menu-sheet mc-editor">
      <div class="mc-editor-head">
        <h3>${isNew ? 'Nuevo mundo' : 'Editar mundo'}</h3>
        <button class="photo-menu-close" aria-label="Cerrar">✕</button>
      </div>
      <label class="mc-field">
        <span>Nombre del mundo</span>
        <input type="text" id="mcWorldName" value="${escapeHtml(w.name || '')}" maxlength="60" placeholder="p. ej. Nuestro primer mundo">
      </label>
      <label class="mc-field">
        <span>Descripción general <small>(semilla, versión, cómo empezó…)</small></span>
        <textarea id="mcWorldDesc" rows="4" maxlength="600" placeholder="p. ej. Semilla: 123456 · versión 1.20 · lo empezamos en verano…">${escapeHtml(w.description || '')}</textarea>
      </label>
      <div class="mc-editor-actions">
        <button class="mc-btn" data-mc-close>Cancelar</button>
        <button class="mc-btn mc-btn--primary" id="mcWorldSave">Guardar mundo</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('.photo-menu-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('[data-mc-close]').addEventListener('click', close);
  overlay.querySelector('#mcWorldSave').addEventListener('click', async () => {
    const name = overlay.querySelector('#mcWorldName').value.trim();
    if (!name) { showToast('Ponle un nombre al mundo', 'error'); return; }
    const saved = saveWorld({
      id: world?.id,
      name,
      description: overlay.querySelector('#mcWorldDesc').value.trim()
    });
    close();
    if (isNew) currentWorldId = saved.id;
    render();
    bind();
    showToast(isNew ? 'Mundo creado ✓' : 'Mundo actualizado ✓', 'success');
  });
}

/** Confirmar eliminación de un mundo (con todos sus recuerdos) */
function confirmDeleteWorld(world) {
  const overlay = document.createElement('div');
  overlay.className = 'photo-menu-overlay mc-editor-overlay';
  overlay.innerHTML = `
    <div class="photo-menu-sheet mc-editor">
      <div class="mc-editor-head"><h3>¿Eliminar «${escapeHtml(world.name)}»?</h3><button class="photo-menu-close" aria-label="Cerrar">✕</button></div>
      <p class="mc-confirm-text">Se eliminarán el mundo y todos sus ${worldStats(world.id).total} recuerdos. Esta acción no se puede deshacer.</p>
      <div class="mc-editor-actions">
        <button class="mc-btn" data-mc-close>Cancelar</button>
        <button class="mc-btn mc-btn--danger" id="mcWorldDelete">Eliminar mundo</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('.photo-menu-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('[data-mc-close]').addEventListener('click', close);
  overlay.querySelector('#mcWorldDelete').addEventListener('click', () => {
    deleteWorld(world.id);
    close();
    currentWorldId = null;
    render();
    bind();
    showToast('Mundo eliminado ✓', 'success');
  });
}

/** Menú ⋮ de la tarjeta de mundo (admin): editar / eliminar */
function openWorldCardMenu(worldId) {
  const world = getWorld(worldId);
  if (!world) return;
  const overlay = document.createElement('div');
  overlay.className = 'photo-menu-overlay';
  overlay.innerHTML = `
    <div class="photo-menu-sheet">
      <button class="photo-menu-close" aria-label="Cerrar">✕</button>
      <div class="photo-menu">
        <button class="photo-menu-item" data-mc-action="cover">📌 Elegir portada</button>
        <button class="photo-menu-item" data-mc-action="edit">✏️ Editar mundo</button>
        <button class="photo-menu-item is-danger" data-mc-action="delete">🗑️ Eliminar mundo</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay || e.target.closest('.photo-menu-close')) close(); });
  overlay.querySelector('[data-mc-action="cover"]')?.addEventListener('click', () => { close(); openWorldCoverPicker(world); });
  overlay.querySelector('[data-mc-action="edit"]')?.addEventListener('click', () => { close(); openWorldEditor(world); });
  overlay.querySelector('[data-mc-action="delete"]')?.addEventListener('click', () => { close(); confirmDeleteWorld(world); });
}

/** Selector de portada del mundo (desde sus fotos/vídeos, admin) */
function openWorldCoverPicker(world) {
  const items = worldItems(world.id);
  const fotos = items.filter(it => it.type === 'image');
  const covers = fotos.length
    ? fotos
    : items.filter(it => thumbOf(it)); // si no hay fotos, vídeos con póster
  if (!covers.length) {
    showToast('Este mundo aún no tiene fotos para usar de portada', 'info');
    return;
  }
  const current = worldCover(world, items);
  const modal = document.createElement('div');
  modal.className = 'photo-menu-overlay mc-editor-overlay';
  modal.innerHTML = `
    <div class="photo-menu-sheet gallery-editor mc-editor">
      <div class="mc-editor-head"><h3>Portada de «${escapeHtml(world.name)}»</h3><button class="photo-menu-close" aria-label="Cerrar">✕</button></div>
      <p class="gallery-editor-hint">Elige la foto que quieras como portada del mundo en la lista.</p>
      <div class="gallery-editor-covers mc-cover-grid">
        ${covers.map(it => {
          const t = thumbOf(it);
          return `<button class="gallery-editor-cover ${it.src === current ? 'is-active' : ''}" data-cover="${escapeHtml(it.src)}"${t ? ` style="background-image:url('${escapeHtml(t)}')"` : ''} aria-label="Usar como portada">${t ? '' : '⛏️'}</button>`;
        }).join('')}
      </div>
      <div class="mc-editor-actions">
        <button class="mc-btn" data-mc-cover-none>Quitar portada</button>
        <div style="flex:1"></div>
        <button class="mc-btn mc-btn--primary" id="mcCoverSave">Guardar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('.photo-menu-close').addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  let chosen = current;
  modal.querySelectorAll('.gallery-editor-cover').forEach(btn => {
    btn.addEventListener('click', () => {
      chosen = btn.dataset.cover;
      modal.querySelectorAll('.gallery-editor-cover').forEach(b => b.classList.toggle('is-active', b === btn));
    });
  });
  modal.querySelector('[data-mc-cover-none]').addEventListener('click', () => {
    chosen = '';
    modal.querySelectorAll('.gallery-editor-cover').forEach(b => b.classList.remove('is-active'));
  });
  modal.querySelector('#mcCoverSave').addEventListener('click', () => {
    saveWorld({ id: world.id, cover: chosen });
    close();
    render();
    bind();
    showToast(chosen ? 'Portada actualizada ✓' : 'Portada restablecida (automática)', 'success');
  });
}

// ==========================================
// SUBIDA (admin)
// ==========================================
async function handleUpload(files) {
  if (!files?.length) return;
  try {
    showToast('Subiendo archivos…', 'info');
    const urls = await db.uploadMemes(files);
    if (urls.length) {
      addItems(currentWorldId, urls);
      render();
      bind();
      showToast(`${urls.length} ${urls.length === 1 ? 'recuerdo añadido' : 'recuerdos añadidos'} ✓`, 'success');
    }
  } catch (err) {
    showToast(err?.message || 'Error al subir los archivos', 'error');
  }
}

/** Extrae URLs válidas de un texto pegado (una por línea o separadas por espacios/comas). */
function extractUrls(text) {
  const raw = (text || '').split(/[\s,;]+/).filter(Boolean);
  return [...new Set(raw.filter(u => /^https?:\/\//i.test(u)))];
}

/** Modal: añadir fotos/vídeos por enlace (URL directa, p. ej. Cloudinary). */
function openLinkModal() {
  const modal = document.createElement('div');
  modal.className = 'photo-menu-overlay mc-editor-overlay';
  modal.innerHTML = `
    <div class="photo-menu-sheet mc-editor">
      <div class="mc-editor-head">
        <h3>${UI.link} Añadir por enlace</h3>
        <button class="photo-menu-close" aria-label="Cerrar">✕</button>
      </div>
      <p class="mc-confirm-text">Pega las URLs de fotos o vídeos (una por línea). Funcionan enlaces directos, p. ej. de Cloudinary.</p>
      <label class="mc-field">
        <span>URLs</span>
        <textarea id="mcLinkInput" rows="5" placeholder="https://res.cloudinary.com/.../foto.jpg\nhttps://res.cloudinary.com/.../video.mp4" aria-label="URLs de fotos y vídeos"></textarea>
      </label>
      <div class="mc-editor-actions">
        <button class="mc-btn" data-mc-close>Cancelar</button>
        <button class="mc-btn mc-btn--primary" id="mcLinkAdd">Añadir</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('.photo-menu-close').addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  modal.querySelector('[data-mc-close]').addEventListener('click', close);
  modal.querySelector('#mcLinkAdd').addEventListener('click', () => {
    const urls = extractUrls(modal.querySelector('#mcLinkInput').value);
    if (!urls.length) { showToast('Pega al menos una URL válida (https://…)', 'error'); return; }
    addItems(currentWorldId, urls);
    close();
    render();
    bind();
    showToast(`${urls.length} ${urls.length === 1 ? 'recuerdo añadido' : 'recuerdos añadidos'} por enlace ✓`, 'success');
  });
  setTimeout(() => modal.querySelector('#mcLinkInput').focus(), 50);
}

// ==========================================
// BIND EVENTS
// ==========================================
function bind() {
  // Animación de entrada escalonada: .animate-in empieza en opacity 0
  // y necesita la clase .visible (mismo patrón que Rincon/Calendario/Juegos).
  requestAnimationFrame(() => {
    page.querySelectorAll('.mc-world-card.animate-in, .mc-item.animate-in').forEach(el => el.classList.add('visible'));
  });

  // Barra superior de secciones: Galería | Memes | Audios | Minecraft
  page.querySelectorAll('[data-subnav]').forEach(btn => {
    btn.addEventListener('click', () => {
      const sub = btn.dataset.subnav;
      const target = sub === 'galeria' ? '/galeria' : sub === 'memes' ? '/memes' : sub === 'audios' ? '/audios' : '/minecraft';
      currentRouter?.navigate(target);
    });
  });

  // Volver al Rincón (lista)
  page.querySelector('[data-mc-back]')?.addEventListener('click', () => {
    currentRouter?.navigate('/rincon');
  });

  // Volver a la lista de mundos (detalle)
  page.querySelector('[data-mc-back-world]')?.addEventListener('click', () => {
    currentWorldId = null;
    render();
    bind();
  });

  // Abrir mundo
  page.querySelectorAll('[data-mc-world]').forEach(card => {
    const open = () => {
      currentWorldId = card.dataset.mcWorld;
      render();
      bind();
    };
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });

  // Nuevo mundo
  page.querySelector('#mcAddWorldBtn')?.addEventListener('click', () => openWorldEditor(null));
  page.querySelector('#mcEmptyAddBtn')?.addEventListener('click', () => openWorldEditor(null));

  // Menú ⋮ de la tarjeta (admin): editar / eliminar sin entrar al mundo
  page.querySelectorAll('.mc-world-menu').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openWorldCardMenu(btn.dataset.menuWorld);
    });
  });

  // Detalle: subir archivos
  const fileInput = page.querySelector('#mcFileInput');
  const openUpload = () => fileInput?.click();
  page.querySelector('#mcUploadBtn')?.addEventListener('click', openUpload);
  page.querySelector('#mcUploadEmptyBtn')?.addEventListener('click', openUpload);
  if (fileInput) {
    fileInput.addEventListener('change', async () => {
      const files = [...fileInput.files];
      fileInput.value = '';
      await handleUpload(files);
    });
  }

  // Detalle: añadir por enlace
  page.querySelector('#mcLinkBtn')?.addEventListener('click', openLinkModal);
  page.querySelector('#mcLinkEmptyBtn')?.addEventListener('click', openLinkModal);

  // Detalle: portada / editar / eliminar mundo (admin)
  page.querySelector('#mcCoverBtn')?.addEventListener('click', () => openWorldCoverPicker(getWorld(currentWorldId)));
  page.querySelector('#mcEditWorldBtn')?.addEventListener('click', () => openWorldEditor(getWorld(currentWorldId)));
  page.querySelector('#mcDeleteWorldBtn')?.addEventListener('click', () => confirmDeleteWorld(getWorld(currentWorldId)));

  // Items: abrir en lightbox
  const world = getWorld(currentWorldId);
  const items = currentWorldId ? worldItems(currentWorldId) : [];
  const mediaItems = items.map(it => ({
    type: it.type,
    src: it.src,
    caption: it.caption || ''
  }));
  page.querySelectorAll('.mc-item').forEach(card => {
    const idx = Number(card.dataset.index);
    const openMedia = () => { if (mediaItems.length) openLightbox(mediaItems, idx); };
    card.querySelector('.mc-item-media')?.addEventListener('click', openMedia);
    card.querySelector('.mc-item-media')?.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openMedia(); } });
  });

  // Items: descripción individual (admin) — guarda al perder el foco / Enter
  page.querySelectorAll('.mc-item-caption').forEach(input => {
    const save = () => {
      updateItem(input.closest('.mc-item').dataset.mcItem, { caption: input.value.trim() });
    };
    input.addEventListener('change', save);
    input.addEventListener('blur', save);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
  });

  // Items: eliminar (admin)
  page.querySelectorAll('.mc-item-del').forEach(btn => {
    btn.addEventListener('click', () => {
      removeItem(btn.dataset.del);
      render();
      bind();
      showToast('Recuerdo eliminado ✓', 'success');
    });
  });
}

// ==========================================
// RENDER + INIT
// ==========================================
function render() {
  page.innerHTML = currentWorldId ? renderWorldDetail() : renderWorldsList();
}

export function MinecraftPage(router) {
  page = document.createElement('div');
  page.className = 'minecraft-page';
  currentRouter = router;
  createLightbox();

  render();
  bind();

  // Sincronización cross-device: al montar la página se hace pull/push con
  // Supabase, y los cambios que haga el admin desde otro dispositivo llegan
  // por Realtime (con polling de seguridad cada 25s). Serializamos los
  // hydrate para no pisarnos y solo re-renderizamos si algo cambió.
  let chain = Promise.resolve();
  const refresh = () => {
    chain = chain
      .then(() => hydrateMinecraft())
      .then(res => {
        if (res?.changed && page.isConnected) { render(); bind(); }
      })
      .catch(() => {});
  };
  refresh();
  const offContent = onContentChange(['minecraft'], refresh);

  const origCleanup = page.cleanup;
  page.cleanup = () => {
    if (origCleanup) origCleanup();
    offContent();
  };

  return page;
}
