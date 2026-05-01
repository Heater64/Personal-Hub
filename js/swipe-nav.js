// ==========================================
// swipe-nav.js · Navegación con gestos swipe en móvil
// ==========================================
(function() {
    // Solo activar en dispositivos táctiles
    if (!('ontouchstart' in window)) return;

    const SWIPE_THRESHOLD = 80;
    let startX = 0;
    let startY = 0;
    let diffX = 0;
    let diffY = 0;

    // Rutas de las páginas en orden
    const pages = [
        'index.html',
        'pages/canciones.html',
        'pages/rincon.html',
        'pages/thoseeyes.html',
        'pages/series.html',
        'pages/razones.html',
        'pages/openwhen.html',
        'pages/calendario.html',
        'pages/maldia.html'
    ];

    // Obtener página actual
    function getCurrentPage() {
        const path = window.location.pathname;
        const filename = path.split('/').pop() || 'index.html';
        return filename;
    }

    // Encontrar índice actual
    function getCurrentIndex() {
        const current = getCurrentPage();
        return pages.indexOf(current);
    }

    // Ir a página siguiente
    function goToNext() {
        const idx = getCurrentIndex();
        if (idx < pages.length - 1) {
            window.location.href = pages[idx + 1];
        }
    }

    // Ir a página anterior
    function goToPrev() {
        const idx = getCurrentIndex();
        if (idx > 0) {
            window.location.href = pages[idx - 1];
        }
    }

    // Touch start
    document.addEventListener('touchstart', function(e) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    }, { passive: true });

    // Touch move - para feedback visual
    document.addEventListener('touchmove', function(e) {
        diffX = e.touches[0].clientX - startX;
        diffY = e.touches[0].clientY - startY;
    }, { passive: true });

    // Touch end
    document.addEventListener('touchend', function(e) {
        const absX = Math.abs(diffX);
        const absY = Math.abs(diffY);

        // Solo swipe horizontal, no vertical
        if (absX > SWIPE_THRESHOLD && absX > absY) {
            if (diffX > 0) {
                // Swipe derecha -> página anterior
                goToPrev();
            } else {
                // Swipe izquierda -> siguiente página
                goToNext();
            }
        }

        // Reset valores
        diffX = 0;
        diffY = 0;
    }, { passive: true });
})();
