/**
 * Convert a notification destination into a safe hash-router path.
 * Accepts internal paths, app URLs with hashes, and same-origin URLs.
 */
export function normalizeNotificationRoute(value, origin = 'https://personal-hub.invalid') {
  let route = typeof value === 'string' ? value.trim() : '/';
  try {
    if (route.startsWith('//')) return '/';
    if (/^[a-z][a-z\d+.-]*:/i.test(route) && !/^https?:\/\//i.test(route)) return '/';
    if (/^https?:\/\//i.test(route)) {
      const parsed = new URL(route);
      if (parsed.origin !== origin) return '/';
      route = parsed.hash.startsWith('#/') ? parsed.hash.slice(1) : `${parsed.pathname}${parsed.search}`;
    }
    if (route.startsWith('/#/')) route = route.slice(2);
    if (route.startsWith('#')) route = route.slice(1);
    if (!route.startsWith('/')) route = `/${route}`;
    const parsed = new URL(route, origin);
    if (parsed.origin !== origin) return '/';
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '/';
  }
}

export function getNoveltyNotificationRoute(items) {
  if (!Array.isArray(items) || !items.length) return '/';
  const calendarGift = items.find(item => item?.section === 'calendario' && item.route);
  return calendarGift?.route || items.find(item => item?.route)?.route || '/';
}

export function notificationAppUrl(value, origin = 'https://personal-hub.invalid') {
  const appUrl = new URL('/', origin);
  appUrl.hash = normalizeNotificationRoute(value, origin);
  return appUrl.href;
}
