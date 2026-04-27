// ==========================================
// themes.js · gestión mínima de tema
// ==========================================
(function () {
    const STORAGE_KEY = 'personal-hub-theme';
    const DEFAULT_THEME = 'theme-umbra';

    function setTheme(themeName) {
        document.documentElement.setAttribute('data-theme', themeName);
        try {
            localStorage.setItem(STORAGE_KEY, themeName);
        } catch (error) {
            // ignorar almacenamiento si el navegador lo bloquea
        }
    }

    function applySavedTheme() {
        let themeName = DEFAULT_THEME;
        try {
            themeName = localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME;
        } catch (error) {
            themeName = DEFAULT_THEME;
        }
        document.documentElement.setAttribute('data-theme', themeName);
    }

    applySavedTheme();
    window.setTheme = setTheme;
    window.applySavedTheme = applySavedTheme;
})();
