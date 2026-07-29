/* ==========================================
   Personal Hub v2 — Auth Service
   Maneja toda la autenticación via Supabase Auth
   ========================================== */

import { supabase } from './supabase.js';

const ADMIN_EMAILS = ['admin@personalhub.com'];

class AuthService {
  constructor() {
    this.currentUser = null;
    this._listeners = [];
    this._init();
  }

  _init() {
    // Listen to auth state changes from Supabase
    supabase.auth.onAuthStateChange((event, session) => {
      this.currentUser = session?.user || null;
      this._notify();
    });

    // Try to get current session
    this._restoreSession();
  }

  async _restoreSession() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        this.currentUser = session.user;
        this._notify();
      }
    } catch (err) {
      /* Session restore failed silently */
    }
  }

  async signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  }

  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    this.currentUser = null;
    this._notify();
  }

  getUser() {
    return this.currentUser;
  }

  getSession() {
    return supabase.auth.getSession();
  }

  isLoggedIn() {
    return !!this.currentUser;
  }

  isAdmin() {
    if (!this.currentUser) return false;
    return ADMIN_EMAILS.includes(this.currentUser.email);
  }

  onAuthChange(callback) {
    this._listeners.push(callback);
    // Immediately call with current state
    try { callback(this.currentUser); } catch (e) { /* */ }
    // Return unsubscribe function
    return () => {
      this._listeners = this._listeners.filter(l => l !== callback);
    };
  }

  _notify() {
    this._listeners.forEach(cb => {
      try { cb(this.currentUser); } catch (e) { /* */ }
    });
  }
}

export const auth = new AuthService();
