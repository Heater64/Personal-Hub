// progress.js · Control de acceso GLOBAL con Firebase

const DEFAULT_PROGRESS = {
    home: true,
    canciones: true,
    rincon: true,
    sentimientos: true,
    thoseeyes: true,
    series: true,
    razones: true,
    openwhen: true,
    calendario: true,
    maldia: true
};

let cachedProgress = null;
let progressRef = null;

// Obtener referencia a Firebase
function getProgressRef() {
    if (progressRef) return progressRef;
    
    const db = window.db || (typeof firebase !== 'undefined' && firebase.firestore ? firebase.firestore() : null);
    if (db) {
        progressRef = db.collection('admin').doc('sectionProgress');
    }
    return progressRef;
}

// Cargar progreso desde Firebase
async function loadProgressFromFirebase() {
    const ref = getProgressRef();
    if (!ref) {
        console.warn('Firebase no disponible, usando localStorage temporal');
        const stored = localStorage.getItem('sectionProgress');
        if (stored) {
            try {
                cachedProgress = { ...DEFAULT_PROGRESS, ...JSON.parse(stored) };
            } catch(e) {}
        }
        if (!cachedProgress) cachedProgress = { ...DEFAULT_PROGRESS };
        return cachedProgress;
    }
    
    try {
        const doc = await ref.get();
        if (doc.exists && doc.data().progress) {
            cachedProgress = { ...DEFAULT_PROGRESS, ...doc.data().progress };
        } else {
            cachedProgress = { ...DEFAULT_PROGRESS };
            await ref.set({ progress: DEFAULT_PROGRESS, updatedAt: new Date().toISOString() });
        }
    } catch (error) {
        console.error('Error cargando progreso de Firebase:', error);
        cachedProgress = { ...DEFAULT_PROGRESS };
    }
    
    return cachedProgress;
}

// Guardar progreso en Firebase
async function saveProgressToFirebase(progress) {
    cachedProgress = { ...progress };
    
    const ref = getProgressRef();
    if (!ref) {
        localStorage.setItem('sectionProgress', JSON.stringify(progress));
        return;
    }
    
    try {
        await ref.set({ 
            progress: progress, 
            updatedAt: new Date().toISOString() 
        }, { merge: true });
        console.log('✅ Progreso guardado en Firebase global');
    } catch (error) {
        console.error('Error guardando en Firebase:', error);
        localStorage.setItem('sectionProgress', JSON.stringify(progress));
    }
}

// Función principal para obtener progreso (async)
async function getProgressAsync() {
    if (cachedProgress) return cachedProgress;
    return await loadProgressFromFirebase();
}

// Versión síncrona (para compatibilidad, usa caché o carga por defecto)
function getProgress() {
    if (cachedProgress) return cachedProgress;
    return { ...DEFAULT_PROGRESS };
}

// Guardar progreso (async)
async function saveProgress(progress) {
    await saveProgressToFirebase(progress);
}

// Desbloquear sección
async function unlockSection(section) {
    const progress = await getProgressAsync();
    if (progress[section] !== undefined) {
        progress[section] = true;
        await saveProgressToFirebase(progress);
        return true;
    }
    return false;
}

// Bloquear sección
async function lockSection(section) {
    if (section === 'home') return false;
    const progress = await getProgressAsync();
    if (progress[section] !== undefined) {
        progress[section] = false;
        await saveProgressToFirebase(progress);
        return true;
    }
    return false;
}

// Verificar si sección está desbloqueada (async)
async function isSectionUnlockedAsync(section) {
    const progress = await getProgressAsync();
    return progress[section] === true;
}

// Versión síncrona (usa caché, si no hay caché asume true)
function isSectionUnlocked(section) {
    if (section === 'home') return true;
    if (cachedProgress) return cachedProgress[section] === true;
    return true;
}

// Resetear todo
async function resetAllProgress() {
    await saveProgressToFirebase({ ...DEFAULT_PROGRESS });
    cachedProgress = { ...DEFAULT_PROGRESS };
}

// Inicializar (cargar datos al inicio)
async function initProgress() {
    await loadProgressFromFirebase();
}

// Inicializar automáticamente
if (typeof window !== 'undefined') {
    initProgress();
}

// Exportar
window.DEFAULT_PROGRESS = DEFAULT_PROGRESS;
window.getProgress = getProgress;
window.getProgressAsync = getProgressAsync;
window.isSectionUnlocked = isSectionUnlocked;
window.isSectionUnlockedAsync = isSectionUnlockedAsync;
window.unlockSection = unlockSection;
window.lockSection = lockSection;
window.resetAllProgress = resetAllProgress;
window.initProgress = initProgress;