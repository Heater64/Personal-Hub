/**
 * Personal Hub SPA Router v2
 * Hash-based routing with lazy page loading
 */
const AppRouter = {
  _currentPage: null,
  _routes: {},
  _beforeHooks: [],

  register(name, loader) {
    this._routes[name] = loader;
  },

  beforeEach(fn) {
    this._beforeHooks.push(fn);
  },

  async navigate(page, data) {
    // Run before hooks
    for (const hook of this._beforeHooks) {
      const result = await hook(page, data);
      if (result === false) return;
    }

    const view = document.getElementById('view');
    if (!view) return;

    this._currentPage = page;

    // Update bottom nav active state
    document.querySelectorAll('.bottom-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.page === page);
    });

    // Lazy load page module
    const loader = this._routes[page];
    if (!loader) {
      view.innerHTML = `<div class="page-error"><h2>404</h2><p>Página no encontrada</p></div>`;
      return;
    }

    try {
      const pageModule = await loader();
      view.innerHTML = '';
      if (pageModule.mount) {
        // Support both sync and async mount
        const mountResult = pageModule.mount(view, data);
        if (mountResult && typeof mountResult.then === 'function') {
          await mountResult;
        }
      } else if (pageModule.render) {
        view.innerHTML = pageModule.render(data);
        if (pageModule.afterMount) pageModule.afterMount(view, data);
      }
    } catch (err) {
      view.innerHTML = `<div class="page-error"><h2>Error</h2><p>${err.message}</p></div>`;
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

// Listen for hash changes
window.addEventListener('hashchange', () => {
  const hash = window.location.hash.replace('#', '') || 'home';
  AppRouter.navigate(hash);
});

// Bootstrap on load
document.addEventListener('DOMContentLoaded', () => {
  const hash = window.location.hash.replace('#', '') || 'home';
  AppRouter.navigate(hash);
});
