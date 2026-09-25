/* ==========================================
   Theme Service
   3 paletas (coral · frambuesa · azul) × 3 modos (auto · oscuro · claro).

   La estructura visual es la misma en todas: los componentes leen
   tokens semánticos, así que cambiar de paleta solo reescribe colores.
   Atributos en <html>:  data-paleta="coral|frambuesa|azul"
                         data-theme="dark|light"
   ========================================== */

const PALETA_KEY = 'ph.paleta';
const MODO_KEY = 'ph.modo';
const LEGACY_KEY = 'ph.theme';

export const PALETAS = [
  { id: 'coral',      label: 'Coral',      hint: 'Cálida, la de siempre',  preview: '#e8735a' },
  { id: 'frambuesa',  label: 'Frambuesa',  hint: 'Romántica y suave',      preview: '#c2185b' },
  { id: 'azul',       label: 'Azul',       hint: 'Limpia y minimalista',   preview: '#2563eb' }
];

export const MODOS = [
  { id: 'auto',  label: 'Auto',   icon: 'monitor' },
  { id: 'dark',  label: 'Oscuro', icon: 'moon' },
  { id: 'light', label: 'Claro',  icon: 'sun' }
];

const META_COLORS = {
  coral:     { dark: '#0a0a0c', light: '#f7f2ee' },
  frambuesa: { dark: '#140a10', light: '#f8edf0' },
  azul:      { dark: '#0b1220', light: '#f8fafc' }
};

/** Traduce cualquier identificador histórico al par paleta/modo. */
function decodeTheme(value) {
  if (!value) return null;
  const id = String(value);

  if (id === 'auto') return { modo: 'auto' };
  if (id === 'dark' || id === 'umbra-oscuro') return { paleta: 'coral', modo: 'dark' };
  if (id === 'light' || id === 'umbra-claro') return { paleta: 'frambuesa', modo: 'light' };
  if (id === 'azul-oscuro') return { paleta: 'azul', modo: 'dark' };
  if (id === 'azul-claro') return { paleta: 'azul', modo: 'light' };

  const match = id.match(/^(coral|frambuesa|azul)(?:-(oscuro|claro|dark|light))?$/);
  if (match) {
    const modo = match[2];
    if (!modo) return { paleta: match[1] };
    if (modo === 'auto') return { paleta: match[1], modo: 'auto' };
    return { paleta: match[1], modo: (modo === 'oscuro' || modo === 'dark') ? 'dark' : 'light' };
  }
  return null;
}

class ThemeService {
  constructor() {
    this._listeners = [];
    this.currentTheme = 'coral-dark';

    const storedPaleta = localStorage.getItem(PALETA_KEY);
    const storedModo = localStorage.getItem(MODO_KEY);
    const legacy = localStorage.getItem(LEGACY_KEY);
    const fromLegacy = legacy ? decodeTheme(legacy) : null;

    this.paleta = PALETAS.some(p => p.id === storedPaleta)
      ? storedPaleta
      : (fromLegacy?.paleta || 'coral');

    this.modo = ['auto', 'dark', 'light'].includes(storedModo)
      ? storedModo
      : (fromLegacy?.modo || 'auto');

    this.apply();

    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
        if (this.modo === 'auto') this.apply();
      });
    }
  }

  /** Modo real resuelto (auto → preferencia del sistema). */
  resolveModo() {
    if (this.modo === 'auto') {
      return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    return this.modo;
  }

  apply() {
    const modo = this.resolveModo();
    const el = document.documentElement;
    el.dataset.paleta = this.paleta;
    el.dataset.theme = modo;
    el.style.colorScheme = modo;

    // Compatibilidad con CSS antiguo que miraba data-tema
    if (this.paleta === 'azul') el.dataset.tema = 'azul';
    else delete el.dataset.tema;

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.content = META_COLORS[this.paleta]?.[modo]
        || (modo === 'light' ? '#f8fafc' : '#0a0a0c');
    }

    this.currentTheme = `${this.paleta}-${modo}`;
  }

  getPaleta() { return this.paleta; }
  getModo() { return this.modo; }
  getPaletas() { return PALETAS; }
  getModos() { return MODOS; }

  setPaleta(id) {
    const decoded = decodeTheme(id);
    const next = decoded?.paleta || id;
    if (!PALETAS.some(p => p.id === next)) return;
    this.paleta = next;
    localStorage.setItem(PALETA_KEY, next);
    this.apply();
    this._notify();
  }

  setModo(id) {
    const decoded = decodeTheme(id);
    const next = decoded?.modo || id;
    if (!['auto', 'dark', 'light'].includes(next)) return;
    this.modo = next;
    localStorage.setItem(MODO_KEY, next);
    this.apply();
    this._notify();
  }

  /** API heredada: acepta ids antiguos y nuevos. */
  setTheme(id) {
    const decoded = decodeTheme(id);
    if (!decoded) return;
    if (decoded.paleta) this.setPaleta(decoded.paleta);
    if (decoded.modo) this.setModo(decoded.modo);
  }

  /** API heredada. */
  getAvailable() {
    return ['coral-oscuro', 'coral-claro', 'frambuesa-oscuro', 'frambuesa-claro', 'azul-oscuro', 'azul-claro', 'auto'];
  }

  isDark() { return this.resolveModo() === 'dark'; }

  onChange(callback) {
    this._listeners.push(callback);
    return () => { this._listeners = this._listeners.filter(cb => cb !== callback); };
  }

  _notify() {
    this._listeners.forEach(cb => {
      try { cb(this.currentTheme); } catch { /* un listener roto no rompe el tema */ }
    });
  }
}

export const theme = new ThemeService();
