// progress.js - Versión de diagnóstico
const DEFAULT_PROGRESS = {
    home: true, canciones: true, rincon: true, sentimientos: true,
    thoseeyes: true, series: true, razones: true, openwhen: true,
    calendario: true, maldia: true
};

let cachedProgress = null;

async function testFirebase() {
    if (!window.db) {
        console.error('❌ window.db no existe');
        return false;
    }
    
    try {
        const testRef = window.db.collection('admin').doc('test');
        await testRef.set({ test: true });
        console.log('✅ Firebase escribiendo correctamente');
        await testRef.delete();
        return true;
    } catch (err) {
        console.error('❌ Error escribiendo en Firebase:', err);
        return false;
    }
}

async function getProgressAsync() {
    if (cachedProgress) return cachedProgress;
    
    if (!window.db) {
        console.warn('⚠️ Firebase no disponible, usando localStorage');
        const local = localStorage.getItem('sectionProgress');
        cachedProgress = local ? JSON.parse(local) : { ...DEFAULT_PROGRESS };
        return cachedProgress;
    }
    
    try {
        const docRef = window.db.collection('admin').doc('sectionProgress');
        const doc = await docRef.get();
        
        if (!doc.exists) {
            console.log('📝 Creando documento en Firebase...');
            await docRef.set({ progress: DEFAULT_PROGRESS, updatedAt: new Date().toISOString() });
            cachedProgress = { ...DEFAULT_PROGRESS };
        } else {
            cachedProgress = { ...DEFAULT_PROGRESS, ...doc.data().progress };
        }
        
        console.log('✅ Progreso cargado desde Firebase:', cachedProgress);
        return cachedProgress;
    } catch (err) {
        console.error('❌ Error en Firebase:', err);
        cachedProgress = { ...DEFAULT_PROGRESS };
        return cachedProgress;
    }
}

async function saveProgress(progress) {
    cachedProgress = progress;
    
    if (!window.db) {
        localStorage.setItem('sectionProgress', JSON.stringify(progress));
        return;
    }
    
    try {
        await window.db.collection('admin').doc('sectionProgress').set({
            progress: progress,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        console.log('✅ Progreso guardado en Firebase:', progress);
    } catch (err) {
        console.error('❌ Error guardando:', err);
        localStorage.setItem('sectionProgress', JSON.stringify(progress));
    }
}

async function unlockSection(section) {
    const progress = await getProgressAsync();
    if (progress[section] !== undefined) {
        progress[section] = true;
        await saveProgress(progress);
        return true;
    }
    return false;
}

async function lockSection(section) {
    if (section === 'home') return false;
    const progress = await getProgressAsync();
    if (progress[section] !== undefined) {
        progress[section] = false;
        await saveProgress(progress);
        return true;
    }
    return false;
}

function isSectionUnlocked(section) {
    if (section === 'home') return true;
    return cachedProgress ? cachedProgress[section] === true : true;
}

async function resetAllProgress() {
    await saveProgress({ ...DEFAULT_PROGRESS });
}

// Ejecutar diagnóstico al cargar
testFirebase();
getProgressAsync();

window.DEFAULT_PROGRESS = DEFAULT_PROGRESS;
window.getProgressAsync = getProgressAsync;
window.isSectionUnlocked = isSectionUnlocked;
window.unlockSection = unlockSection;
window.lockSection = lockSection;
window.resetAllProgress = resetAllProgress;