/* ==========================================
   Personal Hub v2 — Database Service
   Persistencia en Supabase con fallback a localStorage
   ========================================== */

import { supabase } from './supabase.js';
import { escapeHtml } from '../utils/escape.js';

// Storage keys for localStorage fallback
const KEYS = {
  reasons: 'ph.data.reasons',
  songs: 'ph.data.songs',
  gifts: 'ph.data.gifts',
  news: 'ph.data.news',
  maldiaFrases: 'ph.data.maldia.frases',
  maldiaMensajes: 'ph.data.maldia.mensajes',
  series: 'ph.data.series',
  moods: 'ph.data.moods',
  activity: 'ph.data.activity',
  analytics: 'ph.data.analytics'
};

// ==========================================
// HELPERS
// ==========================================

function lsGet(key, fallback = null) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}

function lsSet(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* quota exceeded */ }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ==========================================
// SUPABASE HELPERS
// ==========================================

const CONTENT_TABLE = 'content';

// Detect if real Supabase credentials are present (not the placeholder values)
function isSupabaseConfigured() {
  const url = import.meta.env?.VITE_SUPABASE_URL;
  return !!url && !url.includes('placeholder');
}

async function loadContent(id, fallback = null) {
  try {
    const { data, error } = await supabase
      .from(CONTENT_TABLE)
      .select('data')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data?.data || fallback;
  } catch (err) {
    if (isSupabaseConfigured()) {
      console.warn(`[db] Supabase read failed for "${id}":`, err.message);
      throw new Error(`No se pudo leer de Supabase: ${err.message}`);
    }
    return lsGet('ph.config.' + id, fallback);
  }
}

async function saveContent(id, data) {
  try {
    const { error } = await supabase
      .from(CONTENT_TABLE)
      .upsert({ id, data, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (error) throw error;
    lsSet('ph.config.' + id, data);
    return true;
  } catch (err) {
    if (isSupabaseConfigured()) {
      console.warn(`[db] Supabase write failed for "${id}":`, err.message);
      throw new Error(`No se pudo guardar en Supabase: ${err.message}`);
    }
    lsSet('ph.config.' + id, data);
    return true;
  }
}

async function checkConnection() {
  if (!isSupabaseConfigured()) {
    return { ok: false, mode: 'local', message: 'Supabase no configurado. Usando localStorage.' };
  }
  try {
    const { error } = await supabase.from(CONTENT_TABLE).select('id').limit(1);
    if (error) throw error;
    return { ok: true, mode: 'supabase', message: 'Conectado a Supabase' };
  } catch (err) {
    return { ok: false, mode: 'supabase', message: err.message || 'Error de conexión con Supabase' };
  }
}

// ==========================================
// MOODS
// ==========================================

async function getMoods() {
  return lsGet(KEYS.moods, {});
}

/**
 * Fetch all moods from Supabase within a date range (admin use).
 * Returns an array of mood rows.
 */
async function getAllMoods(startDate, endDate) {
  try {
    const { data, error } = await supabase
      .from('moods')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false })
      .limit(1000);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('[db] Could not fetch all moods:', err.message);
    return [];
  }
}

async function saveMood(date, moodData) {
  const moods = await getMoods();
  moods[date] = { ...moodData, updatedAt: new Date().toISOString() };
  lsSet(KEYS.moods, moods);

  // Save to Supabase
  const user = (await supabase.auth.getUser()).data?.user;
  if (user) {
    supabase.from('moods').upsert({
      user_id: user.id, date, mood: moodData.mood,
      label: moodData.label, emoji: moodData.emoji,
      score: moodData.score, created_at: new Date().toISOString()
    }, { onConflict: 'user_id,date' }).catch(() => {});
  }
  return true;
}

async function getMoodMonth(year, month) {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const result = {};

  // 1. Try Supabase first (all users) — source of truth
  try {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
    const { data: supabaseMoods, error } = await supabase
      .from('moods')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .limit(1000);

    if (!error && supabaseMoods && supabaseMoods.length > 0) {
      supabaseMoods.forEach(m => {
        const dateStr = m.date;
        if (!result[dateStr]) result[dateStr] = [];
        result[dateStr].push({
          mood: m.mood, label: m.label, emoji: m.emoji,
          score: m.score, user_id: m.user_id,
          source: 'supabase'
        });
      });
      return result;
    }
  } catch { /* */ }

  // 2. Fallback to localStorage (current user) when Supabase is unavailable
  const localMoods = lsGet(KEYS.moods, {});
  Object.entries(localMoods).forEach(([date, data]) => {
    if (date.startsWith(prefix)) {
      result[date] = [{ ...data, source: 'local' }];
    }
  });

  return result;
}

// ==========================================
// REASONS (via content table)
// ==========================================

async function getReasons() {
  const data = await loadContent('razones', { reasons: [] });
  return data.reasons || [];
}

async function saveReasons(reasons) {
  return saveContent('razones', { reasons });
}

// ==========================================
// SONGS (via content table)
// ==========================================

async function getSongs() {
  const data = await loadContent('canciones', { songs: [] });
  return data.songs || [];
}

async function saveSongs(songs) {
  return saveContent('canciones', { songs });
}

// ==========================================
// GIFTS (via content table)
// ==========================================

async function getGifts() {
  const data = await loadContent('gifts', { gifts: [], months: {} });
  return data;
}

async function saveGifts(data) {
  return saveContent('gifts', data);
}

// ==========================================
// NEWS (via content table)
// ==========================================

async function getNews() {
  const data = await loadContent('noticias', { news: [] });
  return data.news || [];
}

async function saveNews(news) {
  return saveContent('noticias', { news });
}

// ==========================================
// MAL DÍA (via content table)
// ==========================================

async function getMaldiaFrases() {
  const data = await loadContent('maldia_frases', { phrases: [] });
  return data.phrases || [];
}

async function getMaldiaMensajes() {
  const data = await loadContent('maldia_mensajes', { messages: [] });
  return data.messages || [];
}

async function saveMaldiaFrases(frases) {
  return saveContent('maldia_frases', { phrases: frases });
}

async function saveMaldiaMensajes(mensajes) {
  return saveContent('maldia_mensajes', { messages: mensajes });
}

// ==========================================
// SERIES (via content table)
// ==========================================

async function getSeries() {
  const data = await loadContent('series', { items: [] });
  return data.items || [];
}

async function saveSeries(series) {
  return saveContent('series', { items: series });
}

// ==========================================
// ACTIVITY LOG (via Supabase)
// ==========================================

async function logActivity(action, details) {
  const activities = await getCollection(KEYS.activity, []);
  activities.unshift({
    id: generateId(), action,
    details: details || '',
    timestamp: new Date().toISOString()
  });
  if (activities.length > 200) activities.length = 200;
  lsSet(KEYS.activity, activities);

  // Also log to Supabase
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      supabase.from('activity_log').insert({
        action, user_id: user.id,
        details: details || '',
        timestamp: new Date().toISOString()
      }).catch(() => {});
    }
  } catch {}
}

async function getActivity(limit = 50) {
  const activities = await getCollection(KEYS.activity, []);
  return activities.slice(0, limit);
}

// ==========================================
// GENERIC COLLECTION HELPERS
// ==========================================

async function getCollection(key, fallback = []) {
  return lsGet(key, fallback);
}

async function saveCollection(key, data) {
  lsSet(key, data);
  return true;
}

// ==========================================
// ANALYTICS
// ==========================================

async function trackVisit(page) {
  const analytics = lsGet(KEYS.analytics, { visits: [] });
  analytics.visits.push({ page, timestamp: new Date().toISOString(), id: generateId() });
  if (analytics.visits.length > 500) analytics.visits.length = 500;
  lsSet(KEYS.analytics, analytics);
}

async function getAnalytics() { return lsGet(KEYS.analytics, { visits: [] }); }

// ==========================================
// USERS & MOOD HISTORY
// ==========================================

// Cache in-flight listUsers() promise to avoid duplicate parallel requests
// and prevent race conditions that make the UI flicker.
let listUsersPromise = null;

// Fetch all moods for a specific user, sorted by date descending.
async function getUserMoods(userId) {
  if (!userId) return [];
  try {
    const { data, error } = await supabase
      .from('moods')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(1000);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('[db] Could not fetch user moods:', err.message);
    return [];
  }
}

// Upload avatar to Supabase Storage and update user metadata.
// Requires a public 'avatars' bucket with appropriate RLS policies.
async function uploadAvatar(file) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  if (!file.type.startsWith('image/')) {
    throw new Error('Solo se permiten imágenes');
  }

  if (file.size > 2 * 1024 * 1024) {
    throw new Error('La imagen no puede superar los 2 MB');
  }

  const fileExt = file.name.split('.').pop() || 'jpg';
  const filePath = `${user.id}/${Date.now()}.${fileExt}`;

  // 1. Upload to Storage
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, { cacheControl: '3600', upsert: true });

  if (uploadError) {
    console.error('[db] Storage upload error:', uploadError);
    if (uploadError.message?.includes('row-level security policy') || uploadError.code === '42501') {
      throw new Error('No tienes permisos para subir la imagen. Verifica que el bucket "avatars" exista y que hayas iniciado sesión.');
    }
    throw new Error('Hubo un problema al subir la imagen. Inténtalo de nuevo.');
  }

  // 2. Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath);

  // 3. Update auth metadata
  const { error: updateError } = await supabase.auth.updateUser({
    data: { avatar_url: publicUrl }
  });
  if (updateError) throw updateError;

  // 4. Update profiles table (best effort, log only)
  try {
    const { error: profileError } = await supabase.from('profiles').upsert(
      { id: user.id, avatar_url: publicUrl, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    );
    if (profileError) {
      console.warn('[db] Profile table update skipped/failed:', profileError.message);
    }
  } catch (err) {
    console.warn('[db] Profile upsert error:', err);
  }

  return publicUrl;
}

async function listUsers() {
  if (listUsersPromise) return listUsersPromise;

  listUsersPromise = (async () => {
    // localUsers is the cached merged list from a previous successful call.
    // We keep it as a fallback if the API fails, but we don't use it for
    // deduplication because that would skip real users already in the cache.
    const localUsers = lsGet('ph.data.users', []);
    const existingIds = new Set();
    const mergedUsers = [];

    // 1. Try to fetch all real Supabase Auth users from the admin API.
    //    This requires SUPABASE_SERVICE_ROLE_KEY on the server/Vercel.
    try {
      const sessionRes = await supabase.auth.getSession();
      const accessToken = sessionRes.data?.session?.access_token;

      if (accessToken) {
        const res = await fetch('/api/users', {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (res.ok) {
          const authUsers = await res.json();
          authUsers.forEach(u => {
            if (!existingIds.has(u.id)) {
              mergedUsers.push(u);
              existingIds.add(u.id);
            }
          });
        } else {
          const err = await res.json().catch(() => ({}));
          console.warn('[db] /api/users failed:', res.status, err.error || res.statusText);
        }
      }
    } catch (err) {
      console.warn('[db] Could not fetch users from /api/users:', err.message);
    }

    // 2. Query profiles table (created via Supabase trigger on auth.users)
    //    If the table doesn't exist yet, supabase returns an error silently
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, email, name, avatar_url, role, created_at, updated_at')
        .limit(100);

      if (!error && profiles && profiles.length > 0) {
        profiles.forEach(p => {
          if (!existingIds.has(p.id)) {
            mergedUsers.push({
              id: p.id, email: p.email || '',
              name: p.name || p.email?.split('@')[0] || '',
              role: p.role || 'user',
              enabled: true, photo: p.avatar_url || '',
              created_at: p.created_at, last_login: ''
            });
            existingIds.add(p.id);
          }
        });
      }
    } catch { /* profiles table might not exist */ }

    // 3. Derive users from moods table (anyone who submitted a mood is a real user)
    try {
      const { data: moodUsers, error } = await supabase
        .from('moods')
        .select('user_id')
        .limit(1000);

      if (!error && moodUsers && moodUsers.length > 0) {
        const uniqueIds = [...new Set(moodUsers.map(m => m.user_id))];
        for (const uid of uniqueIds) {
          if (!existingIds.has(uid)) {
            mergedUsers.push({
              id: uid, email: '', name: uid.slice(0, 8) + '...',
              role: 'user', enabled: true, photo: '',
              created_at: '', last_login: ''
            });
            existingIds.add(uid);
          }
        }
      }
    } catch { /* */ }

    // 4. Add cached/manually created users as fallback (only if not already fetched)
    localUsers.forEach(u => {
      if (!existingIds.has(u.id)) {
        mergedUsers.push(u);
        existingIds.add(u.id);
      }
    });

    // Cache merged list
    lsSet('ph.data.users', mergedUsers);
    return mergedUsers;
  })();

  try {
    return await listUsersPromise;
  } finally {
    listUsersPromise = null;
  }
}

async function saveUser(userId, updates) {
  const users = lsGet('ph.data.users', []);
  const idx = users.findIndex(u => u.id === userId);
  if (idx !== -1) {
    // Never persist passwords from the admin update form
    const { password, ...safeUpdates } = updates || {};
    users[idx] = { ...users[idx], ...safeUpdates };
    lsSet('ph.data.users', users);
  }
  return true;
}

async function createUser(userData) {
  const users = lsGet('ph.data.users', []);
  // Never persist passwords (even locally) to avoid leaking credentials.
  const { password, ...safeData } = userData || {};
  const newUser = { id: generateId(), ...safeData, enabled: true, created_at: new Date().toISOString(), last_login: '' };
  users.push(newUser);
  lsSet('ph.data.users', users);
  logActivity('user_created', `Usuario creado: ${safeData.username}`);
  return newUser;
}

async function deleteUser(userId) {
  const users = lsGet('ph.data.users', []);
  lsSet('ph.data.users', users.filter(u => u.id !== userId));
  logActivity('user_deleted', `Usuario eliminado: ${userId}`);
  return true;
}

// ==========================================
// FORMAT HELPERS
// ==========================================

const ACTION_LABELS = {
  'login': 'Inicio de sesión', 'logout': 'Cierre de sesión',
  'user_created': 'Usuario creado', 'user_deleted': 'Usuario eliminado',
  'user_updated': 'Usuario actualizado', 'reason_created': 'Razón creada',
  'reason_updated': 'Razón actualizada', 'reason_deleted': 'Razón eliminada',
  'song_created': 'Canción creada', 'song_updated': 'Canción actualizada',
  'song_deleted': 'Canción eliminada', 'gift_created': 'Regalo creado',
  'gift_updated': 'Regalo actualizado', 'gift_deleted': 'Regalo eliminado',
  'news_created': 'Noticia creada', 'news_updated': 'Noticia actualizada',
  'news_deleted': 'Noticia eliminada', 'series_created': 'Serie creada',
  'series_updated': 'Serie actualizada', 'series_deleted': 'Serie eliminada',
  'maldia_created': 'Frase/Mensaje creado', 'maldia_updated': 'Frase/Mensaje actualizado',
  'maldia_deleted': 'Frase/Mensaje eliminado'
};

function formatAction(action) { return ACTION_LABELS[action] || action; }

// ==========================================
// EXPORTS
// ==========================================

export const db = {
  getMoods, saveMood, getMoodMonth, getAllMoods, getUserMoods,
  getReasons, saveReasons,
  getSongs, saveSongs,
  getGifts, saveGifts,
  getNews, saveNews,
  getMaldiaFrases, getMaldiaMensajes, saveMaldiaFrases, saveMaldiaMensajes,
  getSeries, saveSeries,
  logActivity, getActivity, formatAction,
  trackVisit, getAnalytics,
  listUsers, saveUser, createUser, deleteUser,
  uploadAvatar,
  escapeHtml, generateId, checkConnection, isSupabaseConfigured
};
