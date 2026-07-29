/**
 * News Service — loads news from Firestore with localStorage fallback
 * The admin panel writes to Firestore at config_noticias/data
 * This service reads from there, or falls back to localStorage + defaults
 */
(function() {
  const STORAGE_KEY = 'personalHub.news';
  const NEWS_COLLECTION = 'config_noticias';
  const NEWS_DOC = 'data';

  // Default fallback news
  const DEFAULT_NEWS = [
    { id: 11, date: "17 de julio de 2026", title: "Rediseño de la app móvil", description: "Rediseño en la estructura de la web, nuevo formato móvil, nuevas funciones añadidas, perfil añadido con características BETA." },
    { id: 10, date: "13 de julio de 2026", title: "Rediseño en la sección 'SERIES'", description: "Nuevas películas, series y funciones añadidas" },
    { id: 9, date: "13 de julio de 2026", title: "CORRECCIÓN DE FALLOS", description: "Se han corregido muchos fallos que había en la web" },
    { id: 8, date: "13 de julio de 2026", title: "Nueva sección 'JUEGOS' añadida", description: "Aquí encontrarás todos los juegos agrupados en cada sección cuando los desbloquees en el calendario" },
  ];

  /**
   * Load news from Firestore first, fallback to localStorage, then defaults
   */
  async function loadNews() {
    // 1. Try Firestore
    if (window.db && typeof window.db.collection === 'function') {
      try {
        const snap = await window.db.collection(NEWS_COLLECTION).doc(NEWS_DOC).get();
        if (snap.exists && snap.data().news && snap.data().news.length > 0) {
          const news = snap.data().news;
          // Cache in localStorage
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(news)); } catch (e) {}
          return news;
        }
      } catch (e) {
        // Firestore unavailable, fall through
      }
    }

    // 2. Try localStorage
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {}

    // 3. Try localStorage from admin panel (alternative key)
    try {
      const adminCached = localStorage.getItem('personalHub.admin.news');
      if (adminCached) {
        const parsed = JSON.parse(adminCached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {}

    // 4. Fallback to defaults
    return DEFAULT_NEWS;
  }

  /**
   * Save news to localStorage (for admin panel without Firestore)
   */
  function saveNewsLocal(news) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(news));
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Delete a news item by id
   */
  function deleteNewsLocal(id) {
    const news = loadNewsSync();
    const filtered = news.filter(n => n.id !== id);
    saveNewsLocal(filtered);
    return filtered;
  }

  function loadNewsSync() {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return DEFAULT_NEWS;
  }

  // Export globally
  window.NewsService = {
    loadNews,
    saveNewsLocal,
    deleteNewsLocal,
    loadNewsSync,
    getDefaults: () => [...DEFAULT_NEWS]
  };
})();
