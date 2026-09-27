/* ==========================================
   Personal Hub v2 — Auth Service
   Maneja toda la autenticación via Supabase Auth
   ========================================== */

import { supabase } from './supabase.js';

const ADMIN_EMAILS = ['admin@personalhub.com'];

class AuthService {
  constructor() {
    this.currentUser = null;
    this._profileRole = null;   // rol leído de la tabla profiles (fuente de verdad en DB)
    this._profileEnabled = null; // enabled leído de la tabla profiles (fuente de verdad en DB)
    this._listeners = [];
    this._readyResolve = null;
    this.readyPromise = new Promise((resolve) => {
      this._readyResolve = resolve;
    });
    this._ready = false;
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
    } finally {
      this._markReady();
    }
  }

  _markReady() {
    if (!this._ready) {
      this._ready = true;
      if (this._readyResolve) this._readyResolve();
    }
  }

  /**
   * Promise that resolves once the initial session restoration attempt is done.
   * Use this before making auth-dependent decisions (e.g. route guards).
   */
  isReady() {
    return this.readyPromise;
  }

  /**
   * Refresca rol Y estado de la cuenta desde la tabla profiles.
   *
   * Fuente de verdad: `profiles`, no `auth.users.raw_user_meta_data`.
   * Supabase permite al usuario editar su propio user_metadata con
   * supabase.auth.updateUser({ data }) sin ninguna verificación, así que
   * leer `enabled` de ahí era auto-habilitable. La RLS permite leer el
   * propio perfil; el trigger prevent_role_escalation impide cambiar
   * role/enabled desde el cliente.
   *
   * Si la cuenta está deshabilitada, cierra la sesión: es una medida de
   * UX (el token sigue siendo válido hasta que expira), no de seguridad.
   * La seguridad real está en la RLS (is_enabled) y en /api/*.
   *
   * @returns {Promise<{ role: string|null, enabled: boolean }>}
   */
  async refreshAccount() {
    const user = this.currentUser;
    if (!user) {
      this._profileRole = null;
      this._profileEnabled = null;
      return { role: null, enabled: true };
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, enabled')
        .eq('id', user.id)
        .maybeSingle();
      if (error) return { role: this._profileRole, enabled: this._profileEnabled !== false };

      const enabled = data?.enabled !== false;
      const role = data?.role || null;
      const changed = role !== this._profileRole || enabled !== this._profileEnabled;
      this._profileRole = role;
      this._profileEnabled = enabled;

      if (enabled === false) {
        // Cuenta deshabilitada con la sesión todavía abierta: se cierra.
        await this._forceSignOut();
        return { role, enabled };
      }

      if (changed) this._notify(); // userStore recalcula isAdmin con el rol de DB
      return { role, enabled };
    } catch {
      // Sin cambios ante errores de red: se mantiene el estado conocido.
      return { role: this._profileRole, enabled: this._profileEnabled !== false };
    }
  }

  /**
   * Cierre de sesión local sin tocar la red: usado cuando detectamos que
   * la cuenta ya no es válida y no queremos depender del servidor.
   */
  async _forceSignOut() {
    try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* */ }
    this.currentUser = null;
    this._profileRole = null;
    this._profileEnabled = null;
    this._notify();
  }

  /** Alias kept for callers that only care about the role. */
  async refreshRole() {
    await this.refreshAccount();
  }

  /** true si el último refreshAccount() confirmó la cuenta activa. */
  isEnabled() {
    return this._profileEnabled !== false;
  }

  async signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  }

  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    // El estado de la cuenta se lee de profiles (RLS, trigger anti-escalación),
    // NO de user_metadata: ese campo lo puede editar el propio usuario con
    // supabase.auth.updateUser({ data }) y auto-habilitarse.
    this.currentUser = data?.user || null;
    const { enabled } = await this.refreshAccount();
    if (!enabled) {
      throw new Error('Tu cuenta está deshabilitada. Contacta con el administrador.');
    }

    return data;
  }

  async signOut() {
    // Invalidación en servidor (best effort): si la red falla, el logout
    // local continúa — nunca se bloquea el cierre de sesión por estar offline.
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch { /* red caída: el cierre local no puede depender del servidor */ }

    // Limpieza local garantizada (funciona sin conexión): sin esto, si la
    // llamada de red falla antes de borrar la sesión, el token persiste en
    // localStorage y un reload volvería a autenticar al usuario.
    try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* */ }

    // Purga las cachés del service worker: en un ordenador compartido, lo
    // cacheado por la sesión anterior debe desaparecer al cerrar sesión.
    this._clearServiceWorkerCaches();

    this.currentUser = null;
    this._profileRole = null;
    this._profileEnabled = null;
    this._notify();
  }

  /**
   * Pide al service worker que vacíe sus cachés (CLEAR_CACHES). Sin red y
   * sin service worker es un no-op silencioso.
   */
  _clearServiceWorkerCaches() {
    try {
      if (!('serviceWorker' in navigator)) return;
      navigator.serviceWorker.ready
        .then(reg => reg.active?.postMessage({ type: 'CLEAR_CACHES' }))
        .catch(() => {});
    } catch { /* sin soporte */ }
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
    // Una cuenta deshabilitada no es admin aunque conserve el rol
    // (mismo criterio que public.is_admin() en 017_enabled_autoritativo.sql).
    if (this._profileEnabled === false) return false;
    // Fuente primaria: rol en profiles (protegido en DB por trigger anti-escalación).
    // Respaldo: email verificado por Supabase Auth (inmutable en el JWT).
    const email = String(this.currentUser.email || '').toLowerCase();
    const emailVerified = !!(this.currentUser.email_confirmed_at || this.currentUser.confirmed_at);
    return emailVerified && (this._profileRole === 'admin' || ADMIN_EMAILS.includes(email));
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
