// calendario.js - Versión corregida (sin duplicación de db)

const UNLOCK_SCHEDULE = {
    1: '2026-05-13', 2: '2026-05-14', 3: '2026-05-15', 4: '2026-05-16',
    5: '2026-05-17', 6: '2026-05-18', 7: '2026-05-19', 8: '2026-05-20',
    9: '2026-05-21', 10: '2026-05-22', 11: '2026-05-23', 12: '2026-05-24',
    13: '2026-05-25', 14: '2026-05-26', 15: '2026-05-27', 16: '2026-05-28',
    17: '2026-05-29', 18: '2026-05-30', 19: '2026-05-31', 20: '2026-06-01',
    21: '2026-06-02', 22: '2026-06-03', 23: '2026-06-04', 24: '2026-06-05',
    25: '2026-06-06', 26: '2026-06-07', 27: '2026-06-08', 28: '2026-06-09',
    29: '2026-06-10', 30: '2026-06-11', 31: '2026-06-12'
};

const ADMIN_PASSWORD = 'sY2LkBmX';
const VISIBLE_DAYS = 31;

let opened = [];
let currentAudio = null;
let unlockCheckInterval = null;
let calendarioRef = null;

// Obtener la instancia de Firebase (sin duplicar)
function getDB() {
    if (typeof window.db !== 'undefined' && window.db) return window.db;
    if (typeof db !== 'undefined' && db) return db;
    if (typeof firebase !== 'undefined' && firebase.firestore) return firebase.firestore();
    return null;
}

function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

function isDayUnlockedByDate(dayNumber) {
    const unlockDate = UNLOCK_SCHEDULE[dayNumber];
    if (!unlockDate) return true;
    return getTodayDate() >= unlockDate;
}

function canOpenDay(dayNumber) {
    if (opened.includes(dayNumber)) return true;
    return isDayUnlockedByDate(dayNumber + 1);
}

function showToast(message, isError = false, duration = 3000) {
    let toast = document.querySelector('.toast-message');
    if (toast) toast.remove();
    
    toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;
    if (isError) toast.style.borderLeftColor = '#dc3545';
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), duration);
}

async function checkAndAutoUnlock() {
    let needsSave = false;
    
    for (let i = 0; i < VISIBLE_DAYS; i++) {
        if (!opened.includes(i) && isDayUnlockedByDate(i + 1)) {
            opened.push(i);
            needsSave = true;
            console.log(`🎉 Día ${i + 1} desbloqueado automáticamente`);
        }
    }
    
    if (needsSave) {
        await saveOpened();
        renderCalendar();
    }
}

function startUnlockChecker() {
    if (unlockCheckInterval) clearInterval(unlockCheckInterval);
    unlockCheckInterval = setInterval(() => checkAndAutoUnlock(), 60000);
    checkAndAutoUnlock();
}

function showAdminPanel() {
    const password = prompt("🔐 Contraseña de administración:");
    if (password !== ADMIN_PASSWORD) {
        showToast("Contraseña incorrecta", true);
        return;
    }
    
    const option = prompt('📅 ¿Qué quieres hacer?\n1 - Desbloquear un día\n2 - Ver estado actual');
    
    if (option === '1') {
        const dayNum = parseInt(prompt("¿Qué día quieres desbloquear? (1-31):"));
        if (dayNum >= 1 && dayNum <= VISIBLE_DAYS) {
            const index = dayNum - 1;
            if (!opened.includes(index)) {
                opened.push(index);
                saveOpened();
                renderCalendar();
                showToast(`🔓 Día ${dayNum} desbloqueado manualmente`);
            } else {
                showToast(`⚠️ El día ${dayNum} ya estaba desbloqueado`);
            }
        } else {
            showToast("Día inválido", true);
        }
    } else if (option === '2') {
        const status = opened.length > 0 ? `Días abiertos: ${opened.map(i => i + 1).join(', ')}` : 'No hay días abiertos';
        alert(status);
    }
}

function addSecretUnlockButton() {
    const title = document.querySelector('.calendario-intro h2');
    if (title) {
        title.style.cursor = 'pointer';
        title.addEventListener('dblclick', showAdminPanel);
    }
}

// Renderizado simplificado
function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    if (!grid) return;
    
    grid.innerHTML = Array.from({ length: VISIBLE_DAYS }, (_, i) => {
        const isUnlocked = canOpenDay(i);
        const isOpened = opened.includes(i);
        const unlockDate = UNLOCK_SCHEDULE[i + 1];
        
        return `<button class="day-card ${isOpened ? 'opened' : ''} ${!isUnlocked ? 'locked' : ''}" 
                        data-day="${i}" type="button" ${!isUnlocked ? 'disabled' : ''}>
                    <span class="day-number">${i + 1}</span>
                    <span class="day-status">${isOpened ? '✓' : (isUnlocked ? '✨' : '🔒')}</span>
                    ${unlockDate && !isUnlocked ? `<span class="lock-icon" title="Se desbloquea el ${unlockDate}">📅</span>` : ''}
                </button>`;
    }).join('');
}

async function loadOpened() {
    const database = getDB();
    
    if (!database) {
        console.warn('Firebase no disponible, modo local');
        opened = [];
        renderCalendar();
        return;
    }
    
    if (!calendarioRef) {
        calendarioRef = database.collection('calendario').doc('sorpresas');
    }
    
    try {
        const doc = await calendarioRef.get();
        opened = doc.exists && doc.data().abiertos ? doc.data().abiertos : [];
    } catch (error) {
        console.error('Error:', error);
        opened = [];
    }
    
    await checkAndAutoUnlock();
    renderCalendar();
}

async function saveOpened() {
    const database = getDB();
    if (!database || !calendarioRef) return;
    
    try {
        await calendarioRef.set({ abiertos: opened }, { merge: true });
    } catch (error) {
        console.error('Error al guardar:', error);
    }
}

function initCalendario() {
    const grid = document.getElementById('calendarGrid');
    if (!grid) return;
    
    loadOpened();
    startUnlockChecker();
    addSecretUnlockButton();
    
    grid.addEventListener('click', async (e) => {
        const card = e.target.closest('.day-card');
        if (!card || card.disabled) {
            const day = card ? Number(card.dataset.day) : null;
            const unlockDate = day !== null ? UNLOCK_SCHEDULE[day + 1] : null;
            if (unlockDate) showToast(`📅 Se desbloqueará el ${unlockDate}`, false, 3000);
            return;
        }
        
        const day = Number(card.dataset.day);
        
        if (!opened.includes(day)) {
            opened.push(day);
            await saveOpened();
            renderCalendar();
        }
        
        const surpriseMessages = [
            "🎁 ¡Sorpresa! Esto es especial solo para ti.",
            "💝 Un momento especial para un día especial.",
            "✨ Abriste un nuevo recuerdo.",
            "🌟 Cada día contigo es una aventura."
        ];
        alert(surpriseMessages[day % surpriseMessages.length]);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCalendario);
} else {
    initCalendario();
}