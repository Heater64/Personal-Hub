/* ==========================================
   Personal Hub v2 — Theme Service
   Gestión de temas (4 paletas + auto)
   ========================================== */

const STORAGE_KEY = 'ph.theme';

const THEMES = ['umbra-oscuro', 'umbra-claro', 'azul-oscuro', 'azul-claro'];

const THEME_METAS = {
  'umbra-oscuro': '#0c0b0b',
  'umbra-claro': '#fdf4f6',
  'azul-oscuro': '#0B1020',
  'azul-claro': '#faf6f8'
};

class ThemeService {
  constructor() {
    this.currentTheme = 'umbra-oscuro';
    this._listeners = [];
    this._init();
  }

  normalize(id) {
    if (id === 'auto' || THEMES.includes(id)) return id;
    if (id === 'dark') return 'umbra-oscuro';
    if (id === 'light') return 'umbra-claro';
    return 'auto';
  }

  _init() {
    const saved = localStorage.getItem(STORAGE_KEY);
    this.currentTheme = this.normalize(saved);
    this.apply(this.currentTheme);

    // Listen to system changes
    if (window.matchMedia) {
      const media = window.matchMedia('(prefers-color-scheme: light)');
      media.addEventListener('change', () => {
        if (this.currentTheme === 'auto') {
          this.apply('auto');
        }
      });
    }
  }

  getAvailable() {
    return [...THEMES, 'auto'];
  }

  setTheme(id) {
    const next = this.normalize(id);
    this.currentTheme = next;
    localStorage.setItem(STORAGE_KEY, next);
    this.apply(next);
    this._notify(next);
  }

  apply(id) {
    const palette = this.normalize(id);
    let mode;
    let metaKey = palette;
    if (palette === 'auto') {
      mode = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      metaKey = mode === 'light' ? 'umbra-claro' : 'umbra-oscuro';
    } else {
      mode = /-oscuro$/.test(palette) ? 'dark' : 'light';
    }
    this._applyTheme(mode, metaKey, palette);
  }

  _applyTheme(mode, metaKey, palette) {
    const el = document.documentElement;
    el.dataset.theme = mode;
    if (palette && palette.indexOf('azul-') === 0) {
      el.dataset.tema = 'azul';
    } else {
      delete el.dataset.tema;
    }
    el.style.colorScheme = mode;

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.content = THEME_METAS[metaKey] || (mode === 'light' ? '#fdf4f6' : '#0c0b0b');
    }
  }

  isDark() {
    if (this.currentTheme === 'auto') {
      return !window.matchMedia('(prefers-color-scheme: light)').matches;
    }
    return /-oscuro$/.test(this.currentTheme);
  }

  onChange(callback) {
    this._listeners.push(callback);
    return () => {
      this._listeners = this._listeners.filter(cb => cb !== callback);
    };
  }

  _notify(theme) {
    this._listeners.forEach(cb => {
      try { cb(theme); } catch (e) { /* */ }
    });
  }
}

export const theme = new ThemeService();
