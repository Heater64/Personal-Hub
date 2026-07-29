/**
 * Home Page — Dashboard principal con novedades dinámicas
 * Carga las noticias desde Firestore (admin panel) o localStorage como fallback
 */
(function() {
  const PAGE_NAME = 'home';
  let newsData = [];
  let expandedAll = false;

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, function(m) {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      return m;
    });
  }

  function renderNewsHTML(news) {
    if (!news || news.length === 0) {
      return '<p style="color:var(--umbra-ash);text-align:center;padding:20px;">✨ No hay novedades por ahora. Vuelve pronto!</p>';
    }

    var items = news.filter(function(n) { return n.type !== 'separator'; });
    var showCount = expandedAll ? items.length : Math.min(3, items.length);
    var hasMore = items.length > 3;

    var html = '';
    for (var i = 0; i < showCount; i++) {
      var item = items[i];
      var hasLocation = item.location && item.location.href;
      html +=
        '<div class="news-item" data-index="' + item.id + '">' +
          '<div class="news-item-top">' +
            '<span class="news-date">' + escapeHtml(item.date || '') + '</span>' +
          '</div>' +
          '<span class="news-item-title">' + escapeHtml(item.title) + '</span>' +
          '<p class="news-item-desc">' + escapeHtml(item.description || '') + '</p>';
      if (hasLocation) {
        html += '<a href="' + escapeHtml(item.location.href) + '" class="news-go-btn"><i data-lucide="arrow-right"></i> Ir a la secci\u00f3n</a>';
      }
      html += '</div>';
    }

    if (hasMore) {
      html +=
        '<button class="news-toggle-btn" id="newsToggleBtn">' +
          '<i data-lucide="' + (expandedAll ? 'chevron-up' : 'chevron-down') + '"></i> ' +
          (expandedAll ? 'Mostrar menos' : 'Mostrar ' + (items.length - 3) + ' noticias m\u00e1s') +
        '</button>';
    }

    return html;
  }

  const page = {
    name: PAGE_NAME,

    async mount(container) {
      // Show loading state
      container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--umbra-ash);">Cargando...</div>';

      // Load news from service
      try {
        if (window.NewsService) {
          newsData = await window.NewsService.loadNews();
        } else {
          newsData = [];
        }
      } catch (e) {
        newsData = [];
      }

      container.innerHTML = this.render();
      this.afterMount(container);
    },

    render: function() {
      var today = new Date();
      var hour = today.getHours();
      var greeting = hour < 12 ? 'Buenos d\u00edas' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
      var startDate = new Date('2023-06-15');
      var daysSince = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));

      var cards = [
        { icon: 'sparkles', label: 'Razones', desc: 'Por qu\u00e9 te quiero', nav: 'razones' },
        { icon: 'mail', label: 'Open When', desc: 'Cartas para momentos', nav: 'openwhen' },
        { icon: 'calendar-days', label: 'Calendario', desc: 'Sorpresas diarias', nav: 'calendario' },
        { icon: 'sun-medium', label: 'Mal D\u00eda', desc: 'Un abrazo para ti', nav: 'maldia' },
        { icon: 'tv', label: 'Series', desc: 'Biblioteca + Podio', nav: 'series' },
        { icon: 'eye', label: 'Those Eyes', desc: 'Canci\u00f3n con letras', nav: 'thoseeyes' },
        { icon: 'compass', label: 'Rinc\u00f3n', desc: 'Galer\u00eda, memes y m\u00e1s', nav: 'rincon' },
        { icon: 'music', label: 'Canciones', desc: 'Reproductor + Letras', nav: 'canciones' },
        { icon: 'gamepad-2', label: 'Juegos', desc: 'Mini juegos', nav: 'juegos' },
      ];

      var cardsHtml = '';
      for (var i = 0; i < cards.length; i++) {
        var c = cards[i];
        cardsHtml +=
          '<a class="hub-card" href="#' + c.nav + '" data-nav="' + c.nav + '" style="display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:18px;border-radius:18px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);text-decoration:none;color:inherit;transition:all 0.2s;">' +
            '<div style="width:38px;height:38px;border-radius:12px;background:rgba(198,90,58,0.1);display:flex;align-items:center;justify-content:center;color:var(--accent-coral);">' +
              '<i data-lucide="' + c.icon + '" style="width:18px;height:18px;"></i>' +
            '</div>' +
            '<h3 style="font-size:0.9rem;font-weight:600;margin:0;color:var(--umbra-light);">' + c.label + '</h3>' +
            '<p style="font-size:0.72rem;color:var(--umbra-ash);margin:0;line-height:1.3;">' + c.desc + '</p>' +
          '</a>';
      }

      return '' +
        '<section class="home-section">' +
          '<!-- Hero -->' +
          '<div class="home-hero" style="text-align:center;padding:40px 20px;background:rgba(255,255,255,0.02);border-radius:24px;border:1px solid rgba(255,255,255,0.06);margin-bottom:24px;">' +
            '<div class="home-hero-content">' +
              '<p class="home-hero-greeting" style="font-size:0.85rem;letter-spacing:0.1em;color:var(--umbra-ash);margin-bottom:8px;">' + greeting + ' \u2728</p>' +
              '<h1 class="home-hero-title" style="font-family:\'Playfair Display\',serif;font-size:clamp(2rem,5vw,3rem);margin-bottom:8px;">Tu espacio personal</h1>' +
              '<p class="home-hero-sub" style="color:var(--umbra-ash);">Han pasado <strong style="color:var(--accent-coral);">' + daysSince + '</strong> d\u00edas desde que empezamos esta historia \ud83e\udd0d</p>' +
            '</div>' +
          '</div>' +

          '<!-- News -->' +
          '<div class="home-card" style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:24px;padding:24px;margin-bottom:24px;">' +
            '<div class="home-card-header" style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">' +
              '<i data-lucide="sparkles" style="color:var(--accent-coral);width:22px;height:22px;"></i>' +
              '<h2 style="font-family:\'Playfair Display\',serif;font-size:1.3rem;margin:0;">Novedades</h2>' +
            '</div>' +
            '<div class="home-news-content" id="newsContent">' +
              renderNewsHTML(newsData) +
            '</div>' +
          '</div>' +

          '<!-- Hub Grid -->' +
          '<div class="hub-grid" id="hubGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px;">' +
            cardsHtml +
          '</div>' +
        '</section>';
    },

    afterMount: function(container) {
      // Hub card navigation — use delegation instead of individual listeners
      if (!container._hubNavBound) {
        container.addEventListener('click', function(e) {
          var card = e.target.closest('.hub-card[data-nav]');
          if (card) {
            e.preventDefault();
            window.location.hash = card.getAttribute('data-nav');
          }
        });
        container._hubNavBound = true;
      }

      // News toggle — always bind fresh
      var toggleBtn = document.getElementById('newsToggleBtn');
      if (toggleBtn && !toggleBtn._bound) {
        toggleBtn._bound = true;
        toggleBtn.addEventListener('click', function() {
          expandedAll = !expandedAll;
          var content = document.getElementById('newsContent');
          if (content) {
            content.innerHTML = renderNewsHTML(newsData);
            // Only re-bind toggle, not full afterMount
            page._bindToggle();
            page._bindGoButtons(container);
          }
        });
      }

      page._bindGoButtons(container);
    },

    _bindToggle: function() {
      var toggleBtn = document.getElementById('newsToggleBtn');
      if (toggleBtn && !toggleBtn._bound) {
        toggleBtn._bound = true;
        toggleBtn.addEventListener('click', function() {
          expandedAll = !expandedAll;
          var content = document.getElementById('newsContent');
          if (content) {
            content.innerHTML = renderNewsHTML(newsData);
            page._bindToggle();
            page._bindGoButtons(document.getElementById('view'));
          }
        });
      }
    },

    _bindGoButtons: function(container) {
      var goBtns = container.querySelectorAll('.news-go-btn:not(._bound)');
      for (var j = 0; j < goBtns.length; j++) {
        goBtns[j].classList.add('_bound');
        goBtns[j].addEventListener('click', function(e) {
          e.preventDefault();
          var href = this.getAttribute('href');
          if (href && href.charAt(0) === '#') {
            window.location.hash = href.substring(1);
          }
        });
      }
    }
  };

  if (window.AppRouter) {
    AppRouter.register(PAGE_NAME, function() { return page; });
  }
})();
