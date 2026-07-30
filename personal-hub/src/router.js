/* ==========================================
   Personal Hub v2 — SPA Router
   Hash-based router for simple navigation
   ========================================== */

export class Router {
  constructor(options = {}) {
    this.routes = [];
    this.currentRoute = null;
    this._beforeHooks = [];
    this._afterHooks = [];
    this._container = options.container || document.getElementById('app');
    this._onRouteChange = options.onRouteChange || null;
    this._pendingNavigation = null;

    window.addEventListener('hashchange', () => this._handleRoute());
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
      title: options.title || 'Personal Hub',
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
    window.location.hash = path;
  }

  getCurrentPath() {
    const hash = window.location.hash.slice(1) || '/';
    return hash;
  }

  matchRoute(path) {
    // Exact match first
    let route = this.routes.find(r => r.path === path);
    if (route) return route;

    // Dynamic segments like /profile/:id
    for (const r of this.routes) {
      const pattern = r.path.replace(/:([^/]+)/g, '([^/]+)');
      const regex = new RegExp(`^${pattern}$`);
      const match = path.match(regex);
      if (match) {
        const params = {};
        const keys = r.path.match(/:([^/]+)/g) || [];
        keys.forEach((key, i) => {
          params[key.slice(1)] = match[i + 1];
        });
        return { ...r, params };
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

    // Run before hooks (can cancel navigation or redirect)
    let route = this.matchRoute(path);
    for (const hook of this._beforeHooks) {
      const result = await hook(path, route);
      if (result === false) return;
    }

    // Re-match route (before hooks may have changed path)
    const finalPath = this.getCurrentPath();
    const finalRoute = this.matchRoute(finalPath);

    if (!finalRoute) {
      this.navigate('/');
      return;
    }

    this.currentRoute = { path: finalPath, ...finalRoute };

    // Update document title
    document.title = finalRoute.title || 'Personal Hub';

    // Render the component
    if (this._container && finalRoute.component) {
      this._container.innerHTML = '';
      try {
        const component = typeof finalRoute.component === 'function'
          ? finalRoute.component()
          : finalRoute.component;

        if (component instanceof HTMLElement) {
          this._container.appendChild(component);
        } else if (typeof component === 'string') {
          this._container.innerHTML = component;
        }
      } catch (err) {
        console.error('Error rendering route:', finalPath, err);
        this._container.innerHTML = `<div class="error-state">
          <p>Error al cargar esta página</p>
          <small>${err.message}</small>
        </div>`;
      }
    }

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
