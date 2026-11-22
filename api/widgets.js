import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { sendFcmToTokens } from './_fcm.js';
import { getOpenWhenWidget, getReasonWidget } from './_widget-content.js';
import { resolveMood } from '../tamp/src/data/moods.data.js';
import { defaultCatalog } from '../tamp/src/data/series-seed.js';
import { computeCycle } from '../tamp/src/utils/cycleMath.js';
import { streaks } from '../tamp/src/utils/stats-metrics.js';

const INSTALLATIONS = 'widget_installations';
const DAY = 86400000;
const FRESH_FOR = 30 * 60000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WIDGET_TOKEN = /^[A-Za-z0-9_-]{43}$/;
const digest = value => createHash('sha256').update(value).digest('hex');
const bearer = req => String(req.headers.authorization || '').match(/^Bearer (\S+)$/i)?.[1] || '';
const iso = value => new Date(value).toISOString();

const DATE_DEFAULTS = [
  ['anniversary', 'Aniversario', '2025-07-03', true],
  ['hubStart', 'Primer mensaje', '2024-05-10', false],
  ['birthday', 'Cumpleaños de dada', '2012-09-03', true],
  ['userBirthday', 'Tu cumpleaños', '2009-08-03', true],
];

function requireData({ data, error }) {
  if (error) throw error;
  return data;
}

function client() {
  return createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function getProfile(db, userId) {
  return requireData(await db.from('profiles').select('role, enabled, name, avatar_url').eq('id', userId).maybeSingle());
}

async function getContent(db, id) {
  return requireData(await db.from('content').select('data').eq('id', id).maybeSingle())?.data;
}

function localDate(timezone, now) {
  const options = { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: timezone };
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat('sv-SE', options);
  } catch {
    formatter = new Intl.DateTimeFormat('sv-SE', { ...options, timeZone: 'UTC' });
  }
  return formatter.format(now);
}

function coordinates(row) {
  const { lat, lng } = row?.data || {};
  return Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lng) && Math.abs(lng) <= 180
    ? { lat, lng }
    : null;
}

function kmBetween(a, b) {
  const rad = value => value * Math.PI / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function distanceLabel(km) {
  if (km == null) return '—';
  if (km === 0) return '0 m';
  if (km < 0.01) return '<10 m';
  if (km < 1) return `${Math.round(km * 100) * 10} m`;
  if (km < 10) return `${String(Number(km.toFixed(1))).replace('.', ',')} km`;
  return `${Math.round(km)} km`;
}

const face = (row, profile) => ({
  name: String(row?.data?.name || profile?.name || '').slice(0, 120),
  avatar: String(row?.data?.avatar || profile?.avatar_url || '').slice(0, 2048),
});

export function distanceWidget(mine, other, mineProfile, otherProfile, now) {
  const me = coordinates(mine);
  const partner = coordinates(other);
  const oldest = Math.min(...[mine, other].map(row => Date.parse(row?.location_at || row?.data?.location_at || row?.data?.at)));
  const expiresAt = Number.isFinite(oldest) ? iso(oldest + FRESH_FOR) : '';
  const km = me && partner && oldest + FRESH_FOR > now ? kmBetween(me, partner) : null;
  const facts = other?.data;
  const sent = Date.parse(other?.sent_at || facts?.at);
  const battery = facts?.battery;
  return {
    km: km == null ? null : Number(km.toFixed(3)),
    text: distanceLabel(km),
    at: expiresAt ? iso(oldest) : '',
    expiresAt,
    me: face(mine, mineProfile),
    partner: face(other, otherProfile),
    device: Number.isFinite(battery) && sent + FRESH_FOR > now
      ? { battery, charging: facts.charging === true, net: facts.net || '', expiresAt: iso(sent + FRESH_FOR) }
      : null,
  };
}

function countdownWidget(config, today) {
  const candidates = DATE_DEFAULTS.map(([key, title, date, recurring]) => ({
    key, title: config.titles?.[key] || title, date: config[key] || date,
    recurring: config.recurring?.[key] ?? recurring,
  }));
  for (const event of Array.isArray(config.events) ? config.events : []) {
    const title = String(event?.title || 'Fecha especial').slice(0, 160);
    const id = event?.id || title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    candidates.push({ key: `event:${id}`, title, date: event?.date, recurring: !!event?.recurring });
  }
  const seen = new Set();
  const events = candidates.flatMap(({ key, title, date, recurring }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || seen.has(key)) return [];
    if (recurring) {
      const year = Number(today.slice(0, 4));
      date = `${year}${date.slice(4)}`;
      if (date < today) date = `${year + 1}${date.slice(4)}`;
    }
    if (date < today) return [];
    seen.add(key);
    return [{ key, title, date }];
  }).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);
  return { title: events[0]?.title || '', date: events[0]?.date || '', events };
}

async function memberRows(db, userId) {
  const member = requireData(await db.from('couple_members').select('couple_id').eq('user_id', userId).maybeSingle());
  if (!member) return null;
  const members = requireData(await db.from('couple_members').select('user_id').eq('couple_id', member.couple_id));
  return { id: member.couple_id, partnerId: members.find(row => row.user_id !== userId)?.user_id };
}

async function getMood(db, userId) {
  const row = requireData(await db.from('moods').select('date,mood,label,emoji,score').eq('user_id', userId)
    .order('date', { ascending: false }).order('created_at', { ascending: false }).limit(1).maybeSingle());
  const mood = resolveMood(row);
  if (!mood) return null;
  const items = (mood.items || []).map(({ emoji, label }) => ({ emoji, label }));
  const extra = items.length - 2;
  const label = items.length
    ? items.slice(0, 2).map(item => item.label).join(' · ') + (extra > 0 ? ` +${extra}` : '')
    : mood.label;
  return { emoji: items[0]?.emoji || mood.emoji, label, items, date: row.date };
}

async function getCycle(db, userId, today) {
  const [config, periods] = await Promise.all([
    db.from('cycle_settings').select('avg_cycle_length,avg_period_length,luteal_phase_length').eq('user_id', userId).maybeSingle(),
    db.from('cycle_periods').select('start_date,end_date').eq('user_id', userId).order('start_date', { ascending: false }).limit(120),
  ]);
  const settings = requireData(config) || {};
  const cycle = computeCycle({
    periods: requireData(periods),
    settings: {
      avgCycleLength: settings.avg_cycle_length,
      avgPeriodLength: settings.avg_period_length,
      lutealPhaseLength: settings.luteal_phase_length,
    },
    today,
  });
  return cycle.hasData
    ? { phase: cycle.phase.label, day: cycle.cycleDay, next: cycle.nextStart, days: cycle.daysUntilNext, length: cycle.avgCycle }
    : null;
}

async function getWatching(db, userId) {
  const [content, progress] = await Promise.all([
    getContent(db, 'series'),
    db.from('user_progress').select('data').eq('user_id', userId).eq('type', 'series_progress').maybeSingle(),
  ]);
  const items = Array.isArray(content?.series) && content.series.length ? content.series : defaultCatalog();
  const saved = requireData(progress)?.data || {};
  for (const [id, value] of Object.entries(saved)) {
    const item = items.find(entry => String(entry?.id) === id);
    if (!item || !Array.isArray(value?.watched) || !value.watched.length) continue;
    const total = Array.isArray(item.temporadas) && item.temporadas.length
      ? item.temporadas.reduce((sum, season) => sum + (season?.episodios?.length || 0), 0)
      : Number.parseInt(item.totalEpisodios, 10);
    const watched = value.watched.length;
    if (!(total > watched)) continue;
    return { title: item.titulo, poster: item.portada || '', total, watched, percent: Math.round(watched / total * 100) };
  }
  return null;
}

async function getGifts(db, today) {
  const remote = await getContent(db, 'gifts');
  const catalog = remote || JSON.parse(await readFile(
    new URL('../tamp/public/data/gifts.json', import.meta.url), 'utf8'
  ));
  const assigned = catalog?.months?.[today.slice(0, 7)]?.calendarMapping?.[String(Number(today.slice(8)))];
  const giftIds = (Array.isArray(assigned) ? assigned : [assigned]).filter(id => typeof id === 'string' && id);
  return { giftIds, date: today };
}

async function getWidgets(db, userId, profile, keys, timezone, now) {
  const today = localDate(timezone, now);
  let couple;
  let dateConfig;
  let partnerProfile;
  const pairForUser = () => (couple ??= memberRows(db, userId));
  const dates = () => (dateConfig ??= getContent(db, 'hub_dates'));
  const partnerForUser = () => (partnerProfile ??= pairForUser().then(pair =>
    pair?.partnerId ? getProfile(db, pair.partnerId) : null));

  const projections = {
    widget_distance: async () => {
      const pair = await pairForUser();
      const otherProfile = await partnerForUser();
      if (!pair?.partnerId || otherProfile?.enabled !== true) return null;
      const rows = requireData(await db.from('couple_locations').select('data,user_id,location_at,sent_at')
        .eq('couple_id', pair.id).in('user_id', [userId, pair.partnerId]));
      return distanceWidget(rows.find(row => row.user_id === userId), rows.find(row => row.user_id === pair.partnerId),
        profile, otherProfile, now);
    },
    widget_days: async () => {
      const config = (await dates()) || {};
      const since = config.anniversary || DATE_DEFAULTS[0][2];
      const days = Math.max(0, Math.floor((Date.parse(today) - Date.parse(since)) / DAY));
      const partner = await partnerForUser();
      return { since, days, me: face(null, profile), partner: face(null, partner?.enabled ? partner : null) };
    },
    widget_countdown: async () => countdownWidget((await dates()) || {}, today),
    widget_mood: async () => {
      if (profile.role !== 'admin') return getMood(db, userId);
      const partner = (await pairForUser())?.partnerId;
      const theirs = await partnerForUser();
      return partner && theirs?.enabled === true && theirs.role !== 'admin' ? getMood(db, partner) : null;
    },
    widget_cycle: () => profile.role === 'admin' ? null : getCycle(db, userId, today),
    widget_watching: () => getWatching(db, userId),
    widget_gifts: () => getGifts(db, today),
    widget_reason: () => getReasonWidget(db, userId, profile, localDate('Europe/Madrid', now)),
    widget_openwhen: () => getOpenWhenWidget(db, userId, profile),
    widget_streak: async () => {
      const rows = requireData(await db.from('moods').select('date').eq('user_id', userId)
        .order('date', { ascending: false }).limit(1000));
      const value = streaks(rows.map(row => row.date), today);
      return { days: value.current, best: value.longest, date: rows[0]?.date || '' };
    },
  };

  const supported = keys.filter(key => Object.hasOwn(projections, key));
  const values = await Promise.allSettled(supported.map(key => Promise.resolve().then(projections[key])));
  // Un fallo de lectura conserva la caché del widget afectado.
  return Object.fromEntries(supported.flatMap((key, i) =>
    values[i].status === 'fulfilled' ? [[key, values[i].value]] : []));
}

async function register(db, req, res) {
  const { installationId, messagingToken = '' } = req.body || {};
  if (!UUID.test(installationId || '') || typeof messagingToken !== 'string'
    || (messagingToken && !/^[\w:-]{20,1024}$/.test(messagingToken))) {
    return res.status(400).json({ error: 'Instalación inválida' });
  }
  const { data, error } = await db.auth.getUser(bearer(req));
  if (error || !data?.user) return res.status(401).json({ error: 'Sesión inválida' });
  const { id } = data.user;
  const profile = await getProfile(db, id);
  if (profile?.enabled !== true) return res.status(403).json({ error: 'Cuenta deshabilitada' });

  const now = Date.now();
  const previous = requireData(await db.from(INSTALLATIONS).select('token_hash,expires_at')
    .eq('installation_id', installationId).eq('user_id', id).maybeSingle());
  const until = Math.min(Date.parse(previous?.expires_at), now + 5 * 60000);
  const token = randomBytes(32).toString('base64url');
  requireData(await db.from(INSTALLATIONS).upsert({
    installation_id: installationId,
    user_id: id,
    token_hash: digest(token),
    previous_token_hash: until > now ? previous.token_hash : null,
    previous_valid_until: until > now ? iso(until) : null,
    messaging_token: messagingToken || null,
    expires_at: iso(now + 30 * DAY),
  }, { onConflict: 'installation_id,user_id' }));
  return res.status(200).json({ token });
}

async function revoke(db, req, res) {
  const { installationId } = req.body || {};
  const token = bearer(req);
  if (!UUID.test(installationId || '')) return res.status(400).end();
  if (WIDGET_TOKEN.test(token)) {
    requireData(await db.from(INSTALLATIONS).delete().eq('installation_id', installationId).eq('token_hash', digest(token)));
  } else {
    const { data, error } = await db.auth.getUser(token);
    if (error || !data?.user) return res.status(401).end();
    requireData(await db.from(INSTALLATIONS).delete().eq('installation_id', installationId).eq('user_id', data.user.id));
  }
  return res.status(204).end();
}

async function invalidate(db, req, res) {
  const secret = process.env.WIDGET_WEBHOOK_SECRET;
  if (!secret || !timingSafeEqual(Buffer.from(digest(secret)), Buffer.from(digest(bearer(req))))) {
    return res.status(401).end();
  }
  const ids = req.body?.userIds;
  if (ids != null && (!Array.isArray(ids) || ids.length > 10 || ids.some(id => !UUID.test(id)))) {
    return res.status(400).end();
  }
  if (ids?.length === 0) return res.status(204).end();
  let query = db.from(INSTALLATIONS).select('messaging_token').not('messaging_token', 'is', null)
    .gt('expires_at', iso(Date.now()));
  if (ids) query = query.in('user_id', ids);
  const rows = requireData(await query);
  const tokens = [...new Set(rows.map(row => row.messaging_token))];
  const result = await sendFcmToTokens(tokens, { type: 'widget_sync' });
  if (result.removed.length) {
    requireData(await db.from(INSTALLATIONS).update({ messaging_token: null }).in('messaging_token', result.removed));
  }
  return res.status(204).end();
}

export default async function widgets(req, res) {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('CDN-Cache-Control', 'no-store');
  const action = req.query?.action || '';
  const now = Date.now();
  try {
    if (req.method === 'POST') {
      if (action === 'register') return await register(client(), req, res);
      if (action === 'revoke') return await revoke(client(), req, res);
      if (action === 'invalidate') return await invalidate(client(), req, res);
    }
    if (req.method !== 'GET' || action) return res.status(405).end();
    const token = bearer(req);
    if (!WIDGET_TOKEN.test(token)) return res.status(401).end();
    const db = client();
    const hash = digest(token);
    const installation = requireData(await db.from(INSTALLATIONS).select('user_id,token_hash,expires_at,previous_valid_until')
      .or(`token_hash.eq.${hash},previous_token_hash.eq.${hash}`).maybeSingle());
    const expires = installation?.token_hash === hash ? installation.expires_at : installation?.previous_valid_until;
    if (!(Date.parse(expires) > now)) return res.status(410).end();
    const profile = await getProfile(db, installation.user_id);
    if (profile?.enabled !== true) return res.status(403).end();
    const keys = [...new Set(String(req.headers['x-widget-keys'] || '').split(','))].slice(0, 12);
    const timezone = String(req.headers['x-widget-timezone'] || 'UTC').slice(0, 80);
    return res.status(200).json({ widgets: await getWidgets(db, installation.user_id, profile, keys, timezone, now) });
  } catch (error) {
    console.error('[api/widgets]', error.code || error.name);
    return res.status(503).json({ error: 'Sincronización no disponible' });
  }
}
