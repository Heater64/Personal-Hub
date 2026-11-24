import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  registerPushSubscription,
  resolveNotificationActivation,
} from '../tamp/src/services/push-registration.js';
import { createNotificationIdGenerator } from '../tamp/src/utils/notification-id.js';

test('los avisos inmediatos reciben IDs distintos incluso en el mismo milisegundo', () => {
  const nextId = createNotificationIdGenerator(1234);
  assert.deepEqual([nextId(), nextId(), nextId()], [1235, 1236, 1237]);

  const nearLimit = createNotificationIdGenerator(2_147_483_646);
  assert.deepEqual([nearLimit(), nearLimit(), nearLimit()], [2_147_483_647, 1, 2]);
});

test('notification activation reports permission denial', () => {
  assert.deepEqual(resolveNotificationActivation({ permissionGranted: false }), {
    ok: false, push: false, fallback: false, reason: 'permission',
  });
});

test('notification activation distinguishes remote Push from local fallback', () => {
  assert.deepEqual(resolveNotificationActivation({ permissionGranted: true, pushRegistered: true }), {
    ok: true, push: true, fallback: false, reason: null,
  });
  assert.deepEqual(resolveNotificationActivation({ permissionGranted: true, fallbackAvailable: true }), {
    ok: true, push: false, fallback: true, reason: 'push_unavailable',
  });
  assert.deepEqual(resolveNotificationActivation({ permissionGranted: true }), {
    ok: false, push: false, fallback: false, reason: 'delivery_unavailable',
  });
});

test('Push is active only after the server accepts the subscription', async () => {
  const subscription = { endpoint: 'https://push.example/test', toJSON: () => ({ endpoint: 'https://push.example/test' }) };
  const getSession = async () => ({ data: { session: { access_token: 'test-token' } } });
  let request;

  assert.deepEqual(await registerPushSubscription(subscription, {
    getSession,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, status: 200 };
    },
  }), { ok: true, reason: null });
  assert.equal(request.url, '/api/push?action=subscribe');
  assert.equal(request.options.headers.Authorization, 'Bearer test-token');
  assert.deepEqual(JSON.parse(request.options.body), { subscription: { endpoint: 'https://push.example/test' } });

  assert.deepEqual(await registerPushSubscription(subscription, {
    getSession,
    fetchImpl: async () => ({ ok: false, status: 503 }),
  }), { ok: false, reason: 'server', status: 503 });
});

test('a missing session or network failure never reports remote Push active', async () => {
  const subscription = { endpoint: 'https://push.example/test' };
  assert.deepEqual(await registerPushSubscription(subscription, {
    getSession: async () => ({ data: { session: null } }),
    fetchImpl: async () => ({ ok: true, status: 200 }),
  }), { ok: false, reason: 'session', status: null });

  assert.deepEqual(await registerPushSubscription(subscription, {
    getSession: async () => ({ data: { session: { access_token: 'test-token' } } }),
    fetchImpl: async () => { throw new Error('network'); },
  }), { ok: false, reason: 'network', status: null });
});

test('notification service and settings use the server-confirmed delivery mode', async () => {
  const service = await readFile('tamp/src/services/notifications.service.js', 'utf8');
  const profile = await readFile('tamp/src/pages/Profile.js', 'utf8');
  const admin = await readFile('tamp/src/pages/Admin.js', 'utf8');

  assert.match(service, /resolveNotificationActivation\(/);
  assert.match(service, /try\s*\{\s*perm = await Notification\.requestPermission\(\)/);
  assert.match(service, /return await sendSubscriptionToServer\(subscription\)/);
  assert.match(service, /setUserPref\(PUSH_DELIVERY_MODE_KEY, result\.ok \? 'push' : 'fallback'\)/);
  assert.match(profile, /getPushDeliveryStatus\(\) === 'push'/);
  assert.match(admin, /Push remoto registrado/);
  assert.match(profile, /los avisos remotos de pareja no están registrados/);
});
