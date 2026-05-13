// access-control.js - Control de acceso con Firebase
(function () {
    const body = document.body;
    const page = body?.dataset?.sidebarPage || 'home';
    
    const LOCKABLE_SECTIONS = [
        'canciones', 'rincon', 'sentimientos', 'thoseeyes', 
        'series', 'razones', 'openwhen', 'calendario', 'maldia'
    ];
    
    if (page === 'home') return;
    if (!LOCKABLE_SECTIONS.includes(page)) return;
    
    // Verificar si está bloqueada (de forma asíncrona)
    async function checkAndBlock() {
        if (typeof isSectionUnlockedAsync !== 'function') {
            // Fallback a la versión síncrona si no está disponible
            if (typeof isSectionUnlocked === 'function' && !isSectionUnlocked(page)) {
                showBlockedPage();
            }
            return;
        }
        
        const isUnlocked = await isSectionUnlockedAsync(page);
        if (!isUnlocked) {
            showBlockedPage();
        }
    }
    
    function showBlockedPage() {
        const main = document.querySelector('main');
        if (main) {
            main.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:center;min-height:70vh;text-align:center;padding:20px;">
                    <div>
                        <i data-lucide="lock" style="width:64px;height:64px;color:var(--accent-coral);margin:0 auto 24px;display:block;"></i>
                        <h2 style="font-family:'Playfair Display',serif;font-size:2rem;margin-bottom:16px;">Sección bloqueada</h2>
                        <p style="color:var(--umbra-ash);font-size:1rem;max-width:400px;margin:0 auto 24px;">
                            Esta sección aún no está disponible.
                        </p>
                        <a href="../index.html" style="color:var(--accent-coral);text-decoration:underline;">Volver al inicio</a>
                    </div>
                </div>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }
    
    // Ejecutar verificación
    checkAndBlock();
})();