import { initHubGrid } from '../ui/hubGrid.js';

function boot() {
    initHubGrid('#hubGrid');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}
