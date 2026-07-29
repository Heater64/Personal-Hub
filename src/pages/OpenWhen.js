/**
 * Open When Page — Cartas interactivas
 */
(function() {
  const LETTERS = [
    {
      title: "Ábrela cuando sientas que no te amo.",
      note: "Cosa que no es verdad, yo siempre te amo y te amaré por siempre jamás.",
      message: "Te amo mucho y quiero que sepas que siempre estaré aquí para ti, apoyándote en cada paso del camino. Porque estamos juntos en esto. Peluche y princesa para siempre. 🤍🤍🤍"
    },
    {
      title: "Ábrela cuando estés triste.",
      note: "No estás sola, siempre hay alguien que piensa en ti.",
      message: "Sé que a veces las cosas no salen como queremos, pero quiero que recuerdes que eres increíble. Tu sonrisa ilumina mi mundo y no hay nada que no puedas superar. Estoy aquí para ti, siempre. 🤍"
    },
    {
      title: "Ábrela cuando necesites un abrazo.",
      note: "Aunque no pueda darte un abrazo físico, aquí tienes uno virtual.",
      message: "Imagina que te abrazo muy fuerte, que acaricio tu pelo y te digo al oído todo lo que te quiero. Eres la persona más importante para mí y deseo poder abrazarte ahora mismo. 🫂🤍"
    },
    {
      title: "Ábrela cuando estés orgullosa de ti.",
      note: "Porque tienes mucho que celebrar.",
      message: "¡Mira todo lo que has logrado! Estoy tan orgulloso de ti y de la persona increíble que eres. Cada día me sorprendes más con tu fuerza, tu inteligencia y tu corazón enorme. ¡Te mereces el mundo! 🌟🤍"
    },
    {
      title: "Ábrela cuando tengas dudas.",
      note: "Sobre nosotros, sobre ti, sobre lo que sea.",
      message: "Si alguna vez tienes dudas, recuerda esto: te elijo hoy, mañana y siempre. No hay nada que pueda cambiar lo que siento por ti. Eres mi persona favorita en este universo y siempre lo serás. 💫🤍"
    },
    {
      title: "Ábrela cuando simplemente quieras sentirte querida.",
      note: "Porque siempre mereces saberlo.",
      message: "Eres hermosa, inteligente, divertida, fuerte y única. No hay nadie como tú en este mundo y me siento el afortunado de tenerte en mi vida. Te quiero más de lo que las palabras pueden expresar. 💕🤍"
    }
  ];

  const page = {
    name: 'openwhen',

    mount(container) {
      container.innerHTML = this.render();
      this.afterMount(container);
    },

    render() {
      return `
        <div class="openwhen-container">
          <div class="openwhen-header">
            <h1>Open When</h1>
            <p>Aquí añadiré cartitas para mi princesa jsjsj</p>
          </div>
          <div class="letters-grid" id="lettersGrid">
            ${LETTERS.map((l, i) => `
              <div class="letter-card" data-id="${i}">
                <div class="card-icon">
                  <i data-lucide="mail"></i>
                </div>
                <h3>${Utils.escapeHtml(l.title)}</h3>
                <div class="letter-note">${Utils.escapeHtml(l.note)}</div>
                <button class="open-btn" data-id="${i}">
                  <i data-lucide="mail-open"></i> Abrir carta
                </button>
                <div class="letter-content-open">
                  <div class="letter-heart">🤍</div>
                  <div class="letter-message">${Utils.escapeHtml(l.message).replace(/\n/g, '<br>')}</div>
                  <div class="letter-signature">— Con todo mi cariño: Peluchito</div>
                  <button class="close-btn" data-id="${i}">
                    <i data-lucide="x"></i> Cerrar sobre
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    },

    afterMount(container) {
      // Open buttons
      container.querySelectorAll('.open-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const card = btn.closest('.letter-card');
          if (!card) return;
          // Close others
          document.querySelectorAll('.letter-card.open').forEach(oc => {
            if (oc !== card) oc.classList.remove('open');
          });
          card.classList.add('open');
        });
      });

      // Close buttons
      container.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const card = btn.closest('.letter-card');
          if (card) card.classList.remove('open');
        });
      });
    }
  };

  if (window.AppRouter) {
    AppRouter.register('openwhen', () => page);
  }
})();
