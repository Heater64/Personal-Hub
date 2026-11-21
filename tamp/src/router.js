/* ==========================================
   Personal Hub v2 — SPA Router
   Hash-based router for simple navigation
   Soporta componentes async (lazy) y cleanup por página
   ========================================== */

import { escapeHtml } from './utils/escape.js';
import {
  cancelRestore,
  flushScroll,
  initScrollMemory,
  keyFor,
  newKey,
  restoreScroll,
  savedY,
  setActiveKey,
} from './utils/scrollMemory.js';

/** Cuánto puede tardar una página en llegar antes de enseñar el skeleton. */
const SKELETON_DELAY_MS = 120;

const ROUTE_SKELETON = `<div class="route-loading" role="status" aria-live="polite">
            <span class="route-loading__spinner" aria-hidden="true"></span>
            <span>Cargando…</span>
          </div>`;

/**
 * Entrada suave de la página recién montada.
 *
 * Con `prefers-reduced-motion: reduce` no se añade ninguna clase: no hay
 * desplazamiento ni zoom, el cambio es instantáneo (el CSS además anula la
 * animación por si la clase llegara de otro sitio). Es solo entrada: no se
 * retrasa el montaje ni la salida de la página anterior, así que no hay
 * parpadeo ni navegación más lenta.
 */
function enterTransition(el) {
  if (!el?.classList) return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  el.classList.add('route-enter');
  const done = () => el.classList.remove('route-enter');
  el.addEventListener('animationend', done, { once: true });
  // Respaldo: si el CSS decide no animar (pestaña en segundo plano), la
  // clase no puede quedarse pegada.
  setTimeout(done, 400);
}

export class Router {
  constructor(options = {}) {
    this.routes = [];
    this.currentRoute = null;
    this._beforeHooks = [];
    this._afterHooks = [];
    this._container = options.container || document.getElementById('app');
    this._onRouteChange = options.onRouteChange || null;
    this._pendingNavigation = null;
    this._currentComponent = null;
    this._navToken = 0;
    this._navigationDepth = 0;
    this._ignoreHashChange = null;

    // Cada entrada interna lleva profundidad propia. Así el botón Atrás
    // puede comportarse como una navegación nativa sin sacar al usuario de
    // la app cuando acaba de abrirla desde un enlace externo.
    this._pendingScroll = null;

    // El documento no se desplaza (el scroll lo lleva .main), así que el
    // navegador no puede devolvernos a donde estábamos: lo hace scrollMemory.
    // 'manual' deja claro que esa responsabilidad es nuestra.
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    initScrollMemory();

    const initialPath = this.getCurrentPath();
    const currentState = history.state || {};
    if (currentState.__phRouter) {
      this._navigationDepth = Number.isFinite(currentState.phDepth)
        ? Math.max(0, currentState.phDepth)
        : 0;
    } else {
      history.replaceState({ ...currentState, __phRouter: true, phDepth: 0, phPath: initialPath }, '', window.location.href);
    }

    // Cada entrada de historial tiene su propia posición. Al recargar (F5) la
    // entrada sobrevive, así que también se vuelve al mismo punto.
    const initialKey = keyFor(history.state) || newKey();
    history.replaceState({ ...(history.state || {}), __phScrollKey: initialKey }, '', window.location.href);
    setActiveKey(initialKey);
    this._pendingScroll = { key: initialKey, y: savedY(initialKey) };

    window.addEventListener('popstate', (event) => {
      const state = event.state || {};
      // La posición de la entrada que abandonamos se guarda ya mismo: puede
      // quedar un frame pendiente y no queremos perderla al cambiar de clave.
      flushScroll();
      this._navigationDepth = state.__phRouter && Number.isFinite(state.phDepth)
        ? Math.max(0, state.phDepth)
        : 0;
      // Toda entrada interna tiene clave de scroll propia. Si llega una de
      // fuera, se le asigna ahora para poder guardarle la posición.
      let key = keyFor(state);
      if (!key) {
        key = newKey();
        history.replaceState({ ...state, __phScrollKey: key }, '', window.location.href);
      }
      setActiveKey(key);
      // Entradas internas de la MISMA ruta (overlays, vistas de página):
      // las gestiona quien las creó. Re-renderizar aquí montaría la página
      // de nuevo y perdería el estado que se está restaurando.
      if (this.currentRoute && this.getCurrentPath() === this.currentRoute.path) {
        this._pendingScroll = null;
        return;
      }
      // Atrás/adelante: la entrada destino manda su propia posición.
      this._pendingScroll = { key, y: savedY(key) };
      // Traversing a hash history entry may also emit hashchange. Ignore the
      // duplicate event so a page is not mounted twice on mobile back.
      this._ignoreHashChange = window.location.hash;
      this._handleRoute();
    });
    window.addEventListener('hashchange', () => {
      if (this._ignoreHashChange === window.location.hash) {
        this._ignoreHashChange = null;
        return;
      }
      this._handleRoute();
    });
    window.addEventListener('load', () => this._handleRoute());
  }

  setContainer(el) {
    this._container = el;
    // If there was a pending navigation, resolve it now
    if (this._pendingNavigation) {
      this._handleRoute();
      this._pendingNavigation = false;
    }
  }

  addRoute(path, component, options = {}) {
    this.routes.push({
      path,
      component,
      title: options.title || 'Tamp',
      protected: options.protected || false,
      adminOnly: options.adminOnly || false,
      skipMood: options.skipMood || false
    });
    return this;
  }

  beforeEach(callback) {
    this._beforeHooks.push(callback);
    return this;
  }

  afterEach(callback) {
    this._afterHooks.push(callback);
    return this;
  }

  navigate(path) {
    const target = `#${path}`;
    if (window.location.hash === target) return;

    flushScroll();
    this._navigationDepth += 1;
    const key = newKey();
    history.pushState({
      ...(history.state || {}),
      __phRouter: true,
      phDepth: this._navigationDepth,
      phPath: path,
      __phScrollKey: key
    }, '', target);
    setActiveKey(key);
    // Navegación nueva: empieza arriba, sin heredar el desplazamiento anterior.
    this._pendingScroll = null;
    this._handleRoute();
  }

  /**
   * Vuelve a la pantalla anterior dentro de la app. Si la página actual se
   * abrió directamente, usa un destino seguro en vez de abandonar la web.
   */
  back(fallback = '/') {
    // También cuando hay una vista interna encima (overlay o subvista de
    // página): Atrás debe desapilarla antes de salir de la ruta.
    if (this._navigationDepth > 0 || history.state?.__phInPage) {
      history.back();
      return;
    }
    this.replace(fallback);
  }

  /**
   * Sube al principio de la página actual. Lo usa tocar la pestaña en la que
   * ya estás: en una app nativa eso te devuelve arriba, no te deja a medias.
   */
  scrollToTop(smooth = true) {
    cancelRestore();
    const el = this._scrollEl();
    if (!el) {
      window.scrollTo(0, 0);
      return;
    }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    if (smooth && !reduce) el.scrollTo({ top: 0, behavior: 'smooth' });
    else el.scrollTop = 0;
  }

  /** El único scroller de la app: .main (el documento no se desplaza). */
  _scrollEl() {
    return this._container?.closest('.main') || document.querySelector('.main');
  }

  /** Aplica el desplazamiento que corresponde a la entrada recién montada. */
  _applyScroll() {
    const pending = this._pendingScroll;
    this._pendingScroll = null;
    if (pending?.key) restoreScroll(pending.key, pending.y);
    else this.scrollToTop(false);
  }

  /**
   * Navegación que REEMPLAZA la entrada de historial actual.
   * Para redirects automáticos (guards de auth/admin, rutas inexistentes,
   * logout): evita que el botón Atrás vuelva a una ruta protegida y dispare
   * un bucle infinito de redirects (p. ej. #/login ← → ruta protegida).
   */
  replace(path) {
    const target = `#${path}`;
    // Si ya estamos en el destino solo re-render (los guards redirigen por
    // path, nunca cuando ya estás en el destino, así que no hay recursión).
    if (window.location.hash === target) {
      this._handleRoute();
      return;
    }
    flushScroll();
    const key = newKey();
    history.replaceState({
      ...(history.state || {}),
      __phRouter: true,
      phDepth: this._navigationDepth,
      phPath: path,
      __phScrollKey: key
    }, '', target);
    setActiveKey(key);
    this._pendingScroll = null;
    this._handleRoute();
  }

  getCurrentPath() {
    const hash = window.location.hash.slice(1) || '/';
    // Normalizar barras finales para consistencia: todos los consumidores
    // (guards, nav activa, currentRoute.path) ven la misma ruta.
    return hash.length > 1 ? hash.replace(/\/+$/, '') : hash;
  }

  matchRoute(path) {
    // Split query string (p. ej. /rincon?tab=curiosidades) — el query
    // queda disponible en route.query para las páginas que hagan deep-link
    const qIndex = path.indexOf('?');
    const base = qIndex === -1 ? path : path.slice(0, qIndex);
    const query = {};
    if (qIndex !== -1) {
      path.slice(qIndex + 1).split('&').forEach(pair => {
        if (!pair) return;
        const eq = pair.indexOf('=');
        const k = eq === -1 ? pair : pair.slice(0, eq);
        const v = eq === -1 ? '' : pair.slice(eq + 1);
        try {
          if (k) query[decodeURIComponent(k)] = decodeURIComponent(v || '');
        } catch { /* query malformado: ignorar */ }
      });
    }

    // Normalizar: una barra final (/rincon/) no debe caer en la ruta
    // inexistente → redirigiría al inicio sin motivo.
    const normalized = base.length > 1 ? base.replace(/\/+$/, '') : base;

    // Exact match first
    let route = this.routes.find(r => r.path === normalized);
    if (route) return { ...route, query };

    // Dynamic segments like /profile/:id
    for (const r of this.routes) {
      const pattern = r.path.replace(/:([^/]+)/g, '([^/]+)');
      const regex = new RegExp(`^${pattern}$`);
      const match = normalized.match(regex);
      if (match) {
        const params = {};
        const keys = r.path.match(/:([^/]+)/g) || [];
        keys.forEach((key, i) => {
          params[key.slice(1)] = match[i + 1];
        });
        return { ...r, params, query };
      }
    }

    return null;
  }

  async _handleRoute() {
    const path = this.getCurrentPath();

    // Wait for container to be ready (AppShell may not have set it yet)
    if (!this._container || !this._container.parentNode) {
      this._pendingNavigation = true;
      return;
    }

    // Token de navegación: descarta renders obsoletos si el usuario navega
    // mientras los hooks o un componente lazy (async) están en curso.
    // Se toma ANTES de los hooks porque son async y pueden intercalarse.
    const navToken = ++this._navToken;

    // Run before hooks (can cancel navigation or redirect)
    let route = this.matchRoute(path);
    for (const hook of this._beforeHooks) {
      const result = await hook(path, route);
      if (result === false) return;
      // Navegó mientras el hook resolvía: esta invocación está obsoleta
      if (navToken !== this._navToken) return;
    }

    // Re-match route (before hooks may have changed path)
    const finalPath = this.getCurrentPath();
    const finalRoute = this.matchRoute(finalPath);

    if (!finalRoute) {
      // Ruta inexistente: reemplazar (no acumular entradas de historial)
      this.replace('/');
      return;
    }

    this.currentRoute = { path: finalPath, ...finalRoute };

    // Update document title
    document.title = finalRoute.title || 'Tamp';

    // Clean up the previous page (listeners, timers, media)
    if (this._currentComponent?.cleanup) {
      try { this._currentComponent.cleanup(); } catch (err) { console.warn('[router] page cleanup failed:', err); }
    }
    this._currentComponent = null;

    // Render the component. El contenedor NO se vacía por adelantado: la
    // página anterior sigue a la vista hasta que la nueva está lista. Antes se
    // borraba al instante, así que cada vuelta atrás parpadeaba en «Cargando…»
    // aunque el módulo ya estuviera en memoria.
    if (this._container && finalRoute.component) {
      let skeletonTimer = null;
      try {
        // Se pasa el propio router (this) para que las páginas puedan
        // navegar con router.navigate(). Las rutas lazy dependen de este
        // argumento (no capturan el router por closure como las directas).
        let component = typeof finalRoute.component === 'function'
          ? finalRoute.component(this)
          : finalRoute.component;

        // Async (lazy) components: el skeleton solo aparece si la carga tarda
        // lo suficiente para notarse; con el módulo ya cacheado no se ve.
        if (component && typeof component.then === 'function') {
          skeletonTimer = setTimeout(() => {
            if (navToken !== this._navToken) return;
            this._container.innerHTML = ROUTE_SKELETON;
          }, SKELETON_DELAY_MS);
          try {
            component = await component;
          } finally {
            clearTimeout(skeletonTimer);
          }
          // Navegación cambió mientras cargaba: descartar render obsoleto
          if (navToken !== this._navToken) return;
        }

        if (component instanceof HTMLElement) {
          // replaceChildren sustituye el contenido anterior de una sola vez
          this._container.replaceChildren(component);
          this._currentComponent = component;
          enterTransition(component);
        } else if (typeof component === 'string') {
          this._container.innerHTML = component;
          enterTransition(this._container.firstElementChild);
        } else {
          this._container.replaceChildren();
        }
      } catch (err) {
        clearTimeout(skeletonTimer);
        if (navToken !== this._navToken) return; // error obsoleto: no pisar la página actual
        console.error('Error rendering route:', finalPath, err);
        this._container.innerHTML = `<div class="error-state" role="alert">
          <p>Error al cargar esta página</p>
          <small>${escapeHtml(err?.message || 'Error inesperado')}</small>
        </div>`;
      }
    }

    // Colocar la vista en su sitio: la posición de la entrada a la que se
    // vuelve, o arriba si la navegación es nueva. Siempre DESPUÉS de montar,
    // porque antes de existir el contenido no hay altura que recuperar.
    this._applyScroll();

    // Run after hooks
    for (const hook of this._afterHooks) {
      hook(finalPath, finalRoute);
    }

    // Callback
    if (this._onRouteChange) {
      this._onRouteChange(finalPath, finalRoute);
    }
  }
}
