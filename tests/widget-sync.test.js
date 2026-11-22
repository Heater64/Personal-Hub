import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import widgets, { distanceWidget } from '../api/widgets.js';
import { buildMessage } from '../api/_fcm.js';

test('el aviso de actualización viaja sin notificación visible ni datos privados', () => {
  const { message } = buildMessage('device-token', {
    type: 'widget_sync',
    title: 'Dato privado',
    lat: 40,
  });
  assert.deepEqual(message.data, { type: 'widget_sync' });
  assert.equal(message.android.priority, 'normal');
  assert.equal(message.android.collapse_key, 'widget_sync');
  assert.equal(message.notification, undefined);
});

test('la distancia y la batería usan relojes independientes', () => {
  const now = Date.parse('2026-11-19T12:00:00Z');
  const mine = { data: { lat: 40, lng: -3 }, location_at: '2026-11-19T11:58:00Z' };
  const partner = {
    data: { lat: 41, lng: -3, battery: 0, charging: true, net: 'wifi' },
    location_at: '2026-11-19T11:10:00Z',
    sent_at: '2026-11-19T11:59:00Z',
  };
  const old = distanceWidget(mine, partner, null, null, now);
  assert.equal(old.km, null);
  assert.equal(old.text, '—');
  assert.equal(old.device.battery, 0);
  assert.equal(old.device.expiresAt, '2026-11-19T12:29:00.000Z');
  assert.equal(old.expiresAt, '2026-11-19T11:40:00.000Z');
  partner.location_at = '2026-11-19T11:59:00Z';
  partner.data.battery = null;
  const fresh = distanceWidget(mine, partner, null, null, now);
  assert.equal(fresh.text, '111 km');
  assert.equal(fresh.device, null);
  partner.data.lat = null;
  assert.equal(distanceWidget(mine, partner, null, null, now).km, null);
});

function response() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; },
    end() {},
  };
}

test('solo una instalación vigente consulta los widgets permitidos de su cuenta', async t => {
  const token = 'a'.repeat(43);
  const hash = createHash('sha256').update(token).digest('hex');
  const user = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  const prevUrl = process.env.VITE_SUPABASE_URL;
  const prevKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.VITE_SUPABASE_URL = 'https://widgets.example.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';
  t.after(() => {
    if (prevUrl === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = prevUrl;
    if (prevKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = prevKey;
  });
  let expiresAt = new Date(Date.now() + 60000).toISOString();
  let enabled = true;
  const reads = [];
  t.mock.method(globalThis, 'fetch', async input => {
    const url = new URL(input);
    const table = url.pathname.split('/').pop();
    reads.push(table);
    let rows;
    if (table === 'widget_installations') {
      assert.equal(url.searchParams.get('or'), `(token_hash.eq.${hash},previous_token_hash.eq.${hash})`);
      rows = [{ user_id: user, token_hash: hash, expires_at: expiresAt }];
    } else if (table === 'profiles') {
      assert.equal(url.searchParams.get('id'), `eq.${user}`);
      rows = [{ role: 'user', enabled }];
    } else if (table === 'moods') {
      assert.equal(url.searchParams.get('user_id'), `eq.${user}`);
      rows = [{ date: '2026-11-19', mood: 'feliz', label: 'Feliz', emoji: '😊', score: 5 }];
    } else throw new Error(`Consulta inesperada a ${table}`);
    return Response.json(rows);
  });

  const req = {
    method: 'GET',
    headers: { authorization: `Bearer ${token}`, 'x-widget-keys': 'widget_mood,widget_mood,unknown' },
  };
  const ok = response();
  await widgets(req, ok);
  assert.equal(ok.code, 200);
  assert.deepEqual(Object.keys(ok.body.widgets), ['widget_mood']);
  assert.equal(ok.body.widgets.widget_mood.date, '2026-11-19');
  assert.equal(ok.headers['Cache-Control'], 'no-store, private');
  assert.deepEqual(reads.splice(0), ['widget_installations', 'profiles', 'moods']);

  enabled = false;
  const forbidden = response();
  await widgets(req, forbidden);
  assert.equal(forbidden.code, 403);
  assert.deepEqual(reads.splice(0), ['widget_installations', 'profiles']);

  expiresAt = '2020-01-01T00:00:00Z';
  const expired = response();
  await widgets(req, expired);
  assert.equal(expired.code, 410);
  assert.deepEqual(reads, ['widget_installations']);
});
