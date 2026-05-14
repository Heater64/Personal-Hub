// js/pages/admin.js · Panel de estadísticas

let statsChart = null;
let refreshInterval = null;

// Renderizar estadísticas en el panel
async function renderStats() {
    const statsContainer = document.getElementById('statsContent');
    if (!statsContainer) return;
    
    statsContainer.innerHTML = '<div class="loading-stats">📊 Cargando estadísticas...</div>';
    
    const stats = await getStats({ days: 7 });
    
    if (!stats) {
        statsContainer.innerHTML = `
            <div class="error-stats">
                <i data-lucide="alert-circle"></i>
                <p>No se pudieron cargar las estadísticas</p>
                <button onclick="renderStats()" class="btn-primary">Reintentar</button>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }
    
    // Formatear duración promedio
    const avgMinutes = Math.floor(stats.avgDuration / 60);
    const avgSeconds = stats.avgDuration % 60;
    const avgDurationStr = `${avgMinutes}:${avgSeconds.toString().padStart(2, '0')}`;
    
    // Calcular porcentajes de dispositivos
    const totalDevices = stats.deviceStats.desktop + stats.deviceStats.mobile + stats.deviceStats.tablet;
    const desktopPercent = totalDevices > 0 ? Math.round((stats.deviceStats.desktop / totalDevices) * 100) : 0;
    const mobilePercent = totalDevices > 0 ? Math.round((stats.deviceStats.mobile / totalDevices) * 100) : 0;
    const tabletPercent = totalDevices > 0 ? Math.round((stats.deviceStats.tablet / totalDevices) * 100) : 0;
    
    statsContainer.innerHTML = `
        <!-- Tarjetas de resumen -->
        <div class="stats-summary">
            <div class="stat-card-mini">
                <i data-lucide="eye"></i>
                <div class="stat-number">${stats.totalVisits}</div>
                <div class="stat-label">Visitas totales</div>
            </div>
            <div class="stat-card-mini">
                <i data-lucide="clock"></i>
                <div class="stat-number">${avgDurationStr}</div>
                <div class="stat-label">Tiempo promedio</div>
            </div>
            <div class="stat-card-mini">
                <i data-lucide="users"></i>
                <div class="stat-number">${stats.activeSessions}</div>
                <div class="stat-label">Activos ahora</div>
            </div>
            <div class="stat-card-mini">
                <i data-lucide="layers"></i>
                <div class="stat-number">${stats.totalPages}</div>
                <div class="stat-label">Páginas visitadas</div>
            </div>
        </div>
        
        <!-- Gráfico de visitas diarias -->
        <div class="stats-chart">
            <h3><i data-lucide="trending-up"></i> Visitas por día</h3>
            <canvas id="dailyChart" height="200"></canvas>
        </div>
        
        <!-- Top páginas -->
        <div class="stats-top-pages">
            <h3><i data-lucide="bar-chart-2"></i> Páginas más visitadas</h3>
            <div class="top-pages-list">
                ${stats.topPages.map((page, index) => {
                    const percent = stats.totalVisits > 0 ? Math.round((page.visits / stats.totalVisits) * 100) : 0;
                    const pageNames = {
                        'home': '🏠 Inicio',
                        'canciones': '🎵 Canciones',
                        'rincon': '💖 TuRincónFav',
                        'sentimientos': '💭 Sentimientos',
                        'thoseeyes': '👁️ Those Eyes',
                        'series': '📺 Series',
                        'razones': '✨ Razones',
                        'openwhen': '✉️ Open When',
                        'calendario': '📅 Calendario',
                        'maldia': '☀️ Mal Día'
                    };
                    const displayName = pageNames[page.page] || page.page;
                    return `
                        <div class="top-page-item">
                            <div class="page-rank">${index + 1}</div>
                            <div class="page-name">${displayName}</div>
                            <div class="page-stats">
                                <div class="page-bar" style="width: ${percent}%"></div>
                                <span class="page-count">${page.visits} visitas</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        
        <!-- Dispositivos -->
        <div class="stats-devices">
            <h3><i data-lucide="smartphone"></i> Dispositivos</h3>
            <div class="devices-grid">
                <div class="device-item">
                    <i data-lucide="monitor"></i>
                    <span class="device-name">Escritorio</span>
                    <div class="device-bar-container">
                        <div class="device-bar" style="width: ${desktopPercent}%"></div>
                    </div>
                    <span class="device-percent">${desktopPercent}%</span>
                </div>
                <div class="device-item">
                    <i data-lucide="smartphone"></i>
                    <span class="device-name">Móvil</span>
                    <div class="device-bar-container">
                        <div class="device-bar" style="width: ${mobilePercent}%"></div>
                    </div>
                    <span class="device-percent">${mobilePercent}%</span>
                </div>
                <div class="device-item">
                    <i data-lucide="tablet"></i>
                    <span class="device-name">Tablet</span>
                    <div class="device-bar-container">
                        <div class="device-bar" style="width: ${tabletPercent}%"></div>
                    </div>
                    <span class="device-percent">${tabletPercent}%</span>
                </div>
            </div>
        </div>
        
        <!-- Últimas actividades del admin (si las hay) -->
        <div class="stats-admin-actions" id="adminActionsContainer">
            <h3><i data-lucide="activity"></i> Últimas acciones de administración</h3>
            <div id="adminActionsList">Cargando...</div>
        </div>
    `;
    
    // Crear gráfico
    const ctx = document.getElementById('dailyChart')?.getContext('2d');
    if (ctx && stats.dailyVisits.length > 0) {
        if (statsChart) statsChart.destroy();
        statsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: stats.dailyVisits.map(d => d.date.slice(5)),
                datasets: [{
                    label: 'Visitas',
                    data: stats.dailyVisits.map(d => d.count),
                    borderColor: '#c65a3a',
                    backgroundColor: 'rgba(198, 90, 58, 0.1)',
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }
    
    // Cargar últimas acciones del admin
    loadAdminActions();
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Cargar últimas acciones del administrador
async function loadAdminActions() {
    const container = document.getElementById('adminActionsList');
    if (!container || !window.db) return;
    
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 7);
        
        const snapshot = await db.collection('stats_admin_actions')
            .orderBy('timestamp', 'desc')
            .limit(10)
            .get();
        
        if (snapshot.empty) {
            container.innerHTML = '<div class="empty-actions">No hay acciones recientes</div>';
            return;
        }
        
        const actions = [];
        snapshot.forEach(doc => {
            actions.push(doc.data());
        });
        
        const sectionNames = {
            'canciones': '🎵 Canciones',
            'rincon': '💖 TuRincónFav',
            'sentimientos': '💭 Sentimientos',
            'thoseeyes': '👁️ Those Eyes',
            'series': '📺 Series',
            'razones': '✨ Razones',
            'openwhen': '✉️ Open When',
            'calendario': '📅 Calendario',
            'maldia': '☀️ Mal Día'
        };
        
        container.innerHTML = actions.map(action => `
            <div class="admin-action-item">
                <span class="action-icon">${action.action === 'unlock' ? '🔓' : '🔒'}</span>
                <span class="action-section">${sectionNames[action.section] || action.section}</span>
                <span class="action-time">${new Date(action.timestamp?.toDate()).toLocaleString()}</span>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error cargando acciones:', error);
        container.innerHTML = '<div class="empty-actions">Error al cargar</div>';
    }
}

// Inicializar panel de estadísticas
function initAdminStats() {
    renderStats();
    
    // Actualizar cada 30 segundos
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(() => {
        renderStats();
    }, 30000);
}

// Detener actualización automática
function stopStatsRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}

// Exportar
window.renderStats = renderStats;
window.initAdminStats = initAdminStats;
window.stopStatsRefresh = stopStatsRefresh;