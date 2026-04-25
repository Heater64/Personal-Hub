// ========== rincon.js ==========
let currentFolder = null;
let currentMemeFolder = "Favoritos ⭐";

function renderGallery() {
    const grid = document.getElementById('galleryGrid');
    if (!grid) return;
    grid.innerHTML = `
        <div class="pinterest-grid">
            ${Object.entries(window.galleryFoldersData).map(([name, images]) => `
                <div class="pinterest-item" onclick="showFolderContents('${escapeHtml(name)}')">
                    <img src="${escapeHtml(images[0])}" alt="${escapeHtml(name)}" loading="lazy">
                    <div class="overlay"><span><i data-lucide="folder"></i> ${escapeHtml(name)} · ${images.length} fotos</span></div>
                </div>
            `).join('')}
        </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function showFolderContents(folderName) {
    currentFolder = folderName;
    const images = window.galleryFoldersData[folderName];
    const grid = document.getElementById('galleryGrid');
    if (!grid) return;
    grid.innerHTML = `
        <button class="back-btn" onclick="renderGallery()" style="margin-bottom:16px;">
            <i data-lucide="arrow-left"></i> Volver a carpetas
        </button>
        <div class="pinterest-grid">
            ${images.map((src, i) => `
                <div class="pinterest-item" onclick="openLightbox('${escapeHtml(src)}', '${escapeHtml(folderName)} - ${i+1}')">
                    <img src="${escapeHtml(src)}" alt="${escapeHtml(folderName)} ${i+1}" loading="lazy">
                    <div class="overlay"><span><i data-lucide="eye"></i> Ver ${i+1}</span></div>
                </div>
            `).join('')}
        </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderMemes() {
    const nav = document.getElementById('memesFoldersNav');
    if (nav) {
        nav.innerHTML = Object.keys(window.memeImagesData).map(folder => `
            <button class="memes-folder-btn ${folder === currentMemeFolder ? 'active' : ''}" onclick="showMemeFolder('${escapeHtml(folder)}')">
                <i data-lucide="folder"></i> ${escapeHtml(folder)}
                <span class="folder-count">${window.memeImagesData[folder].length}</span>
            </button>
        `).join('');
    }
    const grid = document.getElementById('memesGrid');
    if (!grid) return;
    const items = window.memeImagesData[currentMemeFolder];
    if (!items || items.length === 0) {
        grid.innerHTML = '<div class="empty-state">No hay memes en esta carpeta</div>';
        return;
    }

    grid.innerHTML = items.map((src, i) => {
        const isVideo = src.match(/\.(mp4|webm|mov)$/i);
        if (isVideo) {
            return `
                <div class="insta-item video-meme" data-type="video" data-src="${escapeHtml(src)}" data-caption="${escapeHtml(currentMemeFolder)} - ${i+1}">
                    <video class="insta-video" src="${escapeHtml(src)}" muted loop playsinline preload="metadata"></video>
                    <div class="insta-overlay"><i data-lucide="play-circle"></i></div>
                </div>
            `;
        } else {
            return `
                <div class="insta-item" data-type="image" data-src="${escapeHtml(src)}" data-caption="${escapeHtml(currentMemeFolder)} - ${i+1}">
                    <img src="${escapeHtml(src)}" alt="Meme ${i+1}" loading="lazy">
                    <div class="insta-overlay"><i data-lucide="eye"></i></div>
                </div>
            `;
        }
    }).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();

    document.querySelectorAll('.insta-item').forEach(item => {
        const type = item.dataset.type;
        const src = item.dataset.src;
        const caption = item.dataset.caption;

        if (type === 'image') {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                openLightbox(src, caption);
            });
        } else if (type === 'video') {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                openVideoLightbox(src, caption);
            });
        }
    });
}

function showMemeFolder(folder) {
    currentMemeFolder = folder;
    renderMemes();
}

function renderGustos() {
    const panel = document.getElementById('gustosPanel');
    if (!panel) return;
    const d = window.gustosData;
    const podioHTML = d.podio.map(item => `
        <div class="planner-step" style="margin-bottom:12px;">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
                <span style="font-size:1.8rem;line-height:1;">${escapeHtml(item.medalla)}</span>
                <div>
                    <strong style="font-family:'Playfair Display',serif;font-size:1.1rem;font-weight:500;display:block;">${escapeHtml(item.titulo)}</strong>
                    <span style="font-size:0.72rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--accent-coral);">${escapeHtml(item.tipo)}</span>
                </div>
            </div>
            <p style="font-size:0.85rem;line-height:1.7;color:var(--umbra-ash);">${escapeHtml(item.descripcion)}</p>
        </div>
    `).join('');
    const personalHTML = `
        <div class="planner-grid" style="margin-top:8px;">
            <div class="planner-step">
                <h4 style="margin-bottom:10px;font-size:0.9rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--umbra-ash);">Personal</h4>
                <ul style="padding-left:18px;color:var(--umbra-ash);line-height:2;font-size:0.85rem;">
                    ${d.personal.map(i => `<li>${escapeHtml(i)}</li>`).join('')}
                </ul>
            </div>
            <div class="planner-step">
                <h4 style="margin-bottom:10px;font-size:0.9rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--umbra-ash);">Comida favorita</h4>
                <ul style="padding-left:18px;color:var(--umbra-ash);line-height:2;font-size:0.85rem;">
                    ${d.food.map(i => `<li>${escapeHtml(i)}</li>`).join('')}
                </ul>
            </div>
        </div>
    `;
    panel.innerHTML = `
        <div style="margin-bottom:28px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;">
                <i data-lucide="trophy"></i>
                <h4 style="margin:0;font-family:'Playfair Display',serif;font-size:1.2rem;">Series y películas favoritas</h4>
            </div>
            ${podioHTML}
        </div>
        <div style="border-top:var(--border-subtle);padding-top:24px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
                <i data-lucide="sparkles"></i>
                <h4 style="margin:0;font-family:'Playfair Display',serif;font-size:1.2rem;">Más cosas sobre ti</h4>
            </div>
            ${personalHTML}
        </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderCatFacts() {
    const list = document.getElementById('catFacts');
    if (!list) return;
    list.style.listStyle = 'none';
    list.style.padding = '0';
    list.innerHTML = `
        <p style="font-size:0.88rem;line-height:1.7;color:var(--umbra-ash);margin-bottom:20px;">
            Los gatos son mascotas fascinantes con comportamientos y capacidades que llevan siglos sorprendiendo a los humanos. Aquí van algunos datos que quizás no sabías.
        </p>
        <div style="display:grid;gap:14px;">
            ${window.catFactsData.map(f => `
                <div class="planner-step" style="display:flex;gap:14px;align-items:flex-start;">
                    <span style="font-size:1.4rem;line-height:1;flex-shrink:0;margin-top:2px;">${escapeHtml(f.icon)}</span>
                    <div>
                        <strong style="display:block;font-weight:500;margin-bottom:4px;">${escapeHtml(f.titulo)}</strong>
                        <p style="font-size:0.85rem;line-height:1.7;color:var(--umbra-ash);margin:0;">${escapeHtml(f.texto)}</p>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderSPB() {
    const panel = document.getElementById('spbPanel');
    if (!panel) return;
    const spb = window.spbData;
    panel.innerHTML = `
        <p style="font-size:0.9rem;line-height:1.8;color:var(--umbra-ash);margin-bottom:28px;border-left:2px solid var(--accent-coral);padding-left:16px;">
            ${escapeHtml(spb.intro)}
        </p>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
            <i data-lucide="sparkles"></i>
            <h4 style="margin:0;font-family:'Playfair Display',serif;font-size:1.2rem;">Curiosidades</h4>
        </div>
        <div style="display:grid;gap:14px;margin-bottom:32px;">
            ${spb.curiosidades.map(c => `
                <div class="planner-step" style="display:flex;gap:14px;align-items:flex-start;">
                    <span style="font-size:1.4rem;line-height:1;flex-shrink:0;margin-top:2px;">${escapeHtml(c.icon)}</span>
                    <div>
                        <strong style="display:block;font-weight:500;margin-bottom:4px;">${escapeHtml(c.titulo)}</strong>
                        <p style="font-size:0.85rem;line-height:1.7;color:var(--umbra-ash);margin:0;">${escapeHtml(c.texto)}</p>
                    </div>
                </div>
            `).join('')}
        </div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
            <i data-lucide="utensils"></i>
            <h4 style="margin:0;font-family:'Playfair Display',serif;font-size:1.2rem;">Gastronomía típica</h4>
        </div>
        <div class="planner-grid" style="margin-bottom:32px;">
            ${spb.foods.map(food => `
                <div class="planner-step">
                    <img src="${escapeHtml(food[1])}" alt="${escapeHtml(food[0])}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:var(--radius-md);margin-bottom:10px;" loading="lazy">
                    <strong style="font-family:'Playfair Display',serif;">${escapeHtml(food[0])}</strong>
                </div>
            `).join('')}
        </div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
            <i data-lucide="map-pin"></i>
            <h4 style="margin:0;font-family:'Playfair Display',serif;font-size:1.2rem;">Lugares imprescindibles</h4>
        </div>
        <div class="pinterest-grid" style="margin-bottom:32px;">
            ${spb.places.map(src => `
                <div class="pinterest-item" onclick="openLightbox('${escapeHtml(src)}', 'San Petersburgo')">
                    <img src="${escapeHtml(src)}" alt="San Petersburgo" loading="lazy">
                    <div class="overlay"><span><i data-lucide="eye"></i> Ver</span></div>
                </div>
            `).join('')}
        </div>
        <div class="planner-grid">
            <div class="planner-step">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
                    <i data-lucide="star"></i>
                    <h4 style="margin:0;font-family:'Playfair Display',serif;">Tradiciones</h4>
                </div>
                <ul style="padding-left:18px;color:var(--umbra-ash);line-height:2;font-size:0.85rem;">
                    ${spb.traditions.map(t => `<li>${escapeHtml(t)}</li>`).join('')}
                </ul>
            </div>
            <div class="planner-step">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
                    <i data-lucide="message-circle"></i>
                    <h4 style="margin:0;font-family:'Playfair Display',serif;">Frases en ruso</h4>
                </div>
                <ul style="padding-left:18px;color:var(--umbra-ash);line-height:2;font-size:0.85rem;">
                    ${spb.phrases.map(p => `<li>${escapeHtml(p)}</li>`).join('')}
                </ul>
            </div>
        </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function showSubview(viewId) {
    const parent = document.getElementById('rincon');
    if (!parent) return;
    parent.querySelectorAll('.sub-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.subview === viewId) tab.classList.add('active');
    });
    parent.querySelectorAll('.sub-view').forEach(view => {
        view.classList.remove('active');
        if (view.id === viewId) view.classList.add('active');
    });
}

function openVideoLightbox(videoSrc, caption) {
    let videoLightbox = document.getElementById('videoLightbox');
    if (!videoLightbox) {
        videoLightbox = document.createElement('div');
        videoLightbox.id = 'videoLightbox';
        videoLightbox.className = 'lightbox video-lightbox';
        videoLightbox.innerHTML = `
            <button class="lightbox-close" id="closeVideoLightbox">✕</button>
            <div class="lightbox-content" id="videoLightboxContent">
                <video id="lightboxVideo" controls playsinline></video>
            </div>
            <div class="lightbox-caption"></div>
        `;
        document.body.appendChild(videoLightbox);

        document.getElementById('closeVideoLightbox').addEventListener('click', () => {
            if (window.videoPlayer) window.videoPlayer.destroy();
            videoLightbox.classList.remove('open');
        });
        videoLightbox.addEventListener('click', (e) => {
            if (e.target === videoLightbox) {
                if (window.videoPlayer) window.videoPlayer.destroy();
                videoLightbox.classList.remove('open');
            }
        });
    }

    videoLightbox.classList.add('open');
    const videoEl = document.getElementById('lightboxVideo');
    const captionEl = videoLightbox.querySelector('.lightbox-caption');
    captionEl.textContent = caption;
    videoEl.src = videoSrc;
    videoEl.load();

    if (typeof Plyr !== 'undefined') {
        if (window.videoPlayer) window.videoPlayer.destroy();
        window.videoPlayer = new Plyr(videoEl, {
            controls: ['play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'],
            autoplay: true,
            muted: false
        });
    } else {
        videoEl.controls = true;
        videoEl.play().catch(() => {});
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('galleryGrid')) renderGallery();
    if (document.getElementById('memesGrid')) renderMemes();
    if (document.getElementById('gustosPanel')) renderGustos();
    if (document.getElementById('catFacts')) renderCatFacts();
    if (document.getElementById('spbPanel')) renderSPB();
    document.querySelectorAll('.sub-tab[data-subview]').forEach(tab => {
        tab.addEventListener('click', function() {
            showSubview(this.dataset.subview);
        });
    });
});