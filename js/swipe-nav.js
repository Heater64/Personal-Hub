// ==========================================
// swipe-nav.js · Navegación con gestos swipe en móvil
// ==========================================
(function() {
    if (!('ontouchstart' in window)) return;

    const SWIPE_THRESHOLD = 80;
    let startX = 0;
    let startY = 0;
    let diffX = 0;
    let diffY = 0;

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

    function getCurrentPage() {
        const path = window.location.pathname;
        const filename = path.split('/').pop() || 'index.html';
        return filename;
    }

    function getCurrentIndex() {
        const current = getCurrentPage();
        return pages.indexOf(current);
    }

    function goToNext() {
        const idx = getCurrentIndex();
        if (idx < pages.length - 1) {
            window.location.href = pages[idx + 1];
        }
    }

    function goToPrev() {
        const idx = getCurrentIndex();
        if (idx > 0) {
            window.location.href = pages[idx - 1];
        }
    }

    document.addEventListener('touchstart', function(e) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchmove', function(e) {
        diffX = e.touches[0].clientX - startX;
        diffY = e.touches[0].clientY - startY;
    }, { passive: true });

    document.addEventListener('touchend', function(e) {
        const absX = Math.abs(diffX);
        const absY = Math.abs(diffY);

        if (absX > SWIPE_THRESHOLD && absX > absY) {
            if (diffX > 0) {
                goToPrev();
            } else {
                goToNext();
            }
        }

        diffX = 0;
        diffY = 0;
    }, { passive: true });
})();