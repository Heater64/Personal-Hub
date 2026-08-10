/* ==========================================
   Personal Hub v2 — Auth Service
   Maneja toda la autenticación via Supabase Auth
   ========================================== */

import { supabase } from './supabase.js';

const ADMIN_EMAILS = ['admin@personalhub.com'];

class AuthService {
  constructor() {
    this.currentUser = null;
    this._profileRole = null; // rol leído de la tabla profiles (fuente de verdad en DB)
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
   * Refresca el rol desde la tabla profiles (RLS permite leer el propio perfil).
   * Fuente de verdad en la base de datos: el rol no puede alterarse desde el
   * cliente (trigger prevent_role_escalation + política admin-only).
   */
  async refreshRole() {
    const user = this.currentUser;
    if (!user) {
      this._profileRole = null;
      return;
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      if (!error && data?.role && data.role !== this._profileRole) {
        this._profileRole = data.role;
        this._notify(); // userStore recalcula isAdmin con el rol de DB
      }
    } catch {
      // Sin cambios ante errores de red: se mantiene el rol conocido
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

    // Si el admin deshabilitó esta cuenta (metadata.enabled = false), se cierra
    // la sesión recién creada y se rechaza el acceso.
    const disabled = data?.user?.user_metadata?.enabled === false;
    if (disabled) {
      try { await supabase.auth.signOut(); } catch { /* */ }
      this.currentUser = null;
      this._notify();
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
    // Fuente primaria: rol en profiles (protegido en DB por trigger anti-escalación).
    // Respaldo: email verificado por Supabase Auth (inmutable en el JWT).
    return this._profileRole === 'admin' || ADMIN_EMAILS.includes(this.currentUser.email);
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
