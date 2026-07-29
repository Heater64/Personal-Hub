/* ==========================================
   Personal Hub v2 — Mood Store
   Estado de ánimo diario de la usuaria
   ========================================== */

import { supabase } from '../services/supabase.js';
import { userStore } from './user.store.js';

const MOODS = [
  { id: 'great',  label: 'Muy bieeeen',         emoji: '🤍🤍🤍', score: 4 },
  { id: 'good',   label: 'Bien',                emoji: '😊',      score: 3 },
  { id: 'meh',    label: 'Un poquito mal',       emoji: '😕',      score: 2 },
  { id: 'bad',    label: 'Mal',                 emoji: '😔',      score: 1 },
  { id: 'love',   label: 'Necesito cariño',     emoji: '❤️',      score: 0 }
];

const STORAGE_KEY = 'ph.moodDate';

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
    return localStorage.getItem(STORAGE_KEY) === today;
  }

  markSeen() {
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem(STORAGE_KEY, today);
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
    localStorage.setItem('ph.mood', JSON.stringify(mood));

    return mood;
  }

  getTodayMood() {
    try {
      const raw = localStorage.getItem('ph.mood');
      const today = new Date().toISOString().split('T')[0];
      const savedDate = localStorage.getItem(STORAGE_KEY);
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
