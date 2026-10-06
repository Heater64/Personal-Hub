import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeNotificationRoute,
  notificationAppUrl,
  getNoveltyNotificationRoute
} from '../personal-hub/src/utils/notification-route.js';

const ORIGIN = 'https://hub.example';

test('notification routes keep SPA paths, query strings, and gift deep links', () => {
  assert.equal(normalizeNotificationRoute('/calendario?day=2026-10-04&gift=regalo_1', ORIGIN),
    '/calendario?day=2026-10-04&gift=regalo_1');
  assert.equal(normalizeNotificationRoute('#/razones', ORIGIN), '/razones');
  assert.equal(normalizeNotificationRoute('/#/openwhen?letter=carta_nueva', ORIGIN), '/openwhen?letter=carta_nueva');
  assert.equal(normalizeNotificationRoute(`${ORIGIN}/#/calendario?day=2026-10-04`, ORIGIN), '/calendario?day=2026-10-04');
});

test('notification route normalization rejects external destinations and malformed values', () => {
  assert.equal(normalizeNotificationRoute('https://evil.example/phish', ORIGIN), '/');
  assert.equal(normalizeNotificationRoute('//evil.example/phish', ORIGIN), '/');
  assert.equal(normalizeNotificationRoute('javascript:alert(1)', ORIGIN), '/');
  assert.equal(normalizeNotificationRoute(null, ORIGIN), '/');
});

test('closed-app notification URLs use the hash route the SPA router reads', () => {
  assert.equal(notificationAppUrl('/calendario?day=2026-10-04', ORIGIN),
    'https://hub.example/#/calendario?day=2026-10-04');
});

test('combined daily novelties prefer the calendar gift instead of dumping the user at home', () => {
  assert.equal(getNoveltyNotificationRoute([
    { section: 'razones', route: '/razones' },
    { section: 'calendario', route: '/calendario?day=2026-10-04&gift=regalo_1' }
  ]), '/calendario?day=2026-10-04&gift=regalo_1');
  assert.equal(getNoveltyNotificationRoute([{ section: 'razones', route: '/razones' }]), '/razones');
  assert.equal(getNoveltyNotificationRoute([]), '/');
});
