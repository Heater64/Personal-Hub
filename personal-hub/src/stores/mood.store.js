/* ==========================================
   Personal Hub v2 — Mood Store
   Estado de ánimo diario de la usuaria
   ========================================== */

import { supabase } from '../services/supabase.js';
import { userStore } from './user.store.js';
import { userPrefKey } from '../utils/userStorage.js';

const MOODS = [
  { id: 'great',  label: 'Muy bieeeen',         emoji: '🤍🤍🤍', score: 4 },
  { id: 'good',   label: 'Bien',                emoji: '😊',      score: 3 },
  { id: 'meh',    label: 'Un poquito mal',       emoji: '😕',      score: 2 },
  { id: 'bad',    label: 'Mal',                 emoji: '😔',      score: 1 },
  { id: 'love',   label: 'Necesito cariño',     emoji: '❤️',      score: 0 }
];

// Storage keys are scoped per user so different accounts on the same browser
// do not share mood state.
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
    const today = new Date().toISOString().split('T')[0];
    return localStorage.getItem(getMoodDateKey()) === today;
  }

  markSeen() {
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem(getMoodDateKey(), today);
  }

  async saveMood(moodId) {
    const mood = this.getMoodById(moodId);
    if (!mood) throw new Error('Estado de ánimo inválido');

    const user = userStore.getUser();
    if (!user) throw new Error('Debes iniciar sesión');

    const today = new Date().toISOString().split('T')[0];

    // Save to Supabase
    try {
      const { error } = await supabase
        .from('moods')
        .upsert({
          user_id: user.id,
          date: today,
          mood: mood.id,
          label: mood.label,
          emoji: mood.emoji,
          score: mood.score,
          created_at: new Date().toISOString()
        }, { onConflict: 'user_id,date' });

      if (error) throw error;
    } catch (err) {
      console.warn('Error saving mood to Supabase:', err);
    }

    // Local fallback
    this.todayMood = mood;
    this.markSeen();
    localStorage.setItem(getMoodKey(), JSON.stringify(mood));

    return mood;
  }

  /**
   * Fetches today's mood from Supabase for the current user.
   * Caches the result in localStorage so subsequent calls are fast.
   * Returns the mood object, or null if none exists.
   */
  async fetchTodayMood() {
    const user = userStore.getUser();
    if (!user) return null;

    const today = new Date().toISOString().split('T')[0];

    try {
      const { data, error } = await supabase
        .from('moods')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .single();

      if (error) throw error;

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
      const today = new Date().toISOString().split('T')[0];
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
