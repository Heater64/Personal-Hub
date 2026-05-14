// progress.js - Solo Firebase (sin localStorage)
const DEFAULT_PROGRESS = {
    home: true, canciones: true, rincon: true, sentimientos: true,
    thoseeyes: true, series: true, razones: true, openwhen: true,
    calendario: true, maldia: true
};

let cachedProgress = null;

async function getProgressAsync() {
    if (cachedProgress) return cachedProgress;
    if (!window.db) return { ...DEFAULT_PROGRESS };
    
    try {
        const docRef = window.db.collection('admin').doc('sectionProgress');
        const doc = await docRef.get();
        
        if (!doc.exists) {
            await docRef.set({ progress: DEFAULT_PROGRESS, updatedAt: new Date().toISOString() });
            cachedProgress = { ...DEFAULT_PROGRESS };
        } else {
            cachedProgress = { ...DEFAULT_PROGRESS, ...doc.data().progress };
        }
        
        return cachedProgress;
    } catch (err) {
        console.error('❌ Error en Firebase:', err);
        return { ...DEFAULT_PROGRESS };
    }
}

async function saveProgress(progress) {
    cachedProgress = progress;
    if (!window.db) return;
    
    await window.db.collection('admin').doc('sectionProgress').set({
        progress: progress,
        updatedAt: new Date().toISOString()
    }, { merge: true });
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

async function isSectionUnlocked(section) {
    if (section === 'home') return true;
    const progress = await getProgressAsync();
    return progress[section] === true;
}

async function resetAllProgress() {
    await saveProgress({ ...DEFAULT_PROGRESS });
}

// Precargar
getProgressAsync();

window.DEFAULT_PROGRESS = DEFAULT_PROGRESS;
window.getProgressAsync = getProgressAsync;
window.isSectionUnlocked = isSectionUnlocked;
window.unlockSection = unlockSection;
window.lockSection = lockSection;
window.resetAllProgress = resetAllProgress;