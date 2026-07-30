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
    // Wait for the initial session restoration before doing anything;
    // this avoids a transient null -> user flash on startup.
    auth.isReady().then(() => {
      this._setUser(auth.getUser());

      // Listen to subsequent auth changes
      auth.onAuthChange((supabaseUser) => {
        this._setUser(supabaseUser);
      });
    });
  }

  _setUser(supabaseUser) {
    if (supabaseUser) {
      const admin = auth.isAdmin();
      this.user = {
        id: supabaseUser.id,
        email: supabaseUser.email,
        name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'Usuario',
        avatar: supabaseUser.user_metadata?.avatar_url || '',
        role: admin ? 'admin' : 'user',
        created_at: supabaseUser.created_at
      };
      this.isAdmin = admin;
      this.isLoggedIn = true;
    } else {
      this.user = null;
      this.isAdmin = false;
      this.isLoggedIn = false;
    }
    this._notify();
  }

  getUser() {
    return this.user;
  }

  updateProfile(updates, persist = true) {
    if (this.user) {
      Object.assign(this.user, updates);
      // Persist name/avatar to Supabase metadata only when explicitly requested.
      // Some callers (e.g. avatar upload) already update metadata server-side.
      if (persist) {
        const data = {};
        if (updates.name) data.name = updates.name;
        if (updates.avatar) data.avatar_url = updates.avatar;
        if (Object.keys(data).length > 0) {
          supabase.auth.updateUser({ data });
        }
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
