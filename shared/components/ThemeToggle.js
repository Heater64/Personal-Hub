// shared/components/ThemeToggle.js
// Componente Toggle de Tema

import themeService from '../../services/theme/theme.service.js';
import { hasAcceptedLightBeta, showLightBetaModal } from '../dialogs/betaModal.js';

export function createThemeToggle(container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'theme-toggle';

    const btn = document.createElement('button');
    btn.className = 'theme-toggle__btn';
    btn.setAttribute('aria-label', 'Cambiar tema');
    btn.setAttribute('role', 'switch');
    btn.setAttribute('aria-checked', themeService.isDark() ? 'true' : 'false');

    const icon = document.createElement('i');
    icon.dataset.lucide = themeService.isDark() ? 'moon' : 'sun';
    btn.appendChild(icon);

    function updateIcon() {
        const isDark = themeService.isDark();
        btn.setAttribute('aria-checked', isDark ? 'true' : 'false');
        icon.dataset.lucide = isDark ? 'moon' : 'sun';
        if (typeof lucide !== 'undefined') {
            lucide.createIcons({ root: btn });
        }
    }

    btn.addEventListener('click', () => {
        const nextTheme = themeService.isDark() ? 'light' : 'dark';

        if (nextTheme === 'light' && !hasAcceptedLightBeta()) {
            showLightBetaModal({
                onAccept: () => {
                    themeService.setTheme('light');
                    updateIcon();
                },
                onCancel: () => {}
            });
            return;
        }

        themeService.setTheme(nextTheme);
        updateIcon();
    });

    themeService.onThemeChange(() => {
        updateIcon();
    });

    wrapper.appendChild(btn);

    if (container) {
        container.appendChild(wrapper);
    }

    return wrapper;
}