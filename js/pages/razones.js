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
        <button class="reason-item" data-index="${index}">
            <div class="reason-top">
                <span class="reason-number">${index + 1}</span>
                <strong>${item.short}</strong>
            </div>
            <div class="reason-extra">${item.long}</div>
        </button>
    `).join('');
}

function initRazones() {
    const list = document.getElementById('reasonsList');
    const button = document.getElementById('randomReasonBtn');
    renderReasons();
    paintRandomReason();
    if (button) button.addEventListener('click', paintRandomReason);
    if (list) {
        list.addEventListener('click', function (event) {
            const reason = event.target.closest('.reason-item');
            if (!reason) return;
            document.querySelectorAll('.reason-item').forEach(item => item.classList.remove('active'));
            reason.classList.add('active');
        });
    }
}

document.addEventListener('DOMContentLoaded', initRazones);
