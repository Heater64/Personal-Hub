const DEFAULT_PROGRESS = {
    home: true,
    canciones: true,
    rincon: true,
    sentimientos: true,  // NUEVA SECCIÓN
    thoseeyes: true,
    series: true,
    razones: true,
    openwhen: true,
    calendario: true,
    maldia: true
};

function getProgress() {
    const stored = localStorage.getItem('sectionProgress');
    if (stored) {
        try {
            return { ...DEFAULT_PROGRESS, ...JSON.parse(stored) };
        } catch (error) {}
    }
    return { ...DEFAULT_PROGRESS };
}

function saveProgress(progress) {
    localStorage.setItem('sectionProgress', JSON.stringify(progress));
}

function unlockSection(section) {
    const progress = getProgress();
    if (progress[section] !== undefined) {
        progress[section] = true;
        saveProgress(progress);
        return true;
    }
    return false;
}

function lockSection(section) {
    const progress = getProgress();
    if (progress[section] !== undefined && section !== 'home') {
        progress[section] = false;
        saveProgress(progress);
        return true;
    }
    return false;
}

function isSectionUnlocked(section) {
    return getProgress()[section] === true;
}

function resetAllProgress() {
    saveProgress({ ...DEFAULT_PROGRESS });
}

window.DEFAULT_PROGRESS = DEFAULT_PROGRESS;
window.getProgress = getProgress;
window.isSectionUnlocked = isSectionUnlocked;
window.unlockSection = unlockSection;
window.lockSection = lockSection;
window.resetAllProgress = resetAllProgress;