/* ==========================================
   Rincón — la landing
   Cabecera, el carrusel "Descubre hoy" y las tarjetas de sección. Es la
   primera pantalla: pinta rápido y no espera a las fotos para arrancar.
   ========================================== */

import { GALLERY_FOLDERS, MEME_FOLDERS, SPB_DATA, isVideo, getVideoPoster } from '../../services/rincon-data.js';
import { db } from '../../services/db.service.js';
import { showToast } from '../../components/Toast.js';
import { escapeHtml, safeUrl } from '../../utils/escape.js';
import { startPosterRotation } from '../../utils/posterRotator.js';
import { player } from '../../services/player.service.js';
import { renderPageHeader } from '../../components/PageHeader.js';
import { ICON_SVGS } from './icons.js';
import { SECTIONS } from './sections.data.js';
import { state } from './state.js';
import { getSongCovers } from './songCovers.js';

export function createLanding(ctx) {
  const {
    page, router, isAdmin, render,
    RINCON_SECTION_ROUTES, cardRotations, stopAllRotations,
    setOffPlayerCard, getOffPlayerCard
  } = ctx;
  // El guard de una sola pasada sobre las portadas de Canciones.
  let songCoversPainted = false;

  // ==========================================
  // HELPER: generate a random "Descubre hoy" item
  // ==========================================
    function getDescubreHoy() {
      const options = [];
      // A random gallery photo
      const photos = GALLERY_FOLDERS?.['Atardeceres'] || [];
      if (photos.length) {
        options.push({
          type: 'gallery',
          title: 'Un atardecer para ti',
          desc: 'Cada atardecer guarda un momento especial.',
          cover: photos[Math.floor(Math.random() * photos.length)],
          action: 'Ver galería',
          route: null, // internal -> sub-page switch
          internal: true,
          sectionId: 'galeria-memes'
        });
      }
      // A random meme collection
      const memeFolders = Object.keys(MEME_FOLDERS || {});
      if (memeFolders.length) {
        const f = memeFolders[Math.floor(Math.random() * memeFolders.length)];
        const urls = MEME_FOLDERS[f] || [];
        const preview = urls.length ? urls[Math.floor(Math.random() * urls.length)] : '';
        options.push({
          type: 'meme',
          title: `Colección: ${f}`,
          desc: `${urls.length} memes que siempre sacan una sonrisa.`,
          cover: isVideo(preview) ? getVideoPoster(preview) : preview,
          action: 'Ver colección',
          route: null,
          internal: true,
          sectionId: 'galeria-memes'
        });
      }
      // Curiosity
      if (SPB_DATA?.quickStats?.length) {
        const s = SPB_DATA.quickStats[Math.floor(Math.random() * SPB_DATA.quickStats.length)];
        options.push({
          type: 'curiosity',
          title: s.label,
          desc: s.sub,
          icon: ICON_SVGS[s.icon] || '✦',
          action: 'Descubrir más',
          route: null,
          internal: true,
          sectionId: 'curiosidades'
        });
      }
      // External sections
      const externals = [
        { id: 'juegos', title: 'Juegos', desc: 'Snake, Buscaminas, Ahorcado… ¿cuál probarás hoy?', emoji: '🎮', route: '/juegos' },
        { id: 'canciones', title: 'Canciones', desc: 'La banda sonora de momentos inolvidables.', emoji: '🎵', route: '/canciones' },
        { id: 'thoseeyes', title: 'Those Eyes', desc: 'Una experiencia inmersiva con nuestra canción.', emoji: '👀', route: '/thoseeyes' },
        { id: 'series', title: 'Series', desc: 'Tu tracker personal de series y películas.', emoji: '🎬', route: '/series' }
      ];
      options.push(...externals.map(e => ({ ...e, type: 'external', action: 'Entrar', internal: false })));

      return options[Math.floor(Math.random() * options.length)];
    }

  // Tres sugerencias distintas por render para el carrusel manual
  // (reutiliza getDescubreHoy(); nada se persiste).
  function getDescubreHoySet() {
    const seen = new Set();
    const picks = [];
    for (let i = 0; i < 24 && picks.length < 3; i++) {
      const item = getDescubreHoy();
      if (!item || seen.has(item.title)) continue;
      seen.add(item.title);
      picks.push(item);
    }
    return picks;
  }

  function renderLanding() {
    const descubrir = getDescubreHoySet();
  
    // Pre-compute section previews
    const sectionPreviews = SECTIONS.map(s => {
      if (s.getPreview) return s.getPreview();
      return {};
    });
    if (getSongCovers().length) songCoversPainted = true;
    // Detén la rotación de portadas y la suscripción al reproductor del render anterior
    stopAllRotations();
    getOffPlayerCard()();
  
    const fotoCount = Object.values(GALLERY_FOLDERS || {}).flat().length;
    const memeCount = Object.values(MEME_FOLDERS || {}).flat().length;
  
    page.innerHTML = `
      ${renderPageHeader({ title: 'El Rincón', subtitle: `${fotoCount} recuerdos · ${memeCount} memes · y mucho más` })}
  
      <!-- ===== DESCUBRE HOY (carrusel manual, sin autoplay) ===== -->
      <section class="rincon-feature" aria-roledescription="carousel" aria-label="Descubre hoy">
        <div class="rincon-feature-slides" id="rinconCarouselView" aria-live="polite">
          ${descubrir.map((item, i) => `
            <article class="rincon-feature-slide${i === 0 ? ' is-active' : ''}${item.cover ? '' : ' is-icon'}" data-slide="${i}"${i === 0 ? '' : ' hidden'} role="button" tabindex="0" aria-label="${escapeHtml(item.title)}">
              ${renderFeaturedCard(item)}
            </article>`).join('')}
        </div>
        <button type="button" class="rincon-feature-nav" id="rinconPrev" aria-label="Ver sugerencia anterior">${ICON_SVGS['chevron-left']}</button>
        <button type="button" class="rincon-feature-nav" id="rinconNext" aria-label="Ver sugerencia siguiente">${ICON_SVGS['chevron-right']}</button>
        <div class="rincon-feature-dots" role="group" aria-label="Elegir sugerencia">
          ${descubrir.map((item, i) => `
            <button type="button" class="rincon-feature-dot${i === 0 ? ' is-active' : ''}" data-dot="${i}" aria-label="Ir a la sugerencia ${i + 1} de ${descubrir.length}: ${escapeHtml(item.title)}"${i === 0 ? ' aria-current="true"' : ''}></button>`).join('')}
        </div>
      </section>
  
      <!-- ===== TARJETAS DE SECCIÓN ===== -->
      <h2 class="section-title">Explora el Rincón
        ${isAdmin ? `<button type="button" class="link rincon-edit-toggle${state.editMode ? ' is-active' : ''}" id="rinconEditToggle" aria-pressed="${state.editMode}">${state.editMode ? '✓ Listo' : 'Editar portadas'}</button>` : ''}
      </h2>
      <section class="rincon-cards-grid">
        ${SECTIONS.map((s, i) => renderSectionCard(s, i, sectionPreviews[i])).join('')}
      </section>
    `;
  
    // Animate section cards (staggered entrance)
    requestAnimationFrame(() => {
      page.querySelectorAll('.rincon-card.animate-in').forEach(el => el.classList.add('visible'));
    });
  
    // Carrusel manual "Descubre hoy": una tarjeta visible, sin autoplay.
    const slides = [...page.querySelectorAll('#rinconCarouselView [data-slide]')];
    const dots = [...page.querySelectorAll('.rincon-feature-dot')];
    let current = 0;
    const showSlide = (i) => {
      if (!slides.length) return;
      current = (i + slides.length) % slides.length;
      slides.forEach((s, idx) => {
        const active = idx === current;
        s.classList.toggle('is-active', active);
        if (active) s.removeAttribute('hidden');
        else s.setAttribute('hidden', '');
      });
      dots.forEach((d, idx) => {
        const active = idx === current;
        d.classList.toggle('is-active', active);
        if (active) d.setAttribute('aria-current', 'true');
        else d.removeAttribute('aria-current');
      });
    };
    const openSlide = (i) => {
      const item = descubrir[i];
      if (!item) return;
      if (item.internal && item.sectionId) {
        const r = RINCON_SECTION_ROUTES[item.sectionId];
        if (r) { router.navigate(r); return; }
        state.view = item.sectionId;
        if (item.sectionId === 'curiosidades') state.curiosidadTab = 'landing';
        render();
      } else if (item.route) {
        router.navigate(item.route);
      }
    };
    page.querySelector('#rinconPrev')?.addEventListener('click', () => showSlide(current - 1));
    page.querySelector('#rinconNext')?.addEventListener('click', () => showSlide(current + 1));
    dots.forEach(d => d.addEventListener('click', () => showSlide(Number(d.dataset.dot))));
    slides.forEach((s, idx) => {
      s.addEventListener('click', () => openSlide(idx));
      s.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSlide(idx); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); showSlide(current + 1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); showSlide(current - 1); }
      });
    });
    // Gesto táctil horizontal sobre la tarjeta visible
    const carouselView = page.querySelector('#rinconCarouselView');
    if (carouselView) {
      let touchX = null;
      carouselView.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
      carouselView.addEventListener('touchend', (e) => {
        if (touchX === null) return;
        const dx = e.changedTouches[0].clientX - touchX;
        touchX = null;
        if (dx <= -40) showSlide(current + 1);
        else if (dx >= 40) showSlide(current - 1);
      }, { passive: true });
    }
  
    // Bind section card clicks (clic + teclado) y modo edición de portadas
    page.querySelectorAll('.rincon-card').forEach(card => {
      const handler = () => {
        const id = card.dataset.section;
        const section = SECTIONS.find(s => s.id === id);
        // Tarjetas extra (Seguir viendo): navegan directo a su href
        if (!section) {
          const href = card.dataset.href;
          if (href && !state.editMode) router.navigate(href);
          return;
        }
        if (state.editMode) { openCoverEditor(id); return; }
        if (section.internal) {
          const r = RINCON_SECTION_ROUTES[id];
          if (r) { router.navigate(r); return; }
          state.view = id;
          if (id === 'curiosidades') state.curiosidadTab = 'landing';
          render();
        } else if (section.href) {
          router.navigate(section.href);
        }
      };
      card.addEventListener('click', handler);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); }
      });
    });
  
    // Botón 📷 de cada tarjeta (solo en modo edición)
    page.querySelectorAll('.rincon-card-edit').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); openCoverEditor(btn.dataset.editCover); });
    });
  
    // Toggle "Editar portadas" (solo admin)
    const editToggle = page.querySelector('#rinconEditToggle');
    if (editToggle) editToggle.addEventListener('click', () => { state.editMode = !state.editMode; render(); });
  
    // ── Rotación de portadas dentro de las tarjetas (10s, fade suave) ──
    // Canciones/Series/Juegos/Curiosidades muestran portadas. Con "Seguir
    // viendo" o una canción sonando, la portada se queda en lo actual.
    const applySeriesText = (card, c) => {
      const t = card.querySelector('.rincon-card-title');
      const d = card.querySelector('.rincon-card-desc');
      if (t) t.textContent = c.item.titulo;
      if (d) d.textContent = `Ep. ${c.watched} de ${c.total} · ${c.percent}%`;
    };
    const applySongText = (card, info) => {
      const t = card.querySelector('.rincon-card-title');
      const d = card.querySelector('.rincon-card-desc');
      if (t) t.textContent = info.title || 'Canciones';
      if (d) d.textContent = info.artist || 'La banda sonora de muchos momentos juntos.';
    };
    const SONG_DESC = 'La banda sonora de muchos momentos juntos.';
  
    SECTIONS.map((s, i) => ({ section: s, preview: sectionPreviews[i] }))
      .filter(x => x.preview?.posters?.length)
      .forEach(({ section, preview }) => {
        const el = page.querySelector(`.rincon-card[data-section="${section.id}"]`);
        if (!el) return;
        const locked = preview.locked || preview.continueList?.[0] || null;
        if (preview.posters.length > 1) {
          cardRotations.set(section.id, startPosterRotation(el, preview.posters, {
            onChange: (i) => {
              if (section.id === 'series') {
                const cont = preview.continueList || [];
                const c = cont.length ? cont[i % cont.length] : null;
                if (c) applySeriesText(el, c);
              }
            }
          }));
        }
        // Estado inicial fijado: título en curso (Series) o canción sonando (Canciones)
        if (section.id === 'series' && locked) applySeriesText(el, locked);
        if (section.id === 'canciones' && locked) applySongText(el, locked);
      });
  
    // Cambios en el reproductor: si empieza/cambia una canción, la tarjeta de
    // Canciones se queda con su portada; si se cierra (info → null), vuelve a rotar.
    setOffPlayerCard(player.subscribe((e) => {
      if (e.type !== 'change') return;
      const card = page.querySelector('.rincon-card[data-section="canciones"]');
      const img = card?.querySelector('img.sr-rotating-poster');
      if (!card || !img) return;
      const cover = e.info?.cover;
      if (cover) {
        // Canción nueva: detén la rotación y quédate con su portada
        const stop = cardRotations.get('canciones');
        if (stop) { stop(); cardRotations.delete('canciones'); }
        img.style.transition = 'none';
        img.src = cover;
        applySongText(card, e.info);
        if (!card.querySelector('.rincon-card-stats')) {
          const body = card.querySelector('.rincon-card-body');
          if (body) {
            let foot = card.querySelector('.rincon-card-foot');
            if (!foot) {
              foot = document.createElement('div');
              foot.className = 'rincon-card-foot';
              body.appendChild(foot);
            }
            const chip = document.createElement('span');
            chip.className = 'rincon-card-stats';
            chip.textContent = '♪ Sonando ahora';
            foot.appendChild(chip);
          }
        }
      } else if (e.info === null) {
        // Canción cerrada: vuelve a rotar portadas al azar
        const covers = getSongCovers();
        const shuffled = [...covers].sort(() => Math.random() - 0.5);
        if (shuffled.length > 1) {
          img.style.transition = 'none';
          img.src = shuffled[0]; // muestra una portada al azar de inmediato
          cardRotations.set('canciones', startPosterRotation(card, shuffled));
        }
        const t = card.querySelector('.rincon-card-title');
        const d = card.querySelector('.rincon-card-desc');
        const st = card.querySelector('.rincon-card-stats');
        if (t) t.textContent = 'Canciones';
        if (d) d.textContent = SONG_DESC;
        if (st) st.remove();
        const foot = card.querySelector('.rincon-card-foot');
        if (foot && !foot.children.length) foot.remove();
      }
    }));
  }
  
  function renderFeaturedCard(item) {
    const cover = item.cover || '';
    const icon = item.emoji || item.icon || '✨';
    return `
      <div class="rincon-feature-media${cover ? '' : ' is-icon'}">
        ${cover
          ? `<img src="${escapeHtml(cover)}" alt="" class="rincon-feature-img" loading="eager">`
          : `<span class="rincon-feature-glyph">${icon}</span>`
        }
      </div>
      <div class="rincon-feature-shade"></div>
      <div class="rincon-feature-body">
        <span class="rincon-feature-tag">✨ Descubre hoy</span>
        <h2 class="rincon-feature-title">${escapeHtml(item.title)}</h2>
        ${item.desc ? `<p class="rincon-feature-desc">${escapeHtml(item.desc)}</p>` : ''}
        <span class="rincon-feature-action">${escapeHtml(item.action || 'Abrir')} ${ICON_SVGS['arrow-right']}</span>
      </div>
    `;
  }
  
  /** Entrada de portada normalizada: {url, fit, x, y, z}. Acepta string (legacy) u objeto. */
  function coverEntry(id) {
    const raw = state.covers[id];
    if (!raw) return null;
    if (typeof raw === 'string') return { url: raw, fit: 'cover', x: 50, y: 50, z: 1 };
    const fit = raw.fit === 'contain' ? 'contain' : 'cover';
    const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : d; };
    const nz = Number(raw.z);
    const z = Number.isFinite(nz) ? Math.min(3, Math.max(1, nz)) : 1;
    return { url: raw.url || '', fit, x: num(raw.x, 50), y: num(raw.y, 50), z };
  }
  
  function renderSectionCard(section, index, preview) {
    // La portada personalizada (subida/URL) tiene prioridad sobre la dinámica
    const entry = coverEntry(section.id);
    const cover = entry?.url || preview?.cover || '';
    const thumbs = preview?.thumbs || [];
    const stats = preview?.stats || '';
    const delay = index * 0.06;
  
    let visualHTML = '';
    if (!entry && preview?.posters?.length) {
      // Portadas rotatorias dentro de la tarjeta (Series): la primera se muestra
      // y la rotación la va cambiando; si una falla, cae al emoji de la sección.
      visualHTML = `<div class="rincon-card-img-wrap">
        <img class="sr-rotating-poster rincon-card-img" src="${safeUrl(preview.posters[0])}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <span class="rincon-card-icon-wrap" style="display:none"><span class="rincon-card-emoji">${section.emoji || '✦'}</span></span>
      </div>`;
    } else if (thumbs.length >= 4 && (section.id === 'memes' || section.previewType === 'memes')) {
      // Collage of 4 miniatures
      visualHTML = `<div class="rincon-card-collage">
        ${thumbs.map((t, i) => `
          <div class="rincon-card-collage-cell">
            <img src="${safeUrl(t.url)}" alt="" loading="lazy">
            ${t.isVideo ? `<span class="rincon-card-collage-play">${ICON_SVGS['play']}</span>` : ''}
          </div>
        `).join('')}
      </div>`;
    } else if (cover) {
      // Aplica encuadre (object-fit/object-position) y zoom (scale) solo si hay portada personalizada
      if (entry) {
        const zoomStyle = entry.z > 1 ? ` style="transform:scale(${entry.z})"` : '';
        visualHTML = `<div class="rincon-card-img-wrap">
          <div class="rincon-card-img-zoom"${zoomStyle}>
            <img src="${safeUrl(cover)}" alt="" class="rincon-card-img" loading="lazy" style="object-fit:${entry.fit};object-position:${entry.x}% ${entry.y}%;">
          </div>
        </div>`;
      } else {
        visualHTML = `<div class="rincon-card-img-wrap">
          <img src="${safeUrl(cover)}" alt="" class="rincon-card-img" loading="lazy">
        </div>`;
      }
    } else {
      visualHTML = `<div class="rincon-card-icon-wrap">
        <span class="rincon-card-emoji">${section.emoji || '✦'}</span>
      </div>`;
    }
  
    // En modo edición la tarjeta deja de ser un botón global (evita el patrón
    // botón-dentro-de-botón): el 📷 real es la única acción interactiva.
    const a11yAttrs = state.editMode ? '' : 'role="button" tabindex="0" aria-label="' + escapeHtml(section.title) + '"';
    return `
      <div class="rincon-card lift animate-in${state.editMode ? ' is-editing' : ''}" data-section="${section.id}" data-href="${section.href ? escapeHtml(section.href) : ''}" ${a11yAttrs} style="--enter-delay:${delay}s">
        ${state.editMode ? `<button type="button" class="rincon-card-edit" data-edit-cover="${section.id}" aria-label="Cambiar portada de ${escapeHtml(section.title)}" title="Cambiar portada">📷</button>` : ''}
        ${visualHTML}
        <div class="rincon-card-body">
          <div class="rincon-card-header">
            <span class="rincon-card-icon-svg">${ICON_SVGS[section.icon] || ''}</span>
            <h3 class="rincon-card-title">${escapeHtml(section.title)}</h3>
            <span class="rincon-card-chev">${ICON_SVGS['chevron-right']}</span>
          </div>
          <p class="rincon-card-desc">${escapeHtml(section.desc)}</p>
          ${stats || section.dataHint ? `<div class="rincon-card-foot">
            ${stats ? `<span class="rincon-card-stats">${escapeHtml(stats)}</span>` : ''}
            ${section.dataHint ? `<span class="rincon-card-hint">${escapeHtml(section.dataHint)}</span>` : ''}
          </div>` : ''}
        </div>
      </div>
    `;
  }
  
  // ==========================================
  // EDITOR DE PORTADAS DE TARJETAS (solo admin)
  // ==========================================
  let activeCoverOverlay = null;
  
  function openCoverEditor(sectionId) {
    const section = SECTIONS.find(s => s.id === sectionId);
    if (!section) return;
  
    // Estado pendiente (no se persiste hasta pulsar Guardar)
    const current = coverEntry(sectionId);
    const pending = {
      url: current?.url || '',
      fit: current?.fit || 'cover',   // cover = Rellenar | contain = Ajustar
      x: current?.x ?? 50,
      y: current?.y ?? 50,
      z: current?.z ?? 1              // zoom: 1 = 100%, hasta 3 = 300%
    };
    let currentSrc = ''; // vacío a propósito: fuerza el primer applyPending() a asignar el src
  
    const overlay = document.createElement('div');
    overlay.className = 'rincon-cover-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', `Portada de ${section.title}`);
    overlay.innerHTML = `
      <div class="rincon-cover-modal" role="document">
        <div class="rincon-cover-head">
          <h3 class="rincon-cover-title">Portada · ${escapeHtml(section.title)}</h3>
          <button type="button" class="rincon-cover-close" data-cc="close" aria-label="Cerrar">✕</button>
        </div>
        <div class="rincon-cover-stage" id="coverStage" role="img" aria-label="Vista previa de la portada">
          <img class="rincon-cover-stage-img" id="coverStageImg" alt="Vista previa de la portada" draggable="false" tabindex="0">
          <span class="rincon-cover-emoji" id="coverStageEmoji" aria-hidden="true">${section.emoji || '✦'}</span>
        </div>
        <div class="rincon-cover-fitseg" id="coverFitSeg" hidden>
          <button type="button" class="rincon-cover-fitseg__btn${pending.fit === 'cover' ? ' is-active' : ''}" data-fit="cover" aria-pressed="${pending.fit === 'cover'}">Rellenar</button>
          <button type="button" class="rincon-cover-fitseg__btn${pending.fit === 'contain' ? ' is-active' : ''}" data-fit="contain" aria-pressed="${pending.fit === 'contain'}">Ajustar</button>
        </div>
        <div class="rincon-cover-zoomrow" id="coverZoomRow" hidden>
          <button type="button" class="rincon-cover-zoombtn" data-zoom="-1" aria-label="Alejar" title="Alejar">−</button>
          <input type="range" class="rincon-cover-zoomrange" id="coverZoomRange" min="100" max="300" step="10" value="100" aria-label="Zoom de la imagen">
          <span class="rincon-cover-zoomval" id="coverZoomValue">100%</span>
          <button type="button" class="rincon-cover-zoombtn" data-zoom="1" aria-label="Acercar" title="Acercar">+</button>
        </div>
        <p class="rincon-cover-hint">Arrastra para encuadrar y usa el zoom para el tamaño. La portada se sincronizará también en el móvil.</p>
        <div class="rincon-cover-actions">
          <button type="button" class="rincon-cover-btn is-primary" data-cc="upload">📷 Subir foto</button>
          <button type="button" class="rincon-cover-btn" data-cc="url">🔗 Usar URL</button>
          <button type="button" class="rincon-cover-btn is-danger" data-cc="remove" id="coverRemoveBtn" hidden>🗑 Quitar</button>
        </div>
        <input type="file" class="rincon-cover-file" accept="image/*" hidden>
        <div class="rincon-cover-urlrow" hidden>
          <input type="url" class="rincon-cover-url" placeholder="https://..." aria-label="URL de la imagen">
          <button type="button" class="rincon-cover-btn is-primary" data-cc="applyurl">Aplicar</button>
        </div>
        <div class="rincon-cover-foot">
          <button type="button" class="rincon-cover-btn is-done" data-cc="close">Cancelar</button>
          <button type="button" class="rincon-cover-btn is-save" data-cc="save" id="coverSaveBtn" disabled>Guardar portada</button>
        </div>
      </div>`;
    page.appendChild(overlay);
    const show = () => overlay.classList.add('is-visible');
    requestAnimationFrame(show);
    setTimeout(show, 50); // fallback si rAF está throttled (pestaña en segundo plano)
    activeCoverOverlay = overlay;
    document.body.classList.add('sheet-locked');
  
    const fileInput = overlay.querySelector('.rincon-cover-file');
    const urlInput = overlay.querySelector('.rincon-cover-url');
    const urlRow = overlay.querySelector('.rincon-cover-urlrow');
    const stage = overlay.querySelector('#coverStage');
    const stageImg = overlay.querySelector('#coverStageImg');
    const stageEmoji = overlay.querySelector('#coverStageEmoji');
    const fitSeg = overlay.querySelector('#coverFitSeg');
    const fitBtns = overlay.querySelectorAll('.rincon-cover-fitseg__btn');
    const zoomRow = overlay.querySelector('#coverZoomRow');
    const zoomRange = overlay.querySelector('#coverZoomRange');
    const zoomValue = overlay.querySelector('#coverZoomValue');
    const zoomBtns = overlay.querySelectorAll('.rincon-cover-zoombtn');
    const removeBtn = overlay.querySelector('#coverRemoveBtn');
    const saveBtn = overlay.querySelector('#coverSaveBtn');
    const lastFocus = document.activeElement;
    let onCoverKey = null; // se declara antes para poder limpiarlo en close()
  
    // ---- Refleja el estado pendiente en la UI ----
    const applyPending = () => {
      const has = !!pending.url;
      stageImg.hidden = !has;
      stageEmoji.hidden = has;
      fitSeg.hidden = !has;
      zoomRow.hidden = !has || pending.fit !== 'cover'; // el zoom solo aplica en Rellenar
      removeBtn.hidden = !has;
      saveBtn.disabled = !has;
      if (has) {
        if (currentSrc !== pending.url) { currentSrc = pending.url; stageImg.src = pending.url; }
        stageImg.style.objectFit = pending.fit;
        stageImg.style.objectPosition = `${pending.x}% ${pending.y}%`;
        stageImg.style.transform = pending.z > 1 ? `scale(${pending.z})` : '';
        zoomRange.value = String(Math.round(pending.z * 100));
        zoomValue.textContent = `${Math.round(pending.z * 100)}%`;
      }
      fitBtns.forEach(b => {
        const on = b.dataset.fit === pending.fit;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', String(on));
      });
    };
    applyPending();
  
    // ---- Zoom: slider + botones − / + ----
    const setZoom = (z) => {
      pending.z = Math.min(3, Math.max(1, Math.round(z * 100) / 100));
      applyPending();
    };
    zoomRange.addEventListener('input', () => setZoom(Number(zoomRange.value) / 100));
    zoomBtns.forEach(b => b.addEventListener('click', () => {
      const delta = Number(b.dataset.zoom) * 0.1;
      setZoom(pending.z + delta);
    }));
  
    // Si la imagen no carga (URL rota/offline), muestra el emoji y avisa
    stageImg.addEventListener('error', () => {
      if (pending.url) {
        showToast('No se pudo cargar la imagen. Prueba con otra URL.', 'error');
        stageImg.hidden = true;
        stageEmoji.hidden = false;
      }
    });
  
    // ---- Arrastre para encuadrar (solo en modo Rellenar/cover) ----
    let drag = null;
    const clamp = (v) => Math.min(100, Math.max(0, v));
  
    const startDrag = (e) => {
      if (pending.fit !== 'cover' || !pending.url) return;
      const nw = stageImg.naturalWidth, nh = stageImg.naturalHeight;
      const rect = stage.getBoundingClientRect();
      if (!nw || !nh || !rect.width || !rect.height) return;
      const scale = Math.max(rect.width / nw, rect.height / nh);
      const dispW = nw * scale, dispH = nh * scale;
      // El zoom (scale z) amplía el desbordamiento visible: ox * z px de recorrido
      drag = {
        sx: e.clientX, sy: e.clientY,
        ox: Math.max(0, dispW - rect.width) * pending.z,
        oy: Math.max(0, dispH - rect.height) * pending.z
      };
      if (!drag.ox && !drag.oy) { drag = null; return; }
      stage.classList.add('is-dragging');
      try { stageImg.setPointerCapture(e.pointerId); } catch { /* eventos sintéticos o sin pointer activo */ }
      e.preventDefault();
    };
    const onDrag = (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.sx;
      const dy = e.clientY - drag.sy;
      if (drag.ox) pending.x = clamp(pending.x - (dx / drag.ox) * 100);
      if (drag.oy) pending.y = clamp(pending.y - (dy / drag.oy) * 100);
      stageImg.style.objectPosition = `${pending.x}% ${pending.y}%`;
      e.preventDefault();
    };
    const endDrag = () => {
      if (!drag) return;
      drag = null;
      stage.classList.remove('is-dragging');
    };
    stageImg.addEventListener('pointerdown', startDrag);
    stageImg.addEventListener('pointermove', onDrag);
    stageImg.addEventListener('pointerup', endDrag);
    stageImg.addEventListener('pointercancel', endDrag);
  
    // ---- Teclado: flechas para encuadrar con precisión ----
    stageImg.addEventListener('keydown', (e) => {
      if (pending.fit !== 'cover' || !pending.url) return;
      // El step es %; con zoom el rango crece, así que lo escalamos para que el nudge sea constante en px
      const STEP = (e.shiftKey ? 10 : 2) / pending.z;
      let nx = pending.x, ny = pending.y;
      if (e.key === 'ArrowLeft') nx = clamp(nx - STEP);
      else if (e.key === 'ArrowRight') nx = clamp(nx + STEP);
      else if (e.key === 'ArrowUp') ny = clamp(ny - STEP);
      else if (e.key === 'ArrowDown') ny = clamp(ny + STEP);
      else return;
      e.preventDefault();
      pending.x = nx; pending.y = ny;
      stageImg.style.objectPosition = `${nx}% ${ny}%`;
    });
  
    const close = () => {
      overlay.classList.remove('is-visible');
      document.body.classList.remove('sheet-locked');
      if (onCoverKey) { document.removeEventListener('keydown', onCoverKey); onCoverKey = null; }
      if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
      setTimeout(() => {
        overlay.remove();
        if (activeCoverOverlay === overlay) activeCoverOverlay = null;
      }, 260);
    };
    const busy = (b) => overlay.querySelectorAll('.rincon-cover-btn').forEach(bn => { bn.disabled = b; });
  
    // Escape cierra el editor
    onCoverKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
    };
    document.addEventListener('keydown', onCoverKey);
    setTimeout(() => overlay.querySelector('.rincon-cover-close')?.focus(), 60);
  
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) { close(); return; }
      const btn = e.target.closest('[data-cc]');
      if (!btn) return;
      const act = btn.dataset.cc;
      if (act === 'close') { close(); return; }
      if (act === 'upload') { fileInput.click(); return; }
      if (act === 'url') { urlRow.hidden = false; urlInput.focus(); return; }
      if (act === 'applyurl') { applyUrl(); return; }
      if (act === 'remove') { commitRemove(); return; }
      if (act === 'save') { commitSave(); return; }
    });
  
    // Cambio de modo Rellenar / Ajustar
    fitBtns.forEach(b => b.addEventListener('click', () => {
      pending.fit = b.dataset.fit;
      if (pending.fit === 'contain') { pending.x = 50; pending.y = 50; pending.z = 1; } // centra y deshace zoom al ajustar
      applyPending();
    }));
  
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) { fileInput.value = ''; return; }
      busy(true);
      try {
        const urls = await db.uploadGalleryPhotos([file]);
        const url = urls?.[0];
        if (!url) throw new Error('No se pudo subir la imagen');
        pending.url = url;
        pending.x = 50; pending.y = 50; pending.fit = 'cover'; pending.z = 1;
        applyPending();
      } catch (err) {
        showToast(err?.message || 'Error al subir la imagen. Prueba con una URL.', 'error');
      } finally {
        fileInput.value = '';
        busy(false);
      }
    });
  
    async function applyUrl() {
      const url = urlInput.value.trim();
      if (!url) { showToast('Escribe una URL de imagen', 'info'); return; }
      busy(true);
      try {
        pending.url = url;
        pending.x = 50; pending.y = 50; pending.fit = 'cover'; pending.z = 1;
        applyPending();
      } finally { busy(false); }
    }
  
    async function commitRemove() {
      busy(true);
      try {
        const covers = { ...state.covers };
        delete covers[sectionId];
        await db.saveRinconCovers(covers);
        state.covers = covers;
        close();
        if (state.view === 'landing') render();
        showToast('Portada restaurada', 'success');
      } catch (err) {
        showToast(err?.message || 'Error al quitar la portada', 'error');
      } finally { busy(false); }
    }
  
    async function commitSave() {
      if (!pending.url) return;
      busy(true);
      try {
        const covers = { ...state.covers };
        covers[sectionId] = {
          url: pending.url,
          fit: pending.fit,
          x: Math.round(pending.x),
          y: Math.round(pending.y),
          z: Math.round(pending.z * 100) / 100
        };
        await db.saveRinconCovers(covers);
        state.covers = covers;
        close();
        if (state.view === 'landing') render();
        showToast('Portada actualizada ✓', 'success');
      } catch (err) {
        showToast(err?.message || 'Error al guardar la portada', 'error');
      } finally { busy(false); }
    }
  }
  
  // ==========================================
  // 2. GALERÍA + MEMES (PRESERVED)
  // ==========================================

  return { renderLanding };
}
