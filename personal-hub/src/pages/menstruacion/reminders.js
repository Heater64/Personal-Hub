/* ==========================================
   Menstruación — recordatorios locales
   Usa el sistema de notificaciones existente (permiso, silencio,
   service worker). El texto es genérico a propósito: en la pantalla
   bloqueada no aparece nada del ciclo.
   ========================================== */

import {
  getNotifSettings,
  inQuietHours,
  isEnabled,
  showDailyNotification,
} from '../../services/notifications.service.js';
import { getUserPref, setUserPref } from '../../utils/userStorage.js';
import { todayISO, timeInSpain } from '../../utils/format.js';
import { daysBetween } from '../../utils/cycleMath.js';

export async function maybeNotify(ctx) {
  if (!isEnabled()) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const prefs = ctx.data?.settings?.notifications;
  if (!prefs) return;
  if (inQuietHours(getNotifSettings())) return;

  const today = todayISO();

  if (prefs.daily && timeInSpain() >= (prefs.dailyTime || '20:00')) {
    if (getUserPref('cycleReminderDate') !== today) {
      const shown = await showDailyNotification(
        'Tu seguimiento',
        'Tienes un aviso en tu seguimiento. Ábrelo cuando quieras.',
        '/menstruacion',
        { tag: 'cycle-daily' }
      );
      if (shown) setUserPref('cycleReminderDate', today);
    }
  }

  if (prefs.period && ctx.cycle?.nextStart) {
    const days = daysBetween(today, ctx.cycle.nextStart);
    const key = `cyclePeriodReminder.${ctx.cycle.nextStart}`;
    if (days !== null && days >= 0 && days <= 2 && getUserPref(key) !== '1') {
      const shown = await showDailyNotification(
        'Tu seguimiento',
        'Puede que tu periodo esté cerca. Es una estimación.',
        '/menstruacion',
        { tag: 'cycle-period' }
      );
      if (shown) setUserPref(key, '1');
    }
  }
}
