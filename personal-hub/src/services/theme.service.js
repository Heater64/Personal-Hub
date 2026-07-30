/* ==========================================
   Personal Hub v2 — Theme Service
   Gestión de temas (oscuro/claro/auto)
   ========================================== */

const STORAGE_KEY = 'ph.theme';

class ThemeService {
  constructor() {
    this.currentTheme = 'dark';
    this._listeners = [];
    this._init();
  }

  _init() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && ['dark', 'light', 'auto'].includes(saved)) {
      this.currentTheme = saved;
    }
    this.apply(this.currentTheme);

    // Listen to system changes
    if (window.matchMedia) {
      const media = window.matchMedia('(prefers-color-scheme: light)');
      media.addEventListener('change', () => {
        if (this.currentTheme === 'auto') {
          this._applyTheme(media.matches ? 'light' : 'dark');
        }
      });
    }
  }

  getAvailable() {
    return ['dark', 'light', 'auto'];
  }

  setTheme(theme) {
    if (!['dark', 'light', 'auto'].includes(theme)) return;
    this.currentTheme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
    this.apply(theme);
    this._notify(theme);
  }

  apply(theme) {
    let resolved = theme;
    if (theme === 'auto') {
      resolved = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    this._applyTheme(resolved);
  }

  _applyTheme(resolved) {
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.style.colorScheme = resolved;

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.content = resolved === 'dark' ? '#0c0b0b' : '#fdf4f6';
    }
  }

  isDark() {
    return this.currentTheme === 'dark' ||
      (this.currentTheme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
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
