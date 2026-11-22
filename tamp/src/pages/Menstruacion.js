/* ==========================================
   Personal Hub — Menstruación (orquestador)
   Sección dentro de Sentimientos con navegación interna propia.
   Aquí solo viven el ciclo de vida, el estado compartido y el
   enrutado entre vistas; los cálculos están en utils/cycleMath.js y
   la persistencia en services/cycle.service.js.
   ========================================== */

import '../styles/menstruacion.css';
import { renderPageHeader } from '../components/PageHeader.js';
import { icon } from '../components/ui.js';
import { escapeHtml } from '../utils/escape.js';
import { todayISO } from '../utils/format.js';
import { computeCycle, estimatedPeriods } from '../utils/cycleMath.js';
import * as cycleService from '../services/cycle.service.js';
import { userStore } from '../stores/user.store.js';
import { isNative } from '../services/native.service.js';
import { saveCycleWidget } from '../services/widgets.service.js';

import { renderHome, bindHome } from './menstruacion/home.js';
import { renderCalendar, bindCalendar } from './menstruacion/calendar.js';
import { renderLog, bindLog } from './menstruacion/log.js';
import { renderHistory, bindHistory } from './menstruacion/history.js';
import { renderStats, bindStats } from './menstruacion/stats.js';
import { renderSettings, bindSettings } from './menstruacion/settings.js';
import { renderPartner, bindPartner } from './menstruacion/partner.js';
import {
  openLogSheet,
  openPeriodSheet,
  openDaySheet,
  setConfirmReload,
} from './menstruacion/sheets.js';
import { maybeNotify } from './menstruacion/reminders.js';

const TABS = [
  { id: 'inicio', label: 'Inicio', icon: 'home' },
  { id: 'calendario', label: 'Calendario', icon: 'calendar' },
  { id: 'registro', label: 'Registro', icon: 'pencil' },
  { id: 'historial', label: 'Historial', icon: 'archive' },
  { id: 'estadisticas', label: 'Estadísticas', icon: 'chart' },
  { id: 'ajustes', label: 'Ajustes', icon: 'gear' },
];

const VIEWS = {
  inicio: [renderHome, bindHome],
  calendario: [renderCalendar, bindCalendar],
  registro: [renderLog, bindLog],
  historial: [renderHistory, bindHistory],
  estadisticas: [renderStats, bindStats],
  ajustes: [renderSettings, bindSettings],
  pareja: [renderPartner, bindPartner],
};

function fallbackSettings() {
  return {
    avgCycleLength: 28,
    avgPeriodLength: 5,
    lutealPhaseLength: 14,
    notifications: { daily: false, dailyTime: '20:00', period: false },
    preferences: { showFertile: true, showOvulation: true },
  };
}

export function MenstruacionPage(router) {
  const page = document.createElement('div');
  page.className = 'menstruacion-page';

  // El chico no tiene ciclo: para él esta sección es solo la vista de pareja
  // (lo que ella comparte). No ve pestañas de registro, historial ni ajustes,
  // porque no puede —ni debe— apuntar nada en su nombre.
  const partnerOnly = userStore.isAdmin;

  const today = todayISO();
  const [year, month] = today.split('-').map(Number);

  const ctx = {
    page,
    router,
    data: null,
    snapshot: null,
    sharing: null,
    today,
    cycle: null,
    ranges: [],
    ui: {
      tab: 'inicio',
      year,
      month: month - 1,
      statsWindow: 6,
      logDate: today,
      loading: true,
      error: '',
      firstLoad: true,
    },
    setTab(tab) {
      ctx.ui.tab = VIEWS[tab] ? tab : 'inicio';
      paint();
    },
    repaint() {
      paint();
    },
    async reload() {
      await load();
    },
    openLog(date) {
      openLogSheet(ctx, date || ctx.today);
    },
    openPeriod(period = null, start = null) {
      openPeriodSheet(ctx, period, start);
    },
    openDay(date) {
      openDaySheet(ctx, date);
    },
  };

  setConfirmReload(() => ctx.reload());

  function compute() {
    ctx.today = todayISO();
    const periods = ctx.data?.periods || [];
    const settings = ctx.data?.settings || fallbackSettings();
    ctx.cycle = computeCycle({ periods, settings, today: ctx.today });
    ctx.ranges = estimatedPeriods({ periods, settings, today: ctx.today, count: 8 });

    // El widget del ciclo se escribe desde aquí, que es donde el paquete está
    // completo (el Inicio no carga datos de ciclo). Solo con datos, solo en el
    // APK y solo en la cuenta de ella: el resumen de pareja no se guarda.
    if (isNative() && !partnerOnly && ctx.cycle?.hasData) {
      saveCycleWidget({
        phase: ctx.cycle.phase?.label || '',
        day: ctx.cycle.cycleDay,
        next: ctx.cycle.nextStart,
        days: ctx.cycle.daysUntilNext,
        length: ctx.cycle.avgCycle,
      });
    }
  }

  function subtitle() {
    const describeCycle = cycle => cycle.isOverdue
      ? `${cycle.phase.label} · día ${cycle.cycleDay} · estimación superada`
      : `${cycle.phase.label} · día ${cycle.cycleDay} de ~${cycle.avgCycle}`;
    if (partnerOnly) {
      const snap = ctx.snapshot;
      if (snap?.shared) {
        const c = computeCycle({
          periods: snap.periods || [],
          settings: snap.settings || {},
          today: ctx.today,
        });
        if (c?.hasData) return describeCycle(c);
      }
      return 'Lo que ella comparte contigo';
    }
    if (ctx.cycle?.hasData) {
      return describeCycle(ctx.cycle);
    }
    return 'Tu ciclo, con tus datos y tus reglas';
  }

  function skeleton() {
    return `<div class="cy-skeleton" aria-live="polite">
      <span class="cy-skeleton-line"></span>
      <span class="cy-skeleton-line"></span>
      <span class="cy-skeleton-line"></span>
      <small>Cargando tu seguimiento…</small>
    </div>`;
  }

  function renderBody() {
    const view = VIEWS[ctx.ui.tab] || VIEWS.inicio;
    return view[0](ctx);
  }

  function bindBody() {
    const root = page.querySelector('.cy-view');
    if (!root) return;
    const view = VIEWS[ctx.ui.tab] || VIEWS.inicio;
    view[1](root, ctx);
  }

  function paint() {
    const tabs = partnerOnly ? [{ id: 'pareja', label: 'Pareja', icon: 'heart' }] : [...TABS];
    if (!partnerOnly && ctx.snapshot?.shared) {
      tabs.push({ id: 'pareja', label: 'Pareja', icon: 'heart' });
    }
    if (!tabs.some(tab => tab.id === ctx.ui.tab)) ctx.ui.tab = tabs[0].id;

    let body;
    if (ctx.ui.loading && !ctx.data) body = skeleton();
    else body = renderBody();

    page.innerHTML = `
      ${renderPageHeader({ title: 'Menstruación', subtitle: subtitle() })}
      ${
        tabs.length > 1
          ? `<nav class="chips cy-nav" role="tablist" aria-label="Secciones de Menstruación">
        ${tabs
          .map(
            tab => `
          <button type="button" class="chip cy-nav-chip${tab.id === ctx.ui.tab ? ' chip--active' : ''}"
            role="tab" aria-selected="${tab.id === ctx.ui.tab}" data-tab="${tab.id}">
            ${icon(tab.icon, 15)}<span>${tab.label}</span>
          </button>
        `
          )
          .join('')}
      </nav>`
          : ''
      }
      ${ctx.ui.error ? `<p class="cy-error" role="alert">${escapeHtml(ctx.ui.error)}</p>` : ''}
      <div class="cy-view">${body}</div>
    `;

    page.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        ctx.ui.tab = btn.dataset.tab;
        paint();
      });
    });

    bindBody();
  }

  async function load() {
    ctx.ui.loading = true;
    ctx.ui.error = '';
    if (!ctx.data) paint();

    try {
      ctx.data = await cycleService.loadAll();
      const [sharing, snapshot] = await Promise.all([
        cycleService.loadSharing().catch(() => null),
        cycleService.getPartnerSnapshot().catch(() => ({ shared: false })),
      ]);
      ctx.sharing = sharing;
      ctx.snapshot = snapshot;
    } catch (err) {
      ctx.ui.error = err?.message || 'No se pudieron cargar tus datos.';
      if (!ctx.data) {
        ctx.data = { settings: fallbackSettings(), periods: [], logs: [] };
      }
    } finally {
      ctx.ui.loading = false;
      compute();

      if (ctx.ui.firstLoad) {
        const requested = router?.currentRoute?.query?.tab;
        const ownEmpty = !(ctx.data?.periods || []).length && !(ctx.data?.logs || []).length;
        if (partnerOnly) ctx.ui.tab = 'pareja';
        else if (requested && VIEWS[requested]) ctx.ui.tab = requested;
        else if (ctx.snapshot?.shared && ownEmpty) ctx.ui.tab = 'pareja';
        ctx.ui.firstLoad = false;
      }

      paint();
      // Los recordatorios son suyos: al chico no se le avisa del ciclo de ella.
      if (!ctx.ui.error && !partnerOnly) {
        maybeNotify(ctx).catch(() => {
          /* sin permiso: se ignora */
        });
      }
    }
  }

  load();

  return page;
}
