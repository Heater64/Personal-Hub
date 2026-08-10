/* ==========================================
   Personal Hub v2 — Mood Store
   Estado de ánimo diario de la usuaria
   ========================================== */

import { supabase } from '../services/supabase.js';
import { userStore } from './user.store.js';
import { userPrefKey } from '../utils/userStorage.js';
import { todayISO } from '../utils/format.js';

const MOODS = [
  { id: 'great',  label: 'Muy bieeeen',         emoji: '🤍🤍🤍', score: 4 },
  { id: 'good',   label: 'Bien',                emoji: '😊',      score: 3 },
  { id: 'meh',    label: 'Un poquito mal',       emoji: '😕',      score: 2 },
  { id: 'bad',    label: 'Mal',                 emoji: '😔',      score: 1 },
  { id: 'love',   label: 'Necesito cariño',     emoji: '❤️',      score: 0 }
];

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
  }

  getMoods() {
    return MOODS;
  }

  getMoodById(id) {
    return MOODS.find(m => m.id === id) || null;
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
    return mood;
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
      const entry = { moodId: mood.id, date: today };
      if (existingIdx >= 0) history[existingIdx] = entry;
      else history.push(entry);
    } else if (existingIdx >= 0) {
      history.splice(existingIdx, 1);
    }
    localStorage.setItem(userPrefKey('moodHistory'), JSON.stringify(history));
  }

  /** Returns local mood history as { moodId, date }[] */
  getHistory() {
    try {
      const raw = localStorage.getItem(userPrefKey('moodHistory'));
      return raw ? JSON.parse(raw) : [];
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
        return mood;
      }
    } catch (err) {
      console.warn('Error fetching today mood from Supabase:', err);
    }

    // Fall back to locally cached mood
    return this.getTodayMood();
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
export { MOODS };
