import { initHubGrid } from '../ui/hubGrid.js';

function boot() {
    initHubGrid('#hubGrid');
    if (typeof initDayCounter === 'function') {
        initDayCounter('homeDayCounter', '2025-07-03', 'días desde que llegaste');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}
