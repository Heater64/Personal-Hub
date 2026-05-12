// access-control.js - Control de acceso simplificado
// TODAS las secciones están desbloqueadas por defecto
(function () {
    const body = document.body;
    const page = body?.dataset?.sidebarPage || 'home';
    
    // Si quieres bloquear alguna sección específica en el futuro, añádela aquí
    const LOCKED_SECTIONS = []; // <-- Vacío = todo desbloqueado
    
    if (LOCKED_SECTIONS.includes(page)) {
        const main = document.querySelector('main');
        if (main) {
            main.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:center;min-height:70vh;text-align:center;padding:20px;">
                    <div>
                        <i data-lucide="lock" style="width:64px;height:64px;color:var(--accent-coral);margin:0 auto 24px;display:block;"></i>
                        <h2 style="font-family:'Playfair Display',serif;font-size:2.5rem;margin-bottom:16px;">Sección bloqueada</h2>
                        <p style="color:var(--umbra-ash);font-size:1.1rem;max-width:400px;margin:0 auto 32px;">
                            Esta sección aún no está disponible. Pronto se desbloqueará para ti.
                        </p>
                        <a href="../index.html" style="color:var(--accent-coral);text-decoration:underline;">Volver al inicio</a>
                    </div>
                </div>
            `;
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }
    }
})();