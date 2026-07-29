/* ==========================================
   Personal Hub v2 — User Store
   Estado global del usuario autenticado
   ========================================== */

import { auth } from '../services/auth.service.js';
import { supabase } from '../services/supabase.js';

class UserStore {
  constructor() {
    this.user = null;
    this.isAdmin = false;
    this.isLoggedIn = false;
    this._listeners = [];
    this._init();
  }

  _init() {
    // Listen to auth changes
    auth.onAuthChange((supabaseUser) => {
      if (supabaseUser) {
        this.user = {
          id: supabaseUser.id,
          email: supabaseUser.email,
          name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'Usuario',
          avatar: supabaseUser.user_metadata?.avatar_url || '',
          role: auth.isAdmin() ? 'admin' : 'user',
          created_at: supabaseUser.created_at
        };
        this.isAdmin = auth.isAdmin();
        this.isLoggedIn = true;
      } else {
        this.user = null;
        this.isAdmin = false;
        this.isLoggedIn = false;
      }
      this._notify();
    });
  }

  getUser() {
    return this.user;
  }

  updateProfile(updates) {
    if (this.user) {
      Object.assign(this.user, updates);
      // Persist name to Supabase metadata
      if (updates.name) {
        supabase.auth.updateUser({ data: { name: updates.name } });
      }
      this._notify();
    }
  }

  onChange(callback) {
    this._listeners.push(callback);
    try { callback(this.user); } catch (e) { /* */ }
    return () => {
      this._listeners = this._listeners.filter(l => l !== callback);
    };
  }

  _notify() {
    this._listeners.forEach(cb => {
      try { cb(this.user); } catch (e) { /* */ }
    });
  }
}

export const userStore = new UserStore();
