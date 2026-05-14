// ==========================================
// analytics.js · Sistema de estadísticas
// ==========================================

let currentSessionId = null;
let pageStartTime = null;
let currentPage = null;
let analyticsEnabled = true;

// Generar ID único de sesión
function getSessionId() {
    let sessionId = sessionStorage.getItem('analytics_session_id');
    if (!sessionId) {
        sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        sessionStorage.setItem('analytics_session_id', sessionId);
    }
    return sessionId;
}

// Obtener tipo de dispositivo
function getDeviceType() {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
        return 'tablet';
    }
    if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
        return 'mobile';
    }
    return 'desktop';
}

// Registrar visita a una página
async function trackPageView(pageName) {
    if (!analyticsEnabled) return;
    
    currentPage = pageName;
    pageStartTime = Date.now();
    currentSessionId = getSessionId();
    
    // Esperar a que Firebase esté listo
    if (typeof db === 'undefined') {
        setTimeout(() => trackPageView(pageName), 500);
        return;
    }
    
    try {
        await db.collection('stats_visits').add({
            page: pageName,
            sessionId: currentSessionId,
            device: getDeviceType(),
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            userAgent: navigator.userAgent.substring(0, 200)
        });
        
        // Actualizar sesión activa
        await updateActiveSession(pageName);
        
    } catch (error) {
        console.error('Error registrando visita:', error);
    }
}

// Actualizar sesión activa (para saber quién está conectado)
async function updateActiveSession(pageName) {
    if (!window.db) return;
    
    const sessionRef = db.collection('stats_sessions').doc(currentSessionId);
    
    try {
        const doc = await sessionRef.get();
        if (doc.exists) {
            await sessionRef.update({
                lastActivity: firebase.firestore.FieldValue.serverTimestamp(),
                lastPage: pageName,
                pagesVisited: firebase.firestore.FieldValue.arrayUnion(pageName)
            });
        } else {
            await sessionRef.set({
                sessionId: currentSessionId,
                startTime: firebase.firestore.FieldValue.serverTimestamp(),
                lastActivity: firebase.firestore.FieldValue.serverTimestamp(),
                device: getDeviceType(),
                pagesVisited: [pageName],
                totalDuration: 0
            });
        }
    } catch (error) {
        console.error('Error actualizando sesión:', error);
    }
}

// Registrar salida de página (para calcular tiempo)
async function trackPageExit() {
    if (!analyticsEnabled || !pageStartTime || !currentPage) return;
    
    const duration = Math.round((Date.now() - pageStartTime) / 1000); // segundos
    if (duration < 2) return; // Ignorar visitas muy cortas
    
    if (typeof db !== 'undefined' && db) {
        try {
            await db.collection('stats_visits').add({
                page: currentPage,
                sessionId: currentSessionId,
                device: getDeviceType(),
                duration: duration,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                type: 'exit'
            });
            
            // Actualizar duración total de la sesión
            const sessionRef = db.collection('stats_sessions').doc(currentSessionId);
            const sessionDoc = await sessionRef.get();
            if (sessionDoc.exists) {
                const totalDuration = (sessionDoc.data().totalDuration || 0) + duration;
                await sessionRef.update({
                    totalDuration: totalDuration,
                    endTime: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        } catch (error) {
            console.error('Error registrando salida:', error);
        }
    }
    
    pageStartTime = null;
}

// Registrar acción del administrador
async function trackAdminAction(action, section) {
    if (!window.db || !analyticsEnabled) return;
    
    try {
        await db.collection('stats_admin_actions').add({
            action: action, // 'unlock' o 'lock'
            section: section,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            sessionId: currentSessionId
        });
    } catch (error) {
        console.error('Error registrando acción admin:', error);
    }
}

// Obtener estadísticas (solo para admin)
async function getStats(options = {}) {
    const { days = 7, limit = 100 } = options;
    if (!window.db) return null;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    try {
        // Visitas por página
        const visitsSnapshot = await db.collection('stats_visits')
            .where('timestamp', '>=', cutoffDate)
            .get();
        
        const pageVisits = {};
        let totalVisits = 0;
        let totalDuration = 0;
        let durationCount = 0;
        
        visitsSnapshot.forEach(doc => {
            const data = doc.data();
            const page = data.page;
            pageVisits[page] = (pageVisits[page] || 0) + 1;
            totalVisits++;
            
            if (data.duration) {
                totalDuration += data.duration;
                durationCount++;
            }
        });
        
        // Sesiones activas (últimos 15 minutos)
        const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
        const activeSessionsSnapshot = await db.collection('stats_sessions')
            .where('lastActivity', '>=', fifteenMinsAgo)
            .get();
        
        const activeSessions = activeSessionsSnapshot.size;
        
        // Dispositivos
        const deviceStats = { desktop: 0, mobile: 0, tablet: 0 };
        visitsSnapshot.forEach(doc => {
            const device = doc.data().device;
            if (device && deviceStats[device] !== undefined) {
                deviceStats[device]++;
            }
        });
        
        // Visitas por día (últimos 7 días)
        const dailyVisits = {};
        for (let i = 0; i < days; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            dailyVisits[dateStr] = 0;
        }
        
        visitsSnapshot.forEach(doc => {
            const ts = doc.data().timestamp;
            if (ts && ts.toDate) {
                const dateStr = ts.toDate().toISOString().split('T')[0];
                if (dailyVisits[dateStr] !== undefined) {
                    dailyVisits[dateStr]++;
                }
            }
        });
        
        // Convertir a array ordenado
        const dailyArray = Object.entries(dailyVisits)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, count]) => ({ date, count }));
        
        // Páginas ordenadas por visitas
        const sortedPages = Object.entries(pageVisits)
            .sort((a, b) => b[1] - a[1])
            .map(([page, visits]) => ({ page, visits }));
        
        return {
            totalVisits,
            avgDuration: durationCount > 0 ? Math.round(totalDuration / durationCount) : 0,
            activeSessions,
            deviceStats,
            dailyVisits: dailyArray,
            topPages: sortedPages,
            totalPages: Object.keys(pageVisits).length
        };
        
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        return null;
    }
}

// Inicializar analytics
function initAnalytics() {
    const pageName = document.body?.dataset?.sidebarPage || 'home';
    
    // Registrar entrada a la página
    trackPageView(pageName);
    
    // Registrar salida al cerrar o navegar
    window.addEventListener('beforeunload', () => {
        trackPageExit();
    });
    
    // También al ocultar la página (para pestañas)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            trackPageExit();
        } else {
            // Reactivar: nueva visita
            pageStartTime = Date.now();
        }
    });
}

// Exportar funciones globales
window.trackPageView = trackPageView;
window.trackAdminAction = trackAdminAction;
window.getStats = getStats;
window.initAnalytics = initAnalytics;

// Iniciar automáticamente
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAnalytics);
} else {
    initAnalytics();
}