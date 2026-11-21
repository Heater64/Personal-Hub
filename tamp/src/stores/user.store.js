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

    // Rol y estado de cuenta definitivos: viven en la tabla `profiles`, no
    // en user_metadata (que el usuario puede editar por su cuenta).
    // refreshAccount() además cierra la sesión si la cuenta fue
    // deshabilitada con la pestaña ya abierta, y en ese caso deja el
    // store vacío a través de onAuthChange.
    this._syncFromDatabase();
  }

  /**
   * Refleja en el store lo que devuelve profiles (role + enabled).
   * Es una foto del estado, no una espera: si la red falla, se conserva el
   * último estado conocido (auth.refreshAccount no lanza).
   */
  async _syncFromDatabase() {
    await auth.refreshAccount();
    if (!auth.isLoggedIn()) return; // sesión cerrada: el store ya está limpio
    this.isAdmin = auth.isAdmin();
    if (this.user) this.user.role = this.isAdmin ? 'admin' : 'user';
    this._notify();
  }

  getUser() {
    return this.user;
  }

  updateProfile(updates, persist = true) {
    if (!this.user) return;
    Object.assign(this.user, updates);

    // Persist name/avatar to Supabase metadata only when explicitly requested.
    // Some callers (e.g. avatar upload) already update metadata server-side.
    // NUNCA se envían enabled ni role: el usuario podría auto-habilitarse o
    // auto-ascenderse. La DB (017) lo bloquea, y ni siquiera lo intentamos.
    if (persist) {
      const data = {};
      if (updates.name) data.name = updates.name;
      if (updates.avatar) data.avatar_url = updates.avatar;
      delete data.enabled;
      delete data.role;
      if (Object.keys(data).length > 0) {
        supabase.auth.updateUser({ data });
      }
    }

    this._notify();
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
