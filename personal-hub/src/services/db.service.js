/* ==========================================
   Personal Hub v2 — Database Service
   Persistencia en Supabase con fallback a localStorage
   ========================================== */

import { supabase } from './supabase.js';
import { auth } from './auth.service.js';
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
// GUARDIA DE AUTORIZACIÓN
// ==========================================

/**
 * Barrera de autorización para toda escritura de contenido global.
 * Defensa en profundidad: la RLS de Supabase ya lo bloquea en servidor;
 * esta capa evita también el fallback a localStorage y las llamadas
 * directas desde la consola de un usuario no-admin.
 * Las acciones personales del usuario (mood, avatar, favoritos) NO pasan
 * por aquí: solo el contenido administrado por el admin.
 */
async function requireAdmin() {
  if (!auth.isAdmin()) {
    // Reintenta con el rol fresco de la DB (evita la ventana de timing
    // justo después del login, cuando refreshRole aún no ha resuelto).
    await auth.refreshRole();
    if (!auth.isAdmin()) {
      throw new Error('Acción restringida a administradores.');
    }
  }
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
  await requireAdmin(); // contenido global: solo ADMIN
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
    // El builder de supabase-js es thenable pero no expone .catch.
    // Además la tabla moods usa modelo de HISTORIAL (varias filas por día,
    // la constraint user_id+date se eliminó a propósito): usamos INSERT,
    // nunca upsert con onConflict (falla si la constraint no existe).
    try {
      await supabase.from('moods').insert({
        user_id: user.id, date, mood: moodData.mood,
        label: moodData.label, emoji: moodData.emoji,
        score: moodData.score, created_at: new Date().toISOString()
      });
    } catch { /* el fallback local ya está guardado */ }
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
// RINCÓN COVERS (via content table)
// ==========================================

async function getRinconCovers() {
  const data = await loadContent('rincon_covers', { covers: {} });
  return data.covers || {};
}

async function saveRinconCovers(covers) {
  return saveContent('rincon_covers', { covers });
}

// ==========================================
// AUDIOS (El Rincón — archivo del día 3)
// Almacenados en la tabla `content` como el resto
// de contenido global: Supabase con fallback local.
// ==========================================

/** Lista de audios del Rincón: [{ id, date, year, month, title?, url, duration?, creator?, createdAt? }] */
async function getAudios() {
  const data = await loadContent('audios', { audios: [] });
  return Array.isArray(data?.audios) ? data.audios : [];
}

async function saveAudios(audios) {
  return saveContent('audios', { audios: Array.isArray(audios) ? audios : [] });
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
// SERIES (via content table) — catálogo COMPARTIDO
// (la sección Series y el Admin lo leen/escriben en seriesData.js;
// aquí solo vive la capa Supabase, con fallback offline al espejo local)
// ==========================================

async function getSeries() {
  const data = await loadContent('series', { series: null });
  return data;
}

async function saveSeries(catalog) {
  return saveContent('series', { series: catalog });
}

// ==========================================
// OPEN WHEN (via content table) — cartas personalizadas del Admin
// (OpenWhen.js las fusiona con las cartas base de la app)
// ==========================================

function readOpenWhenMirror() {
  try {
    const raw = localStorage.getItem('ph.config.openwhen_letters');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.letters) ? parsed.letters : null;
  } catch { return null; }
}

async function getOpenWhenLetters() {
  // Fuente de verdad: Supabase; espejo local (ph.config.openwhen_letters)
  // como fallback offline (mismo patrón que el catálogo de Series).
  try {
    const data = await loadContent('openwhen_letters', { letters: [] });
    const letters = Array.isArray(data?.letters) ? data.letters : [];
    if (letters.length) {
      try { localStorage.setItem('ph.config.openwhen_letters', JSON.stringify({ letters })); } catch { /* cuota llena: ignorar */ }
      return letters;
    }
  } catch { /* sin red o Supabase caído: seguir con el espejo local */ }
  return readOpenWhenMirror() || [];
}

async function saveOpenWhenLetters(customLetters) {
  return saveContent('openwhen_letters', { letters: customLetters });
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
      // .catch no existe en el builder thenable de supabase-js: try/catch + await
      try {
        await supabase.from('activity_log').insert({
          action, user_id: user.id,
          details: details || '',
          timestamp: new Date().toISOString()
        });
      } catch { /* log local ya registrado */ }
    }
  } catch {}
}

async function getActivity(limit = 50) {
  const local = await getCollection(KEYS.activity, []);

  // Fuente de verdad: activity_log en Supabase (multi-dispositivo).
  // La RLS permite SELECT solo a admins (public.is_admin()).
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('activity_log')
        .select('id, action, details, timestamp, user_id')
        .order('timestamp', { ascending: false })
        .limit(limit * 2);
      if (!error && Array.isArray(data) && data.length > 0) {
        const remote = data.map(r => ({
          id: r.id,
          action: r.action,
          details: r.details || '',
          timestamp: r.timestamp
        }));
        // Merge con el espejo local (por si algún evento solo quedó ahí),
        // deduplicando por id y manteniendo el orden más reciente primero.
        const seen = new Set(remote.map(r => r.id));
        const localExtra = local.filter(e => e.id && !seen.has(e.id));
        return [...remote, ...localExtra].sort((a, b) =>
          new Date(b.timestamp || 0) - new Date(a.timestamp || 0)
        ).slice(0, limit);
      }
    } catch (err) {
      console.warn('[db] Supabase activity read failed:', err.message);
    }
  }

  return local.slice(0, limit);
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

// Upload gallery photos to Supabase Storage (same storage system as avatars).
// Falls back to 'galeria' bucket, then 'avatars' if the gallery bucket is missing.
async function uploadGalleryPhotos(files) {
  await requireAdmin(); // subir fotos de la galería: solo ADMIN
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');
  if (!files?.length) return [];

  const images = [...files].filter(f => f.type.startsWith('image/'));
  if (!images.length) throw new Error('Solo se permiten imágenes');
  const oversized = images.find(f => f.size > 5 * 1024 * 1024);
  if (oversized) throw new Error('Cada foto no puede superar los 5 MB');

  const buckets = ['galeria'];
  const urls = [];

  for (const file of images) {
    const fileExt = file.name.split('.').pop() || 'jpg';
    const filePath = `galeria/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${fileExt}`;
    let uploaded = false;
    let uploadError = null;

    for (const bucket of buckets) {
      const { error } = await supabase.storage.from(bucket).upload(filePath, file, { cacheControl: '3600', upsert: false });
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filePath);
        urls.push(publicUrl);
        uploaded = true;
        break;
      }
      uploadError = error;
    }

    if (!uploaded) {
      console.error('[db] Gallery upload failed:', uploadError);
      if (uploadError?.message?.includes('row-level security policy') || uploadError?.code === '42501') {
        throw new Error('No tienes permisos para subir fotos. Verifica el bucket "galeria" en Supabase.');
      }
      throw new Error('Hubo un problema al subir una foto. Inténtalo de nuevo.');
    }
  }

  return urls;
}

// Upload memes (images AND videos) to Supabase Storage.
// Falls back to 'memes' bucket, then 'galeria', then 'avatars'.
async function uploadMemes(files) {
  await requireAdmin(); // subir memes: solo ADMIN
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');
  if (!files?.length) return [];

  const media = [...files].filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
  if (!media.length) throw new Error('Solo se permiten imágenes y vídeos');
  const oversized = media.find(f => f.size > 50 * 1024 * 1024);
  if (oversized) throw new Error('Cada archivo no puede superar los 50 MB');

  const buckets = ['memes', 'galeria'];
  const urls = [];

  for (const file of media) {
    const fileExt = file.name.split('.').pop() || (file.type.startsWith('video/') ? 'mp4' : 'jpg');
    const filePath = `memes/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${fileExt}`;
    let uploaded = false;
    let uploadError = null;

    for (const bucket of buckets) {
      const { error } = await supabase.storage.from(bucket).upload(filePath, file, { cacheControl: '3600', upsert: false });
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filePath);
        urls.push(publicUrl);
        uploaded = true;
        break;
      }
      uploadError = error;
    }

    if (!uploaded) {
      console.error('[db] Meme upload failed:', uploadError);
      if (uploadError?.message?.includes('row-level security policy') || uploadError?.code === '42501') {
        throw new Error('No tienes permisos para subir memes. Verifica el bucket "memes" en Supabase.');
      }
      throw new Error('Hubo un problema al subir un archivo. Inténtalo de nuevo.');
    }
  }

  return urls;
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
  await requireAdmin(); // gestión de usuarios: solo ADMIN
  const users = lsGet('ph.data.users', []);
  const idx = users.findIndex(u => u.id === userId);
  if (idx !== -1) {
    // Never persist passwords from the admin update form
    const { password, ...safeUpdates } = updates || {};
    users[idx] = { ...users[idx], ...safeUpdates };
    lsSet('ph.data.users', users);
  }

  // Sincroniza con Supabase cuando el usuario es real (id UUID), no local
  if (typeof userId === 'string' && isUuid(userId)) {
    try {
      const sessionRes = await supabase.auth.getSession();
      const accessToken = sessionRes.data?.session?.access_token;
      if (accessToken) {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            action: 'update',
            id: userId,
            enabled: updates?.enabled
          })
        });
        // En dev (Vite) /api/users no existe y devuelve el HTML del SPA con 200:
        // detectarlo para no dar por hecho un cambio que no se aplicó.
        if (!res.ok || !(res.headers.get('content-type') || '').includes('application/json')) {
          console.warn('[db] Server user update skipped (dev o endpoint no disponible).');
        }
      }
    } catch (err) {
      console.warn('[db] Could not sync user update with server:', err.message);
    }
  }
  return true;
}

async function createUser(userData) {
  await requireAdmin(); // creación de usuarios: solo ADMIN
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
  await requireAdmin(); // eliminación de usuarios: solo ADMIN
  const users = lsGet('ph.data.users', []);
  lsSet('ph.data.users', users.filter(u => u.id !== userId));
  logActivity('user_deleted', `Usuario eliminado: ${userId}`);

  // Si es un usuario real de Supabase, elimínalo también en Auth
  if (typeof userId === 'string' && isUuid(userId)) {
    try {
      const sessionRes = await supabase.auth.getSession();
      const accessToken = sessionRes.data?.session?.access_token;
      if (accessToken) {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({ action: 'delete', id: userId })
        });
        if (!res.ok || !(res.headers.get('content-type') || '').includes('application/json')) {
          console.warn('[db] Server user deletion skipped (dev o endpoint no disponible).');
        }
      }
    } catch (err) {
      console.warn('[db] Could not sync user deletion with server:', err.message);
    }
  }
  return true;
}

/** ¿Es un id UUID real de Supabase Auth (no local)? */
function isUuid(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// ==========================================
// GIFT RESPONSES — respuestas de regalos interactivos
// Guardado local por usuario + sincronización con la tabla
// user_progress (type='gift_responses', RLS por usuario).
// ==========================================

const GIFT_RESPONSES_TYPE = 'gift_responses';

function giftResponsesLocalKey(userId) {
  return `ph.giftResponses.${userId || 'guest'}`;
}

function lsGetGiftResponses(userId) {
  return lsGet(giftResponsesLocalKey(userId), {});
}

async function getCurrentUserId() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch {
    return null;
  }
}

/**
 * Guarda la respuesta de un usuario a un regalo (p. ej. un día del
 * calendario). El dato vive en localStorage y se sincroniza con Supabase
 * (user_progress), de modo que el Admin puede verlo aunque el usuario
 * responda desde otro dispositivo.
 */
async function saveGiftResponse(giftId, text) {
  if (!giftId) throw new Error('Falta el identificador del regalo.');
  const clean = String(text || '').trim();
  if (!clean) throw new Error('Escribe una respuesta antes de enviar.');

  const userId = await getCurrentUserId();
  const all = lsGetGiftResponses(userId);
  let email = '';
  try {
    const { data: { user } } = await supabase.auth.getUser();
    email = user?.email || '';
  } catch { /* sin sesión */ }

  all[giftId] = { text: clean, respondedAt: new Date().toISOString(), email };
  lsSet(giftResponsesLocalKey(userId), all);

  // Sync a Supabase: una fila por usuario con todos sus regalos respondidos.
  if (userId && isSupabaseConfigured()) {
    try {
      const { error } = await supabase
        .from('user_progress')
        .upsert(
          { user_id: userId, type: GIFT_RESPONSES_TYPE, data: all, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,type' }
        );
      if (error) console.warn('[db] gift response sync failed:', error.message);
    } catch (err) {
      console.warn('[db] gift response sync failed:', err.message);
    }
  }
  return all[giftId];
}

/** Respuestas del usuario actual (por giftId). */
async function getMyGiftResponses() {
  const userId = await getCurrentUserId();
  if (userId && isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('user_progress')
        .select('data')
        .eq('user_id', userId)
        .eq('type', GIFT_RESPONSES_TYPE)
        .maybeSingle();
      if (!error && data?.data) {
        lsSet(giftResponsesLocalKey(userId), data.data);
        return data.data;
      }
    } catch { /* usa el guardado local */ }
  }
  return lsGetGiftResponses(userId);
}

/**
 * Todas las respuestas de todos los usuarios, agrupadas por giftId.
 * Uso exclusivo del Admin (la RLS del servidor lo refuerza).
 * Devuelve { [giftId]: [{ userId, email, text, respondedAt }] }.
 */
async function getAllGiftResponses() {
  const result = {};
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('user_progress')
        .select('user_id, data, updated_at')
        .eq('type', GIFT_RESPONSES_TYPE);
      if (!error && data) {
        data.forEach(row => {
          Object.entries(row.data || {}).forEach(([giftId, resp]) => {
            if (!result[giftId]) result[giftId] = [];
            result[giftId].push({
              userId: row.user_id,
              email: resp?.email || '',
              text: resp?.text || '',
              respondedAt: resp?.respondedAt || row.updated_at || ''
            });
          });
        });
        return result;
      }
    } catch { /* cae al guardado local */ }
  }

  // Fallback local: recoge todas las claves de respuestas de este navegador.
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('ph.giftResponses.')) continue;
      const userId = key.replace('ph.giftResponses.', '');
      const all = JSON.parse(localStorage.getItem(key) || '{}');
      Object.entries(all).forEach(([giftId, resp]) => {
        if (!result[giftId]) result[giftId] = [];
        result[giftId].push({
          userId,
          email: resp?.email || '',
          text: resp?.text || '',
          respondedAt: resp?.respondedAt || ''
        });
      });
    }
  } catch { /* sin datos locales */ }
  return result;
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
  'maldia_deleted': 'Frase/Mensaje eliminado', 'audio_created': 'Audio creado',
  'audio_updated': 'Audio actualizado', 'audio_deleted': 'Audio eliminado',
  'letter_created': 'Carta creada', 'letter_updated': 'Carta actualizada',
  'letter_deleted': 'Carta eliminada'
};

function formatAction(action) { return ACTION_LABELS[action] || action; }

// ==========================================
// EXPORTS
// ==========================================

export const db = {
  getMoods, saveMood, getMoodMonth, getAllMoods, getUserMoods,
  getReasons, saveReasons,
  getRinconCovers, saveRinconCovers,
  getAudios, saveAudios,
  getSongs, saveSongs,
  getGifts, saveGifts,
  getNews, saveNews,
  getSeries, saveSeries,
  getOpenWhenLetters, saveOpenWhenLetters,
  getMaldiaFrases, getMaldiaMensajes, saveMaldiaFrases, saveMaldiaMensajes,
  logActivity, getActivity, formatAction,
  trackVisit, getAnalytics,
  listUsers, saveUser, createUser, deleteUser,
  uploadAvatar, uploadGalleryPhotos, uploadMemes,
  saveGiftResponse, getMyGiftResponses, getAllGiftResponses,
  escapeHtml, generateId, checkConnection, isSupabaseConfigured
};
