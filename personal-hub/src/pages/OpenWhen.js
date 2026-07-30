/* ==========================================
   Personal Hub v2 — Open When Page
   Cartas interactivas para momentos especiales
   ========================================== */

const LETTERS = [
  {
    title: "Ábrela cuando sientas que no te amo.",
    note: "Cosa que no es verdad, yo siempre te amo y te amaré por siempre jamás.",
    message: "Te amo mucho y quiero que sepas que siempre estaré aquí para ti, apoyándote en cada paso del camino. Porque estamos juntos en esto. Peluche y princesa para siempre."
  },
  {
    title: "Ábrela cuando estés triste.",
    note: "No estás sola, siempre hay alguien que piensa en ti.",
    message: "Sé que a veces las cosas no salen como queremos, pero quiero que recuerdes que eres increíble. Tu sonrisa ilumina mi mundo y no hay nada que no puedas superar. Estoy aquí para ti, siempre."
  },
  {
    title: "Ábrela cuando necesites un abrazo.",
    note: "Aunque no pueda darte un abrazo físico, aquí tienes uno virtual.",
    message: "Imagina que te abrazo muy fuerte, que acaricio tu pelo y te digo al oído todo lo que te quiero. Eres la persona más importante para mí y deseo poder abrazarte ahora mismo."
  },
  {
    title: "Ábrela cuando estés orgullosa de ti.",
    note: "Porque tienes mucho que celebrar.",
    message: "¡Mira todo lo que has logrado! Estoy tan orgulloso de ti y de la persona increíble que eres. Cada día me sorprendes más con tu fuerza, tu inteligencia y tu corazón enorme. ¡Te mereces el mundo!"
  },
  {
    title: "Ábrela cuando tengas dudas.",
    note: "Sobre nosotros, sobre ti, sobre lo que sea.",
    message: "Si alguna vez tienes dudas, recuerda esto: te elijo hoy, mañana y siempre. No hay nada que pueda cambiar lo que siento por ti. Eres mi persona favorita en este universo y siempre lo serás."
  },
  {
    title: "Ábrela cuando simplemente quieras sentirte querida.",
    note: "Porque siempre mereces saberlo.",
    message: "Eres hermosa, inteligente, divertida, fuerte y única. No hay nadie como tú en este mundo y me siento el afortunado de tenerte en mi vida. Te quiero más de lo que las palabras pueden expresar."
  }
];

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : m === '>' ? '&gt;' : m === '"' ? '&quot;' : '&#39;');
}

export function OpenWhenPage(router) {
  const page = document.createElement('div');
  page.className = 'openwhen-page';

  function render() {
    page.innerHTML = `
      <div class="openwhen-container">
        <div class="openwhen-header">
          <h1>Open When</h1>
          <p>Aquí añadiré cartitas para mi princesa jsjsj</p>
        </div>
        <div class="openwhen-grid" id="lettersGrid">
          ${LETTERS.map((l, i) => `
            <div class="card openwhen-card" data-id="${i}">
              <div class="openwhen-card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg>
              </div>
              <h3>${escapeHtml(l.title)}</h3>
              <div class="openwhen-note">${escapeHtml(l.note)}</div>
              <button class="openwhen-open-btn" data-id="${i}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/></svg>
                Abrir carta
              </button>
              <div class="openwhen-content">
                <div class="openwhen-message">${escapeHtml(l.message).replace(/\n/g, '<br>')}</div>
                <div class="openwhen-signature">— Con todo mi cariño: Peluchito</div>
                <button class="openwhen-close-btn" data-id="${i}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  Cerrar sobre
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  render();

  // Bind events
  requestAnimationFrame(() => {
    // Open buttons
    page.querySelectorAll('.openwhen-open-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = btn.closest('.openwhen-card');
        if (!card) return;
        // Close others
        page.querySelectorAll('.openwhen-card.open').forEach(oc => {
          if (oc !== card) oc.classList.remove('open');
        });
        card.classList.add('open');
      });
    });

    // Close buttons
    page.querySelectorAll('.openwhen-close-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = btn.closest('.openwhen-card');
        if (card) card.classList.remove('open');
      });
    });
  });

  return page;
}
