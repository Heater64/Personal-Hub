// ==========================================
// thoseeyes.js · animacion, audio y letras
// ==========================================
function initThoseEyes() {
    if (typeof lucide !== 'undefined') lucide.createIcons();

    const starsCanvas = document.getElementById('stars');
    if (starsCanvas) {
        const ctx = starsCanvas.getContext('2d');
        let stars = [];

        const resize = () => {
            starsCanvas.width = window.innerWidth;
            starsCanvas.height = window.innerHeight;
            stars = Array.from({ length: 140 }, () => ({
                x: Math.random() * starsCanvas.width,
                y: Math.random() * starsCanvas.height,
                r: Math.random() * 1.2 + 0.3,
                sp: Math.random() * 0.008 + 0.002,
                ph: Math.random() * Math.PI * 2
            }));
        };

        const draw = (time) => {
            ctx.clearRect(0, 0, starsCanvas.width, starsCanvas.height);
            stars.forEach((star) => {
                const alpha = 0.1 + 0.3 * Math.abs(Math.sin(time * 0.001 * star.sp * 200 + star.ph));
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(230,220,210,${alpha})`;
                ctx.fill();
            });
            requestAnimationFrame(draw);
        };

        window.addEventListener('resize', resize);
        resize();
        requestAnimationFrame(draw);
    }

    const symbols = ['✦', '♡', '🌹', '·', '✧', '🌸'];
    function spawnPetal() {
        const element = document.createElement('div');
        element.className = 'petal';
        element.textContent = symbols[Math.floor(Math.random() * symbols.length)];
        element.style.left = `${Math.random() * 95}vw`;
        element.style.bottom = '-10px';
        element.style.fontSize = `${0.7 + Math.random() * 0.8}rem`;
        element.style.opacity = '0.4';
        const duration = 12 + Math.random() * 14;
        element.style.animationDuration = `${duration}s`;
        element.style.animationDelay = `${Math.random() * 2}s`;
        document.body.appendChild(element);
        setTimeout(() => element.remove(), (duration + 3) * 1000);
    }

    setInterval(spawnPetal, 4000);
    for (let i = 0; i < 2; i += 1) {
        setTimeout(spawnPetal, i * 1500);
    }

    const audioEl = document.getElementById('audio');
    const playBtn = document.getElementById('playBtn');
    const barsEl = document.getElementById('bars');
    const timeEl = document.getElementById('timeDisplay');
    const progress = document.getElementById('progressBar');
    const allLines = document.querySelectorAll('.lyric-line[data-start]');
    const closing = document.getElementById('closing');
    if (!audioEl || !playBtn || !barsEl || !timeEl || !progress) return;

    let playing = false;
    let lastActive = null;

    function fmt(sec) {
        const mins = Math.floor(sec / 60);
        const secs = Math.floor(sec % 60);
        return `${mins}:${String(secs).padStart(2, '0')}`;
    }

    function syncLyrics(time) {
        let activeEl = null;

        allLines.forEach((el) => {
            const start = parseFloat(el.dataset.start);
            const end = parseFloat(el.dataset.end);
            if (time >= start && time < end) activeEl = el;
        });

        if (activeEl === lastActive) return;
        lastActive = activeEl;

        allLines.forEach((el) => {
            el.classList.remove('active', 'past');
            if (time > parseFloat(el.dataset.end)) {
                el.classList.add('past');
            }
        });

        if (activeEl) {
            activeEl.classList.add('active');
            activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            if (closing && parseFloat(activeEl.dataset.start) >= 97) {
                setTimeout(() => closing.classList.add('visible'), 1800);
            }
        }
    }

    function updatePlayState(nextPlaying) {
        playing = nextPlaying;
        playBtn.textContent = nextPlaying ? '⏸' : '▶';
        barsEl.classList.toggle('playing', nextPlaying);
    }

    function togglePlay() {
        if (!playing) {
            audioEl.play().catch(() => {});
            updatePlayState(true);
        } else {
            audioEl.pause();
            updatePlayState(false);
        }
    }

    audioEl.addEventListener('timeupdate', () => {
        if (audioEl.duration) {
            timeEl.textContent = fmt(audioEl.currentTime);
            progress.style.width = `${(audioEl.currentTime / audioEl.duration) * 100}%`;
            syncLyrics(audioEl.currentTime);
        }
    });

    audioEl.addEventListener('ended', () => {
        updatePlayState(false);
    });

    window.addEventListener('load', () => {
        audioEl.play().then(() => {
            updatePlayState(true);
        }).catch(() => {});
    });

    playBtn.addEventListener('click', togglePlay);
    window.togglePlay = togglePlay;

    if (closing) {
        setTimeout(() => closing.classList.add('visible'), 120000);
    }
}

document.addEventListener('DOMContentLoaded', initThoseEyes);
