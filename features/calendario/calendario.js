// js/pages/calendario.js
// Orquestador del calendario - Con lazy loading y optimización

import { loadGiftsCatalog } from './giftLoader.js';
import { loadGiftProgress, markGiftOpened, getProgressMap } from './giftProgress.js';
import { getDayState } from './unlockEngine.js';
import { renderGiftExperience } from './renderer.js';
import { openExperienceModal, closeExperienceModal } from '../../shared/dialogs/modalSystem.js';
import { renderCalendarGrid } from './calendarGrid.js';

// Configuración
const UNLOCK_CHECK_MS = 60000;
const BATCH_SIZE = 8; // Renderizar en lotes de 8 para no bloquear UI

let catalog = null;
let currentMonth = null;
let currentMonthData = null;
let currentMonthKey = null;
let unlockCheckInterval = null;
let isRendering = false;
let renderQueue = [];

// --- Helpers UI ---
function showToast(message, isError = false) {
    if (typeof window.showToast === 'function') {
        window.showToast(message, isError);
        return;
    }
    let toast = document.querySelector('.toast-message');
    if (toast) toast.remove();
    toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;
    if (isError) toast.style.borderLeftColor = '#dc3545';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// --- Obtener días del mes ---
function getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
}

function getDaysInMonthFromKey(monthKey) {
    const parts = monthKey.split('-');
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    return getDaysInMonth(year, month);
}

// --- Obtener meses disponibles ---
function getAvailableMonths() {
    if (!catalog || !catalog.months) {
        console.warn('⚠️ No hay meses disponibles');
        return [];
    }
    return Object.keys(catalog.months).sort();
}

// --- Cambiar de mes ---
function switchMonth(monthKey) {
    if (!catalog || !catalog.months || !catalog.months[monthKey]) {
        console.error('❌ Mes no encontrado:', monthKey);
        return;
    }
    currentMonthKey = monthKey;
    currentMonthData = catalog.months[monthKey];
    
    const totalDays = getDaysInMonthFromKey(monthKey);
    
    const titleEl = document.getElementById('monthTitle');
    if (titleEl) {
        titleEl.textContent = currentMonthData.label || monthKey;
    }
    
    paintGrid(totalDays);
    renderMonthSelector();
}

// --- Renderizar selector de meses ---
function renderMonthSelector() {
    const container = document.getElementById('monthSelector');
    if (!container) return;
    
    const months = getAvailableMonths();
    if (months.length <= 1) {
        container.style.display = 'none';
        return;
    }
    
    container.style.display = 'flex';
    container.innerHTML = months.map(month => {
        const label = catalog.months[month].label || month;
        return `
            <button class="month-btn ${month === currentMonthKey ? 'active' : ''}" 
                    data-month="${month}" 
                    type="button">
                ${label}
            </button>
        `;
    }).join('');
    
    container.querySelectorAll('.month-btn').forEach(btn => {
        btn.addEventListener('click', () => switchMonth(btn.dataset.month));
    });
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// --- Lógica del Calendario ---
function buildUnlockContext() {
    return {
        progressMap: getProgressMap(),
        giftById: catalog?.giftsById || {},
        manualUnlocks: new Set()
    };
}

function buildDayMeta(totalDays) {
    const progressMap = getProgressMap();
    const ctx = buildUnlockContext();
    const dayMeta = {};
    const mapping = currentMonthData?.calendarMapping || {};

    for (let day = 1; day <= totalDays; day++) {
        const dayStr = String(day);
        const giftId = mapping[dayStr];
        const gift = catalog.giftsById[giftId];
        
        let state = 'locked';
        if (gift) {
            state = getDayState(day, { 
                gift, 
                progress: progressMap, 
                unlockContext: { ...ctx, giftId } 
            });
        }
        
        dayMeta[dayStr] = {
            state,
            giftId,
            title: gift?.title || '',
            unlockDate: gift?.unlock?.value || '',
            type: gift?.type || ''
        };
    }
    return dayMeta;
}

// ==========================================
// RENDER CON LAZY LOADING (BATCHES)
// ==========================================
function paintGrid(totalDays) {
    const grid = document.getElementById('calendarGrid');
    if (!grid || !catalog || !currentMonthData) {
        console.warn('⚠️ No se puede pintar el grid: falta catálogo o mes');
        return;
    }

    if (!totalDays) {
        totalDays = getDaysInMonthFromKey(currentMonthKey);
    }

    window.__giftCatalog = catalog.giftsById;

    const dayMeta = buildDayMeta(totalDays);
    
    // Renderizar en lotes para no bloquear la UI
    renderInBatches({
        container: grid,
        calendarMapping: currentMonthData.calendarMapping || {},
        dayMeta: dayMeta,
        visibleDays: totalDays,
        onDayClick: handleDayClick
    });
}

function renderInBatches(config) {
    const { container, calendarMapping, dayMeta, visibleDays, onDayClick } = config;
    
    // Si ya se está renderizando, cancelar la cola anterior
    if (isRendering) {
        renderQueue = [];
    }
    
    isRendering = true;
    container.innerHTML = '';
    
    // Crear un array con todos los días a renderizar
    const days = [];
    for (let day = 1; day <= visibleDays; day++) {
        days.push(day);
    }
    
    let currentBatch = 0;
    const totalBatches = Math.ceil(days.length / BATCH_SIZE);
    
    function renderNextBatch() {
        if (renderQueue.length === 0 && currentBatch >= totalBatches) {
            isRendering = false;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }
        
        // Si hay una nueva solicitud de renderizado, detener y reiniciar
        if (renderQueue.length > 0) {
            const newConfig = renderQueue.pop();
            // Limpiar y comenzar de nuevo
            container.innerHTML = '';
            currentBatch = 0;
            // Recursivamente llamar con la nueva configuración
            setTimeout(() => renderInBatches(newConfig), 50);
            return;
        }
        
        const start = currentBatch * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, days.length);
        const batchDays = days.slice(start, end);
        
        // Renderizar este lote
        for (const day of batchDays) {
            const dayStr = String(day);
            const meta = dayMeta[dayStr] || { state: 'locked', giftId: null, title: '', unlockDate: '', type: '' };
            const hasGift = calendarMapping && calendarMapping[dayStr] !== undefined;
            const isOpened = meta.state === 'opened';
            const isAvailable = meta.state === 'available';
            const isLocked = meta.state === 'locked' || !hasGift;
            
            // Crear la tarjeta (misma lógica que antes pero sin el loop completo)
            const card = createDayCard({
                day,
                meta,
                hasGift,
                isOpened,
                isAvailable,
                isLocked,
                onDayClick
            });
            container.appendChild(card);
        }
        
        currentBatch++;
        
        // Programar el siguiente lote con un pequeño delay para no bloquear UI
        if (currentBatch < totalBatches) {
            setTimeout(renderNextBatch, 30);
        } else {
            isRendering = false;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }
    
    // Iniciar el renderizado por lotes
    setTimeout(renderNextBatch, 20);
}

// ==========================================
// CREAR TARJETA INDIVIDUAL (extraída para reutilización)
// ==========================================
function createDayCard({ day, meta, hasGift, isOpened, isAvailable, isLocked, onDayClick }) {
    const giftType = meta.type || '';
    const giftTitle = meta.title || '';
    
    let typeIcon = '✨';
    let typeLabel = 'Sorpresa';
    
    switch(giftType) {
        case 'letter': typeIcon = '✉️'; typeLabel = 'Carta'; break;
        case 'cassette': typeIcon = '🎵'; typeLabel = 'Música'; break;
        case 'giftBox': typeIcon = '🎁'; typeLabel = 'Regalo'; break;
        case 'polaroid': typeIcon = '📷'; typeLabel = 'Recuerdo'; break;
        case 'clickStar': case 'game': typeIcon = '🎮'; typeLabel = 'Juego'; break;
        default: typeIcon = '✨'; typeLabel = 'Sorpresa';
    }

    const card = document.createElement('button');
    card.className = `day-card ${isOpened ? 'opened' : ''} ${isLocked ? 'locked' : ''} ${isAvailable ? 'available' : ''}`;
    card.dataset.day = day;
    card.dataset.giftId = meta.giftId || '';
    card.disabled = isLocked;

    // Estilos inline según estado
    if (isAvailable) {
        card.style.background = 'radial-gradient(circle at top right, rgba(76, 175, 80, 0.25), transparent 60%), rgba(76, 175, 80, 0.08)';
        card.style.border = '2px solid #4caf50';
        card.style.boxShadow = '0 0 30px rgba(76, 175, 80, 0.25)';
        card.style.opacity = '1';
        card.style.filter = 'none';
        card.style.cursor = 'pointer';
    } else if (isOpened) {
        card.style.background = 'radial-gradient(circle at top right, rgba(198, 90, 58, 0.25), transparent 50%), rgba(255, 255, 255, 0.05)';
        card.style.border = '2px solid var(--accent-coral)';
        card.style.boxShadow = '0 0 20px rgba(198, 90, 58, 0.15)';
        card.style.opacity = '1';
        card.style.filter = 'none';
    } else if (isLocked) {
        card.style.background = 'rgba(255, 255, 255, 0.02)';
        card.style.border = '1px solid rgba(255, 255, 255, 0.06)';
        card.style.opacity = '0.4';
        card.style.filter = 'grayscale(0.3)';
        card.style.cursor = 'not-allowed';
    }

    // Número
    const num = document.createElement('span');
    num.className = 'day-number';
    num.textContent = day;
    card.appendChild(num);

    // Nombre del regalo
    if (hasGift && giftTitle) {
        const nameEl = document.createElement('div');
        nameEl.className = 'day-gift-name';
        const shortName = giftTitle.length > 20 ? giftTitle.substring(0, 18) + '…' : giftTitle;
        nameEl.textContent = shortName;
        nameEl.style.fontSize = '0.55rem';
        nameEl.style.color = isLocked ? 'rgba(255,255,255,0.2)' : 'var(--umbra-light)';
        nameEl.style.fontWeight = '400';
        nameEl.style.maxWidth = '90%';
        nameEl.style.overflow = 'hidden';
        nameEl.style.textOverflow = 'ellipsis';
        nameEl.style.whiteSpace = 'nowrap';
        nameEl.style.marginTop = '2px';
        nameEl.style.opacity = isLocked ? '0.3' : '0.8';
        card.appendChild(nameEl);
    }

    // Badge de tipo
    if (hasGift && !isLocked && giftType) {
        const badge = document.createElement('span');
        badge.className = 'day-type-badge';
        badge.textContent = `${typeIcon} ${typeLabel}`;
        badge.style.display = 'inline-block';
        badge.style.background = isAvailable ? 'rgba(76, 175, 80, 0.2)' : 'rgba(198, 90, 58, 0.2)';
        badge.style.border = isAvailable ? '1px solid rgba(76, 175, 80, 0.4)' : '1px solid var(--accent-coral)';
        badge.style.borderRadius = '20px';
        badge.style.padding = '2px 10px';
        badge.style.fontSize = '0.55rem';
        badge.style.color = isAvailable ? '#81c784' : 'var(--accent-coral)';
        badge.style.marginTop = '2px';
        badge.style.whiteSpace = 'nowrap';
        badge.style.maxWidth = '90%';
        badge.style.overflow = 'hidden';
        badge.style.textOverflow = 'ellipsis';
        card.appendChild(badge);
    }

    // Estado
    const status = document.createElement('span');
    status.className = 'day-status';
    if (!hasGift) {
        status.textContent = '·';
        status.style.color = 'var(--umbra-ash)';
    } else if (isOpened) {
        status.textContent = '♥';
        status.style.color = 'var(--accent-coral)';
        status.style.fontSize = '1.2rem';
    } else if (isAvailable) {
        status.textContent = '✨';
        status.style.color = '#4caf50';
        status.style.fontSize = '1.2rem';
    } else {
        status.textContent = '🔒';
        status.style.fontSize = '1.5rem';
        status.style.color = 'rgba(255,255,255,0.15)';
    }
    card.appendChild(status);

    // Evento click
    card.addEventListener('click', () => {
        if (!hasGift || isLocked) {
            if (isLocked && hasGift) {
                showToast('🔒 Aún no disponible', false);
            } else {
                showToast('📅 Este día no tiene sorpresa', false);
            }
            return;
        }
        if (onDayClick) {
            onDayClick({
                day: day,
                giftId: meta.giftId,
                disabled: isLocked
            });
        }
    });

    return card;
}

// ==========================================
// MANEJADOR DE CLIC
// ==========================================
function createGiftLoader() {
    const loader = document.createElement('div');
    loader.className = 'gift-loader';
    loader.setAttribute('role', 'status');
    loader.setAttribute('aria-live', 'polite');
    loader.innerHTML = `
        <div class="heart-pulse" aria-hidden="true">❤️</div>
        <span>Cargando sorpresa...</span>
    `;
    return loader;
}

async function handleDayClick({ day, giftId, disabled }) {
    const gift = catalog.giftsById[giftId];
    if (!gift) return;

    if (disabled) {
        const date = gift.unlock?.value;
        showToast(date ? `📅 Se desbloqueará el ${date}` : '🔒 Aún no disponible');
        return;
    }

    const progressMap = getProgressMap();
    if (!progressMap[giftId]?.opened) {
        await markGiftOpened(giftId, { calendarMapping: currentMonthData.calendarMapping });
        const totalDays = getDaysInMonthFromKey(currentMonthKey);
        paintGrid(totalDays);
    }

    if (gift.redirect === true && gift.redirectUrl) {
        const url = gift.redirectUrl.startsWith('/') 
            ? gift.redirectUrl 
            : `../${gift.redirectUrl}`;
        window.location.href = url;
        return;
    }

    try {
        let contentNode = null;
        const modal = openExperienceModal({
            title: gift.title,
            contentNode: createGiftLoader(),
            onClose: () => {
                if (contentNode?._cleanup) contentNode._cleanup();
            }
        });

        contentNode = await renderGiftExperience(gift, () => closeExperienceModal());
        modal?.setContent(contentNode);
    } catch (err) {
        console.error(err);
        showToast('No se pudo cargar la experiencia', true);
    }
}

// ==========================================
// INICIALIZACIÓN
// ==========================================
async function initGiftPlatform() {
    const grid = document.getElementById('calendarGrid');
    if (!grid) {
        console.error('❌ No se encontró el grid del calendario');
        return;
    }

    try {
        // Mostrar un spinner o mensaje de carga
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:60px 20px; color:var(--umbra-ash);">
            <div style="font-size:2rem; margin-bottom:12px;">⏳</div>
            <p>Cargando calendario...</p>
        </div>`;

        catalog = await loadGiftsCatalog({ preferFirebase: false });
        console.log('📦 Catálogo cargado:', catalog);
        
        window.__giftCatalog = catalog.giftsById;
        
        await loadGiftProgress();
        
        const months = getAvailableMonths();
        if (months.length === 0) {
            console.error('❌ No hay meses configurados en el catálogo');
            showToast('No hay meses configurados', true);
            grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:60px 20px; color:var(--umbra-ash);">
                <p>No hay meses configurados</p>
            </div>`;
            return;
        }
        
        const today = new Date();
        const currentMonthKeyStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        const targetMonth = months.includes(currentMonthKeyStr) ? currentMonthKeyStr : months[0];
        console.log('🎯 Mes seleccionado:', targetMonth);
        
        const intro = document.querySelector('.calendario-intro');
        if (intro && !document.getElementById('monthSelector')) {
            const selector = document.createElement('div');
            selector.id = 'monthSelector';
            selector.className = 'month-selector';
            
            const title = document.createElement('h3');
            title.id = 'monthTitle';
            title.className = 'month-title';
            title.textContent = 'Cargando...';
            intro.appendChild(title);
            intro.appendChild(selector);
        }
        
        switchMonth(targetMonth);
        
        if (unlockCheckInterval) clearInterval(unlockCheckInterval);
        unlockCheckInterval = setInterval(() => {
            const totalDays = getDaysInMonthFromKey(currentMonthKey);
            paintGrid(totalDays);
        }, UNLOCK_CHECK_MS);
        
    } catch (err) {
        console.error('❌ Error iniciando plataforma de regalos:', err);
        showToast('Error cargando el calendario', true);
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:60px 20px; color:var(--umbra-ash);">
            <p>Error al cargar el calendario</p>
            <button onclick="location.reload()" style="margin-top:16px; padding:8px 24px; border:1px solid var(--accent-coral); border-radius:40px; background:transparent; color:var(--accent-coral); cursor:pointer;">Recargar</button>
        </div>`;
    }
}

async function init() {
    await initGiftPlatform();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}