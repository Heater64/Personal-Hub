/* ==========================================
   Personal Hub v2 — Mood Store
   Estado de ánimo diario de la usuaria
   ========================================== */

import { supabase } from '../services/supabase.js';
import { notifyMoodSaved } from '../services/notifications.service.js';
import { userStore } from './user.store.js';
import { userPrefKey } from '../utils/userStorage.js';
import { todayISO } from '../utils/format.js';

// Catálogo y resolución viven en un módulo sin dependencias, para poder
// probarlas en aislamiento y no duplicarlas en cada página.
import { MOODS, LEGACY_MOODS, ALL_MOODS, findMood, resolveMood, moodEmoji } from '../data/moods.data.js';

// Ventana de edición de un estado: dentro de estos 5 minutos los cambios
// sobreescriben el MISMO estado (los toques rápidos de prueba colapsan en
// uno solo, queda solo el último). Pasados los 5 minutos, el siguiente
// cambio crea un SEGUNDO estado del día y el anterior queda bloqueado.
const STATE_WINDOW_MS = 5 * 60 * 1000;

// Storage keys are scoped per user so different accounts on the same browser
// do not share mood state.
// El "día" del ánimo cambia a las 00:00 de España (península), no a la
// hora local/UTC del dispositivo.
function todayISOStr() {
  return todayISO();
}

function getMoodDateKey() {
  return userPrefKey('moodDate');
}

function getMoodKey() {
  return userPrefKey('mood');
}

class MoodStore {
  constructor() {
    this.todayMood = null;
    // Quien pinte el ánimo del día (Inicio) se suscribe aquí en vez de
    // repintar a ciegas con temporizadores o al recuperar el foco.
    this.listeners = new Set();
  }

  /**
   * Escucha los cambios del ánimo de hoy: registrarlo, quitarlo o que llegue
   * de Supabase al arrancar. Devuelve la función para dejar de escuchar.
   */
  subscribe(fn) {
    if (typeof fn !== 'function') return () => {};
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Avisa a los suscriptores con el estado visible (o null) del día. */
  _emitMoodChange() {
    const mood = this.getTodayMood();
    for (const fn of this.listeners) {
      try { fn(mood); } catch { /* un suscriptor roto no puede tumbar a los demás */ }
    }
  }

  getMoods() {
    return MOODS;
  }

  /** Catálogo anterior: solo para leer lo ya registrado. */
  getLegacyMoods() {
    return LEGACY_MOODS;
  }

  getMoodById(id) {
    return findMood(id);
  }

  /**
   * Resuelve un estado para MOSTRARLO, sin depender del catálogo actual.
   * Acepta un id suelto o una entrada { mood, label, emoji, score }.
   * Prioridad: lo que venía guardado en la fila (fiel al histórico) →
   * catálogo actual → catálogo antiguo. Devuelve null solo si no hay nada.
   */
  /** Delega en la lógica pura de moods.data.js. */
  resolveMood(entry) {
    return resolveMood(entry);
  }

  /** Emoji de un estado, sin devolver undefined. */
  moodEmoji(entry) {
    return moodEmoji(entry);
  }

  hasSeenToday() {
    return localStorage.getItem(getMoodDateKey()) === todayISOStr();
  }

  markSeen() {
    localStorage.setItem(getMoodDateKey(), todayISOStr());
  }

  /**
   * Guarda el ánimo de hoy con modelo de ESTADOS:
   * - Si el último estado es reciente (≤ 5 min desde su última actualización),
   *   se SOBREESCRIBE ese mismo estado (los cambios rápidos colapsan en uno;
   *   solo queda el último).
   * - Si pasaron más de 5 min, el estado anterior queda BLOQUEADO y este
   *   cambio crea un SEGUNDO estado del día (nueva fila en Supabase).
   * La usuaria ve solo su última modificación; el Admin ve todos los estados
   * del día (cada uno es una fila en la tabla moods).
   */
  async saveMood(moodId) {
    const mood = this.getMoodById(moodId);
    if (!mood) throw new Error('Estado de ánimo inválido');

    const user = userStore.getUser();
    if (!user) throw new Error('Debes iniciar sesión');

    const today = todayISOStr();
    const now = Date.now();
    const states = this._getTodayStates();
    const current = states.length ? states[states.length - 1] : null;
    const fresh = current && (now - current.updatedAt) <= STATE_WINDOW_MS;

    if (current && fresh) {
      // Cambio dentro de la ventana → actualiza el mismo estado (solo el último cuenta)
      current.mood = mood.id;
      current.label = mood.label;
      current.emoji = mood.emoji;
      current.score = mood.score;
      current.updatedAt = now;
      await this._updateSupabaseState(current);
    } else {
      // Nuevo estado del día (el anterior queda bloqueado)
      const state = {
        id: null, // id de la fila en Supabase (se rellena tras el INSERT)
        date: today,
        mood: mood.id,
        label: mood.label,
        emoji: mood.emoji,
        score: mood.score,
        createdAt: now,
        updatedAt: now
      };
      await this._insertSupabaseState(state, user, today);
      states.push(state);
    }

    this._persistTodayStates(states);
    this._finalizeLocalState(states, today, mood);
    this._notifyMood(mood);
    return mood;
  }

  /**
   * Aviso de "animo registrado". Va aquí y no en las pantallas porque el
   * store es el ÚNICO punto por el que se escribe un estado: así se avisa
   * igual desde Sentimientos, desde el perfil y desde la bienvenida.
   *
   * Nunca puede romper el guardado: si el aviso falla, el estado ya está
   * escrito y eso es lo importante. No espera (fire and forget) para que
   * poner el ánimo sea instantáneo.
   */
  _notifyMood(mood) {
    notifyMoodSaved(mood).catch(() => { /* sin notificaciones: el estado sigue guardado */ });
  }

  /**
   * Elimina el estado actual del día si sigue en su ventana de edición
   * (≤ 5 min): la emoción se quita del todo (también su fila en Supabase)
   * y el día vuelve a quedar "sin emoción" o con el estado anterior.
   * Si el estado ya quedó bloqueado (> 5 min) NO se puede modificar y se
   * devuelve { locked: true }.
   */
  async removeTodayMood() {
    const user = userStore.getUser();
    if (!user) throw new Error('Debes iniciar sesión');

    const today = todayISOStr();
    const states = this._getTodayStates();
    const current = states.length ? states[states.length - 1] : null;
    if (!current) return { removed: false, mood: null };

    const now = Date.now();
    if ((now - current.updatedAt) > STATE_WINDOW_MS) {
      return { removed: false, locked: true, mood: this._stateToMood(current) };
    }

    // Elimina la fila (solo si se creó online con id real)
    await this._deleteSupabaseState(current);
    states.pop();
    this._persistTodayStates(states);

    const prev = states.length ? this._stateToMood(states[states.length - 1]) : null;
    this._finalizeLocalState(states, today, prev);
    // Si queda otro estado anterior, el día no está "sin ánimo": el aviso
    // habla del que ha quedado, no de uno que ya no existe.
    this._notifyMood(prev);
    return { removed: true, mood: prev };
  }

  /** Ánimo del último estado del día (el que ve la usuaria) */
  _stateToMood(state) {
    if (!state) return null;
    return { id: state.mood, label: state.label, emoji: state.emoji, score: state.score };
  }

  /** Estados de HOY (fuente local para la ventana de 5 min y el offline) */
  _getTodayStates() {
    try {
      const today = todayISOStr();
      const raw = localStorage.getItem(userPrefKey('moodStates'));
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(s => s.date === today);
    } catch { return []; }
  }

  _persistTodayStates(states) {
    try {
      localStorage.setItem(userPrefKey('moodStates'), JSON.stringify(states));
    } catch { /* cuota llena: ignorar */ }
  }

  async _insertSupabaseState(state, user, today) {
    try {
      const { data, error } = await supabase
        .from('moods')
        .insert({
          user_id: user.id,
          date: today,
          mood: state.mood,
          label: state.label,
          emoji: state.emoji,
          score: state.score,
          created_at: new Date().toISOString()
        })
        .select();
      if (error) throw error;
      if (data?.[0]?.id) state.id = data[0].id;
    } catch (err) {
      console.warn('Error saving mood to Supabase:', err);
    }
  }

  async _updateSupabaseState(state) {
    if (!state.id) return; // estado solo local (sin fila online todavía)
    try {
      const { error } = await supabase
        .from('moods')
        .update({
          mood: state.mood,
          label: state.label,
          emoji: state.emoji,
          score: state.score,
          created_at: new Date().toISOString()
        })
        .eq('id', state.id);
      if (error) throw error;
    } catch (err) {
      console.warn('Error updating mood in Supabase:', err);
    }
  }

  async _deleteSupabaseState(state) {
    if (!state.id) return;
    try {
      const { error } = await supabase.from('moods').delete().eq('id', state.id);
      if (error) throw error;
    } catch (err) {
      console.warn('Error deleting mood in Supabase:', err);
    }
  }

  /** Refresca el estado "visible" de la usuaria + historial + fallback admin */
  _finalizeLocalState(states, today, mood) {
    this.todayMood = mood;
    this.markSeen();
    if (mood) {
      localStorage.setItem(getMoodKey(), JSON.stringify(mood));
    } else {
      localStorage.removeItem(getMoodKey());
    }

    // Historial compartido (ph.data.moods): último estado del día para el
    // fallback local del Admin (Ánimo) cuando Supabase no está disponible.
    try {
      const shared = JSON.parse(localStorage.getItem('ph.data.moods') || '{}');
      if (mood) {
        shared[today] = {
          mood: mood.id, label: mood.label, emoji: mood.emoji,
          score: mood.score, updatedAt: new Date().toISOString()
        };
      } else {
        delete shared[today];
      }
      localStorage.setItem('ph.data.moods', JSON.stringify(shared));
    } catch { /* cuota llena: ignorar */ }

    // Historial local (upsert por día con el último estado)
    const history = this.getHistory();
    const existingIdx = history.findIndex(h => h.date === today);
    if (mood) {
      // Se guarda la etiqueta y el emoji, no solo el id: si mañana cambia el
      // catálogo, los días de hoy siguen leyéndose tal como se registraron.
      const entry = { moodId: mood.id, date: today, label: mood.label, emoji: mood.emoji, score: mood.score };
      if (existingIdx >= 0) history[existingIdx] = entry;
      else history.push(entry);
    } else if (existingIdx >= 0) {
      history.splice(existingIdx, 1);
    }
    localStorage.setItem(userPrefKey('moodHistory'), JSON.stringify(history));
    this._emitMoodChange();
  }

  /**
   * Historial local normalizado. Acepta las dos formas:
   *   { moodId, date }                  → formato antiguo (sin etiqueta)
   *   { moodId, date, label, emoji, … } → formato actual
   * Siempre devuelve entradas con `date` y `moodId` resueltos.
   */
  getHistory() {
    try {
      const raw = localStorage.getItem(userPrefKey('moodHistory'));
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map(e => (e && e.date ? { ...e, moodId: e.moodId || e.mood } : null))
        .filter(e => e && e.moodId);
    } catch { return []; }
  }

  /**
   * Fetches today's mood from Supabase for the current user.
   * Caches the result in localStorage so subsequent calls are fast.
   * Returns the mood object, or null if none exists.
   */
  async fetchTodayMood() {
    const user = userStore.getUser();
    if (!user) return null;

    const today = todayISOStr();

    try {
      const { data, error } = await supabase
        .from('moods')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        const mood = {
          id: data.mood,
          label: data.label,
          emoji: data.emoji,
          score: data.score
        };
        this.todayMood = mood;
        this.markSeen();
        localStorage.setItem(getMoodKey(), JSON.stringify(mood));

        // Siembra los estados locales de hoy con la fila más reciente para que
        // la ventana de 5 min siga funcionando tras recargar/cambiar de dispositivo.
        const createdAt = data.created_at ? Date.parse(data.created_at) : Date.now();
        this._persistTodayStates([{
          id: data.id || null,
          date: today,
          mood: data.mood,
          label: data.label,
          emoji: data.emoji,
          score: data.score,
          createdAt,
          updatedAt: createdAt
        }]);
        // El ánimo que pinta el Inicio puede llegar después del primer render.
        this._emitMoodChange();
        return mood;
      }
    } catch (err) {
      console.warn('Error fetching today mood from Supabase:', err);
    }

    // Fall back to locally cached mood
    const fallback = this.getTodayMood();
    this._emitMoodChange();
    return fallback;
  }

  getTodayMood() {
    try {
      const raw = localStorage.getItem(getMoodKey());
      const today = todayISOStr();
      const savedDate = localStorage.getItem(getMoodDateKey());
      if (raw && savedDate === today) {
        return JSON.parse(raw);
      }
    } catch (e) { /* */ }
    return null;
  }

  async getMoodHistory(userId, startDate, endDate) {
    try {
      const { data, error } = await supabase
        .from('moods')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.warn('Error loading mood history:', err);
      return [];
    }
  }
}

export const moodStore = new MoodStore();
export { MOODS, LEGACY_MOODS, ALL_MOODS };
