// ==========================================
// loading.js · Pantalla de carga animada
// ==========================================
(function() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (!loadingScreen) return;

    // Ocultar pantalla de carga cuando la página esté lista
    function hideLoadingScreen() {
        loadingScreen.classList.add('fade-out');
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 600);
    }

    // Esperar a que todos los recursos críticos carguen
    window.addEventListener('load', hideLoadingScreen);

    // Fallback: ocultar después de 3 segundos máximo
    setTimeout(hideLoadingScreen, 3000);
})();