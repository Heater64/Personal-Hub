// shared/utils/lifecycle.js
// Gestión de lifecycle para features
// Registra cleanup handlers que se ejecutan al navegar away

var Lifecycle = (function () {

    var handlers = [];

    function register(cleanupFn) {
        if (typeof cleanupFn === 'function') {
            handlers.push(cleanupFn);
        }
    }

    function destroy() {
        for (var i = handlers.length - 1; i >= 0; i--) {
            try {
                handlers[i]();
            } catch (err) {
                console.warn('[Lifecycle] Error en cleanup:', err);
            }
        }
        handlers = [];
    }

    // Ejecutar cleanup al descargar la página
    if (typeof window !== 'undefined') {
        window.addEventListener('beforeunload', destroy);
        window.addEventListener('pagehide', destroy);
    }

    return {
        register: register,
        destroy: destroy
    };

})();

if (typeof window !== 'undefined') {
    window.Lifecycle = Lifecycle;
}

console.log('📁 lifecycle.js cargado');
