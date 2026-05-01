// ==========================================
// together-counter.js · Contador de días juntos
// ==========================================
(function() {
    // Cambia esta fecha a la fecha en que empezaron a estar juntos
    const START_DATE = new Date('2024-06-27T00:00:00');

    function updateCounter() {
        const now = new Date();
        const diff = now - START_DATE;

        // Calcular días, horas, minutos, segundos
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        // Actualizar DOM
        const daysEl = document.getElementById('daysCount');
        const hoursEl = document.getElementById('hoursCount');
        const minutesEl = document.getElementById('minutesCount');
        const secondsEl = document.getElementById('secondsCount');

        if (daysEl) {
            const currentDays = parseInt(daysEl.textContent) || 0;
            if (days !== currentDays) {
                daysEl.classList.add('count-up');
                setTimeout(() => daysEl.classList.remove('count-up'), 300);
            }
            daysEl.textContent = days.toLocaleString();
        }
        if (hoursEl) hoursEl.textContent = hours.toString().padStart(2, '0');
        if (minutesEl) minutesEl.textContent = minutes.toString().padStart(2, '0');
        if (secondsEl) secondsEl.textContent = seconds.toString().padStart(2, '0');
    }

    // Actualizar cada segundo
    function initCounter() {
        updateCounter();
        setInterval(updateCounter, 1000);
    }

    // Iniciar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCounter);
    } else {
        initCounter();
    }
})();