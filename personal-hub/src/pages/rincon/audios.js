/* ==========================================
   Rincón — Audios (la cápsula del día 3)
   Lista por meses, detalle de un mes, subida y reproducción con un solo
   reproductor. Es una vista más del Rincón: recibe el contexto compartido y
   no pinta fuera de su propio contenedor.
   ========================================== */

import { db } from '../../services/db.service.js';
import { showToast } from '../../components/Toast.js';
import { escapeHtml } from '../../utils/escape.js';
import { todayISO } from '../../utils/format.js';
import { userStore } from '../../stores/user.store.js';
import { ICON_SVGS } from './icons.js';
import { state } from './state.js';
import { MONTHS as AUDIO_MONTHS } from './curiosities.data.js';

export async function loadAudios(force = false) {
  if (state.audiosLoaded && !force) return state.audios;
  state.audiosLoaded = true;
  try {
    const list = await db.getAudios();
    state.audios = Array.isArray(list) ? list : [];
  } catch (err) {
    console.warn('[rincon] No se pudieron cargar los audios:', err?.message);
    state.audios = [];
  }
  return state.audios;
}

export function createAudiosView(ctx) {
  const { page, isAdmin, render } = ctx;

  /** Audios agrupados por mes: { '2026-8': [audios...] } */
  function audiosByMonth() {
    const map = {};
    (state.audios || []).forEach(a => {
      const y = a.year || (a.date ? parseInt(String(a.date).slice(0, 4), 10) : 0);
      const m = a.month || (a.date ? parseInt(String(a.date).slice(5, 7), 10) : 0);
      if (!y || !m) return;
      const key = `${y}-${m}`;
      if (!map[key]) map[key] = [];
      map[key].push(a);
    });
    return map;
  }
  
  /**
   * Meses que muestra el archivo para cada año:
   * - 2025: solo septiembre (primer audio del día 3)
   * - 2026: de junio a diciembre
   * - 2027 en adelante: el año completo
   * Si existe un audio en un mes fuera de esta lista, ese mes también se muestra
   * (nunca se oculta contenido real).
   */
  function audioYearMonths(year) {
    if (year === 2025) return [9];
    if (year === 2026) return [6, 7, 8, 9, 10, 11, 12];
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  }
  
  /**
   * Rango de años a mostrar: desde el inicio del archivo (2025) hasta el año
   * actual. Los meses futuros salen como bloqueados.
   */
  function audioMonthRange() {
    // "Hasta hoy" en España: los meses futuros se bloquean igual que en
    // el calendario, que también cuenta el día en Europe/Madrid.
    const iso = todayISO();
    const curYear = Number(iso.slice(0, 4));
    const curMonth = Number(iso.slice(5, 7));
    const map = audiosByMonth();
  
    let minYear = 2025;
    let maxYear = curYear;
    Object.keys(map).forEach(k => {
      const [y] = k.split('-').map(Number);
      if (y < minYear) minYear = y;
      if (y > maxYear) maxYear = y;
    });
  
    // Por año: meses por defecto del archivo + meses con audio (unión).
    const yearMonths = {};
    for (let y = minYear; y <= maxYear; y++) {
      const months = new Set(audioYearMonths(y));
      Object.keys(map).forEach(k => {
        const [ky, km] = k.split('-').map(Number);
        if (ky === y) months.add(km);
      });
      yearMonths[y] = [...months].sort((a, b) => a - b);
    }
  
    const years = [];
    for (let y = minYear; y <= maxYear; y++) years.push(y);
    return { years: years.reverse(), yearMonths, curYear, curMonth };
  }
  
  /** Estado de un mes: 'available' | 'future' | 'empty' */
  function audioMonthState(year, month, curYear, curMonth, has) {
    if (has) return 'available';
    if (year > curYear || (year === curYear && month > curMonth)) return 'future';
    return 'empty';
  }
  
  /** HTML de la pestaña Audios (vista de meses). Vive dentro de #galeriaMemesContent. */
  function renderAudiosTabContent() {
    if (state.audiosView === 'detail' && state.audiosMonth) {
      return renderAudioDetailContent(state.audiosMonth.year, state.audiosMonth.month);
    }
  
    const { years, yearMonths, curYear, curMonth } = audioMonthRange();
    const map = audiosByMonth();
    const total = state.audios.length;
  
    // Un bloque por año, con sus meses en estado (disponible / vacío / futuro)
    const yearBlocks = years.map(y => {
      const months = (yearMonths[y] || []).map(m => {
        const name = AUDIO_MONTHS[m - 1] || 'Mes';
        const list = map[`${y}-${m}`] || [];
        const st = audioMonthState(y, m, curYear, curMonth, list.length > 0);
        return renderAudioMonthCard(y, m, name, st, list);
      }).join('');
      return `
        <section class="audios-year" aria-label="${y}">
          <h3 class="audios-year-title">${y}</h3>
          <div class="audios-month-grid">${months}</div>
        </section>
      `;
    }).join('');
  
    // Selector de mes para subir (solo admin): los meses del archivo hasta el mes
    // actual. El mes actual aparece primero y preseleccionado; el resto, del más
    // reciente al más antiguo (los meses futuros aún no se pueden subir).
    const uploadMonths = [];
    Object.entries(yearMonths).forEach(([key, months]) => {
      const y = Number(key); // las claves del objeto son strings; curYear/curMonth son números
      (months || []).forEach(m => {
        if (y < curYear || (y === curYear && m <= curMonth)) uploadMonths.push({ y, m });
      });
    });
    uploadMonths.sort((a, b) => b.y - a.y || b.m - a.m); // más reciente primero
    const curIdx = uploadMonths.findIndex(({ y, m }) => y === curYear && m === curMonth);
    if (curIdx > 0) {
      const [cur] = uploadMonths.splice(curIdx, 1);
      uploadMonths.unshift(cur);
    }
    const uploadOptions = uploadMonths.map(({ y, m }) => {
      const selected = (y === curYear && m === curMonth) ? ' selected' : '';
      return `<option value="${y}-${m}"${selected}>${AUDIO_MONTHS[m - 1]} ${y}</option>`;
    });
  
    return `
      <div class="audios-page">
        ${total > 0 ? `<h2 class="section-title">Nuestra cápsula
          <span class="text-3" style="text-transform:none;letter-spacing:0">${total} audio${total === 1 ? '' : 's'}</span>
        </h2>` : ''}
  
        ${yearBlocks || '<div class="audios-empty"><p>Aquí guardaremos los audios que grabemos juntos cada día 3.</p></div>'}
  
        ${isAdmin ? `
          <div class="audios-upload">
            <div class="audios-upload-head">
              <button type="button" class="btn btn--sm" id="audiosUploadBtn">＋ Subir audio</button>
              <label class="audios-upload-month">
                Mes
                <select class="input" id="audiosUploadMonth">${uploadOptions.join('')}</select>
              </label>
            </div>
            <p class="audios-upload-hint">Sube el audio grabado el día 3. Puedes añadir varios audios al mismo mes (voz de Darwin, voz de ella…). Se guarda en la web para todos.</p>
            <input type="file" id="audiosFileInput" accept="audio/*" multiple hidden>
            <div id="audiosUploadStatus" class="audios-upload-status" aria-live="polite"></div>
          </div>
        ` : ''}
      </div>
    `;
  }
  
  function renderAudioMonthCard(y, m, name, st, list) {
    if (st === 'available') {
      const count = list.length;
      const first = list[0];
      return `
        <button class="audios-month audios-month--available" data-audio-month="${y}-${m}" aria-label="Escuchar audio de ${name} ${y}">
          <span class="audios-month-icon">${ICON_SVGS['mic']}</span>
          <span class="audios-month-name">${name} ${y}</span>
          <span class="audios-month-meta">${count === 1 ? '🎙️ Audio del día 3' : `${count} audios del día 3`}</span>
          <span class="audios-month-action">${ICON_SVGS['play']} Escuchar</span>
        </button>
      `;
    }
    if (st === 'future') {
      return `
        <div class="audios-month audios-month--future" aria-label="${name} ${y} · futuro">
          <span class="audios-month-icon">${ICON_SVGS['lock']}</span>
          <span class="audios-month-name">${name} ${y}</span>
          <span class="audios-month-meta">Disponible el día 3</span>
        </div>
      `;
    }
    return `
      <div class="audios-month audios-month--empty" aria-label="${name} ${y} · sin audio">
        <span class="audios-month-icon">—</span>
        <span class="audios-month-name">${name} ${y}</span>
        <span class="audios-month-meta">Sin audio</span>
      </div>
    `;
  }
  
  /** HTML del detalle de un mes (reproductores). Vive dentro de #galeriaMemesContent. */
  function renderAudioDetailContent(year, month) {
    const map = audiosByMonth();
    const list = map[`${year}-${month}`] || [];
    const name = AUDIO_MONTHS[month - 1] || 'Mes';
  
    const audioCards = list.map((a, i) => {
      const dateLabel = a.date ? formatAudioDate(a.date) : `${name} ${year}`;
      const title = a.title || (list.length > 1 ? `Audio ${i + 1}` : `Audio del ${dateLabel}`);
      const creator = a.creator ? `<span class="audios-player-creator">${ICON_SVGS['mic']} ${escapeHtml(a.creator)}</span>` : '';
      const editBtn = userStore.isAdmin
        ? `<button type="button" class="audios-edit-btn" data-audios-edit="${escapeHtml(a.id)}" aria-label="Editar nombre y fecha" title="Editar nombre y fecha">✏️</button>`
        : '';
      return `
        <article class="audios-player-card" data-audio-url="${escapeHtml(a.url || '')}" data-audio-title="${escapeHtml(title)}" data-audio-id="${escapeHtml(a.id)}">
          <div class="audios-player-head">
            <div class="audios-player-icon">${ICON_SVGS['mic']}</div>
            <div class="audios-player-info">
              <h4 class="audios-player-title">${escapeHtml(title)}</h4>
              <p class="audios-player-date">${dateLabel}${creator ? ' · ' + creator : ''}</p>
            </div>
            ${editBtn}
          </div>
          <audio preload="metadata" src="${escapeHtml(a.url || '')}"></audio>
          <div class="audios-player-controls">
            <button class="audios-play-btn" aria-label="Reproducir ${escapeHtml(title)}">${ICON_SVGS['play']}</button>
            <div class="audios-progress">
              <input type="range" class="audios-progress-bar" min="0" max="100" value="0" step="0.1" aria-label="Progreso">
              <div class="audios-time"><span class="audios-time-cur">0:00</span><span class="audios-time-dur">0:00</span></div>
            </div>
          </div>
        </article>
      `;
    }).join('');
  
    return `
      <div class="audios-page">
        <button class="btn-soft btn--sm audios-back" data-back="months">${ICON_SVGS['chevron-left']} Todos los meses</button>
        <h2 class="section-title">${name} ${year}
          <span class="text-3" style="text-transform:none;letter-spacing:0">${list.length === 1 ? escapeHtml(list[0].date ? formatAudioDate(list[0].date) : '3 de ' + name) : `${list.length} audios`}</span>
        </h2>
        <div class="audios-list">
          ${list.length ? audioCards : `<div class="audios-error"><p>Este mes no tiene audio guardado.</p></div>`}
        </div>
      </div>
      ${userStore.isAdmin ? `
      <div class="audios-edit-overlay" id="audiosEditOverlay" hidden role="dialog" aria-modal="true" aria-label="Editar audio">
        <div class="audios-edit-modal">
          <div class="audios-edit-head">
            <h3>Editar audio</h3>
            <button type="button" class="audios-edit-close" data-audios-edit-close aria-label="Cerrar">✕</button>
          </div>
          <label class="audios-edit-field">
            <span>Nombre</span>
            <input type="text" id="audiosEditName" maxlength="120" placeholder="Nombre del audio">
          </label>
          <label class="audios-edit-field">
            <span>Fecha</span>
            <input type="date" id="audiosEditDate">
          </label>
          <div class="audios-edit-actions">
            <button type="button" class="audios-edit-btn-ghost" data-audios-edit-close>Cancelar</button>
            <button type="button" class="audios-edit-btn-primary" data-audios-edit-save>Guardar</button>
          </div>
        </div>
      </div>` : ''}
    `;
  }
  
  /** Conecta los eventos de la pestaña Audios: meses, detalle, reproductores y subida. */
  function bindAudiosEvents(container) {
    if (!container) return;
    bindAudioPlayers(container);
  
    // Volver de detalle → meses
    container.querySelector('[data-back="months"]')?.addEventListener('click', () => {
      state.audiosView = 'months';
      state.audiosMonth = null;
      container.innerHTML = renderAudiosTabContent();
      bindAudiosEvents(container);
    });
  
    // Abrir el detalle de un mes con audio disponible
    container.querySelectorAll('[data-audio-month]').forEach(btn => {
      btn.addEventListener('click', () => {
        const [y, m] = btn.dataset.audioMonth.split('-').map(Number);
        if (!y || !m) return;
        state.audiosView = 'detail';
        state.audiosMonth = { year: y, month: m };
        container.innerHTML = renderAudiosTabContent();
        bindAudiosEvents(container);
      });
    });
  
    // Subida de audio (solo admin): Supabase Storage + guardado global para todos
    const uploadBtn = container.querySelector('#audiosUploadBtn');
    const fileInput = container.querySelector('#audiosFileInput');
    const monthSel = container.querySelector('#audiosUploadMonth');
    const statusEl = container.querySelector('#audiosUploadStatus');
    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', async () => {
        const files = [...fileInput.files];
        fileInput.value = '';
        if (!files.length) return;
        const [selYear, selMonth] = (monthSel?.value || '').split('-').map(Number);
        const y = selYear || new Date().getFullYear();
        const m = selMonth || new Date().getMonth() + 1;
        const date = `${y}-${String(m).padStart(2, '0')}-03`;
  
        if (statusEl) {
          statusEl.textContent = 'Subiendo… 0/' + files.length;
          statusEl.classList.add('is-active');
        }
        const uploaded = [];
        const errors = [];
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          try {
            if (statusEl) statusEl.textContent = `Subiendo… ${i + 1}/${files.length}`;
            const [url] = await db.uploadAudios([file]);
            if (!url) throw new Error('No se obtuvo la URL del audio');
            uploaded.push({
              id: db.generateId(),
              date,
              year: y,
              month: m,
              title: file.name.replace(/\.[^.]+$/, '') || 'Audio del día 3',
              url,
              creator: '',
              createdAt: new Date().toISOString()
            });
          } catch (err) {
            errors.push(file.name + ': ' + (err?.message || 'Error'));
          }
        }
  
        if (uploaded.length) {
          try {
            const next = [...state.audios, ...uploaded];
            await db.saveAudios(next);
            state.audios = next;
            if (statusEl) statusEl.textContent = `✓ ${uploaded.length} audio${uploaded.length === 1 ? '' : 's'} guardado${uploaded.length === 1 ? '' : 's'} en la web`;
            showToast(`${uploaded.length} ${uploaded.length === 1 ? 'audio subido' : 'audios subidos'} ✓`, 'success');
            container.innerHTML = renderAudiosTabContent();
            bindAudiosEvents(container);
          } catch (err) {
            if (statusEl) statusEl.textContent = '⚠ ' + (err?.message || 'No se pudo guardar');
          }
        }
        if (errors.length && statusEl) {
          statusEl.textContent = (statusEl.textContent ? statusEl.textContent + ' · ' : '') + '⚠ ' + errors[0];
        }
      });
    }
  
    // Edición de audio (solo admin): nombre y fecha
    const editOverlay = container.querySelector('#audiosEditOverlay');
    if (editOverlay) {
      const editNameEl = container.querySelector('#audiosEditName');
      const editDateEl = container.querySelector('#audiosEditDate');
      const openEdit = (id) => {
        const audio = (state.audios || []).find(a => a.id === id);
        if (!audio) return;
        state.audiosEditId = id;
        editNameEl.value = audio.title || '';
        editDateEl.value = (audio.date || `${audio.year || new Date().getFullYear()}-${String(audio.month || 1).padStart(2, '0')}-03`).slice(0, 10);
        editOverlay.hidden = false;
        editNameEl.focus();
      };
      const closeEdit = () => { editOverlay.hidden = true; state.audiosEditId = null; };
      container.querySelectorAll('[data-audios-edit]').forEach(btn => {
        btn.addEventListener('click', () => openEdit(btn.dataset.audiosEdit));
      });
      editOverlay.querySelectorAll('[data-audios-edit-close]').forEach(b => b.addEventListener('click', closeEdit));
      editOverlay.addEventListener('click', (e) => { if (e.target === editOverlay) closeEdit(); });
      editOverlay.querySelector('[data-audios-edit-save]').addEventListener('click', async () => {
        const id = state.audiosEditId;
        if (!id) return;
        const title = (editNameEl.value || '').trim();
        if (!title) { showToast('Escribe un nombre para el audio', 'error'); editNameEl.focus(); return; }
        const date = (editDateEl.value || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { showToast('Elige una fecha válida', 'error'); return; }
        const [y, m] = date.split('-').map(Number);
        const next = (state.audios || []).map(a => a.id === id ? { ...a, title, date, year: y, month: m } : a);
        try {
          await db.saveAudios(next);
          state.audios = next;
          closeEdit();
          showToast('Audio actualizado ✓', 'success');
          state.audiosView = 'detail';
          state.audiosMonth = { year: y, month: m };
          container.innerHTML = renderAudiosTabContent();
          bindAudiosEvents(container);
        } catch (err) {
          showToast(err?.message || 'No se pudo guardar', 'error');
        }
      });
    }
  }
  
  /** Da formato legible a una fecha ISO (2026-08-03 → 3 de agosto de 2026). */
  function formatAudioDate(iso) {
    if (!iso) return '';
    const parts = String(iso).split('-').map(Number);
    if (parts.length < 3 || parts.some(isNaN)) return iso;
    return `${parts[2]} de ${(AUDIO_MONTHS[parts[1] - 1] || '').toLowerCase()} de ${parts[0]}`;
  }
  
  /** Conecta play/pause, progreso, duración y errores de cada tarjeta de audio. */
  function bindAudioPlayers(container) {
    const cards = (container || page).querySelectorAll('.audios-player-card');
    cards.forEach(card => {
      const audio = card.querySelector('audio');
      const playBtn = card.querySelector('.audios-play-btn');
      const bar = card.querySelector('.audios-progress-bar');
      const curEl = card.querySelector('.audios-time-cur');
      const durEl = card.querySelector('.audios-time-dur');
      if (!audio) return;
  
      const fmt = (s) => {
        if (!isFinite(s) || s < 0) return '0:00';
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${String(sec).padStart(2, '0')}`;
      };
  
      // Solo un audio sonando a la vez
      const pauseOthers = (except) => {
        (container || page).querySelectorAll('.audios-player-card audio').forEach(a => {
          if (a !== except) a.pause();
        });
        (container || page).querySelectorAll('.audios-play-btn').forEach(b => {
          if (b !== playBtn) {
            b.innerHTML = ICON_SVGS['play'];
            b.classList.remove('is-playing');
          }
        });
      };
  
      const setPlayingUI = (playing) => {
        playBtn.innerHTML = playing ? ICON_SVGS['pause'] : ICON_SVGS['play'];
        playBtn.classList.toggle('is-playing', playing);
        card.classList.toggle('is-playing', playing);
      };
  
      const onError = () => {
        // El audio falló: muestra el estado de error en la tarjeta
        const err = card.querySelector('.audios-player-error');
        const controls = card.querySelector('.audios-player-controls');
        if (err) return;
        setPlayingUI(false);
        if (controls) {
          const div = document.createElement('div');
          div.className = 'audios-player-error';
          div.innerHTML = '<p>Este audio no está disponible ahora mismo.</p>';
          const retry = document.createElement('button');
          retry.className = 'audios-retry-btn';
          retry.textContent = 'Reintentar';
          retry.addEventListener('click', () => {
            div.remove();
            audio.load();
            audio.play().catch(() => {});
          });
          div.appendChild(retry);
          card.appendChild(div);
        }
      };
  
      playBtn.addEventListener('click', () => {
        if (audio.paused) {
          pauseOthers(audio);
          audio.play().then(() => setPlayingUI(true)).catch(onError);
        } else {
          audio.pause();
          setPlayingUI(false);
        }
      });
  
      audio.addEventListener('play', () => { setPlayingUI(true); });
      audio.addEventListener('pause', () => { setPlayingUI(false); });
      audio.addEventListener('ended', () => {
        setPlayingUI(false);
        audio.currentTime = 0;
        bar.value = 0;
        curEl.textContent = '0:00';
      });
      audio.addEventListener('error', onError);
  
      if (audio.readyState >= 1) {
        durEl.textContent = fmt(audio.duration);
      } else {
        audio.addEventListener('loadedmetadata', () => {
          durEl.textContent = fmt(audio.duration);
          audio.dataset.duration = String(audio.duration);
        });
      }
  
      audio.addEventListener('timeupdate', () => {
        const d = audio.duration;
        curEl.textContent = fmt(audio.currentTime);
        if (isFinite(d) && d > 0) bar.value = (audio.currentTime / d) * 100;
      });
  
      bar.addEventListener('input', () => {
        const d = audio.duration;
        if (isFinite(d) && d > 0) {
          audio.currentTime = (parseFloat(bar.value) / 100) * d;
        }
      });
  
      // Inicia la carga de metadatos desde ya para conocer la duración
      audio.load();
    });
  }

  return {
    renderAudiosTabContent,
    bindAudiosEvents
  };
}
