const DEFAULT_PROGRESS = {
    home: true, canciones: true, rincon: true, sentimientos: true,
    thoseeyes: true, series: true, razones: true, openwhen: true,
    calendario: true, maldia: true
};

let cachedProgress = { ...DEFAULT_PROGRESS };
let unsubscribeSnapshot = null;

function initProgressListener() {
    if (!window.db) return;

    const docRef = window.db.collection('admin').doc('sectionProgress');

    unsubscribeSnapshot = docRef.onSnapshot((doc) => {
        if (doc.exists && doc.data().progress) {
            cachedProgress = { ...DEFAULT_PROGRESS, ...doc.data().progress };
        } else {
            cachedProgress = { ...DEFAULT_PROGRESS };
            if (!doc.exists) {
                docRef.set({ progress: DEFAULT_PROGRESS, updatedAt: new Date().toISOString() });
            }
        }
        window._progressReady = true;
        window.dispatchEvent(new CustomEvent('progress-changed'));
    }, (err) => {
        console.error('Error en snapshot:', err);
        window._progressReady = true;
    });
}

function isSectionUnlocked(section) {
    if (section === 'home') return true;
    return cachedProgress ? cachedProgress[section] === true : true;
}

async function saveProgress(progress) {
    cachedProgress = progress;
    window.dispatchEvent(new CustomEvent('progress-changed'));
    if (!window.db) return;
    await window.db.collection('admin').doc('sectionProgress').set({
        progress: progress,
        updatedAt: new Date().toISOString()
    }, { merge: true });
}

async function unlockSection(section) {
    const progress = { ...cachedProgress };
    if (progress[section] !== undefined) {
        progress[section] = true;
        await saveProgress(progress);
        return true;
    }
    return false;
}

async function lockSection(section) {
    if (section === 'home') return false;
    const progress = { ...cachedProgress };
    if (progress[section] !== undefined) {
        progress[section] = false;
        await saveProgress(progress);
        return true;
    }
    return false;
}

async function resetAllProgress() {
    cachedProgress = { ...DEFAULT_PROGRESS };
    await saveProgress({ ...DEFAULT_PROGRESS });
}

initProgressListener();

window._unsubscribeProgress = unsubscribeSnapshot;
window.DEFAULT_PROGRESS = DEFAULT_PROGRESS;
window.isSectionUnlocked = isSectionUnlocked;
window.unlockSection = unlockSection;
window.lockSection = lockSection;
window.resetAllProgress = resetAllProgress;
