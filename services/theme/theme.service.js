// services/theme/theme.service.js
// Gestión de temas (oscuro/claro)

const THEME_STORAGE_KEY = 'personalHub.theme';
const COLOR_THEME_KEY = 'personalHub.colorTheme';

class ThemeService {
    constructor() {
        this.currentTheme = 'dark';
        this.currentColorTheme = 'coral';
        this.availableThemes = ['dark', 'light', 'auto'];
        this.availableColorThemes = ['coral', 'ocean', 'forest', 'violet', 'rose', 'amber', 'mono'];
        this.listeners = [];
        this.init();
    }

    init() {
        // Cargar tema guardado
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        if (saved && this.availableThemes.includes(saved)) {
            this.currentTheme = saved;
        } else if (this.currentTheme === 'auto') {
            // Usar preferencia del sistema
            this.currentTheme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
        }

        // Cargar color theme
        const savedColor = localStorage.getItem(COLOR_THEME_KEY);
        if (savedColor && this.availableColorThemes.includes(savedColor)) {
            this.currentColorTheme = savedColor;
        }

        // Cargar accesibilidad
        this.accessibility = {
            highContrast: localStorage.getItem('personalHub.a11y.hc') === '1',
            largeText: localStorage.getItem('personalHub.a11y.lg') === '1',
            reducedMotion: localStorage.getItem('personalHub.a11y.rm') === '1'
        };

        this.applyTheme(this.currentTheme);
        this.applyColorTheme(this.currentColorTheme);
        this.applyAccessibility();

        // Escuchar cambios del sistema
        if (window.matchMedia) {
            const media = window.matchMedia('(prefers-color-scheme: light)');
            media.addEventListener('change', (e) => {
                if (this.currentTheme === 'auto') {
                    const newTheme = e.matches ? 'light' : 'dark';
                    this.applyTheme(newTheme);
                }
            });
        }
    }

    setTheme(theme) {
        if (!this.availableThemes.includes(theme)) return;
        this.currentTheme = theme;
        this.applyTheme(theme);
        localStorage.setItem(THEME_STORAGE_KEY, theme);
        this.notifyListeners();
    }

    setColorTheme(colorTheme) {
        if (!this.availableColorThemes.includes(colorTheme)) return;
        this.currentColorTheme = colorTheme;
        this.applyColorTheme(colorTheme);
        localStorage.setItem(COLOR_THEME_KEY, colorTheme);
        this.notifyListeners();
    }

    toggle() {
        const next = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(next);
        return next;
    }

    applyTheme(theme) {
        if (theme === 'auto') {
            const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
            document.documentElement.setAttribute('data-theme', prefersLight ? 'light' : 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
        document.documentElement.style.colorScheme = theme === 'auto' ? 'dark light' : theme;

        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
            const colors = {
                dark: '#0c0b0b',
                light: '#f5f3f0'
            };
            meta.content = colors[theme] || colors.dark;
        }
    }

    applyColorTheme(colorTheme) {
        document.documentElement.setAttribute('data-color-theme', colorTheme);
    }

    onThemeChange(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    subscribe(callback) {
        return this.onThemeChange(callback);
    }

    notifyListeners() {
        this.listeners.forEach(cb => {
            try { cb({ theme: this.currentTheme, color: this.currentColorTheme }); } catch (e) {}
        });
    }

    /* Accesibilidad */
    setAccessibility(key, value) {
        this.accessibility[key] = value;
        var keyMap = { highContrast: 'hc', largeText: 'lg', reducedMotion: 'rm' };
        localStorage.setItem('personalHub.a11y.' + keyMap[key], value ? '1' : '0');
        this.applyAccessibility();
    }

    getThemeState() {
        return Object.assign({}, this.accessibility, { theme: this.currentTheme, color: this.currentColorTheme });
    }

    applyAccessibility() {
        if (typeof document === 'undefined') return;
        var hc = this.accessibility.highContrast || false;
        var lg = this.accessibility.largeText || false;
        var rm = this.accessibility.reducedMotion || false;
        document.documentElement.setAttribute('data-high-contrast', hc ? 'true' : 'false');
        document.documentElement.setAttribute('data-large-text', lg ? 'true' : 'false');
        document.documentElement.setAttribute('data-reduced-motion', rm ? 'true' : 'false');
    }

    getCurrentTheme() {
        return this.currentTheme;
    }

    getCurrentColorTheme() {
        return this.currentColorTheme;
    }

    isDark() {
        return this.currentTheme === 'dark';
    }

    isLight() {
        return this.currentTheme === 'light';
    }
}

const themeService = new ThemeService();

if (typeof window !== 'undefined') {
    window.themeService = themeService;
}

export default themeService;