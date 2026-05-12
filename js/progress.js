const DEFAULT_PROGRESS = {
    home: true,
    canciones: true,
    rincon: true,
    thoseeyes: true,
    series: true,
    razones: true,
    openwhen: true,
    calendario: true,
    maldia: true,
    decks: true,
    dashboard: true,
    tutor: true
};

function getProgress() {
    return { ...DEFAULT_PROGRESS };
}

function saveProgress() {
    // No hacemos nada porque todas están desbloqueadas
}

function unlockSection(section) {
    return true;
}

function lockSection(section) {
    return false;
}

function isSectionUnlocked(section) {
    return true;
}

function resetAllProgress() {
    // No necesario
}

window.DEFAULT_PROGRESS = DEFAULT_PROGRESS;
window.getProgress = getProgress;
window.isSectionUnlocked = isSectionUnlocked;
window.unlockSection = unlockSection;
window.lockSection = lockSection;
window.resetAllProgress = resetAllProgress;