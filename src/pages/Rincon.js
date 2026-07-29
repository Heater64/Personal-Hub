/**
 * Rincón Page — Gallery, memes, and curiosities
 */
(function() {
  const SPB_DATA = {
    timeline: [
      { year: '1519', event: 'Primera expedición española llega a la región' },
      { year: '1591', event: 'Fundación de San Juan Bautista' },
      { year: '1810', event: 'Inicio de la independencia de Argentina' },
      { year: '1853', event: 'San Juan se convierte oficialmente en provincia' },
      { year: '1944', event: 'Terremoto de San Juan - reconstrucción de la ciudad' },
      { year: '2024', event: 'San Juan sigue siendo un destino turístico y cultural clave' },
    ],
    foods: ['Empanadas sanjuaninas', 'Vino de altura', 'Dulce de membrillo', 'Chivito', 'Olivos y aceite de oliva', 'Queso de cabra'],
    curiosities: [
      'San Juan produce el 90% del vino de altura del mundo.',
      'El Parque Nacional Ischigualasto (Valle de la Luna) está en San Juan.',
      'San Juan tiene el cielo más limpio de Argentina para observar estrellas.',
      'El Día del Vino Argentino se celebra en San Juan.',
    ]
  };

  const page = {
    name: 'rincon',

    mount(container) {
      container.innerHTML = this.render();
      this.afterMount(container);
    },

    render() {
      return `
        <div class="rincon-page">
          <div class="rincon-hero">
            <h1>Nuestro Rincón</h1>
            <p>Un espacio con nuestras cosas favoritas.</p>
          </div>

          <div class="rincon-subnav">
            <button class="sub-tab active" data-sub="inicio">🏠 Inicio</button>
            <button class="sub-tab" data-sub="galeria">📷 Galería</button>
            <button class="sub-tab" data-sub="memes">😄 Memes</button>
            <button class="sub-tab" data-sub="curiosidades">🌍 Curiosidades</button>
          </div>

          <div id="subInicio" class="sub-view active">
            <div class="rincon-welcome">
              <div class="rincon-welcome-card">
                <h2>Bienvenida a nuestro rincón 🤍</h2>
                <p>Aquí guardamos nuestras fotos, memes y todo lo que nos hace felices.</p>
              </div>
              <div class="rincon-stats">
                <div class="stat-bubble"><span>📸</span> Atardeceres</div>
                <div class="stat-bubble"><span>😂</span> Memes</div>
                <div class="stat-bubble"><span>🌍</span> San Juan</div>
              </div>
            </div>
          </div>

          <div id="subGaleria" class="sub-view">
            <div class="rincon-section-header">
              <h2>📷 Galería de Atardeceres</h2>
              <p>Los atardeceres más bonitos, como tú.</p>
            </div>
            <div id="galeriaGrid" class="rincon-media-grid">
              ${Array.from({length: 24}, (_, i) => `
                <div class="rincon-media-item" data-src="https://res.cloudinary.com/dcsent4fs/image/upload/v${1777747760 + i}/atardecer_${i + 1}.jpg">
                  <div class="rincon-media-placeholder">
                    <span>🌅</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <div id="subMemes" class="sub-view">
            <div class="rincon-section-header">
              <h2>😄 Nuestros Memes</h2>
              <p>Los memes que nos han hecho reír juntos.</p>
            </div>
            <div class="rincon-meme-folders">
              <button class="folder-btn active" data-folder="gatos">🐱 Gatos</button>
              <button class="folder-btn" data-folder="random">🎲 Random</button>
              <button class="folder-btn" data-folder="minecraft">⛏️ Minecraft</button>
            </div>
            <div id="memesGrid" class="rincon-media-grid">
              ${Array.from({length: 12}, (_, i) => `
                <div class="rincon-media-item" data-src="https://placekitten.com/${300 + i}/${300 + i}" data-video="${i % 4 === 0 ? 'true' : ''}">
                  <div class="rincon-media-placeholder">
                    <span>${i % 4 === 0 ? '🎬' : '😂'}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <div id="subCuriosidades" class="sub-view">
            <div class="rincon-section-header">
              <h2>🌍 San Juan Pueblo</h2>
              <p>Curiosidades y datos sobre nuestro lugar favorito.</p>
            </div>

            <div class="spb-stats">
              <div class="spb-stat-card"><div class="spb-stat-val">1519</div><div class="spb-stat-label">Primera Expedición</div></div>
              <div class="spb-stat-card"><div class="spb-stat-val">1853</div><div class="spb-stat-label">Provincia</div></div>
              <div class="spb-stat-card"><div class="spb-stat-val">90%</div><div class="spb-stat-label">Vino de Altura</div></div>
            </div>

            <div class="spb-section">
              <h3>📜 Línea de Tiempo</h3>
              <div class="spb-timeline">
                ${SPB_DATA.timeline.map(t => `
                  <div class="timeline-item">
                    <div class="timeline-dot"></div>
                    <div class="timeline-content">
                      <strong>${t.year}</strong>
                      <p>${t.event}</p>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>

            <div class="spb-section">
              <h3>🍽️ Comidas Típicas</h3>
              <div class="spb-food-chips">
                ${SPB_DATA.foods.map(f => `<span class="food-chip">${f}</span>`).join('')}
              </div>
            </div>

            <div class="spb-section">
              <h3>💡 Curiosidades</h3>
              ${SPB_DATA.curiosities.map((c, i) => `
                <div class="accordion-item">
                  <button class="accordion-trigger" data-acc="${i}">
                    <span>💡 Curiosidad ${i + 1}</span>
                    <i data-lucide="chevron-down"></i>
                  </button>
                  <div class="accordion-body" id="accBody${i}">
                    <p>${c}</p>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Lightbox -->
        <div class="lightbox" id="rinconLightbox" style="display:none;">
          <button class="lightbox-close" id="lbClose">&times;</button>
          <div class="lightbox-content" id="lbContent"></div>
        </div>

        <style>
          .rincon-page { max-width:1100px;margin:0 auto;padding:20px 0 60px; }
          .rincon-hero { text-align:center;margin-bottom:32px; }
          .rincon-hero h1 { font-family:'Playfair Display',serif;font-size:clamp(2rem,5vw,3.2rem);margin-bottom:8px; }
          .rincon-hero p { color:var(--umbra-ash); }
          .rincon-subnav { display:flex;gap:8px;flex-wrap:wrap;margin-bottom:28px;justify-content:center; }
          .sub-view { display:none; }
          .sub-view.active { display:block; animation: fadeIn 0.3s ease; }
          .rincon-welcome-card { background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:24px;padding:40px;text-align:center;margin-bottom:24px; }
          .rincon-welcome-card h2 { font-family:'Playfair Display',serif;font-size:1.8rem;margin-bottom:12px; }
          .rincon-stats { display:flex;gap:12px;justify-content:center;flex-wrap:wrap; }
          .stat-bubble { background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:40px;padding:10px 20px;font-size:0.9rem; }
          .stat-bubble span { margin-right:6px; }
          .rincon-section-header { text-align:center;margin-bottom:24px; }
          .rincon-section-header h2 { font-family:'Playfair Display',serif;font-size:1.6rem; }
          .rincon-section-header p { color:var(--umbra-ash); }
          .rincon-media-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px; }
          .rincon-media-item { aspect-ratio:1;border-radius:16px;overflow:hidden;cursor:pointer;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);transition:all 0.2s;display:flex;align-items:center;justify-content:center; }
          .rincon-media-item:hover { transform:scale(1.03);border-color:var(--accent-coral); }
          .rincon-media-placeholder { font-size:2.5rem;opacity:0.6; }
          .rincon-meme-folders { display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;justify-content:center; }
          .folder-btn { background:transparent;border:1px solid rgba(255,255,255,0.1);border-radius:30px;padding:8px 18px;color:var(--umbra-ash);cursor:pointer;font-size:0.82rem;transition:all 0.2s; }
          .folder-btn.active { background:var(--accent-coral);border-color:var(--accent-coral);color:white; }
          .folder-btn:hover:not(.active) { border-color:rgba(255,255,255,0.25);color:var(--umbra-light); }
          .spb-stats { display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-bottom:32px; }
          .spb-stat-card { background:rgba(255,255,255,0.03);border-radius:20px;padding:20px 28px;text-align:center;border:1px solid rgba(255,255,255,0.06);min-width:100px; }
          .spb-stat-val { font-size:1.8rem;font-weight:600;color:var(--accent-coral);font-family:'Playfair Display',serif; }
          .spb-stat-label { font-size:0.7rem;color:var(--umbra-ash);margin-top:4px; }
          .spb-section { margin-bottom:32px; }
          .spb-section h3 { font-family:'Playfair Display',serif;font-size:1.3rem;margin-bottom:16px; }
          .spb-timeline { position:relative;padding-left:24px; }
          .spb-timeline::before { content:'';position:absolute;left:8px;top:0;bottom:0;width:2px;background:var(--accent-coral);opacity:0.3; }
          .timeline-item { position:relative;margin-bottom:16px;padding-left:20px; }
          .timeline-dot { position:absolute;left:-20px;top:4px;width:12px;height:12px;border-radius:50%;background:var(--accent-coral);border:2px solid var(--bg); }
          .timeline-content strong { display:block;color:var(--accent-coral);margin-bottom:2px; }
          .timeline-content p { color:var(--umbra-ash);margin:0;font-size:0.85rem; }
          .spb-food-chips { display:flex;gap:8px;flex-wrap:wrap; }
          .food-chip { background:rgba(198,90,58,0.1);border:1px solid rgba(198,90,58,0.2);border-radius:30px;padding:6px 16px;font-size:0.82rem;color:var(--accent-coral); }
          .accordion-item { border-bottom:1px solid rgba(255,255,255,0.06); }
          .accordion-trigger { width:100%;display:flex;justify-content:space-between;align-items:center;padding:14px 0;background:none;border:none;color:var(--umbra-light);cursor:pointer;font-size:0.9rem; }
          .accordion-trigger i { width:18px;height:18px;transition:transform 0.2s; }
          .accordion-body { max-height:0;overflow:hidden;transition:max-height 0.3s ease;padding:0; }
          .accordion-body p { padding:0 0 14px;color:var(--umbra-ash);margin:0;font-size:0.85rem; }
          @media (max-width:640px) { .rincon-media-grid { grid-template-columns:repeat(2,1fr);gap:12px; } }
        </style>
      `;
    },

    afterMount(container) {
      // Sub-navigation
      container.querySelectorAll('[data-sub]').forEach(btn => {
        btn.addEventListener('click', () => {
          container.querySelectorAll('[data-sub]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          container.querySelectorAll('.sub-view').forEach(v => v.classList.remove('active'));
          const target = document.getElementById('sub' + btn.dataset.sub.charAt(0).toUpperCase() + btn.dataset.sub.slice(1));
          if (target) target.classList.add('active');
        });
      });

      // Gallery lightbox
      const lightbox = document.getElementById('rinconLightbox');
      const lbContent = document.getElementById('lbContent');
      const lbClose = document.getElementById('lbClose');

      function openLightbox(html) {
        lbContent.innerHTML = html;
        lightbox.style.display = 'flex';
        document.body.style.overflow = 'hidden';
      }

      function closeLightbox() {
        lightbox.style.display = 'none';
        document.body.style.overflow = '';
        lbContent.innerHTML = '';
      }

      lbClose.addEventListener('click', closeLightbox);
      lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });

      // Gallery click handlers
      container.querySelectorAll('#galeriaGrid .rincon-media-item').forEach(item => {
        item.addEventListener('click', () => {
          openLightbox(`
            <img src="${item.dataset.src}" alt="Galería" style="max-width:90vw;max-height:85vh;border-radius:12px;object-fit:contain;">
          `);
        });
      });

      // Meme folder switching
      container.querySelectorAll('.folder-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          container.querySelectorAll('.folder-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          Utils.showToast(`Mostrando memes de ${btn.dataset.folder}`);
        });
      });

      // Accordion
      container.querySelectorAll('.accordion-trigger').forEach(trigger => {
        trigger.addEventListener('click', () => {
          const body = document.getElementById('accBody' + trigger.dataset.acc);
          const icon = trigger.querySelector('i');
          if (!body) return;
          const isOpen = body.style.maxHeight && body.style.maxHeight !== '0px';
          if (isOpen) {
            body.style.maxHeight = '0px';
            body.style.padding = '0';
            if (icon) icon.style.transform = '';
          } else {
            body.style.maxHeight = body.scrollHeight + 'px';
            body.style.padding = '0 0 14px';
            if (icon) icon.style.transform = 'rotate(180deg)';
          }
        });
      });
    }
  };

  if (window.AppRouter) {
    AppRouter.register('rincon', () => page);
  }
})();
