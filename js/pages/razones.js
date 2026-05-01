// ==========================================
// razones.js · razones interactivas
// ==========================================
const reasons = [
    { short: '', long: '' },
    { short: '', long: '' },
    { short: '', long: '' },
    { short: '', long: '' },
    { short: '', long: '' },
    { short: '', long: '' },
    { short: '', long: '' },
    { short: '', long: '' },
    { short: '', long: '' },
    { short: '', long: '' }
];

function celebrateReason(source) {
    if (typeof launchParticles === 'function') {
        launchParticles({
            amount: 9,
            symbols: ['❤', '✦'],
            colors: ['#c65a3a', '#ff8aa1', '#ffb347'],
            spread: 110,
            source: source || null
        });
    }
}

function paintRandomReason() {
    const title = document.getElementById('randomReasonTitle');
    const text = document.getElementById('randomReasonText');
    if (!title || !text || !reasons.length) return;

    const item = reasons[Math.floor(Math.random() * reasons.length)];
    title.textContent = item.short;
    text.textContent = item.long;
}

function renderReasons() {
    const list = document.getElementById('reasonsList');
    if (!list) return;

    list.innerHTML = reasons.map((item, index) => `
        <button class="reason-item" type="button" data-index="${index}">
            <div class="reason-shell">
                <span class="reason-number">${index + 1}</span>
                <span class="reason-title">${escapeHtml(item.short)}</span>
                <span class="reason-icon" aria-hidden="true">
                    <i data-lucide="heart"></i>
                </span>
            </div>
            <div class="reason-extra">${escapeHtml(item.long)}</div>
        </button>
    `).join('');

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function selectReason(reason) {
    document.querySelectorAll('.reason-item').forEach((item) => item.classList.remove('active'));
    reason.classList.add('active');
    if (typeof pulseElement === 'function') {
        pulseElement(reason.querySelector('.reason-number'));
    }
    celebrateReason(reason.querySelector('.reason-number'));
}

function initRazones() {
    const list = document.getElementById('reasonsList');
    const button = document.getElementById('randomReasonBtn');

    renderReasons();
    paintRandomReason();

    if (button) {
        button.addEventListener('click', function () {
            paintRandomReason();
            if (typeof pulseElement === 'function') pulseElement(button);
            celebrateReason(button);
        });
    }

    if (list) {
        list.addEventListener('click', function (event) {
            const reason = event.target.closest('.reason-item');
            if (!reason) return;
            selectReason(reason);
        });
    }
}

document.addEventListener('DOMContentLoaded', initRazones);
