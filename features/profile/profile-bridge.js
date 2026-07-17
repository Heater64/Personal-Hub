// features/profile/profile-bridge.js
// Puente (módulo) que expone las dependencias ES-module en window.*
// para que profile.js (cargado como script clásico) pueda usarlas.
// Solo necesitamos theme.service.js (los demás los gestiona js/sidebar.js).

import themeService from '../../services/theme/theme.service.js';
import { hasAcceptedLightBeta, showLightBetaModal } from '../../shared/dialogs/betaModal.js';

window.ThemeService = themeService;
window.themeService = themeService;
window.BetaModal = { hasAcceptedLightBeta, showLightBetaModal };

window.dispatchEvent(new Event('profile:bridge-ready'));
