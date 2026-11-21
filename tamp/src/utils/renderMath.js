/* ==========================================
   renderMath — Renderiza texto con LaTeX y Markdown
   Soporta: $$bloque$$, $inline$, \(inline\),
   ### headings, **bold**, listas, saltos de línea
   ========================================== */

/* ==========================================
   KaTeX bajo demanda

   Antes se cargaba en `index.html` (una hoja y dos scripts) en TODAS las
   pantallas, aunque solo el calendario usa fórmulas: era el recurso externo
   más pesado del arranque. Ahora se pide cuando una pantalla que lo necesita
   se monta (`loadKatex()`), y si aún no ha llegado el texto se pinta como
   código — la vista nunca se bloquea esperándolo.
   ========================================== */
const KATEX_CDN = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist';
let katexLoading = null;

/** Carga KaTeX una sola vez. Resuelve `true` si queda disponible. */
export function loadKatex() {
  if (typeof document === 'undefined') return Promise.resolve(false);
  if (typeof window !== 'undefined' && typeof window.katex !== 'undefined') return Promise.resolve(true);
  if (katexLoading) return katexLoading;

  katexLoading = new Promise(resolve => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `${KATEX_CDN}/katex.min.css`;
    css.crossOrigin = 'anonymous';
    document.head.appendChild(css);

    const js = document.createElement('script');
    js.src = `${KATEX_CDN}/katex.min.js`;
    js.crossOrigin = 'anonymous';
    js.defer = true;
    js.onload = () => resolve(true);
    js.onerror = () => resolve(false);
    document.head.appendChild(js);
  });

  return katexLoading;
}

/**
 * Escapa HTML en un texto plano.
 * Preserva los marcadores de LaTeX extraídos previamente.
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Renderiza un bloque de texto con LaTeX matemático y formato markdown básico.
 * - `$$...$$` → math display (bloque centrado)
 * - `$...$` o `\(...\)` → math inline
 * - `### Texto` → heading
 * - `**texto**` → negrita
 * - `###` por línea → lista numerada implícita
 * - `\n` → `<br>`
 *
 * @param {string} text — texto raw del admin (puede contener LaTeX)
 * @returns {string} HTML renderizado
 */
export function renderMathText(text) {
  if (!text) return '';

  let html = text;

  // ── 1. Extraer LaTeX de bloque $$...$$ ──
  const displayBlocks = [];
  html = html.replace(/\$\$([\s\S]*?)\$\$/g, (_, tex) => {
    const idx = displayBlocks.length;
    displayBlocks.push(tex.trim());
    return `\x00DISPLAY_${idx}\x00`;
  });

  // ── 2. Extraer LaTeX inline $...$ y \(...\) ──
  const inlineBlocks = [];
  // \( ... \)
  html = html.replace(/\\\(([\s\S]*?)\\\)/g, (_, tex) => {
    const idx = inlineBlocks.length;
    inlineBlocks.push(tex.trim());
    return `\x00INLINE_${idx}\x00`;
  });
  // $ ... $  (no/confundir con $$ ya extraído)
  html = html.replace(/\$([^\$\n]+?)\$/g, (_, tex) => {
    const idx = inlineBlocks.length;
    inlineBlocks.push(tex.trim());
    return `\x00INLINE_${idx}\x00`;
  });

  // ── 3. Escapes HTML del texto restante ──
  html = escapeHtml(html);

  // ── 4. Formato markdown básico ──
  // ### headings
  html = html.replace(/^###\s+(.+)$/gm, '<h4 class="cal-math-heading">$1</h4>');
  html = html.replace(/^##\s+(.+)$/gm, '<h3 class="cal-math-heading">$1</h3>');
  html = html.replace(/^#\s+(.+)$/gm, '<h2 class="cal-math-heading">$1</h2>');

  // **bold**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Listas: líneas que empiezan con - o * → <li>
  html = html.replace(/^(?:[-*])\s+(.+)$/gm, '<li>$1</li>');
  // Envolver <li> consecutivos en <ul>
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul class="cal-math-list">$1</ul>');

  // Listas numeradas: 1. 2. etc.
  html = html.replace(/^(\d+)\.\s+(.+)$/gm, '<li>$2</li>');

  // Saltos de línea → <br>
  html = html.replace(/\n/g, '<br>');

  // Limpiar <br> redundantes antes/después de headings y listas
  html = html.replace(/<br>\s*(<h[234]|<ul|<li)/g, '$1');
  html = html.replace(/(<\/h[234]>|<\/ul>)\s*<br>/g, '$1');

  // ── 5. Restaurar LaTeX de bloque con renderizado KaTeX ──
  html = html.replace(/\x00DISPLAY_(\d+)\x00/g, (_, idx) => {
    const tex = displayBlocks[Number(idx)];
    if (typeof katex !== 'undefined') {
      try {
        return `<div class="cal-math-display">${katex.renderToString(tex, { displayMode: true, throwOnError: false, trust: false })}</div>`;
      } catch {
        return `<div class="cal-math-display cal-math-error"><code>${escapeHtml(tex)}</code></div>`;
      }
    }
    return `<div class="cal-math-display"><code>${escapeHtml(tex)}</code></div>`;
  });

  // ── 6. Restaurar LaTeX inline con renderizado KaTeX ──
  html = html.replace(/\x00INLINE_(\d+)\x00/g, (_, idx) => {
    const tex = inlineBlocks[Number(idx)];
    if (typeof katex !== 'undefined') {
      try {
        return katex.renderToString(tex, { displayMode: false, throwOnError: false, trust: false });
      } catch {
        return `<code class="cal-math-error">${escapeHtml(tex)}</code>`;
      }
    }
    return `<code>${escapeHtml(tex)}</code>`;
  });

  return html;
}
